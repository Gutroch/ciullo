// history-buttons.js - Pulsanti per incrementare/decrementare importi con importo personalizzabile
// Versione con popup interattivo e input per scegliere quanto aggiungere/togliere

document.addEventListener('DOMContentLoaded', function() {

    // ========== GESTIONE PULSANTI NELLA TABELLA STORICO ==========
    document.querySelectorAll('.qty-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const row = this.closest('tr');
            const amountCell = row.querySelector('.amount-cell');
            if (!amountCell) return;

            const currentAmount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
            // Determiniamo se è incremento o decremento dal pulsante (dec/inc)
            const isIncrement = this.classList.contains('inc');
            const expenseId = this.dataset.id;

            if (isNaN(currentAmount) || !expenseId) {
                showNotification('❌ Dati non validi', 'error');
                return;
            }

            // Mostra il popup con input personalizzato
            showCustomAmountPopup(expenseId, currentAmount, isIncrement, row, amountCell);
        });
    });

    // ========== GESTIONE PULSANTI NELLA DASHBOARD ==========
    function addDashboardButtons() {
        const expenseItems = document.querySelectorAll('.expense-item');
        expenseItems.forEach(item => {
            const expenseMeta = item.querySelector('.expense-meta');
            const expenseAmount = item.querySelector('.expense-amount');
            if (!expenseMeta || !expenseAmount) return;
            if (item.querySelector('.dashboard-qty-btn')) return;

            const expenseId = item.dataset.id;
            if (!expenseId) return;

            const btnGroup = document.createElement('div');
            btnGroup.className = 'qty-btn-group dashboard-qty-btn';
            btnGroup.style.cssText = 'margin-top: 8px; display: flex; gap: 4px;';

            const decBtn = document.createElement('button');
            decBtn.className = 'qty-btn dec';
            decBtn.dataset.id = expenseId;
            decBtn.textContent = '−';
            decBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-secondary); color: #FF6B6B; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';

            const incBtn = document.createElement('button');
            incBtn.className = 'qty-btn inc';
            incBtn.dataset.id = expenseId;
            incBtn.textContent = '+';
            incBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-secondary); color: #4ECDC4; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';

            btnGroup.appendChild(decBtn);
            btnGroup.appendChild(incBtn);
            expenseMeta.appendChild(btnGroup);

            decBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                if (isNaN(currentAmount)) return;
                showCustomAmountPopup(expenseId, currentAmount, false, null, expenseAmount);
            });

            incBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                if (isNaN(currentAmount)) return;
                showCustomAmountPopup(expenseId, currentAmount, true, null, expenseAmount);
            });
        });
    }

    setTimeout(addDashboardButtons, 500);

    // ========== POPUP CON INPUT PERSONALIZZATO ==========
    function showCustomAmountPopup(expenseId, currentAmount, isIncrement, row, amountElement) {
        // Rimuovi eventuali popup aperti
        const existing = document.querySelector('.increment-popup-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        const popup = document.createElement('div');
        popup.className = 'increment-popup';
        popup.style.cssText = `
            background: var(--bg-primary);
            border-radius: 20px;
            padding: 32px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 25px 80px rgba(0,0,0,0.4);
            animation: modalIn 0.3s ease;
            border: 1px solid var(--border-color);
        `;

        // Valore predefinito 1.00 (o 0.00 se decremento? Lasciamo 1.00)
        const defaultAmount = 1.00;

        popup.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: var(--text-primary); font-size: 1.3rem; text-align: center;">
                ${isIncrement ? '➕ Incrementa' : '➖ Decrementa'} importo
            </h3>
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary);">Importo attuale</span>
                    <span style="font-weight: 600; color: var(--text-primary);">€${currentAmount.toFixed(2)}</span>
                </div>
                <div style="margin-top: 16px;">
                    <label style="display: block; color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 6px;">
                        ${isIncrement ? 'Aggiungi' : 'Sottrai'} (€)
                    </label>
                    <input type="text" id="popup-amount-input" class="input" style="width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 1.1rem; box-sizing: border-box;" value="${defaultAmount.toFixed(2)}" autofocus>
                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                        <button class="quick-amount" data-value="0.50" style="padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">+0.50</button>
                        <button class="quick-amount" data-value="1.00" style="padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">+1.00</button>
                        <button class="quick-amount" data-value="2.00" style="padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">+2.00</button>
                        <button class="quick-amount" data-value="5.00" style="padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">+5.00</button>
                        <button class="quick-amount" data-value="10.00" style="padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">+10.00</button>
                    </div>
                </div>
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary);">Nuovo importo</span>
                    <span id="popup-new-amount" style="display: block; font-weight: 700; font-size: 2rem; color: ${isIncrement ? '#4ECDC4' : '#FF6B6B'}; margin-top: 4px;">
                        €${currentAmount.toFixed(2)}
                    </span>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="popup-cancel" style="padding: 10px 24px; border-radius: 10px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-weight: 500; font-size: 0.95rem;">Annulla</button>
                <button class="popup-confirm" style="padding: 10px 24px; border-radius: 10px; border: none; background: ${isIncrement ? '#4ECDC4' : '#FF6B6B'}; color: white; cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 0.95rem;">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Riferimenti agli elementi del popup
        const inputField = popup.querySelector('#popup-amount-input');
        const newAmountDisplay = popup.querySelector('#popup-new-amount');
        const confirmBtn = popup.querySelector('.popup-confirm');
        const cancelBtn = popup.querySelector('.popup-cancel');

        // Funzione per aggiornare l'anteprima del nuovo importo
        function updatePreview() {
            let inputValue = inputField.value.replace(',', '.').trim();
            let parsed = parseFloat(inputValue);
            if (isNaN(parsed) || parsed < 0) parsed = 0;
            const newAmount = isIncrement ? currentAmount + parsed : Math.max(0.01, currentAmount - parsed);
            newAmountDisplay.textContent = `€${newAmount.toFixed(2)}`;
            // Colore dinamico
            newAmountDisplay.style.color = isIncrement ? '#4ECDC4' : '#FF6B6B';
        }

        // Eventi per aggiornare l'anteprima in tempo reale
        inputField.addEventListener('input', updatePreview);

        // Pulsanti rapidi
        popup.querySelectorAll('.quick-amount').forEach(qbtn => {
            qbtn.addEventListener('click', function(e) {
                e.preventDefault();
                const val = parseFloat(this.dataset.value);
                if (!isNaN(val) && val >= 0) {
                    inputField.value = val.toFixed(2);
                    updatePreview();
                    inputField.focus();
                    inputField.select();
                }
            });
        });

        // Se premo Invio nel campo, conferma automaticamente
        inputField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        });

        // All'apertura, focus sul campo e seleziona tutto
        setTimeout(() => {
            inputField.focus();
            inputField.select();
        }, 100);

        // Azioni
        const closePopup = () => overlay.remove();

        cancelBtn.addEventListener('click', closePopup);

        confirmBtn.addEventListener('click', function() {
            let inputValue = inputField.value.replace(',', '.').trim();
            let parsed = parseFloat(inputValue);
            if (isNaN(parsed) || parsed <= 0) {
                showNotification('⚠️ Inserisci un importo valido maggiore di zero', 'error');
                return;
            }
            const newAmount = isIncrement ? currentAmount + parsed : Math.max(0.01, currentAmount - parsed);
            closePopup();
            updateExpenseAmount(expenseId, newAmount, row, amountElement);
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closePopup();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) closePopup();
        });

        // Inizializza anteprima
        updatePreview();
    }

    // ========== AGGIORNAMENTO IMPORT VIA AJAX (JSON) ==========
    function updateExpenseAmount(id, newAmount, row, amountElement) {
        const payload = { importo: newAmount };
        const headers = { 'Content-Type': 'application/json' };

        // CSRF token se presente
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken.getAttribute('content');
        }

        let buttons = [];
        if (row) {
            buttons = row.querySelectorAll('.qty-btn');
        } else if (amountElement) {
            const parent = amountElement.closest('.expense-item');
            if (parent) buttons = parent.querySelectorAll('.qty-btn');
        }

        buttons.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.5';
            b.style.cursor = 'not-allowed';
        });

        fetch(`/expenses/${id}/update-amount`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Errore del server'); });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                if (row) {
                    const amountCell = row.querySelector('.amount-cell');
                    if (amountCell) {
                        amountCell.textContent = `€${newAmount.toFixed(2)}`;
                        amountCell.style.color = data.isIngresso ? '#4ECDC4' : '#FF6B6B';
                    }
                    updateTotals();
                } else if (amountElement) {
                    amountElement.textContent = `${data.isIngresso ? '+' : '−'} €${newAmount.toFixed(2)}`;
                    amountElement.style.color = data.isIngresso ? '#4ECDC4' : '#FF6B6B';
                    if (window.location.pathname === '/') {
                        // Ricarica per aggiornare KPI
                        setTimeout(() => location.reload(), 500);
                    }
                }
                showNotification('✅ Importo aggiornato a €' + newAmount.toFixed(2), 'success');
            } else {
                showNotification('❌ Errore: ' + (data.error || 'Aggiornamento fallito'), 'error');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            showNotification('❌ ' + error.message, 'error');
        })
        .finally(() => {
            buttons.forEach(b => {
                b.disabled = false;
                b.style.opacity = '1';
                b.style.cursor = 'pointer';
            });
        });
    }

    // ========== AGGIORNAMENTO TOTALI NEL FOOTER ==========
    function updateTotals() {
        const rows = document.querySelectorAll('.data-table tbody tr:not(.empty-state)');
        let totalUscite = 0, totalEntrate = 0;

        rows.forEach(row => {
            const amountCell = row.querySelector('.amount-cell');
            if (amountCell) {
                const amount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
                if (!isNaN(amount)) {
                    const badge = row.querySelector('.badge');
                    if (badge) {
                        const type = badge.textContent.trim();
                        if (type === 'Uscita') totalUscite += amount;
                        else if (type === 'Entrata') totalEntrate += amount;
                    }
                }
            }
        });

        const footer = document.querySelector('.data-table tfoot');
        if (footer) {
            const cells = footer.querySelectorAll('td');
            if (cells.length >= 3) {
                cells[0].textContent = `Uscite: €${totalUscite.toFixed(2)}`;
                cells[1].textContent = `Entrate: €${totalEntrate.toFixed(2)}`;
                cells[2].textContent = `Saldo: €${(totalEntrate - totalUscite).toFixed(2)}`;
            }
        }

        const countSpan = document.querySelector('.export-bar strong');
        if (countSpan) countSpan.textContent = rows.length;
    }

    // ========== NOTIFICHE TOAST ==========
    function showNotification(message, type) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 12px 24px;
            border-radius: 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
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

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ========== STILI PER ANIMAZIONI ==========
    const styleSheet = document.createElement('style');
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
});