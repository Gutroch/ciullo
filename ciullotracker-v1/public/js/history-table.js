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

            if (currentKey === key) {
                currentDirection *= -1;
            } else {
                currentKey = key;
                currentDirection = 1;
            }

            rows.sort(function(leftRow, rightRow) {
                var left = leftRow.cells[heading.cellIndex].dataset[attribute] || '';
                var right = rightRow.cells[heading.cellIndex].dataset[attribute] || '';
                var difference = compareValues(left, right, kind, currentDirection);
                return difference || Number(leftRow.dataset.originalIndex) - Number(rightRow.dataset.originalIndex);
            });

            rows.forEach(function(row) {
                body.appendChild(row);
            });

            table.querySelectorAll('.history-sort').forEach(function(otherButton) {
                var active = otherButton === button;
                otherButton.setAttribute('aria-pressed', String(active));
                otherButton.querySelector('span').textContent = active
                    ? (currentDirection === 1 ? '↑' : '↓')
                    : '↕';
                otherButton.closest('th').setAttribute('aria-sort', active
                    ? (currentDirection === 1 ? 'ascending' : 'descending')
                    : 'none');
            });
        });
    });
})();