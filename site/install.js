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
