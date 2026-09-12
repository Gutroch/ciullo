(function () {
  var deferredPrompt;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPWAInstall = e;
    console.log('PWA install available');
  });

  window.addEventListener('appinstalled', function () {
    console.log('PWA installed');
  });

  if (!('serviceWorker' in navigator)) return;

  var refreshing = false;
  var hadController = !!navigator.serviceWorker.controller;

  window.addEventListener('load', async function () {
    try {
      var reg = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });

      setInterval(function () {
        reg.update();
      }, 60 * 60 * 1000);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });

      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            mostraAvvisoAggiornamento(reg.waiting || newWorker);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController) return;
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });

  function mostraAvvisoAggiornamento(worker) {
    if (document.getElementById('update-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'update-overlay';
    overlay.innerHTML =
      '<div class="update-box">' +
        '<h2>Aggiornamento disponibile</h2>' +
        '<p>È disponibile una nuova versione di CiulloTracker. Per continuare è necessario aggiornare.</p>' +
        '<button id="update-now">Aggiorna ora</button>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('update-now').addEventListener('click', function () {
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
      setTimeout(function () {
        window.location.reload();
      }, 3000);
    });
  }
})();