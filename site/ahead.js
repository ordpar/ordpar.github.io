(function (global) {
  'use strict';

  var doc = global.document;
  var REST_MS = 150;
  var FULL_MAX = 3;
  var VALUES = ['point', 'click', 'page'];


  function stored() {
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

  function warmSearch(q) {
    var L = global.ordparLookup;
    if (!L || !L.lookup || !q) { return Promise.resolve(); }
    return Promise.resolve(L.lookup(q)).then(function (res) {
      if (!res) { return; }
      var ids = [];
      (res.heads || []).forEach(function (g) { g.articles.forEach(function (a) { ids.push(a.id); }); });
      var sh = global.ordparShell;
      var lv = sh && sh.getSetting ? sh.getSetting('listview') : 'multi';
      var full = lv === 'off' || (lv !== 'on' && ids.length === 1);
      if (!full) { return; }
      return Promise.all(ids.slice(0, FULL_MAX).map(function (id) { return warm('/bm-en/' + id + '/'); }));
    }).catch(function () {  });
  }

  function warmPage(page) {
    if (warmed[page]) { return warmed[page]; }
    var p = get(page).then(function (html) {
      if (!html) { delete warmed[page]; return; }
      return Promise.all(assetsOf(html).map(get));
    });
    warmed[page] = p;
    return p;
  }

  function warm(path) {
    var cut = path.indexOf('#');
    var page = cut < 0 ? path : path.slice(0, cut);
    var jobs = [];
    if (!(global.location && page === global.location.pathname + global.location.search)) {
      jobs.push(warmPage(page));
    }
    var m = /#q=([^&#]*)$/.exec(path);
    if (m) {
      var q = '';
      try { q = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { q = ''; }
      jobs.push(warmSearch(q.trim()));
    }
    return Promise.all(jobs);
  }


  var PAGE = /^\/(?:bm-en\/\d+\/|bm-en\/#q=[^#]+|history\/|favourites\/|settings\/)$/;

  function isMini(a) {
    if (!global.ordparMinis || !a.classList.contains('ordbok-xword')) { return false; }
    if (!a.parentNode || !a.parentNode.classList || !a.parentNode.classList.contains('ordbok-xref')) { return false; }
    if (a.closest('.ordbok-xmini')) { return false; }
    var sh = global.ordparShell;
    return !(sh && sh.getSetting && sh.getSetting('xref') === 'page');
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
    var a = n.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || isMini(a)) { return null; }
    var url;
    try { url = new global.URL(a.href, global.location.href); } catch (e) { return null; }
    if (url.origin !== origin()) { return null; }
    var search = url.pathname === '/bm-en/' && !url.search && url.hash.indexOf('#q=') === 0;
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

  if (doc && doc.addEventListener) {
    var lastNode = null, lastAim = null;
    doc.addEventListener('mousemove', function (e) {
      if (mode() === 'click') { return; }
      if (e.target !== lastNode) { lastNode = e.target; lastAim = aim(e.target); }
      var t = lastAim;
      if (!t) { if (restKey) { unrest(); } return; }
      if (done[t.key]) { return; }
      if (restTimer) { clearTimeout(restTimer); }
      restKey = t.key;
      restNode = e.target.closest('.ordpar-row-button, a[href]');
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

  global.ordparAhead = { mode: mode, queue: queue, warm: warm, aim: aim, assetsOf: assetsOf,
    REST_MS: REST_MS, FULL_MAX: FULL_MAX };
}(typeof globalThis !== 'undefined' ? globalThis : this));
