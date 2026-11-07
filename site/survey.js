(function (global) {
  'use strict';

  var SURVEY_RECEIVER = "https://ordpar-receiver.ordpar.workers.dev/survey";

  var MAX_ANSWER = 2000;
  var MAX_CHOICE = 300;
  var MAX_FOLLOW = 254;

  var doc = global.document;
  var nav = global.navigator || {};
  var words = null;

  function t(key) {
    if (!words) {
      words = {};
      var island = doc && doc.getElementById('ordpar-survey-words');
      try { words = island ? JSON.parse(island.textContent) : {}; } catch (e) { words = {}; }
    }
    return words[key] || key;
  }

  function cut(s, max) {
    s = String(s || '').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  function message(answers, follow, trap) {
    var m = { answers: answers || {}, follow: follow || null };
    if (trap) { m.hp = trap; }
    return m;
  }

  function shown(q) {
    return !q.hidden;
  }

  function collect(form) {
    var answers = {}, follow = '', trap = '';
    var qs = form.querySelectorAll('[data-q]');
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i], key = q.getAttribute('data-q'), kind = q.getAttribute('data-kind');
      if (!shown(q)) { continue; }
      if (kind === 'one') {
        var on = q.querySelector('input[type=radio]:checked');
        if (on) { answers[key] = cut(on.value, MAX_CHOICE); }
      } else if (kind === 'many') {
        var ticked = q.querySelectorAll('input[type=checkbox]:checked'), list = [];
        for (var j = 0; j < ticked.length; j++) { list.push(cut(ticked[j].value, MAX_CHOICE)); }
        if (list.length) { answers[key] = list; }
      } else {
        var box = q.querySelector('textarea, input');
        var v = box ? box.value.trim() : '';
        if (kind === 'follow') { follow = cut(v, MAX_FOLLOW); }
        else if (v) { answers[key] = cut(v, MAX_ANSWER); }
      }
    }
    var hp = form.querySelector('.ordpar-report-trap input');
    if (hp) { trap = hp.value; }
    return { answers: answers, follow: follow, trap: trap };
  }

  function skip(form) {
    var qs = form.querySelectorAll('[data-skip-q]');
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var on = form.querySelector('[data-q="' + q.getAttribute('data-skip-q') + '"] input:checked');
      q.hidden = !!on && on.value === q.getAttribute('data-skip-v');
    }
  }

  function wire(form) {
    if (!form || form.getAttribute('data-wired')) { return false; }
    form.setAttribute('data-wired', '');
    var status = form.querySelector('.ordpar-survey-status');
    var send = form.querySelector('.ordpar-survey-send');
    var done = doc.getElementById('ordpar-survey-done');
    var busy = false;
    function say(key, failed) {
      status.textContent = key ? t(key) : '';
      status.classList.toggle('ordpar-report-status--failed', !!failed);
    }
    form.addEventListener('change', function () { skip(form); });
    skip(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) { return; }
      var got = collect(form);
      var any = false, k;
      for (k in got.answers) { if (Object.prototype.hasOwnProperty.call(got.answers, k)) { any = true; } }
      if (!any && !got.follow) { say('empty', true); return; }
      if (!api.SURVEY_RECEIVER || typeof global.fetch !== 'function') { say('failed', true); return; }
      if (nav.onLine === false) { say('offline', true); return; }
      busy = true;
      send.setAttribute('aria-disabled', 'true');
      say('sending');
      global.fetch(api.SURVEY_RECEIVER, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(message(got.answers, got.follow, got.trap)),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store'
      }).then(function (r) {
        if (r.ok) {
          say('');
          form.reset();
          skip(form);
          form.hidden = true;
          if (done) {
            done.textContent = t('sent');
            done.hidden = false;
            done.focus();
          }
        } else {
          say(r.status === 429 ? 'tooMany' : 'failed', true);
        }
      }, function () {
        say(nav.onLine === false ? 'offline' : 'failed', true);
      }).then(function () {
        busy = false;
        send.removeAttribute('aria-disabled');
      });
    });
    return true;
  }

  var api = {
    collect: collect,
    message: message,
    wire: wire,
    SURVEY_RECEIVER: SURVEY_RECEIVER,
    MAX_ANSWER: MAX_ANSWER,
    MAX_CHOICE: MAX_CHOICE,
    MAX_FOLLOW: MAX_FOLLOW
  };
  global.ordparSurvey = api;
  if (doc && doc.getElementById) { wire(doc.getElementById('ordpar-survey')); }
}(typeof globalThis !== 'undefined' ? globalThis : this));
