// history-buttons.js - Pulsanti per incrementare/decrementare importi
document.addEventListener('DOMContentLoaded', function() {
    // Gestione pulsanti +/- nella tabella storico
    document.querySelectorAll('.qty-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const row = this.closest('tr');
            const amountCell = row.querySelector('.amount-cell');
            const currentAmount = parseFloat(amountCell.textContent.replace('€', '').replace(',', '.').trim());
            const increment = parseFloat(this.dataset.value);
            const expenseId = this.dataset.id;
            
            // Mostra il popup per l'incremento
            showIncrementPopup(expenseId, currentAmount, increment, row, amountCell);
        });
    });

    // Gestione incremento rapido dal form
    const quickIncBtn = document.getElementById('quickIncrement');
    const quickDecBtn = document.getElementById('quickDecrement');
    const amountInput = document.getElementById('importo');
    
    if (quickIncBtn && amountInput) {
        quickIncBtn.addEventListener('click', function() {
            const current = parseFloat(amountInput.value) || 0;
            const newAmount = current + 1;
            // Mostra il popup per l'incremento rapido
            showIncrementPopupFromForm(amountInput, newAmount);
        });
    }
    
    if (quickDecBtn && amountInput) {
        quickDecBtn.addEventListener('click', function() {
            const current = parseFloat(amountInput.value) || 0;
            if (current > 0.01) {
                const newAmount = Math.max(0.01, current - 1);
                showIncrementPopupFromForm(amountInput, newAmount);
            }
        });
    }

    // Funzione per mostrare il popup di incremento per la dashboard
    function showIncrementPopupForDashboard(expenseId, currentAmount, increment, expenseItem, amountElement) {
        // Crea overlay
        const overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Crea popup
        const popup = document.createElement('div');
        popup.className = 'increment-popup';
        popup.style.cssText = `
            background: var(--bg-primary);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: modalIn 0.3s ease;
        `;

        const newAmount = Math.max(0.01, currentAmount + increment);
        
        popup.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">
                ${increment > 0 ? '➕ Incrementa' : '➖ Decrementa'} Importo
            </h3>
            <div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Importo attuale:</p>
                <p style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0;">
                    €${currentAmount.toFixed(2)}
                </p>
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">
                    ${increment > 0 ? '➕ Aggiungi' : '➖ Sottrai'}:
                    <span style="color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; font-weight: 600;">
                        €${Math.abs(increment).toFixed(2)}
                    </span>
                </p>
                <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Nuovo importo:</p>
                    <p style="font-size: 2rem; font-weight: 700; color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; margin: 0;">
                        €${newAmount.toFixed(2)}
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="popup-cancel" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                ">Annulla</button>
                <button class="popup-confirm" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'};
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                ">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Gestione click su annulla
        popup.querySelector('.popup-cancel').addEventListener('click', function() {
            overlay.remove();
        });

        // Gestione click su conferma
        popup.querySelector('.popup-confirm').addEventListener('click', function() {
            overlay.remove();
            // Aggiorna l'importo
            updateExpenseAmount(expenseId, newAmount, null, amountElement);
        });

        // Chiudi cliccando fuori
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });

        // Chiudi con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                overlay.remove();
            }
        });
    }

    // Funzione per mostrare il popup di incremento per la tabella storico
    function showIncrementPopup(expenseId, currentAmount, increment, row, amountCell) {
        const newAmount = Math.max(0.01, currentAmount + increment);
        
        // Crea overlay
        const overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Crea popup
        const popup = document.createElement('div');
        popup.className = 'increment-popup';
        popup.style.cssText = `
            background: var(--bg-primary);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: modalIn 0.3s ease;
        `;

        popup.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">
                ${increment > 0 ? '➕ Incrementa' : '➖ Decrementa'} Importo
            </h3>
            <div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Importo attuale:</p>
                <p style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0;">
                    €${currentAmount.toFixed(2)}
                </p>
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">
                    ${increment > 0 ? '➕ Aggiungi' : '➖ Sottrai'}:
                    <span style="color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; font-weight: 600;">
                        €${Math.abs(increment).toFixed(2)}
                    </span>
                </p>
                <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Nuovo importo:</p>
                    <p style="font-size: 2rem; font-weight: 700; color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; margin: 0;">
                        €${newAmount.toFixed(2)}
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="popup-cancel" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                ">Annulla</button>
                <button class="popup-confirm" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'};
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                ">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Gestione click su annulla
        popup.querySelector('.popup-cancel').addEventListener('click', function() {
            overlay.remove();
        });

        // Gestione click su conferma
        popup.querySelector('.popup-confirm').addEventListener('click', function() {
            overlay.remove();
            // Aggiorna l'importo
            updateExpenseAmount(expenseId, newAmount, row);
        });

        // Chiudi cliccando fuori
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });

        // Chiudi con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                overlay.remove();
            }
        });
    }

    // Funzione per mostrare il popup di incremento dal form
    function showIncrementPopupFromForm(amountInput, newAmount) {
        const current = parseFloat(amountInput.value) || 0;
        const increment = newAmount - current;
        
        // Crea overlay
        const overlay = document.createElement('div');
        overlay.className = 'increment-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Crea popup
        const popup = document.createElement('div');
        popup.className = 'increment-popup';
        popup.style.cssText = `
            background: var(--bg-primary);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: modalIn 0.3s ease;
        `;

        popup.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">
                ${increment > 0 ? '➕ Incrementa' : '➖ Decrementa'} Importo
            </h3>
            <div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Importo attuale:</p>
                <p style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0;">
                    €${current.toFixed(2)}
                </p>
                <p style="margin: 0 0 8px 0; color: var(--text-secondary);">
                    ${increment > 0 ? '➕ Aggiungi' : '➖ Sottrai'}:
                    <span style="color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; font-weight: 600;">
                        €${Math.abs(increment).toFixed(2)}
                    </span>
                </p>
                <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <p style="margin: 0 0 8px 0; color: var(--text-secondary);">Nuovo importo:</p>
                    <p style="font-size: 2rem; font-weight: 700; color: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'}; margin: 0;">
                        €${newAmount.toFixed(2)}
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="popup-cancel" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                ">Annulla</button>
                <button class="popup-confirm" style="
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: ${increment > 0 ? '#4ECDC4' : '#FF6B6B'};
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                ">Conferma</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Gestione click su annulla
        popup.querySelector('.popup-cancel').addEventListener('click', function() {
            overlay.remove();
        });

        // Gestione click su conferma
        popup.querySelector('.popup-confirm').addEventListener('click', function() {
            overlay.remove();
            amountInput.value = newAmount.toFixed(2);
            amountInput.dispatchEvent(new Event('input'));
        });

        // Chiudi cliccando fuori
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });

        // Chiudi con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                overlay.remove();
            }
        });
    }
    
    // Funzione per aggiornare l'importo via AJAX
    function updateExpenseAmount(id, newAmount, row, amountElement) {
        const formData = new FormData();
        formData.append('importo', newAmount);
        
        fetch(`/expenses/${id}/update-amount`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (row) {
                    // Aggiorna nella tabella storico
                    const amountCell = row.querySelector('.amount-cell');
                    amountCell.textContent = `€${newAmount.toFixed(2)}`;
                    amountCell.style.color = data.isIngresso ? '#148c50' : 'var(--danger)';
                } else if (amountElement) {
                    // Aggiorna nella dashboard
                    amountElement.textContent = `${data.isIngresso ? '+' : '−'} €${newAmount.toFixed(2)}`;
                    amountElement.style.color = data.isIngresso ? '#4ECDC4' : '#FF6B6B';
                }
                
                // Aggiorna totali nel footer
                if (row) {
                    updateTotals();
                } else {
                    // Se siamo nella dashboard, ricarica la pagina per aggiornare i KPI
                    location.reload();
                }
                
                // Feedback visivo
                showNotification('Importo aggiornato!', 'success');
            } else {
                showNotification('Errore durante l\'aggiornamento', 'error');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            showNotification('Errore di connessione', 'error');
        });
    }
    
    // Aggiorna totali nel footer
    function updateTotals() {
        const rows = document.querySelectorAll('.data-table tbody tr:not(.empty-state)');
        let totalUscite = 0;
        let totalEntrate = 0;
        
        rows.forEach(row => {
            const amount = parseFloat(row.querySelector('.amount-cell').textContent.replace('€', '').replace(',', '.').trim());
            const type = row.querySelector('.badge').textContent.trim();
            if (type === 'Uscita') {
                totalUscite += amount;
            } else {
                totalEntrate += amount;
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
    }
    
    // Notifiche temporanee
    function showNotification(message, type) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Aggiungi pulsanti +/- anche nella dashboard
    function addDashboardButtons() {
        const expenseItems = document.querySelectorAll('.expense-item');
        expenseItems.forEach(item => {
            const expenseMeta = item.querySelector('.expense-meta');
            const expenseAmount = item.querySelector('.expense-amount');
            
            if (expenseMeta && expenseAmount && !item.querySelector('.dashboard-qty-btn')) {
                // Crea il contenitore per i pulsanti
                const btnGroup = document.createElement('div');
                btnGroup.className = 'qty-btn-group dashboard-qty-btn';
                btnGroup.style.cssText = 'margin-top: 8px;';
                
                // Ottieni l'ID della spesa dal link "Vedi tutti" o dal data attribute
                const expenseId = item.dataset.id || '1'; // Da implementare con dati reali
                
                // Pulsante decremento
                const decBtn = document.createElement('button');
                decBtn.className = 'qty-btn dec';
                decBtn.dataset.id = expenseId;
                decBtn.dataset.value = '-1.00';
                decBtn.textContent = '−';
                decBtn.style.cssText = 'width: 28px; height: 28px;';
                
                // Pulsante incremento
                const incBtn = document.createElement('button');
                incBtn.className = 'qty-btn inc';
                incBtn.dataset.id = expenseId;
                incBtn.dataset.value = '1.00';
                incBtn.textContent = '+';
                incBtn.style.cssText = 'width: 28px; height: 28px;';
                
                btnGroup.appendChild(decBtn);
                btnGroup.appendChild(incBtn);
                expenseMeta.appendChild(btnGroup);
                
                // Aggiungi event listeners
                decBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                    const increment = -1.00;
                    const expenseId = this.dataset.id;
                    const row = this.closest('.expense-item');
                    showIncrementPopupForDashboard(expenseId, currentAmount, increment, row, expenseAmount);
                });
                
                incBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentAmount = parseFloat(expenseAmount.textContent.replace(/[€+−\s]/g, '').replace(',', '.').trim());
                    const increment = 1.00;
                    const expenseId = this.dataset.id;
                    const row = this.closest('.expense-item');
                    showIncrementPopupForDashboard(expenseId, currentAmount, increment, row, expenseAmount);
                });
            }
        });
    }

    // Aggiungi pulsanti dopo il caricamento della dashboard
    setTimeout(addDashboardButtons, 500);
});