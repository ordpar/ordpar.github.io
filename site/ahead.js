(function (global) {
  'use strict';

  var doc = global.document;
  var REST_MS = 150;
  var FULL_MAX = 3;
  var VALUES = ['point', 'click', 'page'];


  function stored() {
    if (typeof global.ordparRead === 'function') { return global.ordparRead('minifetch'); }
    try { return global.localStorage.getItem('minifetch'); } catch (e) { return null; }
  }

  function mode() {
    var sh = global.ordparShell, m = null;
    if (sh && sh.getSetting) { m = sh.getSetting('minifetch'); }
    if (VALUES.indexOf(m) === -1) { m = stored(); }
    if (VALUES.indexOf(m) === -1) { m = 'point'; }
    var c = global.navigator && global.navigator.connection;
    return m === 'page' && c && c.saveData ? 'click' : m;
  }


  var queued = Object.create(null), list = [], pumping = false;
  function idle(f) {
    if (global.requestIdleCallback) { global.requestIdleCallback(f, { timeout: 3000 }); } else { setTimeout(f, 200); }
  }
  function pump() {
    if (pumping) { return; }
    var job = list.shift();
    if (!job) { return; }
    pumping = true;
    idle(function () {
      var p;
      try { p = Promise.resolve(job()); } catch (e) { p = Promise.resolve(); }
      p.then(next, next);
    });
  }
  function next() { pumping = false; pump(); }

  function queue(key, fn) {
    if (queued[key]) { return; }
    queued[key] = 1;
    list.push(fn);
    pump();
  }


  var warmed = Object.create(null);

  function origin() { return global.location ? global.location.origin : ''; }

  function get(url) {
    if (!global.fetch) { return Promise.resolve(null); }
    return global.fetch(url, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; });
  }

  function assetsOf(html) {
    var have = Object.create(null), out = [], d = global.document;
    if (d && d.querySelectorAll) {
      Array.prototype.forEach.call(d.querySelectorAll('script[src], link[rel="stylesheet"][href]'), function (n) {
        have[n.getAttribute('src') || n.getAttribute('href')] = 1;
      });
    }
    var re = /<(?:script[^>]*\ssrc|link[^>]*\shref)="(\/site\/[\w.\/-]+\.(?:js|css)(?:\?v=[0-9a-f]+)?)"/g, m;
    while ((m = re.exec(html))) {
      if (!have[m[1]] && out.indexOf(m[1]) === -1) { out.push(m[1]); }
    }
    return out;
  }

  function answersInPlace() {
    var sh = global.ordparShell;
    return !!(sh && sh.answersInPlace && sh.answersInPlace());
  }

  function warmArticle(id, here) {
    var S = global.ordparSearch;
    if (here && S && S.fetchArticle) { return Promise.resolve(S.fetchArticle(id)); }
    return warm('/bm-en/' + id + '/');
  }

  function warmSearch(q, here) {
    var L = global.ordparLookup;
    if (!L || !L.lookup || !q) { return Promise.resolve(); }
    return Promise.resolve(L.lookup(q)).then(function (res) {
      if (!res) { return; }
      var ids = [];
      (res.heads || []).forEach(function (g) { g.articles.forEach(function (a) { ids.push(a.id); }); });
      var sh = global.ordparShell;
      var lv = sh && sh.getSetting ? sh.getSetting('listview') : 'forms';
      var full = L.useList ? !L.useList(lv, ids.length, L.formHits ? L.formHits(res) : 0)
        : lv === 'off' || (lv !== 'on' && ids.length === 1);
      if (!full) { return; }
      return Promise.all(ids.slice(0, FULL_MAX).map(function (id) { return warmArticle(id, here); }));
    }).catch(function () {  });
  }

  function warmEnglish(q, here) {
    var L = global.ordparLookup;
    if (!L || !L.englishLookup || !q) { return Promise.resolve(); }
    return Promise.resolve(L.englishLookup(q)).then(function (res) {
      if (res && res.count === 1 && res.matches && res.matches[0]) { return warmArticle(res.matches[0].id, here); }
    }).catch(function () {  });
  }

  var gotAsset = Object.create(null);
  function asset(url) {
    if (!gotAsset[url]) {
      gotAsset[url] = get(url).then(function (t) { if (t == null) { delete gotAsset[url]; } return t; });
    }
    return gotAsset[url];
  }

  function warmPage(page) {
    if (warmed[page]) { return warmed[page]; }
    var p = get(page).then(function (html) {
      if (!html) { delete warmed[page]; return; }
      return Promise.all(assetsOf(html).map(asset));
    });
    warmed[page] = p;
    return p;
  }

  function searchOf(path) {
    var cut = path.indexOf('#');
    var page = cut < 0 ? path : path.slice(0, cut), hash = cut < 0 ? '' : path.slice(cut);
    var m = /(?:^#|&)q=([^&#]*)/.exec(hash), en = false;
    if (!m) { m = /(?:^#|&)en=([^&#]*)/.exec(hash); en = !!m; }
    var raw = m ? m[1] : null, hashed = !!m;
    if (raw == null) {
      var w = WORD.exec(page);
      if (!w || /^\d+$/.test(w[1])) { return null; }
      raw = w[1];
    }
    var q = '';
    try { q = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (e) { q = ''; }
    q = q.trim();
    return q ? { q: q, en: en, hashed: hashed } : null;
  }

  function warm(path) {
    var cut = path.indexOf('#');
    var page = cut < 0 ? path : path.slice(0, cut);
    var s = searchOf(path);
    var loc = global.location;
    var self = !!(loc && page === loc.pathname + loc.search);
    var inPlace = !!(s && s.hashed && answersInPlace());
    var jobs = [];
    if (!self && !inPlace) { jobs.push(warmPage(page)); }
    if (s) { jobs.push(s.en ? warmEnglish(s.q, self || inPlace) : warmSearch(s.q, self || inPlace)); }
    return Promise.all(jobs);
  }

  function local(href) {
    try {
      var u = new global.URL(href, global.location.href);
      return u.origin === origin() ? u.pathname + u.search + u.hash : null;
    } catch (e) { return null; }
  }

  function warmQuery(q, en) {
    q = String(q == null ? '' : q).trim();
    if (!q) { return Promise.resolve(null); }
    var L = global.ordparLookup;
    if (en) {
      var enPath = '/bm-en/#en=' + encodeURIComponent(q);
      return warm((L && L.englishUrl && local(L.englishUrl(q))) || enPath);
    }
    var plain = '/bm-en/#q=' + encodeURIComponent(q);
    if (answersInPlace() || !L || !L.searchAddress) { return warm(plain); }
    return Promise.resolve(L.searchAddress(q)).then(function (href) { return warm(local(href) || plain); },
      function () { return warm(plain); });
  }


  var PAGE = /^\/(?:|bm-en\/[^\/#?]+\/(?:#(?:[a-z]+=[a-z0-9-]*&)*q=[^#]+)?|bm-en\/#(?:[a-z]+=[a-z0-9-]*&)*q=[^#]+|bm-en\/#en=[^#&]+|(?:history|favourites|settings|about|coming|changes|dictionary-changes|deck-changes|thanks|privacy|help|more|survey)\/)$/;
  var WORD = /^\/bm-en\/([^\/#?]+)\/$/;

  function miniOf(a) {
    var M = global.ordparMinis;
    if (!M || !a.classList.contains('ordbok-xword')) { return null; }
    if (!a.parentNode || !a.parentNode.classList || !a.parentNode.classList.contains('ordbok-xref')) { return null; }
    var sh = global.ordparShell;
    if (sh && sh.getSetting && sh.getSetting('xref') === 'page') { return null; }
    if (M.target) { return M.target(a) || null; }
    return a.closest('.ordbok-xmini') ? null : { depth: 0 };
  }

  function aim(n) {
    if (!n || !n.closest) { return null; }
    var btn = n.closest('.ordpar-row-button');
    if (btn) {
      var row = btn.closest('.ordpar-row');
      var id = row && +row.getAttribute('data-id');
      var S = global.ordparSearch;
      if (!id || !S || !S.fetchArticle) { return null; }
      return { key: 'a' + id, run: function () { return S.fetchArticle(id); } };
    }
    var opt = n.closest('.ordpar-option');
    if (opt) {
      var oq = opt.getAttribute('data-q'), oen = opt.hasAttribute('data-en');
      if (!oq) { return null; }
      return { key: 'opt:' + (oen ? 'en:' : 'nb:') + oq, run: function () { return warmQuery(oq, oen); } };
    }
    var rb = n.closest('[data-ordpar-random]');
    if (rb) {
      var R = global.ordparSearch;
      if (rb.disabled || !R || !R.drawAhead) { return null; }
      var ren = !!(R.randomEnglishOn && R.randomEnglishOn());
      return { key: 'random:' + (rb.ordparDrawGen || 0) + (ren ? ':en' : ''), fresh: true, run: function () {
        return Promise.resolve(R.drawAhead(rb)).then(function (d) {
          if (!d || d.w == null) { return null; }
          return typeof d.w === 'number' ? warm('/bm-en/' + d.w + '/') : warmQuery(d.w, d.en);
        });
      } };
    }
    var a = n.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) { return null; }
    var mt = miniOf(a);
    if (mt) {
      var M = global.ordparMinis;
      if (mt.depth && mt.id && M.load && mode() === 'page') {
        return { key: 'a' + mt.id, run: function () { return M.load(mt.id); } };
      }
      return null;
    }
    var url;
    try { url = new global.URL(a.href, global.location.href); } catch (e) { return null; }
    if (url.origin !== origin()) { return null; }
    var search = !url.search && (url.pathname === '/bm-en/' ? /(?:^#|&)(?:q|en)=/.test(url.hash)
      : WORD.test(url.pathname) && /(?:^#|&)q=/.test(url.hash));
    var path = url.pathname + url.search + (search ? url.hash : '');
    if (!PAGE.test(path)) { return null; }
    var loc = global.location;
    if (loc && path === loc.pathname + loc.search + (search ? loc.hash : '')) { return null; }
    return { key: path, run: function () { return warm(path); } };
  }

  var done = Object.create(null);
  function go(t) {
    if (done[t.key]) { return; }
    done[t.key] = 1;
    Promise.resolve(t.run()).then(function (got) { if (got === null) { delete done[t.key]; } },
      function () { delete done[t.key]; });
  }

  var restKey = null, restNode = null, restTimer = null;
  function unrest() {
    if (restTimer) { clearTimeout(restTimer); }
    restKey = restNode = restTimer = null;
  }

  var selTimer = null;
  function select(node) {
    if (selTimer) { clearTimeout(selTimer); selTimer = null; }
    if (!node || mode() === 'click') { return; }
    var t = aim(node);
    if (!t || done[t.key]) { return; }
    selTimer = setTimeout(function () { selTimer = null; go(t); }, REST_MS);
  }

  var CONTROL = '.ordpar-row-button, .ordpar-option, [data-ordpar-random], a[href]';

  if (doc && doc.addEventListener) {
    var lastNode = null, lastAim = null;
    doc.addEventListener('mousemove', function (e) {
      if (mode() === 'click') { return; }
      if (e.target !== lastNode || (lastAim && lastAim.fresh)) { lastNode = e.target; lastAim = aim(e.target); }
      var t = lastAim;
      if (!t) { if (restKey) { unrest(); } return; }
      if (done[t.key]) { return; }
      if (restTimer) { clearTimeout(restTimer); }
      restKey = t.key;
      restNode = e.target.closest(CONTROL);
      restTimer = setTimeout(function () { restTimer = null; restKey = null; go(t); }, REST_MS);
    });
    doc.addEventListener('mouseout', function (e) {
      if (restNode && !(e.relatedTarget && restNode.contains(e.relatedTarget))) { unrest(); }
    });
    doc.addEventListener('touchstart', function (e) {
      if (mode() === 'click') { return; }
      var t = aim(e.target);
      if (t) { go(t); }
    }, { passive: true });
  }

  global.ordparAhead = { mode: mode, queue: queue, warm: warm, aim: aim, select: select, assetsOf: assetsOf,
    REST_MS: REST_MS, FULL_MAX: FULL_MAX };
}(typeof globalThis !== 'undefined' ? globalThis : this));
