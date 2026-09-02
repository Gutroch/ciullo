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
            const increment = parseFloat(this.dataset.value);
            const expenseId = this.dataset.id;

            if (isNaN(currentAmount) || isNaN(increment) || !expenseId) {
                showNotification('❌ Dati non validi', 'error');
                return;
            }

            showIncrementPopup(expenseId, currentAmount, increment, row, amountCell);
        });
    });

    // ========== GESTIONE PULSANTI NELLA DASHBOARD ==========
    function addDashboardButtons() {
        const expenseItems = document.querySelectorAll('.expense-item');
        expenseItems.forEach(item => {
            const expenseMeta = item.querySelector('.expense-meta');
            const expenseAmount = item.querySelector('.expense-amount');
            if (!expenseMeta || !expenseAmount) return;

            // Evita di aggiungere pulsanti duplicati
            if (item.querySelector('.dashboard-qty-btn')) return;

            const expenseId = item.dataset.id;
            if (!expenseId) return;

            const btnGroup = document.createElement('div');
            btnGroup.className = 'qty-btn-group dashboard-qty-btn';
            btnGroup.style.cssText = 'margin-top: 8px; display: flex; gap: 4px;';

            // Pulsante decremento
            const decBtn = document.createElement('button');
            decBtn.className = 'qty-btn dec';
            decBtn.dataset.id = expenseId;
            decBtn.dataset.value = '-1.00';
            decBtn.textContent = '−';
            decBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-secondary); color: #FF6B6B; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';

            // Pulsante incremento
            const incBtn = document.createElement('button');
            incBtn.className = 'qty-btn inc';
            incBtn.dataset.id = expenseId;
            incBtn.dataset.value = '1.00';
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
                showIncrementPopup(expenseId, currentAmount, -1.00, null, expenseAmount);
            });

            incBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                if (isNaN(currentAmount)) return;
                showIncrementPopup(expenseId, currentAmount, 1.00, null, expenseAmount);
            });
        });
    }

    // Esegui dopo il caricamento della dashboard
    setTimeout(addDashboardButtons, 500);

    // ========== POPUP DI CONFERMA ==========
    function showIncrementPopup(expenseId, currentAmount, increment, row, amountElement) {
        const newAmount = Math.max(0.01, currentAmount + increment);
        const isPositive = increment > 0;

        // Rimuovi eventuali popup aperti
        const existing = document.querySelector('.increment-popup-overlay');
        if (existing) existing.remove();

        // Creazione overlay
        const overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        // Creazione popup
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

        popup.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: var(--text-primary); font-size: 1.3rem; text-align: center;">
                ${isPositive ? '➕ Incrementa' : '➖ Decrementa'} Importo
            </h3>
            <div style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">Importo attuale</span>
                    <span style="font-weight: 600; font-size: 1.1rem; color: var(--text-secondary);">€${currentAmount.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">${isPositive ? '➕ Aggiungi' : '➖ Sottrai'}</span>
                    <span style="font-weight: 600; font-size: 1.1rem; color: ${isPositive ? '#4ECDC4' : '#FF6B6B'};">€${Math.abs(increment).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                    <span style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 600;">Nuovo importo</span>
                    <span style="font-weight: 700; font-size: 1.8rem; color: ${isPositive ? '#4ECDC4' : '#FF6B6B'};">€${newAmount.toFixed(2)}</span>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;">
                <button class="popup-cancel" style="
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                    font-size: 0.95rem;
                ">Annulla</button>
                <button class="popup-confirm" style="
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: none;
                    background: ${isPositive ? '#4ECDC4' : '#FF6B6B'};
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                    font-size: 0.95rem;
                ">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Eventi chiusura
        const closePopup = () => overlay.remove();

        popup.querySelector('.popup-cancel').addEventListener('click', closePopup);
        popup.querySelector('.popup-confirm').addEventListener('click', function() {
            closePopup();
            updateExpenseAmount(expenseId, newAmount, row, amountElement);
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closePopup();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) closePopup();
        });
    }

    // ========== AGGIORNAMENTO IMPORT VIA AJAX ==========
    function updateExpenseAmount(id, newAmount, row, amountElement) {
        const formData = new FormData();
        formData.append('importo', newAmount);

        // Aggiungi CSRF token se presente
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            formData.append('_csrf', csrfToken.getAttribute('content'));
        }

        // Disabilita pulsanti durante il caricamento
        let buttons = [];
        if (row) {
            buttons = row.querySelectorAll('.qty-btn');
        } else if (amountElement) {
            // Cerca i pulsanti nel contenitore della dashboard
            const parent = amountElement.closest('.expense-item');
            if (parent) {
                buttons = parent.querySelectorAll('.qty-btn');
            }
        }

        buttons.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.5';
            b.style.cursor = 'not-allowed';
        });

        fetch(`/expenses/${id}/update-amount`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Aggiorna l'elemento visivo
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
                    // Ricarica la dashboard per aggiornare i KPI
                    if (window.location.pathname === '/') {
                        location.reload();
                    }
                }
                showNotification('✅ Importo aggiornato a €' + newAmount.toFixed(2), 'success');
            } else {
                showNotification('❌ Errore: ' + (data.error || 'Aggiornamento fallito'), 'error');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            showNotification('❌ Errore di connessione al server', 'error');
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
        let totalUscite = 0;
        let totalEntrate = 0;

        rows.forEach(row => {
            const amountCell = row.querySelector('.amount-cell');
            if (amountCell) {
                const amount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
                if (!isNaN(amount)) {
                    const badge = row.querySelector('.badge');
                    if (badge) {
                        const type = badge.textContent.trim();
                        if (type === 'Uscita') {
                            totalUscite += amount;
                        } else if (type === 'Entrata') {
                            totalEntrate += amount;
                        }
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

        // Aggiorna contatore movimenti
        const countSpan = document.querySelector('.export-bar strong');
        if (countSpan) {
            countSpan.textContent = rows.length;
        }
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

    // ========== STILI DINAMICI PER ANIMAZIONI ==========
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