// The Locker Room (challenges/locker.html)
//
// Two jobs:
//   1. The teacher's demonstration in Lesson 5. Load it with ?id=3, then change
//      the 3 to a 4 in the address bar and the page shows a different locker.
//      Nobody clicked anything.
//   2. The extension challenge. The school says it has lockers 1 to 20, and the
//      dropdown only offers those, but the page will hand over any number you
//      ask for. Locker 999 is the staff one, and it has the secret word in it.

import { $ } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [125, 123, 120, 118, 107, 120, 119, 110];
const SHIFT = 9;
const STAFF_LOCKER = '999';

const ITEMS = [
    'a maths textbook', 'one soccer boot', 'a drink bottle, no lid', 'a pair of gym socks',
    'three half-eaten muesli bars', 'a recorder', 'someone’s retainer (gross)', 'a hoodie, size 14',
    'a calculator with no batteries', 'a skipping rope', 'a library book, 2 years overdue',
    'an umbrella', 'a lunchbox nobody has opened', 'a tennis racquet', 'one glove',
    'a phone charger', 'a jumper with no name on it', 'a bike helmet', 'a scarf', 'a ruler, snapped'
];

function showLocker(number, item, owner, isStaff) {
    const box = $('#locker');
    box.className = isStaff ? 'locker staff' : 'locker';
    box.innerHTML = '';

    const numberLine = document.createElement('p');
    numberLine.className = 'locker-number';
    numberLine.textContent = 'LOCKER ' + number;

    const itemLine = document.createElement('p');
    itemLine.className = 'locker-item';
    itemLine.textContent = item;

    const ownerLine = document.createElement('p');
    ownerLine.className = 'locker-owner';
    ownerLine.textContent = owner;

    box.appendChild(numberLine);
    box.appendChild(itemLine);
    box.appendChild(ownerLine);
}

function fillDropdown(current) {
    const pick = $('#pick');
    for (let n = 1; n <= ITEMS.length; n++) {
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = 'Locker ' + n;
        if (String(n) === current) {
            option.selected = true;
        }
        pick.appendChild(option);
    }
    pick.onchange = function () {
        if (pick.value !== '') {
            location.search = '?id=' + pick.value;
        }
    };
}

function main() {
    const params = new URLSearchParams(location.search);
    let id = params.get('id');

    if (id === null) {
        id = '1';
        params.set('id', id);
        history.replaceState(null, '', location.pathname + '?' + params.toString());
    }

    id = id.trim();
    fillDropdown(id);

    const asNumber = Number(id);

    if (id === STAFF_LOCKER) {
        showLocker(id, 'a confiscated trombone', 'Staff locker. Not on the school’s list.', true);
        showSecret(SECRET, SHIFT);
        return;
    }

    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= ITEMS.length) {
        showLocker(id, ITEMS[asNumber - 1], 'Handed in to the office', false);
        return;
    }

    showLocker(id, 'Empty', 'No locker with that number.', false);
}

main();
