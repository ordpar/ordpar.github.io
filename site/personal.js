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
