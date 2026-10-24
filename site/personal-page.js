(function (global) {
  'use strict';

  var doc = global.document;

  function shell() { return global.ordparShell; }
  function t(key, vars) {
    var s = shell() ? shell().t(key) : key;
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(String(vars[k])); } }
    return s;
  }
  function el(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }
  function base() { return global.ORDPAR_BASE || '/'; }

  var message = '';
  function say(text) {
    message = text;
    var st = doc.querySelector('.ordpar-personal-status');
    if (st) { st.textContent = text; }
  }

  function searchRow(e) {
    var sh = shell();
    var li = el('li', 'ordpar-personal-row ordpar-history-row');
    var a = el('a', 'ordpar-history-link');
    a.href = base() + 'bm-en/#q=' + encodeURIComponent(e.q);
    if (e.n === 1 && e.translated) { a.classList.add('is-translated'); }
    a.appendChild(sh.searchRowMain(e));
    var side = a.appendChild(sh.searchRowSide(e));
    li.appendChild(a);
    if (side.querySelector('.is-pending, .is-check')) { held.push({ li: li, side: side, e: e }); }
    return li;
  }

  var held = [];
  var watch = null;
  function fillHeld() {
    var sh = shell(), rows = held;
    held = [];
    if (watch) { watch.disconnect(); watch = null; }
    if (!rows.length || !sh || !sh.fillSearchRow) { return; }
    if (!global.IntersectionObserver) {
      rows.forEach(function (r) { sh.fillSearchRow(r.side, r.e); });
      return;
    }
    watch = new global.IntersectionObserver(function (seen, obs) {
      seen.forEach(function (s) {
        if (!s.isIntersecting) { return; }
        obs.unobserve(s.target);
        var r = rows[Number(s.target.getAttribute('data-held'))];
        if (r) { sh.fillSearchRow(r.side, r.e); }
      });
    }, { rootMargin: '400px 0px' });
    rows.forEach(function (r, i) { r.li.setAttribute('data-held', String(i)); watch.observe(r.li); });
  }

  var favRows = Object.create(null);

  function markGloss(snip, e) {
    var L = global.ordparLookup;
    if (!L || !L.loadSnippets || !L.isGloss || !L.writeGloss) { return; }
    var word = String(e.word || '').split(' / ')[0];
    if (!word) { return; }
    var got;
    try { got = L.loadSnippets(L.snipKey(L.fold(word))); } catch (err) { return; }
    Promise.resolve(got).then(function (snips) {
      var id = String(e.id);
      if (snips && snips[id] === e.snip && L.isGloss(snips, id)) { L.writeGloss(snip, e.snip, true); }
    }).catch(function () {});
  }

  function favRow(e, P) {
    if (favRows[e.id]) { return favRows[e.id]; }
    var wrap = global.ordparSearch.listRows([e], Object.create(null),
      { level: 2, mark: false, renumber: true });
    var row = wrap.firstChild;
    row.classList.add('ordpar-fav-row');
    var snip = row.querySelector('.ordpar-row-snippet');
    if (snip && e.snip) {
      snip.textContent = e.snip;
      snip.classList.remove('is-pending');
      if (e.translated) { markGloss(snip, e); }
    } else if (snip) {
      snip.parentNode.removeChild(snip);
    }
    var rm = el('button', 'ordpar-result-btn ordpar-fav-remove', t('favourites.remove'));
    rm.type = 'button';
    var L = global.ordparLookup;
    var said = L && L.headParts
      ? L.headParts(e.word).parts.map(function (p) { return p.w; }).join(', ') : e.word;
    rm.setAttribute('aria-label', t('favourites.removeLabel', { word: said }));
    rm.addEventListener('click', function () {
      var next = row.nextElementSibling || row.previousElementSibling;
      var nextId = next ? next.getAttribute('data-id') : null;
      P.setFavourite(e, false);
      var target = nextId && doc.querySelector('.ordpar-fav-row[data-id="' + nextId + '"] .ordpar-fav-remove');
      var h = doc.querySelector('.ordpar-personal h1');
      if (target) { target.focus(); } else if (h) { h.focus(); }
    });
    row.insertBefore(rm, row.querySelector('.ordpar-row-panel'));
    favRows[e.id] = row;
    return row;
  }

  function syncFavs(box, list, P) {
    var want = list.map(function (e) { return favRow(e, P); });
    var active = doc.activeElement, lost = -1;
    Array.prototype.slice.call(box.children).forEach(function (r, i) {
      if (want.indexOf(r) !== -1) { return; }
      if (active && r.contains(active)) { lost = i; }
      box.removeChild(r);
      delete favRows[r.getAttribute('data-id')];
    });
    want.forEach(function (r, i) {
      if (box.children[i] !== r) { box.insertBefore(r, box.children[i] || null); }
    });
    if (lost !== -1) {
      var to = box.children[Math.min(lost, box.children.length - 1)];
      var target = to ? to.querySelector('.ordpar-row-button') : doc.querySelector('.ordpar-personal h1');
      if (target) { target.focus(); }
    }
  }

  var favPage = null;
  function renderFavourites(main, fresh) {
    var P = global.ordparPersonal;
    var list = P ? P.favourites() : [];
    if (favPage && !fresh && main.contains(favPage.wrap)) {
      favPage.empty.hidden = list.length > 0;
      syncFavs(favPage.box, list, P);
      return;
    }
    favRows = Object.create(null);
    main.textContent = '';
    var wrap = el('div', 'ordpar-personal');
    var h1 = el('h1', null, t('favourites.title'));
    h1.tabIndex = -1;
    wrap.appendChild(h1);
    var nav = el('p', 'ordpar-personal-nav');
    var link = el('a', null, t('favourites.toHistory'));
    link.href = base() + 'history/';
    nav.appendChild(link);
    wrap.appendChild(nav);
    wrap.appendChild(el('p', 'ordpar-note', t('personal.device')));
    var empty = wrap.appendChild(el('p', 'ordpar-empty ordpar-personal-empty', t('favourites.empty')));
    empty.hidden = list.length > 0;
    var box = wrap.appendChild(el('div', 'ordpar-rows ordpar-fav-rows'));
    syncFavs(box, list, P);
    var tp = el('p', 'ordpar-transfer ordpar-transfer-link');
    var ta = el('a', null, t('transfer.link'));
    ta.href = base() + 'settings/#data';
    tp.appendChild(ta);
    wrap.appendChild(tp);
    var st = el('p', 'ordpar-personal-status');
    st.setAttribute('role', 'status');
    st.textContent = message;
    wrap.appendChild(st);
    main.appendChild(wrap);
    favPage = { wrap: wrap, box: box, empty: empty };
  }

  function render(main, kind, fresh) {
    if (kind === 'favourites') { renderFavourites(main, fresh); return; }
    var P = global.ordparPersonal;
    main.textContent = '';
    var wrap = el('div', 'ordpar-personal');
    var h1 = el('h1', null, t(kind + '.title'));
    h1.tabIndex = -1;
    wrap.appendChild(h1);
    var nav = el('p', 'ordpar-personal-nav');
    var link = el('a', null, t('history.toFavourites'));
    link.href = base() + 'favourites/';
    nav.appendChild(link);
    wrap.appendChild(nav);
    wrap.appendChild(el('p', 'ordpar-note', t('personal.device')));

    var list = P ? P.history() : [];
    if (!list.length) {
      wrap.appendChild(el('p', 'ordpar-empty ordpar-personal-empty', t('history.empty')));
    }
    var ul = el('ul', 'ordpar-personal-list');
    held = [];
    list.forEach(function (e) { ul.appendChild(searchRow(e)); });
    wrap.appendChild(ul);

    var st = el('p', 'ordpar-personal-status');
    st.setAttribute('role', 'status');
    st.textContent = message;

    if (list.length) {
      var actions = el('div', 'ordpar-personal-actions');
      var clear = el('button', 'ordpar-button is-quiet ordpar-history-clear', t('history.clear'));
      clear.type = 'button';
      clear.addEventListener('click', function () { confirmClear(actions, clear, list.length); });
      actions.appendChild(clear);
      wrap.appendChild(actions);
    }
    wrap.appendChild(st);
    main.appendChild(wrap);
    fillHeld();
  }

  function confirmClear(actions, clear, n) {
    if (actions.querySelector('.ordpar-confirm')) { return; }
    clear.hidden = true;
    var box = el('div', 'ordpar-confirm');
    box.setAttribute('role', 'group');
    var q = el('span', 'ordpar-confirm-text', t('history.confirm', { n: n }));
    q.id = 'ordpar-confirm-text';
    box.setAttribute('aria-labelledby', q.id);
    box.appendChild(q);
    var yes = el('button', 'ordpar-button ordpar-confirm-yes', t('history.confirmYes'));
    yes.type = 'button';
    var no = el('button', 'ordpar-button is-quiet ordpar-confirm-no', t('history.cancel'));
    no.type = 'button';
    yes.addEventListener('click', function () {
      say(t('history.cleared'));
      global.ordparPersonal.clearHistory();
      var h = doc.querySelector('.ordpar-personal h1');
      if (h) { h.focus(); }
    });
    no.addEventListener('click', function () {
      actions.removeChild(box);
      clear.hidden = false;
      clear.focus();
    });
    box.appendChild(yes);
    box.appendChild(no);
    actions.appendChild(box);
    no.focus();
  }

  function start() {
    var main = doc.querySelector('[data-ordpar-personal]');
    if (!main) { return; }
    var kind = main.getAttribute('data-ordpar-personal') === 'history' ? 'history' : 'favourites';
    var draw = function (fresh) {
      doc.title = t(kind + '.title') + ' — ' + t('site.name');
      render(main, kind, fresh);
    };
    draw(true);
    if (global.ordparPersonal) { global.ordparPersonal.onChange(function () { draw(false); }); }
    if (shell() && shell().onChange) {
      shell().onChange(function (key) { if (key === 'render' || key === 'lang') { draw(key === 'lang'); } });
    }
  }

  function whenReady() { ((shell() && shell().ready) || Promise.resolve()).then(start); }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', whenReady); }
  else { whenReady(); }
}(typeof globalThis !== 'undefined' ? globalThis : this));
