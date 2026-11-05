// Open Sesame (challenges/door.html)
//
// The door looks at the "key" instruction in the web address. If it says
// "open", the door opens. Anything else, and it stays shut.
//
// If the page is opened with no key at all, we put ?key=closed into the
// address bar so the student can see the instruction they need to change.

import { $ } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [124, 117, 115, 104, 123, 106, 111, 108, 107];
const SHIFT = 7;

function openTheDoor() {
    $('#door-emoji').textContent = '\u{1F6AA}\u{2728}';
    $('#door-status').textContent = 'The door is OPEN';
    $('#door-status').className = 'door-status open';
    showSecret(SECRET, SHIFT);
}

function keepItShut(key) {
    $('#door-status').textContent = 'The door is SHUT';
    $('#door-status').className = 'door-status shut';
    $('#key-shown').textContent = key;
}

function main() {
    const params = new URLSearchParams(location.search);
    let key = params.get('key');

    if (key === null) {
        key = 'closed';
        params.set('key', key);
        history.replaceState(null, '', location.pathname + '?' + params.toString());
    }

    if (key.trim().toLowerCase() === 'open') {
        openTheDoor();
    } else {
        keepItShut(key);
    }
}

main();
