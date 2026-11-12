// Anonymous usage analytics, sent to your own Supabase project.
// Paste your project URL and publishable key below. Leave them empty and nothing is sent.
(function () {
  'use strict';

  var SUPABASE_URL = 'https://slqllkrgrgjsnjmdvxqg.supabase.co';   // e.g. 'https://abcd1234.supabase.co'
  var SUPABASE_KEY = 'sb_publishable_sMCYPVYV9QInL-UeP0aPUQ_D2EsDs16';   // the publishable key (sb_publishable_...) or the legacy anon key

  var queue = [];
  var timer = null;
  var off = !SUPABASE_URL || !SUPABASE_KEY ||
    navigator.doNotTrack === '1' || window.globalPrivacyControl === true;

  // The site owner's devices are never counted. Opening the secret Stats link (#k/...)
  // marks this device as the owner's for good, and from then on nothing is sent from it.
  var OWNER_FLAG = 'pe-owner-device';
  var ownerLink = /^#k\/[A-Za-z0-9_-]{32,128}$/;
  var owner = false;
  function markOwner() {
    owner = true;
    off = true;
    queue = [];
    try { localStorage.setItem(OWNER_FLAG, '1'); } catch (e) { /* storage blocked: still off for this visit */ }
  }
  try { owner = localStorage.getItem(OWNER_FLAG) === '1'; } catch (e) { /* ignore */ }
  if (ownerLink.test(location.hash)) markOwner();
  if (owner) off = true;
  window.addEventListener('hashchange', function () {
    if (ownerLink.test(location.hash)) markOwner();
  });

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  // A random id per device, so visits can be counted without knowing who anyone is.
  var visitor, returning = false;
  try {
    visitor = localStorage.getItem('pe-visitor');
    returning = !!visitor;
    if (!visitor) { visitor = randomId(); localStorage.setItem('pe-visitor', visitor); }
  } catch (e) { visitor = randomId(); }
  var session = randomId();

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (off || !queue.length) return;
    var rows = queue.splice(0, queue.length);
    try {
      fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/events', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(rows)
      }).catch(function () { /* offline or blocked: drop it, the site keeps working */ });
    } catch (e) { /* ignore */ }
  }

  function track(name, props) {
    if (off) return;
    queue.push({
      visitor_id: visitor,
      session_id: session,
      name: String(name).slice(0, 64),
      page: (/^k\//.test(location.hash.slice(1)) ? 'stats' : (location.hash.slice(1) || 'home')).slice(0, 64),
      props: props || {},
      referrer: document.referrer ? document.referrer.slice(0, 255) : null,
      screen_w: window.innerWidth,
      standalone: window.matchMedia('(display-mode: standalone)').matches
    });
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(flush, 3000);
  }

  // One event at the start of each visit: new or returning, dark mode, simple words,
  // and the local hour (for "busiest times"). Nothing that says who anyone is.
  track('session_start', {
    returning: returning,
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    simple: document.documentElement.hasAttribute('data-simple'),
    hour: new Date().getHours()
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // Totals for the hidden Stats link (see private_stats() in supabase/analytics.sql).
  // The key comes from the link itself; it is never stored in this file. Wrong key: null.
  function rpc(fn, args) {
    return fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(args)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // Opening the Stats link also tells the server this device is the owner's:
  // its past visits are deleted and it is never counted again (exclude_visitor()).
  function stats(key) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return Promise.reject(new Error('not set up'));
    key = String(key || '');
    return rpc('exclude_visitor', { key: key, visitor: visitor })
      .catch(function () { /* still show the stats */ })
      .then(function () { return rpc('private_stats', { key: key }); });
  }

  window.PEAnalytics = { track: track, stats: stats, ready: !!(SUPABASE_URL && SUPABASE_KEY), isOwner: function () { return owner; } };
})();
