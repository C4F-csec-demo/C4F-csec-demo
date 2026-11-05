// Beanbag Juice Bar loyalty card (challenges/loyalty.html)
//
// Two jobs:
//   1. The teacher's demonstration in the 43 to 50 minute block. The stamp
//      count lives in a cookie. Edit it in DevTools, reload, and the card
//      changes. Nothing on the juice bar's side moved.
//   2. The extension challenge. The Buy button refuses to go past 9 stamps, so
//      the card can never fill up by pressing it. The cookie has no such rule.
//
// Deliberately NOT the same page as Challenge 3 (challenges/members.html), so
// the teacher can show the cookie trick without solving it for the students.

import { $ } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [106, 119, 124, 124, 119, 117, 116, 109, 123, 123];
const SHIFT = 8;
const COOKIE_NAME = 'stamps';
const GOAL = 10;
const BUTTON_LIMIT = 9;

function readCookie(name) {
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
        const pair = parts[i].trim();
        if (pair.indexOf(name + '=') === 0) {
            return decodeURIComponent(pair.slice(name.length + 1));
        }
    }
    return null;
}

function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=86400; samesite=lax';
}

function currentStamps() {
    const raw = readCookie(COOKIE_NAME);
    if (raw === null) {
        writeCookie(COOKIE_NAME, '2');
        return 2;
    }
    const n = Math.floor(Number(raw));
    if (Number.isNaN(n) || n < 0) {
        return 0;
    }
    return n;
}

function draw(stamps) {
    $('#count').textContent = String(stamps);

    const row = $('#stamps');
    row.innerHTML = '';
    const shown = Math.min(stamps, GOAL);
    for (let i = 1; i <= GOAL; i++) {
        const dot = document.createElement('div');
        dot.className = i <= shown ? 'stamp filled' : 'stamp';
        dot.textContent = i <= shown ? '✓' : String(i);
        row.appendChild(dot);
    }

    const note = $('#card-note');
    if (stamps >= GOAL) {
        note.textContent = 'Card full. Your free smoothie is waiting.';
    } else if (stamps >= BUTTON_LIMIT) {
        note.textContent = 'So close! Come back tomorrow for your tenth.';
    } else {
        note.textContent = 'Buy another smoothie to earn a stamp.';
    }

    $('#claim').hidden = stamps < GOAL;
}

function main() {
    let stamps = currentStamps();
    draw(stamps);

    $('#buy').onclick = function () {
        if (stamps >= BUTTON_LIMIT) {
            draw(stamps);
            return;
        }
        stamps = stamps + 1;
        writeCookie(COOKIE_NAME, String(stamps));
        draw(stamps);
    };

    $('#claim').onclick = function () {
        showSecret(SECRET, SHIFT);
    };
}

main();
