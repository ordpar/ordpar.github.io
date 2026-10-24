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
