(function (global) {
  'use strict';

  var RECEIVER = '';

  var MAX_QUERY = 40;
  var VISIBLE_MS = 2000;
  var PATH = /^\/(?:bm-en\/(?:\d{1,7}\/)?|about\/|privacy\/|settings\/|favourites\/|history\/)?$/;
  var OTHER_PATH = '/other';
  var DIGIT = /[0-9²³¹¼-¾٠-٩۰-۹०-९０-９]/;
  try { DIGIT = new RegExp('\\p{N}', 'u'); } catch (e) {  }

  var nav = global.navigator || {};
  var doc = global.document;
  var STATS_KEY = 'stats';

  function optedOut() {
    if (typeof global.ordparRead === 'function') { return global.ordparRead(STATS_KEY) === 'off'; }
    try { return global.localStorage.getItem(STATS_KEY) === 'off'; } catch (e) { return false; }
  }

  function quiet() {
    if (!api.RECEIVER) { return 'off'; }
    if (nav.webdriver) { return 'webdriver'; }
    if (optedOut()) { return 'optout'; }
    if (nav.onLine === false) { return 'offline'; }
    if (nav.globalPrivacyControl === true) { return 'gpc'; }
    var dnt = nav.doNotTrack || global.doNotTrack || nav.msDoNotTrack;
    if (dnt === '1' || dnt === 'yes') { return 'dnt'; }
    if (typeof global.fetch !== 'function') { return 'nofetch'; }
    return '';
  }

  function cleanQuery(q) {
    var s = String(q == null ? '' : q).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (!s || DIGIT.test(s)) { return null; }
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0xdc00 || c > 0xdfff) { n++; }
    }
    return n > MAX_QUERY ? null : s;
  }

  function cleanPath(p) {
    return typeof p === 'string' && p.length <= 200 && PATH.test(p) ? p : OTHER_PATH;
  }

  function langOf(en) { return en ? 'en' : 'nb'; }

  function message(type, f) {
    f = f || {};
    if (type === 'view') { return { type: 'view', path: cleanPath(f.path) }; }
    if (type === 'install') { return { type: 'install' }; }
    var m = { type: type, query: f.query, lang: f.lang === 'en' ? 'en' : 'nb' };
    if (type === 'hit') { return m; }
    m.word = f.word == null ? null : String(f.word);
    m.position = f.position == null ? null : f.position;
    return m;
  }

  function send(type, fields) {
    if (api.quiet()) { return false; }
    try {
      global.fetch(api.RECEIVER, {
        method: 'POST',
        body: JSON.stringify(message(type, fields)),
        keepalive: true,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store'
      }).catch(function () {  });
      return true;
    } catch (e) { return false; }
  }


  var viewed = false;
  function view() {
    if (viewed || api.quiet() || !doc) { return; }
    var timer = null;
    var events = ['scroll', 'pointerdown', 'keydown'];
    function stop() {
      if (timer !== null) { global.clearTimeout(timer); timer = null; }
    }
    function fire() {
      if (viewed) { return; }
      if (doc.visibilityState && doc.visibilityState !== 'visible') { return; }
      viewed = true;
      stop();
      events.forEach(function (t) { global.removeEventListener(t, fire, true); });
      doc.removeEventListener('visibilitychange', watch);
      send('view', { path: (global.location && global.location.pathname) || '/' });
    }
    function watch() {
      stop();
      if (!viewed && (!doc.visibilityState || doc.visibilityState === 'visible') && !doc.prerendering) {
        timer = global.setTimeout(fire, VISIBLE_MS);
      }
    }
    events.forEach(function (t) { global.addEventListener(t, fire, { capture: true, passive: true }); });
    doc.addEventListener('visibilitychange', watch);
    if (doc.addEventListener && 'onprerenderingchange' in doc) { doc.addEventListener('prerenderingchange', watch); }
    watch();
  }


  var miss = null;
  function endMiss() {
    if (!miss) { return; }
    var q = miss.query, lang = miss.lang;
    miss = null;
    send('miss', { query: q, word: null, position: null, lang: lang });
  }

  var api = {
    RECEIVER: RECEIVER,
    MAX_QUERY: MAX_QUERY,
    VISIBLE_MS: VISIBLE_MS,
    quiet: quiet,
    cleanQuery: cleanQuery,
    cleanPath: cleanPath,
    message: message,
    view: view,
    install: function () { return send('install'); },
    hit: function (query, en) {
      endMiss();
      var q = cleanQuery(query);
      return q ? send('hit', { query: q, lang: langOf(en) }) : false;
    },
    missStart: function (query, en) {
      endMiss();
      var q = cleanQuery(query);
      if (q && !api.quiet()) { miss = { query: q, lang: langOf(en) }; }
    },
    missChoose: function (query, word, position, en) {
      var q = cleanQuery(query);
      if (!miss || miss.query !== q || miss.lang !== langOf(en)) { return false; }
      miss = null;
      return send('miss', { query: q, word: word, position: position, lang: langOf(en) });
    },
    missEnd: endMiss,
    pick: function (typed, word, position, en) {
      var q = cleanQuery(typed);
      return q ? send('pick', { query: q, word: word, position: position, lang: langOf(en) }) : false;
    }
  };

  if (doc && doc.addEventListener) {
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'hidden') { endMiss(); }
    });
  }
  if (global.addEventListener) { global.addEventListener('pagehide', endMiss); }

  global.ordparEvents = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  view();
}(typeof globalThis !== 'undefined' ? globalThis : this));
