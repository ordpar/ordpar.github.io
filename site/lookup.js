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

  function similarEntries(data) {
    if (!data) { return []; }
    var list = Array.isArray(data) ? data : (data.w || []);
    var bands = Array.isArray(data) ? '' : (data.f || '');
    var out = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
      out[i] = { w: list[i], f: fold(list[i]), b: bare(list[i]),
                 n: i < bands.length ? parseInt(bands.charAt(i), 16) : 0 };
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
      articles.sort(resultOrder);
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
      return { query: g.query, folded: folded, heads: heads, forms: forms, count: count };
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
          item.line = headLine(one, h.forms, p);
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
            band: e.n, gap: Math.abs(e.b.length - f.length), f: e.f, word: e.w };
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
            keep({ w: hit[0], f: fold(hit[0]), b: r, n: 0 }, wlim + 1, 0);
          }
        }
      });
      list.sort(function (a, b) {
        return (a.wd - b.wd) || (a.dist - b.dist) || (a.cd - b.cd) || (b.band - a.band) || (a.first - b.first) ||
          (a.gap - b.gap) || cmpStr(a.f, b.f) || cmpStr(a.word, b.word);
      });
      return list.slice(0, n).map(function (s) { return { word: s.word, dist: s.dist }; });
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

  var ordparLookup = {
    config: config, configure: configure, setLoader: setLoader,
    fold: fold, bare: bare, accentMatch: accentMatch,
    letterKey: letterKey, shardKey: shardKey, suggestKey: suggestKey,
    tailKey: tailKey, remainderKey: remainderKey, snipKey: snipKey, rewrites: rewrites, RULES: RULES, useList: useList,
    caseDistance: caseDistance, bagDistance: bagDistance, charCounts: charCounts,
    guard: guard, suggestQuery: suggestQuery, distance: distance, letterLimit: letterLimit, sharedWords: sharedWords,
    loadShard: loadShard, loadHeadwords: loadHeadwords, loadTails: loadTails,
    loadTranslated: loadTranslated, loadRandom: loadRandom, loadSnippets: loadSnippets,
    isGloss: isGloss, writeGloss: writeGloss, appendGlossText: appendGlossText,
    GLOSS_CLASS: GLOSS_CLASS, SEP_CLASS: SEP_CLASS,
    lookup: lookup, suggest: suggest, similar: similar, formHg: formHg, headParts: headParts, headText: headText, homographOrder: homographOrder, resultOrder: resultOrder, rankSuggestions: rankSuggestions, mergeArticles: mergeArticles, suggestSections: suggestSections, headLine: headLine,
    randomHeadword: randomHeadword, shownOrder: shownOrder, firstShown: firstShown,
    articleUrl: articleUrl, searchUrl: searchUrl,
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

  function posLabel(pos) {
    if (!pos) { return ''; }
    var label = t('pos.' + pos);
    return label === 'pos.' + pos ? '' : label;
  }

  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function roman(n) { return ROMAN[n] || String(n); }

  function homograph(node, hg) {
    if (!hg) { return; }
    var mark = el('span', 'ordbok-homograph ordpar-hg', roman(hg));
    mark.setAttribute('aria-hidden', 'true');
    node.appendChild(mark);
    node.appendChild(el('span', 'ordpar-visually-hidden', ' ' + t('results.homograph', { n: hg })));
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
    var pos = posLabel(a.pos);
    if (pos) { li.appendChild(el('span', 'ordpar-pos', pos)); }
    li.appendChild(el('span', a.translated ? 'ordpar-tag is-translated' : 'ordpar-tag',
      t(a.translated ? 'tag.translated' : 'tag.norwegianOnly')));
    return li;
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
        snip.lang = a.translated ? 'en' : 'nb';
        li.appendChild(snip);
      }
      ul.appendChild(li);
    });
    return ul;
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
    return { caption: cap ? cap[0] : '', fragment: page.slice(start, end).replace(/\s+$/, ''),
      notice: notice ? notice[0] : '', meta: pageMeta(page) };
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
    return p;
  }

  function mountArticle(host, a, got, level) {
    a = withMeta(a, got);
    host.innerHTML = got.caption + scopeArticle(got.fragment, a.id, level);
    host.appendChild(resultControls(a));
    if (got.notice) { host.insertAdjacentHTML('beforeend', got.notice); }
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
        if (got) { mountArticle(art, a, got, 3); return withMeta(a, got); }
        art.removeAttribute('aria-labelledby');
        art.textContent = '';
        var ul = el('ul', 'ordpar-hits-list');
        ul.appendChild(articleItem(a));
        art.appendChild(ul);
        return null;
      }));
    });
    wrap.shown = Promise.all(shown);
    return wrap;
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
      var pos = posLabel(a.pos);
      if (pos) { line.appendChild(el('span', 'ordpar-pos', pos)); }
      line.appendChild(el('span', a.translated ? 'ordpar-tag is-translated' : 'ordpar-tag',
        t(a.translated ? 'tag.translated' : 'tag.norwegianOnly')));
      btn.appendChild(el('span', 'ordpar-row-chevron'));
      btn.lastChild.setAttribute('aria-hidden', 'true');
      btn.appendChild(line);
      var snip = el('span', 'ordpar-row-snippet is-pending', '\u00a0');
      snip.setAttribute('data-snip', String(a.id));
      snip.lang = a.translated ? 'en' : 'nb';
      btn.appendChild(snip);
      head.appendChild(btn);
      row.appendChild(head);
      var panel = el('div', 'ordpar-row-panel');
      panel.id = 'r' + a.id + '-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', btn.id);
      panel.hidden = true;
      row.appendChild(panel);
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
    return wrap;
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
    if (!one.translated) { write(''); return Promise.resolve(); }
    var fromSnip = function () {
      var w = lemmaOf(one);
      if (!w) { write(''); return; }
      return loadSnippets(snipKey(fold(w))).then(function (snips) {
        var id = String(one.id);
        var drop = snips && snips._d && Object.prototype.hasOwnProperty.call(snips._d, id)
          ? snips._d[id] : null;
        write(dropRule(drop, snips && snips[id]));
      }, function () { write(''); });
    };
    if (!shownP) { return Promise.resolve(fromSnip()); }
    return shownP.then(function (lists) {
      var hit = null;
      [].concat.apply([], lists || []).forEach(function (b) { if (b && b.id === one.id) { hit = b; } });
      if (hit) { write(dropRule(hit.drop, hit.snip)); return; }
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
    for (var i = 0; i < spans.length; i++) {
      var id = spans[i].getAttribute('data-snip');
      var text = snips && snips[id];
      if (text) {
        writeGloss(spans[i], text, isGloss(snips, id));
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
    badge.appendChild(el('span', 'ordpar-visually-hidden',
      ' ' + t(count === 1 ? 'results.countOne' : 'results.count', { n: count })));
    h.appendChild(badge);
    return h;
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
    shell.onChange(function () {
      if (last && listMode() !== last.mode) { render(last.root, last.query); }
    });
  }

  function render(root, query, opts) {
    var record = !!(opts && opts.record);
    var results = root.querySelector('[data-ordpar-results]') || root;
    var mode = listMode();
    var list = false;
    last = { root: root, query: query, mode: mode };
    watchSetting();
    var mine = last;
    results.textContent = '';
    var g = guard(query);
    if (!g.ok) {
      if (g.reason === 'empty') {
        results.appendChild(el('p', 'ordpar-empty', t('results.empty')));
      } else {
        results.appendChild(el('p', 'ordpar-empty', t('search.' + g.reason)));
        announce(root, t('search.' + g.reason));
      }
      return Promise.resolve(null);
    }
    results.appendChild(el('p', 'ordpar-empty', t('results.searching')));
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
        }
        results.appendChild(hits);
      }
      res.forms.forEach(function (grp) {
        var sec = section('ordpar-inflected', t('results.inflected', { q: grp.form }));
        sec.appendChild(articleList(grp.articles));
        results.appendChild(sec);
      });
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
      if (record) { recordSearch(g.query, res, shown); }
      var E = global.ordparEvents;
      if (record && E) {
        try { if (res.count) { E.hit(g.query); } else { E.missStart(g.query); } } catch (e) {  }
      }
      if (!res.count) {
        var miss = el('section', 'ordpar-miss');
        miss.appendChild(el('h2', 'ordpar-section-title', t('results.none', { q: g.query })));
        miss.appendChild(el('p', 'ordpar-note', t('results.noneWhy')));
        results.appendChild(miss);
        announce(root, t('results.liveNone', { q: g.query }));
      } else {
        announce(root, t(res.count === 1 ? 'results.liveHitsOne' : 'results.liveHits',
          { n: res.count, q: g.query }));
      }
      return similar(g.query, null).then(function (words) {
        if (mine !== last) { return res; }
        if (words.length) {
          var sec = section('ordpar-similar', t('results.similar'));
          var ul = el('ul', 'ordpar-similar-list');
          words.forEach(function (s, i) {
            var li = el('li');
            var a = el('a', null, s.word);
            a.href = searchUrl(s.word);
            a.lang = 'nb';
            if (record && !res.count && E) {
              var choose = function () { try { E.missChoose(g.query, s.word, i + 1); } catch (e) {  } };
              a.addEventListener('click', choose);
              a.addEventListener('auxclick', function (ev) { if (ev.button === 1) { choose(); } });
            }
            ul.appendChild(li).appendChild(a);
          });
          sec.appendChild(ul);
          results.appendChild(sec);
        }
        return res;
      });
    });
  }

  function wireRandom(root) {
    var buttons = (root || global.document).querySelectorAll('[data-ordpar-random]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        randomHeadword().then(function (w) {
          btn.disabled = false;
          if (w == null) { return; }
          if (typeof w === 'number') { global.location.href = articleUrl(w); return; }
          var S = global.ordparShell;
          if (S && S.search && S.search(w, { random: true })) {
            if (global.scrollTo) { global.scrollTo(0, 0); }
            return;
          }
          global.location.href = searchUrl(w) + DRAWN_MARK;
        });
      });
    });
  }

  var DRAWN_MARK = '&random';

  var wiredLinks = false;
  var ordparSearch = {
    render: render,
    extractArticle: extractArticle, scopeArticle: scopeArticle, roman: roman, pageMeta: pageMeta,
    fetchArticle: fetchArticle,
    withMeta: withMeta, personalFields: personalFields, headwordInto: headwordInto, redrawFrom: redrawFrom,
    listRows: listRows,
    recordSearch: recordSearch, recordOpened: recordOpened, recordOnOpen: recordOnOpen,
    wireRandom: wireRandom,
    queryFromLocation: function () {
      var loc = global.location;
      if (!loc) { return ''; }
      var m = /^#q=([^&]*)/.exec(loc.hash || '') || /[?&]q=([^&#]*)/.exec(loc.search || '');
      if (!m) { return ''; }
      var raw = m[1].replace(/\+/g, ' ');
      try { return decodeURIComponent(raw); } catch (e) { return raw; }
    },
    DRAWN_MARK: DRAWN_MARK,
    takeDrawn: function () {
      var loc = global.location, h = global.history;
      if (!loc) { return false; }
      var hash = loc.hash || '';
      var at = hash.indexOf(DRAWN_MARK);
      if (hash.indexOf('#q=') === 0 && at > 0
          && (at + DRAWN_MARK.length === hash.length || hash.charAt(at + DRAWN_MARK.length) === '&')) {
        var q = ordparSearch.queryFromLocation();
        var rest = hash.slice(0, at) + hash.slice(at + DRAWN_MARK.length);
        try {
          if (h && h.replaceState) { h.replaceState({ q: q, random: true }, '', loc.pathname + loc.search + rest); }
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
        if (url.origin !== loc.origin || url.pathname !== loc.pathname || url.search
            || url.hash.indexOf('#q=') !== 0) { return; }
        e.preventDefault();
        var q = url.hash.slice(3).replace(/\+/g, ' ');
        try { q = decodeURIComponent(q); } catch (err) {  }
        onSearch(q.trim());
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
    }
  };

  global.ordparLookup = ordparLookup;
  global.ordparSearch = ordparSearch;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ordparLookup: ordparLookup, ordparSearch: ordparSearch };
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
