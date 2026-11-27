(function (global) {
  'use strict';

  var REPORT_RECEIVER = "https://ordpar-receiver.ordpar.workers.dev/report";

  var MAX_TEXT = 2000;
  var MAX_REPLY = 254;
  var MAX_CREDIT = 60;
  var CATEGORIES = ['translation', 'audio', 'norwegian', 'other'];
  var PRIVACY_HREF = '/privacy/#reporting-a-mistake';
  var ADDRESS_KEY = 'report';
  var LINK = /:\/\/|www\.|\.(com|net|org|info|biz|io|co|me|app|dev|xyz|top|site|online|shop|ru|cn|de|uk|no|se|dk)\b/i;

  var WORDS = {
    'report.button': 'Suggest a correction',
    'report.form': 'Suggest a correction to this article',
    'report.intro': 'Found a mistake in this article? Tell us what is wrong, and we will look at it.',
    'report.text': 'What is wrong?',
    'report.textHint': 'Up to 2,000 characters.',
    'report.where': 'Where is the mistake? (optional)',
    'report.cat.none': 'Choose …',
    'report.cat.translation': 'Translation',
    'report.cat.audio': 'Audio',
    'report.cat.norwegian': 'Norwegian text',
    'report.cat.other': 'Other',
    'report.reply': 'Your email address (optional)',
    'report.replyHint': 'Only if you would like an answer. We delete it once we have dealt with your report.',
    'report.credit': 'Name to credit (optional)',
    'report.creditHint': 'If your report leads to a fix, we may thank you by this name on our Thanks page. A name or nickname, no links. Leave it empty to stay anonymous.',
    'report.privacy': 'How we handle your report is explained on our {link}.',
    'report.privacyLink': 'Privacy page',
    'report.trap': 'Leave this field empty',
    'report.send': 'Send',
    'report.cancel': 'Cancel',
    'report.sending': 'Sending …',
    'report.sent': 'Thank you, your report has been sent.',
    'report.empty': 'Please write what is wrong before you send.',
    'report.badReply': 'This email address does not look complete. Correct it, or leave the field empty.',
    'report.badCredit': 'A name to credit cannot be a link. Write a name or nickname, or leave the field empty.',
    'report.offline': 'You are offline. Sending a report needs a connection; your text is kept here, so you can send it when you are back online.',
    'report.failed': 'The report could not be sent. Your text is kept here; please try again.',
    'report.tooMany': 'We have received a great many reports in the last hour. Your text is kept here; please try again in an hour.'
  };

  var nav = global.navigator || {};
  var doc = global.document;
  var serial = 0;
  var buildOnce = null;

  function t(key) {
    var s = global.ORDPAR_STRINGS && global.ORDPAR_STRINGS.en;
    return (s && s[key]) || WORDS[key] || key;
  }

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function message(id, build, category, text, reply, credit, trap) {
    var m = { id: id, build: build || null,
      category: CATEGORIES.indexOf(category) >= 0 ? category : null,
      text: text, reply: reply || null, credit: credit || null };
    if (trap) { m.hp = trap; }
    return m;
  }

  function creditOk(name) {
    name = String(name || '').replace(/\s+/g, ' ').trim();
    return !name || (name.length <= MAX_CREDIT && !LINK.test(name));
  }

  function build() {
    if (!buildOnce) {
      buildOnce = (typeof global.fetch === 'function'
        ? global.fetch('/offline/version.json', { cache: 'no-store', credentials: 'omit' })
        : Promise.reject(new Error('no fetch')))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) { return v && /^[0-9a-f]{6,40}$/.test(v.build) ? v.build : null; })
        .catch(function () { return null; });
    }
    return buildOnce;
  }

  function makeForm(id, button, done) {
    var n = ++serial, pre = 'ordpar-report-' + n + '-';
    var form = el('form', 'ordpar-report');
    form.id = pre + 'form';
    form.hidden = true;
    form.noValidate = true;
    form.setAttribute('aria-label', t('report.form'));
    form.setAttribute('data-nosnippet', '');

    form.appendChild(el('p', 'ordpar-report-intro', t('report.intro')));

    var lt = el('label', 'ordpar-report-label', t('report.text'));
    lt.htmlFor = pre + 'text';
    var text = el('textarea', 'ordpar-report-text');
    text.id = pre + 'text';
    text.rows = 4;
    text.maxLength = MAX_TEXT;
    text.required = true;
    text.setAttribute('aria-describedby', pre + 'texthint');
    var th = el('p', 'ordpar-report-hint', t('report.textHint'));
    th.id = pre + 'texthint';
    form.appendChild(lt); form.appendChild(text); form.appendChild(th);

    var lw = el('label', 'ordpar-report-label', t('report.where'));
    lw.htmlFor = pre + 'where';
    var where = el('select', 'ordpar-report-select');
    where.id = pre + 'where';
    var none = el('option', null, t('report.cat.none'));
    none.value = '';
    where.appendChild(none);
    CATEGORIES.forEach(function (c) {
      var o = el('option', null, t('report.cat.' + c));
      o.value = c;
      where.appendChild(o);
    });
    form.appendChild(lw); form.appendChild(where);

    var lr = el('label', 'ordpar-report-label', t('report.reply'));
    lr.htmlFor = pre + 'reply';
    var reply = el('input', 'ordpar-report-reply');
    reply.type = 'email';
    reply.id = pre + 'reply';
    reply.maxLength = MAX_REPLY;
    reply.autocomplete = 'email';
    reply.setAttribute('aria-describedby', pre + 'replyhint');
    var rh = el('p', 'ordpar-report-hint', t('report.replyHint'));
    rh.id = pre + 'replyhint';
    form.appendChild(lr); form.appendChild(reply); form.appendChild(rh);

    var lc = el('label', 'ordpar-report-label', t('report.credit'));
    lc.htmlFor = pre + 'credit';
    var credit = el('input', 'ordpar-report-credit');
    credit.type = 'text';
    credit.id = pre + 'credit';
    credit.maxLength = MAX_CREDIT;
    credit.autocomplete = 'nickname';
    credit.setAttribute('aria-describedby', pre + 'credithint');
    var ch = el('p', 'ordpar-report-hint', t('report.creditHint'));
    ch.id = pre + 'credithint';
    form.appendChild(lc); form.appendChild(credit); form.appendChild(ch);

    var pv = el('p', 'ordpar-report-hint ordpar-report-privacy');
    var parts = t('report.privacy').split('{link}');
    var pl = el('a', null, t('report.privacyLink'));
    pl.href = PRIVACY_HREF;
    pl.target = '_blank';
    pl.rel = 'noopener';
    pv.appendChild(doc.createTextNode(parts[0]));
    pv.appendChild(pl);
    if (parts.length > 1) { pv.appendChild(doc.createTextNode(parts.slice(1).join(''))); }
    form.appendChild(pv);

    var trapBox = el('div', 'ordpar-report-trap');
    trapBox.setAttribute('aria-hidden', 'true');
    var tl = el('label', null, t('report.trap'));
    tl.htmlFor = pre + 'hp';
    var trap = el('input');
    trap.type = 'text';
    trap.id = pre + 'hp';
    trap.name = 'website';
    trap.tabIndex = -1;
    trap.autocomplete = 'off';
    trapBox.appendChild(tl); trapBox.appendChild(trap);
    form.appendChild(trapBox);

    var status = el('p', 'ordpar-report-status');
    status.setAttribute('role', 'status');
    form.appendChild(status);

    var actions = el('p', 'ordpar-report-actions');
    var send = el('button', 'ordpar-result-btn ordpar-report-send', t('report.send'));
    send.type = 'submit';
    var cancel = el('button', 'ordpar-result-btn ordpar-report-cancel', t('report.cancel'));
    cancel.type = 'button';
    actions.appendChild(send); actions.appendChild(cancel);
    form.appendChild(actions);

    var busy = false;
    function say(key, failed) {
      status.textContent = key ? t(key) : '';
      status.classList.toggle('ordpar-report-status--failed', !!failed);
    }

    function close(sent) {
      form.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      say('');
      if (sent) {
        form.reset();
        done.textContent = t('report.sent');
      }
      button.focus();
    }

    cancel.addEventListener('click', function () { close(false); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) { return; }
      var body = text.value.trim();
      if (!body) { say('report.empty', true); text.focus(); return; }
      var addr = reply.value.trim();
      if (addr && (addr.length > MAX_REPLY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr))) {
        say('report.badReply', true); reply.focus(); return;
      }
      var name = credit.value.replace(/\s+/g, ' ').trim();
      if (!creditOk(name)) { say('report.badCredit', true); credit.focus(); return; }
      if (nav.onLine === false) { say('report.offline', true); return; }
      busy = true;
      send.setAttribute('aria-disabled', 'true');
      say('report.sending');
      build().then(function (b) {
        var m = message(id, b, where.value || null, body, addr, name, trap.value);
        return global.fetch(api.REPORT_RECEIVER, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify(m),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store'
        });
      }).then(function (r) {
        if (r.ok) { close(true); }
        else { say(r.status === 429 ? 'report.tooMany' : 'report.failed', true); }
      }, function () {
        say(nav.onLine === false ? 'report.offline' : 'report.failed', true);
      }).then(function () {
        busy = false;
        send.removeAttribute('aria-disabled');
      });
    });

    return { form: form, text: text, say: say };
  }

  function mount(row, id) {
    id = Number(id);
    if (!api.REPORT_RECEIVER || !row || !doc || !(id > 0) || typeof global.fetch !== 'function') { return null; }
    var button = el('button', 'ordpar-result-btn ordpar-report-btn', t('report.button'));
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    var done = el('p', 'ordpar-report-done');
    done.setAttribute('role', 'status');
    var made = null;
    button.addEventListener('click', function () {
      if (!made) {
        made = makeForm(id, button, done);
        button.setAttribute('aria-controls', made.form.id);
        row.parentNode.insertBefore(made.form, row.nextSibling);
        row.parentNode.insertBefore(done, made.form.nextSibling);
      }
      if (!made.form.hidden) { made.form.hidden = true; button.setAttribute('aria-expanded', 'false'); return; }
      done.textContent = '';
      made.form.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      made.say(nav.onLine === false ? 'report.offline' : '', nav.onLine === false);
      made.text.focus();
    });
    row.appendChild(doc.createTextNode(' '));
    row.appendChild(button);
    return button;
  }

  function takeAddress() {
    var loc = global.location, h = global.history;
    var hash = loc && loc.hash ? loc.hash.slice(1) : '';
    if (!hash) { return false; }
    var parts = hash.split('&'), rest = [], found = false, i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] === ADDRESS_KEY) { found = true; } else if (parts[i]) { rest.push(parts[i]); }
    }
    if (!found) { return false; }
    try {
      h.replaceState(h.state, '', loc.pathname + loc.search + (rest.length ? '#' + rest.join('&') : ''));
    } catch (e) {  }
    return true;
  }

  function fromAddress(button) {
    if (!button || !button.parentNode || button.getAttribute('aria-expanded') === 'true') { return false; }
    if (!takeAddress()) { return false; }
    button.click();
    return true;
  }

  var api = {
    mount: mount,
    message: message,
    creditOk: creditOk,
    fromAddress: fromAddress,
    takeAddress: takeAddress,
    ADDRESS_KEY: ADDRESS_KEY,
    REPORT_RECEIVER: REPORT_RECEIVER,
    MAX_TEXT: MAX_TEXT,
    MAX_REPLY: MAX_REPLY,
    MAX_CREDIT: MAX_CREDIT,
    CATEGORIES: CATEGORIES,
    LINK: LINK,
    PRIVACY_HREF: PRIVACY_HREF
  };
  global.ordparReport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
