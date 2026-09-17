(function () {
  'use strict';

  var AVATAR_WEB_CDN_URL = 'https://esm.sh/@bible-strong/avatar-web@0.1.0';
  var DEFINITION_URL = '/js/vendor/avatar/jonny.avatar.json';
  var IDLE_AFTER_MS = 45000;
  var REACTION_EXPRESSION_HOLD_MS = 1800;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var EVENT_CATALOG = {
    idle: { candidates: ['idle', 'ambient', 'neutral', 'sleeping'] },
    sleeping: { candidates: ['sleeping', 'sleep', 'idle'] },
    greet: { candidates: ['greet', 'wave', 'hello', 'happy', 'idle'] },
    positive: { candidates: ['happy', 'positive', 'celebrate', 'idle'] },
    negative: { candidates: ['worried', 'sad', 'concerned', 'idle'] },
    celebrate: { candidates: ['celebrate', 'happy', 'yay', 'idle'] },
    error: { candidates: ['error', 'sad', 'confused', 'worried', 'idle'] },
    alert: { candidates: ['alert', 'worried', 'error', 'idle'] },
    wave: { candidates: ['wave', 'bye', 'greet', 'idle'] },
    thinking: { candidates: ['thinking', 'loading', 'idle'] },
    reply: { candidates: ['talking', 'reply', 'greet', 'happy', 'idle'] }
  };

  var instances = [];
  var currentMood = 'idle';
  var moodBeforeSleep = 'idle';
  var idleTimer = null;
  var lastInteractionAt = 0;
  var lastGazeAt = 0;
  var speechTimer = null;
  var speechHideTimer = null;
  var speechMessages = [
    "Non dire gatto se non ce l'hai nel sacco.",
'Chi va piano va sano e va lontano.',
'Meglio un uovo oggi che una gallina domani.',
'Non tutte le ciambelle riescono col buco.',
'A caval donato non si guarda in bocca.',
"Tra il dire e il fare c'è di mezzo il mare.",
"L'apparenza inganna.",
'Chi dorme non piglia pesci.',
'Il buon giorno si vede dal mattino.',
'Rosso di sera, bel tempo si spera.',
'Acqua cheta rompe i ponti.',
'Can che abbaia non morde.',
"Quando il gatto non c'è, i topi ballano.",
'Fare il passo più lungo della gamba.',
'Essere al verde.',
'Costare un occhio della testa.',
'Non avere peli sulla lingua.',
'Prendere due piccioni con una fava.',
'Cadere dalle nuvole.',
'Essere un libro aperto.',
'Vuotare il sacco.',
'Mettere le mani avanti.',
'Gettare la spugna.',
'Andare a gonfie vele.',
'Fare orecchie da mercante.',
'Parlare al vento.',
'Essere una goccia nel mare.',
'Non è tutto oro quel che luccica.',
'Chi troppo vuole nulla stringe.',
'Il diavolo fa le pentole ma non i coperchi.'
  ];

  var webModulePromise = null;
  function loadAvatarWebModule() {
    if (!webModulePromise) {
      webModulePromise = import(AVATAR_WEB_CDN_URL).catch(function (err) {
        console.info('[avatar] Impossibile caricare il motore da ' + AVATAR_WEB_CDN_URL + ' (serve una connessione internet la prima volta).', err);
        return null;
      });
    }
    return webModulePromise;
  }

  var definitionPromise = null;
  function loadDefinition() {
    if (!definitionPromise) {
      definitionPromise = fetch(DEFINITION_URL)
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
      definitionPromise.then(function (def) {
        if (!def) {
          console.info('[avatar] Nessuna definizione trovata in ' + DEFINITION_URL + '. Esporta l\'avatar dallo Studio (formato "ESM definition") e copialo lì per attivarlo.');
        }
      });
    }
    return definitionPromise;
  }

  // Cerca, tra i candidati, prima un'animazione poi un'espressione.
  function resolveKey(instance, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (instance.animations.has(candidates[i])) return { type: 'animation', key: candidates[i] };
    }
    for (var i = 0; i < candidates.length; i++) {
      if (instance.expressions.has(candidates[i])) return { type: 'expression', key: candidates[i] };
    }
    return null;
  }

  function apply(instance, resolved) {
    if (!instance.api || !resolved) return;
    if (resolved.type === instance.current.type && resolved.key === instance.current.key) return;
    try {
      if (resolved.type === 'animation') instance.api.play(resolved.key);
      else instance.api.setExpression(resolved.key);
      instance.current = resolved;
    } catch (err) {
      // chiave sconosciuta o istanza non pronta: ignora, non deve rompere il sito
    }
  }

  function applyMoodToInstance(instance, eventName) {
    var entry = EVENT_CATALOG[eventName] || EVENT_CATALOG.idle;
    var resolved = resolveKey(instance, entry.candidates) || resolveKey(instance, EVENT_CATALOG.idle.candidates);
    if (!resolved) return;
    instance.baseline = resolved;
    if (instance.reactionTimer) { clearTimeout(instance.reactionTimer); instance.reactionTimer = null; }
    apply(instance, resolved);
  }

  function reactInstance(instance, eventName) {
    var entry = EVENT_CATALOG[eventName] || EVENT_CATALOG.error;
    var resolved = resolveKey(instance, entry.candidates);
    if (!resolved || (resolved.type === instance.baseline.type && resolved.key === instance.baseline.key)) return;
    apply(instance, resolved);
    if (resolved.type === 'expression') {
      // le espressioni non hanno un "termine" naturale: torniamo al mood dopo un po'
      if (instance.reactionTimer) clearTimeout(instance.reactionTimer);
      instance.reactionTimer = setTimeout(function () { apply(instance, instance.baseline); }, REACTION_EXPRESSION_HOLD_MS);
    }
    // se è un'animazione "once", torna al baseline da sola via onAnimationEnd
  }

  function mountInstance(container) {
    if (container.dataset.avatarMounted) return;
    container.dataset.avatarMounted = '1';
    var size = container.getAttribute('data-avatar-size') || '100%';
    Promise.all([loadAvatarWebModule(), loadDefinition()]).then(function (results) {
      var mod = results[0];
      var definition = results[1];
      if (!mod || !mod.createAvatar || !definition) {
        container.classList.add('avatar-unavailable');
        return;
      }

      var animations = new Set(Object.keys(definition.animations || {}));
      var expressions = new Set(Object.keys(definition.expressions || {}));
      if (!animations.size && !expressions.size) {
        container.classList.add('avatar-unavailable');
        return;
      }

      var instance = {
        animations: animations,
        expressions: expressions,
        container: container,
        baseline: null,
        current: { type: null, key: null },
        reactionTimer: null,
        gazeTimer: null
      };

      var initial = resolveKey(instance, (EVENT_CATALOG[currentMood] || EVENT_CATALOG.idle).candidates)
        || resolveKey(instance, EVENT_CATALOG.idle.candidates)
        || (expressions.has('neutral')
          ? { type: 'expression', key: 'neutral' }
          : { type: 'animation', key: animations.values().next().value });
      instance.baseline = initial;

      var mountOptions = {
        definition: definition,
        size: size,
        autoplay: !prefersReducedMotion,
        ariaLabel: 'Jonny',
        onAnimationEnd: function (name) {
          if (!(instance.baseline.type === 'animation' && instance.baseline.key === name)) {
            apply(instance, instance.baseline);
          }
        },
        onError: function (err) {
          console.info('[avatar] Il motore ha segnalato una chiave sconosciuta nella definizione:', err);
        }
      };
      if (initial.type === 'animation') mountOptions.defaultAnimation = initial.key;
      else mountOptions.defaultExpression = initial.key;

      var api = mod.createAvatar(container, mountOptions);
      instance.api = api;
      instance.current = initial;
      container.classList.add('avatar-ready');
      instances.push(instance);

      if (prefersReducedMotion && initial.type === 'animation') {
        setTimeout(function () {
          try { api.pause(); } catch (err) { /* noop */ }
        }, 220);
      }
    });
  }

  function setMood(eventName) {
    if (eventName !== 'sleeping') moodBeforeSleep = eventName;
    currentMood = eventName;
    instances.forEach(function (instance) { applyMoodToInstance(instance, eventName); });
    resetIdleTimer();
  }

  function react(eventName) {
    instances.forEach(function (instance) { reactInstance(instance, eventName); });
    resetIdleTimer();
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (currentMood === 'sleeping') return;
    idleTimer = setTimeout(function () { setMood('sleeping'); }, IDLE_AFTER_MS);
  }

  function wakeUpIfNeeded() {
    if (currentMood === 'sleeping') setMood(moodBeforeSleep || 'idle');
    else resetIdleTimer();
  }

  function reactToInteraction(eventName) {
    var now = Date.now();
    if (now - lastInteractionAt < 700) return;
    lastInteractionAt = now;
    react(eventName);
  }

  function updateGaze(event) {
    if (!event || event.pointerType === 'touch') return;
    var now = Date.now();
    if (now - lastGazeAt < 180 || !instances.length) return;
    lastGazeAt = now;

    var horizontal = event.clientX < window.innerWidth * .38 ? 'left' : event.clientX > window.innerWidth * .62 ? 'right' : 'center';
    var vertical = event.clientY < window.innerHeight * .32 ? 'up' : event.clientY > window.innerHeight * .68 ? 'down' : 'center';
    var candidates = horizontal === 'right'
      ? ['skeptical-right', 'far-right-glance', 'playful-right', 'attentive-left']
      : horizontal === 'left'
        ? ['curious-left', 'surprised-left', 'attentive-left', 'skeptical-left']
        : vertical === 'up'
          ? ['upward-side-glance', 'asymmetric-up-left', 'small-attentive']
          : vertical === 'down'
            ? ['downward-gaze', 'gentle-downward-gaze', 'wide-downward-gaze']
            : ['small-attentive', 'neutral'];

    instances.forEach(function (instance) {
      var resolved = resolveKey(instance, candidates);
      if (!resolved || resolved.type !== 'expression') return;
      apply(instance, resolved);
      if (instance.gazeTimer) clearTimeout(instance.gazeTimer);
      instance.gazeTimer = setTimeout(function () {
        apply(instance, instance.baseline);
      }, 850);
    });
  }

  function showSpeech() {
    if (document.hidden) return;
    var bubble = document.querySelector('.avatar-bubble.avatar-ready');
    if (!bubble) return;
    var speech = bubble.querySelector('.avatar-speech');
    if (!speech) {
      speech = document.createElement('div');
      speech.className = 'avatar-speech';
      speech.setAttribute('role', 'status');
      speech.setAttribute('aria-live', 'polite');
      bubble.appendChild(speech);
    }
    speech.textContent = speechMessages[Math.floor(Math.random() * speechMessages.length)];
    speech.classList.add('is-visible');
    reactToInteraction('greet');
    if (speechHideTimer) clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(function () {
      speech.classList.remove('is-visible');
    }, 8200);
  }

  function scheduleSpeech() {
    if (speechTimer) clearTimeout(speechTimer);
    speechTimer = setTimeout(function () {
      showSpeech();
      scheduleSpeech();
    }, 24000 + Math.floor(Math.random() * 26000));
  }

  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(function (evt) {
    document.addEventListener(evt, wakeUpIfNeeded, { passive: true });
  });
  document.addEventListener('pointermove', updateGaze, { passive: true });
  document.addEventListener('pointerdown', function (event) {
    reactToInteraction(event.target.closest && event.target.closest('.avatar-bubble') ? 'positive' : 'greet');
  }, true);
  document.addEventListener('keydown', function () { reactToInteraction('thinking'); }, { passive: true });
  document.addEventListener('input', function () { reactToInteraction('thinking'); }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    instances.forEach(function (instance) {
      if (!instance.api) return;
      if (document.hidden) {
        try { instance.api.pause(); } catch (err) { }
      } else if (!prefersReducedMotion) {
        var toResume = instance.current;
        instance.current = { type: null, key: null }; 
        apply(instance, toResume);
      }
    });
    if (!document.hidden) wakeUpIfNeeded();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute || form.getAttribute('action') !== '/logout') return;
    if (form.dataset.avatarWaved || !instances.length) return;
    var canWave = instances.some(function (instance) {
      return !!resolveKey(instance, EVENT_CATALOG.wave.candidates);
    });
    if (!canWave) return;
    e.preventDefault();
    react('wave');
    form.dataset.avatarWaved = '1';
    setTimeout(function () { form.submit(); }, 380);
  }, true);

  function init() {
    var nodes = document.querySelectorAll('[data-avatar-mount]');
    if (!nodes.length) return;
    nodes.forEach(mountInstance);

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('[data-avatar-mount]')) mountInstance(node);
          if (node.querySelectorAll) node.querySelectorAll('[data-avatar-mount]').forEach(mountInstance);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    var ctx = window.CiulloAvatarContext || {};
    if (ctx.mood) setMood(ctx.mood);
    else resetIdleTimer();
    if (Array.isArray(ctx.reactions)) {
      ctx.reactions.forEach(function (name) { react(name); });
    }
    scheduleSpeech();
  }

  window.CiulloAvatar = { mood: setMood, react: react };

  init();
})();
