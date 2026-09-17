(function () {
  var form = document.getElementById('jonnyForm');
  if (!form) return;

  var input = document.getElementById('jonnyInput');
  var sendBtn = document.getElementById('jonnySend');
  var messages = document.getElementById('jonnyMessages');

  var confirmOverlay = document.getElementById('jonnyConfirmOverlay');
  var confirmText = document.getElementById('jonnyConfirmText');
  var confirmOkBtn = document.getElementById('jonnyConfirmOk');
  var confirmCancelBtn = document.getElementById('jonnyConfirmCancel');

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendMessage(text, from) {
    var row = document.createElement('div');
    row.className = 'jonny-msg jonny-msg-' + (from === 'user' ? 'user' : 'bot');
    var bubble = document.createElement('div');
    bubble.className = 'jonny-msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    messages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'jonny-typing';
    row.id = 'jonnyTypingIndicator';
    row.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById('jonnyTypingIndicator');
    if (el) el.remove();
  }

  function setBusy(busy) {
    input.disabled = busy;
    sendBtn.disabled = busy;
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  }
  input.addEventListener('input', autoGrow);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  // --- Popup di conferma per le azioni di scrittura -------------------
  // Finché il popup è aperto, blocchiamo l'invio di nuovi messaggi:
  // l'utente deve prima decidere se confermare o annullare la proposta
  // di Jonny, così non può "accavallarsi" un'altra richiesta nel mezzo.
  function openConfirmPopup(text) {
    confirmText.textContent = text;
    confirmOverlay.classList.add('active');
    setBusy(true);
  }

  function closeConfirmPopup() {
    confirmOverlay.classList.remove('active');
    setBusy(false);
    input.focus();
  }

  function sendConfirmation(confirm) {
    confirmOkBtn.disabled = true;
    confirmCancelBtn.disabled = true;
    showTyping();
    fetch('/jonny/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: confirm })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        hideTyping();
        var reply = (data && data.reply) || (confirm ? 'Fatto.' : 'Annullato.');
        appendMessage(reply, 'bot');
        if (window.CiulloAvatar) window.CiulloAvatar.react(confirm ? 'reply' : 'idle');
      })
      .catch(function () {
        hideTyping();
        appendMessage('Non sono riuscito a completare l\'operazione. Riprova tra poco.', 'bot');
        if (window.CiulloAvatar) window.CiulloAvatar.react('error');
      })
      .finally(function () {
        confirmOkBtn.disabled = false;
        confirmCancelBtn.disabled = false;
        closeConfirmPopup();
      });
  }

  confirmOkBtn.addEventListener('click', function () { sendConfirmation(true); });
  confirmCancelBtn.addEventListener('click', function () { sendConfirmation(false); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    input.value = '';
    autoGrow();
    setBusy(true);
    showTyping();
    if (window.CiulloAvatar) window.CiulloAvatar.react('thinking');

    fetch('/jonny/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        hideTyping();
        var reply = (data && data.reply) || 'Il chatbot non è ancora disponibile, riprova più tardi.';
        appendMessage(reply, 'bot');
        if (window.CiulloAvatar) window.CiulloAvatar.react('reply');

        // Se Jonny propone una scrittura, blocchiamo tutto e chiediamo
        // conferma esplicita all'utente prima che avvenga qualunque
        // modifica reale ai dati.
        if (data && data.requiresConfirmation) {
          openConfirmPopup(data.confirmationText || reply);
          return; // non riattivare l'input qui: lo fa closeConfirmPopup()
        }
      })
      .catch(function () {
        hideTyping();
        appendMessage('Qualcosa è andato storto nel contattare Jonny. Riprova tra poco.', 'bot');
        if (window.CiulloAvatar) window.CiulloAvatar.react('error');
      })
      .finally(function () {
        if (!confirmOverlay.classList.contains('active')) {
          setBusy(false);
          input.focus();
        }
      });
  });
})();
