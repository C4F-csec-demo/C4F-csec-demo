// The teacher's big screen for a Live CTF (ctf-host.html?id=5)
//
// Every 2 seconds it asks the database for the latest state of the game
// (ctf_host_state) and redraws the screen if anything changed
// The screen looks different for each stage of the game:
//   lobby    - students joining, teams being sorted, START button
//   running  - timer, a box per challenge (fastest solve), live leaderboard
//   finished - final results

import { sb, callDb, must } from './supabase.js';
import { $, esc, tip, ordinal, formatClock, teamTag, textColourFor, onAction, onChange, onForm, repeat, runSafely } from './ui.js';
import { syncClock, startClocks, updateClocks } from './ctf-clock.js';

const ctfId = Number(new URLSearchParams(location.search).get('id'));
const app = $('#app');
const modal = $('#modal');

let state = null;          // the latest data from the database
let lastDrawn = '';        // what we last drew, so we only redraw when something changes
let editingTeamId = null;  // the team being edited in the pop-up, if any

// Small pieces

function settingsSummary(game) {
    const parts = [];
    parts.push(game.pacing === 'self' ? 'Self-paced' : 'Teacher-paced');
    parts.push(game.time_limit ? game.time_limit + ' minute time limit' : 'No time limit');
    if (game.use_teams) {
        let teams = 'Teams';
        if (game.team_size) {
            teams += ' of up to ' + game.team_size;
        }
        teams += game.team_sorting === 'pick' ? ', students pick' : ', random';
        teams += game.students_name_teams ? ', students name their team' : '';
        parts.push(teams);
    } else {
        parts.push('Everyone plays on their own');
    }
    return parts.join(' &middot; ');
}

function medal(place) {
    const medals = { 1: '&#129351;', 2: '&#129352;', 3: '&#129353;' };
    return medals[place] || ordinal(place);
}

// The menu for moving a player to another team
function moveMenu(player, teams, currentTeamId) {
    const options = teams.map(function (team) {
        return '<option value="' + team.id + '"' + (team.id === currentTeamId ? ' selected' : '') + '>' + esc(team.name) + '</option>';
    }).join('');
    return '<select class="mini" data-change="move-player" data-player="' + player.id + '" aria-label="Move ' + esc(player.name) + '">' +
        '<option value=""' + (currentTeamId ? '' : ' selected') + '>No team</option>' + options + '</select>';
}

function playerRow(player, teams, teamId) {
    return '<li><span>' + esc(player.name) + '</span><span>' +
        (state.game.use_teams ? moveMenu(player, teams, teamId) : '') +
        ' <button class="chip-x" data-action="remove-player" data-player="' + player.id + '" data-name="' + esc(player.name) + '" title="Remove from this game" aria-label="Remove">&times;</button>' +
        '</span></li>';
}

// Lobby

function lobbyView() {
    const game = state.game;
    const studentPage = new URL('.', location.href).href;
    let html =
        '<div class="lobby-head">' +
        '<h1>' + esc(game.title) + '</h1>' +
        '<p class="join-instructions">Students: log in at <b>' + esc(studentPage) + '</b><br>and click the pink <b>Join the Live CTF</b> button.</p>' +
        '<p class="hint">' + settingsSummary(game) + '</p>' +
        '</div>' +
        '<div class="row space-between lobby-bar">' +
        '<div class="player-count"><b>' + state.player_count + '</b> joined</div>' +
        '<div class="row">' +
        (game.use_teams ? '<button class="alt" data-action="shuffle">Shuffle teams ' + tip('Puts every player into a random team, spread out evenly.') + '</button>' +
            '<button class="alt" data-action="add-team">+ Add team</button>' : '') +
        '<button class="alt danger" data-action="cancel">Cancel CTF</button>' +
        '<button class="pink big" data-action="start">START</button>' +
        '</div></div>';

    if (!game.use_teams) {
        const everyone = state.teams.map(function (team) { return team.players[0]; }).filter(Boolean);
        html += '<section class="card"><h2>Players</h2>' +
            (everyone.length
                ? '<ul class="player-list">' + everyone.map(function (p) { return playerRow(p, [], null); }).join('') + '</ul>'
                : '<p class="hint">Waiting for students to join...</p>') + '</section>';
        return html;
    }

    html += '<div class="team-grid">' + state.teams.map(function (team) {
        const sizeNote = game.team_size ? team.players.length + ' / ' + game.team_size : team.players.length + ' players';
        return '<div class="team-card" style="border-color:' + esc(team.colour) + '">' +
            '<div class="team-head" style="background:' + esc(team.colour) + ';color:' + textColourFor(team.colour) + '">' +
            '<b>' + esc(team.name) + '</b><span>' +
            '<button class="chip-x" data-action="edit-team" data-team="' + team.id + '" title="Rename or change colour" aria-label="Edit team">&#9998;</button>' +
            '<button class="chip-x" data-action="delete-team" data-team="' + team.id + '" data-name="' + esc(team.name) + '" title="Delete team" aria-label="Delete team">&times;</button>' +
            '</span></div>' +
            '<ul class="player-list">' + team.players.map(function (p) { return playerRow(p, state.teams, team.id); }).join('') + '</ul>' +
            '<p class="hint small-print">' + sizeNote + '</p></div>';
    }).join('') + '</div>';

    if (state.unassigned.length) {
        html += '<section class="card"><h2>Not in a team yet ' +
            tip('When you press START, anyone not in a team goes into the smallest team.') + '</h2>' +
            '<ul class="player-list">' + state.unassigned.map(function (p) { return playerRow(p, state.teams, null); }).join('') + '</ul></section>';
    }
    return html;
}

// Running and finished

function challengeBoxes() {
    const game = state.game;
    return '<div class="challenge-boxes">' + state.challenges.map(function (ch) {
        let classes = 'ch-box';
        let extra = '';
        if (game.pacing === 'teacher' && game.status === 'running') {
            if (ch.position === game.current_position) {
                classes += ' current';
                extra = '<div class="ch-clock" data-since="' + esc(game.position_started_at) + '"></div>';
            } else if (ch.position > game.current_position) {
                classes += ' upcoming';
            }
        }
        const fastest = ch.fastest
            ? '<div class="fastest"><span class="hint">Fastest</span><br>' + teamTag(ch.fastest.name, ch.fastest.colour) +
              ' <b>' + formatClock(ch.fastest.seconds) + '</b></div>'
            : '<div class="fastest hint">Not solved yet</div>';
        return '<div class="' + classes + '"><div class="ch-num">' + ch.position + '</div>' +
            '<div class="ch-title">' + esc(ch.title) + '</div>' + extra + fastest +
            '<div class="hint small-print">Solved by ' + ch.solved_count + '</div></div>';
    }).join('') + '</div>';
}

function leaderboard() {
    const game = state.game;
    const total = state.challenges.length;
    if (!state.leaderboard.length) {
        return '<section class="card"><p class="hint">Nobody on the leaderboard yet.</p></section>';
    }
    return '<div class="leaderboard">' + state.leaderboard.map(function (row) {
        let progress = row.solved + ' solved';
        if (game.pacing === 'self' && game.status === 'running') {
            progress = row.position > total ? 'All done &#10003;' : 'On challenge ' + row.position + ' of ' + total;
        }
        return '<div class="lb-row' + (row.place <= 3 ? ' top' + row.place : '') + '" data-team="' + row.team_id + '">' +
            '<span class="lb-place">' + medal(row.place) + '</span>' +
            '<span class="lb-swatch" style="background:' + esc(row.colour || 'transparent') + '"></span>' +
            '<span class="lb-name">' + esc(row.name) + '</span>' +
            '<span class="lb-progress hint">' + progress + '</span>' +
            '<span class="lb-points" data-points="' + row.points + '">' + row.points.toLocaleString() + '</span></div>';
    }).join('') + '</div>';
}

function runningView() {
    const game = state.game;
    const isLast = game.current_position >= state.challenges.length;
    const timer = game.ends_at
        ? '<div class="big-timer"><span class="hint">Time left</span><span data-until="' + esc(game.ends_at) + '"></span></div>'
        : '<div class="big-timer"><span class="hint">Time</span><span data-since="' + esc(game.started_at) + '"></span></div>';
    let buttons = '';
    if (game.pacing === 'teacher') {
        buttons += isLast
            ? '<button class="pink" data-action="end">Finish</button>'
            : '<button class="pink" data-action="next">Next challenge &#9654;</button>';
    }
    buttons += '<button class="alt danger" data-action="end">End CTF</button>';

    return '<div class="ctf-top"><div><h1>' + esc(game.title) + '</h1><p class="hint">' + esc(state.class_name) + ' &middot; ' + settingsSummary(game) + '</p></div>' +
        timer + '<div class="row">' + buttons + '</div></div>' +
        challengeBoxes() + leaderboard();
}

function finishedView() {
    const game = state.game;
    const podium = state.leaderboard.slice(0, 3).map(function (row) {
        return '<div class="podium-step p' + row.place + '"><div class="podium-medal">' + medal(row.place) + '</div>' +
            teamTag(row.name, row.colour) + '<div class="podium-points">' + row.points.toLocaleString() + '</div></div>';
    }).join('');
    const length = game.started_at ? formatClock((new Date(game.finished_at) - new Date(game.started_at)) / 1000) : '';
    return '<div class="ctf-top"><div><h1>' + esc(game.title) + ': final results</h1>' +
        '<p class="hint">' + esc(state.class_name) + (length ? ' &middot; lasted ' + length : '') + '</p></div></div>' +
        (podium ? '<div class="podium">' + podium + '</div>' : '') +
        challengeBoxes() + leaderboard();
}

// Team editing pop-up

function showTeamEditor() {
    const team = state.teams.find(function (t) { return t.id === editingTeamId; });
    if (!team) {
        modal.innerHTML = '';
        return;
    }
    const swatches = state.colours.map(function (colour) {
        const owner = state.teams.find(function (t) { return t.colour === colour && t.id !== team.id; });
        return '<label class="swatch" style="background:' + colour + '" title="' + (owner ? 'Swap with ' + esc(owner.name) : 'Free') + '">' +
            '<input type="radio" name="colour" value="' + colour + '"' + (colour === team.colour ? ' checked' : '') + '>' +
            (owner ? '<span class="swatch-note" style="color:' + textColourFor(colour) + '">swap</span>' : '') + '</label>';
    }).join('');
    modal.innerHTML = '<div class="modal-backdrop"><form data-form="save-team" class="card modal-box">' +
        '<h2>Edit team</h2>' +
        '<label>Team name<input name="name" maxlength="20" value="' + esc(team.name) + '" required></label>' +
        '<p><b>Colour</b> ' + tip('If you pick a colour another team has, the two teams swap colours.') + '</p>' +
        '<div class="swatches">' + swatches + '</div>' +
        '<div class="row"><button>Save</button><button type="button" class="alt" data-action="close-editor">Cancel</button></div>' +
        '</form></div>';
}

// Drawing

// Remembers where each leaderboard row was, so rows can slide to their new place
function rowPositions() {
    const positions = {};
    document.querySelectorAll('.lb-row').forEach(function (row) {
        positions[row.dataset.team] = { top: row.getBoundingClientRect().top, points: row.querySelector('.lb-points').dataset.points };
    });
    return positions;
}

function slideRows(before) {
    document.querySelectorAll('.lb-row').forEach(function (row) {
        const old = before[row.dataset.team];
        if (!old) {
            return;
        }
        const moved = old.top - row.getBoundingClientRect().top;
        if (moved) {
            row.style.transition = 'none';
            row.style.transform = 'translateY(' + moved + 'px)';
            requestAnimationFrame(function () {
                row.style.transition = 'transform .6s ease';
                row.style.transform = '';
            });
        }
        if (old.points !== row.querySelector('.lb-points').dataset.points) {
            row.classList.add('bump');
        }
    });
}

function draw() {
    // Don't redraw while the teacher is using a dropdown
    if (document.activeElement && document.activeElement.tagName === 'SELECT' && app.contains(document.activeElement)) {
        return;
    }
    const before = rowPositions();
    const game = state.game;
    $('#back').href = 'teacher.html#class/' + game.class_id;
    document.title = game.title + ' | Live CTF';

    if (game.status === 'lobby') {
        app.innerHTML = lobbyView();
    } else if (game.status === 'running') {
        app.innerHTML = runningView();
    } else {
        app.innerHTML = finishedView();
    }
    slideRows(before);
    updateClocks();
}

async function refresh() {
    const newState = await callDb('ctf_host_state', { ctf: ctfId });
    syncClock(newState.now);
    newState.now = null;
    const snapshot = JSON.stringify(newState);
    if (snapshot === lastDrawn) {
        return;
    }
    lastDrawn = snapshot;
    state = newState;
    draw();
}

async function refreshNow() {
    lastDrawn = '';
    await refresh();
}

// Buttons

const actions = {
    'start': async function () {
        if (state.player_count === 0 && !confirm('Nobody has joined yet. Start anyway?')) {
            return;
        }
        await callDb('ctf_start', { ctf: ctfId });
        await refreshNow();
    },
    'next': async function () {
        await callDb('ctf_next', { ctf: ctfId });
        await refreshNow();
    },
    'end': async function () {
        if (!confirm('End the CTF now? Nobody can answer after this.')) {
            return;
        }
        await callDb('ctf_end', { ctf: ctfId });
        await refreshNow();
    },
    'cancel': async function () {
        if (!confirm('Cancel this Live CTF? Students in the lobby will be sent back.')) {
            return;
        }
        const classId = state.game.class_id;
        must(await sb.from('ctfs').delete().eq('id', ctfId));
        location.href = 'teacher.html#class/' + classId;
    },
    'shuffle': async function () {
        await callDb('ctf_shuffle', { ctf: ctfId });
        await refreshNow();
    },
    'add-team': async function () {
        await callDb('ctf_add_team', { ctf: ctfId });
        await refreshNow();
    },
    'delete-team': async function (data) {
        if (!confirm('Delete ' + data.name + '? Its players will need a new team.')) {
            return;
        }
        await callDb('ctf_delete_team', { team: Number(data.team) });
        await refreshNow();
    },
    'remove-player': async function (data) {
        if (!confirm('Take ' + data.name + ' out of this game?')) {
            return;
        }
        await callDb('ctf_remove_player', { ctf: ctfId, student_uuid: data.player });
        await refreshNow();
    },
    'edit-team': function (data) {
        editingTeamId = Number(data.team);
        showTeamEditor();
    },
    'close-editor': function () {
        editingTeamId = null;
        modal.innerHTML = '';
    }
};

const changes = {
    'move-player': async function (data, select) {
        await callDb('ctf_move_player', { ctf: ctfId, student_uuid: data.player, team: select.value ? Number(select.value) : null });
        select.blur();
        await refreshNow();
    }
};

const forms = {
    'save-team': async function (form) {
        const picked = form.querySelector('input[name="colour"]:checked');
        await callDb('ctf_edit_team', {
            team: editingTeamId,
            new_name: form.elements.name.value,
            new_colour: picked ? picked.value : null
        });
        editingTeamId = null;
        modal.innerHTML = '';
        await refreshNow();
    }
};

async function main() {
    if (!ctfId) {
        app.innerHTML = '<section class="card"><p>No Live CTF chosen. Go back to your class and open it from there.</p></section>';
        return;
    }
    onAction(app, actions);
    onChange(app, changes);
    onAction(modal, actions);
    onForm(modal, forms);
    startClocks();

    // Check it loads before we start repeating
    await runSafely(async function () {
        try {
            await refresh();
        } catch (err) {
            app.innerHTML = '<section class="card"><h2>Can\'t open this Live CTF</h2><p>' + esc(err.message) + '</p>' +
                '<p><a href="teacher.html">Go to the teacher login</a></p></section>';
            throw err;
        }
        // Keep the screen up to date. If one check fails (e.g. Wi-Fi drops out),
        // it just tries again next time
        repeat(refresh, 2000);
    });
}

main();
