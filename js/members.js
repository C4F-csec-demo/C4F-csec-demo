// Remember Me (challenges/members.html)
//
// The page gives the browser a cookie called "member" set to "no". On every
// load it reads that cookie back and decides whether to let the student in.
// The student edits the cookie in DevTools (Application > Cookies) and reloads.
//
// The cookie is deliberately NOT HttpOnly, because the student has to be able
// to edit it. That is the one place on this site where leaving it off is right.

import { $ } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [103, 102, 104, 112, 120, 121, 102, 108, 106];
const SHIFT = 5;
const COOKIE_NAME = 'member';

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

function main() {
    let band = readCookie(COOKIE_NAME);

    if (band === null) {
        writeCookie(COOKIE_NAME, 'no');
        band = readCookie(COOKIE_NAME);
    }

    if (band === null) {
        $('#band-value').textContent = 'nothing';
        $('#cookie-warning').hidden = false;
        return;
    }

    $('#band-value').textContent = band;

    if (band.trim().toLowerCase() === 'yes') {
        showSecret(SECRET, SHIFT);
    }
}

main();
