(function () {
  'use strict';

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Saved progress ---------- */

  var KEY = 'pe-midterm-v1';
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    saved = {};
  }
  // Nothing saved yet means this is someone's first visit on this device.
  var firstVisit = Object.keys(saved).length === 0;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch (e) { /* storage blocked: the site still works, it just won't remember */ }
  }

  /* ---------- Settings ---------- */

  // The midterm is Thursday, Nov 12, 2026. It's built in, so nobody has to type it.
  var EXAM_DATE = '2026-11-12';
  var DEFAULTS = {
    theme: 'light', accent: 'red', color: '#c4122f', font: 'barlow', size: 'normal', density: 'comfy', motion: 'on',
    simple: 'off', cardFirst: 'term', exam: EXAM_DATE, name: '', gameLength: '30', startPage: 'home', board: 'show', goal: '20'
  };
  var settings = {};

  function loadSettings() {
    var mine = saved.settings || {};
    Object.keys(DEFAULTS).forEach(function (k) {
      settings[k] = mine[k] === undefined ? DEFAULTS[k] : mine[k];
    });
    if (settings.simple === true) settings.simple = 'on';
    settings.exam = EXAM_DATE;
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }

  function mixColor(rgb, target, amount) {
    return 'rgb(' + rgb.map(function (c, i) { return Math.round(c + (target[i] - c) * amount); }).join(',') + ')';
  }

  function brightness(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  // Works out readable shades from any color the user picks.
  function applyCustomColor(root, dark) {
    var names = ['--accent', '--accent-bright', '--on-accent', '--tint'];
    if (settings.accent !== 'custom') {
      names.forEach(function (n) { root.style.removeProperty(n); });
      return;
    }
    var base = hexToRgb(settings.color);
    var level = brightness(base);
    var accent = settings.color;
    if (dark && level < 0.2) accent = mixColor(base, [255, 255, 255], 0.5);
    if (!dark && level > 0.3) accent = mixColor(base, [0, 0, 0], 0.4);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-bright', level < 0.25 ? mixColor(base, [255, 255, 255], 0.5) : settings.color);
    root.style.setProperty('--on-accent', dark ? '#15171a' : '#fff');
    root.style.setProperty('--tint', mixColor(base, dark ? [23, 25, 28] : [255, 255, 255], 0.72));
  }

  function resolvedTheme() {
    if (settings.theme !== 'auto') return settings.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // The tab icon and phone status bar follow the chosen color and theme.
  function paintAppIcon(root, dark) {
    var css = getComputedStyle(root);
    var fill = css.getPropertyValue('--accent').trim();
    var mark = css.getPropertyValue('--on-accent').trim();
    $('#icon-svg').href = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="' + fill + '"/>' +
      '<path d="M2 11h3v10H2zM5 6h6v20H5zM11 13h10v6H11zM21 6h6v20h-6zM27 11h3v10h-3z" fill="' + mark + '"/></svg>');
    $('#theme-color').content = dark ? '#0c0d0f' : '#15171a';
  }

  function applySettings() {
    var root = document.documentElement;
    var dark = resolvedTheme() === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.accent = settings.accent;
    root.dataset.size = settings.size;
    root.dataset.font = settings.font;
    root.dataset.density = settings.density;
    root.dataset.motion = settings.motion;
    root.dataset.board = settings.board;
    applyCustomColor(root, dark);
    paintAppIcon(root, dark);
    $('#set-color').value = settings.color;
    if (document.activeElement !== $('#set-name')) $('#set-name').value = settings.name;
    if (document.activeElement !== $('#welcome-name')) $('#welcome-name').value = settings.name;
    if (settings.simple === 'on') root.setAttribute('data-simple', '');
    else root.removeAttribute('data-simple');
    $('#dumb-btn').setAttribute('aria-pressed', String(settings.simple === 'on'));
    $$('[data-set]').forEach(function (group) {
      $$('button', group).forEach(function (b) {
        var on = b.dataset.val === settings[group.dataset.set];
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    });
  }

  function changeSetting(key, value) {
    settings[key] = value;
    saved.settings = settings;
    save();
    applySettings();
    if (key === 'cardFirst') renderCard();
  }

  function buildSettings() {
    function pickSetting(e) {
      var b = e.target.closest('[data-val]');
      if (b) changeSetting(b.parentNode.dataset.set, b.dataset.val);
    }
    $('#view-settings').addEventListener('click', pickSetting);
    $('#welcome').addEventListener('click', pickSetting);
    $('#dumb-btn').addEventListener('click', function () {
      changeSetting('simple', settings.simple === 'on' ? 'off' : 'on');
    });
    $('#set-name').addEventListener('input', function (e) { changeSetting('name', e.target.value.trim()); });
    $('#welcome-name').addEventListener('input', function (e) { changeSetting('name', e.target.value.trim()); });
    $('#welcome-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    $('#set-color').addEventListener('input', function (e) {
      settings.color = e.target.value;
      changeSetting('accent', 'custom');
    });
    $('#settings-reset').addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (k) { settings[k] = DEFAULTS[k]; });
      changeSetting('cardFirst', DEFAULTS.cardFirst);
      toast('Settings reset');
    });
    $('#backup-save').addEventListener('click', saveBackup);
    $('#backup-load').addEventListener('change', loadBackup);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  }

  /* ---------- Welcome screen and patch notes ---------- */

  // Bump this when a new entry goes at the top of the What's new page.
  var LATEST = { version: '2.2', note: 'Version 2.2: bookmark sections of the notes like a textbook, plus test questions. Find them all on the Bookmarks page.' };

  // Older phones (iOS before 15.4) have no showModal, so fall back to a plain open flag.
  function openDialog(box) {
    if (box.open) return;
    if (typeof box.showModal === 'function') box.showModal();
    else { box.setAttribute('open', ''); box.classList.add('no-modal'); }
  }
  function closeDialog(box) {
    if (typeof box.close === 'function') box.close();
    else { box.removeAttribute('open'); box.dispatchEvent(new Event('close')); }
  }

  function buildWelcome() {
    var box = $('#welcome');
    function finish() {
      saved.seenWelcome = true;
      save();
      if ($('#view-home').classList.contains('is-active')) renderHome();
    }
    box.addEventListener('close', finish);
    box.addEventListener('click', function (e) { if (e.target === box) closeDialog(box); });
    $('#welcome-start').addEventListener('click', function () { closeDialog(box); });
    $('#welcome-settings').addEventListener('click', function () {
      closeDialog(box);
      location.hash = 'settings';
    });
    $('#welcome-again').addEventListener('click', function () { openDialog(box); });
    if (firstVisit) {
      // A brand-new visitor has nothing to catch up on in the patch notes.
      saved.seenNotes = LATEST.version;
      setTimeout(function () { if (!saved.seenWelcome) openDialog(box); }, 350);
    } else if (!saved.seenWelcome) {
      // Returning visitors already know the site, so they skip the welcome screen.
      saved.seenWelcome = true;
      save();
    }
  }

  function renderNews() {
    var link = $('.whats-new');
    $('#home-news').textContent = LATEST.note;
    link.classList.toggle('is-unread', saved.seenNotes !== LATEST.version);
  }

  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  function saveBackup() {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' }));
    link.download = 'pe-midterm-backup.json';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Backup saved');
  }

  function loadBackup(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad file');
        saved = data;
        save();
        location.reload();
      } catch (err) {
        toast('That file is not a PE Midterm backup');
      }
    };
    reader.readAsText(file);
  }

  function buildInstall() {
    var prompt = null;
    var btn = $('#install-btn');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      prompt = e;
      btn.hidden = false;
    });
    btn.addEventListener('click', function () {
      if (prompt) prompt.prompt();
    });
    window.addEventListener('appinstalled', function () {
      btn.hidden = true;
      toast('App installed');
    });
  }

  /* ---------- Search ---------- */

  var SEARCH_SKIP = ['the', 'a', 'an', 'of', 'is', 'are', 'what', 'whats', 'where', 'how', 'do', 'does', 'to', 'for', 'my', 'in', 'and', 'on', 'i', 'find', 'show', 'me', 'it',
    'why', 'when', 'which', 'who', 'be', 'am', 'was', 'were', 'can', 'could', 'should', 'would', 'will', 'you', 'your', 'we', 'us', 'at', 'by', 'from', 'or', 'with', 'that', 'this',
    'these', 'those', 'there', 'tell', 'about', 'explain', 'define', 'definition', 'mean', 'means', 'meaning', 'difference', 'between', 'vs', 'versus', 'compare', 'give', 'need',
    'want', 'have', 'has', 'did', 'if', 'so', 'many', 'much', 'long', 'work', 'works', 'use', 'used', 'using', 'called', 'name', 'please', 'know', 'into', 'get', 'way'];
  var SEARCH_COMPARE = ['vs', 'versus', 'difference', 'compare'];
  var SEARCH_ALIASES = {
    bad: ['problem'], wrong: ['problem'], issue: ['problem'], turn: ['converted', 'turn'], become: ['converted'], cheap: ['inexpensive'], cheapest: ['inexpensive'], cost: ['inexpensive'],
    best: ['gold standard', 'best'], shrink: ['atrophy', 'shrink'], shrinks: ['atrophy', 'shrink'], grow: ['hypertrophy', 'grow'], grows: ['hypertrophy', 'grow'],
    girls: ['females'], women: ['females'], boys: ['males'], men: ['males'], percentage: ['%', 'percent'], percent: ['%', 'percent'], max: ['max', 'maximum'],
    bicep: ['biceps'], tricep: ['triceps'], quad: ['quadriceps'], hamstring: ['hamstrings'], glute: ['gluteus'], pec: ['pectorals'], lat: ['latissimus'], delt: ['deltoids'], trap: ['trapezius'],
    hr: ['heart rate'], mhr: ['max heart rate'], bpm: ['heart rate', 'bpm'], rm: ['rep max'],
    abs: ['abdominals'], stomach: ['abdominals'], calf: ['gastrocnemius'], calves: ['gastrocnemius'],
    pecs: ['pectorals'], chest: ['pectorals'], lats: ['latissimus'], glutes: ['gluteus'], butt: ['gluteus'],
    quads: ['quadriceps'], hams: ['hamstrings'], traps: ['trapezius'], delts: ['deltoids'], shoulders: ['deltoids'],
    cardio: ['cardiovascular', 'cardio'], cv: ['cardiovascular'], sets: ['set'], reps: ['rep', 'repetition'],
    goals: ['goal'], water: ['hydrostatic', 'water'], fridge: ['refrigerator'], refrigerators: ['refrigerator'],
    xray: ['x-ray'], underwater: ['hydrostatic', 'underwater'], pushups: ['push-up'], situps: ['curl-up'], situp: ['curl-up'], curlups: ['curl-up']
  };

  function cleanText(s) {
    return String(s).toLowerCase()
      .replace(/['’]s\b/g, '').replace(/['’]/g, '')
      .replace(/[^a-z0-9%#.\- ]+/g, ' ')
      .replace(/(^|\s)[.\-]+(?=\s|$)|[.\-]+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function wordsOf(s) {
    var clean = cleanText(s);
    return clean.split(' ').concat(clean.split(/[ \-]/)).filter(function (w, i, all) { return w && all.indexOf(w) === i; });
  }

  // Reads every piece of text in an element, with spaces between them.
  function allText(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) out.push(walker.currentNode.nodeValue);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  }

  function goToSection(view, sec, tokens) {
    location.hash = view;
    setTimeout(function () {
      var target = sec;
      if (tokens && tokens.length) {
        var pieces = $$('tr, li, p, h3, figcaption, blockquote', sec).filter(function (el) { return el.offsetParent !== null; });
        var found = pieces.filter(function (el) {
          var text = cleanText(allText(el));
          return tokens.some(function (t) { return t.alts.some(function (alt) { return text.indexOf(alt) > -1; }); });
        })[0];
        if (found) target = found;
      }
      target.scrollIntoView({ block: 'center' });
      target.classList.add('search-spot');
      setTimeout(function () { target.classList.remove('search-spot'); }, 1800);
    }, 120);
  }

  function goToMap(mode, setup) {
    location.hash = 'u4';
    setMapMode(mode);
    if (setup) setup();
    renderPanel();
    setTimeout(function () { $('#map').scrollIntoView(); }, 120);
  }

  function buildSearchItems() {
    var items = [];
    function add(item) {
      item.titleText = cleanText(item.title);
      item.keys = cleanText(item.keys || '');
      item.body = cleanText(item.text || '');
      item.titleWords = wordsOf(item.title);
      item.bodyWords = wordsOf(item.keys + ' ' + item.body);
      item.boost = item.boost || 0;
      items.push(item);
    }
    function page(title, kind, keys, go, boost) {
      add({ title: title, kind: kind, keys: keys, go: go, boost: boost === undefined ? 12 : boost });
    }
    function sectionPage(title, keys, view, id) {
      page(title, 'Tool', keys, function () { goToSection(view, document.getElementById(id)); }, 25);
    }
    function settingPage(title, keys, id) {
      page(title, 'Setting', keys, function () {
        goToSection('settings', document.getElementById(id).closest('.set-row'));
      }, 4);
    }
    function pick(group, title, keys) {
      page(title, 'Setting', keys, function () {
        goToSection('settings', $('[data-set="' + group + '"]').closest('.set-row'));
      }, 4);
    }
    function quick(scope) {
      return function () {
        test.setup = false;
        startTest(scope);
        location.hash = 'test';
      };
    }

    page('Home', 'Page', 'scoreboard ready percent next up', function () { location.hash = 'home'; });
    page('Units', 'Page', 'unit list progress', function () { location.hash = 'units'; });
    page('Flashcards', 'Page', 'cards got it still learning shuffle', function () { location.hash = 'flashcards'; });
    page('Practice test', 'Page', 'quiz exam retry misses questions', function () { location.hash = 'test'; });
    page('Study today', 'Page', 'review due schedule spaced repetition what to study', quick('study'), 15);
    page('Daily 10', 'Page', 'daily streak quick', quick('daily'));
    page('Game Day', 'Page', 'mock exam final', quick('game'));
    page('Mock midterm', 'Page', 'mock midterm exam timed timer 45 minutes full practice clock', openMockIntro, 15);
    page('Formula drills', 'Page', 'formula formulas math drill practice problems numbers max heart rate 1 rep max body fat weight calculate', function () { location.hash = 'drills'; }, 15);
    page('Matching game', 'Page', 'match matching game pairs terms definitions timed fun', function () { location.hash = 'match'; }, 15);
    page('Last look', 'Page', 'last look test day final review formulas missed muscle chart cram', function () { location.hash = 'last'; }, 15);
    page('Settings', 'Page', 'options customize preferences', function () { location.hash = 'settings'; });
    page('Review sheet', 'Page', 'print printable cheat sheet review sheet pdf summary all cards', function () { location.hash = 'sheet'; });
    page('Type it flashcards', 'Tool', 'type typing spell spelling answer write', function () {
      setFlashMode('type');
      location.hash = 'flashcards';
    }, 15);
    page('Daily goal', 'Setting', 'goal daily target per day how many', function () { location.hash = 'settings'; });
    page('Send feedback', 'Page', 'feedback idea ideas suggestion suggest recommend question bug report form contact complaint complain complaints problem issue wrong broken google form help', function () {
      window.open('https://forms.gle/6LFouHe3cwiY1r5t7', '_blank', 'noopener');
    });
    page('Bookmarks', 'Page', 'saved bookmarks bookmark saved questions passages highlights clips notes later', function () { location.hash = 'saved'; }, 15);
    page('Weak spots', 'Page', 'weak weakest missed misses review what to study next struggling', function () { location.hash = 'weak'; });
    page('What\'s new', 'Page', 'patch notes updates changelog changes version new features', function () { location.hash = 'updates'; });
    page('Welcome screen', 'Setting', 'welcome tour setup customize intro first', function () { openDialog($('#welcome')); });
    page('Muscle map', 'Tool', 'body figure diagram chart numbers front back', function () { goToMap('explore'); }, 25);
    page('Machine matcher', 'Tool', 'machines gym exercises', function () { goToMap('machines'); }, 25);
    page('Muscle quiz', 'Tool', 'quiz mode numbers choices', function () { goToMap('quiz'); }, 15);
    page('Type the muscle names', 'Tool', 'type it spelling', function () { goToMap('type'); }, 15);
    sectionPage('Max heart rate calculator', 'heart rate hr mhr 220 age gauge bpm maximum', 'u2', 'u2-hr');
    sectionPage('1 Rep Max calculator', '1rm one rep max weight endurance strength', 'u3', 'u3-1rm');
    pick('theme', 'Dark mode', 'light theme night match device');
    pick('accent', 'Team color', 'school color red green blue orange custom');
    pick('font', 'Heading font', 'font sporty bold plain');
    pick('size', 'Text size', 'bigger larger font');
    pick('density', 'Spacing', 'compact roomy');
    pick('motion', 'Animations', 'motion');
    pick('simple', 'Simple words', 'easy plain english explain');
    pick('cardFirst', 'Flashcards show first', 'term answer');
    pick('gameLength', 'Game Day length', '15 30 questions');
    pick('startPage', 'Open the app on', 'start page last page');
    pick('board', 'Show or hide the scoreboard', 'home');
    settingPage('Your name', 'greeting profile', 'set-name');
    settingPage('Backup', 'save load transfer export import device', 'backup-save');
    settingPage('Put it on your phone', 'install app home screen', 'install-btn');

    PE.muscles.forEach(function (m) {
      var machines = machinesFor(m.id).map(function (x) { return x.name; }).join(', ');
      add({
        title: m.name, kind: 'Muscle ' + m.n, boost: 30,
        sub: PE.plainMuscles[m.id] + (machines ? '. Machine: ' + machines : ''),
        keys: 'muscle number ' + m.n + ' ' + m.view + ' ' + PE.plainMuscles[m.id] + (machines ? ' machine ' + machines : ''),
        answer: { text: PE.plainMuscles[m.id] + '. Number ' + m.n + ' on the chart. Machine: ' + (machines || 'None on the class machine list'), source: 'Muscle chart' },
        go: function () { goToMap('explore', function () { map.muscle = m.id; }); }
      });
    });
    PE.machines.forEach(function (x) {
      add({
        title: x.name, kind: 'Machine', boost: 28, sub: 'Works: ' + x.works, keys: 'machine exercise ' + x.works,
        answer: { text: 'Works: ' + x.works, source: 'Machine list' },
        go: function () { goToMap('machines', function () { map.machine = x; paintMachines(); }); }
      });
    });
    $$('.view.unit').forEach(function (view) {
      var viewId = view.id.replace('view-', '');
      $$('.block, .tool', view).forEach(function (sec) {
        var body = allText(sec);
        add({
          title: $('h2', sec).textContent, kind: view.dataset.title, text: body, boost: 10,
          go: function (tokens) { goToSection(viewId, sec, tokens); }
        });
      });
    });
    PE.flashcards.forEach(function (c) {
      add({
        title: c.front, kind: 'Flashcard', sub: c.back.replace(/\n+/g, ' '), text: c.back, boost: 8,
        answer: { text: c.back, source: 'Flashcard, ' + unitLabel(c.u), simple: PE.simpleCards[c.front] },
        go: function () {
          flash.scope = 'u' + c.u;
          flash.pile = 'all';
          setDeck(false);
          flash.pos = flash.deck.indexOf(c);
          renderCard();
          location.hash = 'flashcards';
        }
      });
    });
    PE.questions.forEach(function (q, i) {
      add({
        title: q.q, kind: 'Test question', sub: 'Answer: ' + q.c[q.a], text: q.c[q.a] + ' ' + q.why,
        answer: { text: q.t === 'tf' ? q.c[q.a] + '. ' + q.why : q.c[q.a], source: 'Practice test, ' + unitLabel(q.u) },
        go: quick('q' + i)
      });
    });
    return items;
  }

  function searchTokens(query) {
    var clean = cleanText(query);
    var words = clean.split(' ').filter(Boolean);
    var useful = words.filter(function (w) { return SEARCH_SKIP.indexOf(w) === -1; });
    if (useful.length) words = useful;
    var tokens = words.map(function (w) {
      var alts = [w].concat(SEARCH_ALIASES[w] || []);
      if (w.length > 3 && /s$/.test(w)) alts.push(w.slice(0, -1));
      // A word still being typed also picks up the nicknames it could become, like tra for traps.
      if (!SEARCH_ALIASES[w] && w.length >= 3) {
        Object.keys(SEARCH_ALIASES).forEach(function (name) {
          if (name.indexOf(w) === 0) alts = alts.concat(SEARCH_ALIASES[name]);
        });
      }
      return { word: w, alts: alts, partial: !SEARCH_ALIASES[w] };
    });
    return {
      phrase: useful.join(' '),
      tokens: tokens,
      compare: clean.split(' ').some(function (w) { return SEARCH_COMPARE.indexOf(w) > -1; })
    };
  }

  // How close a word has to be to count as a typo of the search word.
  function closeWord(word, list) {
    if (word.length < 5) return false;
    var limit = word.length >= 8 ? 2 : 1;
    return list.some(function (w) {
      return Math.abs(w.length - word.length) <= limit && w[0] === word[0] && editDistance(word, w) <= limit;
    });
  }

  function startsAWord(alt, list) {
    return list.some(function (w) { return w.indexOf(alt) === 0; });
  }

  function tokenScore(token, item) {
    var best = 0;
    token.alts.forEach(function (alt) {
      var isWord = alt.indexOf(' ') === -1;
      // Short searches match the start of a word, so tri finds triceps but not electric.
      // A nickname like abs means that muscle, so it doesn't also match absorb.
      if (alt.length < 4) {
        if (item.titleWords.indexOf(alt) > -1) best = Math.max(best, 34);
        else if (token.partial && startsAWord(alt, item.titleWords)) best = Math.max(best, 30);
        else if (item.bodyWords.indexOf(alt) > -1) best = Math.max(best, 16);
        else if (token.partial && alt.length > 1 && startsAWord(alt, item.bodyWords)) best = Math.max(best, 12);
        return;
      }
      // Under 6 letters, the middle of a longer word doesn't count, so stom skips custom.
      var inside = !isWord || alt.length >= 6;
      if (isWord && item.titleWords.indexOf(alt) > -1) best = Math.max(best, 34);
      else if (isWord && startsAWord(alt, item.titleWords)) best = Math.max(best, 30);
      else if (inside && item.titleText.indexOf(alt) > -1) best = Math.max(best, 26);
      else if (inside && item.keys.indexOf(alt) > -1) best = Math.max(best, 22);
      else if (inside && item.body.indexOf(alt) > -1) best = Math.max(best, 10);
      else if (!inside && startsAWord(alt, item.bodyWords)) best = Math.max(best, 10);
    });
    if (!best && closeWord(token.word, item.titleWords)) best = 18;
    if (!best && closeWord(token.word, item.bodyWords)) best = 6;
    return best;
  }

  function scoreItem(item, search) {
    var total = 0;
    var missing = 0;
    var inTitle = [];
    search.tokens.forEach(function (t) {
      var s = tokenScore(t, item);
      if (s) total += s;
      else missing++;
      if (s === 34 || s === 30 || s === 26 || s === 18) inTitle.push(t.word);
    });
    if (!total) return null;
    if (search.phrase.length > 3) {
      if (item.titleText === search.phrase) total += 80;
      else if (item.titleText.indexOf(search.phrase) === 0) total += 50;
      else if (item.titleText.indexOf(search.phrase) > -1) total += 36;
      else if (item.keys.indexOf(search.phrase) > -1) total += 26;
      else if (item.body.indexOf(search.phrase) > -1) total += 16;
    }
    return { item: item, score: total + item.boost, missing: missing, inTitle: inTitle };
  }

  // Picks answers from the notes. Returns nothing unless the match is clear,
  // so it never guesses. The text shown is the stored wording, unchanged.
  function findAnswers(scored, search) {
    var count = search.tokens.length;
    var pool = scored.filter(function (s) { return s.item.answer; }).sort(function (a, b) { return b.score - a.score; });
    function wholeWord(s, t) {
      return t.alts.some(function (alt) { return s.item.titleWords.indexOf(alt) > -1; });
    }
    if (search.compare && count === 2) {
      var pair = search.tokens.map(function (t) {
        return pool.filter(function (s) { return wholeWord(s, t); })[0];
      });
      if (pair[0] && pair[1] && pair[0] !== pair[1]) return [pair[0].item, pair[1].item];
    }
    var full = pool.filter(function (s) { return !s.missing && s.inTitle.length === count; });
    var best = full[0] || pool.filter(function (s) { return !s.missing && s.inTitle.length; })[0];
    if (!best) return [];
    var strict = full.filter(function (s) {
      return search.tokens.every(function (t) { return wholeWord(s, t); });
    });
    var exact = best.item.titleText === search.phrase;
    if (!exact && count < 3 && (strict.length ? strict : full).length > 2) return [];
    if (strict.length) best = strict[0];
    return [best.item];
  }

  function markText(text, tokens) {
    var words = [];
    tokens.forEach(function (t) {
      t.alts.forEach(function (alt) { if (alt.length > 1) words.push(alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); });
    });
    if (!words.length) return esc(text);
    var parts = String(text).split(new RegExp('(' + words.join('|') + ')', 'ig'));
    return parts.map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
  }

  // A short piece of the text around the first word that matched.
  function snippet(item, tokens) {
    var text = item.sub || item.text || '';
    if (!text) return '';
    var lower = text.toLowerCase();
    var at = -1;
    tokens.forEach(function (t) {
      t.alts.forEach(function (alt) {
        var i = lower.indexOf(alt);
        if (i > -1 && (at === -1 || i < at)) at = i;
      });
    });
    var start = Math.max(0, at - 40);
    var piece = text.slice(start, start + 120);
    return (start ? '...' : '') + piece + (start + 120 < text.length ? '...' : '');
  }

  function buildSearch() {
    var box = $('#search');
    var input = $('#search-input');
    var results = $('#search-results');
    var items = null;
    var shown = [];
    var active = -1;
    var tokens = [];
    var answers = [];
    var TRY = ['What is my max heart rate?', 'Why is BMI a problem?', 'Hypertrophy vs atrophy', 'What machine works the chest?', 'What is the gold standard?', 'FITT', 'dark mode'];

    function suggestions() {
      results.innerHTML = '<p class="search-count">Try searching for</p><div class="search-tags">' + TRY.map(function (q) {
        return '<button type="button" class="search-tag" data-try="' + esc(q) + '">' + esc(q) + '</button>';
      }).join('') + '</div>';
      shown = [];
      answers = [];
      active = -1;
    }

    function answerHtml(it, i) {
      var a = it.answer;
      return '<div class="ask-answer"><em>Answer from your notes</em><b>' + esc(it.title) + '</b><p class="ask-text">' + esc(a.text) + '</p>' +
        (a.simple ? '<p class="simple">' + esc(a.simple) + '</p>' : '') +
        '<div class="ask-foot"><span>' + esc(a.source) + '</span><button type="button" class="link-btn" data-answer="' + i + '">Open this</button></div></div>';
    }

    function run() {
      if (!input.value.trim()) { suggestions(); return; }
      var search = searchTokens(input.value);
      tokens = search.tokens;
      var scored = items.map(function (it) { return scoreItem(it, search); }).filter(Boolean);
      var exact = scored.filter(function (s) { return !s.missing; });
      var closest = !exact.length;
      var list = (closest ? scored : exact).sort(function (a, b) {
        return a.missing - b.missing || b.score - a.score;
      });
      answers = findAnswers(scored, search);
      shown = list.slice(0, 30).map(function (s) { return s.item; }).filter(function (it) { return answers.indexOf(it) === -1; });
      active = shown.length ? 0 : -1;
      if (!shown.length && !answers.length) {
        results.innerHTML = '<p class="search-count">That is not in your notes. Check the spelling, or try fewer words.</p>';
        return;
      }
      var isQuestion = input.value.trim().split(/\s+/).length > 2;
      var label = answers.length ? 'Also in your notes' : closest && isQuestion ? 'No exact answer in your notes. Closest matches:' : closest ? 'Closest matches' : list.length + (list.length === 1 ? ' result' : ' results');
      results.innerHTML = answers.map(answerHtml).join('') + (shown.length ? '<p class="search-count">' + label + '</p>' : '') +
        shown.map(function (it, i) {
          var line = snippet(it, tokens);
          return '<button type="button" class="search-item' + (i === 0 ? ' is-active' : '') + '" data-item="' + i + '"><em>' + esc(it.kind) + '</em><b>' + markText(it.title, tokens) + '</b>' +
            (line ? '<span>' + markText(line, tokens) + '</span>' : '') + '</button>';
        }).join('');
    }

    function openItem(it) {
      if (!it) return;
      box.close();
      it.go(tokens);
    }

    function choose(i) {
      openItem(shown[i]);
    }

    function moveActive(step) {
      if (!shown.length) return;
      active = (active + step + shown.length) % shown.length;
      $$('.search-item', results).forEach(function (el, i) {
        el.classList.toggle('is-active', i === active);
        if (i === active) el.scrollIntoView({ block: 'nearest' });
      });
    }

    function open() {
      if (!items) items = buildSearchItems();
      input.value = '';
      suggestions();
      box.showModal();
      input.focus();
    }

    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (answers.length) openItem(answers[0]);
        else choose(active);
      }
    });

    results.addEventListener('click', function (e) {
      var tag = e.target.closest('[data-try]');
      if (tag) {
        input.value = tag.dataset.try;
        run();
        input.focus();
        return;
      }
      var picked = e.target.closest('[data-answer]');
      if (picked) {
        openItem(answers[Number(picked.dataset.answer)]);
        return;
      }
      var b = e.target.closest('[data-item]');
      if (b) choose(Number(b.dataset.item));
    });

    $('#search-btn').addEventListener('click', open);
    $('#home-ask').addEventListener('click', open);
    $('#search-close').addEventListener('click', function () { box.close(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    document.addEventListener('keydown', function (e) {
      var typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (((e.ctrlKey || e.metaKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        if (!box.open) open();
      }
    });
  }

  function buildSimpleNotes() {
    Object.keys(PE.simple).forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      var note = document.createElement('p');
      note.className = 'simple';
      note.textContent = PE.simple[id];
      var h2 = $('h2', sec);
      var body = sec.classList.contains('block') ? h2.nextElementSibling : null;
      if (body) body.insertBefore(note, body.firstChild);
      else h2.parentNode.insertBefore(note, h2.nextSibling);
    });
  }

  /* ---------- Views and nav ---------- */

  var nav = $('#nav');
  var menuBtn = $('#menu-btn');

  function closeMenu() {
    nav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  function route(first) {
    var id = location.hash.slice(1) || 'home';
    var view = document.getElementById('view-' + id);
    if (!view) { id = 'home'; view = $('#view-home'); }
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v === view); });
    $$('.nav a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var tabId = /^u\d$/.test(id) ? 'units' : id;
    if (['settings', 'updates', 'weak', 'more', 'sheet', 'last', 'saved'].indexOf(id) > -1) tabId = 'more';
    if (id === 'drills' || id === 'match') tabId = 'test';
    if (id !== 'test') test.mockIntro = false;
    $$('.tabbar a').forEach(function (a) {
      if (a.dataset.tab === tabId) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    saved.lastPage = id;
    save();
    document.title = view.dataset.title + ' | PE Midterm';
    closeMenu();
    if (id === 'updates' && saved.seenNotes !== LATEST.version) {
      saved.seenNotes = LATEST.version;
      save();
    }
    if (id === 'home') { renderHome(); renderNews(); }
    if (id === 'test') renderTest();
    if (id === 'units') renderUnits();
    if (id === 'weak') renderWeak();
    if (id === 'sheet') renderSheet();
    if (id === 'drills') renderDrill(false);
    if (id === 'match') renderMatch();
    if (id === 'last') renderLast();
    if (id === 'saved') renderSaved();
    stopSpeaking();
    window.scrollTo(0, 0);
    if (!first) {
      var h = $('h1', view);
      if (h) h.focus({ preventScroll: true });
    }
  }

  function buildUnitHelpers() {
    // Short jump links at the top of each long unit
    $$('[data-jump]').forEach(function (box) {
      var unit = box.closest('.view');
      $$('.block, .tool', unit).forEach(function (sec) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = $('h2', sec).textContent;
        btn.addEventListener('click', function () { sec.scrollIntoView(); });
        box.appendChild(btn);
      });
    });

    PE.units.forEach(function (u, i) {
      var pager = $('[data-pager="' + u.id + '"]');
      var next = PE.units[i + 1];
      pager.innerHTML =
        '<a class="quiz-link" href="#test" data-scope="' + u.id + '">Quiz yourself on this unit</a>' +
        '<button type="button" class="link-btn" data-print>Print this page</button>' +
        (next ? '<a href="#' + next.id + '">Next: ' + next.num + ' ' + esc(next.title) + '</a>' : '<a href="#flashcards">Next: Flashcards</a>');
    });

    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-scope]');
      if (link) {
        test.scope = link.dataset.scope;
        test.setup = true;
      }
      var quick = e.target.closest('[data-quick]');
      if (quick) {
        test.setup = false;
        startTest(quick.dataset.quick);
        location.hash = 'test';
      }
      if (e.target.closest('[data-print]')) window.print();
      if (e.target.closest('[data-mock]')) openMockIntro();
      var read = e.target.closest('[data-plan-read]');
      if (read) { saved.planRead = thisDay() + ':' + read.dataset.planRead; save(); }
      var share = e.target.closest('[data-share]');
      if (share) shareScore(share.dataset.share);
      var cards = e.target.closest('[data-flash]');
      if (cards) {
        flash.scope = cards.dataset.flash;
        flash.pile = 'learning';
        paintFlash();
        setDeck(false);
      }
    });
  }

  /* ---------- Home ---------- */

  function scoreText(s) {
    return s ? s.score + ' / ' + s.total : 'Not taken';
  }

  function pct(n, d) {
    return d ? Math.round(n / d * 100) : 0;
  }

  // Each unit's score is the average of its parts. Anything not done yet counts as 0.
  function unitParts(u) {
    var cards = PE.flashcards.filter(function (c) { return 'u' + c.u === u.id; });
    var known = cards.filter(isKnown).length;
    var last = (saved.byUnit || {})[u.id] || (saved.test || {})[u.id];
    var parts = [
      { value: last ? pct(last.score, last.total) : 0, attrs: 'href="#test" data-scope="' + u.id + '"', text: 'take the unit test' },
      { value: pct(known, cards.length), attrs: 'href="#flashcards" data-flash="' + u.id + '"', text: 'work through the flashcards' }
    ];
    if (u.id === 'u4') {
      parts.push({ value: pct(Math.max(saved.mapBest || 0, saved.typeBest || 0), 11), attrs: 'href="#u4"', text: 'run the map quiz' });
    }
    return parts;
  }

  function average(list) {
    return Math.round(list.reduce(function (sum, n) { return sum + n; }, 0) / list.length);
  }

  function unitScore(u) {
    return average(unitParts(u).map(function (p) { return p.value; }));
  }

  function dayStamp(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function examLine() {
    if (!settings.exam) return '';
    var p = settings.exam.split('-').map(Number);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((new Date(p[0], p[1] - 1, p[2]) - today) / 86400000);
    if (days < 0) return '';
    if (days === 0) return '<p class="sb-extra">The midterm is today</p>';
    return '<p class="sb-extra">' + days + (days === 1 ? ' day' : ' days') + ' until the midterm</p>';
  }

  function renderUnits() {
    $('#unit-list').innerHTML = PE.units.map(function (u) {
      var score = unitScore(u);
      return '<a class="unit-row" href="#' + u.id + '"><span class="sb-num">' + u.num + '</span><span class="sb-name">' + esc(u.title) + '</span>' +
        '<span class="sb-pct">' + score + '%</span><span class="pct"><i style="width:' + score + '%"></i></span></a>';
    }).join('');
  }

  function renderHome() {
    var greet = $('#greeting');
    greet.hidden = !settings.name;
    greet.textContent = 'Hi ' + settings.name;
    var last = saved.test || {};
    var scores = PE.units.map(function (u) {
      var parts = unitParts(u);
      return { unit: u, parts: parts, value: average(parts.map(function (p) { return p.value; })) };
    });
    var total = average(scores.map(function (s) { return s.value; }));

    var weakest = scores.reduce(function (low, s) { return s.value < low.value ? s : low; });
    var move = weakest.parts.reduce(function (low, p) { return p.value < low.value ? p : low; });
    var next = total === 100
      ? '<a class="sb-next" href="#test">Every unit is at 100. Run the full test one more time.</a>'
      : '<a class="sb-next" ' + move.attrs + '>Next up: ' + weakest.unit.num + ' ' + esc(weakest.unit.short) + ', ' + move.text + '</a>';

    $('#board').innerHTML =
      '<div class="sb-total"><span class="sb-label">Ready</span><div class="sb-tiles" role="img" aria-label="' + total + ' percent ready">' +
      String(total).split('').map(function (d) { return '<span class="sb-tile">' + d + '</span>'; }).join('') +
      '<span class="sb-tile unit">%</span></div><p class="sb-note">Your test scores, flashcards and map quiz added up.</p>' + examLine() +
      (saved.streak && saved.streak.count ? '<p class="sb-extra">Daily 10 streak: ' + saved.streak.count + '</p>' : '') + goalLine() + '</div>' +
      '<div class="sb-rows">' + scores.map(function (s) {
        return '<a class="sb-row" href="#' + s.unit.id + '"><span class="sb-num">' + s.unit.num + '</span><span class="sb-name">' + esc(s.unit.title) + '</span>' +
          '<span class="sb-pct">' + s.value + '%</span><span class="sb-bar"><i data-width="' + s.value + '"></i></span></a>';
      }).join('') + '</div>' + next;

    setTimeout(function () {
      $$('#board .sb-bar i').forEach(function (bar) { bar.style.width = bar.dataset.width + '%'; });
    }, 40);

    var knownCount = PE.flashcards.filter(isKnown).length;
    var misses = missedIds().length;
    $('#home-flash').textContent = knownCount + ' of ' + PE.flashcards.length + ' marked Got it';
    $('#home-test').textContent = PE.questions.length + ' questions. Last full test: ' + scoreText(last.all) +
      (misses ? '. ' + misses + ' to retry' : '');
    $('#home-daily').textContent = 'A quick mix of your misses and weakest unit';
    $('#home-game').textContent = gameLength() + ' mixed questions, answers at the end. Last: ' + scoreText(last.game);
    $('#home-match').textContent = saved.matchBest ? 'Best time: ' + clockText(saved.matchBest) : 'Match 6 terms to their meanings on the clock';
    renderPlan();
    renderStudy();
  }

  /* ---------- Daily goal ---------- */

  function goalTarget() {
    return settings.goal === 'off' ? 0 : Number(settings.goal) || 0;
  }

  function todayCount() {
    var t = saved.today;
    return t && t.day === thisDay() ? t.n : 0;
  }

  // Every flashcard mark and test answer counts once.
  function bumpGoal() {
    var n = todayCount() + 1;
    saved.today = { day: thisDay(), n: n };
    if (goalTarget() && n === goalTarget()) toast('Daily goal done: ' + n + ' answered today');
  }

  function goalLine() {
    var goal = goalTarget();
    if (!goal) return '';
    var n = todayCount();
    return '<p class="sb-extra sb-goal">' + (n >= goal ? 'Daily goal done: ' : 'Daily goal: ') + Math.min(n, goal) + ' / ' + goal + '</p>';
  }

  /* ---------- Read aloud ---------- */

  var speech = { btn: null };

  function canSpeak() {
    return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  }

  function stopSpeaking() {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    if (speech.btn) {
      speech.btn.setAttribute('aria-pressed', 'false');
      speech.btn.classList.remove('is-on');
    }
    speech.btn = null;
  }

  // Tapping the same button again stops it.
  function speak(text, btn) {
    if (!canSpeak()) return;
    var same = speech.btn === btn;
    stopSpeaking();
    if (same) return;
    var say = new window.SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim());
    say.lang = 'en-US';
    say.rate = 0.95;
    say.onend = say.onerror = function () { if (speech.btn === btn) stopSpeaking(); };
    speech.btn = btn;
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('is-on');
    window.speechSynthesis.speak(say);
  }

  function buildSpeech() {
    if (!canSpeak()) {
      document.documentElement.classList.add('no-speech');
      return;
    }
    $$('.view.unit .block > h2').forEach(function (h) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'speak-icon';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Read ' + h.textContent + ' aloud');
      btn.innerHTML = '<svg aria-hidden="true"><use href="#i-speak"></use></svg>';
      btn.addEventListener('click', function () { speak(h.parentNode.innerText, btn); });
      h.appendChild(btn);
    });
  }

  /* ---------- Review sheet ---------- */

  function renderSheet() {
    var root = $('#sheet-root');
    if (root.children.length) return;
    root.innerHTML = PE.units.map(function (u) {
      var cards = PE.flashcards.filter(function (c) { return 'u' + c.u === u.id; });
      return '<section class="sheet-unit"><h2><span>' + u.num + '</span> ' + esc(u.title) + '</h2><dl>' +
        cards.map(function (c) { return '<div><dt>' + esc(c.front) + '</dt><dd>' + esc(c.back) + '</dd></div>'; }).join('') +
        '</dl></section>';
    }).join('');
  }

  /* ---------- Weak spots ---------- */

  // Flashcards someone has marked Still learning (not ones they haven't tried yet).
  function learningCards(unitId) {
    var review = saved.review || {};
    return PE.flashcards.filter(function (c) {
      return 'u' + c.u === unitId && !isKnown(c) && review['c:' + cardKey(c)];
    });
  }

  function renderWeak() {
    var root = $('#weak-root');
    var allMisses = missedIds().length;
    var rows = PE.units.map(function (u) {
      return { unit: u, score: unitScore(u), misses: unitMisses(u.id), learning: learningCards(u.id), last: (saved.byUnit || {})[u.id] };
    });
    var tried = allMisses || Object.keys(saved.test || {}).length || Object.keys(saved.known || {}).length ||
      rows.some(function (r) { return r.learning.length; });
    if (!tried) {
      root.innerHTML = '<p class="weak-lead">Nothing here yet. Take a test or go through some flashcards, and this page shows you what to work on.</p>' +
        '<div class="test-actions"><button type="button" class="btn solid" data-quick="daily">Daily 10</button><a class="btn" href="#test" data-scope="all">Full test</a></div>';
      return;
    }
    rows.sort(function (a, b) { return a.score - b.score; });
    var weak = rows.filter(function (r) { return r.score < 100 || r.misses.length || r.learning.length; });
    var strong = rows.filter(function (r) { return weak.indexOf(r) === -1; });
    var top = weak[0];

    root.innerHTML =
      '<div class="weak-top">' +
      (top
        ? '<p>Start with <b>' + top.unit.num + ' ' + esc(top.unit.title) + '</b>. It\'s your lowest unit at ' + top.score + '%.</p>'
        : '<p>No weak spots right now. Run the full test to be sure.</p>') +
      (allMisses ? '<button type="button" class="btn solid" data-quick="missed">Retry all ' + allMisses + ' misses</button>' : '') +
      '</div>' +
      weak.map(function (r) {
        var u = r.unit;
        var facts = [
          r.misses.length ? r.misses.length + (r.misses.length === 1 ? ' missed question' : ' missed questions') : 'No missed questions',
          r.learning.length ? r.learning.length + (r.learning.length === 1 ? ' flashcard' : ' flashcards') + ' still learning' : '',
          r.last ? 'Last unit test ' + r.last.score + ' / ' + r.last.total : 'Unit test not taken',
          recentPct([u]) + '% right this week'
        ].filter(Boolean).join(' · ');
        return '<div class="weak-unit">' +
          '<div class="weak-head"><span class="sb-num">' + u.num + '</span><span class="sb-name">' + esc(u.title) + '</span><span class="sb-pct">' + r.score + '%</span></div>' +
          '<span class="pct"><i style="width:' + r.score + '%"></i></span>' +
          '<p class="note">' + facts + '</p>' +
          '<div class="weak-links">' +
          (r.misses.length ? '<button type="button" data-quick="m' + u.id + '">Retry misses</button>' : '<a href="#test" data-scope="' + u.id + '">Unit test</a>') +
          (r.learning.length ? '<a href="#flashcards" data-flash="' + u.id + '">Flashcards</a>' : '') +
          '<a href="#' + u.id + '">Notes</a></div>' +
          (r.misses.length
            ? '<details><summary>See what you missed</summary><ul class="missed">' + r.misses.map(function (id) {
                var q = PE.questions[id];
                return '<li><span>' + esc(q.q) + '</span>' + esc(q.c[q.a]) + '</li>';
              }).join('') + '</ul></details>'
            : '') +
          '</div>';
      }).join('') +
      (strong.length ? '<p class="note weak-good">Looking good: ' + strong.map(function (r) { return r.unit.num + ' ' + esc(r.unit.short); }).join(', ') + '</p>' : '');
  }

  /* ---------- Muscle map and machine matcher ---------- */

  var map = { mode: 'explore', muscle: null, machine: null, quiz: null };

  function muscleById(id) {
    return PE.muscles.filter(function (m) { return m.id === id; })[0];
  }

  function machinesFor(id) {
    return PE.machines.filter(function (m) { return m.muscles.indexOf(id) > -1; });
  }

  function newMapQuiz() {
    return { answers: {}, past: {}, current: null, options: [], picked: null, hint: '', typed: '' };
  }

  function isQuiz() {
    return map.mode === 'quiz' || map.mode === 'type';
  }

  function bestKey() {
    return map.mode === 'type' ? 'typeBest' : 'mapBest';
  }

  function paintMap() {
    var lit = [];
    if (map.mode === 'explore' && map.muscle) lit = [map.muscle];
    if (map.mode === 'machines' && map.machine) lit = map.machine.muscles;
    if (isQuiz() && map.quiz.current) lit = [map.quiz.current];

    var misses = saved.mapMiss || {};
    $$('#figure .m').forEach(function (el) {
      var count = map.mode === 'explore' ? misses[el.dataset.muscle] || 0 : 0;
      el.classList.toggle('weak-1', count === 1);
      el.classList.toggle('weak-2', count > 1);
    });

    $$('#figure [data-muscle]').forEach(function (el) {
      var id = el.dataset.muscle;
      el.classList.toggle('is-on', lit.indexOf(id) > -1);
      var m = muscleById(id);
      if (el.classList.contains('m-badge')) {
        el.setAttribute('aria-label', isQuiz() ? 'Number ' + m.n : m.n + ', ' + m.name);
      }
      if (el.classList.contains('m')) {
        var result = isQuiz() ? map.quiz.answers[id] : null;
        var showing = isQuiz() && map.quiz.current === id;
        el.classList.toggle('is-right', result === true && !showing);
        el.classList.toggle('is-wrong', result === false && !showing);
      }
    });
    $$('#key-body tr').forEach(function (tr) {
      tr.style.background = lit.indexOf(tr.dataset.muscle) > -1 ? 'var(--fill)' : '';
    });
  }

  function renderPanel() {
    var panel = $('#map-panel');
    if (map.mode === 'explore') {
      var m = map.muscle && muscleById(map.muscle);
      if (!m) {
        panel.innerHTML = '<p class="panel-empty">Tap a muscle or its number.' +
          (Object.keys(saved.mapMiss || {}).length ? ' Shaded muscles are the ones you keep missing.' : '') + '</p>';
      } else {
        var ms = machinesFor(m.id);
        panel.innerHTML =
          '<div class="panel-head"><span class="panel-num">' + m.n + '</span><div><div class="panel-name">' + esc(m.name) + '</div>' +
          '<div class="panel-view">' + m.view + ' view</div><span class="plain">' + esc(PE.plainMuscles[m.id]) + '</span></div></div>' +
          '<p class="panel-row"><strong>Machine / exercise:</strong> ' +
          (ms.length ? ms.map(function (x) { return esc(x.name); }).join(', ') : 'None on the class machine list') + '</p>';
      }
    } else if (map.mode === 'machines') {
      if (!map.machine) {
        panel.innerHTML = '<p class="panel-empty">Pick a machine to see what it works.</p>';
      } else {
        panel.innerHTML =
          '<div class="panel-name">' + esc(map.machine.name) + '</div>' +
          '<p class="panel-row"><strong>Works:</strong> ' + esc(map.machine.works) + '</p>' +
          '<p class="panel-view">Muscle ' + map.machine.muscles.map(function (id) { return 'number ' + muscleById(id).n; }).join(' and ') + ' on the chart</p>';
      }
    } else {
      renderQuizPanel(panel);
    }
    paintMap();
  }

  function renderQuizPanel(panel) {
    var q = map.quiz;
    var done = Object.keys(q.answers).length;
    var right = Object.keys(q.answers).filter(function (k) { return q.answers[k]; }).length;
    var tally = '<div class="quiz-tally"><span>' + done + ' of 11 done, ' + right + ' right</span>' +
      '<button type="button" class="link-btn" data-restart>Start over</button></div>';

    if (done === 11 && !q.current) {
      panel.innerHTML = '<div class="panel-name">' + right + ' of 11</div>' +
        '<p class="panel-row">' + (saved[bestKey()] != null ? 'Best: ' + saved[bestKey()] + ' of 11' : '') + '</p>' + tally;
    } else if (!q.current) {
      panel.innerHTML = '<p class="panel-empty">Tap a number on the figure, then ' + (map.mode === 'type' ? 'type' : 'pick') + ' the muscle name.</p>' + tally;
    } else if (map.mode === 'type') {
      var muscle = muscleById(q.current);
      if (q.picked !== null) {
        panel.innerHTML = '<p class="panel-q">Number ' + muscle.n + '</p><div class="panel-name">' + esc(muscle.name) + '</div>' +
          '<p class="type-result">' + (q.answers[q.current] ? 'Correct' : 'You typed: ' + esc(q.picked)) + '</p>' + tally;
      } else {
        panel.innerHTML = '<p class="panel-q">Type muscle number ' + muscle.n + '</p>' +
          '<form class="type-form" data-type-form><input class="type-input" id="type-input" type="text" aria-label="Muscle name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + esc(q.typed) + '">' +
          '<button type="submit" class="btn solid">Check</button></form>' +
          (q.hint ? '<p class="type-result game-msg bad">' + esc(q.hint) + '</p>' : '') + tally;
      }
    } else {
      var m = muscleById(q.current);
      var picked = q.picked;
      panel.innerHTML =
        '<p class="panel-q">Which muscle is number ' + m.n + '?</p><div class="quiz-opts">' +
        q.options.map(function (o) {
          var cls = 'opt';
          if (picked) {
            if (o.id === q.current) cls += ' right';
            else if (o.id === picked) cls += ' wrong';
          }
          return '<button type="button" class="' + cls + '" data-opt="' + o.id + '"' + (picked ? ' disabled' : '') + '>' + esc(o.name) + '</button>';
        }).join('') + '</div>' + tally;
    }
  }

  function askMuscle(id) {
    var q = map.quiz;
    // An answered number reopens with its saved choices, so the score can't change.
    var past = q.past[id];
    q.current = id;
    q.options = past ? past.options : quizOptions(id);
    q.picked = past ? past.picked : null;
    q.hint = '';
    q.typed = '';
    renderPanel();
    focusTyping();
  }

  function focusTyping() {
    var input = $('#type-input');
    if (input) input.focus({ preventScroll: true });
  }

  function quizOptions(id) {
    var others = shuffle(PE.muscles.filter(function (m) { return m.id !== id; })).slice(0, 3);
    return shuffle(others.concat([muscleById(id)]));
  }

  function answerMuscle(optId) {
    recordMuscle(optId, optId === map.quiz.current);
  }

  function recordMuscle(picked, isRight) {
    var q = map.quiz;
    q.picked = picked;
    q.answers[q.current] = isRight;
    q.past[q.current] = { options: q.options, picked: picked };
    saved.mapMiss = saved.mapMiss || {};
    var missCount = (saved.mapMiss[q.current] || 0) + (isRight ? -1 : 1);
    if (missCount > 0) saved.mapMiss[q.current] = missCount;
    else delete saved.mapMiss[q.current];
    save();
    var right = Object.keys(q.answers).filter(function (k) { return q.answers[k]; }).length;
    if (Object.keys(q.answers).length === 11) {
      saved[bestKey()] = Math.max(saved[bestKey()] || 0, right);
      save();
    }
    renderPanel();
    if (Object.keys(q.answers).length === 11) {
      setTimeout(function () {
        if (isQuiz() && q === map.quiz) { q.current = null; renderPanel(); }
      }, 1400);
    }
  }

  function normalName(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Counts the letter changes between two words, to spot near-miss spelling.
  function editDistance(a, b) {
    var row = [];
    for (var j = 0; j <= b.length; j++) row[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var prev = row[0];
      row[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var cur = row[k];
        row[k] = Math.min(row[k] + 1, row[k - 1] + 1, prev + (a[i - 1] === b[k - 1] ? 0 : 1));
        prev = cur;
      }
    }
    return row[b.length];
  }

  function answerTyped(text) {
    var q = map.quiz;
    var guess = normalName(text);
    var target = normalName(muscleById(q.current).name);
    if (!guess) return;
    // Typing a different muscle's name, like triceps for biceps, is a wrong answer.
    var otherMuscle = PE.muscles.some(function (m) { return normalName(m.name) === guess; });
    if (!otherMuscle && editDistance(guess, target) <= 2 && !q.hint) {
      // One free retry for a near miss. A second try counts.
      q.hint = 'Close. Check the spelling.';
      q.typed = text;
      renderPanel();
      focusTyping();
      return;
    }
    recordMuscle(text.trim(), guess === target);
  }

  function setMapMode(mode) {
    map.mode = mode;
    if (isQuiz()) map.quiz = newMapQuiz();
    $$('#map-modes button').forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#machine-list').hidden = mode !== 'machines';
    $('#key-table').hidden = isQuiz();
    $('#key-hidden').hidden = !isQuiz();
    renderPanel();
  }

  function pickOnFigure(id) {
    if (map.mode === 'explore') {
      map.muscle = id;
      renderPanel();
    } else if (isQuiz()) {
      askMuscle(id);
    } else {
      // In Machines mode a tap shows the machine for that muscle, if it has one.
      var ms = machinesFor(id);
      map.machine = ms[0] || null;
      paintMachines();
      renderPanel();
    }
  }

  function paintMachines() {
    $$('#machine-list button').forEach(function (b) {
      b.classList.toggle('is-on', !!map.machine && b.dataset.machine === map.machine.id);
    });
  }

  function buildMap() {
    window.PE_buildBody($('#figure'));

    $('#machine-list').innerHTML = PE.machines.map(function (m) {
      return '<button type="button" data-machine="' + m.id + '">' + esc(m.name) + '</button>';
    }).join('');

    $('#key-body').innerHTML = PE.muscles.map(function (m) {
      var ms = machinesFor(m.id);
      return '<tr data-muscle="' + m.id + '"><td>' + m.n + '</td><td>' + esc(m.name) + '<span class="plain">' + esc(PE.plainMuscles[m.id]) + '</span></td><td>' +
        (ms.length ? ms.map(function (x) { return esc(x.name); }).join(', ') : '—') + '</td></tr>';
    }).join('');

    $('#map-modes').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setMapMode(b.dataset.mode);
    });

    $('#machine-list').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      map.machine = PE.machines.filter(function (m) { return m.id === b.dataset.machine; })[0];
      paintMachines();
      renderPanel();
    });

    $('#figure').addEventListener('click', function (e) {
      var el = e.target.closest('[data-muscle]');
      if (el) pickOnFigure(el.dataset.muscle);
    });

    $('#figure').addEventListener('keydown', function (e) {
      var el = e.target.closest('.m-badge');
      if (el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        pickOnFigure(el.dataset.muscle);
      }
    });

    $('#map-panel').addEventListener('click', function (e) {
      var opt = e.target.closest('[data-opt]');
      if (opt) answerMuscle(opt.dataset.opt);
      if (e.target.closest('[data-restart]')) setMapMode(map.mode);
    });

    $('#map-panel').addEventListener('submit', function (e) {
      e.preventDefault();
      answerTyped($('#type-input').value);
    });

    $('#key-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (!tr || map.mode !== 'explore') return;
      map.muscle = tr.dataset.muscle;
      renderPanel();
      $('#figure').scrollIntoView({ block: 'center' });
    });

    renderPanel();
  }

  /* ---------- Heart rate calculator ---------- */

  var GAUGE_MAX = 220;

  function polar(bpm, r) {
    var a = Math.PI * (1 - bpm / GAUGE_MAX);
    return [170 + r * Math.cos(a), 170 - r * Math.sin(a)];
  }

  function arc(from, to, r) {
    var p = polar(from, r);
    var q = polar(to, r);
    return 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
  }

  function buildGauge() {
    var ticks = [145, 186, 220].map(function (bpm) {
      var p = polar(bpm, 152);
      return '<text class="g-tick" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 5).toFixed(1) + '">' + bpm + '</text>';
    }).join('');
    $('#gauge').innerHTML =
      '<svg viewBox="0 0 340 250" role="img" aria-label="Heart rate gauge showing beginner under 145 BPM, moderate to high 145 to 186 BPM, and your max heart rate">' +
      '<path class="g-track" d="' + arc(0, 145, 120) + '" stroke="var(--shape)"/>' +
      '<path class="g-track" d="' + arc(145, 186, 120) + '" stroke="var(--accent)"/>' +
      '<path class="g-track" d="' + arc(186, 220, 120) + '" stroke="var(--paper)"/>' +
      ticks +
      '<g class="g-needle" id="needle"><path d="M170 164 L62 170 L170 176Z" fill="var(--ink)"/></g>' +
      '<circle cx="170" cy="170" r="10" fill="var(--ink)"/>' +
      '<text class="g-big" x="170" y="224" id="g-val"></text>' +
      '<text class="g-unit" x="170" y="243">Max HR in BPM</text>' +
      '</svg>' +
      '<p class="bar-key" style="gap:16px;flex-wrap:wrap;margin:6px 0 0"><span style="width:auto">Grey: beginner</span><span>Red: moderate to high</span></p>';
  }

  function updateHR(remember) {
    var input = $('#age');
    var age = Number(input.value);
    var out = $('#hr-math');
    if (!input.value || !(age >= 1 && age <= 100) || age % 1 !== 0) {
      out.textContent = 'Enter a whole age from 1 to 100';
      out.style.fontSize = '24px';
      return;
    }
    var max = 220 - age;
    out.style.fontSize = '';
    out.textContent = '220 − ' + age + ' = ' + max;
    $('#g-val').textContent = max;
    $('#needle').style.transform = 'rotate(' + (max / GAUGE_MAX * 180) + 'deg)';
    if (remember) { saved.age = age; save(); }
  }

  /* ---------- 1 Rep Max calculator ---------- */

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function updateORM(remember) {
    var value = Number($('#orm').value);
    var out = $('#orm-out');
    if (!(value > 0)) {
      out.innerHTML = '<p>Enter your 1RM in pounds.</p>';
      return;
    }
    var box = function (name, pct, cls) {
      return '<div class="orm-box ' + cls + '"><h3>' + name + '</h3><span class="orm-w">' + round1(value * pct) + ' lbs</span>' +
        '<span class="orm-sum">' + value + ' × ' + pct + '</span></div>';
    };
    out.innerHTML = box('Endurance', 0.6, '') + box('Strength', 0.8, 'strong');
    if (remember) { saved.orm = value; save(); }
  }

  /* ---------- Protocol dots and move-in boxes ---------- */

  function buildSmallGraphics() {
    $$('[data-dots]').forEach(function (el) {
      var parts = el.dataset.dots.split(',').map(Number);
      var html = '';
      for (var i = 0; i < parts[1]; i++) html += '<i' + (i >= parts[0] ? ' class="opt-dot"' : '') + '></i>';
      el.innerHTML = html;
    });

    // Three flights of stairs with 20 small boxes stacked beside them
    var svg = '<path d="M150 170h30v-30h30v-30h30v-30h50" fill="none" stroke="var(--ink)" stroke-width="4"/>';
    svg += '<path d="M8 170h284" stroke="var(--ink)" stroke-width="2"/>';
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 5; c++) {
        svg += '<rect x="' + (12 + c * 25) + '" y="' + (146 - r * 25) + '" width="22" height="22" fill="var(--accent)"/>' +
          '<path d="M' + (23 + c * 25) + ' ' + (146 - r * 25) + 'v9" stroke="var(--paper)" stroke-width="3"/>';
      }
    }
    [[165, 136], [195, 106], [225, 76]].forEach(function (p, i) {
      svg += '<text x="' + p[0] + '" y="' + p[1] + '" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="20" fill="var(--ink)" text-anchor="middle">' + (i + 1) + '</text>';
    });
    $('#boxes-svg').innerHTML = svg;

    // Fat cell timeline
    var stages = [
      { when: 'First few years of life', text: 'Fat cell number grows rapidly.', count: 5, r: 5 },
      { when: 'By your early twenties', text: 'Fat cell number is set.', count: 10, r: 5 },
      { when: 'After that', text: 'Fat cells grow in size.', count: 10, r: 11 },
      { when: 'With fat loss', text: 'Fat cells shrink in size, but not in number.', count: 10, r: 7 }
    ];
    $('#timeline').innerHTML = stages.map(function (s) {
      var dots = '';
      for (var i = 0; i < 10; i++) {
        var cx = 13 + (i % 5) * 26;
        var cy = 13 + Math.floor(i / 5) * 26 + 12;
        dots += i < s.count
          ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + s.r + '" fill="var(--accent)"/>'
          : '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="none" stroke="var(--mute)" stroke-dasharray="2 2"/>';
      }
      return '<li><svg class="t-cells" viewBox="0 0 136 76" aria-hidden="true">' + dots + '</svg><span class="t-line"></span>' +
        '<span class="t-when">' + esc(s.when) + '</span>' + esc(s.text) + '</li>';
    }).join('');

    // Reference table of the 5 methods
    var full = { hydro: 'Hydrostatic weighing (underwater weighing)', dxa: 'DXA/DEXA (Dual-Energy X-ray Absorptiometry)' };
    $('#method-table tbody').innerHTML = PE.methods.map(function (m) {
      return '<tr><td><svg aria-hidden="true"><use href="#' + m.icon + '"></use></svg></td>' +
        '<td><strong>' + esc(full[m.id] || m.name) + '</strong>' + esc(m.desc) + '</td></tr>';
    }).join('');
  }

  /* ---------- Aerobic vs. anaerobic sorter ---------- */

  var sorter = { left: [], placed: { aerobic: [], anaerobic: [] }, picked: null, misses: 0, msg: '', bad: false };

  function resetSorter() {
    sorter.left = shuffle(PE.activities);
    sorter.placed = { aerobic: [], anaerobic: [] };
    sorter.picked = null;
    sorter.misses = 0;
    sorter.msg = '';
    sorter.bad = false;
    renderSorter();
  }

  function renderSorter() {
    var done = sorter.left.length === 0;
    var bin = function (key, label) {
      return '<button type="button" class="bin" data-bin="' + key + '"><span class="bin-name">' + label + '</span>' +
        sorter.placed[key].map(function (n) { return '<span class="bin-item">' + esc(n) + '</span>'; }).join('') + '</button>';
    };
    var msg = sorter.msg;
    if (done) {
      msg = 'All 8 sorted with ' + sorter.misses + (sorter.misses === 1 ? ' miss' : ' misses') + '.';
      if (saved.sortBest != null) msg += ' Fewest misses: ' + saved.sortBest + '.';
    }
    $('#sorter').innerHTML =
      '<div class="tray">' + sorter.left.map(function (a) {
        return '<button type="button" class="chip' + (sorter.picked === a.name ? ' is-picked' : '') + '" data-chip="' + esc(a.name) + '" aria-pressed="' + (sorter.picked === a.name) + '">' + esc(a.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="bins">' + bin('aerobic', 'Aerobic') + bin('anaerobic', 'Anaerobic') + '</div>' +
      '<div class="game-foot"><p class="game-msg' + (sorter.bad && !done ? ' bad' : '') + '" aria-live="polite">' + esc(msg) + '</p>' +
      '<button type="button" class="btn ghost" data-reset>Start over</button></div>';
  }

  function dropActivity(name, binKey) {
    var a = sorter.left.filter(function (x) { return x.name === name; })[0];
    if (!a) return;
    sorter.picked = null;
    if (a.bin === binKey) {
      sorter.left = sorter.left.filter(function (x) { return x !== a; });
      sorter.placed[binKey].push(a.name);
      sorter.msg = a.name + ' is ' + binKey + '.';
      sorter.bad = false;
      if (!sorter.left.length) {
        saved.sortBest = saved.sortBest == null ? sorter.misses : Math.min(saved.sortBest, sorter.misses);
        save();
      }
    } else {
      sorter.misses++;
      sorter.msg = 'Not ' + binKey + '. Try the other box.';
      sorter.bad = true;
    }
    renderSorter();
  }

  function buildSorter() {
    var box = $('#sorter');
    var drag = null;
    var skipClick = false;

    box.addEventListener('pointerdown', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      drag = { chip: chip, x: e.clientX, y: e.clientY, moved: false };
      chip.setPointerCapture(e.pointerId);
    });

    box.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) {
        drag.moved = true;
        drag.chip.classList.add('is-drag');
      }
      if (drag.moved) {
        drag.chip.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        var under = document.elementFromPoint(e.clientX, e.clientY);
        var target = under && under.closest('.bin');
        $$('.bin', box).forEach(function (b) { b.classList.toggle('is-target', b === target); });
      }
    });

    function endDrag(e, cancelled) {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      skipClick = true;
      setTimeout(function () { skipClick = false; }, 0);
      var under = cancelled ? null : document.elementFromPoint(e.clientX, e.clientY);
      var target = under && under.closest('.bin');
      if (target) {
        dropActivity(d.chip.dataset.chip, target.dataset.bin);
      } else {
        renderSorter();
      }
    }

    box.addEventListener('pointerup', function (e) { endDrag(e, false); });
    box.addEventListener('pointercancel', function (e) { endDrag(e, true); });

    box.addEventListener('click', function (e) {
      if (skipClick) return;
      if (e.target.closest('[data-reset]')) { resetSorter(); return; }
      var chip = e.target.closest('.chip');
      if (chip) {
        sorter.picked = sorter.picked === chip.dataset.chip ? null : chip.dataset.chip;
        sorter.msg = sorter.picked ? 'Now tap Aerobic or Anaerobic.' : '';
        sorter.bad = false;
        renderSorter();
        return;
      }
      var bin = e.target.closest('.bin');
      if (bin && sorter.picked) dropActivity(sorter.picked, bin.dataset.bin);
    });

    resetSorter();
  }

  /* ---------- Body composition matching ---------- */

  var matcher = { order: [], matched: {}, picked: null, misses: 0, missId: null };

  function resetMatcher() {
    matcher.order = shuffle(PE.methods);
    matcher.matched = {};
    matcher.picked = null;
    matcher.misses = 0;
    matcher.missId = null;
    renderMatcher();
  }

  function renderMatcher() {
    var count = Object.keys(matcher.matched).length;
    var msg = count === 5
      ? 'All 5 matched with ' + matcher.misses + (matcher.misses === 1 ? ' miss.' : ' misses.')
      : matcher.missId ? 'Not that one. Try again.' : '';
    $('#matcher').innerHTML =
      '<div class="method-tiles">' + PE.methods.map(function (m) {
        var done = matcher.matched[m.id];
        return '<button type="button" class="tile' + (done ? ' is-done' : '') + (matcher.picked === m.id ? ' is-picked' : '') + '" data-method="' + m.id + '"' + (done ? ' disabled' : '') + '>' +
          '<svg aria-hidden="true"><use href="#' + m.icon + '"></use></svg>' + esc(m.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="desc-list">' + matcher.order.map(function (m) {
        var done = matcher.matched[m.id];
        return '<button type="button" class="desc' + (matcher.missId === m.id ? ' is-miss' : '') + '" data-desc="' + m.id + '"' + (done ? ' disabled' : '') + '>' +
          (done ? '<b>' + esc(m.name) + '</b>' : '') + esc(m.desc) + '</button>';
      }).join('') + '</div>' +
      '<div class="game-foot"><p class="game-msg' + (matcher.missId ? ' bad' : '') + '" aria-live="polite">' + esc(msg) + '</p>' +
      '<button type="button" class="btn ghost" data-reset>Start over</button></div>';
  }

  function buildMatcher() {
    $('#matcher').addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) { resetMatcher(); return; }
      var tile = e.target.closest('[data-method]');
      if (tile) {
        matcher.picked = matcher.picked === tile.dataset.method ? null : tile.dataset.method;
        matcher.missId = null;
        renderMatcher();
        return;
      }
      var d = e.target.closest('[data-desc]');
      if (!d || !matcher.picked) return;
      if (d.dataset.desc === matcher.picked) {
        matcher.matched[matcher.picked] = true;
        matcher.picked = null;
        matcher.missId = null;
      } else {
        matcher.misses++;
        matcher.missId = d.dataset.desc;
      }
      renderMatcher();
    });
    resetMatcher();
  }

  /* ---------- Flashcards ---------- */

  var flash = { scope: 'all', pile: 'all', deck: [], pos: 0, mode: 'flip', answered: null };

  function unitLabel(n) {
    var u = PE.units[n - 1];
    return u.num + ' ' + u.title;
  }

  function cardKey(c) {
    return 'u' + c.u + ':' + c.front;
  }

  function isKnown(c) {
    return !!(saved.known && saved.known[cardKey(c)]);
  }

  function scopeCards() {
    return PE.flashcards.filter(function (c) { return flash.scope === 'all' || 'u' + c.u === flash.scope; });
  }

  function setDeck(shuffled) {
    var deck = scopeCards().filter(function (c) {
      return (flash.pile === 'all' || !isKnown(c)) && (flash.mode !== 'type' || typeable(c));
    });
    flash.deck = shuffled ? shuffle(deck) : deck;
    flash.pos = 0;
    renderCard();
  }

  function paintFlash() {
    $$('#flash-units button').forEach(function (b) {
      var on = b.dataset.unit === flash.scope;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var cards = scopeCards();
    var known = cards.filter(isKnown).length;
    $$('#flash-pile button').forEach(function (b) {
      var on = b.dataset.pile === flash.pile;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = b.dataset.pile === 'all' ? 'All cards (' + cards.length + ')' : 'Still learning (' + (cards.length - known) + ')';
    });
    $$('#flash-mode button').forEach(function (b) {
      var on = b.dataset.mode === flash.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#flash-known').textContent = known + ' of ' + cards.length + ' Got it';
    $('#flash-bar').style.width = pct(known, cards.length) + '%';
  }

  function renderCard() {
    var c = flash.deck[flash.pos];
    var card = $('#card');
    var hasCard = !!c;
    card.classList.remove('is-flipped');
    card.disabled = !hasCard;
    var swap = settings.cardFirst === 'answer';
    var note = hasCard ? PE.simpleCards[c.front] || '' : '';
    card.classList.toggle('swap', hasCard && swap);
    $('#card-front').textContent = hasCard ? (swap ? c.back : c.front) : 'Pile cleared';
    $('#card-back').textContent = hasCard ? (swap ? c.front : c.back) : '';
    $('#card-simple-f').textContent = swap ? note : '';
    $('#card-simple-b').textContent = swap ? '' : note;
    $('#card-tag-f').textContent = hasCard ? unitLabel(c.u) : 'Every card here is marked Got it';
    $('#card-tag-b').textContent = hasCard ? unitLabel(c.u) : '';
    $('#card-count').textContent = hasCard ? (flash.pos + 1) + ' of ' + flash.deck.length : '0 cards';
    ['#card-learning', '#card-known', '#card-prev', '#card-next', '#card-speak'].forEach(function (id) { $(id).disabled = !hasCard; });
    $('#card-known').classList.toggle('is-on', hasCard && isKnown(c));
    if (speech.btn === $('#card-speak')) stopSpeaking();

    var typing = flash.mode === 'type';
    card.classList.toggle('typing', typing);
    $('#flash-type').hidden = !typing || !hasCard;
    $('.flash-mark').hidden = typing;
    if (typing) {
      flash.answered = null;
      card.classList.remove('swap');
      $('#card-front').textContent = hasCard ? typeable(c).prompt : (flash.pile === 'learning' ? 'Pile cleared' : 'No cards to type here');
      $('#card-simple-f').textContent = '';
      $('#card-tag-f').textContent = hasCard ? unitLabel(c.u) + ' · Type the answer' : 'Try another unit, or switch back to Flip';
      $('#type-input').value = '';
      $('#type-input').disabled = false;
      $('#type-check').textContent = 'Check';
      $('#type-result').hidden = true;
    }
    paintFlash();
  }

  /* ---------- Type it ---------- */

  // A card can be typed when one side is short. You see the long side and type the short one.
  function typeable(c) {
    if (c.typed !== undefined) return c.typed;
    var words = function (s) { return s.trim().split(/\s+/).length; };
    var shortBack = c.back.indexOf('\n') === -1 && c.back.length <= 40 && words(c.back) <= 5;
    var termFront = !/[?…:_\n]/.test(c.front) && words(c.front) <= 4 &&
      !/^(true or false|why|when|can|what|how|two|benefits)\b/i.test(c.front) && !/example|problem/i.test(c.front);
    c.typed = shortBack ? { prompt: c.front, answer: c.back } : termFront ? { prompt: c.back, answer: c.front } : null;
    return c.typed;
  }

  function cleanAnswer(s) {
    return s.toLowerCase().replace(/[−–—]/g, '-').replace(/&/g, ' and ').replace(/[^a-z0-9%\- ]+/g, ' ')
      .replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
  }

  // "One Rep Max (1RM)" accepts either name, and "DXA/DEXA" accepts either spelling.
  function answerForms(ans) {
    var forms = [ans];
    var m = ans.match(/^(.*?)\s*\((.*)\)\s*$/);
    if (m) forms.push(m[1], m[2]);
    forms.slice().forEach(function (f) { if (f.indexOf('/') > -1) forms = forms.concat(f.split('/')); });
    return forms.map(cleanAnswer).filter(Boolean);
  }

  // Lists can come in any order, and small spelling slips still count.
  function matchAnswer(typed, ans) {
    var t = cleanAnswer(typed);
    if (!t) return false;
    var sorted = function (s) { return s.replace(/\band\b/g, ' ').split(' ').filter(Boolean).sort().join(' '); };
    return answerForms(ans).some(function (f) {
      var slack = f.length <= 4 ? 0 : f.length <= 10 ? 1 : 2;
      return t === f || editDistance(t, f) <= slack || sorted(t) === sorted(f);
    });
  }

  function checkTyped() {
    var c = flash.deck[flash.pos];
    if (!c) return;
    if (flash.answered !== null) {
      nextAfter(flash.answered);
      return;
    }
    var input = $('#type-input');
    if (!input.value.trim()) { input.focus(); return; }
    var ans = typeable(c).answer;
    var right = matchAnswer(input.value, ans);
    flash.answered = right;
    setKnown(c, right);
    bumpGoal();
    save();
    var box = $('#type-result');
    box.hidden = false;
    box.className = 'type-result ' + (right ? 'right' : 'wrong');
    box.innerHTML = right
      ? '<b>Correct</b>' + (cleanAnswer(input.value) !== cleanAnswer(ans) ? ' Spelled: ' + esc(ans) : '')
      : '<b>Not quite.</b> Answer: ' + esc(ans);
    input.disabled = true;
    $('#type-check').textContent = 'Next';
    $('#type-check').focus();
    paintFlash();
  }

  function nextAfter(known) {
    if (flash.pile === 'learning' && known) {
      flash.deck.splice(flash.pos, 1);
      if (flash.pos >= flash.deck.length) flash.pos = 0;
      renderCard();
    } else {
      moveCard(1);
    }
    if (flash.mode === 'type' && !$('#flash-type').hidden) $('#type-input').focus({ preventScroll: true });
  }

  function setFlashMode(mode) {
    flash.mode = mode;
    saved.flashMode = mode;
    save();
    setDeck(false);
  }

  function moveCard(step) {
    var n = flash.deck.length;
    if (!n) return;
    flash.pos = (flash.pos + step + n) % n;
    renderCard();
  }

  function setKnown(c, known) {
    saved.known = saved.known || {};
    if (known) saved.known[cardKey(c)] = true;
    else delete saved.known[cardKey(c)];
    reviewRecord('c:' + cardKey(c), known);
  }

  function markCard(known) {
    var c = flash.deck[flash.pos];
    if (!c) return;
    setKnown(c, known);
    bumpGoal();
    save();
    nextAfter(known);
  }

  function buildFlashcards() {
    var box = $('#flash-units');
    var scopes = [{ id: 'all', label: 'All units' }].concat(PE.units.map(function (u) { return { id: u.id, label: u.num + ' ' + u.short }; }));
    box.innerHTML = scopes.map(function (s) {
      return '<button type="button" data-unit="' + s.id + '">' + esc(s.label) + '</button>';
    }).join('');

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      flash.scope = b.dataset.unit;
      saved.flashScope = flash.scope;
      save();
      setDeck(false);
    });

    $('#flash-pile').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      flash.pile = b.dataset.pile;
      setDeck(false);
    });

    $('#card-known').addEventListener('click', function () { markCard(true); });
    $('#card-learning').addEventListener('click', function () { markCard(false); });

    $('#card').addEventListener('click', function () {
      if (flash.mode === 'type') $('#type-input').focus();
      else $('#card').classList.toggle('is-flipped');
    });
    $('#flash-mode').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.dataset.mode !== flash.mode) setFlashMode(b.dataset.mode);
    });
    $('#flash-type').addEventListener('submit', function (e) {
      e.preventDefault();
      checkTyped();
    });
    $('#card-speak').addEventListener('click', function () {
      var c = flash.deck[flash.pos];
      if (!c) return;
      var flipped = $('#card').classList.contains('is-flipped');
      var text = flash.mode === 'type' ? typeable(c).prompt : $(flipped ? '#card-back' : '#card-front').textContent;
      speak(text, this);
    });
    $('#card-prev').addEventListener('click', function () { moveCard(-1); });
    $('#card-next').addEventListener('click', function () { moveCard(1); });
    $('#card-shuffle').addEventListener('click', function () { setDeck(true); });
    $('#card-order').addEventListener('click', function () { setDeck(false); });

    document.addEventListener('keydown', function (e) {
      if (!$('#view-flashcards').classList.contains('is-active')) return;
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') moveCard(1);
      if (e.key === 'ArrowLeft') moveCard(-1);
    });

    if (saved.flashScope && scopes.some(function (s) { return s.id === saved.flashScope; })) flash.scope = saved.flashScope;
    if (saved.flashMode === 'type') flash.mode = 'type';
    setDeck(false);
  }

  /* ---------- Review schedule ---------- */

  // Days to wait. A miss goes back to the first one, each right answer moves one along.
  var WAITS = [1, 3, 7, 14, 30];
  var NEW_PER_DAY = 10;
  var STUDY_ROUND = 20;

  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function thisDay() {
    return dayNumber(new Date());
  }

  function examDay() {
    if (!settings.exam) return null;
    var p = settings.exam.split('-').map(Number);
    var day = dayNumber(new Date(p[0], p[1] - 1, p[2]));
    return isNaN(day) ? null : day;
  }

  // Test questions use their number. Flashcards use 'c' plus their number.
  function isCardId(id) {
    return typeof id === 'string';
  }

  function cardOf(id) {
    return PE.flashcards[Number(id.slice(1))];
  }

  function itemOf(id) {
    return isCardId(id) ? cardOf(id) : PE.questions[id];
  }

  function itemKey(id) {
    return isCardId(id) ? 'c:' + cardKey(cardOf(id)) : 'q:' + PE.questions[id].q;
  }

  function reviewRecord(key, isRight) {
    var day = thisDay();
    var exam = examDay();
    saved.review = saved.review || {};
    var rec = saved.review[key];
    // A second right answer on the same day doesn't move it along.
    if (isRight && rec && rec.last === day) {
      rec.due = Math.max(rec.due, day + 1);
      return;
    }
    var box = isRight ? (rec ? Math.min(rec.box + 1, WAITS.length - 1) : 1) : 0;
    saved.review[key] = {
      box: box,
      due: !isRight && exam === day ? day : day + WAITS[box],
      last: day,
      first: rec ? rec.first : day
    };
  }

  // Anything due after the midterm gets one last review the day before it.
  function dueDay(rec) {
    var exam = examDay();
    if (exam === null || thisDay() > exam) return rec.due;
    var cap = exam - 1;
    return rec.due > cap && rec.last < cap ? cap : rec.due;
  }

  // Misses and Got it marks made before the schedule existed.
  function seedReview() {
    var day = thisDay();
    saved.review = saved.review || {};
    missedIds().forEach(function (id) {
      var key = itemKey(id);
      if (!saved.review[key]) saved.review[key] = { box: 0, due: day, last: day - 1, first: 0 };
    });
    PE.flashcards.filter(isKnown).forEach(function (c) {
      var key = 'c:' + cardKey(c);
      if (!saved.review[key]) saved.review[key] = { box: 1, due: day + WAITS[1], last: day - 1, first: 0 };
    });
  }

  function studyPlan() {
    var day = thisDay();
    var exam = examDay();
    var review = saved.review || {};
    var due = [];
    var fresh = [];
    var next = null;
    var added = 0;
    var ids = PE.questions.map(function (q, i) { return i; }).concat(PE.flashcards.map(function (c, i) { return 'c' + i; }));

    ids.forEach(function (id) {
      var rec = review[itemKey(id)];
      if (!rec) {
        fresh.push(id);
        return;
      }
      if (rec.first === day) added++;
      var when = dueDay(rec);
      if (when <= day) due.push({ id: id, when: when, box: rec.box });
      else if (exam === null || day > exam || when <= exam) {
        if (!next || when < next.when) next = { when: when, count: 1 };
        else if (when === next.when) next.count++;
      }
    });

    // New items are paced so all of them get seen before the midterm.
    var daysLeft = exam !== null && exam >= day ? Math.max(exam - day, 1) : 0;
    var perDay = daysLeft ? Math.max(NEW_PER_DAY, Math.ceil((fresh.length + added) / daysLeft)) : NEW_PER_DAY;
    var rank = {};
    PE.units.forEach(function (u) { rank[u.id] = unitScore(u); });
    fresh = shuffle(fresh).sort(function (a, b) {
      return rank['u' + itemOf(a).u] - rank['u' + itemOf(b).u];
    }).slice(0, Math.max(0, perDay - added));

    due.sort(function (a, b) { return a.when - b.when || a.box - b.box; });
    return {
      due: due.map(function (d) { return d.id; }),
      fresh: fresh,
      next: next,
      paced: !!daysLeft
    };
  }

  function studyCount(plan) {
    return plan.due.length + plan.fresh.length;
  }

  function thingsText(n) {
    return n + (n === 1 ? ' thing' : ' things');
  }

  function waitText(days) {
    return days === 1 ? 'tomorrow' : 'in ' + days + ' days';
  }

  function backText(id) {
    var rec = (saved.review || {})[itemKey(id)];
    if (!rec) return '';
    var day = thisDay();
    var exam = examDay();
    var when = dueDay(rec);
    if (exam !== null && day <= exam && when > exam) return 'You are set on this one for the midterm';
    if (when <= day) return 'This comes back today';
    return 'This comes back ' + waitText(when - day);
  }

  function renderStudy() {
    var plan = studyPlan();
    var n = studyCount(plan);
    var parts = [];
    if (plan.due.length) parts.push(plan.due.length + ' to review');
    if (plan.fresh.length) parts.push(plan.fresh.length + ' new');
    var note;
    if (n) {
      note = parts.join(', ') + '. ' + (n > STUDY_ROUND ? STUDY_ROUND + ' at a time. ' : '') +
        (examDay() === thisDay() ? 'Misses stay on the list until you get them right.' : 'Misses come back tomorrow, right answers wait longer.') +
        (plan.paced ? ' Paced for your midterm.' : '');
    } else if (plan.next) {
      note = 'Next review ' + waitText(plan.next.when - thisDay()) + ': ' + thingsText(plan.next.count);
    } else {
      note = 'You have reviewed everything';
    }
    $('#home-study-btn').disabled = !n;
    $('#home-study').textContent = n ? 'Study ' + thingsText(n) + ' today' : 'Done for today';
    $('#home-study-note').textContent = note;
  }

  /* ---------- Saved questions, passages and text evidence ---------- */

  function savedQList() {
    return saved.savedQs || [];
  }

  function isSavedQ(q) {
    return savedQList().indexOf(q.q) > -1;
  }

  function toggleSavedQ(q) {
    var list = savedQList().filter(function (text) { return text !== q.q; });
    var adding = list.length === savedQList().length;
    if (adding) list.push(q.q);
    saved.savedQs = list;
    save();
    toast(adding ? 'Bookmarked. Find it under Bookmarks' : 'Bookmark removed');
  }

  function savedIds() {
    var list = savedQList();
    var ids = [];
    PE.questions.forEach(function (q, i) {
      if (list.indexOf(q.q) > -1) ids.push(i);
    });
    return ids;
  }

  function clipList() {
    return saved.clips || [];
  }

  function addClip(clip) {
    var list = clipList();
    if (list.some(function (c) { return c.text === clip.text; })) {
      toast('Already saved');
      return;
    }
    clip.at = Date.now();
    saved.clips = [clip].concat(list);
    save();
    toast('Passage saved. Find it under Bookmarks');
  }

  var STOP = ('the a an and or of to in on for is are what which who whom how do does your you it its at by with be as that this ' +
    'these those from into than then their they them can will was were has have had not no yes true false per each when why one ' +
    'two all any more most some such our out about also only other there here been being get got make makes example called').split(' ');

  function keyWords(s) {
    return wordsOf(s).filter(function (w) { return w.length > 1 && STOP.indexOf(w) === -1 && !/^[.\-]+$/.test(w); });
  }

  function sameWord(a, b) {
    if (a === b) return true;
    if (a.length < 4 || b.length < 4) return false;
    var n = Math.min(a.length, b.length, 6);
    return a.slice(0, n) === b.slice(0, n) && Math.abs(a.length - b.length) <= 4;
  }

  function hasWord(words, w) {
    return words.some(function (x) { return sameWord(x, w); });
  }

  // Finds the line in the unit notes that best backs up the answer.
  function evidenceFor(q) {
    var view = document.getElementById('view-u' + q.u);
    if (!view) return null;
    var answer = q.t === 'tf' ? [] : keyWords(q.c[q.a]);
    var why = keyWords(q.why);
    var ask = keyWords(q.q);
    var best = null;
    $$('.block li, .block p, .block tr, .block h3, .block figcaption, .block blockquote, .block dd, .block ul, .block ol, .tool li, .tool p, .tool tr, .tool figcaption', view).forEach(function (el) {
      if (el.closest('.simple, [hidden], .jump, .hidden-note')) return;
      var text = allText(el);
      if (/^[UO]L$/.test(el.tagName)) {
        if (el.closest('li')) return;
        // A list reads as one line, with the label just above it.
        text = $$(':scope > li', el).map(allText).join(', ');
        var label = el.previousElementSibling;
        if (label && !label.classList.contains('simple') && /^(P|H3)$/.test(label.tagName) && allText(label).length < 80) text = allText(label) + ': ' + text;
      } else if (el.tagName === 'H3') {
        var next = el.nextElementSibling;
        if (next && !next.classList.contains('simple')) text += ': ' + allText(next);
      }
      if (text.length < 3) return;
      var words = wordsOf(text);
      var score = 0;
      answer.forEach(function (w) { if (hasWord(words, w)) score += 3; });
      why.forEach(function (w) { if (hasWord(words, w)) score += 2; });
      ask.forEach(function (w) { if (hasWord(words, w)) score += 1; });
      score = score / (1 + words.length / 60);
      if (score > 0 && (!best || score > best.score)) best = { el: el, text: text, score: score };
    });
    if (!best) return null;
    var sec = best.el.closest('.block, .tool');
    var text = best.text;
    return {
      el: best.el, sec: sec, text: text, view: view.id.replace('view-', ''),
      title: $('h2', sec).textContent, unit: view.dataset.title,
      marks: answer.concat(why).map(function (w) { return { alts: [w] }; })
    };
  }

  function goToEvidence(ev) {
    location.hash = ev.view;
    setTimeout(function () {
      ev.el.scrollIntoView({ block: 'center' });
      ev.el.classList.add('search-spot');
      setTimeout(function () { ev.el.classList.remove('search-spot'); }, 2400);
    }, 120);
  }

  function evidenceHtml(q) {
    var ev = evidenceFor(q);
    if (!ev) {
      return '<div class="evidence"><b class="ev-label">Text evidence</b><p>No exact line in the notes for this one. The key idea: ' + esc(q.why) + '</p></div>';
    }
    return '<div class="evidence" aria-live="polite"><b class="ev-label">Text evidence</b>' +
      '<blockquote>' + markText(ev.text, ev.marks) + '</blockquote>' +
      '<span class="ev-src">From the notes: ' + esc(ev.unit) + ', ' + esc(ev.title) + '</span>' +
      '<div class="ev-actions"><button type="button" class="link-btn" data-ev-open>Read it in the notes</button>' +
      '<button type="button" class="link-btn" data-ev-save>Save this passage</button>' +
      '<a class="link-btn" href="https://forms.gle/6LFouHe3cwiY1r5t7" target="_blank" rel="noopener">Something wrong? Tell us</a></div></div>';
  }

  function markList() {
    return (saved.marks || []).filter(function (id) { return document.getElementById(id); });
  }

  function paintMarks() {
    var list = markList();
    $$('.mark-icon').forEach(function (btn) {
      var on = list.indexOf(btn.dataset.mark) > -1;
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', (on ? 'Remove bookmark from ' : 'Bookmark ') + btn.dataset.title);
      document.getElementById(btn.dataset.mark).classList.toggle('is-marked', on);
    });
  }

  function toggleMark(id) {
    var list = markList();
    var on = list.indexOf(id) > -1;
    saved.marks = on ? list.filter(function (x) { return x !== id; }) : list.concat(id);
    save();
    paintMarks();
    toast(on ? 'Bookmark removed' : 'Section bookmarked. Find it under Bookmarks');
  }

  // A bookmark button next to every heading in the notes, like a ribbon in a textbook.
  function buildMarks() {
    $$('.view.unit').forEach(function (view) {
      var head = $('.unit-head', view);
      var tip = document.createElement('p');
      tip.className = 'note mark-tip';
      tip.innerHTML = 'Tap <svg aria-hidden="true"><use href="#i-bookmark"></use></svg> next to a heading to bookmark that section. Select any text to save just that passage.';
      head.parentNode.insertBefore(tip, head.nextSibling);
      $$('.block[id], .tool[id]', view).forEach(function (sec) {
        var h = $(':scope > h2', sec);
        if (!h) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mark-icon';
        btn.dataset.mark = sec.id;
        btn.dataset.title = h.textContent.trim();
        btn.innerHTML = '<svg aria-hidden="true"><use href="#i-bookmark"></use></svg>';
        h.appendChild(btn);
      });
    });
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.mark-icon');
      if (btn) toggleMark(btn.dataset.mark);
    });
    paintMarks();
  }

  // Select text in a unit's notes, then tap Save passage.
  function buildClipper() {
    var bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'clip-bar';
    bar.id = 'clip-bar';
    bar.hidden = true;
    bar.textContent = 'Save passage';
    document.body.appendChild(bar);
    var pending = null;
    var hideTimer = null;

    function readSelection() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
      var node = sel.getRangeAt(0).commonAncestorContainer;
      var el = node.nodeType === 1 ? node : node.parentNode;
      var view = el.closest('.view.unit');
      if (!view) return null;
      var sec = el.closest('.block, .tool') || (sel.anchorNode && sel.anchorNode.parentNode && sel.anchorNode.parentNode.closest('.block, .tool'));
      var text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 3) return null;
      if (text.length > 1200) text = text.slice(0, 1200) + '...';
      return {
        text: text, view: view.id.replace('view-', ''), unit: view.dataset.title,
        sec: sec ? sec.id : '', title: sec && $('h2', sec) ? $('h2', sec).textContent : ''
      };
    }

    document.addEventListener('selectionchange', function () {
      var clip = readSelection();
      clearTimeout(hideTimer);
      if (clip) {
        pending = clip;
        bar.hidden = false;
      } else {
        // Wait a moment, so tapping the button on a phone still counts.
        hideTimer = setTimeout(function () { bar.hidden = true; pending = null; }, 400);
      }
    });
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    bar.addEventListener('click', function () {
      if (!pending) return;
      addClip(pending);
      pending = null;
      bar.hidden = true;
      var sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    });
    window.addEventListener('hashchange', function () { bar.hidden = true; pending = null; });
  }

  function timeAgo(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderSaved() {
    var root = $('#saved-root');
    var ids = savedIds();
    var clips = clipList();
    var marks = markList();
    root.innerHTML =
      '<h2 class="t-section">Bookmarked sections of the notes (' + marks.length + ')</h2>' +
      (marks.length
        ? '<ul class="saved-list">' + marks.map(function (id) {
            var sec = document.getElementById(id);
            var view = sec.closest('.view');
            var btn = $('.mark-icon', sec);
            var copy = sec.cloneNode(true);
            $$('.simple, h2, button', copy).forEach(function (x) { x.parentNode.removeChild(x); });
            var body = allText(copy);
            return '<li><span class="saved-q">' + esc(btn ? btn.dataset.title : id) + '</span>' +
              '<p class="mark-peek">' + esc(body.slice(0, 140)) + (body.length > 140 ? '...' : '') + '</p>' +
              '<div class="ev-actions"><span class="ev-src">' + esc(view.dataset.title) + '</span>' +
              '<button type="button" class="link-btn" data-mark-open="' + id + '">Open in notes</button>' +
              '<button type="button" class="link-btn" data-mark-del="' + id + '">Remove</button></div></li>';
          }).join('') + '</ul>'
        : '<p class="note">Nothing yet. In any unit, tap the bookmark next to a heading to keep that section here.</p>') +
      '<h2 class="t-section">Bookmarked questions (' + ids.length + ')</h2>' +
      (ids.length
        ? '<div class="test-actions"><button type="button" class="btn solid" data-quick="saved">Practice bookmarked questions</button></div>' +
          '<ul class="saved-list">' + ids.map(function (id) {
            var q = PE.questions[id];
            return '<li><span class="saved-q">' + esc(q.q) + '</span>' +
              '<details><summary>Show answer</summary><p>' + esc(q.c[q.a]) + '. ' + esc(q.why) + '</p></details>' +
              '<div class="ev-actions"><span class="ev-src">' + esc(unitLabel(q.u)) + '</span>' +
              '<button type="button" class="link-btn" data-unsave-q="' + id + '">Remove</button></div></li>';
          }).join('') + '</ul>'
        : '<p class="note">Nothing yet. During a practice test, tap the <b>Bookmark</b> button next to a question to keep it here.</p>') +
      '<h2 class="t-section">Saved passages (' + clips.length + ')</h2>' +
      (clips.length
        ? '<ul class="saved-list">' + clips.map(function (c, i) {
            return '<li><blockquote>' + esc(c.text) + '</blockquote>' +
              '<div class="ev-actions"><span class="ev-src">' + esc(c.unit || '') + (c.title ? ', ' + esc(c.title) : '') + ' · ' + esc(timeAgo(c.at)) + '</span>' +
              (c.sec ? '<button type="button" class="link-btn" data-clip-open="' + i + '">Open in notes</button>' : '') +
              '<button type="button" class="link-btn" data-clip-del="' + i + '">Remove</button></div></li>';
          }).join('') + '</ul>'
        : '<p class="note">Nothing yet. Select any text in a unit\'s notes and tap <b>Save passage</b>, or save the text evidence from a test question.</p>');
  }

  function buildSaved() {
    $('#saved-root').addEventListener('click', function (e) {
      var unq = e.target.closest('[data-unsave-q]');
      if (unq) {
        toggleSavedQ(PE.questions[Number(unq.dataset.unsaveQ)]);
        renderSaved();
      }
      var mOpen = e.target.closest('[data-mark-open]');
      if (mOpen) {
        var msec = document.getElementById(mOpen.dataset.markOpen);
        goToSection(msec.closest('.view').id.replace('view-', ''), msec);
      }
      var mDel = e.target.closest('[data-mark-del]');
      if (mDel) {
        toggleMark(mDel.dataset.markDel);
        renderSaved();
      }
      var del = e.target.closest('[data-clip-del]');
      if (del) {
        var list = clipList().slice();
        list.splice(Number(del.dataset.clipDel), 1);
        saved.clips = list;
        save();
        renderSaved();
      }
      var open = e.target.closest('[data-clip-open]');
      if (open) {
        var c = clipList()[Number(open.dataset.clipOpen)];
        var sec = c && document.getElementById(c.sec);
        if (sec) goToSection(c.view, sec, keyWords(c.text).slice(0, 6).map(function (w) { return { alts: [w] }; }));
      }
    });
  }

  /* ---------- Practice test ---------- */

  var test = { scope: 'all', run: null };

  function pool(scope) {
    return PE.questions.filter(function (q) { return scope === 'all' || 'u' + q.u === scope; });
  }

  function gameLength() {
    return settings.gameLength === 'all' ? PE.questions.length : Number(settings.gameLength);
  }


  // Misses first, then questions from the weakest units.
  function dailyIds() {
    var ids = shuffle(missedIds()).slice(0, 10);
    var units = PE.units.slice().sort(function (a, b) { return unitScore(a) - unitScore(b); });
    units.forEach(function (u) {
      var taken = 0;
      shuffle(pool(u.id)).forEach(function (q) {
        var id = PE.questions.indexOf(q);
        if (ids.length < 10 && taken < 4 && ids.indexOf(id) === -1) {
          ids.push(id);
          taken++;
        }
      });
    });
    return ids;
  }

  function markDaily() {
    var now = new Date();
    var today = dayStamp(now);
    var yesterday = dayStamp(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    var streak = saved.streak || { last: '', count: 0 };
    if (streak.last === today) return;
    saved.streak = { last: today, count: streak.last === yesterday ? streak.count + 1 : 1 };
  }

  function missedIds() {
    var list = saved.missed || [];
    var ids = [];
    PE.questions.forEach(function (q, i) {
      if (list.indexOf(q.q) > -1) ids.push(i);
    });
    return ids;
  }

  function setMissed(q, isMissed) {
    var list = (saved.missed || []).filter(function (text) { return text !== q.q; });
    if (isMissed) list.push(q.q);
    saved.missed = list;
  }

  function recordUnits(run) {
    saved.byUnit = saved.byUnit || {};
    PE.units.forEach(function (u) {
      var ids = run.ids.filter(function (id) { return 'u' + PE.questions[id].u === u.id; });
      if (!ids.length) return;
      var wrong = ids.filter(function (id) { return run.missed.indexOf(id) > -1; }).length;
      saved.byUnit[u.id] = { score: ids.length - wrong, total: ids.length };
    });
  }

  function scopeName(scope) {
    if (scope === 'all') return 'Full test';
    if (scope === 'missed') return 'Retry my misses';
    if (scope === 'daily') return 'Daily 10';
    if (scope === 'game') return 'Game Day';
    if (scope === 'mock') return 'Mock midterm';
    if (scope === 'study') return 'Study today';
    if (scope === 'saved') return 'Bookmarked questions';
    if (isMissScope(scope)) return 'Retry ' + unitOf(scope.slice(1)).num + ' ' + unitOf(scope.slice(1)).short + ' misses';
    if (isOneQuestion(scope)) return 'One question';
    var u = unitOf(scope);
    return u.num + ' ' + u.title;
  }

  function unitOf(id) {
    return PE.units.filter(function (x) { return x.id === id; })[0];
  }

  // 'missed' retries every miss. 'mu2' retries only the misses from unit 02.
  function isMissScope(scope) {
    return scope === 'missed' || /^mu\d$/.test(scope);
  }

  function unitMisses(unitId) {
    return missedIds().filter(function (id) { return 'u' + PE.questions[id].u === unitId; });
  }

  function keepRun() {
    saved.run = test.run;
    save();
  }

  // A search result can open a single question, written as q plus its number.
  function isOneQuestion(scope) {
    return /^q\d+$/.test(scope);
  }

  function startTest(scope) {
    var ids = [];
    PE.questions.forEach(function (q, i) {
      if (scope === 'all' || 'u' + q.u === scope || scope === 'q' + i) ids.push(i);
    });
    if (scope === 'missed') ids = missedIds();
    if (/^mu\d$/.test(scope)) ids = unitMisses(scope.slice(1));
    if (scope === 'daily') ids = dailyIds();
    if (scope === 'saved') ids = savedIds();
    if (scope === 'mock') ids = PE.questions.map(function (q, i) { return i; });
    if (scope === 'game') ids = shuffle(PE.questions.map(function (q, i) { return i; })).slice(0, gameLength());
    if (scope === 'study') {
      var plan = studyPlan();
      ids = plan.due.concat(plan.fresh).slice(0, STUDY_ROUND);
    }
    if (!ids.length) {
      test.run = null;
      test.setup = true;
      renderTest();
      return;
    }
    test.run = { scope: scope, exam: scope === 'game' || scope === 'mock', ids: shuffle(ids), pos: 0, right: 0, missed: [], order: null, picked: null };
    if (scope === 'mock') test.run.endsAt = Date.now() + MOCK_MINUTES * 60000;
    prepareQuestion();
    keepRun();
    renderTest();
  }

  function prepareQuestion() {
    var run = test.run;
    var id = run.ids[run.pos];
    run.picked = null;
    run.shown = false;
    run.evidence = false;
    if (isCardId(id)) return;
    var q = PE.questions[id];
    var idx = q.c.map(function (_, i) { return i; });
    run.order = q.t === 'tf' ? idx : shuffle(idx);
  }

  function renderSetup(root) {
    var last = saved.test || {};
    var scopes = ['all'].concat(PE.units.map(function (u) { return u.id; }));
    if (savedIds().length) scopes.push('saved');
    if (test.scope === 'saved' && !savedIds().length) test.scope = 'all';
    var run = test.run;
    var misses = missedIds().length;
    var toStudy = studyCount(studyPlan());
    // Always four cards, so the grid stays even. Two of them change to whatever helps most right now.
    var study = toStudy
      ? '<button type="button" class="mode-card" data-quick="study"><b>Study today</b><span>' + toStudy + ' picked for you</span></button>'
      : '<a class="mode-card" href="#flashcards"><b>Flashcards</b><span>Flip through the terms</span></a>';
    var retry = misses
      ? '<button type="button" class="mode-card" data-retry><b>Retry misses</b><span>' + misses + (misses === 1 ? ' question' : ' questions') + ' you got wrong</span></button>'
      : '<a class="mode-card" href="#weak"><b>Weak spots</b><span>See what to work on</span></a>';
    root.innerHTML =
      (run && !run.finished
        ? '<button type="button" class="resume-bar" data-resume><b>Resume ' + esc(scopeName(run.scope)) + '</b><span>Question ' + (run.pos + 1) + ' of ' + run.ids.length +
          (run.endsAt ? ', ' + clockText(run.endsAt - Date.now()) + ' left' : '') + '</span></button>'
        : '') +
      '<h2 class="t-section">Quick practice</h2>' +
      '<div class="mode-grid">' + study + retry +
      '<button type="button" class="mode-card" data-quick="daily"><b>Daily 10</b><span>Misses and weak units</span></button>' +
      '<button type="button" class="mode-card" data-quick="game"><b>Game Day</b><span>' + gameLength() + ' questions, answers at the end</span></button>' +
      '</div>' +
      '<a class="bm-bar" href="#saved"><svg aria-hidden="true"><use href="#i-bookmark"></use></svg><b>Bookmarks</b><span>' +
        markList().length + (markList().length === 1 ? ' section, ' : ' sections, ') + savedIds().length + (savedIds().length === 1 ? ' question, ' : ' questions, ') + clipList().length + (clipList().length === 1 ? ' passage' : ' passages') + '</span></a>' +
      '<h2 class="t-section">More ways to practice</h2>' +
      '<div class="mode-grid">' +
      '<button type="button" class="mode-card" data-mock><b>Mock midterm</b><span>All ' + PE.questions.length + ' questions, ' + MOCK_MINUTES + ' minutes on the clock</span></button>' +
      '<a class="mode-card" href="#drills"><b>Formula drills</b><span>Heart rate, 1 Rep Max and body fat math</span></a>' +
      '<a class="mode-card" href="#match"><b>Matching game</b><span>' + (saved.matchBest ? 'Best time: ' + clockText(saved.matchBest) : 'Match terms to their meanings') + '</span></a>' +
      '<a class="mode-card" href="#last"><b>Last look</b><span>Formulas, muscle chart and your misses</span></a>' +
      '</div>' +
      '<h2 class="t-section">Pick a test</h2>' +
      '<ul class="scope-list">' + scopes.map(function (s) {
        return '<li><label><input type="radio" name="scope" value="' + s + '"' + (s === test.scope ? ' checked' : '') + '>' +
          '<span class="scope-name">' + esc(scopeName(s)) + '</span>' +
          '<span class="scope-meta">' + (s === 'saved' ? savedIds().length : pool(s).length) + ' questions' + (last[s] ? ', last ' + last[s].score + '/' + last[s].total : '') + '</span></label></li>';
      }).join('') + '</ul>' +
      '<button type="button" class="btn solid" data-start>Start test</button>';
  }

  function renderQuestion(root) {
    var run = test.run;
    var q = PE.questions[run.ids[run.pos]];
    var answered = run.picked !== null;
    var isRight = answered && run.picked === q.a;
    root.innerHTML =
      '<div class="t-progress"><span>Question ' + (run.pos + 1) + ' of ' + run.ids.length + '</span>' +
        (run.endsAt ? '<span class="t-timer" data-timer></span>' : '') +
        '<span>' + (run.exam ? 'Answers at the end' : run.right + ' right') + '</span></div>' +
      '<div class="t-bar"><i style="width:' + ((run.pos + (answered ? 1 : 0)) / run.ids.length * 100) + '%"></i></div>' +
      '<div class="q-head"><p class="t-q">' + (q.t === 'tf' ? 'True or false: ' : '') + esc(q.q) + '</p>' +
        '<button type="button" class="bm-btn" data-save-q aria-pressed="' + isSavedQ(q) + '" aria-label="' + (isSavedQ(q) ? 'Remove bookmark' : 'Bookmark this question') + '">' +
        '<svg aria-hidden="true"><use href="#i-bookmark"></use></svg><span>' + (isSavedQ(q) ? 'Bookmarked' : 'Bookmark') + '</span></button></div>' +
      '<div class="opts">' + run.order.map(function (i) {
        var cls = 'opt';
        if (answered && i === q.a) cls += ' right';
        else if (answered && i === run.picked) cls += ' wrong';
        return '<button type="button" class="' + cls + '" data-pick="' + i + '"' + (answered ? ' disabled' : '') + '>' + esc(q.c[i]) + '</button>';
      }).join('') + '</div>' +
      (run.skips && run.skips[run.ids[run.pos]] && !answered ? '<p class="t-back">You skipped this one earlier.</p>' : '') +
      '<div class="q-tools">' +
        (!answered && run.pos < run.ids.length - 1 ? '<button type="button" class="btn ghost" data-skip>Skip for now</button>' : '') +
        (run.scope !== 'mock' && !run.evidence ? '<button type="button" class="btn ghost" data-evidence>' + (answered ? 'Show text evidence' : 'I don\'t know: show evidence') + '</button>' : '') +
      '</div>' +
      (run.evidence ? evidenceHtml(q) : '') +
      (answered
        ? '<p class="t-why' + (isRight ? '' : ' bad') + '" aria-live="polite"><strong>' + (isRight ? 'Correct' : 'Answer: ' + esc(q.c[q.a])) + '</strong>' + esc(q.why) +
          '<span class="t-back">' + esc(backText(run.ids[run.pos])) + '</span></p>' +
          '<div class="test-actions"><a class="link-btn" href="https://forms.gle/6LFouHe3cwiY1r5t7" target="_blank" rel="noopener">Think this answer is wrong? Send feedback</a></div>' +
          '<div class="test-actions"><button type="button" class="btn solid" data-next>' + (run.pos + 1 === run.ids.length ? 'See score' : 'Next question') + '</button></div>'
        : '') +
      '<div class="test-actions"><button type="button" class="link-btn" data-quit>' +
        (run.endsAt ? 'Leave test (the clock keeps running)' : 'Leave test (your place is saved)') + '</button></div>';
    paintTimer();
    var nextBtn = $('[data-next]', root);
    if (nextBtn) nextBtn.focus({ preventScroll: true });
  }

  function renderStudyCard(root) {
    var run = test.run;
    var c = cardOf(run.ids[run.pos]);
    var swap = settings.cardFirst === 'answer';
    var note = PE.simpleCards[c.front];
    root.innerHTML =
      '<div class="t-progress"><span>Question ' + (run.pos + 1) + ' of ' + run.ids.length + '</span><span>' + run.right + ' right</span></div>' +
      '<div class="t-bar"><i style="width:' + (run.pos / run.ids.length * 100) + '%"></i></div>' +
      '<span class="card-tag">Flashcard: ' + esc(unitLabel(c.u)) + '</span>' +
      '<p class="t-q">' + esc(swap ? c.back : c.front) + '</p>' +
      (run.shown
        ? '<p class="t-why" aria-live="polite">' + esc(swap ? c.front : c.back) + '</p>' +
          (note ? '<p class="simple">' + esc(note) + '</p>' : '') +
          '<div class="test-actions"><button type="button" class="btn" data-rate="0">Still learning</button><button type="button" class="btn solid" data-rate="1">Got it</button></div>'
        : '<div class="test-actions"><button type="button" class="btn solid" data-show>Show answer</button></div>') +
      '<div class="test-actions"><button type="button" class="link-btn" data-quit>Leave test (your place is saved)</button></div>';
    var mainBtn = $('[data-show], [data-rate="1"]', root);
    if (mainBtn) mainBtn.focus({ preventScroll: true });
  }

  function studyDoneActions() {
    var left = studyCount(studyPlan());
    var note = examDay() === thisDay() ? 'Your misses are back on the list now.' : 'Your misses come back tomorrow.';
    return (test.run.missed.length ? '<p class="t-back">' + note + '</p>' : '') +
      '<div class="test-actions">' +
      (left ? '<button type="button" class="btn solid" data-again>Study the next ' + Math.min(left, STUDY_ROUND) + '</button>' : '') +
      '<a class="btn' + (left ? '' : ' solid') + '" href="#home">Back to Home</a></div>';
  }

  function renderResult(root) {
    var run = test.run;
    var byUnit = PE.units.map(function (u) {
      if (run.scope !== 'all' && run.scope !== 'game' && run.scope !== 'mock') return '';
      var ids = run.ids.filter(function (id) { return 'u' + PE.questions[id].u === u.id; });
      if (!ids.length) return '';
      var right = ids.filter(function (id) { return run.missed.indexOf(id) === -1; }).length;
      return '<div><span>' + u.num + ' ' + esc(u.short) + '</span><span>' + right + ' / ' + ids.length + '</span>' +
        '<span class="pct"><i style="width:' + pct(right, ids.length) + '%"></i></span></div>';
    }).join('');
    root.innerHTML =
      '<p class="t-score">' + run.right + ' <small>/ ' + run.ids.length + '</small></p>' +
      '<p>' + esc(scopeName(run.scope)) + ': ' + Math.round(run.right / run.ids.length * 100) + '%</p>' +
      (run.timedOut ? '<p class="t-back">Time ran out with ' + run.timedOut + ' not answered. They count as misses in this score.</p>' : '') +
      (byUnit ? '<div class="by-unit">' + byUnit + '</div>' : '') +
      (run.missed.length
        ? '<h2 style="font-size:28px;margin-top:20px">Review these</h2><ul class="missed">' + run.missed.map(function (id) {
            var item = itemOf(id);
            return isCardId(id)
              ? '<li><span>' + esc(item.front) + '</span>' + esc(item.back) + '</li>'
              : '<li><span>' + esc(item.q) + '</span>' + esc(item.c[item.a]) + '</li>';
          }).join('') + '</ul>'
        : '') +
      (run.scope === 'study'
        ? studyDoneActions()
        : '<div class="test-actions"><button type="button" class="btn solid" data-again>Take it again</button><button type="button" class="btn" data-setup>Pick another test</button>' +
          (run.missed.length ? '<a class="btn ghost" href="#weak">See weak spots</a>' : '') +
          '<button type="button" class="btn ghost" data-share="' + esc('I got ' + run.right + ' / ' + run.ids.length + ' on ' + scopeName(run.scope) + ' in the PE Midterm study app.') + '">Share score</button></div>');
  }

  function renderTest() {
    var root = $('#test-root');
    var run = test.run;
    if (test.mockIntro && !(run && run.scope === 'mock' && !run.finished)) renderMockIntro(root);
    else if (!run || test.setup) renderSetup(root);
    else if (run.finished) renderResult(root);
    else if (isCardId(run.ids[run.pos])) renderStudyCard(root);
    else renderQuestion(root);
  }

  function finishRun(run) {
    run.pos = run.ids.length - 1;
    run.finished = true;
    if (run.scope === 'daily') {
      markDaily();
      toast('Daily 10 done. Streak: ' + saved.streak.count);
    } else if (!isMissScope(run.scope) && run.scope !== 'study' && run.scope !== 'saved' && !isOneQuestion(run.scope)) {
      saved.test = saved.test || {};
      saved.test[run.scope] = { score: run.right, total: run.ids.length };
      // Questions nobody got to answer don't pull the unit scores down.
      if (!run.timedOut) recordUnits(run);
      if (run.scope === 'mock') saved.mockDay = thisDay();
      toast('Score saved');
    }
    saved.run = null;
    save();
  }

  function nextQuestion(run) {
    run.pos++;
    if (run.pos >= run.ids.length) {
      finishRun(run);
    } else {
      prepareQuestion();
      keepRun();
    }
    renderTest();
    window.scrollTo(0, 0);
  }

  /* ---------- Mock midterm ---------- */

  var MOCK_MINUTES = 45;

  function clockText(ms) {
    var sec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(sec / 60);
    var r = sec % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function openMockIntro() {
    test.mockIntro = true;
    if (location.hash === '#test') { renderTest(); window.scrollTo(0, 0); }
    else location.hash = 'test';
  }

  function renderMockIntro(root) {
    var last = (saved.test || {}).mock;
    root.innerHTML =
      '<div class="mock-intro">' +
      '<h2>Mock midterm</h2>' +
      '<ul><li>All ' + PE.questions.length + ' questions, mixed up</li><li>' + MOCK_MINUTES + ' minutes on the clock</li>' +
      '<li>Answers and your score by unit at the end</li><li>The clock keeps running if you leave the page</li></ul>' +
      '<p class="note">This is practice made from the class notes. The real midterm may ask things differently.</p>' +
      (last ? '<p class="note">Last time: ' + last.score + ' / ' + last.total + '</p>' : '') +
      '<div class="test-actions"><button type="button" class="btn solid" data-mock-start>Start the clock</button>' +
      '<button type="button" class="btn ghost" data-mock-cancel>Not now</button></div></div>';
  }

  function paintTimer() {
    var el = $('[data-timer]');
    var run = test.run;
    if (!el || !run || !run.endsAt) return;
    var left = run.endsAt - Date.now();
    el.textContent = clockText(left) + ' left';
    el.classList.toggle('is-low', left < 5 * 60000);
  }

  // Hands the mock midterm in when the clock runs out.
  function checkClock() {
    var run = test.run;
    if (!run || run.finished || !run.endsAt || Date.now() < run.endsAt) return;
    run.timedOut = run.ids.length - run.pos;
    run.missed = run.missed.concat(run.ids.slice(run.pos));
    test.setup = false;
    test.mockIntro = false;
    finishRun(run);
    renderTest();
    toast('Time is up. Mock midterm handed in.');
  }

  function startClock() {
    setInterval(function () {
      checkClock();
      paintTimer();
      paintMatchTime();
    }, 1000);
  }

  /* ---------- Share a score ---------- */

  function copyText(text) {
    function oldWay() {
      var box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(box);
      toast(ok ? 'Copied. Paste it to a friend.' : 'Could not copy on this device');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied. Paste it to a friend.'); }, oldWay);
    } else {
      oldWay();
    }
  }

  // Phones open their share menu. Everything else copies the message.
  function shareScore(text) {
    var url = location.href.split('#')[0];
    if (typeof navigator.share === 'function') {
      navigator.share({ text: text, url: url }).catch(function (err) {
        if (!err || err.name !== 'AbortError') copyText(text + ' ' + url);
      });
    } else {
      copyText(text + ' ' + url);
    }
  }

  /* ---------- Readiness, study plan and test day ---------- */

  var FORMULAS = [
    ['Max heart rate', '220 − age'],
    ['Endurance load', '1 Rep Max × 0.6 (60%)'],
    ['Strength load', '1 Rep Max × 0.8 (80%)'],
    ['Fat weight', 'body weight × body fat %'],
    ['Fat-free weight', 'body weight − fat weight']
  ];

  function formulaList() {
    return '<dl class="formulas">' + FORMULAS.map(function (f) {
      return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>';
    }).join('') + '</dl>';
  }

  // Share of questions and flashcards whose last answer was right, within the last 7 days.
  function recentPct(units) {
    var day = thisDay();
    var review = saved.review || {};
    var keys = [];
    units.forEach(function (u) {
      PE.questions.forEach(function (q) { if ('u' + q.u === u.id) keys.push('q:' + q.q); });
      PE.flashcards.forEach(function (c) { if ('u' + c.u === u.id) keys.push('c:' + cardKey(c)); });
    });
    var fresh = keys.filter(function (k) {
      var rec = review[k];
      return rec && rec.box > 0 && day - rec.last <= 6;
    }).length;
    return pct(fresh, keys.length);
  }

  function drillsToday() {
    var d = saved.drill;
    return d && d.day === thisDay() ? d.total : 0;
  }

  function planSteps(daysLeft) {
    var steps = [];
    var n = studyCount(studyPlan());
    var misses = missedIds().length;
    if (n) {
      steps.push({ attrs: 'data-quick="study"', title: 'Study ' + thingsText(n), note: 'Reviews that are due and new items, picked for you' });
    }
    if (misses) {
      steps.push({ attrs: 'data-quick="missed"', title: 'Retry ' + misses + (misses === 1 ? ' miss' : ' misses'), note: 'Questions you got wrong last time' });
    }
    if (drillsToday() < 5) {
      steps.push({ href: '#drills', title: 'Do 5 formula drills', note: 'Max heart rate, 1 Rep Max and body fat math' });
    }
    var weakest = PE.units.slice().sort(function (a, b) { return unitScore(a) - unitScore(b); })[0];
    if (unitScore(weakest) < 100 && saved.planRead !== thisDay() + ':' + weakest.id) {
      steps.push({ href: '#' + weakest.id, read: weakest.id, title: 'Reread ' + weakest.num + ' ' + weakest.short, note: 'Your lowest unit at ' + unitScore(weakest) + '%' });
    }
    if (saved.mockDay !== thisDay() && (daysLeft <= 1 || !(saved.test || {}).mock)) {
      steps.push({ attrs: 'data-mock', title: 'Take the mock midterm', note: 'All ' + PE.questions.length + ' questions in ' + MOCK_MINUTES + ' minutes' });
    }
    // Four at most, so the list stays doable in one sitting.
    return steps.slice(0, 4);
  }

  function renderPlan() {
    var root = $('#home-plan');
    var exam = examDay();
    var daysLeft = exam === null ? -1 : exam - thisDay();
    if (daysLeft < 0) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;
    // On test day the card goes above the scoreboard.
    var board = $('#board');
    board.parentNode.insertBefore(root, daysLeft === 0 ? board : board.nextSibling);
    var ready = '<p class="plan-ready"><b>' + recentPct(PE.units) + '%</b> of all questions and flashcards answered right in the last 7 days</p>';

    if (daysLeft === 0) {
      var misses = missedIds().length;
      root.className = 'plan is-today';
      root.innerHTML =
        '<h2>The midterm is today' + (settings.name ? '. Good luck, ' + esc(settings.name) : '. Good luck') + '</h2>' +
        '<p class="plan-lead">One last look, nothing new. These are the formulas to have in your head:</p>' +
        formulaList() +
        '<div class="test-actions"><a class="btn solid" href="#last">Open the last look</a>' +
        (misses ? '<button type="button" class="btn" data-quick="missed">Retry ' + misses + (misses === 1 ? ' miss' : ' misses') + '</button>' : '') +
        '<a class="btn" href="#u4">Muscle chart</a></div>';
      return;
    }

    var steps = planSteps(daysLeft);
    root.className = 'plan';
    root.innerHTML =
      '<h2>' + (daysLeft === 1 ? 'The midterm is tomorrow. Tonight\'s plan' : daysLeft + ' days to the midterm. Today\'s plan') + '</h2>' +
      ready +
      (steps.length
        ? '<ol class="plan-steps">' + steps.map(function (st, i) {
            var inner = '<i>' + (i + 1) + '</i><b>' + esc(st.title) + '</b><span>' + esc(st.note) + '</span>';
            return '<li>' + (st.href
              ? '<a class="plan-step" href="' + st.href + '"' + (st.read ? ' data-plan-read="' + st.read + '"' : '') + '>' + inner + '</a>'
              : '<button type="button" class="plan-step" ' + st.attrs + '>' + inner + '</button>') + '</li>';
          }).join('') + '</ol>'
        : '<p class="plan-lead">Today\'s plan is done. ' + (daysLeft === 1 ? 'Get some sleep and take one last look in the morning.' : 'Come back tomorrow for the next one.') + '</p>') +
      (daysLeft === 1 ? '<div class="test-actions"><a class="btn ghost" href="#last">Open the last look</a></div>' : '');
  }

  function renderLast() {
    var misses = missedIds();
    var learning = [];
    PE.units.forEach(function (u) { learning = learning.concat(learningCards(u.id)); });
    $('#last-root').innerHTML =
      '<section class="last-block"><h2>Formulas</h2>' + formulaList() +
      '<p class="note">Class numbers: beginner is under 145 BPM, moderate to high is 145–186 BPM. Strength is 3 sets of 4–8 reps, endurance is 3 sets of 12–16 reps.</p>' +
      '<div class="test-actions"><a class="btn" href="#drills">Practice the math</a></div></section>' +
      '<section class="last-block"><h2>Muscle chart</h2><ol class="last-muscles">' + PE.muscles.map(function (m) {
        var machines = machinesFor(m.id).map(function (x) { return x.name; }).join(', ');
        return '<li value="' + m.n + '"><b>' + esc(m.name) + '</b>' + (machines ? '<span>' + esc(machines) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<div class="test-actions"><a class="btn" href="#u4">Open the muscle map</a></div></section>' +
      '<section class="last-block"><h2>Questions you missed</h2>' +
      (misses.length
        ? '<ul class="missed">' + misses.map(function (id) {
            var q = PE.questions[id];
            return '<li><span>' + esc(q.q) + '</span>' + esc(q.c[q.a]) + '</li>';
          }).join('') + '</ul><div class="test-actions"><button type="button" class="btn solid" data-quick="missed">Retry all ' + misses.length + '</button></div>'
        : '<p class="note">No missed questions on your list.</p>') + '</section>' +
      '<section class="last-block"><h2>Flashcards still learning</h2>' +
      (learning.length
        ? '<ul class="missed">' + learning.map(function (c) {
            return '<li><span>' + esc(c.front) + '</span>' + esc(c.back) + '</li>';
          }).join('') + '</ul>'
        : '<p class="note">No flashcards marked Still learning.</p>') + '</section>';
  }

  /* ---------- Formula drills ---------- */

  var drill = { q: null, answered: false, ok: false, typed: '' };

  function rand(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  // Numbers are picked so every answer comes out whole.
  function newDrill(skip) {
    var kinds = ['hr', 'end', 'str', 'fat', 'lean'].filter(function (k) { return k !== skip; });
    var kind = kinds[rand(0, kinds.length - 1)];
    var orm = 5 * rand(8, 60);
    var weight = 20 * rand(5, 12);
    var fatPct = 5 * rand(2, 8);
    var fat = weight * fatPct / 100;
    if (kind === 'hr') {
      var age = rand(12, 60);
      return { kind: kind, tag: 'Max heart rate', unit: 'BPM', answer: 220 - age,
        q: 'What is the max heart rate for a ' + age + '-year-old?',
        work: '220 − age = 220 − ' + age + ' = ' + (220 - age) + ' BPM' };
    }
    if (kind === 'end' || kind === 'str') {
      var strong = kind === 'str';
      var load = orm * (strong ? 8 : 6) / 10;
      return { kind: kind, tag: '1 Rep Max', unit: 'lbs', answer: load,
        q: 'Your 1 Rep Max is ' + orm + ' lbs. What load do you train with for muscular ' + (strong ? 'strength' : 'endurance') + '?',
        work: (strong ? 'Strength uses 80%' : 'Endurance uses 60%') + ' of your 1RM: ' + orm + ' × ' + (strong ? '0.8' : '0.6') + ' = ' + load + ' lbs' };
    }
    if (kind === 'fat') {
      return { kind: kind, tag: 'Body composition', unit: 'lbs', answer: fat,
        q: 'A person weighs ' + weight + ' lbs with ' + fatPct + '% body fat. What is their fat weight?',
        work: weight + ' × ' + fatPct + '% = ' + fat + ' lbs of fat weight' };
    }
    return { kind: kind, tag: 'Body composition', unit: 'lbs', answer: weight - fat,
      q: 'A person weighs ' + weight + ' lbs with ' + fatPct + '% body fat. What is their fat-free weight?',
      work: 'Fat weight: ' + weight + ' × ' + fatPct + '% = ' + fat + ' lbs. Fat-free weight: ' + weight + ' − ' + fat + ' = ' + (weight - fat) + ' lbs' };
  }

  function drillTally() {
    var d = saved.drill || {};
    var today = d.day === thisDay();
    return { day: thisDay(), right: today ? d.right || 0 : 0, total: today ? d.total || 0 : 0, streak: d.streak || 0, best: d.best || 0 };
  }

  function renderDrill(focus) {
    if (!drill.q) drill.q = newDrill();
    var q = drill.q;
    var t = drillTally();
    var root = $('#drill-root');
    root.innerHTML =
      '<div class="t-progress"><span>Today: ' + t.right + ' right of ' + t.total + '</span><span>Streak ' + t.streak + (t.best ? ' (best ' + t.best + ')' : '') + '</span></div>' +
      '<div class="t-bar"><i style="width:' + Math.min(t.total, 5) * 20 + '%"></i></div>' +
      '<span class="card-tag">' + q.tag + '</span>' +
      '<p class="t-q">' + esc(q.q) + '</p>' +
      '<form class="drill-row" data-drill-form><input class="num-input" id="drill-in" type="text" inputmode="decimal" autocomplete="off" aria-label="Your answer in ' + q.unit + '"' +
        (drill.answered ? ' disabled value="' + esc(drill.typed) + '"' : '') + '><span class="drill-unit">' + q.unit + '</span>' +
        (drill.answered ? '' : '<button type="submit" class="btn solid">Check</button>') + '</form>' +
      (drill.answered
        ? '<p class="t-why' + (drill.ok ? '' : ' bad') + '" aria-live="polite"><strong>' + (drill.ok ? 'Correct' : 'Answer: ' + q.answer + ' ' + q.unit) + '</strong>' + esc(q.work) + '</p>' +
          '<div class="test-actions"><button type="button" class="btn solid" data-drill-next>Next problem</button></div>'
        : '<p class="note drill-hint" id="drill-hint" aria-live="polite"></p>') +
      '<details class="drill-help"><summary>Show the formulas</summary>' + formulaList() + '</details>';
    if (focus) {
      var el = drill.answered ? $('[data-drill-next]', root) : $('#drill-in');
      if (el) el.focus({ preventScroll: true });
    }
  }

  function checkDrill() {
    var typed = $('#drill-in').value.trim();
    var value = parseFloat(typed.replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
    if (isNaN(value)) {
      $('#drill-hint').textContent = 'Type a number first';
      return;
    }
    var t = drillTally();
    drill.answered = true;
    drill.typed = typed;
    drill.ok = Math.abs(value - drill.q.answer) < 0.01;
    t.total++;
    if (drill.ok) { t.right++; t.streak++; } else { t.streak = 0; }
    t.best = Math.max(t.best, t.streak);
    saved.drill = t;
    bumpGoal();
    save();
    renderDrill(true);
  }

  function buildDrill() {
    var root = $('#drill-root');
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!drill.answered) checkDrill();
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-drill-next]')) return;
      drill = { q: newDrill(drill.q.kind), answered: false, ok: false, typed: '' };
      renderDrill(true);
    });
  }

  /* ---------- Matching game ---------- */

  var MATCH_PAIRS = 6;
  var match = null;

  // Only short cards fit on a tile.
  function matchCards() {
    var fronts = {};
    var backs = {};
    var out = [];
    shuffle(PE.flashcards).forEach(function (c) {
      if (out.length === MATCH_PAIRS || c.front.length > 40 || c.back.length > 70 || c.back.indexOf('\n') > -1) return;
      if (fronts[c.front] || backs[c.back]) return;
      fronts[c.front] = backs[c.back] = true;
      out.push(c);
    });
    return out;
  }

  function startMatch() {
    var tiles = [];
    matchCards().forEach(function (c, i) {
      tiles.push({ pair: i, side: 'term', text: c.front });
      tiles.push({ pair: i, side: 'meaning', text: c.back });
    });
    match = { tiles: shuffle(tiles), picked: null, wrong: [], done: {}, left: tiles.length / 2, misses: 0, started: 0, time: 0 };
  }

  function paintMatchTime() {
    var el = $('[data-match-time]');
    if (!el || !match || !match.started || !match.left) return;
    el.textContent = clockText(Date.now() - match.started);
  }

  function renderMatch() {
    if (!match) startMatch();
    var root = $('#match-root');
    var over = !match.left;
    root.innerHTML =
      '<div class="t-progress"><span data-match-time>' + (over ? clockText(match.time) : match.started ? clockText(Date.now() - match.started) : '0:00') + '</span>' +
      '<span>' + match.misses + (match.misses === 1 ? ' miss' : ' misses') + (saved.matchBest ? ' · best ' + clockText(saved.matchBest) : '') + '</span></div>' +
      '<div class="match-grid">' + match.tiles.map(function (t, i) {
        var cls = 'match-tile ' + t.side;
        if (match.done[t.pair]) cls += ' is-done';
        else if (match.wrong.indexOf(i) > -1) cls += ' is-wrong';
        else if (match.picked === i) cls += ' is-picked';
        return '<button type="button" class="' + cls + '" data-tile="' + i + '"' + (match.done[t.pair] ? ' disabled' : '') +
          ' aria-pressed="' + (match.picked === i) + '">' + esc(t.text) + '</button>';
      }).join('') + '</div>' +
      (over
        ? '<p class="t-why" aria-live="polite"><strong>All matched in ' + clockText(match.time) + '</strong>' +
          (match.misses ? match.misses + (match.misses === 1 ? ' miss' : ' misses') + ' along the way.' : 'No misses.') +
          (match.time === saved.matchBest ? ' That is your best time.' : '') + '</p>' +
          '<div class="test-actions"><button type="button" class="btn solid" data-match-new>Play again</button>' +
          '<button type="button" class="btn ghost" data-share="' + esc('I matched ' + MATCH_PAIRS + ' pairs in ' + clockText(match.time) + ' in the PE Midterm study app.') + '">Share time</button></div>'
        : '<p class="note">Tap a term, then its meaning. The clock starts on your first tap.</p>' +
          '<div class="test-actions"><button type="button" class="btn ghost" data-match-new>New cards</button></div>');
  }

  function pickTile(i) {
    var t = match.tiles[i];
    if (!match.left || match.done[t.pair]) return;
    if (!match.started) match.started = Date.now();
    match.wrong = [];
    var first = match.picked === null ? null : match.tiles[match.picked];
    if (!first || first.side === t.side) {
      match.picked = match.picked === i ? null : i;
    } else if (first.pair === t.pair) {
      match.done[t.pair] = true;
      match.picked = null;
      match.left--;
      bumpGoal();
      if (!match.left) {
        match.time = Date.now() - match.started;
        if (!saved.matchBest || match.time < saved.matchBest) saved.matchBest = match.time;
      }
      save();
    } else {
      match.misses++;
      match.wrong = [match.picked, i];
      match.picked = null;
      var game = match;
      setTimeout(function () {
        if (match !== game || !game.wrong.length) return;
        game.wrong = [];
        renderMatch();
      }, 700);
    }
    renderMatch();
    var again = $('[data-tile="' + i + '"]');
    if (again && !again.disabled) again.focus({ preventScroll: true });
  }

  function buildMatch() {
    $('#match-root').addEventListener('click', function (e) {
      var tile = e.target.closest('[data-tile]');
      if (tile) pickTile(Number(tile.dataset.tile));
      if (e.target.closest('[data-match-new]')) {
        startMatch();
        renderMatch();
      }
    });
  }

  function buildTest() {
    var r = saved.run;
    // A mock midterm whose clock ran out while the app was closed is dropped.
    if (r && r.scope === 'mock' && !(r.endsAt > Date.now())) { saved.run = null; r = null; }
    if (r && !r.finished && Array.isArray(r.ids) && r.ids.every(itemOf)) {
      test.run = r;
      test.setup = true;
    }

    var root = $('#test-root');
    root.addEventListener('change', function (e) {
      if (e.target.name === 'scope') test.scope = e.target.value;
    });

    root.addEventListener('click', function (e) {
      var t = e.target;
      var run = test.run;
      if (t.closest('[data-mock-start]')) {
        test.mockIntro = false;
        test.setup = false;
        startTest('mock');
        window.scrollTo(0, 0);
      } else if (t.closest('[data-mock-cancel]')) {
        test.mockIntro = false;
        renderTest();
      } else if (t.closest('[data-start]')) {
        test.setup = false;
        startTest(test.scope);
      } else if (t.closest('[data-resume]')) {
        test.setup = false;
        renderTest();
      } else if (t.closest('[data-retry]')) {
        test.setup = false;
        startTest('missed');
      } else if (t.closest('[data-pick]')) {
        var q = PE.questions[run.ids[run.pos]];
        run.picked = Number(t.closest('[data-pick]').dataset.pick);
        if (run.picked === q.a) run.right++;
        else run.missed.push(run.ids[run.pos]);
        setMissed(q, run.picked !== q.a);
        reviewRecord(itemKey(run.ids[run.pos]), run.picked === q.a);
        bumpGoal();
        keepRun();
        if (run.exam) nextQuestion(run);
        else renderTest();
      } else if (t.closest('[data-skip]')) {
        var skipped = run.ids.splice(run.pos, 1)[0];
        run.ids.push(skipped);
        run.skips = run.skips || {};
        run.skips[skipped] = true;
        prepareQuestion();
        keepRun();
        renderTest();
        toast('Skipped. It comes back at the end');
        window.scrollTo(0, 0);
      } else if (t.closest('[data-save-q]')) {
        toggleSavedQ(PE.questions[run.ids[run.pos]]);
        renderTest();
      } else if (t.closest('[data-evidence]')) {
        run.evidence = true;
        keepRun();
        renderTest();
        var box = $('.evidence', root);
        if (box) box.scrollIntoView({ block: 'nearest' });
      } else if (t.closest('[data-ev-open]')) {
        var ev = evidenceFor(PE.questions[run.ids[run.pos]]);
        if (ev) { test.setup = true; goToEvidence(ev); }
      } else if (t.closest('[data-ev-save]')) {
        var found = evidenceFor(PE.questions[run.ids[run.pos]]);
        if (found) addClip({ text: found.text, view: found.view, unit: found.unit, sec: found.sec.id, title: found.title });
      } else if (t.closest('[data-show]')) {
        run.shown = true;
        keepRun();
        renderTest();
      } else if (t.closest('[data-rate]')) {
        var got = t.closest('[data-rate]').dataset.rate === '1';
        if (got) run.right++;
        else run.missed.push(run.ids[run.pos]);
        setKnown(cardOf(run.ids[run.pos]), got);
        bumpGoal();
        nextQuestion(run);
      } else if (t.closest('[data-next]')) {
        nextQuestion(run);
      } else if (t.closest('[data-quit]')) {
        test.setup = true;
        renderTest();
      } else if (t.closest('[data-again]')) {
        startTest(run.scope);
      } else if (t.closest('[data-setup]')) {
        test.run = null;
        test.setup = true;
        renderTest();
      }
    });
  }

  /* ---------- Start ---------- */

  function start() {
    loadSettings();
    buildSimpleNotes();
    buildSpeech();
    buildSettings();
    applySettings();
    buildWelcome();
    buildInstall();
    buildUnitHelpers();
    buildMap();
    buildSmallGraphics();
    buildGauge();
    buildSorter();
    buildMatcher();
    seedReview();
    buildFlashcards();
    buildTest();
    buildSaved();
    buildMarks();
    buildClipper();
    buildDrill();
    buildMatch();
    startClock();

    var age = $('#age');
    if (saved.age) age.value = saved.age;
    age.addEventListener('input', function () { updateHR(true); });
    updateHR(false);

    var orm = $('#orm');
    if (saved.orm) orm.value = saved.orm;
    orm.addEventListener('input', function () { updateORM(true); });
    updateORM(false);

    $('#clear-all').addEventListener('click', function () {
      if (!window.confirm('Clear all your scores, flashcard marks and misses on this device?')) return;
      saved = { settings: settings, savedQs: saved.savedQs, clips: saved.clips, marks: saved.marks };
      save();
      toast('Progress cleared');
      test.run = null;
      test.setup = false;
      match = null;
      setDeck(false);
      renderHome();
    });

    buildSearch();

    if (!location.hash && settings.startPage !== 'home') {
      var opening = settings.startPage === 'last' ? saved.lastPage : settings.startPage;
      if (opening) history.replaceState(null, '', '#' + opening);
    }

    window.addEventListener('hashchange', function () { route(false); });
    route(true);

    // Phone install and offline copy only work on a real web address.
    if (/^http/.test(location.protocol)) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = './manifest.webmanifest';
      document.head.appendChild(link);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  start();
})();
