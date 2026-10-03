(function() {
    var table = document.querySelector('.data-table');
    if (!table) return;

    var body = table.querySelector('tbody');
    var rows = Array.from(body.querySelectorAll('tr[data-sort-row]'));
    var collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
    var currentKey = '';
    var currentDirection = 1;

    rows.forEach(function(row, index) {
        row.dataset.originalIndex = index;
    });

    var cellAttributes = {
        date: 'sortDate',
        type: 'sortType',
        amount: 'sortAmount',
        category: 'sortCategory',
        subcategory: 'sortSubcategory',
        'created-by': 'sortCreatedBy',
        'for-person': 'sortForPerson',
        notes: 'sortNotes'
    };

    function compareValues(left, right, kind, direction) {
        if (left === '' || right === '') {
            if (left === right) return 0;
            return left === '' ? 1 : -1;
        }

        var result;
        if (kind === 'number') {
            result = Number(left) - Number(right);
        } else if (kind === 'date') {
            result = Date.parse(left) - Date.parse(right);
            if (Number.isNaN(result)) result = collator.compare(left, right);
        } else {
            result = collator.compare(left, right);
        }
        return result * direction;
    }

    table.querySelectorAll('.history-sort').forEach(function(button) {
        var heading = button.closest('th');
        heading.setAttribute('aria-sort', 'none');

        button.addEventListener('click', function() {
    var key = button.dataset.sortKey;
    var kind = button.dataset.sortKind;
    var attribute = cellAttributes[key];
    if (!attribute) return;

    if (currentKey !== key) {
        currentKey = key;
        currentDirection = 1;
    } else if (currentDirection === 1) {
        currentDirection = -1;
    } else {
        // terzo click: torna all'ordine originale
        currentKey = '';
        currentDirection = 1;
    }

    if (currentKey === '') {
        // Ordine originale: usa l'indice salvato all'avvio
        rows.sort(function(leftRow, rightRow) {
            return Number(leftRow.dataset.originalIndex) - Number(rightRow.dataset.originalIndex);
        });
    } else {
        rows.sort(function(leftRow, rightRow) {
            var left = leftRow.cells[heading.cellIndex].dataset[attribute] || '';
            var right = rightRow.cells[heading.cellIndex].dataset[attribute] || '';
            var difference = compareValues(left, right, kind, currentDirection);
            return difference || Number(leftRow.dataset.originalIndex) - Number(rightRow.dataset.originalIndex);
        });
    }

    rows.forEach(function(row) {
        body.appendChild(row);
    });

    // Aggiorna indicatori su tutti i bottoni
    table.querySelectorAll('.history-sort').forEach(function(otherButton) {
        var otherKey = otherButton.dataset.sortKey;
        var isActive = otherKey === currentKey && currentKey !== '';

        var indicator;
        if (isActive) {
            indicator = currentDirection === 1 ? '↑' : '↓';
        } else {
            indicator = '↕';
        }

        otherButton.setAttribute('aria-pressed', String(isActive));
        otherButton.querySelector('span').textContent = indicator;

        var th = otherButton.closest('th');
        if (th) {
            th.setAttribute('aria-sort', isActive
                ? (currentDirection === 1 ? 'ascending' : 'descending')
                : 'none');
        }
    });
});
    });
})();