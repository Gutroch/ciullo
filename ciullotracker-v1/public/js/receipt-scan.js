// receipt-scan.js — foto scontrino -> compila il form "Nuovo". Non salva mai: l'utente controlla e preme Salva.
(function () {
  var btn = document.getElementById('receiptBtn'), input = document.getElementById('receiptInput'),
      status = document.getElementById('receiptStatus'), card = document.getElementById('receiptCard');
  if (!btn || !input) return;

  function say(msg, cls) { status.textContent = msg; status.className = 'receipt-status' + (cls ? ' ' + cls : ''); }

  // Ridimensiona (lato lungo max 1600px) e ricomprime in JPEG: foto più leggere e rapide da inviare.
  async function shrink(file) {
    if (!window.createImageBitmap) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Foto troppo pesante.');
      return file;
    }
    var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    var k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    var cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(function (ok, ko) { cv.toBlob(function (b) { b ? ok(b) : ko(new Error('Immagine non leggibile.')); }, 'image/jpeg', 0.82); });
  }

  function mark(el) { if (!el) return; el.classList.add('is-ai-filled'); el.addEventListener('input', function f() { el.classList.remove('is-ai-filled'); el.removeEventListener('input', f); }); el.addEventListener('change', function g() { el.classList.remove('is-ai-filled'); el.removeEventListener('change', g); }); }
  function setVal(id, v, fire) { var el = document.getElementById(id); if (!el || v == null || v === '') return; el.value = v; if (fire) el.dispatchEvent(new Event('change', { bubbles: true })); mark(el); }

  function fill(f) {
    var uscita = document.querySelector('input[name="tipo"][value="uscita"]');
    if (uscita && !uscita.checked) { uscita.checked = true; uscita.dispatchEvent(new Event('change', { bubbles: true })); }
    if (f.categoria) { setVal('categoria', f.categoria, true); if (f.sottocategoria) setVal('sottocategoria', f.sottocategoria, false); }
    if (f.importo != null) setVal('importo', f.importo.toFixed(2), false);
    if (f.data) setVal('data_spesa', f.data, false);
    if (f.note) setVal('note', f.note, false);
  }

  btn.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', async function () {
    var file = input.files && input.files[0]; if (!file) return;
    btn.disabled = true; say('Leggo lo scontrino…');
    try {
      var blob = await shrink(file);
      var res = await fetch('/receipt/scan', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.success) throw new Error(data.error || 'Lettura non riuscita.');
      fill(data.fields);
      var missing = [];
      if (!data.fields.data) missing.push('la data');
      if (!data.fields.categoria) missing.push('la categoria');
      say('Fatto, ma non è stato salvato nulla. Controlla i campi evidenziati' + (missing.length ? ' e scegli ' + missing.join(' e ') : '') + ', poi premi Salva.', 'is-ok');
      var form = document.getElementById('expenseForm'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { say(e.message || 'Lettura non riuscita.', 'is-error'); }
    finally { btn.disabled = false; input.value = ''; }
  });

  if (/[?&]scan=1/.test(location.search) && card) { card.scrollIntoView({ block: 'center' }); btn.focus(); }
})();
