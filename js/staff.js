// Staff Only (challenges/staff.html)
//
// The form carries a hidden "role" box that says "student". The Submit button
// is disabled. The student has to fix both: turn the button back on, and change
// the hidden role to "staff".
//
// Both checks happen here, in the browser, which is exactly the point of the
// lesson. The page says which of the two is still wrong, so a student is never
// stuck guessing.

import { $, showMessage } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [123, 116, 114, 112, 122, 121, 115, 122, 119, 112];
const SHIFT = 11;

function main() {
    const form = $('#signin');
    const button = $('#signin-button');
    const message = $('#form-msg');

    form.onsubmit = function (event) {
        event.preventDefault();

        if (button.disabled) {
            showMessage(message, 'The Submit button is still switched off.', true);
            return;
        }

        const role = form.elements.role.value.trim().toLowerCase();

        if (role !== 'staff') {
            showMessage(message, 'Students cannot use this form. (The form says you are a ' + role + '.)', true);
            return;
        }

        showSecret(SECRET, SHIFT);
    };
}

main();
