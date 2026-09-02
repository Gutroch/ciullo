// history-buttons.js - Pulsanti per incrementare/decrementare importi con importo personalizzabile
// Versione con popup interattivo e input per scegliere quanto aggiungere/togliere

document.addEventListener('DOMContentLoaded', function() {

    // ========== GESTIONE PULSANTI NELLA TABELLA STORICO ==========
    document.querySelectorAll('.qty-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var row = this.closest('tr');
            var amountCell = row.querySelector('.amount-cell');
            if (!amountCell) {
                showNotification('Errore: dati non validi', 'error');
                return;
            }

            var currentAmount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
            var isIncrement = this.classList.contains('inc');
            var expenseId = this.dataset.id;

            if (isNaN(currentAmount) || !expenseId) {
                showNotification('Errore: dati non validi', 'error');
                return;
            }

            showCustomAmountPopup(expenseId, currentAmount, isIncrement, row, amountCell);
        });
    });

    // ========== GESTIONE PULSANTI NELLA DASHBOARD (se presente) ==========
    function addDashboardButtons() {
        var expenseItems = document.querySelectorAll('.expense-item');
        expenseItems.forEach(function(item) {
            var expenseMeta = item.querySelector('.expense-meta');
            var expenseAmount = item.querySelector('.expense-amount');
            if (!expenseMeta || !expenseAmount) return;
            if (item.querySelector('.dashboard-qty-btn')) return;

            var expenseId = item.dataset.id;
            if (!expenseId) return;

            var btnGroup = document.createElement('div');
            btnGroup.className = 'qty-btn-group dashboard-qty-btn';
            btnGroup.style.cssText = 'margin-top: 8px; display: flex; gap: 4px;';

            var decBtn = document.createElement('button');
            decBtn.className = 'qty-btn dec';
            decBtn.dataset.id = expenseId;
            decBtn.textContent = '−';
            decBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color, #dee2e6); background: var(--bg-secondary, #f8f9fa); color: #FF6B6B; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';

            var incBtn = document.createElement('button');
            incBtn.className = 'qty-btn inc';
            incBtn.dataset.id = expenseId;
            incBtn.textContent = '+';
            incBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color, #dee2e6); background: var(--bg-secondary, #f8f9fa); color: #4ECDC4; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';

            btnGroup.appendChild(decBtn);
            btnGroup.appendChild(incBtn);
            expenseMeta.appendChild(btnGroup);

            decBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                if (isNaN(currentAmount)) return;
                showCustomAmountPopup(expenseId, currentAmount, false, null, expenseAmount);
            });

            incBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                if (isNaN(currentAmount)) return;
                showCustomAmountPopup(expenseId, currentAmount, true, null, expenseAmount);
            });
        });
    }

    setTimeout(addDashboardButtons, 500);

    // ========== POPUP CON INPUT PERSONALIZZATO (SFONDO BIANCO FORZATO) ==========
    function showCustomAmountPopup(expenseId, currentAmount, isIncrement, row, amountElement) {
        var existing = document.querySelector('.increment-popup-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        var popup = document.createElement('div');
        popup.className = 'increment-popup';
        // Forzo sfondo bianco e testo scuro per garantire leggibilità
        popup.style.cssText = `
            background: #ffffff;
            border-radius: 20px;
            padding: 32px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 25px 80px rgba(0,0,0,0.4);
            animation: modalIn 0.3s ease;
            border: 1px solid #dee2e6;
            color: #0a0a0a;
        `;

        var defaultAmount = 1.00;
        var title = isIncrement ? 'Incrementa importo' : 'Decrementa importo';
        var actionLabel = isIncrement ? 'Aggiungi' : 'Sottrai';
        var colorClass = isIncrement ? 'positive' : 'negative';
        var colorHex = isIncrement ? '#4ECDC4' : '#FF6B6B';

        popup.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #0a0a0a; font-size: 1.3rem; text-align: center;">${title}</h3>
            <div style="margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #dee2e6;">
                    <span style="color:#6c757d;">Importo attuale</span>
                    <span style="font-weight:600; color:#0a0a0a;">€${currentAmount.toFixed(2)}</span>
                </div>
                <div style="margin-top:16px;">
                    <label style="display:block;color:#6c757d;font-size:0.9rem;margin-bottom:6px;">${actionLabel} (€)</label>
                    <input type="text" id="popup-amount-input" class="popup-input" value="${defaultAmount.toFixed(2)}" autofocus>
                    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
                        <button class="quick-amount-btn" data-value="0.50">0,50</button>
                        <button class="quick-amount-btn" data-value="1.00">1,00</button>
                        <button class="quick-amount-btn" data-value="2.00">2,00</button>
                        <button class="quick-amount-btn" data-value="5.00">5,00</button>
                        <button class="quick-amount-btn" data-value="10.00">10,00</button>
                        <button class="quick-amount-btn" data-value="20.00">20,00</button>
                        <button class="quick-amount-btn" data-value="50.00">50,00</button>
                    </div>
                </div>
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid #dee2e6;">
                    <span style="color:#6c757d;">Nuovo importo</span>
                    <span id="popup-new-amount" style="display:block;font-weight:700;font-size:2rem;color:${colorHex};margin-top:4px;">
                        €${currentAmount.toFixed(2)}
                    </span>
                </div>
            </div>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="popup-cancel">Annulla</button>
                <button class="popup-confirm ${colorClass}">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        var inputField = popup.querySelector('#popup-amount-input');
        var newAmountDisplay = popup.querySelector('#popup-new-amount');
        var confirmBtn = popup.querySelector('.popup-confirm');
        var cancelBtn = popup.querySelector('.popup-cancel');

        function updatePreview() {
            var val = inputField.value.replace(',', '.').trim();
            var parsed = parseFloat(val);
            if (isNaN(parsed) || parsed < 0) parsed = 0;
            var newAmount = isIncrement ? currentAmount + parsed : Math.max(0.01, currentAmount - parsed);
            newAmountDisplay.textContent = '€' + newAmount.toFixed(2);
            newAmountDisplay.style.color = isIncrement ? '#4ECDC4' : '#FF6B6B';
        }

        inputField.addEventListener('input', updatePreview);

        popup.querySelectorAll('.quick-amount-btn').forEach(function(qbtn) {
            qbtn.addEventListener('click', function(e) {
                e.preventDefault();
                var val = parseFloat(this.dataset.value);
                if (!isNaN(val) && val >= 0) {
                    inputField.value = val.toFixed(2);
                    updatePreview();
                    inputField.focus();
                    inputField.select();
                }
            });
        });

        inputField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        });

        setTimeout(function() {
            inputField.focus();
            inputField.select();
        }, 100);

        var closePopup = function() { overlay.remove(); };

        cancelBtn.addEventListener('click', closePopup);

        confirmBtn.addEventListener('click', function() {
            var val = inputField.value.replace(',', '.').trim();
            var parsed = parseFloat(val);
            if (isNaN(parsed) || parsed <= 0) {
                showNotification('Attenzione: inserisci un importo valido maggiore di zero', 'error');
                return;
            }
            var newAmount = isIncrement ? currentAmount + parsed : Math.max(0.01, currentAmount - parsed);
            closePopup();
            updateExpenseAmount(expenseId, newAmount, row, amountElement);
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closePopup();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) closePopup();
        });

        updatePreview();
    }

    // ========== AGGIORNAMENTO IMPORT VIA AJAX ==========
    function updateExpenseAmount(id, newAmount, row, amountElement) {
        var payload = { importo: newAmount };
        var headers = { 'Content-Type': 'application/json' };

        var csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken.getAttribute('content');
        }

        var buttons = [];
        if (row) {
            buttons = row.querySelectorAll('.qty-btn');
        } else if (amountElement) {
            var parent = amountElement.closest('.expense-item');
            if (parent) buttons = parent.querySelectorAll('.qty-btn');
        }

        buttons.forEach(function(b) {
            b.disabled = true;
            b.style.opacity = '0.5';
            b.style.cursor = 'not-allowed';
        });

        fetch('/expenses/' + id + '/update-amount', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            if (!response.ok) {
                return response.json().then(function(err) {
                    throw new Error(err.error || 'Errore del server');
                });
            }
            return response.json();
        })
        .then(function(data) {
            if (data.success) {
                if (row) {
                    var amountCell = row.querySelector('.amount-cell');
                    if (amountCell) {
                        amountCell.textContent = '€' + newAmount.toFixed(2);
                        amountCell.style.color = data.isIngresso ? '#4ECDC4' : '#FF6B6B';
                    }
                    updateTotals();
                } else if (amountElement) {
                    amountElement.textContent = (data.isIngresso ? '+' : '−') + ' €' + newAmount.toFixed(2);
                    amountElement.style.color = data.isIngresso ? '#4ECDC4' : '#FF6B6B';
                    if (window.location.pathname === '/') {
                        setTimeout(function() { location.reload(); }, 500);
                    }
                }
                showNotification('OK: importo aggiornato a €' + newAmount.toFixed(2), 'success');
            } else {
                showNotification('Errore: ' + (data.error || 'Aggiornamento fallito'), 'error');
            }
        })
        .catch(function(error) {
            console.error('Errore:', error);
            showNotification('Errore: ' + error.message, 'error');
        })
        .finally(function() {
            buttons.forEach(function(b) {
                b.disabled = false;
                b.style.opacity = '1';
                b.style.cursor = 'pointer';
            });
        });
    }

    // ========== AGGIORNAMENTO TOTALI NEL FOOTER ==========
    function updateTotals() {
        var rows = document.querySelectorAll('.data-table tbody tr:not(.empty-state)');
        var totalUscite = 0, totalEntrate = 0;

        rows.forEach(function(row) {
            var amountCell = row.querySelector('.amount-cell');
            if (amountCell) {
                var amount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
                if (!isNaN(amount)) {
                    var badge = row.querySelector('.badge');
                    if (badge) {
                        var type = badge.textContent.trim();
                        if (type === 'Uscita') totalUscite += amount;
                        else if (type === 'Entrata') totalEntrate += amount;
                    }
                }
            }
        });

        var footer = document.querySelector('.data-table tfoot');
        if (footer) {
            var cells = footer.querySelectorAll('td');
            if (cells.length >= 3) {
                cells[0].textContent = 'Uscite: €' + totalUscite.toFixed(2);
                cells[1].textContent = 'Entrate: €' + totalEntrate.toFixed(2);
                cells[2].textContent = 'Saldo: €' + (totalEntrate - totalUscite).toFixed(2);
            }
        }

        var countSpan = document.querySelector('.export-bar strong');
        if (countSpan) countSpan.textContent = rows.length;
    }

    // ========== NOTIFICHE TOAST ==========
    function showNotification(message, type) {
        var existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'toast-notification ' + type;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 12px 24px;
            border-radius: 12px;
            background: var(--bg-secondary, #f8f9fa);
            border: 1px solid var(--border-color, #dee2e6);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-weight: 500;
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 90%;
            ${type === 'success' ? 'border-left: 4px solid #4ECDC4; color: #4ECDC4;' : ''}
            ${type === 'error' ? 'border-left: 4px solid #FF6B6B; color: #FF6B6B;' : ''}
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            toast.classList.add('fade-out');
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    // ========== STILI PER ANIMAZIONI ==========
    if (!document.getElementById('popup-styles')) {
        var styleSheet = document.createElement('style');
        styleSheet.id = 'popup-styles';
        styleSheet.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes modalIn {
                from { transform: scale(0.9) translateY(20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styleSheet);
    }
});