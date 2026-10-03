(function () {
  var form = document.getElementById('jonnyForm');
  if (!form) return;

  var input = document.getElementById('jonnyInput');
  var sendBtn = document.getElementById('jonnySend');
  var messages = document.getElementById('jonnyMessages');
  var conversationSelect = document.getElementById('jonnyConversationSelect');
  var newConversationBtn = document.getElementById('jonnyNewConversation');
  var activeConversationId = '';
  var busy = false;

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

  function setBusy(isBusy) {
    busy = isBusy;
    input.disabled = isBusy;
    sendBtn.disabled = isBusy;
    conversationSelect.disabled = isBusy;
    newConversationBtn.disabled = isBusy;
  }

  function renderMessages(history) {
    messages.replaceChildren();
    if (!history || history.length === 0) {
      appendMessage('Ciao! Sono Jonny 👋 Chiedimi pure qualcosa sulle vostre spese, sul budget o su come usare l\'app.', 'bot');
      return;
    }

    history.forEach(function (item) {
      if (item && typeof item.content === 'string') {
        appendMessage(item.content, item.role === 'user' ? 'user' : 'bot');
      }
    });
  }

  function updateConversationOptions(conversations, selectedId) {
    conversationSelect.replaceChildren();
    (conversations || []).forEach(function (conversation) {
      var option = document.createElement('option');
      option.value = conversation.id;
      option.textContent = conversation.title || 'Nuova conversazione';
      conversationSelect.appendChild(option);
    });
    activeConversationId = selectedId || '';
    conversationSelect.value = activeConversationId;
    conversationSelect.disabled = busy || !activeConversationId;
  }

  function handleConversationResponse(data) {
    updateConversationOptions(data.conversations, data.activeConversationId);
    renderMessages(data.messages || []);
  }

  function loadConversations() {
    setBusy(true);
    fetch('/jonny/api/conversations')
      .then(function (res) {
        if (!res.ok) throw new Error('Impossibile caricare la cronologia');
        return res.json();
      })
      .then(function (data) {
        handleConversationResponse(data);
      })
      .catch(function () {
        appendMessage('Non sono riuscito a caricare le conversazioni salvate. Ricarica la pagina per riprovare.', 'bot');
      })
      .finally(function () {
        setBusy(false);
      });
  }

  loadConversations();

  conversationSelect.addEventListener('change', function () {
    var conversationId = conversationSelect.value;
    if (!conversationId) return;
    setBusy(true);
    fetch('/jonny/api/conversations/' + encodeURIComponent(conversationId) + '/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Conversazione non disponibile');
        return res.json();
      })
      .then(function (data) {
        activeConversationId = data.activeConversationId;
        renderMessages(data.messages || []);
      })
      .catch(function () {
        appendMessage('Non sono riuscito ad aprire questa conversazione. Riprova.', 'bot');
      })
      .finally(function () {
        setBusy(false);
        input.focus();
      });
  });

  newConversationBtn.addEventListener('click', function () {
    setBusy(true);
    fetch('/jonny/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Impossibile creare una nuova conversazione');
        return res.json();
      })
      .then(function (data) {
        handleConversationResponse(data);
      })
      .catch(function () {
        appendMessage('Non sono riuscito a creare una nuova conversazione. Riprova.', 'bot');
      })
      .finally(function () {
        setBusy(false);
        input.focus();
      });
  });

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
        if (data && data.conversations) {
          updateConversationOptions(data.conversations, activeConversationId);
        }
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
        if (data && data.conversations) {
          updateConversationOptions(data.conversations, activeConversationId);
        }
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
