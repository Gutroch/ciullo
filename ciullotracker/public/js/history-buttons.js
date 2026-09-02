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
            
            const newAmount = Math.max(0.01, currentAmount + increment);
            
            if (newAmount !== currentAmount) {
                updateExpenseAmount(expenseId, newAmount, row);
            }
        });
    });
    
    // Gestione incremento rapido dal form
    const quickIncBtn = document.getElementById('quickIncrement');
    const quickDecBtn = document.getElementById('quickDecrement');
    const amountInput = document.getElementById('importo');
    
    if (quickIncBtn && amountInput) {
        quickIncBtn.addEventListener('click', function() {
            const current = parseFloat(amountInput.value) || 0;
            amountInput.value = (current + 1).toFixed(2);
            amountInput.dispatchEvent(new Event('input'));
        });
    }
    
    if (quickDecBtn && amountInput) {
        quickDecBtn.addEventListener('click', function() {
            const current = parseFloat(amountInput.value) || 0;
            if (current > 0.01) {
                amountInput.value = Math.max(0.01, current - 1).toFixed(2);
                amountInput.dispatchEvent(new Event('input'));
            }
        });
    }
    
    // Funzione per aggiornare l'importo via AJAX
    function updateExpenseAmount(id, newAmount, row) {
        const formData = new FormData();
        formData.append('importo', newAmount);
        
        fetch(`/expenses/${id}/update-amount`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const amountCell = row.querySelector('.amount-cell');
                amountCell.textContent = `€${newAmount.toFixed(2)}`;
                amountCell.style.color = data.isIngresso ? '#148c50' : 'var(--danger)';
                
                // Aggiorna totali nel footer
                updateTotals();
                
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
});