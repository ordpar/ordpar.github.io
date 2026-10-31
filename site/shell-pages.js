try{
(function (global) {
  'use strict';

  var HISTORY_KEY = 'history';
  var FAV_KEY = 'favourites';
  var CAP = 100;
  var FAV_CAP = 5000;
  var RECENT = 8;
  var FORMAT = 'ordpar-personal';
  var VERSION = 2;
  var SETTING_KEYS = ['lang', 'theme', 'colour', 'xref', 'defs', 'mini', 'peek', 'infl', 'pframes', 'minihw', 'listview',
    'minicontent', 'nestminis', 'minispacing', 'minitext', 'miniscroll', 'minifetch', 'formulas', 'ety', 'suggestrows',
    'emph', 'subsenses', 'layout', 'examples', 'exeye', 'exlimit', 'exmore', 'stats',
    'labels', 'nbonly', 'nbequiv', 'nbrows', 'nbhover', 'nbicon'];


  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function isStr(s, max) { return typeof s === 'string' && s.length <= max; }

  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { return null; }
    if (!isInt(e.id) || e.id <= 0) { return null; }
    if (!isStr(e.word, 300) || !e.word) { return null; }
    var hg = e.hg == null ? 0 : e.hg;
    if (!isInt(hg) || hg < 0 || hg > 99) { return null; }
    var pos = e.pos == null ? '' : e.pos;
    if (!isStr(pos, 20)) { return null; }
    if (typeof e.translated !== 'boolean') { return null; }
    var snip = e.snip == null ? '' : e.snip;
    if (!isStr(snip, 400)) { return null; }
    if (e.drop != null && !isStr(e.drop, 400)) { return null; }
    if (typeof e.t !== 'number' || !isFinite(e.t) || e.t < 0) { return null; }
    var hgs = null;
    if (e.hgs != null) {
      if (!Array.isArray(e.hgs) || e.hgs.length < 2 || e.hgs.length > 3) { return null; }
      for (var i = 0; i < e.hgs.length; i++) {
        if (!isInt(e.hgs[i]) || e.hgs[i] < 0 || e.hgs[i] > 99) { return null; }
      }
      hgs = e.hgs.slice();
    }
    var out = { id: e.id, word: e.word, hg: hg, pos: pos, translated: e.translated, snip: snip, t: e.t };
    if (hgs) { out.hgs = hgs; }
    if (e.drop != null) { out.drop = e.drop; }
    return out;
  }

  function parseList(raw) {
    var data;
    if (raw == null || raw === '') { return []; }
    try { data = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(data)) { return []; }
    var out = [], seen = {};
    data.forEach(function (e) {
      var c = cleanEntry(e);
      if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
    });
    return out;
  }


  function searchKey(q) { return String(q == null ? '' : q).trim().toLowerCase(); }
  function entryKey(e) { return (e && e.en ? 'en\u0000' : '') + searchKey(e && e.q); }

  function cleanSearch(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { return null; }
    if (!isStr(e.q, 300)) { return null; }
    var q = e.q.trim();
    if (!q) { return null; }
    if (!isInt(e.n) || e.n < 1) { return null; }
    if (typeof e.t !== 'number' || !isFinite(e.t) || e.t < 0) { return null; }
    var out = { q: q, n: e.n, t: e.t };
    if (e.en === true) { out.en = true; return out; }
    if (e.n === 1) {
      if (!isStr(e.word, 300) || !e.word) { return null; }
      var hg = e.hg == null ? 0 : e.hg;
      if (!isInt(hg) || hg < 0 || hg > 99) { return null; }
      var pos = e.pos == null ? '' : e.pos;
      if (!isStr(pos, 20)) { return null; }
      if (typeof e.translated !== 'boolean') { return null; }
      var text = e.text == null ? '' : e.text;
      if (!isStr(text, 400)) { return null; }
      out.word = e.word; out.hg = hg; out.pos = pos; out.translated = e.translated; out.text = text;
    }
    return out;
  }

  function wordQuery(word) { return String(word).split(' / ')[0].replace(/ …$/, '').trim(); }

  function fromArticles(list) {
    var groups = Object.create(null), order = [];
    list.forEach(function (e) {
      var q = wordQuery(e.word);
      if (!q) { return; }
      var k = searchKey(q), g = groups[k];
      if (!g) { g = groups[k] = { ids: Object.create(null), n: 0, top: e }; order.push(k); }
      if (!g.ids[e.id]) { g.ids[e.id] = 1; g.n++; }
      if (e.t > g.top.t) { g.top = e; }
    });
    return order.map(function (k) {
      var g = groups[k], e = g.top;
      var s = { q: wordQuery(e.word), n: g.n, t: e.t };
      if (g.n === 1) {
        s.word = e.word; s.hg = e.hg; s.pos = e.pos; s.translated = e.translated;
        s.text = e.translated ? dropText(e) : '';
      }
      return s;
    }).sort(byTime);
  }

  function combineHistory(lists, cap) {
    var byKey = Object.create(null);
    lists.forEach(function (list) {
      list.forEach(function (e) {
        var k = entryKey(e);
        if (!byKey[k] || byKey[k].t < e.t) { byKey[k] = e; }
      });
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; }).sort(byTime)
      .slice(0, cap == null ? CAP : cap);
  }

  function parseHistory(raw) {
    var data;
    if (raw == null || raw === '') { return []; }
    try { data = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(data)) { return []; }
    var searches = [], old = [], seenId = {};
    data.forEach(function (e) {
      if (e && typeof e === 'object' && !Array.isArray(e) && Object.prototype.hasOwnProperty.call(e, 'q')) {
        var s = cleanSearch(e);
        if (s) { searches.push(s); }
        return;
      }
      var c = cleanEntry(e);
      if (c && !seenId[c.id]) { seenId[c.id] = 1; old.push(c); }
    });
    if (!old.length) {
      var out = [], seen = {};
      searches.forEach(function (s) {
        var k = entryKey(s);
        if (!seen[k]) { seen[k] = 1; out.push(s); }
      });
      return out.slice(0, CAP);
    }
    return combineHistory([searches, fromArticles(old)], CAP);
  }

  function addSearch(list, entry, cap) {
    var k = entryKey(entry);
    var out = list.filter(function (e) { return entryKey(e) !== k; });
    var at = 0;
    while (at < out.length && out[at].t > entry.t) { at++; }
    out.splice(at, 0, entry);
    return out.slice(0, cap == null ? CAP : cap);
  }

  function indexOf(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return i; } }
    return -1;
  }

  function addTo(list, entry, cap) {
    var out = list.filter(function (e) { return e.id !== entry.id; });
    out.unshift(entry);
    return out.slice(0, cap == null ? CAP : cap);
  }

  function removeFrom(list, id) { return list.filter(function (e) { return e.id !== id; }); }

  function byTime(a, b) { return b.t - a.t; }


  var listeners = [];

  function storage() { try { return global.localStorage || null; } catch (e) { return null; } }
  function readRaw(key) { try { var s = storage(); return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function writeRaw(key, value) {
    try { var s = storage(); if (!s) { return false; } s.setItem(key, value); return true; }
    catch (e) { return false; }
  }
  function dropRaw(key) { try { var s = storage(); if (s) { s.removeItem(key); } } catch (e) {  } }

  function load(key) { return key === HISTORY_KEY ? parseHistory(readRaw(key)) : parseList(readRaw(key)); }
  function save(key, list) {
    return list.length ? writeRaw(key, JSON.stringify(list)) : (dropRaw(key), true);
  }

  function notify(what) {
    listeners.slice().forEach(function (fn) { try { fn(what); } catch (e) {  } });
    refresh();
  }

  function now() { return Date.now(); }

  function stamp(fields, t) {
    var e = {
      id: Number(fields.id), word: String(fields.word || ''), hg: Number(fields.hg) || 0,
      pos: String(fields.pos || ''), translated: !!fields.translated,
      snip: String(fields.snip || ''), t: t == null ? now() : t
    };
    if (fields.drop != null) { e.drop = String(fields.drop); }
    if (Array.isArray(fields.hgs)) { e.hgs = fields.hgs.map(Number); }
    return cleanEntry(e);
  }

  function recordSearch(fields, t) {
    var f = fields || {};
    var e = { q: String(f.q == null ? '' : f.q).trim(), n: Number(f.n), t: t == null ? now() : t };
    if (f.en) { e.en = true; }
    else if (e.n === 1) {
      e.word = String(f.word || ''); e.hg = Number(f.hg) || 0; e.pos = String(f.pos || '');
      e.translated = !!f.translated; e.text = String(f.text == null ? '' : f.text);
    }
    e = cleanSearch(e);
    if (!e) { return false; }
    var ok = save(HISTORY_KEY, addSearch(load(HISTORY_KEY), e, CAP));
    notify('history');
    return ok;
  }

  function isFavourite(id) { return indexOf(load(FAV_KEY), Number(id)) !== -1; }

  function setFavourite(fields, on) {
    var list = load(FAV_KEY), id = Number(fields.id);
    if (on) {
      var e = stamp(fields);
      if (!e) { return false; }
      if (indexOf(list, id) === -1) { list = addTo(list, e, FAV_CAP); }
    } else {
      list = removeFrom(list, id);
    }
    save(FAV_KEY, list);
    notify('favourites');
    return isFavourite(id);
  }

  function toggleFavourite(fields) { return setFavourite(fields, !isFavourite(fields.id)); }

  function clearHistory() { dropRaw(HISTORY_KEY); notify('history'); }


  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function exportName(date) {
    date = date || new Date();
    return 'ordpar-' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + '.txt';
  }

  function makeExport(settings, history, favourites, when) {
    var s = {};
    SETTING_KEYS.forEach(function (k) {
      if (settings && typeof settings[k] === 'string') { s[k] = settings[k]; }
    });
    return {
      format: FORMAT, version: VERSION,
      exported: new Date(when == null ? now() : when).toISOString(),
      settings: s, history: history.slice(0, CAP), favourites: favourites.slice()
    };
  }

  function readImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.format !== FORMAT) {
      return { ok: false, error: 'format' };
    }
    if (!isInt(data.version) || data.version < 1) { return { ok: false, error: 'format' }; }
    if (data.version > VERSION) { return { ok: false, error: 'version' }; }
    var settings = data.settings == null ? {} : data.settings;
    if (typeof settings !== 'object' || Array.isArray(settings)) { return { ok: false, error: 'content' }; }
    var s = {};
    for (var i = 0; i < SETTING_KEYS.length; i++) {
      var k = SETTING_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(settings, k)) {
        if (!isStr(settings[k], 40)) { return { ok: false, error: 'content' }; }
        s[k] = settings[k];
      }
    }
    var lists = {};
    var names = ['history', 'favourites'];
    for (var n = 0; n < names.length; n++) {
      var raw = data[names[n]] == null ? [] : data[names[n]];
      if (!Array.isArray(raw)) { return { ok: false, error: 'content' }; }
      var searches = names[n] === 'history' && data.version >= 2;
      var out = [];
      for (var j = 0; j < raw.length; j++) {
        var c = searches ? cleanSearch(raw[j]) : cleanEntry(raw[j]);
        if (!c) { return { ok: false, error: 'content' }; }
        out.push(c);
      }
      lists[names[n]] = out;
    }
    var history = data.version >= 2 ? combineHistory([lists.history], CAP) : fromArticles(lists.history).slice(0, CAP);
    return { ok: true, data: { settings: s, history: history, favourites: lists.favourites } };
  }

  function mergeImport(current, data) {
    var fav = current.favourites.slice(), added = 0;
    data.favourites.forEach(function (e) {
      if (indexOf(fav, e.id) === -1) { fav.push(e); added++; }
    });
    fav.sort(byTime);
    var hist = combineHistory([current.history, data.history], CAP);
    var had = {};
    current.history.forEach(function (e) { had[searchKey(e.q)] = 1; });
    var newHist = hist.filter(function (e) { return !had[searchKey(e.q)]; }).length;
    return {
      settings: data.settings, history: hist, favourites: fav.slice(0, FAV_CAP),
      added: { favourites: added, history: newHist }
    };
  }

  function exportData(getSetting, when) {
    var s = {};
    SETTING_KEYS.forEach(function (k) {
      var v = getSetting ? getSetting(k) : readRaw(k);
      if (typeof v === 'string') { s[k] = v; }
    });
    return makeExport(s, load(HISTORY_KEY), load(FAV_KEY), when);
  }

  function importText(text) {
    var got = readImport(text);
    if (!got.ok) { return got; }
    if (!storage()) { return { ok: false, error: 'storage' }; }
    var before = {};
    [HISTORY_KEY, FAV_KEY].concat(SETTING_KEYS).forEach(function (k) { before[k] = readRaw(k); });
    var merged = mergeImport({ history: load(HISTORY_KEY), favourites: load(FAV_KEY) }, got.data);
    var ok = save(HISTORY_KEY, merged.history) && save(FAV_KEY, merged.favourites);
    Object.keys(merged.settings).forEach(function (k) { ok = ok && writeRaw(k, merged.settings[k]); });
    if (!ok) {
      Object.keys(before).forEach(function (k) {
        if (before[k] == null) { dropRaw(k); } else { writeRaw(k, before[k]); }
      });
      return { ok: false, error: 'storage' };
    }
    notify('import');
    return { ok: true, added: merged.added, settings: Object.keys(merged.settings).length };
  }


  function unit(e) { return (e.snip || '').split(' · ')[0]; }

  function dropText(e) { return e.drop ? e.drop : unit(e); }

  var HEART = 'M12 20.5s-7.2-4.4-9.4-8.6C1 8.8 2.6 5.2 6.1 5c2.3-.1 4.2 1.3 5.9 3.4C13.7 6.3 15.6 4.9 17.9 5c3.5.2 5.1 3.8 3.5 6.9-2.2 4.2-9.4 8.6-9.4 8.6z';

  function svgHeart(cls) {
    var doc = global.document;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var path = doc.createElementNS(ns, 'path');
    path.setAttribute('d', HEART);
    svg.appendChild(path);
    return svg;
  }

  var labels = { label: 'Favourite', saved: 'In favourites' };
  function setLabels(l) { for (var k in l) { if (l[k]) { labels[k] = l[k]; } } }

  function paintHeart(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', labels.label);
    btn.title = labels.label;
  }

  function heartButton(fields, cls) {
    var doc = global.document;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'ordpar-heart' + (cls ? ' ' + cls : '');
    btn.setAttribute('data-fav-id', String(fields.id));
    btn.appendChild(svgHeart('ordpar-heart-icon'));
    paintHeart(btn, isFavourite(fields.id));
    btn.addEventListener('click', function () { toggleFavourite(fields); });
    return btn;
  }

  function favMark(id) {
    var doc = global.document;
    var span = doc.createElement('span');
    span.className = 'ordpar-fav-mark';
    span.setAttribute('data-fav-mark', String(id));
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', labels.saved);
    span.appendChild(svgHeart('ordpar-heart-icon'));
    span.hidden = !isFavourite(id);
    return span;
  }

  function refresh(root) {
    var doc = global.document;
    if (!doc || !doc.querySelectorAll) { return; }
    var fav = {};
    load(FAV_KEY).forEach(function (e) { fav[e.id] = 1; });
    var scope = root || doc;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-fav-id]'), function (b) {
      paintHeart(b, !!fav[b.getAttribute('data-fav-id')]);
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-fav-mark]'), function (m) {
      m.hidden = !fav[m.getAttribute('data-fav-mark')];
    });
  }

  function fieldsFrom(node) {
    var g = function (k) { return node.getAttribute(k); };
    var snip = g('data-snip');
    if (snip == null) {
      var meta = node.ownerDocument && node.ownerDocument.querySelector('meta[name="description"]');
      snip = meta ? meta.getAttribute('content') : '';
    }
    var f = {
      id: Number(g('data-article-id')), word: g('data-word') || g('data-lemma') || '',
      hg: Number(g('data-hg')) || 0, pos: g('data-pos') || '',
      translated: g('data-translated') === '1', snip: snip || ''
    };
    if (node.hasAttribute('data-drop')) { f.drop = g('data-drop'); }
    if (node.hasAttribute('data-hgs')) { f.hgs = g('data-hgs').split(' ').map(Number); }
    return f;
  }

  function mountPage(l) {
    var doc = global.document, root = doc.documentElement;
    if (!root.getAttribute('data-article-id')) { return; }
    setLabels(l || {});
    var f = fieldsFrom(root);
    var ctl = doc.querySelector('.ordpar-card-foot .ordpar-result-controls');
    if (ctl && !ctl.querySelector('.ordpar-heart')) { ctl.appendChild(heartButton(f, 'ordpar-result-heart')); }
  }

  try {
    global.addEventListener('storage', function (ev) {
      if (!ev || ev.key == null || ev.key === HISTORY_KEY || ev.key === FAV_KEY) { notify('storage'); }
    });
  } catch (e) {  }

  var DIRECTION_KEY = 'direction';
  function direction() { return readRaw(DIRECTION_KEY) === 'en' ? 'en' : 'nb'; }
  function setDirection(d) {
    try {
      var s = storage();
      if (!s) { return false; }
      if (d === 'en') { s.setItem(DIRECTION_KEY, 'en'); } else { s.removeItem(DIRECTION_KEY); }
      return (s.getItem(DIRECTION_KEY) === 'en') === (d === 'en');
    } catch (e) { return false; }
  }

  var api = {
    DIRECTION_KEY: DIRECTION_KEY, direction: direction, setDirection: setDirection, entryKey: entryKey,
    HISTORY_KEY: HISTORY_KEY, FAV_KEY: FAV_KEY, CAP: CAP, RECENT: RECENT,
    FORMAT: FORMAT, VERSION: VERSION, SETTING_KEYS: SETTING_KEYS,
    cleanEntry: cleanEntry, parseList: parseList, addTo: addTo, removeFrom: removeFrom,
    searchKey: searchKey, cleanSearch: cleanSearch, parseHistory: parseHistory,
    fromArticles: fromArticles, addSearch: addSearch, combineHistory: combineHistory,
    makeExport: makeExport, exportName: exportName, readImport: readImport, mergeImport: mergeImport,
    history: function () { return load(HISTORY_KEY); },
    favourites: function () { return load(FAV_KEY); },
    recordSearch: recordSearch, isFavourite: isFavourite, setFavourite: setFavourite,
    toggleFavourite: toggleFavourite, clearHistory: clearHistory,
    exportData: exportData, importText: importText,
    onChange: function (fn) { listeners.push(fn); },
    unit: unit, dropText: dropText, setLabels: setLabels,
    heartButton: heartButton, favMark: favMark, refresh: refresh, fieldsFrom: fieldsFrom,
    mountPage: mountPage
  };
  global.ordparPersonal = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this));
}catch(e){setTimeout(function(){throw e;});}
try{
(function (global) {
  'use strict';

  var SPECIAL = { 'æ': 'ae', 'ø': 'oe', 'å': 'aa' };
  var KEEP = { 'æ': 1, 'ø': 1, 'å': 1 };
  var PLAIN = /[^\x00-\x7fæøå]/;
  var MARKS = /^[\u0300-\u036f]+$/;
  var MISC = 'misc';
  var SPLIT = { b: 1, f: 1, k: 1, s: 1, t: 1 };
  var MAX_QUERY = 200;
  var MAX_WORDS = 20;
  var MAX_WORD_LEN = 40;

  var config = {
    base: (global.ORDPAR_BASE || '/'),
    maxSuggestions: 20,
    similarCount: 5,
    similarPer: 3
  };

  var shards = {};
  var pending = {};
  var headwords = {};
  var headwordsPending = {};
  var tails = {};
  var tailsPending = {};
  var translated = null;
  var translatedList = null;
  var translatedPending = null;
  var randomList = null;
  var randomPending = null;


  function defaultLoader(name) {
    return fetch(config.base + 'index/' + name, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  var loader = defaultLoader;

  function setLoader(fn) { loader = fn || defaultLoader; }

  function configure(opts) {
    for (var k in (opts || {})) { config[k] = opts[k]; }
    return config;
  }


  function fold(s) {
    return (s == null ? '' : String(s)).normalize('NFC').toLowerCase();
  }

  function bareChar(c) {
    if (c < '\x80' || KEEP[c]) { return c; }
    var d = c.normalize('NFD');
    if (d.length > 1 && d.charAt(0) >= 'a' && d.charAt(0) <= 'z' && MARKS.test(d.slice(1))) {
      return d.charAt(0);
    }
    return c;
  }

  function bare(s) {
    var f = fold(s);
    if (!PLAIN.test(f)) { return f; }
    var out = '';
    for (var i = 0; i < f.length; i++) { out += bareChar(f.charAt(i)); }
    return out;
  }

  function accentMatch(q, w) {
    if (w.length < q.length) { return false; }
    for (var i = 0; i < q.length; i++) {
      var a = q.charAt(i), b = w.charAt(i);
      if (a !== b && a !== bareChar(b)) { return false; }
    }
    return true;
  }

  function charKey(c) {
    if (!c) { return MISC; }
    if (c >= 'a' && c <= 'z') { return c; }
    if (SPECIAL[c]) { return SPECIAL[c]; }
    return MISC;
  }

  function letterKey(s) { return charKey(bare(s).charAt(0)); }

  function shardKey(s) {
    var f = bare(s), key = charKey(f.charAt(0));
    if (!SPLIT[key]) { return key; }
    return key + '-' + charKey(f.charAt(1));
  }

  function suggestKey(s) {
    var f = fold(s);
    if (f.length === 1 && SPLIT[letterKey(f)]) { return letterKey(f) + '-top'; }
    return shardKey(f);
  }

  function tailKey(s) { var b = bare(s); return charKey(b.charAt(1)) + '-' + charKey(b.charAt(2)); }
  function remainderKey(s) { return charKey(s.charAt(0)) + '-' + charKey(s.charAt(1)); }
  function snipKey(s) {
    var b = bare(s);
    return charKey(b.charAt(0)) + '-' + charKey(b.charAt(1)) + '-' + charKey(b.charAt(2));
  }

  var RULES = [
    ['hv', 'k', 'start', ''], ['hv', 'v', 'start', ''], ['k', 'hv', 'start', ''], ['v', 'hv', 'start', ''],
    ['kv', 'hv', 'start', ''], ['hv', 'kv', 'start', ''],
    ['kj', 'sj', 'any', 's'], ['kj', 'skj', 'any', 's'], ['sj', 'kj', 'any', ''],
    ['sj', 'skj', 'any', ''], ['skj', 'kj', 'any', ''], ['skj', 'sj', 'any', ''],
    ['tj', 'kj', 'start', ''], ['kj', 'tj', 'start', ''],
    ['gj', 'hj', 'start', ''], ['gj', 'j', 'start', ''], ['hj', 'gj', 'start', ''],
    ['hj', 'j', 'start', ''], ['j', 'gj', 'start', ''], ['j', 'hj', 'start', ''],
    ['aa', 'å', 'all', ''], ['å', 'aa', 'all', ''], ['ae', 'æ', 'all', ''],
    ['æ', 'ae', 'all', ''], ['oe', 'ø', 'all', ''], ['ø', 'oe', 'all', ''],
    ['æ', 'eg', 'end', ''], ['eg', 'æ', 'end', ''],
    ['æ', 'e', 'inner', ''], ['e', 'æ', 'inner', ''],
    ['c', 'k', 'any', ''], ['c', 's', 'any', ''], ['ph', 'f', 'any', ''],
    ['th', 't', 'any', ''], ['x', 'ks', 'any', ''], ['qu', 'kv', 'any', '']
  ];
  var DOUBLING = 'bdfgklmnprstv';
  var MAX_REWRITES = 40;
  var WORD_EDGE = ' -';

  function overlaps(i, j, spans) {
    for (var k = 0; k < spans.length; k++) {
      if (i < spans[k][1] && spans[k][0] < j) { return true; }
    }
    return false;
  }

  function rewriteOnce(q, avoid) {
    var out = [], n = q.length, i, j, p;
    avoid = avoid || [];
    for (var k = 0; k < RULES.length; k++) {
      var frm = RULES[k][0], to = RULES[k][1], where = RULES[k][2], notAfter = RULES[k][3];
      var L = frm.length, T = to.length;
      if (where === 'all') {
        var pos = [];
        i = q.indexOf(frm);
        while (i !== -1) { pos.push(i); i = q.indexOf(frm, i + L); }
        if (!pos.length) { continue; }
        var clash = false;
        for (p = 0; p < pos.length; p++) { if (overlaps(pos[p], pos[p] + L, avoid)) { clash = true; } }
        if (!clash) {
          var spans = [];
          for (p = 0; p < pos.length; p++) { spans.push([pos[p] + p * (T - L), pos[p] + p * (T - L) + T]); }
          out.push([q.split(frm).join(to), spans]);
        }
        continue;
      }
      i = q.indexOf(frm);
      while (i !== -1) {
        var ok = !(notAfter && i > 0 && q.charAt(i - 1) === notAfter);
        if (where === 'start' && i > 0 && WORD_EDGE.indexOf(q.charAt(i - 1)) === -1) { ok = false; }
        if (where === 'end' && i + L < n && WORD_EDGE.indexOf(q.charAt(i + L)) === -1) { ok = false; }
        if (where === 'inner' && (i + L >= n || WORD_EDGE.indexOf(q.charAt(i + L)) !== -1)) { ok = false; }
        if (ok && avoid.length && overlaps(i, i + L, avoid)) { ok = false; }
        if (ok) { out.push([q.slice(0, i) + to + q.slice(i + L), [[i, i + T]]]); }
        i = q.indexOf(frm, i + 1);
      }
    }
    i = 0;
    while (i < n) {
      var c = q.charAt(i);
      j = i;
      while (j < n && q.charAt(j) === c) { j++; }
      if (DOUBLING.indexOf(c) !== -1 && !(avoid.length && overlaps(i, j, avoid))) {
        if (j - i === 1) { out.push([q.slice(0, i) + c + q.slice(i), [[i, i + 2]]]); }
        else if (j - i === 2) { out.push([q.slice(0, i) + q.slice(i + 1), [[i, i + 1]]]); }
      }
      i = j;
    }
    return out;
  }

  function rewrites(q) {
    var seen = Object.create(null), res = [], singles = [], i, k, r;
    seen[q] = 1;
    var once = rewriteOnce(q, null);
    for (i = 0; i < once.length; i++) {
      r = once[i][0];
      if (r && !seen[r]) { seen[r] = 1; res.push(r); singles.push(once[i]); }
    }
    for (i = 0; i < singles.length && res.length < MAX_REWRITES; i++) {
      var two = rewriteOnce(singles[i][0], singles[i][1]);
      for (k = 0; k < two.length; k++) {
        r = two[k][0];
        if (r && !seen[r]) { seen[r] = 1; res.push(r); }
      }
    }
    return res.slice(0, MAX_REWRITES);
  }

  function caseDistance(q, w) {
    q = String(q).normalize('NFC'); w = String(w).normalize('NFC');
    var n = 0, m = Math.min(q.length, w.length);
    for (var i = 0; i < m; i++) {
      var a = q.charAt(i), b = w.charAt(i);
      if (a.toLowerCase() !== a.toUpperCase() && b.toLowerCase() !== b.toUpperCase() &&
          (a !== a.toLowerCase()) !== (b !== b.toLowerCase())) { n++; }
    }
    return n;
  }

  function guard(q) {
    var s = (q == null ? '' : String(q)).trim();
    if (!s) { return { ok: false, reason: 'empty' }; }
    if (s.length > MAX_QUERY) { s = s.slice(0, MAX_QUERY); }
    var words = s.split(/\s+/);
    if (words.length > MAX_WORDS) { return { ok: false, reason: 'tooManyWords' }; }
    for (var i = 0; i < words.length; i++) {
      if (words[i].length > MAX_WORD_LEN) { return { ok: false, reason: 'wordTooLong' }; }
    }
    return { ok: true, query: s };
  }

  function prepare(key, raw) {
    var shard = raw || { k: key, heads: {}, forms: {}, words: {} };
    shard.foldedHeads = foldMap(shard.heads);
    shard.foldedForms = foldMap(shard.forms);
    var hex = shard.n || '', band = Object.create(null);
    Object.keys(shard.heads).sort().forEach(function (w, i) {
      band[w] = i < hex.length ? parseInt(hex.charAt(i), 16) : 0;
    });
    shard.headList = Object.keys(shard.heads).map(function (w) {
      return { w: w, f: fold(w), b: bare(w), n: band[w] };
    }).sort(function (a, b) { return a.f < b.f ? -1 : (a.f > b.f ? 1 : 0); });
    var pflags = shard.p || '';
    shard.pages = Object.create(null);
    if (pflags) {
      Object.keys(shard.heads).sort().forEach(function (w, i) {
        if (pflags.charAt(i) === '1') { shard.pages[fold(w)] = 1; }
      });
    }
    (shard.pf || []).forEach(function (w) { shard.pages[fold(w)] = 1; });
    return shard;
  }

  function foldMap(map) {
    var out = Object.create(null);
    for (var form in map) {
      var f = bare(form);
      (out[f] || (out[f] = [])).push(form);
    }
    return out;
  }

  function loadShard(key) {
    if (shards[key]) { return Promise.resolve(shards[key]); }
    if (pending[key]) { return pending[key]; }
    pending[key] = Promise.resolve(loader(key + '.json')).then(function (raw) {
      shards[key] = prepare(key, raw);
      delete pending[key];
      return shards[key];
    });
    return pending[key];
  }

  var ROW_CODES = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function similarEntries(data) {
    if (!data) { return []; }
    var list = Array.isArray(data) ? data : (data.w || []);
    var bands = Array.isArray(data) ? '' : (data.f || '');
    var pages = Array.isArray(data) ? '' : (data.p || '');
    var arts = Array.isArray(data) ? '' : (data.a || '');
    var trs = Array.isArray(data) ? '' : (data.x || '');
    var kinds = Array.isArray(data) ? '' : (data.k || '');
    var kc = (!Array.isArray(data) && data.kc) || [];
    var out = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
      var code = ROW_CODES.indexOf(kinds.charAt(i));
      out[i] = { w: list[i], f: fold(list[i]), b: bare(list[i]),
                 n: i < bands.length ? parseInt(bands.charAt(i), 16) : 0,
                 p: pages.charAt(i) === '1',
                 c: i < arts.length ? parseInt(arts.charAt(i), 16) : null,
                 x: trs.charAt(i) === '1',
                 k: code >= 0 && code < kc.length ? kc[code] : '' };
    }
    return out;
  }

  function loadHeadwords(letter) {
    if (headwords[letter]) { return Promise.resolve(headwords[letter]); }
    if (headwordsPending[letter]) { return headwordsPending[letter]; }
    headwordsPending[letter] = Promise.resolve(loader('headwords/' + letter + '.json')).then(function (data) {
      var entries = similarEntries(data);
      var buckets = Object.create(null);
      for (var i = 0; i < entries.length; i++) {
        var c = entries[i].b.charAt(0);
        (buckets[c] || (buckets[c] = [])).push(entries[i]);
      }
      headwords[letter] = { list: entries.map(function (e) { return e.w; }), buckets: buckets,
                            byBare: Object.create(null) };
      delete headwordsPending[letter];
      return headwords[letter];
    });
    return headwordsPending[letter];
  }

  function loadTails(key) {
    if (tails[key]) { return Promise.resolve(tails[key]); }
    if (tailsPending[key]) { return tailsPending[key]; }
    tailsPending[key] = Promise.resolve(loader('tails/' + key + '.json')).then(function (data) {
      tails[key] = similarEntries(data);
      delete tailsPending[key];
      return tails[key];
    });
    return tailsPending[key];
  }

  var snippets = {};
  var snippetsPending = {};
  function loadSnippets(key) {
    if (snippets[key]) { return Promise.resolve(snippets[key]); }
    if (snippetsPending[key]) { return snippetsPending[key]; }
    snippetsPending[key] = Promise.resolve(loader('snip/' + key + '.json')).then(function (data) {
      snippets[key] = data || {};
      delete snippetsPending[key];
      return snippets[key];
    });
    return snippetsPending[key];
  }

  function isGloss(snips, id) {
    var g = snips && snips._g;
    if (!g || !g.length) { return false; }
    if (!snips.__gset) {
      var set = Object.create(null);
      for (var i = 0; i < g.length; i++) { set[String(g[i])] = 1; }
      try { Object.defineProperty(snips, '__gset', { value: set }); } catch (e) { snips.__gset = set; }
    }
    return !!snips.__gset[String(id)];
  }

  function nbDef(snips, id) {
    if (!snips || !snips._n) { return ''; }
    id = String(id);
    if (Object.prototype.hasOwnProperty.call(snips._n, id)) { return snips._n[id] || ''; }
    return snips[id] || '';
  }
  function nbRows() {
    var S = global.ordparShell, L = S && S.layer ? S.layer() : null;
    return !!(L && L.hidden && L.rows === 'nbdef');
  }
  function rowView(snips) {
    if (!snips || !nbRows()) { return snips; }
    if (snips.__nbview) { return snips.__nbview; }
    var v = {}, k;
    for (k in snips) {
      if (Object.prototype.hasOwnProperty.call(snips, k) && /^\d+$/.test(k)) {
        var text = nbDef(snips, k);
        if (text) { v[k] = text; }
      }
    }
    if (snips._h) { v._h = snips._h; }
    v._n = snips._n || {};
    try { Object.defineProperty(snips, '__nbview', { value: v }); } catch (e) { snips.__nbview = v; }
    return v;
  }

  var GLOSS_CLASS = 'ordpar-sgloss';
  var SEP_CLASS = 'ordpar-gsep';

  function appendGlossText(node, text) {
    var doc = node.ownerDocument;
    String(text).split(' · ').forEach(function (part, i) {
      if (i) {
        var sep = node.appendChild(doc.createElement('span'));
        sep.className = SEP_CLASS;
        sep.textContent = ' · ';
      }
      if (part) { node.appendChild(doc.createTextNode(part)); }
    });
  }

  function writeGloss(node, text, gloss) {
    node.textContent = '';
    if (gloss) {
      node.classList.add(GLOSS_CLASS);
      appendGlossText(node, text);
    } else {
      node.classList.remove(GLOSS_CLASS);
      node.textContent = text;
    }
  }

  function loadTranslated() {
    if (translated) { return Promise.resolve(translated); }
    if (translatedPending) { return translatedPending; }
    translatedPending = Promise.resolve(loader('translated.json')).then(function (list) {
      translatedList = list || [];
      translated = new Set(translatedList);
      translatedPending = null;
      return translated;
    });
    return translatedPending;
  }


  function article(shard, id, form) {
    var w = shard.words[String(id)] || ['', 0, ''];
    var a = {
      id: id,
      word: w[0],
      hg: formHg(w, form),
      pos: w[2] || '',
      translated: translated ? translated.has(id) : null
    };
    if (Array.isArray(w[1])) { a.hgs = w[1].slice(); }
    return a;
  }

  var SEP = ' / ';

  function formHg(w, form) {
    var hg = w[1];
    if (!Array.isArray(hg)) { return hg || 0; }
    var forms = String(w[0] || '').replace(/ …$/, '').split(SEP);
    var i = form == null ? -1 : forms.indexOf(form);
    if (i >= 0 && i < hg.length) { return hg[i] || 0; }
    for (var k = 0; k < hg.length; k++) { if (hg[k]) { return hg[k]; } }
    return 0;
  }

  function headParts(word, hg, hgs) {
    var text = String(word == null ? '' : word), cut = / …$/.test(text);
    var forms = text.replace(/ …$/, '').split(SEP);
    var list = Array.isArray(hgs) && hgs.length ? hgs : null;
    return {
      parts: forms.map(function (f, i) { return { w: f, hg: list ? (list[i] || 0) : (hg || 0) }; }),
      cut: cut
    };
  }

  function headText(word, hg, hgs) {
    var h = headParts(word, hg, hgs);
    return h.parts.map(function (p) { return p.w + (p.hg ? ' ' + roman(p.hg) : ''); }).join(', ')
      + (h.cut ? ' …' : '');
  }

  function homographRank(a) { return !a.hg ? 0 : (a.pos === 'VERB' ? 1 : 2); }
  function homographOrder(a, b) {
    return (homographRank(a) - homographRank(b)) || (a.hg - b.hg) || (a.id - b.id);
  }

  function resultOrder(a, b) {
    return ((b.translated ? 1 : 0) - (a.translated ? 1 : 0)) || homographOrder(a, b);
  }

  function group(shard, foldedMap, sourceMap, folded, matched) {
    var forms = (foldedMap[bare(folded)] || []).filter(function (form) {
      return accentMatch(folded, fold(form));
    }).sort();
    return forms.map(function (form) {
      var articles = (sourceMap[form] || []).map(function (id) {
        var a = article(shard, id, matched ? form : null);
        var w = shard.words[String(id)];
        if (matched && w && w[3]) { a.word = form; delete a.hgs; }
        return a;
      });
      if (matched) { articles.sort(resultOrder); }
      return { form: form, articles: articles };
    });
  }

  function lookup(q) {
    var g = guard(q);
    if (!g.ok) { return Promise.resolve({ query: q, folded: '', heads: [], forms: [], count: 0, guard: g.reason }); }
    var folded = fold(g.query);
    return Promise.all([loadShard(shardKey(folded)), loadTranslated()]).then(function (r) {
      var shard = r[0];
      var heads = group(shard, shard.foldedHeads, shard.heads, folded, true);
      var forms = group(shard, shard.foldedForms, shard.forms, folded, false);
      var seen = Object.create(null);
      heads.concat(forms).forEach(function (grp) {
        if (fold(grp.form) === folded) { grp.articles.forEach(function (a) { seen[a.id] = 1; }); }
      });
      var dedupe = function (groups) {
        return groups.filter(function (grp) {
          if (fold(grp.form) === folded) { return true; }
          grp.articles = grp.articles.filter(function (a) { return !seen[a.id]; });
          grp.articles.forEach(function (a) { seen[a.id] = 1; });
          return grp.articles.length > 0;
        });
      };
      heads = dedupe(heads);
      forms = dedupe(forms);
      var count = 0;
      heads.concat(forms).forEach(function (grp) { count += grp.articles.length; });
      var res = { query: g.query, folded: folded, heads: heads, forms: forms, count: count };
      if (!forms.length || !shard.t) { return res; }
      return loadLabels().then(function (table) {
        forms.forEach(function (grp) {
          grp.articles.forEach(function (a) {
            var c = labelCode(shard, grp.form, a.id);
            a.label = (c && table && table[c]) || '';
            a.labelNb = (c && table && table._nb && table._nb[c]) || '';
          });
        });
        return res;
      });
    });
  }

  function completions(shard, p, typed) {
    var bp = bare(p), hits = [];
    for (var i = 0; i < shard.headList.length; i++) {
      var h = shard.headList[i];
      if (h.b.lastIndexOf(bp, 0) === 0 && accentMatch(p, h.f)) {
        hits.push({ w: h.w, f: h.f, b: h.b, n: h.n, shard: shard });
      }
    }
    hits.forEach(function (h) {
      h.later = h.b.length > p.length && h.f.slice(0, p.length) !== p ? 1 : 0;
      h.cd = caseDistance(typed, h.w);
    });
    hits.sort(function (a, b) {
      return (a.later - b.later) || (a.w.length - b.w.length) || (a.cd - b.cd) ||
        (a.f < b.f ? -1 : a.f > b.f ? 1 : 0) || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0);
    });
    hits.forEach(function (h, i) { h.at = i; });
    return hits;
  }

  function suggestRank(h, b) {
    if (h.b === b) { return 0; }
    if (h.later) { return 4; }
    if (h.w.indexOf(' ') !== -1) { return 3; }
    return h.translated ? 1 : 2;
  }
  function rankSuggestions(hits, b) {
    hits.forEach(function (h) { h.rank = suggestRank(h, b); });
    return hits.sort(function (x, y) {
      return (x.rank - y.rank) ||
        ((x.rank === 1 || x.rank === 2) ? (y.n - x.n) : 0) || (x.at - y.at);
    });
  }

  function suggestQuery(prefix) {
    var raw = prefix == null ? '' : String(prefix);
    var g = guard(raw);
    if (!g.ok) { return null; }
    return { query: g.query.replace(/\s+/g, ' '), trailing: /\s$/.test(raw) };
  }

  function suggest(prefix, limit) {
    var sq = suggestQuery(prefix);
    if (!sq) { return Promise.resolve([]); }
    var p = fold(sq.query);
    limit = limit || config.maxSuggestions;
    var loads = [loadShard(suggestKey(p)), loadTranslated()];
    if (sq.trailing) { loads.push(loadShard(shardKey(p + ' '))); }
    var mark = function (h) {
      h.ids = h.shard.heads[h.w] || [];
      h.translated = h.ids.some(function (id) { return translated.has(id); });
      return h;
    };
    return Promise.all(loads).then(function (r) {
      var bp = bare(p);
      var hits = rankSuggestions(completions(r[0], p, sq.query).map(mark), bp);
      if (sq.trailing) {
        var seen = Object.create(null), merged = [];
        var add = function (h) { if (!seen[h.w]) { seen[h.w] = 1; merged.push(h); } };
        hits.forEach(function (h) { if (h.b === bp) { add(h); } });
        completions(r[2], p + ' ', sq.query + ' ').map(mark).forEach(add);
        hits.forEach(add);
        hits = merged;
      }
      return mergeArticles(hits).slice(0, limit).map(function (h) {
        var one = h.ids.length === 1 ? h.shard.words[String(h.ids[0])] : null;
        var item = { word: h.w, ids: h.ids, translated: h.translated, pos: (one && one[2]) || '' };
        if (one) {
          item.line = typedLine(one, h.forms, p);
        } else {
          item.articles = h.ids.map(function (id) { return article(h.shard, id, h.w); }).sort(resultOrder);
        }
        return item;
      });
    });
  }

  function mergeArticles(hits) {
    var byId = Object.create(null), out = [];
    hits.forEach(function (h) {
      if (h.ids.length !== 1) { out.push(h); return; }
      var id = h.ids[0], row = byId[id];
      if (row) { row.forms.push(h.w); return; }
      byId[id] = h;
      h.forms = [h.w];
      out.push(h);
    });
    return out;
  }

  function suggestSections(items, typed) {
    var raw = typed == null ? '' : String(typed);
    var sq = suggestQuery(raw);
    var bq = sq ? bare(fold(sq.query)) : null;
    var exact = function (it) { return bq !== null && bare(fold(it.word)) === bq; };
    var rows = (items || []).slice();
    var trailing = !!(sq && sq.trailing);
    if (trailing) {
      var ex = [], tr = [], no = [];
      rows.forEach(function (it) { (exact(it) ? ex : it.translated ? tr : no).push(it); });
      rows = ex.concat(tr, no);
    }
    var start = -1, end = -1;
    for (var i = 0; i < rows.length; i++) {
      var it = rows[i];
      var nb = !it.translated && !exact(it) && (trailing || it.word.indexOf(' ') === -1);
      if (start < 0) { if (nb) { start = i; } }
      else if (!nb) { end = i; break; }
    }
    if (start >= 0 && end < 0) { end = rows.length; }
    return { rows: rows, start: start, end: end };
  }

  function headLine(one, forms, p) {
    var bp = bare(p);
    var matches = function (w) { return bare(w).lastIndexOf(bp, 0) === 0 && accentMatch(p, fold(w)); };
    var text = one[0] || '', cut = / …$/.test(text);
    var shown = one[3] ? forms.slice() : text.replace(/ …$/, '').split(SEP);
    forms.forEach(function (w) { if (shown.indexOf(w) === -1) { shown.push(w); } });
    var line = shown.filter(Boolean).map(function (w) { return { w: w, match: matches(w) }; });
    if (cut && !one[3]) { line.push({ w: '\u2026', match: false }); }
    return line;
  }

  function typedLine(one, forms, p) {
    var line = headLine(one, forms, p), pick = null;
    for (var i = 0; i < line.length; i++) { if (line[i].match) { pick = line[i].w; break; } }
    if (pick == null) { pick = forms[0]; }
    return [{ w: pick, match: true, hg: formHg(one, pick) }];
  }

  function distance(a, b, cutoff) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > cutoff) { return cutoff + 1; }
    var prev2 = null, prev = new Array(lb + 1), cur = new Array(lb + 1), i, j;
    for (j = 0; j <= lb; j++) { prev[j] = j; }
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        cur[j] = v;
        if (v < rowMin) { rowMin = v; }
      }
      if (rowMin > cutoff) { return cutoff + 1; }
      prev2 = prev; prev = cur; cur = prev2.slice();
    }
    return prev[lb];
  }

  function charCounts(s) {
    var out = Object.create(null);
    for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); out[ch] = (out[ch] || 0) + 1; }
    return out;
  }
  function bagDistance(counts, n, w) {
    var seen = Object.create(null), extra = 0;
    for (var i = 0; i < w.length; i++) {
      var ch = w.charAt(i), k = (seen[ch] || 0) + 1;
      seen[ch] = k;
      if (k > (counts[ch] || 0)) { extra++; }
    }
    return Math.max(extra, n - (w.length - extra));
  }

  function letterLimit(n) { return Math.max(1, Math.floor(n / config.similarPer)); }
  function wordLimit(n) { return Math.floor(n / config.similarPer); }
  function wordsLimit(m) { return Math.max(1, Math.floor(m / config.similarPer)); }

  function sameWord(a, b) {
    if (a === b) { return true; }
    var lim = wordLimit(a.length);
    return lim > 0 && distance(a, b, lim) <= lim;
  }

  function sharedWords(qw, cw) {
    var k = cw.length, prev = new Array(k + 1), cur, i, j;
    for (j = 0; j <= k; j++) { prev[j] = 0; }
    for (i = 0; i < qw.length; i++) {
      cur = new Array(k + 1); cur[0] = 0;
      for (j = 1; j <= k; j++) {
        cur[j] = sameWord(qw[i], cw[j - 1]) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return prev[k];
  }

  function cmpStr(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }

  function bucketByBare(file, c) {
    var m = file.byBare[c];
    if (!m) {
      m = file.byBare[c] = Object.create(null);
      var b = file.buckets[c] || [];
      for (var i = 0; i < b.length; i++) { (m[b[i].b] || (m[b[i].b] = [])).push(b[i]); }
    }
    return m;
  }

  function similar(q, n, wide) {
    wide = wide !== false;
    var g = guard(q);
    if (!g.ok) { return Promise.resolve([]); }
    var fq = fold(g.query), f = bare(fq);
    n = n || config.similarCount;
    var lim = letterLimit(f.length);
    var qw = f.split(/\s+/), m = qw.length;
    var wlim = m > 1 ? wordsLimit(m) : -1;
    var rw = wide ? rewrites(f) : [];
    var own = shardKey(f);
    var widen = !!wide && f.length > 1;
    var loads = [loadHeadwords(letterKey(f))];
    if (widen) {
      loads.push(loadTails(remainderKey(f.slice(1))), loadTails(remainderKey(f)),
        loadHeadwords(letterKey(f.slice(1))));
    }
    var needShard = false;
    rw.forEach(function (r) {
      loads.push(loadHeadwords(letterKey(r)));
      if (shardKey(r) === own) { needShard = true; }
    });
    var shardP = needShard ? loadShard(own) : Promise.resolve(null);
    return Promise.all([Promise.all(loads), shardP]).then(function (res) {
      var files = res[0], shard = res[1];
      var cands = Object.create(null), list = [];
      var keep = function (e, wd, d) {
        var c = cands[e.w];
        if (!c) {
          c = cands[e.w] = { wd: wd, dist: d, cd: caseDistance(g.query, e.w),
            first: e.b.charAt(0) === f.charAt(0) ? 0 : 1,
            band: e.n, gap: Math.abs(e.b.length - f.length), f: e.f, word: e.w, page: !!e.p,
            count: e.c == null ? null : e.c, tr: !!e.x, pos: e.k || '' };
          list.push(c);
        } else {
          if (wd < c.wd) { c.wd = wd; }
          if (d < c.dist) { c.dist = d; }
        }
      };
      var pool = (files[0].buckets[f.charAt(0)] || []);
      if (widen) {
        pool = pool.concat(files[1], files[2], files[3].buckets[f.charAt(1)] || []);
      }
      var qc = charCounts(f), qn = f.length, bags = Object.create(null);
      var bagOf = function (bw) {
        var b = bags[bw];
        if (b === undefined) { b = bags[bw] = bagDistance(qc, qn, bw); }
        return b;
      };
      var seen = Object.create(null);
      for (var i = 0; i < pool.length; i++) {
        var cand = pool[i];
        if (seen[cand.w]) { continue; }
        seen[cand.w] = 1;
        if (cand.b === f && accentMatch(fq, cand.f)) { continue; }
        var gap = Math.abs(cand.b.length - f.length);
        var d = gap <= lim && bagOf(cand.b) <= lim ? distance(f, cand.b, lim) : lim + 1;
        var wd = wlim + 1;
        if (wlim > 0 && cand.b.indexOf(' ') !== -1) {
          var cw = cand.ws || (cand.ws = cand.b.split(/\s+/));
          if (Math.abs(cw.length - m) <= wlim) {
            var c = sharedWords(qw, cw), diff = Math.max(m, cw.length) - c;
            if (c >= 2 && diff <= wlim) { wd = diff; }
          }
        }
        if (d > lim && wd > wlim) { continue; }
        if (d > lim) { d = distance(f, cand.b, f.length + cand.b.length); }
        keep(cand, wd, d);
      }
      var base = widen ? 4 : 1, near = lim - 1;
      rw.forEach(function (r, k) {
        var bucket = near < 1 ? (bucketByBare(files[base + k], r.charAt(0))[r] || [])
          : (files[base + k].buckets[r.charAt(0)] || []);
        var rb = bagDistance(qc, qn, r);
        for (var i = 0; i < bucket.length; i++) {
          var e = bucket[i];
          if (e.b === f && accentMatch(fq, e.f)) { continue; }
          if (Math.abs(e.b.length - r.length) <= near && bagOf(e.b) - rb <= near) {
            var d = distance(r, e.b, near);
            if (d <= near) { keep(e, wlim + 1, d ? d + 1 : 0); }
          }
        }
        if (shard && shardKey(r) === own) {
          var hit = (shard.foldedForms[r] || []).slice().sort();
          if (hit.length && !shard.foldedHeads[r]) {
            keep({ w: hit[0], f: fold(hit[0]), b: r, n: 0, p: !!shard.pages[fold(hit[0])], c: 0 }, wlim + 1, 0);
          }
        }
      });
      list.sort(function (a, b) {
        return (a.wd - b.wd) || (a.dist - b.dist) || (a.cd - b.cd) || (b.band - a.band) || (a.first - b.first) ||
          (a.gap - b.gap) || cmpStr(a.f, b.f) || cmpStr(a.word, b.word);
      });
      return list.slice(0, n).map(function (s) {
        return { word: s.word, dist: s.dist, page: s.page ? pagePath(s.f) : null,
                 count: s.count, translated: s.tr, pos: s.pos };
      });
    });
  }

  function loadRandom() {
    if (randomList) { return Promise.resolve(randomList); }
    if (randomPending) { return randomPending; }
    randomPending = Promise.resolve(loader('random.json')).then(function (list) {
      randomList = list || [];
      randomPending = null;
      return randomList;
    });
    return randomPending;
  }

  function randomHeadword() {
    return loadRandom().then(function (list) {
      if (!list || !list.length) { return null; }
      return list[Math.floor(Math.random() * list.length)];
    });
  }


  var randomEnData = null;
  var randomEnPending = null;
  function loadRandomEnglish() {
    if (randomEnData) { return Promise.resolve(randomEnData); }
    if (randomEnPending) { return randomEnPending; }
    randomEnPending = Promise.resolve(loader('random-en.json')).then(function (data) {
      randomEnData = data && data.n ? data : { n: {} };
      randomEnPending = null;
      return randomEnData;
    });
    return randomEnPending;
  }

  function enPool(shard, letter) {
    if (!shard.pool) {
      shard.pool = shard.keys.filter(function (k) {
        return enLetter(k) === letter && enNorm((shard.d && shard.d[k]) || k) === k;
      });
    }
    return shard.pool;
  }

  function randomEnglish() {
    return loadRandomEnglish().then(function (data) {
      var letters = Object.keys(data.n).sort(), total = 0, i;
      for (i = 0; i < letters.length; i++) { total += data.n[letters[i]] || 0; }
      if (!total) { return null; }
      var r = Math.min(Math.floor(Math.random() * total), total - 1);
      for (i = 0; i < letters.length; i++) {
        var n = data.n[letters[i]] || 0;
        if (r < n) { break; }
        r -= n;
      }
      var letter = letters[i];
      return loadEnglish(letter).then(function (shard) {
        var pool = enPool(shard, letter);
        if (!pool.length) { return null; }
        var k = pool.length === data.n[letter] ? pool[r] : pool[Math.floor(Math.random() * pool.length)];
        return (shard.d && shard.d[k]) || k;
      });
    });
  }

  function shownOrder(res) {
    var all = [];
    ((res && res.heads) || []).forEach(function (grp) { all = all.concat(grp.articles); });
    return {
      all: all,
      done: all.filter(function (a) { return a.translated; }),
      todo: all.filter(function (a) { return !a.translated; })
    };
  }
  function firstShown(res) {
    var o = shownOrder(res), a = o.done[0] || o.todo[0];
    return a ? a.id : null;
  }

  function articleUrl(id) { return config.base + 'bm-en/' + id + '/'; }
  function searchUrl(q) { return config.base + 'bm-en/#q=' + encodeURIComponent(q); }


  function pagePath(fq) {
    return config.base + 'bm-en/' + encodeURIComponent(fq).replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }) + '/';
  }

  function pageFor(q) {
    var g = guard(q);
    if (!g.ok) { return Promise.resolve(null); }
    var fq = fold(g.query);
    return Promise.resolve(loadShard(shardKey(fq))).then(function (shard) {
      return shard && shard.pages && shard.pages[fq] ? pagePath(fq) : null;
    }, function () { return null; });
  }

  function address(q) {
    return pageFor(q).then(function (url) { return url || searchUrl(q); });
  }

  function searchAddress(q, drawn) {
    var mark = drawn ? DRAWN_MARK : '';
    return pageFor(q).then(function (url) {
      return (url ? url + '#q=' + encodeURIComponent(String(q).trim()) : searchUrl(String(q).trim())) + mark;
    });
  }

  function pageTitle(res) {
    var here = pathWord(global.location && global.location.pathname);
    if (!res || !here || here !== res.folded) { return Promise.resolve(null); }
    return pageFor(res.query).then(function (url) {
      if (!url) { return null; }
      var heads = [], ids = Object.create(null), n = 0;
      res.heads.forEach(function (grp) {
        if (fold(grp.form) === res.folded && heads.indexOf(grp.form) === -1) { heads.push(grp.form); }
        grp.articles.forEach(function (a) { if (!ids[a.id]) { ids[a.id] = 1; n++; } });
      });
      heads.sort();
      var word = null;
      if (heads.length) {
        if (n === 1) { return { one: firstShown(res) }; }
        var first = firstShown(res);
        var holds = res.heads.filter(function (grp) {
          return grp.articles.some(function (a) { return a.id === first; });
        }).map(function (grp) { return grp.form; });
        word = heads.filter(function (f) { return holds.indexOf(f) !== -1; })[0] || heads[0];
      } else {
        var rows = res.forms.filter(function (grp) { return grp.articles.length; });
        word = rows.length ? rows[0].form : null;
      }
      return word ? { title: word + ' — ' + t('dictionary_name') } : null;
    }, function () { return null; });
  }

  function pathWord(path) {
    var b = config.base;
    if (!path || path.indexOf(b) !== 0) { return null; }
    var m = /^bm-en\/([^\/]+)\/?(?:index\.html)?$/.exec(path.slice(b.length));
    if (!m) { return null; }
    var w;
    try { w = decodeURIComponent(m[1]); } catch (e) { return null; }
    return /^\d+$/.test(w) ? null : fold(w);
  }

  var labelTable = null;
  var labelPending = null;
  function loadLabels() {
    if (labelTable) { return Promise.resolve(labelTable); }
    if (labelPending) { return labelPending; }
    labelPending = Promise.resolve(loader('labels.json')).then(function (data) {
      labelTable = data || {};
      labelPending = null;
      return labelTable;
    }, function () { labelPending = null; return {}; });
    return labelPending;
  }

  function labelCode(shard, form, id) {
    var t = shard.t || '';
    if (!t) { return ''; }
    if (!shard.labelAt) {
      var at = Object.create(null), k = 0;
      Object.keys(shard.forms).sort().forEach(function (f) {
        at[f] = k;
        k += shard.forms[f].length;
      });
      shard.labelAt = at;
    }
    var start = shard.labelAt[form];
    if (start === undefined) { return ''; }
    var i = shard.forms[form].indexOf(id);
    return i < 0 ? '' : t.charAt(start + i);
  }


  var EN_DIR = 'en/';
  var enShards = {};
  var enPending = {};
  var EN_EDGE = /^[\s.,;:!?'"‘’“”\-–—\/]+|[\s.,;:!?'"‘’“”\-–—\/]+$/g;

  function enNorm(s) {
    s = String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').replace(EN_EDGE, '');
    var m = /^(to|a|an|the) (.+)$/.exec(s);
    return m ? m[2].replace(EN_EDGE, '') : s;
  }

  function enLetter(k) {
    var c = bare(String(k || '')).charAt(0);
    return c >= 'a' && c <= 'z' ? c : MISC;
  }

  function loadEnglish(letter) {
    if (enShards[letter]) { return Promise.resolve(enShards[letter]); }
    if (enPending[letter]) { return enPending[letter]; }
    enPending[letter] = Promise.resolve(loader(EN_DIR + letter + '.json')).then(function (raw) {
      var shard = raw || { k: letter, e: {}, a: {}, d: {}, sp: {}, ir: {}, missing: true };
      shard.keys = Object.keys(shard.e || {}).sort();
      enShards[letter] = shard;
      delete enPending[letter];
      return shard;
    });
    return enPending[letter];
  }

  var enTails = {};
  var enTailsPending = {};
  function loadEnglishTails(key) {
    if (enTails[key]) { return Promise.resolve(enTails[key]); }
    if (enTailsPending[key]) { return enTailsPending[key]; }
    enTailsPending[key] = Promise.resolve(loader(EN_DIR + 'tails/' + key + '.json')).then(function (raw) {
      var file = raw || { t: key, e: {}, a: {}, d: {}, missing: true };
      enTails[key] = file;
      delete enTailsPending[key];
      return file;
    });
    return enTailsPending[key];
  }

  function enVariants(q, shard) {
    var sp = (shard && shard.sp) || {};
    var t = q.split(' ').map(function (w) { return Object.prototype.hasOwnProperty.call(sp, w) ? sp[w] : w; }).join(' ');
    return t !== q ? [q, t] : [q];
  }

  function enArticle(shard, id) {
    var x = shard.a[String(id)] || ['', 0, '', 0, 0, []];
    var a = { id: Number(id), word: x[0], pos: x[2] || '', translated: true,
              band: x[3] || 0, rank: x[4] || 0, units: x[5] || [] };
    if (Array.isArray(x[1])) {
      a.hgs = x[1].slice();
      a.hg = formHg(x, null);
    } else { a.hg = x[1] || 0; }
    a.first = String(x[0] || '').replace(/ …$/, '').split(SEP)[0];
    a.firstHg = a.hgs ? (a.hgs[0] || 0) : a.hg;
    return a;
  }

  function enOrder(shard) {
    return function (x, y) {
      var ax = shard.a[String(x.id)], ay = shard.a[String(y.id)];
      return ((x.unit <= 2 ? 0 : 1) - (y.unit <= 2 ? 0 : 1)) || (ay[3] - ax[3]) ||
        (x.unit - y.unit) || (x.pos - y.pos) || (ax[4] - ay[4]);
    };
  }

  function enArticlesOf(shard, key) {
    var seen = Object.create(null), list = [];
    (shard.e[key] || []).forEach(function (e) {
      if (!seen[e[0]]) { seen[e[0]] = 1; list.push({ id: e[0], unit: e[1], pos: e[2] }); }
    });
    return list.sort(enOrder(shard));
  }

  function englishItem(shard, key) {
    return { key: key, word: (shard.d && shard.d[key]) || key,
             arts: enArticlesOf(shard, key).map(function (m) { return enArticle(shard, m.id); }) };
  }

  function englishLookup(q) {
    var g = guard(q);
    if (!g.ok) { return Promise.resolve({ query: q, key: '', matches: [], count: 0, guard: g.reason }); }
    var p = enNorm(g.query);
    return loadEnglish(enLetter(p)).then(function (shard) {
      var by = Object.create(null), list = [];
      if (p) {
        enVariants(p, shard).forEach(function (v) {
          (shard.e[v] || []).forEach(function (e) {
            var m = by[e[0]];
            if (!m) { m = by[e[0]] = { id: e[0], unit: e[1], pos: e[2], spans: [] }; list.push(m); }
            else if (e[1] < m.unit || (e[1] === m.unit && e[2] < m.pos)) { m.unit = e[1]; m.pos = e[2]; }
            m.spans.push([e[1], e[3], e[4]]);
          });
        });
      }
      list.sort(enOrder(shard));
      list.forEach(function (m) { m.article = enArticle(shard, m.id); });
      return { query: g.query, key: p, shard: shard, matches: list, count: list.length };
    });
  }

  function englishSuggest(prefix, limit) {
    var sq = suggestQuery(prefix);
    if (!sq) { return Promise.resolve([]); }
    var p = enNorm(sq.query);
    if (!p) { return Promise.resolve([]); }
    limit = limit || config.maxSuggestions;
    return loadEnglish(enLetter(p)).then(function (shard) {
      var vs = enVariants(p, shard), items = [];
      shard.keys.forEach(function (k) {
        var rank = -1;
        for (var i = 0; i < vs.length; i++) {
          if (k === vs[i]) { rank = 0; break; }
          if (k.lastIndexOf(vs[i], 0) === 0) {
            var r = k.indexOf(' ') < 0 ? 1 : 2;
            rank = rank < 0 ? r : Math.min(rank, r);
          }
        }
        if (rank < 0) { return; }
        var top = 0;
        shard.e[k].forEach(function (e) { top = Math.max(top, shard.a[String(e[0])][3]); });
        items.push({ k: k, rank: rank, top: top });
      });
      items.sort(function (x, y) {
        return (x.rank - y.rank) || (x.rank === 1 ? y.top - x.top : 0) ||
          (x.k.length - y.k.length) || cmpStr(x.k, y.k);
      });
      return items.slice(0, limit).map(function (x) { return englishItem(shard, x.k); });
    });
  }

  function enStems(w, ir) {
    var out = [w];
    var add = function (s) { if (s.length >= 3 && out.indexOf(s) < 0) { out.push(s); } };
    var cut = function (suf) {
      if (w.length < suf.length + 3 || w.slice(-suf.length) !== suf) { return; }
      var b = w.slice(0, -suf.length);
      add(b); add(b + 'e');
      if (b.length > 3 && b.charAt(b.length - 1) === b.charAt(b.length - 2)) { add(b.slice(0, -1)); }
    };
    cut('ing'); cut('ed'); cut('es'); cut('s');
    if (w.length > 4 && /ie[sd]$/.test(w)) { add(w.slice(0, -3) + 'y'); }
    var base = ir && Object.prototype.hasOwnProperty.call(ir, w) ? ir[w] : null;
    if (base && out.indexOf(base) < 0) { out.push(base); }
    return out;
  }

  function enTokens(k) { return k.split(/[\s\-]+/).filter(Boolean); }

  function englishSimilar(q, n, shown) {
    var g = guard(q);
    if (!g.ok) { return Promise.resolve([]); }
    var p = enNorm(g.query);
    n = n || config.similarCount;
    if (p.length < 3) { return Promise.resolve([]); }
    var lim = letterLimit(p.length), on = shown || {}, b = bare(p);
    return Promise.all([loadEnglish(enLetter(p)), loadEnglishTails(remainderKey(b.slice(1))),
      loadEnglishTails(remainderKey(b)), loadEnglish(enLetter(b.slice(1)))]).then(function (got) {
      var shard = got[0];
      var ir = shard.ir || {}, vs = enVariants(p, shard), L = enLetter(p);
      var mine = enStems(p, ir).concat(vs), out = [];
      shard.keys.forEach(function (k) {
        if (vs.indexOf(k) !== -1) { return; }
        var ids = [], seen = Object.create(null);
        shard.e[k].forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; ids.push(e[0]); } });
        if (ids.length && ids.every(function (i) { return on[i]; })) { return; }
        var w, d;
        if (k.indexOf(' ') !== -1 || k.indexOf('-') !== -1) {
          if (enTokens(k).indexOf(p) === -1) { return; }
          w = 0; d = 0;
        } else if (enStems(k, ir).some(function (s) { return mine.indexOf(s) !== -1; })) {
          w = 0; d = 0;
        } else {
          if (enLetter(k) !== L) { return; }
          d = distance(p, k, lim);
          if (d > lim) { return; }
          w = 1;
        }
        var top = 0;
        ids.forEach(function (i) { top = Math.max(top, shard.a[String(i)][3]); });
        out.push({ k: k, w: w, d: d, top: top, from: shard });
      });
      var seen = Object.create(null);
      out.forEach(function (x) { seen[x.k] = 1; });
      vs.forEach(function (v) { seen[v] = 1; });
      var second = got[3], c2 = b.charAt(1);
      var pools = [got[1], got[2], { e: second.e, a: second.a, d: second.d || {}, only: function (k) {
        return k.indexOf(' ') === -1 && k.indexOf('-') === -1 && bare(k).charAt(0) === c2;
      } }];
      pools.forEach(function (pool) {
        Object.keys(pool.e || {}).sort().forEach(function (k) {
          if (seen[k] || (pool.only && !pool.only(k))) { return; }
          seen[k] = 1;
          var ids = [], had = Object.create(null);
          pool.e[k].forEach(function (e) { if (!had[e[0]]) { had[e[0]] = 1; ids.push(e[0]); } });
          if (ids.length && ids.every(function (i) { return on[i]; })) { return; }
          var d = distance(p, k, lim);
          if (d > lim) { return; }
          var top = 0;
          ids.forEach(function (i) { top = Math.max(top, pool.a[String(i)][3]); });
          out.push({ k: k, w: 1, d: d, top: top, from: pool });
        });
      });
      out.sort(function (x, y) {
        return (x.w - y.w) || (x.d - y.d) || (y.top - x.top) || (x.k.length - y.k.length) || cmpStr(x.k, y.k);
      });
      return out.slice(0, n).map(function (x) { return englishItem(x.from, x.k); });
    });
  }

  function englishNumbers(shard) {
    if (shard && shard.c != null) { return Promise.resolve({ n: shard.c, p: shard.p }); }
    return loadEnglish('a').then(function (s) { return { n: s.c == null ? null : s.c, p: s.p }; });
  }

  function englishUrl(q) { return config.base + 'bm-en/#en=' + encodeURIComponent(q); }

  var ordparLookup = {
    englishLookup: englishLookup, englishSuggest: englishSuggest, englishSimilar: englishSimilar,
    englishItem: englishItem, enArticle: enArticle, enNorm: enNorm, enLetter: enLetter, enStems: enStems,
    loadEnglish: loadEnglish, englishNumbers: englishNumbers, englishUrl: englishUrl,
    config: config, configure: configure, setLoader: setLoader,
    fold: fold, bare: bare, accentMatch: accentMatch,
    letterKey: letterKey, shardKey: shardKey, suggestKey: suggestKey,
    tailKey: tailKey, remainderKey: remainderKey, snipKey: snipKey, rewrites: rewrites, RULES: RULES, useList: useList,
    caseDistance: caseDistance, bagDistance: bagDistance, charCounts: charCounts,
    guard: guard, suggestQuery: suggestQuery, distance: distance, letterLimit: letterLimit, sharedWords: sharedWords,
    loadShard: loadShard, loadHeadwords: loadHeadwords, loadTails: loadTails,
    loadTranslated: loadTranslated, loadRandom: loadRandom, loadSnippets: loadSnippets,
    nbDef: nbDef, nbRows: nbRows, rowView: rowView,
    isGloss: isGloss, writeGloss: writeGloss, appendGlossText: appendGlossText,
    GLOSS_CLASS: GLOSS_CLASS, SEP_CLASS: SEP_CLASS,
    lookup: lookup, suggest: suggest, similar: similar, formHg: formHg, headParts: headParts, headText: headText, homographOrder: homographOrder, resultOrder: resultOrder, rankSuggestions: rankSuggestions, mergeArticles: mergeArticles, suggestSections: suggestSections, headLine: headLine, typedLine: typedLine,
    randomHeadword: randomHeadword, randomEnglish: randomEnglish, enPool: enPool,
    shownOrder: shownOrder, firstShown: firstShown,
    articleUrl: articleUrl, searchUrl: searchUrl,
    pagePath: pagePath, pageFor: pageFor, address: address, searchAddress: searchAddress,
    pathWord: pathWord, loadLabels: loadLabels,
    MAX_QUERY: MAX_QUERY
  };


  function t(key, vars) {
    var shell = global.ordparShell;
    var s = shell ? shell.t(key) : key;
    if (vars) {
      for (var k in vars) { s = s.split('{' + k + '}').join(String(vars[k])); }
    }
    return s;
  }

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function srOnly(text) {
    var node = el('span', 'ordpar-visually-hidden', text);
    node.setAttribute('data-nosnippet', '');
    return node;
  }

  function spaced(node) {
    var kids = node && node.childNodes, doc = global.document;
    if (!kids || !node.insertBefore || !doc || !doc.createTextNode) { return node; }
    for (var i = kids.length - 1; i > 0; i--) {
      if (kids[i].nodeType === 1 && kids[i - 1].nodeType === 1) {
        node.insertBefore(global.document.createTextNode('\n'), kids[i]);
      }
    }
    return node;
  }

  function posLabel(pos) {
    if (!pos) { return ''; }
    var S = global.ordparShell;
    if (S && S.posWords) { return S.posWords(pos); }
    var label = t('pos.' + pos);
    return label === 'pos.' + pos ? '' : label;
  }
  function posSpan(pos) {
    var S = global.ordparShell;
    if (S && S.posSpan) { return S.posSpan(pos); }
    var label = posLabel(pos);
    return label ? el('span', 'ordpar-pos', label) : null;
  }

  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function roman(n) { return ROMAN[n] || String(n); }

  function homograph(node, hg) {
    if (!hg) { return; }
    var mark = el('span', 'ordbok-homograph ordpar-hg', roman(hg));
    mark.setAttribute('aria-hidden', 'true');
    node.appendChild(mark);
    node.appendChild(srOnly(' ' + t('results.homograph', { n: hg })));
  }

  function headwordInto(node, a) {
    if (!a.word) { node.appendChild(global.document.createTextNode('#' + a.id)); return; }
    var h = headParts(a.word, a.hg, a.hgs);
    h.parts.forEach(function (p, i) {
      if (i) { node.appendChild(global.document.createTextNode(', ')); }
      node.appendChild(global.document.createTextNode(p.w));
      if (p.hg) { node.appendChild(global.document.createTextNode(' ')); homograph(node, p.hg); }
    });
    if (h.cut) { node.appendChild(global.document.createTextNode(' …')); }
  }

  function renumber(node, a) {
    var first = String(a.word).split(SEP)[0].replace(/ …$/, '');
    Promise.resolve(loadShard(shardKey(fold(first)))).then(function (shard) {
      var w = shard && shard.words && shard.words[String(a.id)];
      var now = redrawFrom(a, w);
      if (!now) { return; }
      node.textContent = '';
      headwordInto(node, now);
    }).catch(function () {  });
  }

  function redrawFrom(a, w) {
    if (!w || typeof w[0] !== 'string') { return null; }
    var mine = String(a.word).split(SEP), theirs = w[0].split(SEP);
    if (mine.length !== theirs.length ||
        mine.slice().sort().join(SEP) !== theirs.slice().sort().join(SEP)) { return null; }
    var hg = Array.isArray(w[1]) ? 0 : (w[1] || 0), hgs = Array.isArray(w[1]) ? w[1] : null;
    if (w[0] === a.word && headText(w[0], hg, hgs) === headText(a.word, a.hg, a.hgs)) {
      return null;
    }
    return { id: a.id, word: w[0], hg: hg, hgs: hgs };
  }

  function articleItem(a) {
    var li = el('li', 'ordpar-hit');
    var link = el('a', 'ordpar-hit-link');
    headwordInto(link, a);
    link.href = articleUrl(a.id);
    link.lang = 'nb';
    li.appendChild(link);
    var pos = posSpan(a.pos);
    if (pos) { li.appendChild(pos); }
    if (a.label) {
      var S = global.ordparShell, nbl = a.labelNb && S && S.nbWords && S.nbWords();
      var fl = li.appendChild(el('span', 'ordpar-form-label', '(' + (nbl ? a.labelNb : a.label) + ')'));
      if (nbl) { fl.lang = 'nb'; }
    }
    if (!a.translated) { li.appendChild(el('span', 'ordpar-tag', t('tag.norwegianOnly'))); }
    return spaced(li);
  }

  function section(cls, heading) {
    var sec = el('section', cls);
    var h = el('h2', 'ordpar-section-title');
    h.textContent = heading;
    sec.appendChild(h);
    return sec;
  }

  function articleList(articles) {
    var ul = el('ul', 'ordpar-hits-list');
    articles.forEach(function (a) {
      var li = articleItem(a);
      recordOnOpen(li.firstChild, a);
      if (lemmaOf(a)) {
        var snip = el('span', 'ordpar-hit-snippet is-pending', '\u00a0');
        snip.setAttribute('data-snip', String(a.id));
        snip.lang = a.translated && !nbRows() ? 'en' : 'nb';
        li.appendChild(snip);
        spaced(li);
      }
      ul.appendChild(li);
    });
    return spaced(ul);
  }

  function lemmaOf(a) {
    var w = (a.word || '').split(SEP)[0].replace(/ …$/, '');
    return w;
  }

  function announce(root, text) {
    var live = root.querySelector('[data-ordpar-live]');
    if (live) { live.textContent = text; }
  }


  function extractArticle(page) {
    var start = page.indexOf('<div class="ordbok');
    var end = page.indexOf('<footer class="ordpar-card-foot">', start);
    if (end < 0) { end = page.indexOf('<footer class="ordpar-attr">', start); }
    if (start < 0 || end < 0) { return null; }
    var cap = /<p class="ordpar-caption">[\s\S]*?<\/p>/.exec(page.slice(0, start));
    var fe = page.indexOf('</footer>', end);
    var foot = page.slice(end, fe < 0 ? page.length : fe);
    var notice = /<p class="ordpar-change">[\s\S]*?<\/p>/.exec(foot);
    var ttl = /<title>([\s\S]*?)<\/title>/.exec(page.slice(0, start));
    return { caption: cap ? cap[0] : '', fragment: page.slice(start, end).replace(/\s+$/, ''),
      notice: notice ? notice[0] : '', meta: pageMeta(page),
      title: ttl ? unescapeAttr(ttl[1]) : '' };
  }

  function pageMeta(page) {
    var tag = /<html\b[^>]*>/.exec(page);
    var attr = function (name) {
      var m = tag && new RegExp('\\s' + name + '="([^"]*)"').exec(tag[0]);
      return m ? unescapeAttr(m[1]) : null;
    };
    var snip = attr('data-snip');
    if (snip == null) {
      var d = /<meta name="description" content="([^"]*)">/.exec(page);
      snip = d ? unescapeAttr(d[1]) : '';
    }
    return { snip: snip, drop: attr('data-drop') };
  }

  function unescapeAttr(v) {
    return v.replace(/&(quot|#x27|#39|lt|gt|amp);/g, function (m, e) {
      return { quot: '"', '#x27': "'", '#39': "'", lt: '<', gt: '>', amp: '&' }[e];
    });
  }

  function withMeta(a, got) {
    if (!got || !got.meta) { return a; }
    var b = {};
    for (var k in a) { b[k] = a[k]; }
    b.snip = got.meta.snip;
    b.drop = got.meta.drop;
    return b;
  }

  function personalFields(a) {
    var f = { id: a.id, word: a.word || String(a.id), hg: a.hg || 0, pos: a.pos || '',
      translated: !!a.translated, snip: a.snip || '' };
    if (a.hgs) { f.hgs = a.hgs.slice(); f.hg = formHg([a.word, a.hgs], null); }
    if (a.drop != null) { f.drop = a.drop; }
    return f;
  }

  function scopeArticle(html, id, level) {
    level = level || 3;
    var p = 'r' + id + '-';
    var self = '/bm-en/' + id + '/#';
    html = html.replace(/<[a-zA-Z][^>]*>/g, function (tag) {
      return tag
        .replace(/(\s)(id|for|data-for|data-paradigm)="([^"]*)"/g, function (m, s, a, v) {
          return s + a + '="' + p + v + '"';
        })
        .replace(/(\s)href="([^"]*)"/g, function (m, s, v) {
          return v.indexOf(self) === 0 ? s + 'href="#' + p + v.slice(self.length) + '"' : m;
        });
    });
    html = html.replace(/<h1 class="ordpar-hw"([^>]*)>([\s\S]*?)<\/h1>/, function (m, attrs, inner) {
      return '<h3 class="ordpar-hw"' + attrs + ' id="' + p + 'hw"'
        + (level !== 3 ? ' aria-level="' + level + '"' : '')
        + '><a class="ordpar-hw-link" href="' + articleUrl(id) + '">' + inner + '</a></h3>';
    });
    return html.replace(/<h3 lang="en">/g, '<h3 lang="en" aria-level="' + (level + 1) + '">');
  }

  var articleCache = Object.create(null);

  function fetchArticle(id) {
    if (articleCache[id]) { return articleCache[id]; }
    var p = (global.fetch ? global.fetch(articleUrl(id), { credentials: 'omit' })
      : Promise.reject(new Error('no fetch')))
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) { return text ? extractArticle(text) : null; })
      .catch(function () { return null; })
      .then(function (got) {
        if (!got) { delete articleCache[id]; }
        return got;
      });
    articleCache[id] = p;
    return p;
  }

  function absoluteUrl(id) {
    var loc = global.location;
    return (loc && loc.origin && loc.origin !== 'null' ? loc.origin : '') + articleUrl(id);
  }

  function resultControls(a) {
    var nav = global.navigator || {};
    var url = absoluteUrl(a.id);
    var title = a.word ? headText(a.word, a.hg, a.hgs) : String(a.id);
    var p = el('p', 'ordpar-result-controls');
    if (nav.clipboard && nav.clipboard.writeText) {
      var copy = el('button', 'ordpar-result-btn ordpar-result-copy', t('results.copyLink'));
      copy.type = 'button';
      var done = el('span', 'ordpar-result-copied');
      done.setAttribute('role', 'status');
      var timer = null;
      copy.addEventListener('click', function () {
        nav.clipboard.writeText(url).then(function () {
          done.textContent = t('results.copied');
          if (timer) { clearTimeout(timer); }
          timer = setTimeout(function () { done.textContent = ''; }, 2500);
        }, function () {  });
      });
      p.appendChild(copy);
      p.appendChild(done);
    }
    if (nav.share) {
      var share = el('button', 'ordpar-result-btn ordpar-result-share', t('results.share'));
      share.type = 'button';
      share.addEventListener('click', function () {
        nav.share({ title: title, url: url }).catch(function () {  });
      });
      p.appendChild(share);
    }
    if (global.ordparPersonal) {
      p.appendChild(global.ordparPersonal.heartButton(personalFields(a), 'ordpar-result-heart'));
    }
    var link = el('a', 'ordpar-result-page', t('results.articlePage'));
    link.href = articleUrl(a.id);
    p.appendChild(link);
    return spaced(p);
  }

  function mountArticle(host, a, got, level) {
    a = withMeta(a, got);
    host.innerHTML = (got.caption ? got.caption + '\n' : '') + scopeArticle(got.fragment, a.id, level) + '\n';
    host.appendChild(resultControls(a));
    if (got.notice) { host.insertAdjacentHTML('beforeend', '\n' + got.notice); }
    if (global.ordparInflection && global.ordparInflection.mountAll) {
      try { global.ordparInflection.mountAll(host); } catch (e) {  }
    }
    if (typeof global.ordparDefs === 'function') {
      try { global.ordparDefs(); } catch (e) {  }
    }
    if (global.ordparInflection && global.ordparInflection.fit) {
      try { global.ordparInflection.fit(host); } catch (e) {  }
    }
  }

  function fullArticles(articles, seen) {
    var wrap = el('div', 'ordpar-results-full');
    var shown = [];
    articles.forEach(function (a) {
      if (seen[a.id]) { return; }
      seen[a.id] = 1;
      var art = el('article', 'ordpar-result');
      art.setAttribute('data-id', String(a.id));
      art.setAttribute('aria-labelledby', 'r' + a.id + '-hw');
      art.setAttribute('aria-busy', 'true');
      art.appendChild(el('p', 'ordpar-empty', a.word || ('#' + a.id)));
      wrap.appendChild(art);
      shown.push(fetchArticle(a.id).then(function (got) {
        art.removeAttribute('aria-busy');
        if (got) { art.ordparTitle = got.title || ''; mountArticle(art, a, got, 3); return withMeta(a, got); }
        art.removeAttribute('aria-labelledby');
        art.textContent = '';
        var ul = el('ul', 'ordpar-hits-list');
        ul.appendChild(articleItem(a));
        art.appendChild(ul);
        return null;
      }));
    });
    wrap.shown = Promise.all(shown);
    return spaced(wrap);
  }

  function listRows(articles, seen, opts) {
    var level = (opts && opts.level) || 3;
    var mark = !(opts && opts.mark === false);
    var wrap = el('div', 'ordpar-rows');
    var drawn = [];
    articles.forEach(function (a) {
      if (seen[a.id]) { return; }
      seen[a.id] = 1;
      drawn.push(a.id);
      var row = el('div', 'ordpar-row');
      row.setAttribute('data-id', String(a.id));
      var head = el('h' + level, 'ordpar-row-head');
      var btn = el('button', 'ordpar-row-button');
      btn.type = 'button';
      btn.id = 'r' + a.id + '-row';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'r' + a.id + '-panel');
      var line = el('span', 'ordpar-row-line');
      var word = el('span', 'ordpar-row-word');
      headwordInto(word, a);
      word.lang = 'nb';
      line.appendChild(word);
      if (a.word && a.word.indexOf(SEP) !== -1 && opts && opts.renumber) {
        renumber(word, a);
      }
      if (mark && global.ordparPersonal) { line.appendChild(global.ordparPersonal.favMark(a.id)); }
      var pos = posSpan(a.pos);
      if (pos) { line.appendChild(pos); }
      if (!a.translated) { line.appendChild(el('span', 'ordpar-tag', t('tag.norwegianOnly'))); }
      btn.appendChild(el('span', 'ordpar-row-chevron'));
      btn.lastChild.setAttribute('aria-hidden', 'true');
      btn.appendChild(line);
      var snip = el('span', 'ordpar-row-snippet is-pending', '\u00a0');
      snip.setAttribute('data-snip', String(a.id));
      snip.lang = a.translated && !nbRows() ? 'en' : 'nb';
      btn.appendChild(snip);
      spaced(line);
      spaced(btn);
      head.appendChild(btn);
      row.appendChild(head);
      var panel = el('div', 'ordpar-row-panel');
      panel.id = 'r' + a.id + '-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', btn.id);
      panel.hidden = true;
      row.appendChild(panel);
      spaced(row);
      var loaded = false;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        row.classList.toggle('is-open', open);
        panel.hidden = !open;
        if (!open || loaded) { return; }
        loaded = true;
        panel.setAttribute('aria-busy', 'true');
        panel.textContent = '';
        panel.appendChild(el('p', 'ordpar-empty', t('results.loading')));
        fetchArticle(a.id).then(function (got) {
          panel.removeAttribute('aria-busy');
          if (got) {
            mountArticle(panel, a, got, level + 1);
            return;
          }
          loaded = false;
          panel.textContent = '';
          var ul = el('ul', 'ordpar-hits-list');
          ul.appendChild(articleItem(a));
          panel.appendChild(ul);
        });
      });
      wrap.appendChild(row);
    });
    var ahead = global.ordparAhead;
    if (ahead && ahead.mode && ahead.mode() === 'page') {
      drawn.forEach(function (id) { ahead.queue('a' + id, function () { return fetchArticle(id); }); });
    }
    return spaced(wrap);
  }

  function dropRule(drop, snip) {
    return drop ? drop : (snip ? String(snip).split(' · ')[0] : '');
  }

  function recordSearch(q, res, shownP, t) {
    var P = global.ordparPersonal;
    if (!P || !P.recordSearch || !res || !res.count) { return Promise.resolve(); }
    if (t == null) { t = Date.now(); }
    var ids = Object.create(null), n = 0, one = null;
    res.heads.forEach(function (grp) {
      grp.articles.forEach(function (a) { if (!ids[a.id]) { ids[a.id] = 1; n++; one = a; } });
    });
    if (!n) { return Promise.resolve(); }
    if (n > 1) { P.recordSearch({ q: q, n: n }, t); return Promise.resolve(); }
    var write = function (text) {
      P.recordSearch({ q: q, n: 1, word: one.word || String(one.id), hg: one.hg || 0,
        pos: one.pos || '', translated: !!one.translated, text: text || '' }, t);
    };
    write('');
    if (!one.translated) { return Promise.resolve(); }
    var fromSnip = function () {
      var w = lemmaOf(one);
      if (!w) { return; }
      return loadSnippets(snipKey(fold(w))).then(function (snips) {
        var id = String(one.id);
        var drop = snips && snips._d && Object.prototype.hasOwnProperty.call(snips._d, id)
          ? snips._d[id] : null;
        var text = dropRule(drop, snips && snips[id]);
        if (text) { write(text); }
      }, function () {  });
    };
    if (!shownP) { return Promise.resolve(fromSnip()); }
    return shownP.then(function (lists) {
      var hit = null;
      [].concat.apply([], lists || []).forEach(function (b) { if (b && b.id === one.id) { hit = b; } });
      if (hit) { var text = dropRule(hit.drop, hit.snip); if (text) { write(text); } return; }
      return fromSnip();
    }, fromSnip);
  }

  function recordOpened(a) {
    var P = global.ordparPersonal;
    var w = lemmaOf(a);
    if (!P || !P.recordSearch || !w) { return Promise.resolve(); }
    var t = Date.now();
    P.recordSearch({ q: w, n: 1, word: a.word || String(a.id), hg: a.hg || 0, pos: a.pos || '',
      translated: !!a.translated, text: '' }, t);
    return lookup(w).then(function (res) {
      var found = res && res.heads.some(function (grp) {
        return grp.articles.some(function (b) { return b.id === a.id; });
      });
      if (!found) { res = { count: 1, heads: [{ form: w, articles: [a] }], forms: [] }; }
      return recordSearch(w, res, null, t);
    }).catch(function () {  });
  }

  var OPEN_WAIT = 1200;
  function recordOnOpen(link, a) {
    link.addEventListener('click', function (ev) {
      var done = recordOpened(a);
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey
          || ev.altKey || !global.location) { return; }
      ev.preventDefault();
      var gone = false;
      var go = function () { if (!gone) { gone = true; global.location.href = link.href; } };
      done.then(go, go);
      setTimeout(go, OPEN_WAIT);
    });
    link.addEventListener('auxclick', function (ev) { if (ev.button === 1) { recordOpened(a); } });
  }

  function fillSnippets(wrap, snips, last) {
    var spans = wrap.querySelectorAll('[data-snip].is-pending');
    var nb = nbRows();
    if (nb) { snips = rowView(snips); }
    for (var i = 0; i < spans.length; i++) {
      var id = spans[i].getAttribute('data-snip');
      var text = snips && snips[id];
      if (text) {
        writeGloss(spans[i], text, isGloss(snips, id));
        if (nb) { spans[i].lang = 'nb'; }
        spans[i].classList.remove('is-pending');
      } else if (last) {
        spans[i].parentNode.removeChild(spans[i]);
      }
    }
  }

  function resultsHeading(count) {
    var h = el('h2', 'ordpar-section-title ordpar-dict-title');
    h.appendChild(el('span', 'ordpar-dict-name', t('results.dictionary')));
    var badge = el('span', 'ordpar-count');
    var n = el('span', null, String(count));
    n.setAttribute('aria-hidden', 'true');
    badge.appendChild(n);
    badge.appendChild(srOnly(' ' + t(count === 1 ? 'results.countOne' : 'results.count', { n: count })));
    h.appendChild(badge);
    return spaced(h);
  }

  function listMode() {
    var shell = global.ordparShell;
    var v = shell && shell.getSetting ? shell.getSetting('listview') : 'multi';
    return v === 'on' || v === 'off' ? v : 'multi';
  }

  function useList(mode, n) { return mode === 'on' || (mode === 'multi' && n > 1); }

  var last = null;
  var watching = false;
  function watchSetting() {
    var shell = global.ordparShell;
    if (watching || !shell || !shell.onChange) { return; }
    watching = true;
    shell.onChange(function (key) {
      var layer = ['nbonly', 'nbequiv', 'nbrows', 'nbhover', 'labels'].indexOf(key) !== -1;
      if (last && !last.en && (layer || listMode() !== last.mode)) { render(last.root, last.query); }
    });
  }

  function searchingLine() { return el('p', 'ordpar-empty', t('results.searching')); }

  function searching(root, query) {
    if (!root || !guard(query).ok) { return; }
    var results = root.querySelector('[data-ordpar-results]') || root;
    last = { root: root, query: query, mode: listMode() };
    watchSetting();
    results.textContent = '';
    results.appendChild(searchingLine());
    idle(root, false);
  }

  function idle(root, on) {
    if (root && root.classList) { root.classList.toggle('ordpar-idle', !!on); }
  }

  function render(root, query, opts) {
    if (opts && opts.en) { return renderEnglish(root, query, opts); }
    var record = !!(opts && opts.record);
    var results = root.querySelector('[data-ordpar-results]') || root;
    var mode = listMode();
    var list = false;
    last = { root: root, query: query, mode: mode };
    watchSetting();
    var mine = last;
    results.textContent = '';
    var g = guard(query);
    idle(root, !g.ok && g.reason === 'empty');
    if (!g.ok) {
      if (g.reason !== 'empty') {
        results.appendChild(el('p', 'ordpar-empty', t('search.' + g.reason)));
        announce(root, t('search.' + g.reason));
      }
      return Promise.resolve(null);
    }
    results.appendChild(searchingLine());
    return lookup(g.query).then(function (res) {
      if (mine !== last) { return res; }
      results.textContent = '';
      var seen = Object.create(null);
      var shown = null;
      if (res.count) {
        var hits = el('section', 'ordpar-hits');
        hits.appendChild(resultsHeading(res.count));
        var order = shownOrder(res), all = order.all, done = order.done, todo = order.todo;
        var ids = Object.create(null), n = 0;
        all.forEach(function (a) { if (!ids[a.id]) { ids[a.id] = 1; n++; } });
        list = useList(mode, n);
        if (list) {
          if (all.length) { hits.appendChild(listRows(done.concat(todo), seen)); }
        } else {
          var full = [];
          if (done.length) { full.push(hits.appendChild(fullArticles(done, seen))); }
          if (todo.length) {
            if (done.length) { hits.appendChild(el('p', 'ordpar-untr-head', t('results.untranslated'))); }
            full.push(hits.appendChild(fullArticles(todo, seen)));
          }
          shown = Promise.all(full.map(function (w) { return w.shown; }));
          if (n === 1) {
            shown.then(function () {
              var art = hits.querySelector('.ordpar-result');
              if (mine === last && art && art.ordparTitle) { global.document.title = art.ordparTitle; }
            });
          }
        }
        results.appendChild(spaced(hits));
      }
      res.forms.forEach(function (grp) {
        var sec = section('ordpar-inflected', t('results.inflected', { q: grp.form }));
        sec.appendChild(articleList(grp.articles));
        results.appendChild(spaced(sec));
      });
      spaced(results);
      var keys = [];
      var addKey = function (k) { if (keys.indexOf(k) === -1) { keys.push(k); } };
      if (list && res.heads.some(function (grp) { return grp.articles.length; })) {
        addKey(snipKey(fold(g.query)));
      }
      res.forms.forEach(function (grp) {
        grp.articles.forEach(function (a) { var w = lemmaOf(a); if (w) { addKey(snipKey(fold(w))); } });
      });
      Promise.all(keys.map(function (k) {
        return loadSnippets(k).then(function (snips) {
          if (mine === last) { fillSnippets(results, snips, false); }
        });
      })).then(function () {
        if (mine === last) { fillSnippets(results, null, true); }
      });
      pageTitle(res).then(function (pt) {
        if (mine !== last || !pt) { return; }
        if (pt.title) { global.document.title = pt.title; return; }
        if (list) {
          fetchArticle(pt.one).then(function (got) {
            if (mine === last && got && got.title) { global.document.title = got.title; }
          });
        }
      });
      if (record) { recordSearch(g.query, res, shown); }
      var E = global.ordparEvents;
      if (record && E) {
        try { if (res.count) { E.hit(g.query); } else { E.missStart(g.query); } } catch (e) {  }
      }
      if (!res.count) {
        var miss = el('section', 'ordpar-miss');
        miss.appendChild(el('h2', 'ordpar-section-title', t('results.none', { q: g.query })));
        miss.appendChild(el('p', 'ordpar-note', t('results.noneWhy')));
        results.appendChild(spaced(miss));
        spaced(results);
        announce(root, t('results.liveNone', { q: g.query }));
      } else {
        announce(root, t(res.count === 1 ? 'results.liveHitsOne' : 'results.liveHits',
          { n: res.count, q: g.query }));
      }
      var showing = res.count || res.forms.some(function (grp) { return grp.articles.length; });
      var whole = showing && shown ? shown.then(null, function () { return null; }) : null;
      return Promise.all([similar(g.query, showing ? SIMILAR_POOL : null), whole]).then(function (both) {
        var words = both[0];
        if (mine !== last) { return res; }
        if (showing) { words = dropRepeats(words, res, pageSpellings(results)).slice(0, config.similarCount); }
        if (words.length) {
          var sec = section('ordpar-similar', t('results.similar'));
          var rows = !res.count && canDrawRows();
          var ul = el('ul', 'ordpar-similar-list' + (rows ? ' ordpar-similar-rows' : ''));
          words.forEach(function (s, i) {
            var li = el('li');
            var a = rows ? similarRow(s) : el('a', null, s.word);
            a.href = s.page ? s.page + '#q=' + encodeURIComponent(s.word) : searchUrl(s.word);
            if (!rows) { a.lang = 'nb'; }
            if (record && !res.count && E) {
              var choose = function () { try { E.missChoose(g.query, s.word, i + 1); } catch (e) {  } };
              a.addEventListener('click', choose);
              a.addEventListener('auxclick', function (ev) { if (ev.button === 1) { choose(); } });
            }
            ul.appendChild(li).appendChild(a);
          });
          sec.appendChild(spaced(ul));
          results.appendChild(spaced(sec));
          spaced(results);
        }
        return res;
      });
    });
  }

  var SIMILAR_POOL = 30;

  function dropRepeats(words, res, spell) {
    var on = Object.create(null), arts = [];
    (res.heads || []).concat(res.forms || []).forEach(function (grp) {
      grp.articles.forEach(function (a) { if (!on[a.id]) { on[a.id] = 1; arts.push(a); } });
    });
    if (!arts.length) { return words; }
    return words.filter(function (s) {
      var sh = shards[shardKey(fold(s.word))];
      var ids = sh && sh.heads && sh.heads[s.word];
      if (ids && ids.length) { return !ids.every(function (id) { return on[id]; }); }
      if (!s.count) { return true; }
      var carriers = 0;
      arts.forEach(function (a) {
        var forms = String(a.word || '').replace(/ …$/, '').split(SEP);
        if (spell && spell[a.id]) { forms = forms.concat(spell[a.id]); }
        if (forms.indexOf(s.word) !== -1) { carriers++; }
      });
      return carriers < s.count;
    });
  }

  function pageSpellings(root) {
    var out = Object.create(null);
    Array.prototype.forEach.call(root.querySelectorAll('.ordpar-result[data-id]'), function (art) {
      var list = [];
      Array.prototype.forEach.call(art.querySelectorAll('.ordpar-hw .ordbok-lemma'), function (l) {
        var w = l.textContent.replace(/^[\s,]+|[\s,]+$/g, '');
        if (w) { list.push(w); }
      });
      out[art.getAttribute('data-id')] = list;
    });
    return out;
  }


  function renderEnglish(root, query, opts) {
    var record = !!(opts && opts.record);
    var results = root.querySelector('[data-ordpar-results]') || root;
    last = { root: root, query: query, mode: listMode(), en: true };
    watchSetting();
    var mine = last;
    results.textContent = '';
    var g = guard(query);
    idle(root, !g.ok && g.reason === 'empty');
    if (!g.ok) {
      if (g.reason !== 'empty') {
        results.appendChild(el('p', 'ordpar-empty', t('search.' + g.reason)));
        announce(root, t('search.' + g.reason));
      }
      return Promise.resolve(null);
    }
    results.appendChild(searchingLine());
    return englishLookup(g.query).then(function (res) {
      if (mine !== last) { return res; }
      results.textContent = '';
      var on = Object.create(null);
      var arts = res.matches.map(function (m) { on[m.id] = 1; return m.article; });
      var done = Promise.resolve();
      var E = global.ordparEvents;
      if (record && E) {
        try { if (res.count) { E.hit(g.query, true); } else { E.missStart(g.query, true); } } catch (e) {  }
      }
      if (res.count) {
        var hits = el('section', 'ordpar-hits ordpar-hits-en');
        hits.appendChild(resultsHeading(res.count));
        if (res.count === 1) {
          var full = hits.appendChild(fullArticles(arts, Object.create(null)));
          full.shown.then(function () {
            var art = hits.querySelector('.ordpar-result');
            if (mine === last && art && art.ordparTitle) { global.document.title = art.ordparTitle; }
          });
        } else {
          var wrap = hits.appendChild(listRows(arts, Object.create(null)));
          wrap.classList.add('ordpar-rows-en');
          res.matches.forEach(function (m) {
            var snip = wrap.querySelector('[data-snip="' + m.id + '"]');
            if (!snip) { return; }
            snip.textContent = '';
            snip.lang = 'en';
            snip.classList.remove('is-pending');
            englishGloss(snip, m.article.units, m.spans);
          });
        }
        results.appendChild(spaced(hits));
        announce(root, t(res.count === 1 ? 'results.liveHitsOne' : 'results.liveHits',
          { n: res.count, q: g.query }));
        if (record) { recordEnglish(g.query, res); }
      } else {
        var miss = results.appendChild(el('section', 'ordpar-miss ordpar-miss-en'));
        miss.appendChild(el('h2', 'ordpar-section-title', t('results.noneEn', { q: g.query })));
        var why = miss.appendChild(el('p', 'ordpar-note'));
        spaced(miss);
        announce(root, t('results.liveNone', { q: g.query }));
        done = englishNumbers(res.shard).then(function (num) {
          if (mine !== last) { return; }
          why.textContent = t('results.noneEnWhy', {
            n: num.n == null ? '' : Number(num.n).toLocaleString('en-GB'),
            p: num.p == null ? '' : String(num.p) });
        });
      }
      return done.then(function () { return englishSimilar(g.query, null, on); }).then(function (items) {
        if (mine !== last) { return res; }
        if (items.length) {
          var S = global.ordparShell;
          var rows = !res.count && !!(S && S.englishRow);
          var sec = section('ordpar-similar ordpar-similar-en', t('results.similarEn'));
          var ul = el('ul', 'ordpar-similar-list' + (rows ? ' ordpar-similar-rows' : ''));
          var drawn = [];
          items.forEach(function (it, i) {
            var li = el('li');
            var a = rows ? S.englishRow('a', it, 'ordpar-similar-row') : el('a', null, it.word);
            if (!rows) { a.lang = 'en'; }
            a.href = englishUrl(it.word);
            if (record && !res.count && E) {
              var choose = function () { try { E.missChoose(g.query, it.word, i + 1, true); } catch (e) {  } };
              a.addEventListener('click', choose);
              a.addEventListener('auxclick', function (ev) { if (ev.button === 1) { choose(); } });
            }
            ul.appendChild(li).appendChild(a);
            if (rows) { drawn.push(a); }
          });
          sec.appendChild(spaced(ul));
          results.appendChild(spaced(sec));
          spaced(results);
          drawn.forEach(function (a) { if (a.ordparFit) { a.ordparFit(); } });
        }
        return res;
      });
    });
  }

  function englishGloss(node, units, spans) {
    var doc = node.ownerDocument;
    (units || []).forEach(function (u, i) {
      if (i) { node.appendChild(el('span', SEP_CLASS, ' \u00b7 ')); }
      var hs = (spans || []).filter(function (s) { return s[0] === i + 1; })
        .sort(function (a, b) { return a[1] - b[1]; });
      var at = 0;
      hs.forEach(function (s) {
        if (s[1] < at) { return; }
        if (s[1] > at) { node.appendChild(doc.createTextNode(u.slice(at, s[1]))); }
        node.appendChild(el('span', 'ordpar-en-hit', u.slice(s[1], s[2])));
        at = s[2];
      });
      if (at < u.length) { node.appendChild(doc.createTextNode(u.slice(at))); }
    });
  }

  function recordEnglish(q, res) {
    var P = global.ordparPersonal;
    if (!P || !P.recordSearch || !res || !res.count) { return; }
    P.recordSearch({ q: q, n: res.count, en: true }, Date.now());
  }

  function canDrawRows() {
    var S = global.ordparShell;
    return !!(S && S.searchRowMain && S.searchRowSide && S.fillSearchRow && S.similarArticles);
  }

  function similarRow(s) {
    var S = global.ordparShell;
    var a = el('a', 'ordpar-option ordpar-similar-row');
    if (s.count === 0) { return formRow(a, s.word); }
    if (s.count == null) {
      var held = a.appendChild(S.searchRowMain({ q: s.word, n: 0 }));
      lookup(s.word).then(function (res) {
        var ids = Object.create(null), n = 0, one = null;
        ((res && res.heads) || []).forEach(function (grp) {
          grp.articles.forEach(function (x) { if (!ids[x.id]) { ids[x.id] = 1; n++; one = x; } });
        });
        if (!n) { return; }
        var e = n > 1 ? { q: s.word, n: n } : { q: s.word, n: 1, word: one.word || String(one.id),
          hg: one.hg || 0, pos: one.pos || '', translated: !!one.translated, text: '' };
        a.replaceChild(S.searchRowMain(e), held);
        if (n === 1 && e.translated) { a.classList.add('is-translated'); }
        spaced(a);
        S.fillSearchRow(a.appendChild(S.searchRowSide(e)), e);
        spaced(a);
      });
      return a;
    }
    var e = s.count > 1 ? { q: s.word, n: s.count }
      : { q: s.word, n: 1, word: s.word, hg: 0, pos: s.pos || '', translated: !!s.translated, text: '' };
    if (s.translated) { a.classList.add('is-translated'); }
    a.appendChild(S.searchRowMain(e));
    S.fillSearchRow(a.appendChild(S.searchRowSide(e)), e, null, S.similarArticles);
    spaced(a);
    return a;
  }

  var FORM_ROW_MAX = 3;
  function formRow(a, word) {
    var S = global.ordparShell;
    a.classList.add('ordpar-similar-form');
    a.appendChild(S.searchRowMain({ q: word, n: 0 }));
    var side = a.appendChild(el('span', 'ordpar-option-side'));
    spaced(a);
    var text = side.appendChild(el('span', 'ordpar-option-gloss is-pending', '\u00a0'));
    lookup(word).then(function (res) {
      var arts = [];
      ((res && res.forms) || []).forEach(function (grp) { arts = arts.concat(grp.articles); });
      var seen = Object.create(null), heads = [];
      arts.forEach(function (x) {
        var w = lemmaOf(x);
        if (w && !seen[w]) { seen[w] = 1; heads.push(w); }
      });
      if (!heads.length) { side.removeChild(text); return; }
      if (arts.some(function (x) { return x.translated; })) { a.classList.add('is-translated'); }
      text.textContent = '';
      text.appendChild(el('span', 'ordpar-option-formof', t('similar.formOf') + ' '));
      heads.slice(0, FORM_ROW_MAX).forEach(function (w, i) {
        if (i) { text.appendChild(global.document.createTextNode(', ')); }
        var span = text.appendChild(el('span', 'ordpar-option-formhead', w));
        span.lang = 'nb';
      });
      if (heads.length > FORM_ROW_MAX) { text.appendChild(global.document.createTextNode(', \u2026')); }
      text.classList.remove('is-pending');
    }, function () { side.removeChild(text); });
    return a;
  }

  function wireRandom(root) {
    var buttons = (root || global.document).querySelectorAll('[data-ordpar-random]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        var S = global.ordparShell;
        var en = !!(S && S.direction && S.direction() === 'en') && !(S.equivHidden && S.equivHidden());
        (en ? randomEnglish() : randomHeadword()).then(function (w) {
          btn.disabled = false;
          if (w == null) { return; }
          if (en) {
            if (S && S.search && S.search(w, { random: true, en: true })) {
              if (global.scrollTo) { global.scrollTo(0, 0); }
              return;
            }
            global.location.href = englishUrl(w) + DRAWN_MARK;
            return;
          }
          if (typeof w === 'number') { global.location.href = articleUrl(w); return; }
          if (S && S.search && S.search(w, { random: true })) {
            if (global.scrollTo) { global.scrollTo(0, 0); }
            return;
          }
          searchAddress(w, true).then(function (href) { global.location.href = href; });
        });
      });
    });
  }

  var DRAWN_MARK = '&random';

  function hashQuery(hash) {
    var m = /(?:^#|&)q=([^&]*)/.exec(hash || '');
    return m ? m[1] : null;
  }

  function hashEnglish(hash) {
    var m = /(?:^#|&)en=([^&]*)/.exec(hash || '');
    return m ? m[1] : null;
  }

  function decodeRaw(raw) {
    raw = raw.replace(/\+/g, ' ');
    try { return decodeURIComponent(raw); } catch (e) { return raw; }
  }

  var wiredLinks = false;
  var ordparSearch = {
    render: render,
    searching: searching,
    extractArticle: extractArticle, scopeArticle: scopeArticle, roman: roman, pageMeta: pageMeta,
    fetchArticle: fetchArticle,
    withMeta: withMeta, personalFields: personalFields, headwordInto: headwordInto, redrawFrom: redrawFrom,
    listRows: listRows,
    recordSearch: recordSearch, recordOpened: recordOpened, recordOnOpen: recordOnOpen,
    wireRandom: wireRandom,
    queryFromLocation: function () {
      var loc = global.location;
      if (!loc) { return ''; }
      var raw = hashQuery(loc.hash);
      if (raw == null) {
        var m = /[?&]q=([^&#]*)/.exec(loc.search || '');
        if (!m) { return ''; }
        raw = m[1];
      }
      raw = raw.replace(/\+/g, ' ');
      try { return decodeURIComponent(raw); } catch (e) { return raw; }
    },
    englishFromLocation: function () {
      var loc = global.location;
      var raw = loc ? hashEnglish(loc.hash) : null;
      return raw == null ? '' : decodeRaw(raw);
    },
    addressEnglish: function () {
      var st = null;
      try { st = global.history && global.history.state; } catch (e) { st = null; }
      if (st && typeof st.q === 'string') { return !!st.en; }
      return !!(global.location && hashEnglish(global.location.hash) != null);
    },
    englishUrl: englishUrl,
    DRAWN_MARK: DRAWN_MARK,
    hashQuery: hashQuery, hashEnglish: hashEnglish,
    takeDrawn: function () {
      var loc = global.location, h = global.history;
      if (!loc) { return false; }
      var hash = loc.hash || '';
      var at = hash.indexOf(DRAWN_MARK);
      var en = hashQuery(hash) == null && hashEnglish(hash) != null;
      if ((hashQuery(hash) != null || en) && at > 0
          && (at + DRAWN_MARK.length === hash.length || hash.charAt(at + DRAWN_MARK.length) === '&')) {
        var q = en ? ordparSearch.englishFromLocation() : ordparSearch.queryFromLocation();
        var rest = hash.slice(0, at) + hash.slice(at + DRAWN_MARK.length);
        try {
          if (h && h.replaceState) {
            h.replaceState(en ? { q: q, random: true, en: true } : { q: q, random: true }, '', loc.pathname + loc.search + rest);
          }
        } catch (e) {  }
        return true;
      }
      try { return !!(h && h.state && h.state.random); } catch (e) { return false; }
    },
    wireFragmentLinks: function (onSearch) {
      var doc = global.document, loc = global.location;
      if (!doc || !loc || wiredLinks) { return; }
      wiredLinks = true;
      doc.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || a.target || a.hasAttribute('download')) { return; }
        var url;
        try { url = new global.URL(a.href, loc.href); } catch (err) { return; }
        var raw = url.search ? null : hashQuery(url.hash), en = false;
        if (raw == null && !url.search) { raw = hashEnglish(url.hash); en = raw != null; }
        if (url.origin !== loc.origin || raw == null) { return; }
        if (url.pathname !== loc.pathname && url.pathname !== config.base + 'bm-en/'
            && !pathWord(url.pathname)) { return; }
        e.preventDefault();
        var q = decodeRaw(raw);
        onSearch(q.trim(), en ? { en: true } : undefined);
      });
    },
    fragmentAddress: function () {
      var loc = global.location, h = global.history;
      if (!loc || !h || !h.replaceState || !/[?&]q=/.test(loc.search || '')) { return false; }
      var q = ordparSearch.queryFromLocation();
      var rest = (loc.search || '').slice(1).split('&').filter(function (kv) {
        return kv && kv.split('=')[0] !== 'q';
      }).join('&');
      try {
        h.replaceState(h.state, '', loc.pathname + (rest ? '?' + rest : '')
          + (q ? '#q=' + encodeURIComponent(q) : ''));
        return true;
      } catch (e) { return false; }
    },
    addressQuery: function () {
      var st = null;
      try { st = global.history && global.history.state; } catch (e) { st = null; }
      if (st && typeof st.q === 'string') { return st.q; }
      return ordparSearch.queryFromLocation() || ordparSearch.englishFromLocation()
        || pathWord(global.location && global.location.pathname) || '';
    },
    cameByHistory: cameByHistory,
    answerInPlace: answerInPlace,
    wordPage: wordPage
  };

  function cameByHistory() {
    try {
      var nav = global.performance.getEntriesByType('navigation')[0];
      return !!nav && nav.type === 'back_forward';
    } catch (e) { return false; }
  }

  function answerInPlace(main) {
    var d = global.document, h = global.history;
    var start = { path: global.location.pathname, title: d.title };
    var show = function (q, record, en) {
      d.title = q + ' — ' + t('site.name');
      var box = d.getElementById('ordpar-q');
      if (box && box.value !== q) { box.value = q; }
      var S = global.ordparShell;
      if (S && S.setDirection) { S.setDirection(en ? 'en' : 'nb', { quiet: true }); }
      return render(main, q, { record: record, en: !!en });
    };
    var seq = 0, loading = 0;
    var go = function (q, how) {
      var drawn = !!(how && how.random), en = !!(how && how.en), mine = ++seq;
      loading = mine;
      d.title = q + ' — ' + t('site.name');
      var box = d.getElementById('ordpar-q');
      if (box && box.value !== q) { box.value = q; }
      searching(main, q);
      return (en ? Promise.resolve(englishUrl(q)) : address(q)).then(function (url) {
        if (mine !== seq) { return null; }
        loading = 0;
        var state = drawn ? (en ? { q: q, random: true, en: true } : { q: q, random: true })
          : en ? { q: q, search: true, en: true } : { q: q, search: true };
        try { h.pushState(state, '', url); } catch (e) {  }
        return show(q, !drawn, en);
      });
    };
    var S = global.ordparShell;
    if (S && S.setSearchHandler) { S.setSearchHandler(go); }
    ordparSearch.wireFragmentLinks(function (q, how) { if (global.scrollTo) { global.scrollTo(0, 0); } go(q, how); });
    global.addEventListener('popstate', function () {
      var cut = !!loading;
      seq++; loading = 0;
      var q = ordparSearch.addressQuery();
      if (!q) {
        if (cut) { render(main, q, { record: false }); }
        return;
      }
      var st = null;
      try { st = h.state; } catch (e) { st = null; }
      if (global.location.pathname === start.path && !(st && (st.search || st.en))) {
        render(main, q, { record: false });
        d.title = start.title;
        return;
      }
      show(q, false, ordparSearch.addressEnglish());
    });
    return go;
  }

  function wordPage(main, word) {
    var d = global.document;
    main = main || d.getElementById('ordpar-main');
    if (!main) { return Promise.resolve(null); }
    word = word || main.getAttribute('data-ordpar-word') || pathWord(global.location.pathname) || '';
    var S = global.ordparShell;
    return Promise.resolve(S && S.ready).then(function () {
      var h = global.history, loc = global.location, q = word, record = false;
      var hash = loc.hash || '';
      var drawn = ordparSearch.takeDrawn();
      var asked = ordparSearch.queryFromLocation();
      if (hashQuery(hash) != null) {
        if (asked && fold(asked) === fold(word)) {
          q = asked;
          record = !drawn && !cameByHistory();
        }
        try {
          h.replaceState(drawn ? { q: q, random: true } : (record ? { q: q, search: true } : null),
            '', loc.pathname + loc.search);
        } catch (e) {  }
      } else {
        var st = null;
        try { st = h.state; } catch (e) { st = null; }
        if (st && typeof st.q === 'string' && fold(st.q) === fold(word)) {
          q = st.q;
          record = !!st.search && !st.random && !cameByHistory();
        }
      }
      var box = d.getElementById('ordpar-q');
      if (box && !box.value) { box.value = q; }
      answerInPlace(main);
      return render(main, q, { record: record });
    });
  }

  (function () {
    var d = global.document;
    if (!d || !d.addEventListener) { return; }
    var go = function () {
      var m = d.querySelector('main[data-ordpar-word]');
      if (m) { wordPage(m); }
    };
    if (d.readyState === 'complete') { setTimeout(go, 0); } else { d.addEventListener('DOMContentLoaded', go); }
  }());

  global.ordparLookup = ordparLookup;
  global.ordparSearch = ordparSearch;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ordparLookup: ordparLookup, ordparSearch: ordparSearch };
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
}catch(e){setTimeout(function(){throw e;});}
try{
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
    var m = /[#&]q=([^&#]*)$/.exec(path);
    if (m) {
      var q = '';
      try { q = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { q = ''; }
      jobs.push(warmSearch(q.trim()));
    }
    return Promise.all(jobs);
  }


  var PAGE = /^\/(?:bm-en\/\d+\/|bm-en\/#(?:[a-z]+=[a-z0-9-]*&)*q=[^#]+|history\/|favourites\/|settings\/)$/;

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
    var search = url.pathname === '/bm-en/' && !url.search && /(?:^#|&)q=/.test(url.hash);
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
}catch(e){setTimeout(function(){throw e;});}
try{
(function (global) {
  'use strict';

  var CACHE = 'ordpar-offline-1';
  var CURRENT = '/offline/__current.json';
  var BASE = '/offline/';
  var REC = 'offline';
  var UPD = 'offline-update';
  var EVERY = 15 * 60 * 1000;
  var DELAY = 1500;
  var PARALLEL = 3;
  var TRIES = 3;

  var doc = global.document;
  var nav = global.navigator || {};
  var supported = !!(nav.serviceWorker && global.caches && global.crypto && global.crypto.subtle
                     && typeof global.DecompressionStream === 'function');

  if (nav.serviceWorker) {
    nav.serviceWorker.register('/sw.js').catch(function () {  });
  }


  function readJSON(key) {
    try { return JSON.parse(global.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJSON(key, v) {
    try { global.localStorage.setItem(key, JSON.stringify(v)); } catch (e) {  }
  }
  function drop(key) {
    try { global.localStorage.removeItem(key); } catch (e) {  }
  }

  function openCache() { return global.caches.open(CACHE); }

  function current() {
    if (!supported) { return Promise.resolve(null); }
    return global.caches.has(CACHE).then(function (has) { return has ? openCache() : null; })
      .then(function (c) { return c ? c.match(CURRENT) : null; })
      .then(function (r) { return r ? r.json() : null; })
      .catch(function () { return null; });
  }

  function getJSON(name) {
    return fetch(BASE + name, { cache: 'no-store', credentials: 'omit' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + name); }
      return r.json();
    });
  }

  function packsOf(man) { return (man.bundles || []).concat(man.packs || []); }

  function hex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) { s += (b[i] < 16 ? '0' : '') + b[i].toString(16); }
    return s;
  }

  function tellWorker() {
    if (!nav.serviceWorker) { return Promise.resolve(); }
    return nav.serviceWorker.ready.then(function (reg) {
      var sw = reg.active;
      if (!sw) { return; }
      return new Promise(function (resolve) {
        var ch = new MessageChannel();
        ch.port1.onmessage = function () { resolve(); };
        sw.postMessage({ type: 'ordpar-offline-changed' }, [ch.port2]);
        global.setTimeout(resolve, 2000);
      });
    }).catch(function () {});
  }


  var job = null;
  var listeners = [];
  function emit() { listeners = listeners.filter(function (fn) { return fn() !== false; }); }

  function fetchPack(cache, p, onBytes) {
    return fetch(BASE + p.name, { cache: 'no-store', credentials: 'omit' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      var reader = r.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) { return; }
          chunks.push(x.value);
          got += x.value.length;
          onBytes(x.value.length);
          return pump();
        });
      }
      return pump().then(function () {
        var u8 = new Uint8Array(got), at = 0;
        chunks.forEach(function (c) { u8.set(c, at); at += c.length; });
        return global.crypto.subtle.digest('SHA-256', u8).then(function (d) {
          if (hex(d) !== p.sha256) { onBytes(-got); throw new Error('checksum'); }
          return cache.put(BASE + p.name, new Response(u8, { headers: {
            'Content-Type': 'application/octet-stream', 'Content-Length': String(got) } }));
        });
      }, function (err) { onBytes(-got); throw err; });
    });
  }

  function sync(man, state) {
    return openCache().then(function (cache) {
      return cache.keys().then(function (keys) {
        var have = {};
        keys.forEach(function (k) { have[new URL(k.url).pathname] = true; });
        var all = packsOf(man);
        var todo = all.filter(function (p) { return !have[BASE + p.name]; });
        var need = todo.reduce(function (s, p) { return s + p.size; }, 0);
        state.done = state.kind === 'download'
          ? all.reduce(function (s, p) { return s + p.size; }, 0) - need : 0;
        state.total = state.done + need;
        state.count = todo.length;
        emit();
        var i = 0, failed = null;
        function worker() {
          if (failed || i >= todo.length) { return Promise.resolve(); }
          var p = todo[i++], tries = 0;
          function attempt() {
            tries++;
            return fetchPack(cache, p, function (n) { state.done += n; emit(); })
              .catch(function (err) {
                if (tries < TRIES) { return attempt(); }
                failed = failed || err;
              });
          }
          return attempt().then(worker);
        }
        var runs = [];
        for (var w = 0; w < PARALLEL; w++) { runs.push(worker()); }
        return Promise.all(runs).then(function () {
          if (failed) { throw failed; }
          return need;
        });
      });
    });
  }

  function switchTo(man) {
    return openCache().then(function (cache) {
      return cache.put(CURRENT, new Response(JSON.stringify(man), {
        headers: { 'Content-Type': 'application/json' } }))
        .then(function () { return tellWorker(); })
        .then(function () { return cache.keys(); })
        .then(function (keys) {
          var keep = {};
          packsOf(man).forEach(function (p) { keep[BASE + p.name] = true; });
          keep[CURRENT] = true;
          return Promise.all(keys.filter(function (k) { return !keep[new URL(k.url).pathname]; })
            .map(function (k) { return cache.delete(k); }));
        });
    });
  }

  function storageInfo() {
    var st = nav.storage;
    if (!st) { return Promise.resolve({}); }
    return Promise.all([
      st.persisted ? st.persisted().catch(function () { return null; }) : null,
      st.estimate ? st.estimate().catch(function () { return null; }) : null
    ]).then(function (r) { return { persisted: r[0], estimate: r[1] }; });
  }

  var BUSY = 'busy in another tab';
  function locked(fn) {
    return nav.locks && nav.locks.request
      ? nav.locks.request('ordpar-offline', { ifAvailable: true }, function (lock) {
          return lock ? fn() : Promise.reject(new Error(BUSY));
        })
      : fn();
  }

  function download() {
    if (job) { return job.promise; }
    var state = { kind: 'download', done: 0, total: 0, error: null };
    job = state;
    emit();
    state.promise = locked(function () {
      return getJSON('manifest.json').then(function (man) {
        return sync(man, state).then(function () { return switchTo(man); }).then(function () {
          return (nav.storage && nav.storage.persist ? nav.storage.persist() : Promise.resolve(null))
            .catch(function () { return null; })
            .then(function (granted) {
              writeJSON(REC, { build: man.build, at: new Date().toISOString(), size: man.total,
                               persisted: granted });
              drop(UPD);
            });
        });
      });
    }).then(function () { job = null; emit(); }, function (err) {
      state.error = String(err && err.message || err);
      job = null;
      lastError = state.error;
      emit();
    });
    return state.promise;
  }
  var lastError = null;

  function due(rec, now) {
    var at = rec && rec.checked ? Date.parse(rec.checked) : NaN;
    return !(at <= now && now - at < EVERY);
  }

  function amend(fields) {
    var r = readJSON(UPD) || {};
    for (var k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) {
        if (fields[k] === undefined) { delete r[k]; } else { r[k] = fields[k]; }
      }
    }
    writeJSON(UPD, r);
    return r;
  }

  function checkUpdate(force) {
    if (!supported || job) { return Promise.resolve(null); }
    if (!force && !due(readJSON(UPD), Date.now())) { return Promise.resolve(null); }
    if (nav.onLine === false) { return Promise.resolve(null); }
    return current().then(function (cur) {
      if (!cur) { return null; }
      return getJSON('version.json').then(function (v) {
        var now = new Date().toISOString();
        if (v.build === cur.build) {
          amend({ checked: now, checkError: undefined });
          emit();
          return 'current';
        }
        var state = { kind: 'update', done: 0, total: 0, error: null };
        job = state;
        emit();
        state.promise = locked(function () {
          return getJSON('manifest.json').then(function (man) {
            if (man.build !== v.build) { throw new Error('the site is being updated; try later'); }
            return sync(man, state).then(function (bytes) {
              return switchTo(man).then(function () {
                var rec = readJSON(REC) || {};
                rec.build = man.build;
                rec.size = man.total;
                writeJSON(REC, rec);
                writeJSON(UPD, { at: new Date().toISOString(), result: 'updated', bytes: bytes,
                                 packs: state.count, checked: now, note: man.build });
              });
            });
          });
        }).then(function () { job = null; emit(); showNote(); return 'updated'; }, function (err) {
          job = null;
          var msg = String(err && err.message || err);
          if (msg === BUSY) {
            amend({ checked: now });
            emit();
            return 'busy';
          }
          writeJSON(UPD, { at: new Date().toISOString(), result: 'failed', error: msg, checked: now });
          emit();
          return 'failed';
        });
        return state.promise;
      });
    }).catch(function (err) {
      amend({ tried: new Date().toISOString(), checkError: String(err && err.message || err) });
      emit();
      return 'unreachable';
    });
  }

  function remove() {
    if (!supported) { return Promise.resolve(); }
    return global.caches.has(CACHE).then(function (has) {
      if (!has) { return null; }
      return openCache().then(function (c) {
        return c.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return c.delete(k); }));
        });
      });
    }).then(function () { return global.caches.delete(CACHE); }).then(function () {
      drop(REC);
      drop(UPD);
      lastError = null;
      return tellWorker();
    }).then(function () { emit(); });
  }


  function mb(bytes) { return (bytes / 1e6).toFixed(1); }

  function when(iso, lang) {
    try {
      return new Date(iso).toLocaleString(lang || 'en', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return iso; }
  }

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  var sizeCache = null;

  function section(t, lang) {
    var box = el('fieldset', 'ordpar-field ordpar-offline');
    box.appendChild(el('legend', null, t('offline.title')));
    if (global.ordparInstall) {
      try { box.appendChild(global.ordparInstall.line(t)); } catch (e) {  }
    }
    var body = el('div', 'ordpar-offline-body');
    body.setAttribute('aria-live', 'polite');
    box.appendChild(body);
    var drawing = false, again = false;

    function button(text, onClick, quiet) {
      var b = el('button', 'ordpar-button' + (quiet ? ' is-quiet' : ''), text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    function progress(state) {
      var wrap = el('div', 'ordpar-offline-progress');
      var bar = el('progress');
      bar.max = Math.max(state.total, 1);
      bar.value = Math.max(0, state.done);
      wrap.appendChild(bar);
      wrap.appendChild(el('p', null, t(state.kind === 'update' ? 'offline.updating' : 'offline.progress',
        { done: mb(Math.max(0, state.done)), total: mb(state.total) })));
      return wrap;
    }

    function draw() {
      if (drawing) { again = true; return; }
      drawing = true;
      current().then(function (cur) {
        return storageInfo().then(function (info) { return [cur, info]; });
      }).then(function (r) {
        var cur = r[0], info = r[1];
        body.textContent = '';
        if (!supported) {
          body.appendChild(el('p', 'ordpar-note', t('offline.unsupported')));
          return;
        }
        if (job) {
          body.appendChild(progress(job));
          return;
        }
        if (!cur) {
          body.appendChild(el('p', null, t('offline.intro')));
          if (lastError) {
            body.appendChild(el('p', 'ordpar-offline-error', t('offline.failed', { error: lastError })));
          }
          if (nav.onLine === false) {
            body.appendChild(el('p', 'ordpar-note', t('offline.offline')));
            return;
          }
          var label = sizeCache ? t('offline.keep', { mb: Math.round(sizeCache / 1e6) })
                                : t('offline.keepNoSize');
          body.appendChild(button(lastError ? t('offline.resume') : label, function () {
            lastError = null;
            download();
          }));
          if (!sizeCache) {
            getJSON('version.json').then(function (v) {
              if (v && v.total) { sizeCache = v.total; draw(); }
            }).catch(function () {});
          }
          return;
        }
        var rec = readJSON(REC) || {};
        body.appendChild(el('p', null, t('offline.kept', {
          date: rec.at ? when(rec.at, lang) : '?', mb: mb(cur.total) })));
        var persisted = info.persisted != null ? info.persisted : rec.persisted;
        if (persisted != null) {
          body.appendChild(el('p', 'ordpar-note',
            t(persisted ? 'offline.persisted' : 'offline.notPersisted')));
        }
        if (info.estimate && info.estimate.usage != null) {
          body.appendChild(el('p', 'ordpar-note', t('offline.usage', {
            used: mb(info.estimate.usage), quota: Math.round((info.estimate.quota || 0) / 1e6) })));
        }
        var upd = readJSON(UPD);
        if (upd && upd.result === 'updated') {
          body.appendChild(el('p', 'ordpar-note', t('offline.updated', {
            date: when(upd.at, lang), mb: mb(upd.bytes || 0) })));
        } else if (upd && upd.result === 'failed') {
          body.appendChild(el('p', 'ordpar-offline-error', t('offline.updateFailed', {
            error: upd.error || '?' })));
        }
        if (upd && upd.checked && upd.result !== 'failed') {
          body.appendChild(el('p', 'ordpar-note', t('offline.checked', { date: when(upd.checked, lang) })));
        }
        body.appendChild(button(t('offline.remove'), function () {
          remove().then(function () {
            sizeCache = null;
            draw();
          });
        }, true));
      }).catch(function () {}).then(function () {
        drawn = true;
        drawing = false;
        if (again) { again = false; draw(); }
      });
    }
    var drawn = false;
    listeners.push(function () {
      if (drawn && !box.isConnected) { return false; }
      draw();
    });
    draw();
    return box;
  }


  var noteBox = null;

  function tr(key) {
    var sh = global.ordparShell;
    var s = sh && sh.t ? sh.t(key) : null;
    return s && s !== key ? s : key;
  }

  function room() {
    var inst = global.ordparInstall;
    if (inst && inst.room) { inst.room(); return; }
    doc.documentElement.style.paddingBottom = noteBox ? noteBox.offsetHeight + 'px' : '';
  }

  function showNote() {
    var rec = readJSON(UPD);
    if (!rec || !rec.note || noteBox || !doc.body) { return; }
    amend({ note: undefined });
    var box = el('div', 'ordpar-update-note');
    box.setAttribute('role', 'status');
    var inner = el('div', 'ordpar-install-inner');
    inner.appendChild(el('p', 'ordpar-update-text', tr('offline.noteUpdated')));
    var actions = el('div', 'ordpar-install-actions');
    var again = el('button', 'ordpar-button', tr('offline.noteReload'));
    again.type = 'button';
    again.addEventListener('click', function () { global.location.reload(); });
    var x = el('button', 'ordpar-update-close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', tr('offline.noteClose'));
    x.addEventListener('click', hideNote);
    actions.appendChild(again);
    actions.appendChild(x);
    inner.appendChild(actions);
    box.appendChild(inner);
    doc.body.appendChild(box);
    noteBox = box;
    room();
  }

  function hideNote() {
    if (!noteBox) { return; }
    if (noteBox.parentNode) { noteBox.parentNode.removeChild(noteBox); }
    noteBox = null;
    room();
  }


  var pending = null;
  function later() {
    if (pending) { return; }
    pending = global.setTimeout(function () {
      pending = null;
      if (doc.visibilityState === 'hidden') { return; }
      checkUpdate(false);
    }, DELAY);
  }
  function start() {
    showNote();
    later();
  }
  if (supported) {
    if (doc.readyState === 'complete') { start(); }
    else { global.addEventListener('load', start); }
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible') { later(); }
    });
    global.addEventListener('pageshow', function (e) { if (e.persisted) { later(); } });
    global.addEventListener('online', function () { emit(); });
    global.addEventListener('offline', function () { emit(); });
  }

  global.ordparOffline = {
    supported: supported,
    section: section,
    download: download,
    checkUpdate: checkUpdate,
    due: due,
    EVERY: EVERY,
    showNote: showNote,
    remove: remove,
    current: current,
    state: function () { return job ? { kind: job.kind, done: job.done, total: job.total } : null; },
    lastError: function () { return lastError; }
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
}catch(e){setTimeout(function(){throw e;});}
try{
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
}catch(e){setTimeout(function(){throw e;});}
try{
(function (global) {
  'use strict';

  var REC = 'install-offer';
  var SESSION = 'ordpar-install-shown';
  var MAX_SHOWN = 2;
  var NOTE_MS = 8000;
  var SETTINGS_HASH = 'settings/#data';


  function mayOffer(rec, sessionShown, standalone) {
    if (standalone || sessionShown) { return false; }
    rec = rec || {};
    if (rec.answer || rec.installed) { return false; }
    return (rec.shown | 0) < MAX_SHOWN;
  }

  function afterShown(rec, now) {
    var r = copy(rec);
    r.shown = (r.shown | 0) + 1;
    r.at = now;
    return r;
  }

  function afterAnswer(rec, answer, now) {
    var r = copy(rec);
    r.answer = answer;
    if (answer === 'installed') { r.installed = true; }
    r.at = now;
    return r;
  }

  function settingsCase(env) {
    if (env.standalone) { return 'app'; }
    if (env.relatedInstalled || env.installedHere) { return 'installed'; }
    if (env.event) { return 'offer'; }
    if (env.recordInstalled) { return 'installed'; }
    if (env.ios) { return 'ios'; }
    if (env.chromium) { return 'menu'; }
    return null;
  }

  var CASE_KEYS = { app: 'install.inApp', installed: 'install.installed', offer: 'install.can',
                    ios: 'install.ios', menu: 'install.menu' };

  function hintWanted(env) {
    return !!(env.touch && !env.standalone && !env.relatedInstalled && !env.installedHere
              && (env.chromium || env.ios));
  }

  function copy(rec) {
    var r = {};
    if (rec) { for (var k in rec) { if (Object.prototype.hasOwnProperty.call(rec, k)) { r[k] = rec[k]; } } }
    return r;
  }


  var doc = global.document;
  var nav = global.navigator || {};

  function readRec() {
    try { return JSON.parse(global.localStorage.getItem(REC) || 'null'); } catch (e) { return null; }
  }
  function writeRec(r) {
    try { global.localStorage.setItem(REC, JSON.stringify(r)); } catch (e) {  }
  }
  function sessionShown() {
    try { return !!global.sessionStorage.getItem(SESSION); } catch (e) { return false; }
  }
  function markSession() {
    try { global.sessionStorage.setItem(SESSION, '1'); } catch (e) {  }
  }
  function media(q) {
    try { return !!(global.matchMedia && global.matchMedia(q).matches); } catch (e) { return false; }
  }
  function standalone() {
    return nav.standalone === true || media('(display-mode: standalone)')
      || media('(display-mode: fullscreen)') || media('(display-mode: minimal-ui)');
  }
  function ios() {
    var ua = String(nav.userAgent || '');
    return /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints | 0) > 1);
  }
  function chromium() {
    return 'BeforeInstallPromptEvent' in global || 'onbeforeinstallprompt' in global;
  }
  function touch() { return media('(pointer: coarse) and (hover: none)'); }

  var deferred = null;
  var installedHere = false;
  var related = null;
  var relatedAsked = null;
  var listeners = [];

  function env() {
    var rec = readRec() || {};
    return { standalone: standalone(), relatedInstalled: related === true, installedHere: installedHere,
             event: !!deferred, recordInstalled: !!rec.installed, ios: ios(), chromium: chromium(),
             touch: touch() };
  }

  function askRelated() {
    if (relatedAsked) { return relatedAsked; }
    if (typeof nav.getInstalledRelatedApps !== 'function') {
      related = false;
      relatedAsked = Promise.resolve(false);
      return relatedAsked;
    }
    relatedAsked = Promise.resolve().then(function () { return nav.getInstalledRelatedApps(); })
      .then(function (list) { related = !!(list && list.length); return related; })
      .catch(function () { related = false; return false; })
      .then(function (v) { emit(); return v; });
    return relatedAsked;
  }

  function emit() {
    listeners = listeners.filter(function (fn) {
      try { return fn() !== false; } catch (e) { return false; }
    });
  }

  function t(key, vars) {
    var sh = global.ordparShell;
    return sh ? sh.t(key, vars) : key;
  }
  function base() { return global.ORDPAR_BASE || '/'; }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }


  function prompt(fromBar) {
    var ev = deferred;
    deferred = null;
    writeRec(afterAnswer(readRec(), 'install', Date.now()));
    hideBar();
    emit();
    if (!ev) { return Promise.resolve(null); }
    var choice;
    try {
      ev.prompt();
      choice = Promise.resolve(ev.userChoice);
    } catch (e) { choice = Promise.resolve(null); }
    return choice.catch(function () { return null; }).then(function (c) {
      var outcome = c && c.outcome;
      if (outcome === 'accepted') { installed(); }
      else {
        writeRec(afterAnswer(readRec(), outcome === 'dismissed' ? 'dismissed' : 'install', Date.now()));
        if (fromBar) { note('install.noteLater'); }
      }
      emit();
      return outcome || null;
    });
  }

  var noted = false;
  function installed() {
    installedHere = true;
    deferred = null;
    var rec = readRec() || {};
    writeRec(afterAnswer(rec, 'installed', Date.now()));
    hideBar();
    if (!standalone()) { note('install.noteInstalled'); }
    var hintEl = doc && doc.querySelector('.ordpar-install-hint');
    if (hintEl && hintEl.parentNode) { hintEl.parentNode.removeChild(hintEl); }
    emit();
  }


  var bar = null;

  function showBar() {
    if (bar || !doc.body) { return; }
    bar = el('div', 'ordpar-install-bar');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-labelledby', 'ordpar-install-title');
    var inner = el('div', 'ordpar-install-inner');
    var words = el('div', 'ordpar-install-words');
    var title = el('p', 'ordpar-install-title', t('install.title'));
    title.id = 'ordpar-install-title';
    words.appendChild(title);
    words.appendChild(el('p', 'ordpar-install-text', t('install.text')));
    inner.appendChild(words);
    var actions = el('div', 'ordpar-install-actions');
    var yes = el('button', 'ordpar-button', t('install.install'));
    yes.type = 'button';
    yes.addEventListener('click', function () { prompt(true); });
    var no = el('button', 'ordpar-button is-quiet', t('install.no'));
    no.type = 'button';
    no.addEventListener('click', function () {
      writeRec(afterAnswer(readRec(), 'no', Date.now()));
      hideBar();
      note('install.noteLater');
      emit();
    });
    actions.appendChild(yes);
    actions.appendChild(no);
    inner.appendChild(actions);
    bar.appendChild(inner);
    doc.body.appendChild(bar);
    room(bar);
    announce(t('install.title'));
  }

  function hideBar() {
    if (!bar) { return; }
    if (bar.parentNode) { bar.parentNode.removeChild(bar); }
    bar = null;
    room(null);
  }

  var BANDS = ['.ordpar-install-bar', '.ordpar-install-note', '.ordpar-update-note'];

  function room() {
    var root = doc.documentElement, h = 0;
    for (var i = 0; i < BANDS.length; i++) {
      var n = doc.querySelector(BANDS[i]);
      if (!n) { continue; }
      n.style.bottom = h ? h + 'px' : '';
      h += n.offsetHeight;
    }
    root.style.paddingBottom = h ? h + 'px' : '';
  }

  var live = null;
  function announce(text) {
    if (!live) {
      live = el('div', 'ordpar-visually-hidden');
      live.setAttribute('data-nosnippet', '');
      live.setAttribute('role', 'status');
      doc.body.appendChild(live);
    }
    live.textContent = '';
    global.setTimeout(function () { live.textContent = text; }, 100);
  }

  function note(key) {
    if (noted || !doc.body) { return; }
    noted = true;
    var box = el('div', 'ordpar-install-note');
    box.setAttribute('role', 'status');
    var p = el('p');
    box.appendChild(p);
    doc.body.appendChild(box);
    global.setTimeout(function () {
      var parts = String(t(key, { link: '\u0000' })).split('\u0000');
      p.appendChild(doc.createTextNode(parts[0]));
      if (parts.length > 1) {
        var a = el('a', null, t('install.link'));
        a.href = base() + SETTINGS_HASH;
        p.appendChild(a);
        p.appendChild(doc.createTextNode(parts.slice(1).join('')));
      }
      room(box);
    }, 50);
    var timer = null;
    function go() {
      if (box.parentNode) { box.parentNode.removeChild(box); }
      room(null);
    }
    function arm() { global.clearTimeout(timer); timer = global.setTimeout(go, NOTE_MS); }
    function hold() { global.clearTimeout(timer); }
    box.addEventListener('mouseenter', hold);
    box.addEventListener('focusin', hold);
    box.addEventListener('mouseleave', arm);
    box.addEventListener('focusout', arm);
    arm();
  }

  function offer() {
    if (bar) { return; }
    if (!mayOffer(readRec(), sessionShown(), standalone())) { return; }
    writeRec(afterShown(readRec(), Date.now()));
    markSession();
    showBar();
  }


  function line(tr) {
    tr = tr || t;
    var box = el('div', 'ordpar-install-line');
    var drawn = false;
    function draw() {
      if (drawn && !box.isConnected) { return false; }
      drawn = true;
      box.textContent = '';
      var c = settingsCase(env());
      box.hidden = !c;
      box.setAttribute('data-case', c || 'none');
      if (!c) { return; }
      box.appendChild(el('p', null, tr(CASE_KEYS[c])));
      if (c === 'offer') {
        var b = el('button', 'ordpar-button', tr('install.button'));
        b.type = 'button';
        b.addEventListener('click', function () { prompt(false); });
        box.appendChild(b);
      }
    }
    listeners.push(draw);
    draw();
    askRelated();
    return box;
  }


  function hint(links) {
    var e0 = env();
    if (!links || !hintWanted(e0) || links.querySelector('.ordpar-install-hint')) { return null; }
    var a = el('a', 'ordpar-install-hint', t('install.hint'));
    a.setAttribute('data-ordpar-string', 'install.hint');
    a.setAttribute('href', base() + SETTINGS_HASH);
    links.appendChild(doc.createTextNode('\n'));
    links.appendChild(a);
    if (typeof nav.getInstalledRelatedApps === 'function' && related !== false) {
      a.style.visibility = 'hidden';
      askRelated().then(function (yes) {
        if (yes) { if (a.parentNode) { a.parentNode.removeChild(a); } }
        else { a.style.visibility = ''; }
      });
    }
    return a;
  }


  if (global.addEventListener && doc) {
    global.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      installedHere = false;
      if (doc.body && global.ordparShell) { offer(); }
      else { doc.addEventListener('DOMContentLoaded', function () { if (deferred) { offer(); } }); }
      emit();
    });
    global.addEventListener('appinstalled', function () {
      installed();
      if (global.ordparEvents) { try { global.ordparEvents.install(); } catch (e) {  } }
    });
  }

  var api = {
    line: line,
    hint: hint,
    prompt: prompt,
    has: function () { return !!deferred; },
    state: function () { return { rec: readRec(), session: sessionShown(), env: env(), bar: !!bar }; },
    onChange: function (fn) { listeners.push(fn); },
    room: room,
    mayOffer: mayOffer,
    afterShown: afterShown,
    afterAnswer: afterAnswer,
    settingsCase: settingsCase,
    hintWanted: hintWanted,
    REC: REC,
    SESSION: SESSION,
    MAX_SHOWN: MAX_SHOWN
  };
  global.ordparInstall = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this));
}catch(e){setTimeout(function(){throw e;});}
try{
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
}catch(e){setTimeout(function(){throw e;});}
try{
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
    if (e.en && sh.englishEntryRow) {
      var en = sh.englishEntryRow('a', e, '', 'ordpar-history-link');
      en.href = base() + 'bm-en/#en=' + encodeURIComponent(e.q);
      li.appendChild(en);
      return li;
    }
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

  function nbSnip(snip, e) {
    var L = global.ordparLookup;
    var word = String(e.word || '').split(' / ')[0];
    var drop = function () { if (snip.parentNode) { snip.parentNode.removeChild(snip); } };
    if (!word) { drop(); return; }
    snip.lang = 'nb';
    Promise.resolve(L.loadSnippets(L.snipKey(L.fold(word)))).then(function (snips) {
      var text = L.nbDef(snips, e.id);
      if (!text) { drop(); return; }
      snip.textContent = text;
      snip.classList.remove('is-pending');
    }).catch(drop);
  }

  function favRow(e, P) {
    if (favRows[e.id]) { return favRows[e.id]; }
    var wrap = global.ordparSearch.listRows([e], Object.create(null),
      { level: 2, mark: false, renumber: true });
    var row = wrap.firstChild;
    row.classList.add('ordpar-fav-row');
    var snip = row.querySelector('.ordpar-row-snippet');
    var L0 = global.ordparLookup;
    if (snip && e.translated && L0 && L0.nbRows && L0.nbRows()) {
      nbSnip(snip, e);
    } else if (snip && e.snip) {
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
      var fresh = ['lang', 'nbonly', 'nbequiv', 'nbrows', 'labels'];
      shell().onChange(function (key) {
        if (key === 'render' || fresh.indexOf(key) !== -1) { draw(fresh.indexOf(key) !== -1); }
      });
    }
  }

  function whenReady() { ((shell() && shell().ready) || Promise.resolve()).then(start); }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', whenReady); }
  else { whenReady(); }
}(typeof globalThis !== 'undefined' ? globalThis : this));
}catch(e){setTimeout(function(){throw e;});}
