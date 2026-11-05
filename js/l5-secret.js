// Shared by the three Lesson 5 challenge pages (door, staff, members).
//
// Each page has a secret word that it shows once the student gets past the
// check. The word is stored as a list of numbers instead of plain text, so a
// student who scrolls through this file does not read the answer by accident.
//
// This is NOT real security. Anyone who can read JavaScript can work the word
// out from the numbers. That is fine: it takes more effort than solving the
// challenge, and the whole point of Lesson 5 is that a check done in the
// browser can always be got around. The flag itself is still checked by the
// server when the student types it into the answer box.

import { $ } from '../js/ui.js';

// Turns a list of numbers back into the word
export function unscramble(codes, shift) {
    return codes.map(function (code) {
        return String.fromCharCode(code - shift);
    }).join('');
}

// Shows the secret word in the yellow box, and hides the "locked" part of the page
export function showSecret(codes, shift) {
    const locked = $('#locked');
    const unlocked = $('#unlocked');
    const word = $('#secret-word');
    if (locked) {
        locked.hidden = true;
    }
    if (unlocked) {
        unlocked.hidden = false;
    }
    if (word) {
        word.textContent = unscramble(codes, shift);
    }
}
