(function () {
  'use strict';

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.deferredPWAInstall = e;
  });

  if (!('serviceWorker' in navigator)) return;

  var reloading = false;
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function (reg) {

        if (reg.waiting && navigator.serviceWorker.controller) {
          mostraAvviso(reg.waiting);
        }

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
         //marameo
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
        '<h2 id="update-title">Aooo ci sta da aggiornà</h2>' +
        '<p>Totti va ad un negozio di elettrodomestici per comprarsi uno stereo. Il commesso gli fa: "salve cosa desidera" e Totti: "damme \'no stereo" ed il commesso: "Sony?" e Totti: "no, nun so sonà". </p>' +
        '<button type="button" id="update-now">Schiacciame\'</button>' +
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
