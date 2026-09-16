// public/js/jonny-chat.js
// Gestisce la chat della sezione Jonny. Per ora il backend risponde sempre
// con un messaggio placeholder "in arrivo" (vedi routes/jonny.js): quando
// il motore RAG sarà pronto basterà cambiare la risposta del server, questa
// interfaccia resta la stessa.
(function () {
  var form = document.getElementById('jonnyForm');
  if (!form) return; // script incluso solo nella pagina Jonny, ma per sicurezza

  var input = document.getElementById('jonnyInput');
  var sendBtn = document.getElementById('jonnySend');
  var messages = document.getElementById('jonnyMessages');

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
      })
      .catch(function () {
        hideTyping();
        appendMessage('Qualcosa è andato storto nel contattare Jonny. Riprova tra poco.', 'bot');
        if (window.CiulloAvatar) window.CiulloAvatar.react('error');
      })
      .finally(function () {
        setBusy(false);
        input.focus();
      });
  });
})();
