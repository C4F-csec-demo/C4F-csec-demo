// Used by every page in the challenges folder
//
// Each challenge page has <body data-challenge="caesar"> (its id) and a
// <form id="flag"> where the answer box goes.
//
// Two ways a challenge page can be opened:
//   Normal (practice):  the answer box is shown and checked on the server.
//   Inside a Live CTF:  the page is opened with ?mode=ctf. The header and
//                       answer box are hidden, because the Live CTF screen
//                       has its own answer box and timer.

import { sb, callDb } from '../js/supabase.js';
import { $, showMessage } from '../js/ui.js';

const challengeId = document.body.dataset.challenge;
const insideLiveCtf = new URLSearchParams(location.search).get('mode') === 'ctf';

function showAnswerBox() {
    const form = $('#flag');
    form.innerHTML =
        '<label>Your answer<input name="answer" autocomplete="off" required></label>' +
        '<button>Check answer</button><p id="result" class="msg"></p>';

    form.onsubmit = async function (event) {
        event.preventDefault();
        const result = $('#result');
        try {
            const correct = await callDb('check_answer', { challenge_slug: challengeId, answer_text: form.elements.answer.value });
            if (correct) {
                showMessage(result, 'Correct! You got in.');
            } else {
                showMessage(result, 'Not quite. Have another look and try again.', true);
            }
        } catch (err) {
            showMessage(result, err.message, true);
        }
    };
}

function showLogInFirst() {
    $('#flag').innerHTML =
        '<p><b>Want to check your answer?</b></p>' +
        '<p><a href="../index.html">Log in</a> first, then come back to this page.</p>';
}

async function main() {
    if (insideLiveCtf) {
        document.body.classList.add('in-live-ctf');
        return;
    }
    const session = (await sb.auth.getSession()).data.session;
    if (session) {
        showAnswerBox();
    } else {
        showLogInFirst();
    }
}

main();
