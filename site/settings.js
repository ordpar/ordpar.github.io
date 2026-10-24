(function (global) {
  'use strict';

  var doc = global.document;
  var SECTIONS = ['style', 'article', 'search', 'data'];

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
    var st = doc.querySelector('.ordpar-settings-status');
    if (st) { st.textContent = text; }
  }


  function choices(sp) {
    if (sp.key === 'colour') {
      return (shell().colours() || []).map(function (c) {
        return { value: c.id, label: c.name, colour: c };
      });
    }
    return sp.values.map(function (v) {
      var key = 'settings.' + sp.key + '.' + v;
      var label = sp.key === 'lang' ? t('lang.name') : (/^\d+$/.test(v) && t(key) === key ? v : t(key));
      return { value: v, label: label };
    });
  }


  function drawn(sp) {
    if (sp.gate === 'privacy') { return global.ORDPAR_PRIVACY === true; }
    return true;
  }

  function shown(sp) {
    if (sp.key === 'exmore') { return shell().getSetting('exlimit') !== 'all'; }
    return true;
  }

  function swatch(c) {
    var sw = el('span', 'ordpar-swatch');
    sw.setAttribute('aria-hidden', 'true');
    [c.day, c.night].forEach(function (col) {
      var s = el('span');
      s.style.background = col;
      sw.appendChild(s);
    });
    return sw;
  }

  function noteOf(sp, ch) {
    if (ch.colour) { return ch.colour.note || ''; }
    var nkey = 'settings.' + sp.key + '.' + ch.value + '.note';
    return t(nkey) !== nkey ? t(nkey) : '';
  }

  function hintOf(sp, list) {
    var hkey = 'settings.' + sp.key + '.hint';
    var hint = t(hkey) !== hkey ? t(hkey) : '';
    var lines = [];
    (list || choices(sp)).forEach(function (ch) {
      var n = noteOf(sp, ch);
      if (n) { lines.push({ label: ch.label, text: n }); }
    });
    return hint || lines.length ? { hint: hint, lines: lines } : null;
  }


  var openHint = null;
  var leaveTimer = null;

  function hintShow(h, pinned) {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    if (openHint === h) { h.pinned = h.pinned || pinned; return; }
    if (openHint) { hintHide(openHint); }
    var box = el('span', 'ordpar-hint-box');
    if (h.data.hint) { box.appendChild(el('span', 'ordpar-hint-line', h.data.hint)); }
    h.data.lines.forEach(function (ln) {
      var row = el('span', 'ordpar-hint-line');
      row.appendChild(el('strong', null, ln.label + ':'));
      row.appendChild(doc.createTextNode(' ' + ln.text));
      box.appendChild(row);
    });
    h.live.appendChild(box);
    h.button.setAttribute('aria-expanded', 'true');
    h.pinned = pinned;
    openHint = h;
    hintPlace(h, box);
  }

  function hintHide(h) {
    if (!h) { return; }
    h.live.textContent = '';
    h.button.setAttribute('aria-expanded', 'false');
    h.pinned = false;
    if (openHint === h) { openHint = null; }
  }

  function hintPlace(h, box) {
    if (!box.getBoundingClientRect) { return; }
    var f = h.field.getBoundingClientRect(), b = h.button.getBoundingClientRect();
    box.style.top = Math.round(b.bottom - f.top + 4) + 'px';
    var w = box.getBoundingClientRect().width;
    box.style.left = Math.round(Math.max(0, Math.min(b.left - f.left, f.width - w))) + 'px';
  }

  function hovered(node) {
    try { return node.matches(':hover'); } catch (e) { return false; }
  }

  function hintControl(sp, data, group, legend, name) {
    var wrap = el('span', 'ordpar-hint');
    var button = el('button', 'ordpar-hint-button', '?');
    button.type = 'button';
    button.setAttribute('aria-label', t('settings.hintButton', { title: name }));
    button.setAttribute('aria-expanded', 'false');
    var live = el('span', 'ordpar-hint-live');
    live.id = 'ordpar-' + sp.key + '-hint';
    live.setAttribute('role', 'status');
    button.setAttribute('aria-controls', live.id);
    wrap.appendChild(button);
    wrap.appendChild(live);
    legend.appendChild(doc.createTextNode(' '));
    legend.appendChild(wrap);
    var h = { wrap: wrap, button: button, live: live, field: group, data: data, pinned: false, quiet: false };
    button.addEventListener('click', function () {
      if (openHint === h && h.pinned) { hintHide(h); h.quiet = hovered(wrap); } else { hintShow(h, true); }
    });
    wrap.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') { return; }
      if (openHint === h) { if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; } return; }
      if (h.quiet || (openHint && openHint.pinned)) { return; }
      hintShow(h, false);
    });
    wrap.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') { return; }
      h.quiet = false;
      if (openHint !== h || h.pinned) { return; }
      leaveTimer = setTimeout(function () {
        leaveTimer = null;
        if (openHint === h && !h.pinned) { hintHide(h); }
      }, 200);
    });
    return h;
  }

  function field(sp, subId) {
    var group = el('fieldset', 'ordpar-field');
    var legend = el('legend');
    var title = el('span', 'ordpar-field-title', t('settings.' + sp.key));
    title.id = 'ordpar-' + sp.key + '-legend';
    legend.appendChild(title);
    group.appendChild(legend);
    group.setAttribute('aria-labelledby', (subId ? subId + ' ' : '') + title.id);
    var list = choices(sp);
    var data = hintOf(sp, list);
    if (data) {
      var name = (subId && sp.sub ? t('settings.sub.' + sp.sub) + ', ' : '') + t('settings.' + sp.key);
      hintControl(sp, data, group, legend, name);
    }
    group.setAttribute('data-setting', sp.key);
    group.hidden = !shown(sp);
    var current = shell().getSetting(sp.key);
    if (sp.control === 'select') {
      var box = el('div', 'ordpar-select');
      var select = el('select');
      select.id = 'ordpar-' + sp.key;
      select.setAttribute('data-key', sp.key);
      select.setAttribute('aria-labelledby', (subId ? subId + ' ' : '') + title.id);
      list.forEach(function (ch) {
        var opt = el('option', null, ch.label);
        opt.value = ch.value;
        opt.selected = current === ch.value;
        select.appendChild(opt);
      });
      select.addEventListener('change', function () { shell().setSetting(sp.key, select.value); });
      box.appendChild(select);
      group.appendChild(box);
      return group;
    }
    list.forEach(function (ch) {
      var id = 'ordpar-' + sp.key + '-' + ch.value;
      var wrap = el('div', 'ordpar-radio');
      var input = el('input');
      input.type = 'radio';
      input.name = 'ordpar-' + sp.key;
      input.value = ch.value;
      input.id = id;
      input.checked = current === ch.value;
      input.setAttribute('data-key', sp.key);
      input.addEventListener('change', function () {
        if (input.checked) { shell().setSetting(sp.key, ch.value); }
      });
      var label = el('label');
      label.htmlFor = id;
      if (ch.colour) { label.appendChild(swatch(ch.colour)); label.appendChild(doc.createTextNode(' ')); }
      label.appendChild(doc.createTextNode(ch.label));
      wrap.appendChild(input);
      wrap.appendChild(label);
      var noteText = noteOf(sp, ch);
      if (noteText) {
        var note = el('span', 'ordpar-choice-note', noteText);
        note.id = id + '-note';
        note.hidden = true;
        input.setAttribute('aria-describedby', note.id);
        wrap.appendChild(note);
      }
      group.appendChild(wrap);
    });
    return group;
  }

  function sync() {
    var sh = shell();
    Array.prototype.forEach.call(doc.querySelectorAll('input[data-key]'), function (input) {
      input.checked = sh.getSetting(input.getAttribute('data-key')) === input.value;
    });
    Array.prototype.forEach.call(doc.querySelectorAll('select[data-key]'), function (select) {
      select.value = sh.getSetting(select.getAttribute('data-key'));
    });
    sh.SETTINGS.forEach(function (sp) {
      var group = doc.querySelector('fieldset[data-setting="' + sp.key + '"]');
      if (group) { group.hidden = !shown(sp); }
    });
  }


  function exportText(P) {
    var sh = shell();
    return JSON.stringify(P.exportData(sh ? sh.getSetting : null), null, 1) + '\n';
  }

  function shareables(text, name) {
    var nav = global.navigator || {};
    if (!nav.share || !nav.canShare || typeof global.File !== 'function') { return []; }
    var tries = [[name, 'text/plain'], [name.replace(/\.txt$/, '.json'), 'application/json']];
    var out = [];
    for (var i = 0; i < tries.length; i++) {
      try {
        var f = new global.File([text], tries[i][0], { type: tries[i][1] });
        if (nav.canShare({ files: [f] })) { out.push(f); }
      } catch (e) {  }
    }
    return out;
  }

  function errorText(err) {
    return err ? (err.name || 'Error') + ': ' + (err.message || String(err)) : 'unknown';
  }

  function shareFile(files, text, name) {
    var file = files[0];
    global.navigator.share({ files: [file], title: name }).catch(function (err) {
      if (err && err.name === 'AbortError') { return; }
      if (files.length > 1) { shareFile(files.slice(1), text, name); return; }
      download(text, name);
      say(t('transfer.shareFailed', { error: errorText(err), name: name }));
    });
  }

  function download(text, name) {
    var blob = new global.Blob([text], { type: 'text/plain' });
    var url = global.URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = name;
    a.hidden = true;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 2000);
  }

  function readFile(file) {
    if (file.text) { return file.text(); }
    return new Promise(function (resolve, reject) {
      var r = new global.FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  function transfer() {
    var P = global.ordparPersonal;
    var box = el('fieldset', 'ordpar-field ordpar-transfer');
    box.appendChild(el('legend', null, t('transfer.title')));
    if (!P) { return box; }
    box.appendChild(el('p', 'ordpar-note', t('transfer.intro')));
    var actions = el('div', 'ordpar-settings-actions');

    var exp = el('button', 'ordpar-button is-quiet ordpar-export', t('transfer.export'));
    exp.type = 'button';
    exp.addEventListener('click', function () {
      var name = P.exportName(new Date());
      download(exportText(P), name);
      say(t('transfer.exported', { name: name }));
    });
    actions.appendChild(exp);

    var probe = shareables('{}', P.exportName(new Date()));
    if (probe.length) {
      var send = el('button', 'ordpar-button is-quiet ordpar-share-file', t('transfer.share'));
      send.type = 'button';
      send.addEventListener('click', function () {
        var name = P.exportName(new Date());
        var text = exportText(P);
        var files = shareables(text, name);
        if (!files.length) { download(text, name); say(t('transfer.exported', { name: name })); return; }
        shareFile(files, text, name);
      });
      actions.appendChild(send);
    }

    var input = el('input', 'ordpar-import-input');
    input.type = 'file';
    input.accept = '.json,.txt,application/json,text/plain';
    input.hidden = true;
    input.id = 'ordpar-import-file';
    var imp = el('button', 'ordpar-button is-quiet ordpar-import', t('transfer.import'));
    imp.type = 'button';
    imp.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      input.value = '';
      if (!file) { return; }
      readFile(file).then(function (text) {
        var res = P.importText(text);
        if (!res.ok) { say(t('transfer.' + res.error)); return; }
        say(t('transfer.done', { f: res.added.favourites, h: res.added.history }));
        var sh = shell();
        if (sh && sh.applyAll) { sh.applyAll(); }
      }, function () { say(t('transfer.parse')); });
    });
    actions.appendChild(imp);
    actions.appendChild(input);
    box.appendChild(actions);
    return box;
  }

  function stored() {
    var box = el('fieldset', 'ordpar-field ordpar-stored');
    box.appendChild(el('legend', null, t('settings.storedTitle')));
    box.appendChild(el('p', 'ordpar-note', t('settings.stored')));
    var row = el('div', 'ordpar-settings-actions');
    var reset = el('button', 'ordpar-button ordpar-settings-reset', t('settings.reset'));
    reset.type = 'button';
    reset.addEventListener('click', function () {
      Promise.resolve(shell().resetSettings()).then(function () { sync(); say(t('settings.resetDone')); });
    });
    var wipe = el('button', 'ordpar-button ordpar-settings-delete', t('settings.delete'));
    wipe.type = 'button';
    wipe.addEventListener('click', function () {
      shell().deleteStoredData();
      sync();
      say(t('settings.deleted'));
    });
    row.appendChild(reset);
    row.appendChild(wipe);
    box.appendChild(row);
    return box;
  }


  function backLink() {
    var p = el('p', 'ordpar-back-row');
    var a = el('a', 'ordpar-back');
    a.href = base();
    var arrow = el('span', null, '← ');
    arrow.setAttribute('aria-hidden', 'true');
    a.appendChild(arrow);
    a.appendChild(doc.createTextNode(t('settings.back')));
    a.addEventListener('click', function (e) {
      var ref = doc.referrer;
      var same = false;
      try { same = !!ref && new URL(ref).origin === global.location.origin; } catch (x) {  }
      if (same && global.history.length > 1) { e.preventDefault(); global.history.back(); }
    });
    p.appendChild(a);
    return p;
  }

  function render(main) {
    var sh = shell();
    openHint = null;
    main.textContent = '';
    var wrap = el('div', 'ordpar-settings-page');
    wrap.appendChild(backLink());
    var h1 = el('h1', null, t('settings.title'));
    h1.tabIndex = -1;
    wrap.appendChild(h1);
    wrap.appendChild(el('p', 'ordpar-note', t('settings.applied')));

    var jump = el('nav');
    jump.setAttribute('aria-label', t('settings.jump'));
    var ul = el('ul', 'ordpar-jump');
    SECTIONS.forEach(function (id) {
      var a = el('a', null, t('settings.section.' + id));
      a.href = '#' + id;
      ul.appendChild(el('li')).appendChild(a);
    });
    jump.appendChild(ul);
    wrap.appendChild(jump);

    SECTIONS.forEach(function (id) {
      var sec = el('section', 'ordpar-settings-section');
      sec.id = id;
      var h2 = el('h2', null, t('settings.section.' + id));
      h2.id = id + '-title';
      sec.setAttribute('aria-labelledby', h2.id);
      sec.appendChild(h2);
      var sub = null, box = sec, late = [];
      sh.SETTINGS.forEach(function (sp) {
        if (sp.section !== id || !drawn(sp)) { return; }
        if (sp.key === 'colour' && !(sh.colours() || []).length) { return; }
        if (id === 'data' && !sp.sub) { late.push(sp); return; }
        if ((sp.sub || null) !== sub) {
          sub = sp.sub || null;
          box = sec;
          if (sub) {
            box = el('div', 'ordpar-settings-sub');
            var h3 = el('h3', null, t('settings.sub.' + sub));
            h3.id = id + '-' + sub + '-title';
            box.appendChild(h3);
            sec.appendChild(box);
          }
        }
        box.appendChild(field(sp, sub ? id + '-' + sub + '-title' : null));
      });
      if (id === 'data') {
        if (global.ordparOffline) {
          try { sec.appendChild(global.ordparOffline.section(t, sh.lang)); } catch (e) {  }
        }
        sec.appendChild(transfer());
        late.forEach(function (sp) { sec.appendChild(field(sp, null)); });
        sec.appendChild(stored());
      }
      wrap.appendChild(sec);
    });

    var st = el('p', 'ordpar-settings-status');
    st.setAttribute('role', 'status');
    st.textContent = message;
    wrap.appendChild(st);
    main.appendChild(wrap);
  }

  function start() {
    var main = doc.querySelector('[data-ordpar-settings]');
    if (!main || !shell()) { return; }
    var draw = function () {
      doc.title = t('settings.title') + ' — ' + t('site.name');
      render(main);
    };
    draw();
    if (global.location.hash) {
      var target = doc.getElementById(global.location.hash.slice(1));
      if (target) { target.scrollIntoView(); }
    }
    shell().onChange(function (key) {
      if (key === 'lang') { draw(); } else { sync(); }
    });
    doc.addEventListener('pointerdown', function (e) {
      if (openHint && !(e.target && openHint.wrap.contains(e.target))) { hintHide(openHint); }
    });
    doc.addEventListener('keydown', function (e) {
      if (openHint && (e.key === 'Escape' || e.key === 'Esc')) {
        var h = openHint;
        hintHide(h);
        h.quiet = hovered(h.wrap);
        if (h.wrap.contains(doc.activeElement) && doc.activeElement !== h.button) { h.button.focus(); }
      }
    });
  }

  global.ordparSettings = { noteOf: noteOf, hintOf: hintOf, field: field, drawn: drawn, shown: shown };

  function whenReady() { ((shell() && shell().ready) || Promise.resolve()).then(start); }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', whenReady); }
  else { whenReady(); }
}(typeof globalThis !== 'undefined' ? globalThis : this));
