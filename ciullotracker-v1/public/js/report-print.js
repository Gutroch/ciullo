(function () {
  'use strict';

  var printButton = document.getElementById('reportPrintButton');
  if (printButton) {
    printButton.addEventListener('click', function () {
      window.print();
    });
  }
})();
