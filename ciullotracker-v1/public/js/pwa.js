/* ============================================================
   PWA — registrazione e aggiornamenti
   Un aggiornamento va notificato in tre momenti diversi, perché
   può arrivare in tre momenti diversi:
     1. c'è già una versione in attesa quando la pagina si apre
     2. ne viene trovata una mentre la pagina è aperta
     3. ne viene trovata una al ritorno sull'app
   ============================================================ */
(function () {
  'use strict';

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.deferredPWAInstall = e;
  });

  if (!('serviceWorker' in navigator)) return;

  var reloading = false;
  var hadController = !!navigator.serviceWorker.controller;

  // Il reload avviene quando il nuovo worker prende davvero il controllo,
  // non dopo un timeout a occhio.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function (reg) {

        // 1. Versione già pronta e in attesa da una sessione precedente
        if (reg.waiting && navigator.serviceWorker.controller) {
          mostraAvviso(reg.waiting);
        }

        // 2. Versione trovata mentre l'app è aperta.
        //    Va agganciato anche l'eventuale worker già in installazione:
        //    se "updatefound" è scattato prima che register() risolvesse,
        //    l'evento sarebbe andato perso.
        if (reg.installing) osserva(reg.installing);
        reg.addEventListener('updatefound', function () {
          osserva(reg.installing);
        });

        function osserva(worker) {
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              mostraAvviso(reg.waiting || worker);
            }
          });
        }

        // 3. Controlli periodici e al ritorno sull'app
        function controlla() { reg.update().catch(function () { /* offline */ }); }
        setInterval(controlla, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') controlla();
        });
        window.addEventListener('online', controlla);
      })
      .catch(function (err) {
        console.error('Registrazione del service worker non riuscita:', err);
      });
  });

  function mostraAvviso(worker) {
    if (document.getElementById('update-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'update-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'update-title');
    overlay.innerHTML =
      '<div class="update-box">' +
        '<span class="update-mark" aria-hidden="true"></span>' +
        '<h2 id="update-title">Nuova versione disponibile</h2>' +
        '<p>Aggiorna per continuare con l\'ultima versione di CiulloTracker.</p>' +
        '<button type="button" id="update-now">Aggiorna ora</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var box = overlay.querySelector('.update-box');
    var btn = document.getElementById('update-now');
    btn.focus();

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Aggiornamento in corso';
      box.classList.add('is-updating');

      if (worker) worker.postMessage({ type: 'SKIP_WAITING' });

      // Rete di sicurezza: se "controllerchange" non arriva, si ricarica comunque
      setTimeout(function () {
        if (!reloading) { reloading = true; window.location.reload(); }
      }, 4000);
    });
  }
})();
