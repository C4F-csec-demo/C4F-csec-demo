// The student's Live CTF screen (ctf-play.html?id=5)
//
// Every 2.5 seconds it asks the database for the latest state of the game
// (ctf_player_state) and updates the screen. The screen changes with the game:
//   lobby    - "You're in!", picking a team, naming your team
//   running  - your score and place, the current challenge, the answer box
//   finished - your final place and the top 5
//
// When your team solves a challenge (you, or a teammate), a pop-up shows your
// points, your place, and how far behind the next team you are

import { callDb, whoami } from './supabase.js';
import { $, esc, ordinal, formatClock, teamTag, textColourFor, onAction, onForm, repeat, runSafely } from './ui.js';
import { syncClock, startClocks, updateClocks } from './ctf-clock.js';

const app = $('#app');
const popup = $('#popup');

let ctfId = Number(new URLSearchParams(location.search).get('id'));
let state = null;          // the latest data from the database
let lastDrawn = '';        // what we last drew, so we only redraw when something changes
let currentView = '';      // which screen is showing ('lobby', 'running', ...)
let seenSolves = null;     // challenge positions we've already shown a pop-up for
let seenTeamId = null;

// Lobby

function teamPicker() {
    const game = state.game;
    const myTeamId = state.team ? state.team.id : null;
    return '<h2>Pick your team</h2><div class="team-grid">' + state.teams.map(function (team) {
        const full = game.team_size && team.members.length >= game.team_size && team.id !== myTeamId;
        let button = '<button class="small" data-action="pick-team" data-team="' + team.id + '">Join this team</button>';
        if (team.id === myTeamId) {
            button = '<span class="pill green">Your team</span>';
        } else if (full) {
            button = '<span class="pill">Full</span>';
        }
        return '<div class="team-card' + (team.id === myTeamId ? ' mine' : '') + '" style="border-color:' + esc(team.colour) + '">' +
            '<div class="team-head" style="background:' + esc(team.colour) + ';color:' + textColourFor(team.colour) + '"><b>' + esc(team.name) + '</b></div>' +
            '<ul class="player-list">' + team.members.map(function (name) { return '<li>' + esc(name) + '</li>'; }).join('') + '</ul>' +
            '<p>' + button + '</p></div>';
    }).join('') + '</div>';
}

function teamNamer() {
    const team = state.team;
    const takenByOthers = state.teams
        .filter(function (t) { return t.id !== team.id; })
        .map(function (t) { return t.colour; });
    const swatches = state.colours.map(function (colour) {
        const taken = takenByOthers.indexOf(colour) >= 0;
        return '<label class="swatch' + (taken ? ' taken' : '') + '" style="background:' + colour + '" title="' + (taken ? 'Another team has this colour' : 'Pick this colour') + '">' +
            '<input type="radio" name="colour" value="' + colour + '"' + (colour === team.colour ? ' checked' : '') + (taken ? ' disabled' : '') + '></label>';
    }).join('');
    return '<section class="card"><h2>Name your team</h2>' +
        '<form data-form="name-team">' +
        '<label>Team name<input name="name" maxlength="20" value="' + esc(team.name) + '" required></label>' +
        '<p><b>Team colour</b></p><div class="swatches">' + swatches + '</div>' +
        '<button>Save</button> <span class="hint">Keep it friendly! Your teacher can change it.</span></form></section>';
}

function lobbyView() {
    const game = state.game;
    let html = '<section class="card center waiting-card"><div class="big-emoji">&#127881;</div>' +
        '<h1>You\'re in!</h1><p>Waiting for your teacher to press START<span class="dots"></span></p></section>';

    if (!game.use_teams) {
        html += '<section class="card center"><p>You\'re playing on your own as ' + teamTag(state.team.name, null) + '</p></section>';
    } else if (game.team_sorting === 'pick') {
        html += teamPicker();
    } else {
        html += '<section class="card center"><p>Your teacher is putting everyone into teams.</p>' +
            (state.team ? '<p>You\'re in ' + teamTag(state.team.name, state.team.colour) + '</p>' : '') + '</section>';
    }

    if (game.use_teams && game.students_name_teams && state.team) {
        html += teamNamer();
    }
    html += '<p class="hint center">How it works: solve each challenge and type the flag. The faster you solve a challenge, the more points you get (up to 1000).</p>';
    return html;
}

// Running

// The running screen is built once, then only its parts are updated, so the
// challenge (in the frame) and your typed answer don't get wiped every few seconds
function buildRunningScreen() {
    app.innerHTML =
        '<div id="status-bar" class="status-bar"></div>' +
        '<div id="progress" class="progress"></div>' +
        '<div id="challenge-head" class="challenge-head"></div>' +
        '<div id="waiting" hidden></div>' +
        '<div id="answer-zone">' +
        '<form data-form="answer" class="answer-bar">' +
        '<input name="answer" placeholder="Type the flag here" autocomplete="off" aria-label="Your answer" required>' +
        '<button class="pink">Submit</button>' +
        '<button type="button" class="alt" data-action="skip" id="skip-button">Skip (0 points)</button>' +
        '</form>' +
        '<p id="answer-msg" class="msg"></p>' +
        '<iframe id="challenge-frame" class="challenge-frame" title="The challenge"></iframe>' +
        '<p class="hint small-print"><a id="new-tab-link" target="_blank" rel="noopener">Open the challenge in a new tab</a>, then come back here to type your answer.</p>' +
        '</div>';
}

function statusBar() {
    const game = state.game;
    const team = state.team;
    const timer = game.ends_at
        ? 'Time left <b data-until="' + esc(game.ends_at) + '"></b>'
        : 'Time <b data-since="' + esc(game.started_at) + '"></b>';
    return teamTag(team.name, team.colour) +
        '<span>Score <b>' + team.points.toLocaleString() + '</b></span>' +
        '<span>Place <b>' + (team.place ? ordinal(team.place) : '-') + '</b> of ' + team.team_count + '</span>' +
        '<span>' + timer + '</span>';
}

function progressDots() {
    const team = state.team;
    return state.challenges.map(function (ch) {
        const solve = team.solves.find(function (s) { return s.position === ch.position; });
        let className = 'dot upcoming';
        let label = String(ch.position);
        if (solve && solve.skipped) {
            className = 'dot skipped';
            label = '&ndash;';
        } else if (solve) {
            className = 'dot done';
            label = '&#10003;';
        } else if (ch.position === team.position) {
            className = 'dot current';
        }
        return '<span class="' + className + '" title="' + esc(ch.title) + '">' + label + '</span>';
    }).join('');
}

function updateRunningScreen() {
    const game = state.game;
    const team = state.team;
    const total = state.challenges.length;
    const current = state.challenges.find(function (ch) { return ch.position === team.position; });
    const solvedCurrent = team.solves.some(function (s) { return s.position === team.position; });

    $('#status-bar').innerHTML = statusBar();
    $('#progress').innerHTML = progressDots();

    // Finished everything, or waiting for the teacher to move on.
    let waitingMessage = '';
    if (!current) {
        waitingMessage = '<div class="big-emoji">&#127937;</div><h2>You\'ve finished every challenge!</h2>' +
            '<p>Great work. Wait for your teacher to end the CTF.</p>';
    } else if (game.pacing === 'teacher' && solvedCurrent) {
        waitingMessage = '<div class="big-emoji">&#9989;</div><h2>Solved!</h2>' +
            '<p>Waiting for your teacher to start the next challenge<span class="dots"></span></p>';
    }

    const waiting = $('#waiting');
    waiting.hidden = !waitingMessage;
    waiting.className = 'card center waiting-card';
    waiting.innerHTML = waitingMessage;
    $('#answer-zone').hidden = Boolean(waitingMessage);

    if (waitingMessage) {
        $('#challenge-head').innerHTML = '';
        return;
    }

    $('#challenge-head').innerHTML =
        '<h2>Challenge ' + current.position + ' of ' + total + ': ' + esc(current.title) + '</h2>' +
        '<span class="ch-timer">This challenge <b data-since="' + esc(team.clock_start) + '"></b></span>';
    $('#skip-button').hidden = game.pacing !== 'self';

    // Load the challenge into the frame, but only when it changes.
    const frame = $('#challenge-frame');
    const url = 'challenges/' + current.slug + '.html?mode=ctf';
    if (frame.dataset.url !== url) {
        frame.dataset.url = url;
        frame.src = url;
        $('#new-tab-link').href = url;
        $('#answer-msg').textContent = '';
        document.querySelector('[data-form="answer"]').reset();
    }
}

// Finished

function finishedView() {
    const team = state.team;
    let mine = '<p>You didn\'t get onto the leaderboard this time.</p>';
    if (team && team.place) {
        mine = '<p class="final-place">' + ordinal(team.place) + '</p><p>' + teamTag(team.name, team.colour) +
            ' finished with <b>' + team.points.toLocaleString() + '</b> points</p>';
    }
    const top = (state.top || []).map(function (row) {
        return '<div class="lb-row"><span class="lb-place">' + ordinal(row.place) + '</span>' +
            '<span class="lb-swatch" style="background:' + esc(row.colour || 'transparent') + '"></span>' +
            '<span class="lb-name">' + esc(row.name) + '</span><span class="lb-points">' + row.points.toLocaleString() + '</span></div>';
    }).join('');
    return '<section class="card center waiting-card"><div class="big-emoji">&#127937;</div><h1>The CTF is over!</h1>' + mine + '</section>' +
        (top ? '<h2>Top 5</h2><div class="leaderboard">' + top + '</div>' : '') +
        '<p class="center"><a class="button" href="student.html">Back to my lessons</a></p>';
}

// The "you solved it" pop-up

function confetti() {
    const colours = ['#12b5b0', '#ec4b8b', '#ffc82e', '#4363d8', '#3cb44b'];
    let html = '';
    for (let i = 0; i < 40; i++) {
        html += '<span class="confetti" style="left:' + Math.random() * 100 + '%;background:' + colours[i % colours.length] +
            ';animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's"></span>';
    }
    return html;
}

function showSolvedPopup(solve) {
    const team = state.team;
    const who = state.game.use_teams ? 'Your team is' : 'You\'re';
    const heading = solve.by_me || !state.game.use_teams
        ? 'Good work, you completed the challenge!'
        : esc(solve.solved_by) + ' solved it for your team!';

    let chase = '<p class="popup-chase">You\'re in the lead! &#127942;</p>';
    if (team.place > 1 && team.ahead_name && team.ahead_by > 0) {
        chase = '<p class="popup-chase"><b>' + team.ahead_by.toLocaleString() + ' points</b> behind ' + teamTag(team.ahead_name, team.ahead_colour) + '</p>';
    } else if (team.place > 1 && team.ahead_name) {
        chase = '<p class="popup-chase">Same points as ' + teamTag(team.ahead_name, team.ahead_colour) + ', but they got there first!</p>';
    } else if (team.place > 1) {
        chase = '<p class="popup-chase">So close to the top!</p>';
    }

    const button = state.game.pacing === 'self' && team.position <= state.challenges.length ? 'Next challenge' : 'OK';
    popup.innerHTML = '<div class="popup-backdrop">' + confetti() + '<div class="popup-box">' +
        '<div class="popup-tick">&#10003;</div>' +
        '<h2>' + heading + '</h2>' +
        '<p class="popup-points">+' + solve.points + ' points</p>' +
        '<p class="hint">Solved in ' + formatClock(solve.seconds) + ' &middot; Total score ' + team.points.toLocaleString() + '</p>' +
        '<p class="popup-place">' + who + ' in <b>' + ordinal(team.place) + '</b> place</p>' +
        chase +
        '<button class="pink big" data-action="close-popup">' + button + '</button>' +
        '</div></div>';
    popup.querySelector('button').focus();
}

// Shows the pop-up for any solve we haven't seen yet (including a teammate's).
function checkForNewSolves() {
    if (!state.team) {
        return;
    }
    if (seenSolves === null || seenTeamId !== state.team.id) {
        // First load (or moved team): don't pop up for old solves.
        seenTeamId = state.team.id;
        seenSolves = state.team.solves.map(function (s) { return s.position; });
        return;
    }
    state.team.solves.forEach(function (solve) {
        if (seenSolves.indexOf(solve.position) >= 0) {
            return;
        }
        seenSolves.push(solve.position);
        if (!solve.skipped) {
            showSolvedPopup(solve);
        }
    });
}

// Drawing

function whichView() {
    if (!state.joined) {
        return 'not-joined';
    }
    if (state.game.status === 'finished') {
        return 'finished';
    }
    if (state.game.status === 'lobby') {
        return 'lobby';
    }
    return state.team ? 'running' : 'no-team';
}

function draw() {
    const view = whichView();
    $('#ctf-title').textContent = state.game.title;

    if (view === 'running') {
        if (currentView !== 'running') {
            buildRunningScreen();
        }
        updateRunningScreen();
    } else if (view === 'lobby') {
        app.innerHTML = lobbyView();
    } else if (view === 'finished') {
        app.innerHTML = finishedView();
    } else if (view === 'no-team') {
        app.innerHTML = '<section class="card center"><h2>Almost ready</h2><p>Your teacher is putting you in a team<span class="dots"></span></p></section>';
    } else {
        app.innerHTML = '<section class="card center"><h2>You\'re not in this game</h2>' +
            '<p>Your teacher may have taken you out. Ask them, or join again.</p>' +
            '<button class="pink" data-action="join">Join the Live CTF</button></section>';
    }
    currentView = view;
    updateClocks();
}

function isTyping() {
    const el = document.activeElement;
    return el && app.contains(el) && (el.tagName === 'INPUT' || el.tagName === 'SELECT');
}

async function refresh() {
    const newState = await callDb('ctf_player_state', { ctf: ctfId });
    syncClock(newState.now);
    newState.now = null;
    state = newState;
    checkForNewSolves();

    const snapshot = JSON.stringify(newState);
    if (snapshot === lastDrawn) {
        return;
    }
    // In the lobby, wait until the student has finished typing (e.g. their team
    // name) before redrawing. Moving to a different screen always happens straight away
    // (the running screen only updates its parts, so typing there is safe)
    if (isTyping() && currentView === 'lobby' && whichView() === 'lobby') {
        return;
    }
    lastDrawn = snapshot;
    draw();
}

async function refreshNow() {
    lastDrawn = '';
    await refresh();
}

// Buttons and forms

const actions = {
    'join': async function () {
        await callDb('ctf_join', { ctf: ctfId });
        await refreshNow();
    },
    'pick-team': async function (data) {
        await callDb('ctf_pick_team', { ctf: ctfId, team: Number(data.team) });
        await refreshNow();
    },
    'skip': async function () {
        if (!confirm('Skip this challenge? You\'ll get 0 points for it and can\'t come back to it.')) {
            return;
        }
        await callDb('ctf_skip', { ctf: ctfId });
        await refreshNow();
    },
    'close-popup': function () {
        popup.innerHTML = '';
        const answerBox = document.querySelector('[data-form="answer"] input');
        if (answerBox && !$('#answer-zone').hidden) {
            answerBox.focus();
        }
    }
};

const forms = {
    'answer': async function (form) {
        const message = $('#answer-msg');
        const box = form.elements.answer;
        const result = await callDb('ctf_submit', { ctf: ctfId, answer_text: box.value });
        if (result === 'wrong') {
            message.textContent = 'Not quite. Have another look and try again.';
            message.className = 'msg bad';
            form.classList.remove('shake');
            void form.offsetWidth;
            form.classList.add('shake');
            box.select();
            return;
        }
        if (result === 'already') {
            message.textContent = 'Your team already solved this one!';
            message.className = 'msg good';
        }
        box.value = '';
        box.blur();
        await refreshNow();
    },
    'name-team': async function (form) {
        const picked = form.querySelector('input[name="colour"]:checked');
        await callDb('ctf_edit_team', {
            team: state.team.id,
            new_name: form.elements.name.value,
            new_colour: picked ? picked.value : null
        });
        document.activeElement.blur();
        await refreshNow();
    }
};

async function main() {
    const me = await whoami();
    if (!me || me.role !== 'student') {
        app.innerHTML = '<section class="card center"><h2>Students only</h2><p>Log in as a student to join a Live CTF.</p>' +
            '<a class="button" href="index.html">Go to the student login</a></section>';
        return;
    }
    if (!ctfId) {
        const open = await callDb('my_open_ctf');
        if (!open) {
            app.innerHTML = '<section class="card center"><h2>No Live CTF right now</h2><p>Your teacher hasn\'t opened one yet.</p>' +
                '<a class="button" href="student.html">Back to my lessons</a></section>';
            return;
        }
        ctfId = open.id;
    }

    onAction(app, actions);
    onAction(popup, actions);
    onForm(app, forms);
    startClocks();

    await runSafely(async function () {
        try {
            await callDb('ctf_join', { ctf: ctfId });
        } catch (err) {
            // Joining fails once the game has finished. That's fine, we still show the results
            console.log(err.message);
        }
        try {
            await refresh();
        } catch (err) {
            app.innerHTML = '<section class="card center"><h2>Can\'t open this Live CTF</h2><p>' + esc(err.message) + '</p>' +
                '<a class="button" href="student.html">Back to my lessons</a></section>';
            throw err;
        }
        // Keep the screen up to date. If one check fails, it tries again next time
        repeat(refresh, 2500);
    });
}

main();
