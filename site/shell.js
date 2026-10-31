(function (global) {
  'use strict';

  var doc = global.document;
  var LANGS = ['en'];
  var SETTINGS = [
    { key: 'theme', values: ['system', 'light', 'dark'], def: 'system', section: 'style' },
    { key: 'colour', values: null, def: null, section: 'style' },
    { key: 'lang', values: LANGS, def: null, section: 'style' },
    { key: 'layout', values: ['ordpar', 'ordbokene'], def: 'ordpar', section: 'style' },
    { key: 'labels', values: ['en', 'no'], def: 'en', section: 'style' },
    { key: 'nbonly', values: ['off', 'on'], def: 'off', section: 'article', sub: 'nbonly', layer: true },
    { key: 'nbequiv', values: ['hidden', 'shown'], def: 'hidden', section: 'article', sub: 'nbonly', layer: true },
    { key: 'nbrows', values: ['nbdef', 'none'], def: 'nbdef', section: 'article', sub: 'nbonly', layer: true },
    { key: 'nbhover', values: ['none', 'nbdef'], def: 'none', section: 'article', sub: 'nbonly', layer: true },
    { key: 'nbicon', values: ['on', 'off'], def: 'on', section: 'article', sub: 'nbonly', layer: true },
    { key: 'defs', values: ['both', 'en', 'no'], def: 'both', section: 'article', sub: 'language' },
    { key: 'examples', values: ['both', 'no'], def: 'both', section: 'article', sub: 'language' },
    { key: 'exeye', values: ['off', 'on'], def: 'off', section: 'article', sub: 'language' },
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
    { key: 'nestminis', values: ['second', 'inplace', 'stacked', 'off'], def: 'second', section: 'article', sub: 'mini' },
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
    'formulas', 'ety', 'suggestrows', 'emph', 'subsenses', 'layout', 'examples', 'exeye', 'exlimit', 'exmore'];
  var COLOUR_ID = /^[a-z][a-z0-9-]*$/;
  var strings = {};
  var listeners = [];
  var searchHandler = null;
  var lang = 'en';


  function read(key) {
    if (typeof global.ordparRead === 'function') { return global.ordparRead(key); }
    return saved(key);
  }
  function saved(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { global.localStorage.setItem(key, value); } catch (e) {  }
  }
  function drop(key) {
    try { global.localStorage.removeItem(key); } catch (e) {  }
  }

  var VISIT_KEY = 'ordpar-visit';
  function leaveVisit(key) {
    var V = global.ordparVisit && global.ordparVisit.settings;
    if (V) { if (key) { delete V[key]; } else { Object.keys(V).forEach(function (k) { delete V[k]; }); } }
    try {
      var S = global.sessionStorage, v = JSON.parse(S.getItem(VISIT_KEY));
      if (!v || typeof v !== 'object') { return; }
      if (key) { delete v[key]; S.setItem(VISIT_KEY, JSON.stringify(v)); } else { S.removeItem(VISIT_KEY); }
    } catch (e) {  }
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

  function getSetting(key) { return valueOf(key, read(key)); }

  function savedSetting(key) { return valueOf(key, saved(key)); }

  function colourIds() {
    var list = colours();
    if (list) {
      var d = list.filter(function (c) { return c.default; })[0];
      return { ids: list.map(function (c) { return c.id; }), def: d ? d.id : null };
    }
    var V = global.ordparVisit;
    return V && V.table && V.table.colour ? { ids: V.table.colour, def: V.colour || null } : null;
  }

  function valueOf(key, v) {
    if (key === 'lang') { return v && LANGS.indexOf(v) !== -1 ? v : browserLang(); }
    if (key === 'colour') {
      var known = colourIds();
      var ok = v && COLOUR_ID.test(v) && (!known || known.ids.indexOf(v) !== -1);
      if (ok) { return v; }
      return known ? known.def : null;
    }
    var sp = SPEC[key];
    if (!sp) { return v; }
    return sp.values.indexOf(v) !== -1 ? v : sp.def;
  }

  var LAYER_VALUES = { defs: 'no', examples: 'no', formulas: 'no', ety: 'no', mini: 'article', subsenses: 'defs' };
  var LAYER_KEYS = ['nbonly', 'nbequiv', 'nbrows', 'nbhover', 'nbicon', 'labels'];
  function layer() {
    var on = getSetting('nbonly') === 'on';
    var hidden = on && getSetting('nbequiv') === 'hidden';
    return { on: on, hidden: hidden, rows: hidden ? getSetting('nbrows') : null,
      hover: hidden ? getSetting('nbhover') : null };
  }
  function eff(key) {
    var L = layer();
    if (L.on && Object.prototype.hasOwnProperty.call(LAYER_VALUES, key)) { return LAYER_VALUES[key]; }
    if (key === 'peek' && L.hidden) { return L.hover === 'nbdef' ? 'on' : 'off'; }
    return getSetting(key);
  }
  function nbWords() { return getSetting('labels') === 'no' || layer().on; }

  var POPUP_ADDRESS = 'https://ordpar.no/bm-en/#';
  var POPUP_WORD = 'q={{str}}';

  function popupAddress() {
    var pairs = [];
    SETTINGS.forEach(function (sp) {
      var raw = saved(sp.key), v = savedSetting(sp.key);
      if (raw == null || v !== raw) { return; }
      var def = sp.key === 'colour' ? (colourIds() || {}).def
        : sp.key === 'lang' ? browserLang() : sp.def;
      if (v !== def) { pairs.push(sp.key + '=' + v); }
    });
    return POPUP_ADDRESS + pairs.concat(POPUP_WORD).join('&');
  }

  function copyText(text, node, reveal) {
    var nav = global.navigator || {};
    var bySelection = function () {
      if (reveal) { try { reveal(); } catch (e) {  } }
      if (!node || !doc.createRange || !global.getSelection) { return false; }
      try {
        var range = doc.createRange();
        range.selectNodeContents(node);
        var sel = global.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return !!(doc.execCommand && doc.execCommand('copy'));
      } catch (e) { return false; }
    };
    if (nav.clipboard && nav.clipboard.writeText) {
      return nav.clipboard.writeText(text).then(function () { return true; }, bySelection);
    }
    return Promise.resolve(bySelection());
  }

  var COPIED_MS = 2500;

  function wireCodeLines(scope) {
    var lines = scope.querySelectorAll ? scope.querySelectorAll('.ordpar-about .ordpar-code') : [];
    Array.prototype.forEach.call(lines, function (box) {
      var code = box.querySelector('code');
      if (!code || box.querySelector('.ordpar-code-copy')) { return; }
      if (code.hasAttribute('data-ordpar-popup')) { code.textContent = popupAddress(); }
      var btn = labelled('button', 'ordpar-button is-quiet ordpar-code-copy', 'code.copy');
      btn.type = 'button';
      var timer = null;
      btn.addEventListener('click', function () {
        copyText(code.textContent, code).then(function (ok) {
          if (!ok) { return; }
          btn.setAttribute('data-ordpar-string', 'code.copied');
          btn.textContent = t('code.copied');
          if (timer) { clearTimeout(timer); }
          timer = setTimeout(function () {
            btn.setAttribute('data-ordpar-string', 'code.copy');
            btn.textContent = t('code.copy');
          }, COPIED_MS);
        });
      });
      box.appendChild(btn);
      box.classList.add('has-copy');
    });
  }

  function setSetting(key, value) {
    if (KEYS.indexOf(key) === -1) { return; }
    write(key, value);
    leaveVisit(key);
    if (key === 'theme') { applyTheme(); }
    if (key === 'colour') { applyColour(); }
    if (ARTICLE_KEYS.indexOf(key) !== -1) { applyDefs(); }
    if (CLASS_KEYS.indexOf(key) !== -1) { applyClassKeys(); }
    if (LAYER_KEYS.indexOf(key) !== -1) { applyLayer(); }
    if (key === 'lang') { return useLang(value).then(function () { rerender(); notify(key, value); }); }
    rerender();
    notify(key, value);
    return Promise.resolve();
  }

  function applyLayer() {
    if (!layer().hidden) { dirLayer = null; }
    applyDefs();
    applyClassKeys();
    applyDirection();
  }

  function visitSetting(key, value) {
    if (KEYS.indexOf(key) === -1) { return Promise.resolve(); }
    var V = global.ordparVisit;
    if (V) {
      if (!V.settings) { V.settings = {}; }
      V.settings[key] = value;
    }
    try {
      var S = global.sessionStorage, v = JSON.parse(S.getItem(VISIT_KEY));
      if (!v || typeof v !== 'object') { v = {}; }
      v[key] = value;
      S.setItem(VISIT_KEY, JSON.stringify(v));
    } catch (e) {  }
    applyLayer();
    rerender();
    notify(key, value);
    return Promise.resolve();
  }

  function resetSettings() {
    KEYS.forEach(drop);
    leaveVisit();
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
    var m = eff('formulas');
    cl.toggle('ordpar-formulas-no', m === 'no');
    cl.toggle('ordpar-formulas-both', m === 'both');
    var e = eff('ety');
    cl.toggle('ordpar-ety-no', e === 'no');
    cl.toggle('ordpar-ety-both', e === 'both');
    cl.toggle('ordpar-suggestrows-roomy', getSetting('suggestrows') === 'roomy');
    cl.toggle('ordpar-emph-no', getSetting('emph') === 'no');
    cl.toggle('ordpar-subsen-en', eff('subsenses') === 'en');
    cl.toggle('ordpar-layout-ordbokene', getSetting('layout') === 'ordbokene');
    cl.toggle('ordpar-examples-no', eff('examples') === 'no');
    var L = layer();
    cl.toggle('ordpar-nbo', L.on);
    cl.toggle('ordpar-nbo-noeq', L.hidden);
    cl.toggle('ordpar-nbo-rows0', L.rows === 'none');
    cl.toggle('ordpar-nbo-hovnb', L.hover === 'nbdef');
    cl.toggle('ordpar-nbicon-off', getSetting('nbicon') === 'off');
    cl.toggle('ordpar-labels-no', getSetting('labels') === 'no');
    syncIcons();
    cl.toggle('ordpar-exeye-on', getSetting('exeye') === 'on');
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
    var defs = eff('defs');
    var mini = eff('mini');
    if (mini === 'article') { mini = defs === 'en' ? 'en' : 'both'; }
    cl.toggle('ordpar-defs-en', defs === 'en');
    cl.toggle('ordpar-defs-no', defs === 'no');
    cl.toggle('ordpar-mini-en', mini === 'en');
    cl.toggle('ordpar-peek-off', eff('peek') === 'off');
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

  function nl(parent, before) {
    if (!doc.createTextNode || !parent || !parent.insertBefore) { return; }
    parent.insertBefore(doc.createTextNode('\n'), before || null);
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
    ['.ordpar-footer-nav a[href="/help/"]', 'footer.help'],
    ['.ordpar-footer-nav a[href="/more/"]', 'footer.more'],
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
      nav.appendChild(nbIcon('nav'));
      nl(nav);
      nav.appendChild(fav);
      nl(nav);
      nav.appendChild(set);
      var after = form ? form.nextSibling : null;
      nl(inner, after);
      inner.insertBefore(random, after);
      nl(inner, after);
      inner.insertBefore(nav, after);
    }
    addSwitch(inner);
    var links = doc.querySelector('.ordpar-footer-nav');
    if (links && !links.querySelector('a[href$="/history/"]')) {
      var about = links.querySelector('a[href="/help/"]') || links.querySelector('a[href="/about/"]');
      [['settings/', 'footer.settings'], ['favourites/', 'footer.favourites'],
        ['history/', 'footer.history']].forEach(function (l) {
        var a = labelled('a', 'ordpar-needs-js', l[1]);
        a.setAttribute('href', base() + l[0]);
        links.insertBefore(a, about);
        nl(links, about);
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
    addMoreLine();
    root.classList.add('ordpar-chrome');
  }


  var dirOnPage = null;
  var dirLayer = null;
  function equivHidden() { return layer().hidden; }
  function direction() {
    if (equivHidden()) { return dirLayer === 'en' ? 'en' : 'nb'; }
    var P = global.ordparPersonal;
    var v = dirOnPage || (P && P.direction ? P.direction() : null);
    return v === 'en' ? 'en' : 'nb';
  }
  function englishOn() { return direction() === 'en'; }

  function setDirection(d, opts) {
    d = d === 'en' ? 'en' : 'nb';
    var was = direction();
    var P = global.ordparPersonal;
    if (equivHidden()) { dirLayer = d; }
    else { dirOnPage = P && P.setDirection && P.setDirection(d) ? null : d; }
    applyDirection();
    if (was !== d) { notify('direction', d); }
    if (!(opts && opts.rerun) || was === d) { return; }
    var box = doc.getElementById('ordpar-q');
    var q = box ? box.value.trim() : '';
    if (!q) { return; }
    if (searchHandler) { searchHandler(q, d === 'en' ? { en: true } : undefined); return; }
    var L = global.ordparLookup;
    if (d === 'en') { global.location.href = L && L.englishUrl ? L.englishUrl(q) : base() + 'bm-en/#en=' + encodeURIComponent(q); }
    else if (L && L.searchAddress) { L.searchAddress(q).then(function (href) { global.location.href = href; }); }
    else { global.location.href = base() + 'bm-en/#q=' + encodeURIComponent(q); }
  }

  function applyDirection() {
    var en = englishOn();
    var input = doc.getElementById ? doc.getElementById('ordpar-q') : null;
    if (input) {
      input.lang = en ? 'en' : 'nb';
      var ph = en ? 'search.placeholderEn' : 'search.placeholder';
      if (has(ph)) { input.placeholder = t(ph); }
    }
    var label = doc.querySelector ? doc.querySelector('label[for="ordpar-q"]') : null;
    var lk = en ? 'search.labelEn' : 'search.label';
    if (label && has(lk)) { label.textContent = t(lk); }
    var sw = doc.getElementById ? doc.getElementById('ordpar-en-switch') : null;
    if (sw) { sw.checked = en; }
  }

  function addSwitch(inner) {
    if (!inner || !inner.querySelector('form.ordpar-search') || inner.querySelector('.ordpar-direction')) { return; }
    var row = el('div', 'ordpar-direction ordpar-needs-js');
    var lab = el('label', 'ordpar-switch');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.id = 'ordpar-en-switch';
    cb.setAttribute('role', 'switch');
    cb.checked = englishOn();
    cb.addEventListener('change', function () { setDirection(cb.checked ? 'en' : 'nb', { rerun: true }); });
    lab.appendChild(cb);
    var track = el('span', 'ordpar-switch-track');
    track.setAttribute('aria-hidden', 'true');
    track.appendChild(el('span', 'ordpar-switch-knob'));
    lab.appendChild(track);
    lab.appendChild(labelled('span', 'ordpar-switch-text', 'search.english'));
    row.appendChild(lab);
    row.appendChild(nbIcon('row'));
    var random = inner.querySelector('.ordpar-random');
    inner.insertBefore(row, random);
    if (random) { nl(inner, random); }
    applyDirection();
  }

  var NB_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 ' +
    '2H9l-4 3.5V15H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M17.5 9H20a2 2 0 0 1 2 2v5a2 2 0 0 ' +
    '1-2 2h-1v3l-3.2-3H12" opacity=".55"/></svg>';
  function nbIcon(where) {
    var w = el('span', 'ordpar-nbo-icon ordpar-nbo-' + where + ' ordpar-needs-js');
    var b = el('button', 'ordpar-nbo-btn');
    b.type = 'button';
    b.innerHTML = '<span aria-hidden="true">' + NB_ICON + '</span>';
    b.addEventListener('click', function () {
      setSetting('nbonly', getSetting('nbonly') === 'on' ? 'off' : 'on');
    });
    w.appendChild(b);
    syncIcon(b);
    return w;
  }
  function syncIcon(b) {
    var on = getSetting('nbonly') === 'on';
    var label = t(on ? 'nbo.iconOn' : 'nbo.iconOff');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', label);
    b.title = label;
  }
  function syncIcons() {
    if (!doc.querySelectorAll) { return; }
    Array.prototype.forEach.call(doc.querySelectorAll('.ordpar-nbo-btn,.ordpar-nbhw-btn'), syncIcon);
  }

  function addMoreLine() {
    var main = doc.getElementById ? doc.getElementById('ordpar-main') : null;
    var results = main && main.querySelector ? main.querySelector('[data-ordpar-results]') : null;
    if (!results || !global.location || global.location.pathname !== base() ||
        main.querySelector('.ordpar-more-line')) {
      return;
    }
    var parts = t('home.more').split('{link}');
    var line = el('p', 'ordpar-more-line');
    var link = labelled('a', '', 'home.moreLink');
    link.setAttribute('href', base() + 'more/');
    line.appendChild(doc.createTextNode(parts[0]));
    line.appendChild(link);
    if (parts.length > 1 && parts[1]) { line.appendChild(doc.createTextNode(parts[1])); }
    main.insertBefore(line, results);
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
    applyDirection();
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
    var pos = e.n === 1 ? posSpan(e.pos) : null;
    if (pos) { main.appendChild(pos); }
    return main;
  }


  function englishRow(tag, item, cls, rowClass) {
    var row = el(tag, (rowClass || 'ordpar-option') + ' ordpar-option-en' + (cls ? ' ' + cls : ''));
    var main = el('span', 'ordpar-option-main');
    var word = el('span', 'ordpar-option-word', item.word);
    word.lang = 'en';
    main.appendChild(word);
    row.appendChild(main);
    nl(row);
    englishSide(row, row.appendChild(el('span', 'ordpar-option-side')), (item && item.arts) || []);
    return row;
  }

  function nbFirst(node, a, numbered) {
    var w = el('span', 'ordpar-en-nb');
    w.lang = 'nb';
    w.appendChild(doc.createTextNode(firstOf(a)));
    if (numbered && a.firstHg) {
      w.appendChild(doc.createTextNode(' '));
      var mark = el('span', 'ordbok-homograph ordpar-hg', ROMAN[a.firstHg] || String(a.firstHg));
      mark.setAttribute('aria-hidden', 'true');
      w.appendChild(mark);
      var said = el('span', 'ordpar-visually-hidden', t('results.homograph', { n: a.firstHg }));
      said.setAttribute('data-nosnippet', '');
      w.appendChild(said);
    }
    node.appendChild(w);
  }

  function firstOf(a) { return a.first || String(a.word || '').split(' / ')[0]; }

  function sharedForms(arts) {
    var n = Object.create(null), out = Object.create(null);
    arts.forEach(function (a) { var f = firstOf(a); n[f] = (n[f] || 0) + 1; if (n[f] > 1) { out[f] = true; } });
    return out;
  }

  function posWords(pos) {
    if (!pos) { return ''; }
    var key = (nbWords() && has('pos.nb.' + pos) ? 'pos.nb.' : 'pos.') + pos;
    var label = t(key);
    return label && label !== key ? label : '';
  }
  function posSpan(pos) {
    var label = posWords(pos);
    if (!label) { return null; }
    var span = el('span', 'ordpar-pos', label);
    span.lang = nbWords() && has('pos.nb.' + pos) ? 'nb' : 'en';
    return span;
  }

  function englishSide(row, side, arts) {
    side.textContent = '';
    var g = null, shared = sharedForms(arts);
    if (arts.length === 1) {
      var one = el('span', 'ordpar-option-gloss ordpar-option-nbword');
      one.lang = 'nb';
      nbFirst(one, arts[0], false);
      side.appendChild(one);
      var pl = posSpan(arts[0].pos);
      if (pl) { nl(side); side.appendChild(pl); }
    } else if (arts.length) {
      var list = el('span', 'ordpar-option-glosses ordpar-option-nblist');
      list.lang = 'nb';
      side.appendChild(list);
      side.appendChild(el('span', 'ordpar-option-count ordpar-option-more'));
      g = { list: list, side: side, n: arts.length };
      g.fill = function (withPos) {
        list.textContent = '';
        list.removeAttribute('data-cut');
        arts.forEach(function (a, i) {
          var one = el('span', 'ordpar-option-gl');
          if (i) { one.appendChild(el('span', 'ordpar-gsep', ' \u00b7 ')); }
          nbFirst(one, a, !!shared[firstOf(a)]);
          var p = withPos && posSpan(a.pos);
          if (p) { one.appendChild(doc.createTextNode(' ')); one.appendChild(p); }
          list.appendChild(one);
        });
      };
      g.fill(true);
    }
    row.ordparFit = function (before) {
      if (before) { before(); }
      if (!g) { return; }
      g.fill(true);
      fitGlosses(g, arts.length);
      if (g.list.hasAttribute('data-cut')) { g.fill(false); fitGlosses(g, arts.length); }
    };
  }

  function englishEntryRow(tag, e, cls, rowClass, refit) {
    var row = englishRow(tag, { key: e.q, word: e.q, arts: [] }, cls, rowClass);
    var side = row.querySelector('.ordpar-option-side');
    var held = el('span', 'ordpar-option-glosses is-pending', '\u00a0');
    side.appendChild(held);
    var L = global.ordparLookup;
    if (!L || !L.englishLookup) { countSide(side, e.n); return row; }
    L.englishLookup(e.q).then(function (res) {
      if (!res || !res.count) { countSide(side, e.n); return; }
      englishSide(row, side, res.matches.map(function (m) { return m.article; }));
      row.ordparFit(refit);
    }, function () { countSide(side, e.n); });
    return row;
  }

  function countSide(side, n) {
    side.textContent = '';
    side.appendChild(el('span', 'ordpar-option-count',
      n === 1 ? t('results.countOne') : t('results.count', { n: n || 0 })));
  }

  function needsFill(e) { return e.n > 1 || !e.translated || !e.text || nbRows(); }
  function nbRows() {
    var L = global.ordparLookup;
    return !!(L && L.nbRows && L.nbRows());
  }
  function rowView(snips) {
    var L = global.ordparLookup;
    return L && L.rowView ? L.rowView(snips) : snips;
  }
  function rowLang(translated) { return translated && !nbRows() ? 'en' : 'nb'; }

  function searchRowSide(e) {
    var side = el('span', 'ordpar-option-side');
    var lookup = global.ordparLookup;
    if (lookup && lookup.lookup && lookup.loadSnippets && needsFill(e)) {
      var held = el('span', (e.n > 1 ? 'ordpar-option-glosses' : 'ordpar-option-gloss') + ' is-pending',
        '\u00a0');
      held.lang = (e.n > 1 || e.translated) && !nbRows() ? 'en' : 'nb';
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
        snips = rowView(snips || {});
        return { n: arts.length, list: arts.map(function (a) {
          var id = String(a.id);
          var text = a.translated ? glossText(snips, id) : (snips[id] || '');
          return { id: a.id, hg: a.hg || 0, translated: !!a.translated, head: a.word || '',
            text: text, lang: rowLang(a.translated),
            gloss: !!a.translated && glossIs(snips, id) };
        }) };
      });
    }).catch(function () { return null; });
  }

  function similarArticles(q) {
    var L = global.ordparLookup;
    return Promise.all([L.loadSnippets(L.snipKey(L.fold(q))), L.loadTranslated()]).then(function (r) {
      var snips = rowView(r[0] || {}), tr = r[1];
      var h = snips._h && Object.prototype.hasOwnProperty.call(snips._h, q) ? snips._h[q] : null;
      if (h == null) { return null; }
      var pairs = typeof h === 'number' ? [[h, 0]] : h;
      return { n: pairs.length, list: pairs.map(function (p) {
        var id = String(p[0]), on = !!(tr && tr.has(p[0]));
        return { id: p[0], hg: p[1] || 0, translated: on, head: q,
          text: on ? glossText(snips, id) : (snips[id] || ''), lang: rowLang(on),
          gloss: on && glossIs(snips, id) };
      }) };
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

  function sideGlosses(arts) {
    if (nbRows()) { arts = (arts || []).map(function (a) { return { hg: a.hg, translated: false, text: a.text }; }); }
    var en = (arts || []).filter(function (a) { return a.translated && a.text; })
      .map(function (a) { return { hg: a.hg || 0, text: a.text, gloss: !!a.gloss, lang: 'en' }; });
    if (en.length || (arts || []).some(function (a) { return a.translated; })) { return en; }
    return (arts || []).filter(function (a) { return a.text; })
      .map(function (a) { return { hg: a.hg || 0, text: a.text, gloss: false, lang: 'nb' }; });
  }

  function listedGlosses(articles, snips) {
    return sideGlosses(articles.map(function (a) {
      var id = String(a.id);
      var text = !snips ? '' : a.translated ? glossText(snips, id) : (snips[id] || '');
      return { hg: a.hg || 0, translated: !!a.translated, text: text,
               gloss: !!a.translated && !!text && glossIs(snips, id) };
    }));
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

  function fillSearchRow(side, e, refit, source) {
    var held = side && side.querySelector('.is-pending');
    if (!held) { return checkStored(side, e, refit); }
    var again = refit || function () {};
    return (source || historyArticles)(e.q).then(function (got) {
      if (got) {
        markTranslated(side.parentNode, got.list.some(function (a) { return a.translated; }));
      }
      if (e.n > 1 && (!got || got.n > 1)) {
        var shown = got ? sideGlosses(got.list) : [];
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
    var nb = shown.length && shown.every(function (s) { return s.lang === 'nb'; });
    if (nb) { g.list.lang = 'nb'; g.list.classList.add('ordpar-option-nblist'); }
    shown.forEach(function (s, i) {
      var one = el('span', 'ordpar-option-gl' + (s.gloss ? ' ordpar-sgloss' : ''));
      if (s.lang && s.lang !== 'en' && !nb) { one.lang = s.lang; }
      if (i) { one.appendChild(el('span', 'ordpar-gsep', ' \u00b7 ')); }
      if (s.hg) {
        var mark = el('span', 'ordbok-homograph ordpar-hg', ROMAN[s.hg] || String(s.hg));
        mark.setAttribute('aria-hidden', 'true');
        one.appendChild(mark);
        var said = el('span', 'ordpar-visually-hidden', t('results.homograph', { n: s.hg }));
        said.setAttribute('data-nosnippet', '');
        one.appendChild(said);
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
        var pos = (item.ids || []).length === 1 ? posSpan(item.pos) : null;
        if (pos) { main.appendChild(pos); }
        li.appendChild(main);
        li.appendChild(optionSide(item, glosses, li, i >= sec.start && i < sec.end));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); picked(i); submit(pickWord(item), false); });
        host.appendChild(li);
      });
      popup.hidden = items.length === 0;
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      popup.scrollTop = 0;
      fitHeight(popup);
      Array.prototype.forEach.call(optionRows(), function (li, i) { fitRow(li, items[i]); });
      fillGlosses(glosses);
    }

    function pickWord(item) { return item.line && item.line.length ? item.line[0].w : item.word; }

    function openEnglish(items) {
      listbox.textContent = '';
      ranked = [];
      options = items.map(function (it) { return { word: it.word, en: true }; });
      active = -1;
      recentHead.hidden = true;
      listbox.setAttribute('aria-label', t('search.suggestions'));
      items.forEach(function (it, i) {
        var li = englishRow('li', it, '');
        li.id = 'ordpar-option-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.addEventListener('mousedown', function (e) { e.preventDefault(); picked(i); submit(it.word, true); });
        listbox.appendChild(li);
      });
      popup.hidden = items.length === 0;
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      popup.scrollTop = 0;
      fitHeight(popup);
      fitEnglish();
    }
    function fitEnglish() {
      Array.prototype.forEach.call(optionRows(), function (li, i) {
        if (li.ordparFit) { li.ordparFit(function () { fitRow(li, options[i]); }); }
      });
    }

    var viewport = global.visualViewport || global;
    viewport.addEventListener('resize', function () {
      if (popup.hidden || doc.activeElement !== input) { return; }
      if (!recentHead.hidden) { fitHeight(popup); return; }
      if (options.length && options[0].en) { fitHeight(popup); fitEnglish(); return; }
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
        if (e.en) {
          var en = englishEntryRow('li', e, 'ordpar-option-recent', null, function () {
            if (mine === seq && en.parentNode === listbox) { fitRow(en, options[i]); }
          });
          en.id = 'ordpar-option-' + i;
          en.setAttribute('role', 'option');
          en.setAttribute('aria-selected', 'false');
          en.addEventListener('mousedown', function (ev) { ev.preventDefault(); submit(e.q, true); });
          listbox.appendChild(en);
          return;
        }
        var li = el('li', 'ordpar-option ordpar-option-recent' +
          (e.n === 1 && e.translated ? ' is-translated' : ''));
        li.id = 'ordpar-option-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.appendChild(searchRowMain(e));
        li.appendChild(searchRowSide(e));
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); submit(e.q, false); });
        listbox.appendChild(li);
      });
      popup.hidden = false;
      popup.scrollTop = 0;
      fitHeight(popup);
      input.setAttribute('aria-expanded', 'true');
      Array.prototype.forEach.call(listbox.children, function (li, i) { fitRow(li, options[i]); });
      Array.prototype.slice.call(listbox.children).forEach(function (li, i) {
        var item = options[i];
        if (item.recent.en) { return; }
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
        list.lang = rowLang(true);
        side.appendChild(list);
        pending.push({ list: list, side: side, word: item.word, n: ids.length,
          articles: item.articles || [], row: row, item: item });
        return side;
      }
      if (item.translated && ids.length === 1) {
        var gloss = el('span', 'ordpar-option-gloss is-pending', '\u00a0');
        gloss.lang = rowLang(true);
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
          snips = rowView(snips);
          todo.forEach(function (g) {
            if (g.key !== k || !snips) { return; }
            if (g.list) { glossList(g, snips); return; }
            var text = g.nb ? (snips[g.id] || '') : glossText(snips, g.id);
            if (text) {
              writeGloss(g.span, text, !g.nb && glossIs(snips, g.id));
              if (nbRows()) { g.span.lang = 'nb'; }
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
      event('pick', { typed: input.value, word: item.word, position: i + 1, en: !!item.en });
    }

    function touchFirst() {
      try { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
    }

    function submit(value, en) {
      var query = (value != null ? value : input.value).trim();
      close();
      if (!query) { return; }
      if (en == null) { en = englishOn(); }
      if (en !== englishOn()) { setDirection(en ? 'en' : 'nb', { quiet: true }); }
      input.value = query;
      if (touchFirst()) { input.blur(); }
      if (searchHandler) {
        searchHandler(query, en ? { en: true } : undefined);
        if (!touchFirst()) { input.focus(); }
      } else if (en) {
        global.location.href = lookup && lookup.englishUrl ? lookup.englishUrl(query)
          : base() + 'bm-en/#en=' + encodeURIComponent(query);
      } else if (lookup && lookup.searchAddress) {
        lookup.searchAddress(query).then(function (href) { global.location.href = href; });
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
      if (englishOn() && lookup.englishSuggest) {
        lookup.englishSuggest(value).then(function (items) {
          if (mine !== seq || doc.activeElement !== input) { return; }
          openEnglish(items);
        });
        return;
      }
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
            var o = options[active];
            submit(pickWord(o), o.en ? true : o.recent ? !!o.recent.en : false);
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
    syncIcons();
    notify('render', lang);
  }

  function event(name, data) {
    var E = global.ordparEvents;
    if (!E || !data) { return; }
    try {
      if (name === 'pick') { E.pick(data.typed, data.word, data.position, !!data.en); }
    } catch (e) {  }
  }

  var hintGuard = (function () {
    var pinned = null, touch = null, eat = false, eatTimer = null;
    function stopEating() {
      eat = false;
      if (eatTimer) { clearTimeout(eatTimer); eatTimer = null; }
    }
    function outside(e) {
      if (!pinned) { return false; }
      if (!doc.documentElement.contains(pinned.wrap)) { pinned = null; return false; }
      return !(e.target && e.target.nodeType && pinned.wrap.contains(e.target));
    }
    function shut() {
      var p = pinned;
      pinned = null; touch = null;
      try { p.close(); } catch (er) {  }
    }
    function swallow(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    if (global.addEventListener && doc) {
      global.addEventListener('pointerdown', function (e) {
        stopEating(); touch = null;
        if (!outside(e)) { return; }
        if (e.pointerType === 'touch') { touch = e.pointerId; return; }
        shut(); eat = true;
        e.stopImmediatePropagation();
      }, true);
      global.addEventListener('pointercancel', function (e) {
        if (touch === e.pointerId) { touch = null; }
      }, true);
      global.addEventListener('pointerup', function (e) {
        if (touch === null || touch !== e.pointerId) { return; }
        touch = null;
        if (!pinned) { return; }
        shut(); eat = true;
        eatTimer = setTimeout(stopEating, 800);
        swallow(e);
      }, true);
      global.addEventListener('touchend', function (e) {
        if (eat) { swallow(e); }
      }, { capture: true, passive: false });
      ['mousedown', 'mouseup', 'click', 'auxclick', 'contextmenu'].forEach(function (type) {
        global.addEventListener(type, function (e) {
          if (!eat) { return; }
          swallow(e);
          if (type === 'click' || type === 'auxclick') { stopEating(); }
        }, true);
      });
      global.addEventListener('keydown', stopEating, true);
    }
    return {
      pin: function (wrap, close) { pinned = { wrap: wrap, close: close }; },
      unpin: function (wrap) { if (pinned && pinned.wrap === wrap) { pinned = null; touch = null; } },
      isPinned: function (wrap) { return !!pinned && (!wrap || pinned.wrap === wrap); }
    };
  }());

  var shell = {
    t: t,
    hintGuard: hintGuard,
    has: has,
    lang: lang,
    getSetting: getSetting,
    savedSetting: savedSetting,
    popupAddress: popupAddress, copyText: copyText, wireCodeLines: wireCodeLines,
    SETTINGS: SETTINGS,
    colours: colours,
    setSetting: setSetting,
    resetSettings: resetSettings,
    applyAll: applyAll,
    KEYS: KEYS.slice(),
    deleteStoredData: deleteStoredData,
    onChange: function (fn) { listeners.push(fn); },
    searchRowMain: searchRowMain, searchRowSide: searchRowSide, fillSearchRow: fillSearchRow,
    sideGlosses: sideGlosses, similarArticles: similarArticles,
    direction: direction, setDirection: setDirection,
    layer: layer, eff: eff, nbWords: nbWords, equivHidden: equivHidden, visitSetting: visitSetting,
    syncIcons: syncIcons, posWords: posWords, posSpan: posSpan,
    englishRow: englishRow, englishEntryRow: englishEntryRow,
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
      wireCodeLines(doc);
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
