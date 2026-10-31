(function (global) {
  'use strict';

  var doc = global.document;
  var HREF = /^\/bm-en\/(\d+)\/(?:#(def\d+))?$/;
  var EX_BUDGET = 6;
  var REST_MS = 150;
  var SEE_IN_MINI = false;


  function setting(key, values, def) {
    var v = null;
    if (typeof global.ordparRead === 'function') { v = global.ordparRead(key); }
    else { try { v = global.localStorage.getItem(key); } catch (e) {  } }
    return values.indexOf(v) !== -1 ? v : def;
  }
  function navigates() { return setting('xref', ['mini', 'page'], 'mini') === 'page'; }
  function fetchMode() {
    if (global.ordparAhead && global.ordparAhead.mode) { return global.ordparAhead.mode(); }
    var m = setting('minifetch', ['point', 'click', 'page'], 'point');
    var c = global.navigator && global.navigator.connection;
    return m === 'page' && c && c.saveData ? 'click' : m;
  }
  function slim() { return setting('minicontent', ['full', 'slim'], 'full') === 'slim'; }
  function nestMode() { return setting('nestminis', ['second', 'inplace', 'stacked', 'off'], 'second'); }
  function inPlaceAt(mode) { return mode === 'inplace' ? 1 : mode === 'second' ? 2 : 0; }


  function kid(n, c) {
    for (var k = n.firstChild; k; k = k.nextSibling) {
      if (k.classList && k.classList.contains(c)) { return k; }
    }
    return null;
  }

  function depthOf(n) {
    var d = 0;
    for (var p = n && n.parentNode; p && p.classList; p = p.parentNode) {
      if (p.classList.contains('ordbok-xmini')) { d++; }
    }
    return d;
  }

  function target(a) {
    if (!a || !a.classList || !a.classList.contains('ordbok-xword') || !a.closest) { return null; }
    var x = a.parentNode;
    if (!x || !x.classList || !x.classList.contains('ordbok-xref')) { return null; }
    var m = HREF.exec(a.getAttribute('href') || '');
    if (!m) { return null; }
    var d = a.closest('.ordbok-xmini') ? depthOf(a) : 0;
    if (d) {
      if (nestMode() === 'off') { return null; }
      if (d > chain.length) { return null; }
      if (global.ordparDeck && !doc.getElementById('ordpar-t-' + m[1])) { return null; }
    }
    return { id: +m[1], def: m[2] || null, href: m[0], depth: d };
  }

  function linkOf(n) { return n && n.closest ? n.closest('a.ordbok-xword') : null; }


  var pages = Object.create(null);

  function fragmentOf(text) {
    var s = text.indexOf('<div class="ordbok'), e = text.indexOf('<footer class="ordpar-card-foot">', s);
    return s < 0 || e < 0 ? null : text.slice(s, e);
  }

  function fetchFragment(id) {
    var S = global.ordparSearch;
    if (S && S.fetchArticle) {
      return S.fetchArticle(id).then(function (got) { return got ? got.fragment : null; });
    }
    if (!global.fetch) { return Promise.resolve(null); }
    return global.fetch('/bm-en/' + id + '/', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) { return text ? fragmentOf(text) : null; });
  }

  function parse(html) {
    if (!html || !global.DOMParser) { return null; }
    return new global.DOMParser().parseFromString(html, 'text/html').querySelector('.ordpar-article');
  }

  function load(id) {
    if (pages[id]) { return pages[id]; }
    var p = fetchFragment(id).then(parse).catch(function () { return null; })
      .then(function (art) {
        if (!art) { delete pages[id]; }
        return art;
      });
    pages[id] = p;
    return p;
  }


  function el(tag, cls) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    return n;
  }
  function has(n, c) { return !!(n && n.classList && n.classList.contains(c)); }
  function kids(n) {
    var out = [];
    for (var k = n.firstElementChild; k; k = k.nextElementSibling) { out.push(k); }
    return out;
  }
  function isComp(n) { return has(n, 'ordpar-comp') || (has(n, 'ordbok-sub') && !n.id); }
  function isDefLine(n) { return has(n, 'ordpar-pair') || (has(n, 'ordbok-def') && n.tagName === 'SPAN'); }

  function sensesOf(art) {
    var secs = kids(art);
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].tagName !== 'SECTION') { continue; }
      var ks = kids(secs[i]);
      for (var j = 0; j < ks.length; j++) {
        if ((ks[j].tagName === 'OL' && has(ks[j], 'ordbok-senses'))
            || (ks[j].tagName === 'DIV' && /^def\d/.test(ks[j].id))) { return ks[j]; }
      }
    }
    return null;
  }

  function subsOf(sense) {
    var out = [];
    kids(sense).forEach(function (k) {
      if (has(k, 'ordbok-sub') && !isComp(k)) { out.push(k); }
      if (k.tagName === 'OL' && has(k, 'ordbok-subsenses')) { out = out.concat(kids(k)); }
    });
    return out;
  }
  function ownDef(unit) { return kids(unit).some(isDefLine); }
  function examples(unit) {
    var out = [];
    kids(unit).forEach(function (k) {
      if (k.tagName === 'UL' && has(k, 'ordbok-ex-list')) { out = out.concat(kids(k)); }
    });
    return out;
  }

  function allocate(avail) {
    var counts = avail.map(function (n) { return n ? 1 : 0; });
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    for (var rank = 1; total < EX_BUDGET; rank++) {
      var granted = false;
      for (var i = 0; i < avail.length && total < EX_BUDGET; i++) {
        if (avail[i] > rank && counts[i] === rank) { counts[i]++; total++; granted = true; }
      }
      if (!granted) { break; }
    }
    return counts;
  }

  function flush(unit) {
    var d = el('div', 'ordpar-msense');
    for (var k = unit.firstChild; k; k = k.nextSibling) { d.appendChild(k.cloneNode(true)); }
    return d;
  }

  function trim(unit, n) {
    var exs = examples(unit);
    for (var i = n; i < exs.length; i++) { exs[i].parentNode.removeChild(exs[i]); }
    kids(unit).forEach(function (k) {
      if (k.tagName === 'UL' && has(k, 'ordbok-ex-list') && !k.firstElementChild) { unit.removeChild(k); }
    });
  }

  function finish(root) {
    if (!SEE_IN_MINI) {
      Array.prototype.forEach.call(root.querySelectorAll('.ordpar-see'), function (n) { n.parentNode.removeChild(n); });
    }
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    all.forEach(function (n) {
      if (n.removeAttribute) { n.removeAttribute('id'); }
      if (has(n, 'ordpar-pair')) { n.classList.remove('ordpar-pair', 'ordpar-open'); n.classList.add('mini-pair'); }
      if (has(n, 'ordpar-open')) { n.classList.remove('ordpar-open'); }
    });
    Array.prototype.forEach.call(root.querySelectorAll('.ordpar-encue'), function (b) { b.parentNode.removeChild(b); });
    return root;
  }

  function senseless(art, body) {
    kids(art).forEach(function (sec) {
      if (sec.tagName !== 'SECTION') { return; }
      if (has(sec, 'ordbok-inline') && !has(sec, 'ordpar-pron') && !sec.querySelector('.ordbok-nodef')) {
        kids(sec).forEach(function (k) { if (k.tagName !== 'H3') { body.appendChild(k.cloneNode(true)); } });
      }
    });
    Array.prototype.forEach.call(art.querySelectorAll('.ordbok-expr'), function (x) {
      var c = x.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('ul.ordbok-ex-list'), function (ul) {
        while (ul.children.length > 1) { ul.removeChild(ul.lastElementChild); }
      });
      body.appendChild(c);
    });
    if (!body.firstChild) {
      var nd = art.querySelector('.ordbok-nodef');
      if (nd) { body.appendChild(nd.cloneNode(true)); }
    }
    return body;
  }

  function cut(art, def, isSlim) {
    var body = el('div', 'ordpar-mbody');
    var top = sensesOf(art);
    if (!top) { return finish(senseless(art, body)); }
    var hit = def ? top.querySelector('#' + def) : null;
    if (!hit && def && top.id === def) { hit = top; }
    var root, senses, whole = !hit;
    if (hit) {
      var sense = top;
      if (top.tagName === 'OL') {
        sense = hit;
        while (sense.parentNode !== top) { sense = sense.parentNode; }
      }
      if (sense !== hit && !ownDef(sense) && subsOf(sense).length === 1) { sense = hit; }
      root = flush(sense);
      senses = [root];
    } else if (top.tagName === 'OL') {
      root = top.cloneNode(true);
      senses = kids(root);
    } else {
      root = flush(top);
      senses = [root];
    }
    var units = [];
    senses.forEach(function (s) {
      if (isSlim && whole && senses.length > 1 && ownDef(s)) {
        kids(s).forEach(function (k) {
          if ((has(k, 'ordbok-sub') && !isComp(k)) || has(k, 'ordbok-subsenses')) { s.removeChild(k); }
        });
      }
      units.push(s);
      units = units.concat(subsOf(s));
    });
    if (isSlim) {
      units.forEach(function (u) {
        if (examples(u).length) { kids(u).forEach(function (k) { if (isComp(k)) { u.removeChild(k); } }); }
      });
    }
    var counts = allocate(units.map(function (u) { return examples(u).length; }));
    units.forEach(function (u, i) { trim(u, counts[i]); });
    body.appendChild(root);
    return finish(body);
  }

  function norwegian(a) {
    var e = a.firstElementChild;
    return !!(e && e.tagName === 'EM' && !e.nextElementSibling &&
              e.textContent.trim() === a.textContent.trim());
  }

  function header(a, href) {
    var peek = kid(a.parentNode, 'ordbok-xpeek');
    if (peek && peek.classList.contains('ordpar-nbdef')) { peek = null; }
    var word = a.textContent.replace(/\s+/g, ' ').trim();
    var gloss = peek ? peek.textContent.replace(/\s+/g, ' ').trim() : '';
    var nb = norwegian(a);
    if (gloss && !nb) { var w = word; word = gloss; gloss = w; nb = true; }
    var head = el('div', 'mini-head'), hw = el('span', 'mini-hw'), link = el('a');
    hw.lang = nb ? 'nb' : 'en';
    link.href = href;
    link.textContent = word;
    hw.appendChild(link);
    head.appendChild(hw);
    if (gloss && gloss.indexOf(' \u00b7 ') < 0) {
      var one = head.appendChild(el('span', 'mini-gloss'));
      one.lang = 'en';
      one.textContent = ' \u2014 ' + gloss;
    } else if (gloss) {
      var g = head.appendChild(el('span', 'mini-gloss'));
      g.lang = 'en';
      gloss.split(' \u00b7 ').forEach(function (part, i) {
        if (i) { g.appendChild(el('span', 'ordpar-gsep')).textContent = ' \u00b7 '; }
        g.appendChild(doc.createTextNode((i ? '' : ' \u2014 ') + part));
      });
    }
    return head;
  }


  var openX = null;

  function place(m) {
    if (typeof global.ordparPlace === 'function') {
      try { global.ordparPlace(m); } catch (e) {  }
    }
  }


  var FINE = '(hover:hover) and (pointer:fine)';

  function fine() {
    try { return !!(global.matchMedia && global.matchMedia(FINE).matches); } catch (e) { return false; }
  }

  function narrowest(lo, hi, heightAt) {
    if (!(hi > lo)) { return hi; }
    var h = heightAt(hi);
    if (heightAt(lo) <= h + 1) { return lo; }
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (heightAt(mid) <= h + 1) { hi = mid; } else { lo = mid; }
    }
    return hi;
  }

  function fit(m) {
    var box = m ? kid(m, 'ordpar-fmini') : null;
    if (!box) { return; }
    box.style.width = '';
    if (!fine() || box.getAttribute('aria-busy') === 'true') { return; }
    box.style.width = '100000px';
    var hi = Math.floor(box.getBoundingClientRect().width);
    box.style.width = '0px';
    var lo = Math.ceil(box.getBoundingClientRect().width);
    if (!hi) { box.style.width = ''; return; }
    box.style.width = narrowest(Math.min(lo, hi), hi, function (w) {
      box.style.width = w + 'px';
      return box.scrollHeight;
    }) + 'px';
  }

  function refit() {
    if (!openX) { return; }
    var m = kid(openX, 'ordbok-xmini');
    if (m) { fit(m); place(m); }
    for (var i = 1; i < chain.length; i++) { fit(chain[i].m); placeNested(chain[i]); }
  }

  var chain = [];

  function boxOf(n) {
    var m = n && n.closest ? n.closest('.ordbok-xmini') : null;
    for (var i = 0; i < chain.length; i++) { if (chain[i].m === m) { return chain[i]; } }
    return null;
  }

  var held = 0;
  function bottom() { return Math.ceil((global.pageYOffset || 0) + (global.innerHeight || 0)); }
  function hold() {
    var e = doc.documentElement;
    if (!e || !e.style) { return; }
    held = bottom();
    e.style.minHeight = held + 'px';
  }
  function unhold() {
    if (!held) { return; }
    var b = bottom();
    if (b < held) { held = b; doc.documentElement.style.minHeight = b + 'px'; }
  }

  function closeFrom(i) {
    if (chain.length > i) { hold(); }
    while (chain.length > i) {
      var c = chain.pop();
      c.tok++;
      c.x.classList.remove('ordpar-mopen');
      c.a.setAttribute('aria-expanded', 'false');
      c.steps.forEach(function (s) { if (s.from) { s.from.setAttribute('aria-expanded', 'false'); } });
      c.steps = [];
      if (c.m.parentNode) { c.m.parentNode.removeChild(c.m); }
      var back = kid(c.x, 'ordbok-xback');
      if (back) { c.x.removeChild(back); }
    }
    if (!chain.length) { openX = null; }
  }
  function close() { closeFrom(0); }

  function put(c) {
    if (chain[0] === c) { place(c.m); } else { placeNested(c); }
  }

  function placeNested(c) {
    var m = c.m, rs = c.a.getClientRects(), r = rs.length ? rs[0] : c.a.getBoundingClientRect();
    var em = parseFloat(global.getComputedStyle(c.x).fontSize) || 16;
    var top = c.x.getBoundingClientRect().top + 1.7 * em;
    var W = doc.documentElement.clientWidth, G = 8;
    m.style.top = Math.round(top) + 'px';
    m.style.left = Math.round(r.left) + 'px';
    var w = m.getBoundingClientRect().width, left = Math.min(r.left, W - G - w);
    if (left < G) { left = G; }
    m.style.left = Math.round(left) + 'px';
    var host = c.x.closest('.ordpar-fmini'), hr = host ? host.getBoundingClientRect() : null;
    m.style.visibility = hr && (r.bottom < hr.top || r.top > hr.bottom) ? 'hidden' : '';
    var box = kid(m, 'ordpar-fmini'), avail = Math.max(160, global.innerHeight - Math.round(top) - G);
    if (box) { box.style.maxHeight = fine() ? 'min(70vh, 30rem, ' + avail + 'px)' : avail + 'px'; }
  }

  function fill(m, box, art, t) {
    m.setAttribute('lang', art.getAttribute('lang') || 'en');
    box.appendChild(cut(art, t.def, slim()));
    if (typeof global.ordparExHeads === 'function') {
      try { global.ordparExHeads(box); } catch (e) {  }
    }
    if (typeof global.ordparExCues === 'function') {
      try { global.ordparExCues(box); } catch (e) {  }
    }
    box.removeAttribute('aria-busy');
    fit(m);
  }

  function focusOn(n) {
    if (!n || !n.focus) { return; }
    try { n.focus({ preventScroll: true }); } catch (e) {  }
  }

  function open(a, t, keyboard) {
    var d = t.depth || 0, from = inPlaceAt(nestMode());
    if (d && from && d >= from && chain[d - 1]) { step(chain[d - 1], a, t); return; }
    closeFrom(d);
    var x = a.parentNode;
    var m = el('span', 'ordbok-xmini');
    m.style.overflowAnchor = 'none';
    if (d) { m.classList.add('ordpar-mnest'); }
    var box = el('div', 'mini ordpar-fmini');
    box.setAttribute('aria-busy', 'true');
    box.appendChild(header(a, t.href));
    m.appendChild(box);
    if (!d) {
      var back = el('span', 'ordbok-xback');
      back.setAttribute('aria-hidden', 'true');
      x.appendChild(back);
    }
    if (d) { chain[d - 1].m.appendChild(m); } else { x.appendChild(m); }
    x.classList.add('ordpar-mopen');
    a.setAttribute('aria-expanded', 'true');
    var c = { x: x, a: a, m: m, steps: [], tok: 0 };
    chain.push(c);
    if (!d) { openX = x; }
    put(c);
    if (d && keyboard) { focusOn(box.querySelector('.mini-hw a')); }
    load(t.id).then(function (art) {
      if (chain.indexOf(c) < 0 || !m.parentNode) { return; }
      if (!art) { closeFrom(d); global.location.href = t.href; return; }
      fill(m, box, art, t);
      put(c);
    });
  }


  function backLine(hw) {
    var word = hw ? hw.textContent.replace(/\s+/g, ' ').trim() : '';
    var b = doc.createElement('button');
    b.className = 'ordpar-mback';
    b.type = 'button';
    b.setAttribute('aria-label', 'Back to ' + word);
    var arrow = b.appendChild(el('span', 'ordpar-mback-arrow'));
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '← ';
    var w = b.appendChild(el('span', 'mini-hw'));
    w.lang = hw && hw.lang ? hw.lang : 'nb';
    w.textContent = word;
    return b;
  }
  function step(c, a, t) {
    closeFrom(chain.indexOf(c) + 1);
    var box = kid(c.m, 'ordpar-fmini');
    var hw = box.querySelector('.mini-head .mini-hw'), head = header(a, t.href);
    var nodes = doc.createDocumentFragment();
    a.setAttribute('aria-expanded', 'true');
    c.steps.push({ nodes: nodes, lang: c.m.getAttribute('lang'), from: a, scroll: box.scrollTop });
    var b = backLine(hw);
    hold();
    while (box.firstChild) { nodes.appendChild(box.firstChild); }
    box.appendChild(b);
    box.appendChild(head);
    box.setAttribute('aria-busy', 'true');
    box.scrollTop = 0;
    fit(c.m); put(c);
    focusOn(b);
    var tok = ++c.tok;
    load(t.id).then(function (art) {
      if (tok !== c.tok || chain.indexOf(c) < 0) { return; }
      if (!art) { stepBack(c, false); global.location.href = t.href; return; }
      fill(c.m, box, art, t);
      put(c);
    });
  }
  function stepBack(c, focus) {
    var s = c && c.steps.pop();
    if (!s) { return; }
    c.tok++;
    closeFrom(chain.indexOf(c) + 1);
    var box = kid(c.m, 'ordpar-fmini');
    hold();
    while (box.firstChild) { box.removeChild(box.firstChild); }
    box.appendChild(s.nodes);
    box.removeAttribute('aria-busy');
    if (s.lang) { c.m.setAttribute('lang', s.lang); }
    if (s.from) { s.from.setAttribute('aria-expanded', 'false'); }
    fit(c.m); put(c);
    box.scrollTop = s.scroll;
    if (focus) { focusOn(s.from); }
  }

  function insideClick(n) {
    if (chain.length < 2) { return; }
    var m = n.closest('.ordbok-xmini');
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].m === m) { if (chain.length > i + 1) { closeFrom(i + 1); } return; }
    }
  }


  var peekX = null;

  function peekFix(x) {
    var p = x ? peekOf(x) : null;
    if (!p) { return; }
    peekX = x;
    p.classList.add('ordpar-pfix');
    p.classList.remove('ordpar-pbelow');
    p.style.removeProperty('--ordpar-peek-dx');
    p.style.left = '0px';
    p.style.top = '0px';
    var pr = p.getBoundingClientRect();
    if (!pr.width) { return; }
    var rs = x.getClientRects(), r = rs.length ? rs[0] : x.getBoundingClientRect();
    var em = parseFloat(global.getComputedStyle(p).fontSize) || 13;
    var W = doc.documentElement.clientWidth, H = doc.documentElement.clientHeight, G = 8;
    var gap = Math.max(0, 1.6 * em - r.height);
    var top = r.top - gap - pr.height;
    if (top < G && r.bottom + gap + pr.height <= H - G) {
      top = r.bottom + gap;
      p.classList.add('ordpar-pbelow');
    }
    var left = Math.min(r.left, W - G - pr.width);
    if (left < G) { left = G; }
    p.style.left = Math.round(left) + 'px';
    p.style.top = Math.round(top) + 'px';
    var dx = Math.round(r.left - left);
    if (dx) { p.style.setProperty('--ordpar-peek-dx', dx + 'px'); }
  }


  var restA = null, restTimer = null;
  function unrest() {
    if (restTimer) { clearTimeout(restTimer); }
    restA = restTimer = null;
  }
  function rest(a, t) {
    if (restTimer) { clearTimeout(restTimer); }
    restA = a;
    restTimer = setTimeout(function () { restTimer = null; load(t.id); }, REST_MS);
  }

  var queue = [], pumping = false;
  function idle(f) {
    if (global.requestIdleCallback) { global.requestIdleCallback(f, { timeout: 3000 }); } else { setTimeout(f, 200); }
  }
  function pump() {
    if (pumping) { return; }
    var id = queue.shift();
    if (id == null) { return; }
    pumping = true;
    idle(function () {
      load(id).then(function () { pumping = false; pump(); });
    });
  }


  function hovNb() { return !!(doc && doc.documentElement.classList.contains('ordpar-nbo-hovnb')); }
  function peekOf(x) {
    if (hovNb()) {
      for (var k = x.firstChild; k; k = k.nextSibling) {
        if (k.classList && k.classList.contains('ordpar-nbpk')) { return k; }
      }
      return null;
    }
    return kid(x, 'ordbok-xpeek');
  }
  function placeNb(x) {
    var p = peekOf(x);
    if (!p || !p.classList.contains('ordpar-nbpk')) { return; }
    if (x.closest('.ordbok-xmini')) { peekFix(x); return; }
    var place = global.ordparPlace;
    if (!place) { return; }
    p.style.removeProperty('--ordpar-peek-dx');
    place(p);
    var dx = parseFloat(p.style.left) || 0;
    if (dx) { p.style.setProperty('--ordpar-peek-dx', (-dx) + 'px'); }
  }
  function nbText(snips, id) {
    var L = global.ordparLookup;
    return L && L.nbDef ? L.nbDef(snips, id) || '' : '';
  }
  function nbPeek(x) {
    if (!x || !hovNb()) { return; }
    if (x._nbpk) { if (x._nbpk === 2) { placeNb(x); } return; }
    var a = kid(x, 'ordbok-xword'), L = global.ordparLookup;
    var key = a && a.getAttribute('data-s'), m = a && HREF.exec(a.getAttribute('href') || '');
    if (!key || !m || !L || !L.loadSnippets) { return; }
    x._nbpk = 1;
    Promise.resolve(L.loadSnippets(key)).then(function (snips) {
      var text = nbText(snips, m[1]);
      if (!text) { return; }
      var p = el('span', 'ordbok-xpeek ordpar-nbpk ordpar-nbdef');
      p.setAttribute('lang', 'nb');
      p.setAttribute('data-nosnippet', '');
      p.textContent = text;
      x.appendChild(p);
      x._nbpk = 2;
      if (x.matches && x.matches(':hover')) { placeNb(x); }
    }, function () { x._nbpk = 0; });
  }

  function scan() {
    if (!doc || navigates() || fetchMode() !== 'page') { return; }
    var as = doc.querySelectorAll('.ordbok-xref > a.ordbok-xword');
    var shared = global.ordparAhead && global.ordparAhead.queue;
    for (var i = 0; i < as.length; i++) {
      var t = target(as[i]);
      if (!t || pages[t.id]) { continue; }
      if (shared) { shared('a' + t.id, load.bind(null, t.id)); } else if (queue.indexOf(t.id) === -1) { queue.push(t.id); }
    }
    if (!shared) { pump(); }
  }


  if (doc && doc.addEventListener) {
    doc.addEventListener('click', function (e) {
      var n = e.target;
      if (e.defaultPrevented || !n || !n.closest) { return; }
      if (openX && n.closest('.ordbok-xback')) { e.preventDefault(); close(); return; }
      var bl = openX ? n.closest('.ordpar-mback') : null, bc = bl ? boxOf(bl) : null;
      if (bc && bc.steps.length) { e.preventDefault(); stepBack(bc, true); return; }
      var a = linkOf(n), t = target(a);
      if (!t || navigates()) { if (openX) { insideClick(n); } return; }
      if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { return; }
      e.preventDefault();
      for (var i = 0; i < chain.length; i++) {
        if (chain[i].x === a.parentNode) { closeFrom(i); return; }
      }
      open(a, t, e.detail === 0);
    });
    doc.addEventListener('keydown', function (e) {
      if (openX && (e.key === 'Escape' || e.key === 'Esc')) {
        var c = chain[chain.length - 1];
        if (c.steps.length) { stepBack(c, true); return; }
        closeFrom(chain.length - 1);
        focusOn(c.a);
      }
    });
    global.addEventListener('scroll', function () {
      unhold();
      for (var i = 1; i < chain.length; i++) { placeNested(chain[i]); }
      if (peekX && peekX.isConnected && peekX.matches && peekX.matches(':hover')) { peekFix(peekX); }
    }, true);
    global.addEventListener('mouseover', function (e) {
      var n = e.target, x = n && n.closest ? n.closest('.ordbok-xref') : null;
      if (x && x.closest('.ordbok-xmini') && peekOf(x)) { peekFix(x); }
      if (x) { nbPeek(x); }
    });
    doc.addEventListener('focusin', function (e) {
      var n = e.target, x = n && n.closest ? n.closest('.ordbok-xref') : null;
      if (x) { nbPeek(x); }
    });
    doc.addEventListener('mousemove', function (e) {
      if (fetchMode() !== 'point' || navigates()) { return; }
      var a = linkOf(e.target), t = target(a);
      if (!t) { if (restA) { unrest(); } return; }
      if (pages[t.id]) { return; }
      rest(a, t);
    });
    doc.addEventListener('mouseout', function (e) {
      if (restA && !(e.relatedTarget && restA.contains(e.relatedTarget))) { unrest(); }
    });
    doc.addEventListener('touchstart', function (e) {
      if (fetchMode() !== 'point' || navigates()) { return; }
      var t = target(linkOf(e.target));
      if (t) { load(t.id); }
    }, { passive: true });
    if (doc.readyState === 'complete') { scan(); } else { global.addEventListener('load', scan); }
    global.addEventListener('resize', refit);
    if (global.MutationObserver && doc.documentElement) {
      new global.MutationObserver(refit).observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  global.ordparMinis = { scan: scan, cut: cut, allocate: allocate, header: header,
    norwegian: norwegian, close: close, load: load, narrowest: narrowest, fit: fit,
    nestMode: nestMode, inPlaceAt: inPlaceAt, depthOf: depthOf, peekFix: peekFix,
    nbPeek: nbPeek, peekOf: peekOf,
    EX_BUDGET: EX_BUDGET, REST_MS: REST_MS };
}(typeof globalThis !== 'undefined' ? globalThis : this));
