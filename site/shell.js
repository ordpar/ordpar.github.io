(function (global) {
  'use strict';

  var doc = global.document;
  var LANGS = ['en'];
  var SETTINGS = [
    { key: 'theme', values: ['system', 'light', 'dark'], def: 'system', section: 'style' },
    { key: 'colour', values: null, def: null, section: 'style' },
    { key: 'lang', values: LANGS, def: null, section: 'style' },
    { key: 'layout', values: ['ordpar', 'ordbokene'], def: 'ordpar', section: 'style' },
    { key: 'defs', values: ['both', 'en', 'no'], def: 'both', section: 'article', sub: 'language' },
    { key: 'examples', values: ['both', 'no'], def: 'both', section: 'article', sub: 'language' },
    { key: 'exlimit', values: ['all', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], def: 'all', section: 'article', sub: 'language', control: 'select' },
    { key: 'exmore', values: ['on', 'off'], def: 'on', section: 'article', sub: 'language' },
    { key: 'emph', values: ['en', 'no'], def: 'en', section: 'article', sub: 'language' },
    { key: 'subsenses', values: ['defs', 'en'], def: 'defs', section: 'article', sub: 'language' },
    { key: 'formulas', values: ['en', 'no', 'both'], def: 'en', section: 'article', sub: 'language' },
    { key: 'ety', values: ['en', 'no', 'both'], def: 'en', section: 'article', sub: 'language' },
    { key: 'infl', values: ['button', 'open'], def: 'button', section: 'article', sub: 'inflection' },
    { key: 'pframes', values: ['on', 'off'], def: 'on', section: 'article', sub: 'inflection' },
    { key: 'xref', values: ['mini', 'page'], def: 'mini', section: 'article', sub: 'xref' },
    { key: 'peek', values: ['on', 'off'], def: 'on', section: 'article', sub: 'xref' },
    { key: 'mini', values: ['article', 'both', 'en'], def: 'article', section: 'article', sub: 'mini' },
    { key: 'minicontent', values: ['full', 'slim'], def: 'full', section: 'article', sub: 'mini' },
    { key: 'minispacing', values: ['article', 'compact'], def: 'article', section: 'article', sub: 'mini' },
    { key: 'minitext', values: ['article', 'smaller'], def: 'article', section: 'article', sub: 'mini' },
    { key: 'miniscroll', values: ['on', 'off'], def: 'on', section: 'article', sub: 'mini' },
    { key: 'minihw', values: ['link', 'article'], def: 'link', section: 'article', sub: 'mini' },
    { key: 'listview', values: ['multi', 'on', 'off'], def: 'multi', section: 'search' },
    { key: 'suggestrows', values: ['standard', 'roomy'], def: 'standard', section: 'search' },
    { key: 'minifetch', values: ['point', 'click', 'page'], def: 'point', section: 'data', sub: 'loading' },
    { key: 'stats', values: ['on', 'off'], def: 'on', section: 'data', gate: 'privacy' }
  ];
  var SPEC = {};
  SETTINGS.forEach(function (sp) { SPEC[sp.key] = sp; });
  var KEYS = SETTINGS.map(function (sp) { return sp.key; });
  var ARTICLE_KEYS = ['defs', 'mini', 'peek'];
  var CLASS_KEYS = ['pframes', 'minihw', 'minicontent', 'minispacing', 'minitext', 'miniscroll', 'minifetch',
    'formulas', 'ety', 'suggestrows', 'emph', 'subsenses', 'layout', 'examples', 'exlimit', 'exmore'];
  var COLOUR_ID = /^[a-z][a-z0-9-]*$/;
  var strings = {};
  var listeners = [];
  var searchHandler = null;
  var lang = 'en';


  function read(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { global.localStorage.setItem(key, value); } catch (e) {  }
  }
  function drop(key) {
    try { global.localStorage.removeItem(key); } catch (e) {  }
  }

  function browserLang() {
    var nav = global.navigator || {};
    var list = (nav.languages && nav.languages.length ? nav.languages : [nav.language || 'en']);
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().split('-')[0];
      if (LANGS.indexOf(code) !== -1) { return code; }
    }
    return 'en';
  }

  function colours() { return global.ORDPAR_COLOURS || null; }

  function getSetting(key) {
    var v = read(key);
    if (key === 'lang') { return v && LANGS.indexOf(v) !== -1 ? v : browserLang(); }
    if (key === 'colour') {
      var list = colours();
      var ok = v && COLOUR_ID.test(v) && (!list || list.some(function (c) { return c.id === v; }));
      if (ok) { return v; }
      var d = list && list.filter(function (c) { return c.default; })[0];
      return d ? d.id : null;
    }
    var sp = SPEC[key];
    if (!sp) { return v; }
    return sp.values.indexOf(v) !== -1 ? v : sp.def;
  }

  function setSetting(key, value) {
    if (KEYS.indexOf(key) === -1) { return; }
    write(key, value);
    if (key === 'theme') { applyTheme(); }
    if (key === 'colour') { applyColour(); }
    if (ARTICLE_KEYS.indexOf(key) !== -1) { applyDefs(); }
    if (CLASS_KEYS.indexOf(key) !== -1) { applyClassKeys(); }
    if (key === 'lang') { return useLang(value).then(function () { rerender(); notify(key, value); }); }
    rerender();
    notify(key, value);
    return Promise.resolve();
  }

  function resetSettings() {
    KEYS.forEach(drop);
    applyTheme();
    applyColour();
    applyDefs();
    applyClassKeys();
    return useLang(getSetting('lang')).then(function () { rerender(); notify('reset', null); });
  }

  function applyAll() {
    applyTheme();
    applyColour();
    applyDefs();
    applyClassKeys();
    return useLang(getSetting('lang')).then(function () { rerender(); notify('import', null); });
  }

  function deleteStoredData() {
    try { global.localStorage.clear(); } catch (e) {  }
    applyTheme();
    applyColour();
    applyDefs();
    applyClassKeys();
    rerender();
    notify('reset', null);
  }

  function applyClassKeys() {
    var cl = doc.documentElement.classList;
    cl.toggle('ordpar-pframes-off', getSetting('pframes') === 'off');
    cl.toggle('ordpar-minihw-article', getSetting('minihw') === 'article');
    cl.toggle('ordpar-minicontent-slim', getSetting('minicontent') === 'slim');
    cl.toggle('ordpar-minispacing-compact', getSetting('minispacing') === 'compact');
    cl.toggle('ordpar-minitext-smaller', getSetting('minitext') === 'smaller');
    cl.toggle('ordpar-miniscroll-off', getSetting('miniscroll') === 'off');
    var f = getSetting('minifetch');
    cl.toggle('ordpar-minifetch-click', f === 'click');
    cl.toggle('ordpar-minifetch-page', f === 'page');
    var m = getSetting('formulas');
    cl.toggle('ordpar-formulas-no', m === 'no');
    cl.toggle('ordpar-formulas-both', m === 'both');
    var e = getSetting('ety');
    cl.toggle('ordpar-ety-no', e === 'no');
    cl.toggle('ordpar-ety-both', e === 'both');
    cl.toggle('ordpar-suggestrows-roomy', getSetting('suggestrows') === 'roomy');
    cl.toggle('ordpar-emph-no', getSetting('emph') === 'no');
    cl.toggle('ordpar-subsen-en', getSetting('subsenses') === 'en');
    cl.toggle('ordpar-layout-ordbokene', getSetting('layout') === 'ordbokene');
    cl.toggle('ordpar-examples-no', getSetting('examples') === 'no');
    var lim = getSetting('exlimit');
    SPEC.exlimit.values.forEach(function (v) { if (v !== 'all') { cl.toggle('ordpar-exlimit-' + v, v === lim); } });
    cl.toggle('ordpar-exmore-off', getSetting('exmore') === 'off');
    if (typeof global.ordparDefs === 'function') {
      try { global.ordparDefs(); } catch (e) {  }
    }
  }

  function notify(key, value) {
    listeners.forEach(function (fn) { try { fn(key, value); } catch (e) {  } });
  }


  function prefersDark() {
    try { return global.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }

  function applyTheme() {
    var theme = getSetting('theme');
    var dark = theme === 'dark' || (theme === 'system' && prefersDark());
    doc.documentElement.classList.toggle('nightMode', dark);
    doc.documentElement.setAttribute('data-theme', theme);
  }

  function applyDefs() {
    var cl = doc.documentElement.classList;
    var defs = getSetting('defs');
    var mini = getSetting('mini');
    if (mini === 'article') { mini = defs === 'en' ? 'en' : 'both'; }
    cl.toggle('ordpar-defs-en', defs === 'en');
    cl.toggle('ordpar-defs-no', defs === 'no');
    cl.toggle('ordpar-mini-en', mini === 'en');
    cl.toggle('ordpar-peek-off', getSetting('peek') === 'off');
    if (typeof global.ordparDefs === 'function') {
      try { global.ordparDefs(); } catch (e) {  }
    }
  }

  function applyColour() {
    var v = read('colour');
    if (v && COLOUR_ID.test(v)) { doc.documentElement.setAttribute('data-accent', v); }
    else { doc.documentElement.removeAttribute('data-accent'); }
  }

  try {
    var mq = global.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (getSetting('theme') === 'system') { applyTheme(); } };
    if (mq.addEventListener) { mq.addEventListener('change', onScheme); }
    else if (mq.addListener) { mq.addListener(onScheme); }
  } catch (e) {  }


  function has(key) {
    return Object.prototype.hasOwnProperty.call(strings[lang] || {}, key);
  }

  function t(key, vars) {
    var table = strings[lang] || {};
    var s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(String(vars[k])); } }
    return s;
  }

  function useLang(code) {
    code = LANGS.indexOf(code) !== -1 ? code : browserLang();
    lang = code;
    shell.lang = code;
    doc.documentElement.setAttribute('lang', code === 'en' ? 'en' : code);
    if (strings[code]) { return Promise.resolve(strings[code]); }
    return fetch(base() + 'site/strings/' + code + '.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (table) { strings[code] = table; return table; });
  }

  function base() { return global.ORDPAR_BASE || '/'; }


  function el(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function labelled(tag, cls, key) {
    var node = el(tag, cls, t(key));
    node.setAttribute('data-ordpar-string', key);
    return node;
  }

  function enhanceHeader(header) {
    if (header._ordpar) { return; }
    var form = header.querySelector('form.ordpar-search');
    var input = header.querySelector('#ordpar-q');
    var box = input && input.parentNode;
    if (!form || !input || !box) { return; }
    header._ordpar = true;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'ordpar-listbox');
    input.setAttribute('aria-autocomplete', 'list');

    var clear = el('button', 'ordpar-clear', '×');
    clear.type = 'button';
    clear.setAttribute('aria-label', t('search.clear'));
    box.appendChild(clear);

    var popup = el('div', 'ordpar-popup');
    popup.hidden = true;
    var recentHead = el('div', 'ordpar-popup-head');
    recentHead.hidden = true;
    recentHead.appendChild(labelled('span', 'ordpar-popup-title', 'recent.title'));
    var historyLink = labelled('a', 'ordpar-popup-link', 'recent.all');
    historyLink.href = base() + 'history/';
    historyLink.addEventListener('mousedown', function (e) { e.preventDefault(); });
    recentHead.appendChild(historyLink);
    popup.appendChild(recentHead);
    var listbox = el('ul', 'ordpar-listbox');
    listbox.id = 'ordpar-listbox';
    listbox.setAttribute('role', 'listbox');
    listbox.setAttribute('aria-label', t('search.suggestions'));
    popup.appendChild(listbox);
    box.appendChild(popup);

    wireSearch(form, input, listbox, clear, null, popup, recentHead);
  }

  var STATIC_STRINGS = [
    ['.ordpar-skip', function () {
      return doc.documentElement.hasAttribute('data-article-id') ? 'nav.skipArticle' : 'nav.skip';
    }],
    ['.ordpar-brand-name', 'site.name'],
    ['.ordpar-brand-tagline', 'site.tagline'],
    ['label[for="ordpar-q"]', 'search.label'],
    ['.ordpar-submit', 'search.submit'],
    ['.ordpar-footer-nav a[href="/"]', 'footer.home'],
    ['.ordpar-footer-nav a[href="/about/"]', 'about_link'],
    ['.ordpar-footer-nav a[href="/privacy/"]', 'footer.privacy']
  ];

  function keyStatic(scope) {
    STATIC_STRINGS.forEach(function (pair) {
      var node = scope.querySelector && scope.querySelector(pair[0]);
      if (node && !node.hasAttribute('data-ordpar-string')) {
        node.setAttribute('data-ordpar-string', typeof pair[1] === 'function' ? pair[1]() : pair[1]);
      }
    });
  }

  var FEEDBACK_URL = 'https://forms.gle/giwx4V8DkTwAaF6p9';

  function addChrome() {
    var root = doc.documentElement;
    root.classList.add('ordpar-js');
    var inner = doc.querySelector('.ordpar-header-inner');
    if (inner && !inner.querySelector('.ordpar-random')) {
      var form = inner.querySelector('form.ordpar-search');
      var random = labelled('button', 'ordpar-button is-quiet ordpar-random ordpar-needs-js', 'search.random');
      random.type = 'button';
      random.setAttribute('data-ordpar-random', '');
      var nav = el('nav', 'ordpar-header-nav ordpar-needs-js');
      nav.setAttribute('aria-label', t('nav.header'));
      var fav = labelled('a', 'ordpar-settings-button ordpar-fav-link', 'nav.favourites');
      fav.setAttribute('href', base() + 'favourites/');
      var set = labelled('a', 'ordpar-settings-button ordpar-settings-link', 'settings.open');
      set.setAttribute('href', base() + 'settings/');
      nav.appendChild(fav);
      nav.appendChild(set);
      var after = form ? form.nextSibling : null;
      inner.insertBefore(random, after);
      inner.insertBefore(nav, after);
    }
    var links = doc.querySelector('.ordpar-footer-nav');
    if (links && !links.querySelector('a[href$="/history/"]')) {
      var about = links.querySelector('a[href="/about/"]');
      [['settings/', 'footer.settings'], ['favourites/', 'footer.favourites'],
        ['history/', 'footer.history']].forEach(function (l) {
        var a = labelled('a', 'ordpar-needs-js', l[1]);
        a.setAttribute('href', base() + l[0]);
        links.insertBefore(a, about);
      });
    }
    if (links && global.ordparInstall) {
      try { global.ordparInstall.hint(links); } catch (e) {  }
    }
    var dev = doc.querySelector('.ordpar-devnote');
    if (dev && FEEDBACK_URL && !dev.querySelector('.ordpar-feedback')) {
      var fb = labelled('a', 'ordpar-feedback ordpar-needs-js', 'footer.feedback');
      fb.setAttribute('href', FEEDBACK_URL);
      fb.setAttribute('target', '_blank');
      fb.setAttribute('rel', 'noopener noreferrer');
      dev.appendChild(doc.createTextNode(' '));
      dev.appendChild(fb);
    }
    root.classList.add('ordpar-chrome');
  }

  function relabel(scope) {
    keyStatic(scope);
    var nodes = scope.querySelectorAll('[data-ordpar-string]');
    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute('data-ordpar-string');
      if (has(key)) { node.textContent = t(key); }
    });
    var input = scope.querySelector && scope.querySelector('#ordpar-q');
    if (input && has('search.placeholder')) { input.placeholder = t('search.placeholder'); }
    var clear = scope.querySelector && scope.querySelector('.ordpar-clear');
    if (clear && has('search.clear')) { clear.setAttribute('aria-label', t('search.clear')); }
  }

  function markCurrent(scope) {
    var links = scope.querySelectorAll('.ordpar-header a[href], .ordpar-footer a[href]');
    Array.prototype.forEach.call(links, function (a) {
      var here = a.pathname === global.location.pathname && a.host === global.location.host;
      if (here) {
        a.setAttribute('aria-current', 'page');
        if (has('nav.current')) { a.title = t('nav.current'); }
      } else { a.removeAttribute('aria-current'); }
    });
  }


  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function searchRowMain(e, tag) {
    var main = el('span', 'ordpar-option-main');
    var word = el(tag || 'span', 'ordpar-option-word', e.q);
    word.lang = 'nb';
    main.appendChild(word);
    var label = e.n === 1 && e.pos ? t('pos.' + e.pos) : '';
    if (label && label !== 'pos.' + e.pos) { main.appendChild(el('span', 'ordpar-pos', label)); }
    return main;
  }

  function needsFill(e) { return e.n > 1 || !e.translated || !e.text; }

  function searchRowSide(e) {
    var side = el('span', 'ordpar-option-side');
    var lookup = global.ordparLookup;
    if (lookup && lookup.lookup && lookup.loadSnippets && needsFill(e)) {
      var held = el('span', (e.n > 1 ? 'ordpar-option-glosses' : 'ordpar-option-gloss') + ' is-pending',
        '\u00a0');
      held.lang = e.n > 1 || e.translated ? 'en' : 'nb';
      side.appendChild(held);
      return side;
    }
    plainSide(side, e);
    var stored = lookup && lookup.lookup && lookup.loadSnippets && side.querySelector('.ordpar-option-gloss');
    if (stored) { stored.classList.add('is-check'); }
    return side;
  }

  function plainSide(side, e, n) {
    if (e.n > 1) {
      side.appendChild(el('span', 'ordpar-option-count', t('results.count', { n: n || e.n })));
    } else if (e.translated) {
      if (e.text) {
        var gloss = el('span', 'ordpar-option-gloss', e.text);
        gloss.lang = 'en';
        side.appendChild(gloss);
      }
    } else {
      side.appendChild(el('span', 'ordpar-tag', t('tag.norwegianOnly')));
    }
    return side;
  }

  function historyArticles(q) {
    var L = global.ordparLookup;
    return Promise.resolve(L.lookup(q)).then(function (res) {
      if (!res || !res.count) { return null; }
      var seen = Object.create(null), arts = [];
      var heads = [];
      res.heads.forEach(function (grp) { heads = heads.concat(grp.articles); });
      heads.filter(function (a) { return a.translated; })
        .concat(heads.filter(function (a) { return !a.translated; }))
        .forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; arts.push(a); } });
      if (!arts.length) { return null; }
      return Promise.resolve(L.loadSnippets(L.snipKey(L.fold(res.query)))).then(function (snips) {
        snips = snips || {};
        return { n: arts.length, list: arts.map(function (a) {
          var id = String(a.id);
          var text = a.translated ? glossText(snips, id) : (snips[id] || '');
          return { id: a.id, hg: a.hg || 0, translated: !!a.translated, head: a.word || '',
            text: text, lang: a.translated ? 'en' : 'nb',
            gloss: !!a.translated && glossIs(snips, id) };
        }) };
      });
    }).catch(function () { return null; });
  }

  function entryArticle(got, e) {
    if (!got) { return null; }
    if (got.list.length === 1) { return got.list[0]; }
    var byWord = [];
    for (var i = 0; i < got.list.length; i++) {
      var a = got.list[i];
      if (a.head !== e.word) { continue; }
      if (a.hg === (e.hg || 0)) { return a; }
      byWord.push(a);
    }
    return byWord.length === 1 ? byWord[0] : null;
  }

  function listedGlosses(articles, snips) {
    var shown = [];
    articles.forEach(function (a) {
      var text = a.translated && snips ? glossText(snips, String(a.id)) : '';
      if (text) { shown.push({ hg: a.hg || 0, text: text, gloss: glossIs(snips, String(a.id)) }); }
    });
    return shown;
  }

  function markTranslated(row, on) {
    if (row && row.classList) {
      if (on) { row.classList.add('is-translated'); } else { row.classList.remove('is-translated'); }
    }
  }

  function checkStored(side, e, refit) {
    var span = side && side.querySelector('.is-check');
    if (!span) { return Promise.resolve(); }
    span.classList.remove('is-check');
    return historyArticles(e.q).then(function (got) {
      var one = entryArticle(got, e);
      if (one && one.gloss && one.text === e.text) {
        writeGloss(span, one.text, true);
        (refit || function () {})();
      }
    });
  }

  function fillSearchRow(side, e, refit) {
    var held = side && side.querySelector('.is-pending');
    if (!held) { return checkStored(side, e, refit); }
    var again = refit || function () {};
    return historyArticles(e.q).then(function (got) {
      if (got) {
        markTranslated(side.parentNode, got.list.some(function (a) { return a.translated; }));
      }
      if (e.n > 1 && (!got || got.n > 1)) {
        var shown = got ? got.list.filter(function (a) { return a.translated && a.text; })
          .map(function (a) { return { hg: a.hg, text: a.text, gloss: a.gloss }; }) : [];
        if (!shown.length) {
          side.textContent = '';
          plainSide(side, e, got ? got.n : e.n);
          again();
          return;
        }
        var g = { list: held, side: side, n: got.n };
        paintGlossList(g, shown);
        again();
        fitGlosses(g, shown.length);
        return;
      }
      if (e.n > 1) {
        var only = got.list[0];
        held.className = 'ordpar-option-gloss is-pending';
        e = { q: e.q, n: 1, t: e.t, word: only.head, hg: only.hg, translated: only.translated,
          text: '' };
      }
      var one = entryArticle(got, e);
      if (one && one.text) {
        writeGloss(held, one.text, one.gloss);
        held.lang = one.lang;
        held.classList.remove('is-pending');
      } else {
        side.textContent = '';
        plainSide(side, e);
      }
      again();
    });
  }

  function glossText(snips, id) {
    var drop = snips._d && Object.prototype.hasOwnProperty.call(snips._d, id) ? snips._d[id] : null;
    return drop ? drop : (snips[id] ? snips[id].split(' \u00b7 ')[0] : '');
  }

  function glossIs(snips, id) {
    var L = global.ordparLookup;
    var drop = snips._d && Object.prototype.hasOwnProperty.call(snips._d, id) ? snips._d[id] : null;
    return !drop && !!(L && L.isGloss && L.isGloss(snips, id));
  }

  function writeGloss(node, text, gloss) {
    var L = global.ordparLookup;
    if (L && L.writeGloss) { L.writeGloss(node, text, gloss); } else { node.textContent = text; }
  }

  function paintGlossList(g, shown) {
    g.list.textContent = '';
    shown.forEach(function (s, i) {
      var one = el('span', 'ordpar-option-gl' + (s.gloss ? ' ordpar-sgloss' : ''));
      if (s.lang && s.lang !== 'en') { one.lang = s.lang; }
      if (i) { one.appendChild(el('span', 'ordpar-gsep', ' \u00b7 ')); }
      if (s.hg) {
        var mark = el('span', 'ordbok-homograph ordpar-hg', ROMAN[s.hg] || String(s.hg));
        mark.setAttribute('aria-hidden', 'true');
        one.appendChild(mark);
        one.appendChild(el('span', 'ordpar-visually-hidden', t('results.homograph', { n: s.hg })));
        one.appendChild(doc.createTextNode(' '));
      }
      one.appendChild(doc.createTextNode(s.text));
      g.list.appendChild(one);
    });
    g.list.classList.remove('is-pending');
    var more = el('span', 'ordpar-option-count ordpar-option-more');
    g.side.appendChild(more);
  }

  function fitGlosses(g, listed) {
    var more = g.side.querySelector('.ordpar-option-more');
    var items = g.list.querySelectorAll('.ordpar-option-gl');
    var kept = items.length;
    var label = function () {
      var rest = g.n - kept;
      more.textContent = rest > 0 ? t('suggest.more', { n: rest }) : '';
      more.hidden = rest <= 0;
    };
    label();
    if (!g.list.clientWidth) { return; }
    while (kept > 1 && g.list.scrollWidth > g.list.clientWidth + 1) {
      g.list.removeChild(items[--kept]);
      label();
    }
    if (kept < listed) { g.list.setAttribute('data-cut', String(listed - kept)); }
  }

  function countOnly(g) {
    if (!g.list || g.list.parentNode !== g.side) { return; }
    var count = el('span', 'ordpar-option-count', t('results.count', { n: g.n }));
    g.side.replaceChild(count, g.list);
    g.list.classList.remove('is-pending');
  }

  function wireSearch(form, input, listbox, clear, carried, popup, recentHead) {
    var options = [];
    var active = -1;
    var lookup = global.ordparLookup;
    var seq = 0;

    var q = carried != null ? carried
      : ((global.ordparSearch && global.ordparSearch.queryFromLocation)
        ? global.ordparSearch.queryFromLocation() : '');
    if (q) { input.value = q; }

    function close() {
      popup.hidden = true;
      recentHead.hidden = true;
      listbox.setAttribute('aria-label', t('search.suggestions'));
      listbox.textContent = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      options = [];
      active = -1;
    }

    function optionRows() { return listbox.querySelectorAll('.ordpar-option'); }

    function choose(i) {
      active = i;
      var rows = optionRows();
      Array.prototype.forEach.call(rows, function (li, n) {
        li.setAttribute('aria-selected', n === i ? 'true' : 'false');
        li.classList.toggle('is-active', n === i);
      });
      if (i >= 0 && rows[i]) {
        input.setAttribute('aria-activedescendant', rows[i].id);
        var sub = rows[i].parentNode;
        var head = !rows[i].previousElementSibling && sub !== listbox && sub.parentNode
          ? sub.parentNode.querySelector('.ordpar-option-label') : null;
        if (head && head.scrollIntoView) { head.scrollIntoView({ block: 'nearest' }); }
        if (rows[i].scrollIntoView) { rows[i].scrollIntoView({ block: 'nearest' }); }
      } else { input.removeAttribute('aria-activedescendant'); }
    }

    var ranked = [];
    function open(items) {
      listbox.textContent = '';
      ranked = items;
      var sec = lookup && lookup.suggestSections ? lookup.suggestSections(items, input.value)
        : { rows: items, start: -1, end: -1 };
      items = sec.rows;
      options = items;
      active = -1;
      recentHead.hidden = true;
      listbox.setAttribute('aria-label', t('search.suggestions'));
      var host = listbox;
      items.forEach(function (item, i) {
        if (i === sec.start) {
          var group = el('li', 'ordpar-option-section');
          group.setAttribute('role', 'group');
          group.setAttribute('aria-labelledby', 'ordpar-option-nbhead');
          if (i > 0) {
            var above = el('div', 'ordpar-option-sep');
            above.setAttribute('aria-hidden', 'true');
            group.appendChild(above);
          }
          var head = el('div', 'ordpar-option-label');
          head.id = 'ordpar-option-nbhead';
          head.setAttribute('aria-hidden', 'true');
          head.appendChild(el('span', 'ordpar-tag', t('tag.norwegianOnly')));
          group.appendChild(head);
          host = el('ul', 'ordpar-option-sublist');
          host.setAttribute('role', 'none');
          group.appendChild(host);
          listbox.appendChild(group);
        } else if (i === sec.end) {
          host = listbox;
          var after = el('li', 'ordpar-option-sep');
          after.setAttribute('role', 'none');
          listbox.appendChild(after);
        }
        var li = el('li', 'ordpar-option ' + (item.translated ? 'is-translated' : 'is-nb'));
        li.id = 'ordpar-option-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        var word = el('span', 'ordpar-option-word', item.line ? '' : item.word);
        word.lang = 'nb';
        if (item.line) { drawLine(word, item.line); }
        var main = el('span', 'ordpar-option-main');
        main.appendChild(word);
        var label = (item.ids || []).length === 1 && item.pos ? t('pos.' + item.pos) : '';
        if (label && label !== 'pos.' + item.pos) { main.appendChild(el('span', 'ordpar-pos', label)); }
        li.appendChild(main);
        li.appendChild(optionSide(item, glosses, li, i >= sec.start && i < sec.end));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); picked(i); submit(item.word); });
        host.appendChild(li);
      });
      popup.hidden = items.length === 0;
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      popup.scrollTop = 0;
      fitHeight(popup);
      Array.prototype.forEach.call(optionRows(), function (li, i) { fitRow(li, items[i]); });
      fillGlosses(glosses);
    }

    var viewport = global.visualViewport || global;
    viewport.addEventListener('resize', function () {
      if (popup.hidden || doc.activeElement !== input) { return; }
      if (!recentHead.hidden) { fitHeight(popup); return; }
      if (ranked.length) {
        fitHeight(popup);
        Array.prototype.forEach.call(optionRows(), function (li, i) { fitRow(li, options[i]); });
      }
    });

    function openRecent() {
      var P = global.ordparPersonal;
      var list = P ? P.history().slice(0, P.RECENT) : [];
      if (!list.length) { close(); return; }
      var mine = ++seq;
      listbox.textContent = '';
      options = list.map(function (e) { return { word: e.q, recent: e }; });
      active = -1;
      recentHead.hidden = false;
      listbox.setAttribute('aria-label', t('recent.label'));
      list.forEach(function (e, i) {
        var li = el('li', 'ordpar-option ordpar-option-recent' +
          (e.n === 1 && e.translated ? ' is-translated' : ''));
        li.id = 'ordpar-option-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.appendChild(searchRowMain(e));
        li.appendChild(searchRowSide(e));
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); submit(e.q); });
        listbox.appendChild(li);
      });
      popup.hidden = false;
      popup.scrollTop = 0;
      fitHeight(popup);
      input.setAttribute('aria-expanded', 'true');
      Array.prototype.forEach.call(listbox.children, function (li, i) { fitRow(li, options[i]); });
      Array.prototype.slice.call(listbox.children).forEach(function (li, i) {
        var item = options[i];
        fillSearchRow(li.querySelector('.ordpar-option-side'), item.recent, function () {
          if (mine === seq && li.parentNode === listbox) { fitRow(li, item); }
        });
      });
    }

    function emptyBox() { return !input.value.replace(/\s+/g, ''); }

    var glosses = [];
    function optionSide(item, pending, row, nbsec) {
      var side = el('span', 'ordpar-option-side');
      var ids = item.ids || [];
      if (ids.length > 1) {
        var list = el('span', 'ordpar-option-glosses is-pending', '\u00a0');
        list.lang = 'en';
        side.appendChild(list);
        pending.push({ list: list, side: side, word: item.word, n: ids.length,
          articles: item.articles || [], row: row, item: item });
        return side;
      }
      if (item.translated && ids.length === 1) {
        var gloss = el('span', 'ordpar-option-gloss is-pending', '\u00a0');
        gloss.lang = 'en';
        side.appendChild(gloss);
        pending.push({ span: gloss, word: item.word, id: String(ids[0]), row: row, item: item });
      } else if (nbsec && ids.length === 1) {
        var def = el('span', 'ordpar-option-gloss ordpar-option-nb is-pending', '\u00a0');
        def.lang = 'nb';
        side.appendChild(def);
        pending.push({ span: def, word: item.word, id: String(ids[0]), row: row, item: item, nb: true });
      } else {
        side.appendChild(el('span', 'ordpar-tag', t('tag.norwegianOnly')));
      }
      return side;
    }

    function fillGlosses(pending) {
      var mine = seq, todo = pending.splice(0, pending.length);
      if (!todo.length || !lookup || !lookup.loadSnippets) { return; }
      var keys = [];
      todo.forEach(function (g) {
        g.key = lookup.snipKey(lookup.fold(g.word));
        if (keys.indexOf(g.key) === -1) { keys.push(g.key); }
      });
      Promise.all(keys.map(function (k) {
        return lookup.loadSnippets(k).then(function (snips) {
          if (mine !== seq) { return; }
          todo.forEach(function (g) {
            if (g.key !== k || !snips) { return; }
            if (g.list) { glossList(g, snips); return; }
            var text = g.nb ? (snips[g.id] || '') : glossText(snips, g.id);
            if (text) {
              writeGloss(g.span, text, !g.nb && glossIs(snips, g.id));
              g.span.classList.remove('is-pending');
              fitRow(g.row, g.item);
            }
          });
        });
      })).then(function () {
        if (mine !== seq) { return; }
        todo.forEach(function (g) {
          if (g.list) {
            if (g.list.classList.contains('is-pending')) { countOnly(g); fitRow(g.row, g.item); }
            return;
          }
          if (g.span.classList.contains('is-pending') && g.span.parentNode) {
            g.span.parentNode.removeChild(g.span);
            fitRow(g.row, g.item);
          }
        });
      });
    }

    function glossList(g, snips) {
      var shown = listedGlosses(g.articles, snips);
      if (!shown.length) { countOnly(g); return; }
      paintGlossList(g, shown);
      fitRow(g.row, g.item);
      fitGlosses(g, shown.length);
    }

    function drawLine(node, line) {
      line.forEach(function (part, i) {
        if (i) { node.appendChild(doc.createTextNode(part.w === '\u2026' ? ' ' : ', ')); }
        node.appendChild(el('span', part.match ? 'ordpar-option-match' : 'ordpar-option-alt', part.w));
      });
    }

    var FIT_FLOOR = 8;
    function fitRow(li, item) {
      if (!li || !item) { return; }
      var main = li.querySelector('.ordpar-option-main');
      var side = li.querySelector('.ordpar-option-side');
      var word = main && main.querySelector('.ordpar-option-word');
      if (!side || !word) { return; }
      var pos = main.querySelector('.ordpar-pos');
      var redraw = function (line) { word.textContent = ''; drawLine(word, line); };
      if (item.line && li.hasAttribute('data-fit')) { redraw(item.line); }
      if (pos) { pos.hidden = false; }
      main.style.maxWidth = '';
      main.classList.remove('is-cut');
      li.removeAttribute('data-fit');
      if (!li.clientWidth) { return; }
      var cs = global.getComputedStyle(li);
      var room = li.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        - (parseFloat(cs.columnGap) || 0);
      var floor = FIT_FLOOR * parseFloat(global.getComputedStyle(doc.documentElement).fontSize);
      var need = sideNeed(side, floor);
      var steps = [
        item.line && function () { redraw(item.line.filter(function (part) { return part.match; })); },
        item.line && function () { redraw([{ w: item.word, match: true }]); },
        pos && function () { pos.hidden = true; },
        function () {
          main.classList.add('is-cut');
          main.style.maxWidth = Math.max(0, Math.floor(room - need)) + 'px';
        }
      ];
      for (var s = 0; s < steps.length; s++) {
        if (main.getBoundingClientRect().width + need <= room + 0.5) { break; }
        if (steps[s]) { steps[s](); }
        li.setAttribute('data-fit', String(s + 1));
      }
    }

    function sideNeed(side, floor) {
      var need = 0, n = 0;
      Array.prototype.forEach.call(side.children, function (c) {
        if (c.hidden || !c.textContent) { return; }
        var shrinks = c.classList.contains('ordpar-option-gloss')
          || c.classList.contains('ordpar-option-glosses');
        need += !shrinks ? c.getBoundingClientRect().width
          : c.classList.contains('is-pending') ? floor : Math.min(c.scrollWidth, floor);
        n++;
      });
      return need + (n > 1 ? (n - 1) * (parseFloat(global.getComputedStyle(side).columnGap) || 0) : 0);
    }

    var MIN_ROWS = 3, KEYBOARD_GAP = 8;
    function fitHeight(popup) {
      popup.style.maxHeight = '';
      if (popup.hidden || !popup.offsetHeight) { return; }
      var vv = global.visualViewport;
      var bottom = vv ? vv.offsetTop + vv.height : global.innerHeight;
      var room = Math.floor(bottom - popup.getBoundingClientRect().top - KEYBOARD_GAP);
      var first = popup.querySelector('.ordpar-option');
      var floor = first ? Math.ceil(MIN_ROWS * first.getBoundingClientRect().height) : 0;
      if (room < popup.offsetHeight) { popup.style.maxHeight = Math.max(room, floor) + 'px'; }
    }

    function picked(i) {
      var item = options[i];
      if (!item || item.recent) { return; }
      event('pick', { typed: input.value, word: item.word, position: i + 1 });
    }

    function touchFirst() {
      try { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
    }

    function submit(value) {
      var query = (value != null ? value : input.value).trim();
      close();
      if (!query) { return; }
      input.value = query;
      if (touchFirst()) { input.blur(); }
      if (searchHandler) {
        searchHandler(query);
        if (!touchFirst()) { input.focus(); }
      } else {
        global.location.href = base() + 'bm-en/#q=' + encodeURIComponent(query);
      }
    }

    input.addEventListener('input', function () {
      if (emptyBox()) { openRecent(); return; }
      if (!lookup) { return; }
      var value = input.value;
      var guard = lookup.guard(value);
      if (!guard.ok) { close(); return; }
      var mine = ++seq;
      lookup.suggest(value).then(function (items) {
        if (mine !== seq || doc.activeElement !== input) { return; }
        open(items);
      });
    });

    input.addEventListener('focus', function () { if (emptyBox()) { openRecent(); } });

    input.addEventListener('keydown', function (e) {
      if (popup.hidden && (e.key === 'ArrowDown') && (lookup || emptyBox())) {
        input.dispatchEvent(new Event('input'));
        return;
      }
      if (popup.hidden) { return; }
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); choose((active + 1) % options.length); break;
        case 'ArrowUp': e.preventDefault(); choose(active <= 0 ? options.length - 1 : active - 1); break;
        case 'Home': e.preventDefault(); choose(0); break;
        case 'End': e.preventDefault(); choose(options.length - 1); break;
        case 'Escape': e.preventDefault(); close(); break;
        case 'Tab': close(); break;
        case 'Enter':
          if (active >= 0) {
            e.preventDefault();
            picked(active);
            submit(options[active].word);
          }
          break;
        default: break;
      }
    });

    input.addEventListener('blur', function () { global.setTimeout(close, 120); });
    clear.addEventListener('click', function () {
      input.value = '';
      close();
      input.focus();
      openRecent();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
  }


  function rerender() {
    if (global.ordparPersonal && has('fav.label')) {
      global.ordparPersonal.setLabels({ label: t('fav.label'), saved: t('fav.saved') });
    }
    var header = doc.querySelector('header.ordpar-header');
    if (header) { enhanceHeader(header); }
    relabel(doc);
    markCurrent(doc);
    notify('render', lang);
  }

  function event(name, data) {
    var E = global.ordparEvents;
    if (!E || !data) { return; }
    try {
      if (name === 'pick') { E.pick(data.typed, data.word, data.position); }
    } catch (e) {  }
  }

  var shell = {
    t: t,
    has: has,
    lang: lang,
    getSetting: getSetting,
    SETTINGS: SETTINGS,
    colours: colours,
    setSetting: setSetting,
    resetSettings: resetSettings,
    applyAll: applyAll,
    KEYS: KEYS.slice(),
    deleteStoredData: deleteStoredData,
    onChange: function (fn) { listeners.push(fn); },
    searchRowMain: searchRowMain, searchRowSide: searchRowSide, fillSearchRow: fillSearchRow,
    setSearchHandler: function (fn) { searchHandler = fn; },
    search: function (q, how) {
      if (!searchHandler || !q) { return false; }
      var box = doc.getElementById('ordpar-q');
      if (box) { box.value = q; }
      searchHandler(q, how);
      return true;
    },
    render: rerender,
    event: event,
    ready: null
  };
  global.ordparShell = shell;

  applyTheme();
  applyColour();
  applyDefs();
  var inlined = global.ORDPAR_STRINGS || {};
  for (var code in inlined) { strings[code] = inlined[code]; }
  addChrome();

  function start() {
    shell.ready = useLang(getSetting('lang')).then(function () {
      rerender();
      if (global.ordparSearch) { global.ordparSearch.wireRandom(doc); }
      else {
        Array.prototype.forEach.call(doc.querySelectorAll('[data-ordpar-random]'),
          function (b) { b.hidden = true; });
      }
      return shell;
    });
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', start); }
  else { start(); }
}(typeof globalThis !== 'undefined' ? globalThis : this));
