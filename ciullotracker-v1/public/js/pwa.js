(function(){
  var deferredPrompt;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPWAInstall = e; // esposto per il dev
    console.log('PWA install available');
    // eventuale UI per mostrare il pulsante di installazione può usare window.deferredPWAInstall
  });
  window.addEventListener('appinstalled', function(){
    console.log('PWA installed');
  });
})();
