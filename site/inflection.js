(function (global) {
  'use strict';


  var DEFAULT_STRINGS = {
    captionInflection: 'Inflection',
    captionParticiples: 'Participles',
    captionComparison: 'Degrees of comparison',
    indefiniteForm: 'indefinite form',
    definiteForm: 'definite form',
    singular: 'singular',
    plural: 'plural',
    masculine: 'masculine',
    feminine: 'feminine',
    neuter: 'neuter',
    mascFem: 'masculine / feminine',
    indefiniteNarrow: 'indefinite',
    definiteNarrow: 'definite',
    mascFemNarrow: 'masculine/ feminine',
    gender: 'gender',
    infinitive: 'infinitive',
    present: 'present',
    past: 'past',
    presentPerfect: 'present perfect',
    imperative: 'imperative',
    perfectParticiple: 'perfect participle',
    presentParticiple: 'present participle',
    degreesOfComparison: 'degrees of comparison',
    positive: 'positive',
    comparative: 'comparative',
    superlative: 'superlative',
    subjectForm: 'subject form',
    objectForm: 'object form',
    frameMasc: 'en',
    frameFem: 'ei/en',
    frameNeuter: 'et',
    frameInfinitive: 'å',
    framePerfect: 'har',
    frameImperative: '!',
    frameAdjNoun: '+ noun',
    frameDefiniteParticiple: 'den/det',
    unknownTag: 'unknown tag'
  };

  var NB_STRINGS = {
    captionInflection: 'Bøyning',
    captionParticiples: 'Partisipper',
    captionComparison: 'Gradbøyning',
    indefiniteForm: 'ubestemt form',
    definiteForm: 'bestemt form',
    singular: 'entall',
    plural: 'flertall',
    masculine: 'hankjønn',
    feminine: 'hunkjønn',
    neuter: 'intetkjønn',
    mascFem: 'hankjønn / hunkjønn',
    indefiniteNarrow: 'ubestemt',
    definiteNarrow: 'bestemt',
    mascFemNarrow: 'hankjønn/ hunkjønn',
    gender: 'kjønn',
    infinitive: 'infinitiv',
    present: 'presens',
    past: 'preteritum',
    presentPerfect: 'presens perfektum',
    imperative: 'imperativ',
    perfectParticiple: 'perfektum partisipp',
    presentParticiple: 'presens partisipp',
    degreesOfComparison: 'gradbøyning',
    positive: 'positiv',
    comparative: 'komparativ',
    superlative: 'superlativ',
    subjectForm: 'subjektsform',
    objectForm: 'objektsform',
    frameAdjNoun: '+ substantiv',
    unknownTag: 'ukjent merke'
  };


  var TAGS = {
    'Sing+Ind': { family: 'noun', table: 'main', order: 1, group: 'singular', qual: 'indefiniteForm', before: { str: '@gender' } },
    'Sing+Def': { family: 'noun', table: 'main', order: 2, group: 'singular', qual: 'definiteForm' },
    'Plur+Ind': { family: 'noun', table: 'main', order: 3, group: 'plural', qual: 'indefiniteForm' },
    'Plur+Def': { family: 'noun', table: 'main', order: 4, group: 'plural', qual: 'definiteForm' },

    'Inf': { family: 'verb', table: 'main', order: 1, label: 'infinitive', before: { str: 'frameInfinitive' } },
    'Pres': { family: 'verb', table: 'main', order: 2, label: 'present' },
    'Past': { family: 'verb', table: 'main', order: 3, label: 'past' },
    '<PerfPart>': { family: 'verb', table: 'main', order: 4, label: 'presentPerfect', before: { str: 'framePerfect' } },
    'Imp': { family: 'verb', table: 'main', order: 5, label: 'imperative', after: { str: 'frameImperative', tight: true } },
    'Inf+<SPass>': { family: 'verb', table: 'main', order: 1, label: 'infinitive', before: { str: 'frameInfinitive' } },
    'Pres+<SPass>': { family: 'verb', table: 'main', order: 2, label: 'present' },
    'Past+<SPass>': { family: 'verb', table: 'main', order: 3, label: 'past' },
    '<PerfPart>+<SPass>': { family: 'verb', table: 'main', order: 4, label: 'presentPerfect', before: { str: 'framePerfect' } },
    'Imp+<SPass>': { family: 'verb', table: 'main', order: 5, label: 'imperative', after: { str: 'frameImperative', tight: true } },
    'Adj+<PerfPart>+Masc/Fem+Ind+Sing': { family: 'verb', table: 'participle', order: 1, group: 'perfectParticiple', qual: 'mascFem', after: { str: 'frameAdjNoun' } },
    'Adj+<PerfPart>+Neuter+Ind+Sing': { family: 'verb', table: 'participle', order: 2, group: 'perfectParticiple', qual: 'neuter', after: { str: 'frameAdjNoun' } },
    'Adj+<PerfPart>+Def+Sing': { family: 'verb', table: 'participle', order: 3, group: 'perfectParticiple', qual: 'definiteForm', before: { str: 'frameDefiniteParticiple' }, after: { str: 'frameAdjNoun' } },
    'Adj+<PerfPart>+Plur': { family: 'verb', table: 'participle', order: 4, group: 'perfectParticiple', qual: 'plural', after: { str: 'frameAdjNoun' } },
    'Adj+<PresPart>': { family: 'verb', table: 'participle', order: 5, group: 'presentParticiple' },
    'Inf+Pass': { family: 'verb', table: null, drop: 'ordbokene shows no passive column' },
    'Pres+Pass': { family: 'verb', table: null, drop: 'ordbokene shows no passive column' },

    'Pos+Masc/Fem+Ind+Sing': { family: 'adj', table: 'main', order: 1, group: 'singular', qual: 'mascFem', qualIfFem: 'masculine' },
    'Pos+Fem+Ind+Sing': { family: 'adj', table: 'main', order: 2, group: 'singular', qual: 'feminine' },
    'Pos+Neuter+Ind+Sing': { family: 'adj', table: 'main', order: 3, group: 'singular', qual: 'neuter' },
    'Pos+Def+Sing': { family: 'adj', table: 'main', order: 4, group: 'singular', qual: 'definiteForm' },
    'Pos+Plur': { family: 'adj', table: 'main', order: 5, group: 'plural' },
    'Cmp': { family: 'adj', table: 'comparison', order: 1, top: 'degreesOfComparison', label: 'comparative' },
    'Sup+Ind': { family: 'adj', table: 'comparison', order: 2, top: 'degreesOfComparison', label: 'superlative', qual: 'indefiniteForm' },
    'Sup+Def': { family: 'adj', table: 'comparison', order: 3, top: 'degreesOfComparison', label: 'superlative', qual: 'definiteForm' },

    'Pos': { family: 'advdeg', table: 'comparison', order: 1, label: 'positive' },
    'Sup': { family: 'advdeg', table: 'comparison', order: 3, label: 'superlative' },

    'Masc+Ind+Sing': { family: 'detadj', table: 'main', order: 1, group: 'singular', qual: 'masculine' },
    'Fem+Ind+Sing': { family: 'detadj', table: 'main', order: 2, group: 'singular', qual: 'feminine' },
    'Neuter+Ind+Sing': { family: 'detadj', table: 'main', order: 3, group: 'singular', qual: 'neuter' },
    'Def+Sing': { family: 'detadj', table: 'main', order: 4, group: 'singular', qual: 'definiteForm' },
    'Plur': { family: 'detadj', table: 'main', order: 5, group: 'plural' },

    'Masc+Sing': { family: 'det', table: 'main', order: 1, group: 'singular', qual: 'masculine' },
    'Fem+Sing': { family: 'det', table: 'main', order: 2, group: 'singular', qual: 'feminine' },
    'Neuter+Sing': { family: 'det', table: 'main', order: 3, group: 'singular', qual: 'neuter' },

    'Nom': { family: 'pron', table: 'main', order: 1, qual: 'subjectForm' },
    'Acc': { family: 'pron', table: 'main', order: 2, qual: 'objectForm' }
  };

  var FAMILIES = [
    { name: 'verb', tables: ['main', 'participle'] },
    { name: 'noun', tables: ['main'] },
    { name: 'adj', tables: ['main', 'comparison'] },
    { name: 'advdeg', tables: ['comparison'] },
    { name: 'detadj', tables: ['main'] },
    { name: 'det', tables: ['main'] },
    { name: 'pron', tables: ['main'] }
  ];

  var CAPTIONS = { main: 'captionInflection', participle: 'captionParticiples', comparison: 'captionComparison' };

  var FAMILY_EXTRA = { advdeg: ['Cmp'], det: ['Plur'] };

  var FAMILY_NO_TOP = { advdeg: true };

  var JOIN_KINDS = [
    { name: 'imperative', has: ['Imp'] },
    { name: 'masculine/feminine', has: ['Masc/Fem'] },
    { name: 'feminine', has: ['Fem'] },
    { name: 'neuter', has: ['Neuter'] },
    { name: 'definite singular', has: ['Pos', 'Def', 'Sing'] },
    { name: 'plural', has: ['Pos', 'Plur'] },
    { name: 'present', has: ['Pres'] },
    { name: 'past', has: ['Past'] },
    { name: 'infinitive', has: ['Inf'], not: 'Pass' },
    { name: 'perfect participle plural', has: ['<PerfPart>', 'Plur'] },
    { name: 'present participle', has: ['<PresPart>'] },
    { name: 'definite plural', has: ['Plur', 'Def'] },
    { name: 'indefinite plural', has: ['Plur', 'Ind'] },
    { name: 'accusative', has: ['Acc'] }
  ];

  var NO_IMPERATIVE = { VERB_sPass: true };

  function collate(x, y) {
    return x.localeCompare ? x.localeCompare(y, 'nb') : (x < y ? -1 : (x > y ? 1 : 0));
  }

  var LEMMA_SORT = 'alphabetical';

  var GENDER_FRAME = { Masc: 'frameMasc', Fem: 'frameFem', Neuter: 'frameNeuter' };
  var GENDER_LABEL = { Masc: 'masculine', Fem: 'feminine', Neuter: 'neuter' };
  var GENDER_ORDER = ['Masc', 'Fem', 'Neuter'];


  var SHAPES = {"0s2q":[["NOUN","Fem"],"NOUN_regular",["Sing+Ind","Sing+Def","Plur+Ind","Plur+Def"]],"1cbf":[["PRON","Prs","3","Plur"],"PRON_regular",["Nom","Acc"]],"1gsp":[["VERB"],"VERB_regular",["Inf","Pres","Past","\u003cPerfPart>"]],"1sv9":[["VERB"],"VERB_regular",["Inf","Pres","Past","\u003cPerfPart>","Adj+\u003cPresPart>"]],"2o6p":[["ADJ"],"ADJ_regular",["Pos+Plur","Cmp","Sup+Ind","Sup+Def"]],"31d5":[["DET","Quant"],"DET_regular",["Plur"]],"39wq":[["PRON","Prs","2","Plur","Hum"],"PRON_regular",["Nom","Acc"]],"3nk2":[["VERB"],"VERB_regular",["Inf","Pres","Inf+Pass","Pres+Pass","Past","\u003cPerfPart>","Adj+\u003cPerfPart>+Neuter+Ind+Sing","Adj+\u003cPresPart>"]],"3o2s":[["NOUN","Neuter"],"NOUN_regular",["Sing+Ind","Plur+Ind"]],"3p3p":[["PRON","Prs","3","Sing","Masc","Hum"],"PRON_regular",["Nom","Acc"]],"4909":[["DET","Quant"],"DET_regular",["Neuter+Sing","Plur"]],"5szh":[["PRON","Prs","3","Sing","Hum"],"PRON_regular",["Nom","Acc"]],"5zay":[["PRON","Prs","3","Sing","Fem","Hum"],"PRON_regular",["Nom","Acc"]],"8fm0":[["NOUN"],"NOUN_regular",["Plur+Ind","Plur+Def"]],"9jjh":[["NOUN"],"NOUN_regular",["Plur+Ind"]],"ae8h":[["VERB"],"VERB_regular",["Inf","Pres","Inf+Pass","Pres+Pass","Past","\u003cPerfPart>","Adj+\u003cPerfPart>+Neuter+Ind+Sing","Adj+\u003cPerfPart>+Masc/Fem+Ind+Sing","Adj+\u003cPerfPart>+Def+Sing","Adj+\u003cPerfPart>+Plur","Adj+\u003cPresPart>","Imp"]],"b24z":[["NOUN","Neuter"],"NOUN_regular",["Sing+Ind","Sing+Def","Plur+Ind","Plur+Def"]],"c7vl":[["ADJ"],"ADJ_regular",["Cmp","Sup+Ind","Sup+Def"]],"c8f8":[["ADJ","Ord"],"ADJ_regular",["Pos+Masc/Fem+Ind+Sing","Pos+Plur","Pos+Def+Sing","Pos+Neuter+Ind+Sing"]],"cnt9":[["ADV"],"ADV_adj",["Pos","Cmp","Sup"]],"cyhq":[["NOUN","Masc"],"NOUN_regular",["Sing+Ind","Sing+Def","Plur+Ind","Plur+Def"]],"cz77":[["ADJ"],"ADJ_regular",["Pos+Masc/Fem+Ind+Sing","Pos+Plur","Pos+Def+Sing","Pos+Neuter+Ind+Sing","Cmp","Sup+Ind","Sup+Def"]],"d0l6":[["DET","Poss"],"DET_regular",["Masc+Sing","Fem+Sing","Neuter+Sing","Plur"]],"eh23":[["DET","Intens","\u003cADJ>"],"DET_adj",["Masc+Ind+Sing","Fem+Ind+Sing","Neuter+Ind+Sing","Def+Sing","Plur"]],"guwy":[["NOUN","Neuter"],"NOUN_regular",["Plur+Ind","Plur+Def"]],"h96d":[["NOUN","Masc"],"NOUN_regular",["Plur+Ind","Plur+Def"]],"hd0k":[["VERB"],"VERB_sPass",["Inf+\u003cSPass>","Pres+\u003cSPass>","Past+\u003cSPass>","\u003cPerfPart>+\u003cSPass>"]],"hted":[["DET","Int"],"DET_regular",["Masc+Sing","Fem+Sing","Neuter+Sing","Plur"]],"ivun":[["VERB"],"VERB_sPass",["Inf+\u003cSPass>","Pres+\u003cSPass>","Past+\u003cSPass>","\u003cPerfPart>+\u003cSPass>","Imp+\u003cSPass>"]],"l703":[["NOUN","Neuter"],"NOUN_regular",["Sing+Ind","Sing+Def"]],"mgel":[["NOUN"],"ADJ_regular",["Pos+Masc/Fem+Ind+Sing","Pos+Plur","Pos+Def+Sing","Pos+Neuter+Ind+Sing"]],"mich":[["PRON","Prs","1","Plur","Hum"],"PRON_regular",["Nom","Acc"]],"n7l7":[["ADJ"],"ADJ_masc/fem_fem",["Pos+Masc/Fem+Ind+Sing","Pos+Fem+Ind+Sing","Pos+Neuter+Ind+Sing","Pos+Def+Sing","Pos+Plur","Cmp","Sup+Ind","Sup+Def"]],"nroq":[["Masc"],"NOUN_regular",["Sing+Ind","Sing+Def","Plur+Ind","Plur+Def"]],"opgj":[["ADJ"],"ADJ_regular",["Pos+Masc/Fem+Ind+Sing","Pos+Plur","Pos+Def+Sing","Pos+Neuter+Ind+Sing"]],"oro4":[["ABBR","Masc"],"NOUN_regular",["Sing+Ind","Sing+Def","Plur+Ind","Plur+Def"]],"oztc":[["ADJ"],"ADJ_masc/fem_fem",["Pos+Masc/Fem+Ind+Sing","Pos+Fem+Ind+Sing","Pos+Neuter+Ind+Sing","Pos+Def+Sing","Pos+Plur"]],"pixy":[["DET","Dem"],"DET_regular",["Masc+Sing","Fem+Sing","Neuter+Sing","Plur"]],"qiv5":[["VERB"],"VERB_regular",["Inf","Pres","Past"]],"r0y7":[["NOUN","Fem"],"NOUN_regular",["Sing+Def"]],"r1sa":[["VERB"],"VERB_regular",["Inf","Pres","Past","\u003cPerfPart>","Adj+\u003cPerfPart>+Neuter+Ind+Sing","Adj+\u003cPresPart>","Imp"]],"r4aj":[["ADJ","Ord"],"ADJ_regular",["Pos+Masc/Fem+Ind+Sing","Pos+Neuter+Ind+Sing"]],"s7na":[["DET","Dem","\u003cADJ>"],"DET_adj",["Masc+Ind+Sing","Fem+Ind+Sing","Neuter+Ind+Sing","Def+Sing","Plur"]],"tb6y":[["PRON","Prs","2","Sing","Hum"],"PRON_regular",["Nom","Acc"]],"ujh2":[["VERB"],"VERB_regular",["Inf","Pres","Inf+Pass","Pres+Pass","Past","\u003cPerfPart>","Adj+\u003cPresPart>","Imp"]],"uyit":[["NOUN","Fem"],"NOUN_regular",["Sing+Ind","Sing+Def"]],"vcy2":[["NOUN","Fem"],"NOUN_regular",["Plur+Ind","Plur+Def"]],"vmja":[["VERB"],"VERB_regular",["Inf","Pres","Past","\u003cPerfPart>","Adj+\u003cPerfPart>+Neuter+Ind+Sing","Adj+\u003cPerfPart>+Masc/Fem+Ind+Sing","Adj+\u003cPerfPart>+Def+Sing","Adj+\u003cPerfPart>+Plur","Adj+\u003cPresPart>","Imp"]],"wlja":[["VERB"],"VERB_regular",["Inf","Pres","Inf+Pass","Pres+Pass","Past","\u003cPerfPart>","Adj+\u003cPerfPart>+Neuter+Ind+Sing","Adj+\u003cPerfPart>+Masc/Fem+Ind+Sing","Adj+\u003cPerfPart>+Def+Sing","Adj+\u003cPerfPart>+Plur","Adj+\u003cPresPart>"]],"y6rx":[["NOUN","Masc"],"NOUN_regular",["Sing+Ind","Sing+Def"]],"y70j":[["PRON","Prs","1","Sing","Hum"],"PRON_regular",["Nom","Acc"]],"ydtu":[["DET","Quant"],"DET_regular",["Masc+Sing","Fem+Sing","Neuter+Sing","Plur"]],"ygoh":[["PRON","Refl"],"PRON_regular",["Acc"]],"z5lz":[["NOUN","Masc"],"NOUN_regular",["Sing+Def"]],"zy0m":[["DET","Quant"],"DET_regular",["Masc+Sing","Fem+Sing","Neuter+Sing"]]};

  function decode(data, shapes) {
    if (!(data instanceof Array) || !data.length || !(data[0] instanceof Array)) return data;
    var table = shapes || SHAPES, lemmas = [], i, j, k;
    for (i = 0; i < data.length; i++) {
      var lem = data[i], pars = [];
      for (j = 1; j < lem.length; j++) {
        var p = lem[j], shape = table[p[0]];
        if (!shape) continue;
        var cells = [], seq = shape[2];
        for (k = 0; k < seq.length; k++) cells.push({ tags: seq[k].split('+'), word_form: p[k + 1] });
        pars.push({ tags: shape[0], inflection_group: shape[1], inflection: cells });
      }
      lemmas.push({ lemma: lem[0], paradigm_info: pars });
    }
    return { lemmas: lemmas };
  }

  function familyTags(name) {
    var out = [], tag;
    for (tag in TAGS) {
      if (Object.prototype.hasOwnProperty.call(TAGS, tag) && TAGS[tag].family === name) out.push(tag);
    }
    return out.concat(FAMILY_EXTRA[name] || []);
  }

  function resolveFamily(tags) {
    var best = null, bestScore = 0;
    for (var i = 0; i < FAMILIES.length; i++) {
      var own = familyTags(FAMILIES[i].name), score = 0;
      for (var j = 0; j < tags.length; j++) if (own.indexOf(tags[j]) !== -1) score++;
      if (score === tags.length) return FAMILIES[i].name;
      if (score > bestScore) { bestScore = score; best = FAMILIES[i].name; }
    }
    return best;
  }

  function columnFor(family, tag) {
    var col = TAGS[tag];
    if (!col) return null;
    if (col.family === family) return col;
    if (FAMILY_EXTRA[family] && FAMILY_EXTRA[family].indexOf(tag) !== -1) return col;
    return null;
  }

  function readRows(lemmas) {
    var rows = [], i, j, k;
    var list = (lemmas || []).slice();
    if (LEMMA_SORT === 'alphabetical') {
      list = list.map(function (lem, idx) { return { lem: lem, idx: idx }; });
      list.sort(function (a, b) {
        var x = String((a.lem && a.lem.lemma) || ''), y = String((b.lem && b.lem.lemma) || '');
        var c = x.localeCompare ? x.localeCompare(y, 'nb') : (x < y ? -1 : (x > y ? 1 : 0));
        return c !== 0 ? c : a.idx - b.idx;
      });
      list = list.map(function (w) { return w.lem; });
    }
    for (i = 0; i < list.length; i++) {
      var lemma = list[i] || {};
      var paradigms = lemma.paradigm_info || [];
      for (j = 0; j < paradigms.length; j++) {
        var par = paradigms[j] || {};
        if (par.to) continue;
        var cells = {}, tags = [], gender = null, ptags = par.tags || [], hide = {};
        if (NO_IMPERATIVE[par.inflection_group]) { hide['Imp'] = true; hide['Imp+<SPass>'] = true; }
        for (k = 0; k < ptags.length; k++) {
          if (GENDER_FRAME[ptags[k]]) gender = ptags[k];
        }
        var infl = par.inflection || [];
        for (k = 0; k < infl.length; k++) {
          var cell = infl[k] || {};
          var ct = cell.tags || [];
          if (!ct.length || cell.word_form === null || cell.word_form === undefined) continue;
          var tag = ct.join('+');
          if (!cells[tag]) { cells[tag] = []; tags.push(tag); }
          if (cells[tag].indexOf(cell.word_form) === -1) cells[tag].push(cell.word_form);
        }
        if (!tags.length) continue;
        rows.push({
          lemma: lemma.lemma || '',
          lemmaIndex: i,
          gender: gender,
          family: resolveFamily(tags),
          tags: tags,
          cells: cells,
          hide: hide
        });
      }
    }
    return rows;
  }


  function inKind(tag, kind) {
    var parts = tag.split('+');
    for (var i = 0; i < kind.has.length; i++) if (parts.indexOf(kind.has[i]) === -1) return false;
    return !(kind.not && parts.indexOf(kind.not) !== -1);
  }

  function signature(row, kind) {
    var keys = [], k;
    for (k in row.cells) {
      if (!Object.prototype.hasOwnProperty.call(row.cells, k)) continue;
      if (!row.cells[k].length || (kind && inKind(k, kind))) continue;
      keys.push(k);
    }
    keys.sort();
    return keys.map(function (t) {
      return t + '=' + row.cells[t].slice().sort().join('\u0001');
    }).join('\u0002');
  }

  function absorb(into, from) {
    var t, m, h;
    for (t in from.cells) {
      if (!Object.prototype.hasOwnProperty.call(from.cells, t)) continue;
      if (!into.cells[t]) { into.cells[t] = []; into.tags.push(t); }
      for (m = 0; m < from.cells[t].length; m++) {
        if (into.cells[t].indexOf(from.cells[t][m]) === -1) into.cells[t].push(from.cells[t][m]);
      }
    }
    for (h in from.hide) if (Object.prototype.hasOwnProperty.call(from.hide, h)) into.hide[h] = true;
  }

  function mergeStep(rows, kind) {
    var out = [], bySig = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = r.lemmaIndex + '\u0003' + (r.gender || '') + '\u0003' + (r.family || '') +
        '\u0003' + signature(r, kind);
      if (Object.prototype.hasOwnProperty.call(bySig, key)) absorb(bySig[key], r);
      else { bySig[key] = r; out.push(r); }
    }
    return out;
  }

  function mergeRows(rows) {
    var out = rows.map(function (r) {
      var hide = {}, h;
      for (h in r.hide) if (Object.prototype.hasOwnProperty.call(r.hide, h)) hide[h] = true;
      return { lemma: r.lemma, lemmaIndex: r.lemmaIndex, gender: r.gender, family: r.family,
               tags: r.tags.slice(), cells: copyCells(r.cells), hide: hide };
    });
    out = mergeStep(out, null);
    for (var k = 0; k < JOIN_KINDS.length; k++) out = mergeStep(out, JOIN_KINDS[k]);
    out.forEach(function (r) {
      for (var t in r.cells) if (Object.prototype.hasOwnProperty.call(r.cells, t)) r.cells[t].sort(collate);
    });
    return out;
  }

  function shown(row, tag) {
    return row.hide[tag] ? [] : (row.cells[tag] || []);
  }


  function el(name, cls, text) {
    var node = global.document.createElement(name);
    if (cls) node.setAttribute('class', cls);
    if (text !== undefined && text !== null && text !== '') put(node, text);
    return node;
  }

  function put(node, text) {
    var doc = global.document;
    if (typeof text === 'string') { node.appendChild(doc.createTextNode(text)); return; }
    var en = node.appendChild(doc.createElement('span'));
    en.setAttribute('class', 'ordpar-w-en');
    en.appendChild(doc.createTextNode(text.en));
    var nb = node.appendChild(doc.createElement('span'));
    nb.setAttribute('class', 'ordpar-w-nb');
    nb.setAttribute('lang', 'nb');
    nb.setAttribute('data-nosnippet', '');
    nb.appendChild(doc.createTextNode(text.nb));
  }
  function plain(text) { return typeof text === 'string' ? text : text.en; }

  function hiddenLabel(name, cls, text) {
    var node = el(name, cls);
    var span = name === 'span' ? node : node.appendChild(el('span'));
    span.setAttribute('data-nosnippet', '');
    if (text) put(span, text);
    return node;
  }

  function spaced(node) {
    var kids = node && node.childNodes, doc = global.document, i;
    if (!kids || !node.insertBefore || !doc || !doc.createTextNode) return node;
    for (i = kids.length - 1; i > 0; i--) {
      if (kids[i].nodeType === 1 && kids[i - 1].nodeType === 1) {
        node.insertBefore(global.document.createTextNode('\n'), kids[i]);
      }
    }
    return node;
  }

  function spaceTable(t) {
    spaced(t);
    if (!t.querySelectorAll) return t;
    var parts = t.querySelectorAll('thead, tbody, tr, th');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].tagName === 'TH' && !parts[i].querySelector('.ordpar-th-qual')) continue;
      spaced(parts[i]);
    }
    return t;
  }

  function str(strings, key) {
    if (!key) return '';
    var en = Object.prototype.hasOwnProperty.call(strings, key) ? strings[key] : key;
    var nb = strings.__nb && Object.prototype.hasOwnProperty.call(strings.__nb, key) ? strings.__nb[key] : null;
    return nb && nb !== en ? { en: en, nb: nb } : en;
  }

  function copyCells(cells) {
    var out = {}, k;
    for (k in cells) if (Object.prototype.hasOwnProperty.call(cells, k)) out[k] = cells[k].slice();
    return out;
  }


  function buildColumns(family, tableName, rows) {
    var seen = {}, cols = [], unknown = [], i, t;
    for (i = 0; i < rows.length; i++) {
      for (t = 0; t < rows[i].tags.length; t++) {
        var tag = rows[i].tags[t];
        if (seen[tag]) continue;
        seen[tag] = true;
        var spec = columnFor(family, tag);
        if (!spec) {
          if (tableName === 'main') {
            unknown.push({ tag: tag, unknown: true, order: 1000 + unknown.length });
          }
          continue;
        }
        if (spec.table !== tableName) continue;
        cols.push({
          tag: tag, top: FAMILY_NO_TOP[family] ? null : spec.top, group: spec.group, label: spec.label, qual: spec.qual,
          qualIfFem: spec.qualIfFem, before: spec.before, after: spec.after, order: spec.order || 0
        });
      }
    }
    cols.sort(function (a, b) { return a.order - b.order; });
    cols = cols.concat(unknown);
    cols = cols.filter(function (col) {
      for (var r = 0; r < rows.length; r++) {
        if (shown(rows[r], col.tag).length) return true;
      }
      return false;
    });
    var hasFem = false;
    cols.forEach(function (c) { if (c.tag === 'Pos+Fem+Ind+Sing') hasFem = true; });
    if (hasFem) cols.forEach(function (c) { if (c.qualIfFem) c.qual = c.qualIfFem; });
    return cols;
  }

  function cellKey(row, col) {
    var v = shown(row, col.tag);
    if (!v.length) return null;
    var byGender = col.before && col.before.str === '@gender';
    return (byGender ? (row.gender || '') : '') + ' ' + v.join('');
  }

  var PARTICIPLE_FRAMES = { frameAdjNoun: 1, frameDefiniteParticiple: 1 };
  function frameClass(key) {
    return PARTICIPLE_FRAMES[key] ? 'ordpar-frame ordpar-frame--participle' : 'ordpar-frame';
  }

  function fillCell(td, row, col, strings, plain, keep) {
    var v = shown(row, col.tag);
    if (!v.length) return;
    var span, key, i, doc = global.document, at;
    if (plain) {
      td.appendChild(doc.createTextNode(v.join(', ')));
      return;
    }
    var before = col.before ? (col.before.str === '@gender' ? GENDER_FRAME[row.gender] : col.before.str) : null;
    for (i = 0; i < v.length; i++) {
      if (i) td.appendChild(doc.createTextNode(', '));
      at = keep ? td.appendChild(el('span', 'ordpar-form')) : td;
      if (before) {
        at.appendChild(el('span', frameClass(before), str(strings, before)));
        at.appendChild(doc.createTextNode(' '));
      }
      at.appendChild(doc.createTextNode(v[i]));
      if (col.after) {
        if (!col.after.tight) at.appendChild(doc.createTextNode(' '));
        key = col.after.str;
        span = el('span', frameClass(key) + (keep ? ' ordpar-frame-after' : ''), str(strings, key));
        if (key === 'frameAdjNoun') span.setAttribute('lang', 'en');
        at.appendChild(span);
      }
    }
  }

  var NARROW_STRINGS = { indefiniteForm: 'indefiniteNarrow', definiteForm: 'definiteNarrow', mascFem: 'mascFemNarrow' };

  function headerCell(col, strings, scope, narrow) {
    var nk = function (key) { return narrow && NARROW_STRINGS[key] ? NARROW_STRINGS[key] : key; };
    var th = el('th');
    th.setAttribute('scope', scope || 'col');
    if (col.unknown) {
      th.setAttribute('class', 'ordpar-unknown');
      th.setAttribute('title', plain(str(strings, 'unknownTag')) + ': ' + col.tag);
      th.appendChild(el('span', 'ordpar-th-label', col.tag));
      th.appendChild(el('span', 'ordpar-th-qual', str(strings, 'unknownTag')));
      return th;
    }
    if (col.label) th.appendChild(el('span', 'ordpar-th-label', str(strings, nk(col.label))));
    if (col.qual) th.appendChild(el('span', 'ordpar-th-qual', str(strings, nk(col.qual))));
    return th;
  }

  function sections(cols) {
    var out = [], i = 0, n;
    while (i < cols.length) {
      var key = cols[i].top || cols[i].group || null;
      n = 1;
      while (i + n < cols.length && ((cols[i + n].top || cols[i + n].group || null) === key)) n++;
      var bare = n === 1 && !cols[i].label && !cols[i].qual && !cols[i].unknown;
      out.push({ key: key, at: i, n: n, bare: bare });
      i += n;
    }
    return out;
  }

  function renderNarrow(models, strings) {
    var model = models[0], body = model.body;
    var width = 1 + body.length, i, c, tr, th, m;
    var cls = 'ordpar-infl ordpar-infl--narrow';
    for (m = 0; m < models.length; m++) cls += ' ordpar-infl--' + models[m].tableName;
    var table = el('table', cls);
    table.appendChild(hiddenLabel('caption', 'ordpar-vh', str(strings, models.length > 1 ? 'captionInflection' : (CAPTIONS[model.tableName] || 'captionInflection'))));

    if (model.genderAxis) {
      var thead = el('thead');
      tr = el('tr');
      var corner = el('th', 'ordpar-corner');
      corner.setAttribute('scope', 'col');
      corner.appendChild(hiddenLabel('span', 'ordpar-vh', str(strings, 'gender')));
      tr.appendChild(corner);
      for (i = 0; i < model.genderGroups.length; i++) {
        var gg = model.genderGroups[i];
        th = el('th', 'ordpar-th-row', str(strings, GENDER_LABEL[gg.gender] || gg.gender));
        th.setAttribute('scope', gg.n > 1 ? 'colgroup' : 'col');
        if (gg.n > 1) th.setAttribute('colspan', String(gg.n));
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    for (m = 0; m < models.length; m++) {
      var cols = models[m].cols, spans = models[m].spans;
      var plain = models[m].tableName === 'participle';
      var secs = sections(cols);
      for (var s = 0; s < secs.length; s++) {
        var sec = secs[s], tbody = el('tbody');
        if (sec.key) {
          tr = el('tr');
          th = el('th', 'ordpar-th-group', str(strings, sec.key));
          th.setAttribute('scope', 'rowgroup');
          th.setAttribute('colspan', String(width));
          tr.appendChild(th);
          tbody.appendChild(tr);
        }
        for (c = sec.at; c < sec.at + sec.n; c++) {
          tr = el('tr');
          if (sec.bare) {
            th = el('th', 'ordpar-th-row');
            th.setAttribute('scope', 'row');
            th.appendChild(hiddenLabel('span', 'ordpar-vh', str(strings, sec.key)));
          } else {
            th = headerCell(cols[c], strings, 'row', true);
          }
          tr.appendChild(th);
          for (i = 0; i < body.length; i++) {
            if (spans[c][i] === 0) continue;
            var td = el('td', cols[c].unknown ? 'ordpar-unknown' : null);
            td.setAttribute('lang', 'nb');
            if (spans[c][i] > 1) td.setAttribute('colspan', String(spans[c][i]));
            fillCell(td, body[i], cols[c], strings, plain);
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
      }
    }
    return spaceTable(table);
  }

  function prepareFamily(family, rows) {
    var tables = familyTables(family), i, k;
    var body = mergeRows(rows);
    var tables_ = [];
    for (i = 0; i < tables.length; i++) {
      var cols = buildColumns(family, tables[i], body);
      tables_.push({ name: tables[i], cols: cols });
    }
    var genders = [];
    if (family === 'noun') {
      body.forEach(function (r) { if (r.gender && genders.indexOf(r.gender) === -1) genders.push(r.gender); });
    }
    var genderAxis = genders.length > 1;
    body.sort(function (a, b) {
      if (genderAxis) {
        var g = GENDER_ORDER.indexOf(a.gender) - GENDER_ORDER.indexOf(b.gender);
        if (g !== 0) return g;
      }
      if (a.lemmaIndex !== b.lemmaIndex) return a.lemmaIndex - b.lemmaIndex;
      var seq = a.tags.concat(b.tags.filter(function (t) { return a.tags.indexOf(t) === -1; }));
      for (k = 0; k < seq.length; k++) {
        var c = collate((a.cells[seq[k]] || []).join(', '), (b.cells[seq[k]] || []).join(', '));
        if (c !== 0) return c;
      }
      return 0;
    });
    return { body: body, genderAxis: genderAxis, tables: tables_ };
  }

  function familyTables(name) {
    for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].name === name) return FAMILIES[i].tables;
    return ['main'];
  }

  function buildTable(prep, t, strings, mode) {
    var tableName = prep.tables[t].name, cols = prep.tables[t].cols;
    if (!cols.length) return null;
    var body = prep.body, genderAxis = prep.genderAxis;

    var spans = [], r, run, s, i, c;
    for (i = 0; i < cols.length; i++) {
      spans[i] = [];
      r = 0;
      while (r < body.length) {
        var key = cellKey(body[r], cols[i]);
        run = 1;
        if (key !== null) {
          while (r + run < body.length && cellKey(body[r + run], cols[i]) === key) run++;
        }
        spans[i][r] = run;
        for (s = 1; s < run; s++) spans[i][r + s] = 0;
        r += run;
      }
    }
    var genderSpan = {}, genderGroups = [];
    if (genderAxis) {
      for (i = 0; i < body.length; i++) {
        var g0 = body[i].gender;
        if (genderSpan[g0] === undefined) {
          genderSpan[g0] = { at: i, n: 0 };
          genderGroups.push({ gender: g0, at: i, n: 0 });
        }
        genderSpan[g0].n++;
        genderGroups[genderGroups.length - 1].n = genderSpan[g0].n;
      }
    }
    var model = {
      tableName: tableName, cols: cols, body: body, spans: spans,
      genderAxis: genderAxis, genderSpan: genderSpan, genderGroups: genderGroups
    };
    if (mode === 'narrow') return model;

    var table = el('table', 'ordpar-infl ordpar-infl--wide ordpar-infl--' + tableName);
    table.appendChild(hiddenLabel('caption', 'ordpar-vh', str(strings, CAPTIONS[tableName] || 'captionInflection')));

    var hasTop = false, hasGroup = false, hasCell = false;
    cols.forEach(function (c) {
      if (c.top) hasTop = true;
      if (c.group) hasGroup = true;
      if (c.label || c.qual || c.unknown) hasCell = true;
    });
    var headRows = (hasTop ? 1 : 0) + (hasGroup ? 1 : 0) + (hasCell ? 1 : 0);
    var thead = el('thead'), tr = el('tr'), n, q, p;

    if (genderAxis) {
      var corner = el('th', 'ordpar-corner');
      corner.setAttribute('scope', 'col');
      if (headRows > 1) corner.setAttribute('rowspan', String(headRows));
      corner.appendChild(el('span', 'ordpar-th-qual', str(strings, 'gender')));
      tr.appendChild(corner);
    }

    if (hasTop) {
      i = 0;
      while (i < cols.length) {
        var topKey = cols[i].top || null;
        n = 1;
        while (i + n < cols.length && (cols[i + n].top || null) === topKey) n++;
        var thTop = el('th', 'ordpar-th-group', topKey ? str(strings, topKey) : '');
        thTop.setAttribute('scope', n > 1 ? 'colgroup' : 'col');
        if (n > 1) thTop.setAttribute('colspan', String(n));
        tr.appendChild(thTop);
        i += n;
      }
      thead.appendChild(tr);
      tr = el('tr');
    }

    if (hasGroup) {
      i = 0;
      while (i < cols.length) {
        var groupKey = cols[i].group || null;
        n = 1;
        while (i + n < cols.length && (cols[i + n].group || null) === groupKey) n++;
        var thGroup = el('th', 'ordpar-th-group', groupKey ? str(strings, groupKey) : '');
        thGroup.setAttribute('scope', n > 1 ? 'colgroup' : 'col');
        if (n > 1) thGroup.setAttribute('colspan', String(n));
        var bare = true;
        for (q = i; q < i + n; q++) if (cols[q].label || cols[q].qual || cols[q].unknown) bare = false;
        if (bare && hasCell) thGroup.setAttribute('rowspan', '2');
        tr.appendChild(thGroup);
        for (p = i; p < i + n; p++) cols[p]._bare = bare;
        i += n;
      }
      thead.appendChild(tr);
      tr = el('tr');
    }

    if (hasCell) {
      for (i = 0; i < cols.length; i++) {
        if (hasGroup && cols[i]._bare) continue;
        tr.appendChild(headerCell(cols[i], strings));
      }
      thead.appendChild(tr);
    }
    table.appendChild(thead);

    var tbody = el('tbody');
    for (i = 0; i < body.length; i++) {
      tr = el('tr');
      if (genderAxis) {
        var gi = genderSpan[body[i].gender];
        if (gi && gi.at === i) {
          var thRow = el('th', 'ordpar-th-row', str(strings, GENDER_LABEL[body[i].gender] || body[i].gender));
          thRow.setAttribute('scope', gi.n > 1 ? 'rowgroup' : 'row');
          if (gi.n > 1) thRow.setAttribute('rowspan', String(gi.n));
          tr.appendChild(thRow);
        }
      }
      for (c = 0; c < cols.length; c++) {
        if (spans[c][i] === 0) continue;
        var td = el('td', cols[c].unknown ? 'ordpar-unknown' : null);
        td.setAttribute('lang', 'nb');
        if (spans[c][i] > 1) td.setAttribute('rowspan', String(spans[c][i]));
        fillCell(td, body[i], cols[c], strings, false, true);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return spaceTable(table);
  }


  function render(lemmas, strings) {
    var s = {}, k;
    for (k in DEFAULT_STRINGS) if (Object.prototype.hasOwnProperty.call(DEFAULT_STRINGS, k)) s[k] = DEFAULT_STRINGS[k];
    if (strings) for (k in strings) if (Object.prototype.hasOwnProperty.call(strings, k)) s[k] = strings[k];
    if (!Object.prototype.hasOwnProperty.call(s, '__nb')) s.__nb = strings ? null : NB_STRINGS;

    var wrap = el('div', 'ordpar-inflection-tables');
    var rows = readRows(lemmas);
    if (!rows.length) return wrap;

    var order = [], byFamily = {};
    rows.forEach(function (r) {
      var name = r.family || ' unknown';
      if (!byFamily[name]) { byFamily[name] = []; order.push(name); }
      byFamily[name].push(r);
    });
    order.forEach(function (name) {
      var prep = prepareFamily(name, byFamily[name]), models = [];
      for (var i = 0; i < prep.tables.length; i++) {
        var wide = buildTable(prep, i, s);
        if (!wide) continue;
        models.push(buildTable(prep, i, s, 'narrow'));
        var boxW = el('div', 'ordpar-infl-wrap ordpar-infl-wrap--wide');
        boxW.appendChild(wide);
        wrap.appendChild(boxW);
      }
      if (models.length) {
        var boxN = el('div', 'ordpar-infl-wrap ordpar-infl-wrap--narrow');
        boxN.appendChild(renderNarrow(models, s));
        wrap.appendChild(boxN);
      }
    });
    return spaced(wrap);
  }


  function mountAll(root) {
    var doc = global.document;
    var nodes = (root || doc).querySelectorAll('.ordpar-inflection');
    for (var i = 0; i < nodes.length; i++) {
      var host = nodes[i];
      if (host.getAttribute('data-ordpar-mounted')) continue;
      var id = host.getAttribute('data-paradigm');
      var script = id ? doc.getElementById(id) : null;
      if (!script) continue;
      var data;
      try {
        data = decode(JSON.parse(script.textContent || script.innerHTML || '{}'));
      } catch (e) {
        continue;
      }
      var lemmas = (data && data.lemmas) ? data.lemmas : (data instanceof Array ? data : []);
      host.appendChild(render(lemmas));
      host.setAttribute('data-ordpar-mounted', '1');
      var toggle = host.closest ? host.closest('.ordpar-infl-toggle') : null;
      if (toggle && host.querySelector('table')) toggle.hidden = false;
      fitHost(host);
    }
  }


  function measured(t, width) {
    var w = t.style.width, mw = t.style.maxWidth;
    t.style.width = width;
    t.style.maxWidth = 'none';
    var x = t.getBoundingClientRect().width;
    t.style.width = w;
    t.style.maxWidth = mw;
    return x;
  }

  function gridColumns(t) {
    var cols = [], taken = [], rows = t.rows, r, i, j, c, cell, cs, rs;
    for (r = 0; r < rows.length; r++) {
      c = 0;
      for (i = 0; i < rows[r].cells.length; i++) {
        cell = rows[r].cells[i];
        while (taken[r] && taken[r][c]) c++;
        cs = cell.colSpan || 1;
        rs = cell.rowSpan || 1;
        for (j = 0; j < rs * cs; j++) {
          (taken[r + Math.floor(j / cs)] = taken[r + Math.floor(j / cs)] || [])[c + j % cs] = 1;
        }
        if (cs === 1) (cols[c] = cols[c] || []).push(cell);
        c += cs;
      }
    }
    return cols.filter(function (x) { return x && x.length; });
  }

  function whole(cells, on) {
    for (var i = 0; i < cells.length; i++) cells[i].classList[on ? 'add' : 'remove']('ordpar-col-whole');
  }

  function stackColumns(t, avail) {
    var cols = gridColumns(t), widths = [], left = [], k, mw = t.style.maxWidth;
    for (k = 0; k < cols.length; k++) whole(cols[k], true);
    t.classList.add('ordpar-infl--stacked');
    t.style.maxWidth = 'none';
    for (k = 0; k < cols.length; k++) { widths.push(cols[k][0].getBoundingClientRect().width); left.push(k); }
    t.style.maxWidth = mw;
    var now = measured(t, 'min-content');
    while (now > avail && left.length) {
      var best = -1, bestFree = 0, bestNow = now;
      for (var j = 0; j < left.length; j++) {
        whole(cols[left[j]], false);
        var x = measured(t, 'min-content'), free = now - x;
        whole(cols[left[j]], true);
        if (best < 0 || free > bestFree + 0.01 ||
            (Math.abs(free - bestFree) <= 0.01 && widths[left[j]] > widths[left[best]] + 0.01)) {
          best = j; bestFree = free; bestNow = x;
        }
      }
      whole(cols[left[best]], false);
      left.splice(best, 1);
      now = bestNow;
    }
  }

  function fitTables(tables) {
    if (!tables.clientWidth) return;
    var avail = tables.getBoundingClientRect().width;
    tables.classList.remove('ordpar-fit-narrow');
    tables.classList.add('ordpar-fit-wide');
    var wraps = tables.querySelectorAll('.ordpar-infl-wrap--wide');
    var tooWide = false;
    for (var i = 0; i < wraps.length; i++) {
      var t = wraps[i].querySelector('table');
      if (!t) continue;
      t.classList.remove('ordpar-infl--stacked');
      whole(t.querySelectorAll('.ordpar-col-whole'), false);
      if (tooWide || measured(t, 'max-content') <= avail) continue;
      if (measured(t, 'min-content') <= avail) stackColumns(t, avail);
      else tooWide = true;
    }
    if (tooWide) {
      tables.classList.remove('ordpar-fit-wide');
      tables.classList.add('ordpar-fit-narrow');
    }
  }

  function fitHost(host) {
    var all = host.querySelectorAll('.ordpar-inflection-tables');
    if (!all.length) return;
    var run = function () { for (var i = 0; i < all.length; i++) fitTables(all[i]); };
    run();
    if (host._ordparFit) return;
    host._ordparFit = true;
    var toggle = host.closest ? host.closest('details.ordpar-infl-toggle') : null;
    if (toggle) toggle.addEventListener('toggle', run);
    if (typeof global.ResizeObserver === 'function') {
      var lastW = -1;
      new global.ResizeObserver(function () {
        var w = host.clientWidth;
        if (w !== lastW) { lastW = w; run(); }
      }).observe(host);
    } else if (global.addEventListener) {
      global.addEventListener('resize', run);
    }
  }

  function fit(root) {
    if (!root || !root.querySelectorAll) return;
    var hosts = (root.matches && root.matches('.ordpar-inflection'))
      ? [root] : root.querySelectorAll('.ordpar-inflection');
    for (var i = 0; i < hosts.length; i++) fitHost(hosts[i]);
  }

  global.ordparInflection = {
    render: render,
    decode: decode,
    SHAPES: SHAPES,
    mountAll: mountAll,
    fit: fit,
    TAGS: TAGS,
    STRINGS: DEFAULT_STRINGS,
    NB_STRINGS: NB_STRINGS,
    FAMILIES: FAMILIES,
    LEMMA_SORT: LEMMA_SORT
  };

  if (global.document && global.document.addEventListener) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { mountAll(); });
    } else {
      mountAll();
    }
  }
})(typeof window !== 'undefined' ? window : this);
