// The Canteen (challenges/canteen.html)
//
// Two jobs:
//   1. The teacher's demonstration in the 25 to 33 minute block. Turn the
//      disabled button back on, change the hidden price to 50 cents, and the
//      canteen takes the order without a second thought.
//   2. The extension challenge. A price can be a negative number, and the
//      canteen never checks. Make it owe you money and it hands over the word.
//
// Deliberately NOT the same page as Challenge 2 (challenges/staff.html), so the
// teacher can show both techniques without solving the students' challenge on
// the projector.

import { $ } from '../js/ui.js';
import { showSecret } from '../js/l5-secret.js';

const SECRET = [119, 110, 112, 120, 125, 124, 129];
const SHIFT = 13;
const REAL_PRICE = 5.5;

function money(amount) {
    return '$' + Math.abs(amount).toFixed(2);
}

function printReceipt(name, price) {
    const receipt = $('#receipt');
    const who = name === '' ? 'a student' : name;
    let line;

    if (price === REAL_PRICE) {
        line = 'Order placed for ' + who + '. You paid ' + money(price) + '. Nothing strange here.';
    } else {
        line = 'Order placed for ' + who + '. You paid ' + money(price) + ' for a ' + money(REAL_PRICE) + ' wrap. The canteen never checked what it actually costs.';
    }

    receipt.textContent = line;
    receipt.hidden = false;
}

function main() {
    const form = $('#order');
    const button = $('#order-button');
    const message = $('#order-msg');

    form.onsubmit = function (event) {
        event.preventDefault();

        if (button.disabled) {
            showMessageClosed(message);
            return;
        }

        const price = Number(form.elements.price.value);

        if (Number.isNaN(price)) {
            message.textContent = 'The till could not read that price.';
            message.className = 'msg bad';
            return;
        }

        message.textContent = '';
        message.className = 'msg';

        if (price < 0) {
            showSecret(SECRET, SHIFT);
            return;
        }

        printReceipt(form.elements.name.value.trim(), price);
    };
}

function showMessageClosed(message) {
    message.textContent = 'Orders are closed. The button is switched off.';
    message.className = 'msg bad';
}

main();
