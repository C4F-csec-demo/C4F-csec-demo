// The student's home page (student.html): their lessons, and a big button
// to join a Live CTF when their teacher opens one

import { callDb, whoami, signOutAndGo } from './supabase.js';
import { $, esc, safeUrl, formatDay, repeat } from './ui.js';

function lessonCard(lesson) {
    let buttons = '';
    if (lesson.challenge) {
        buttons += '<a class="button" href="challenges/' + esc(lesson.challenge) + '.html">Open challenge</a> ';
    }
    if (safeUrl(lesson.project_url)) {
        buttons += '<a class="button alt" href="' + esc(safeUrl(lesson.project_url)) + '" target="_blank" rel="noopener">Open resource</a> ';
    }
    if (lesson.solved) {
        buttons += '<span class="badge">Solved</span>';
    }
    return '<section class="card"><h2>' + esc(lesson.title) + '</h2>' +
        '<p class="hint">' + esc(formatDay(lesson.day)) + '</p>' + buttons + '</section>';
}

async function showLessons() {
    const lessons = await callDb('my_lessons');
    if (!lessons.length) {
        $('#list').innerHTML = '<section class="card"><p>No lessons yet. Your teacher will unlock them in class.</p></section>';
        return;
    }
    $('#list').innerHTML = lessons.map(lessonCard).join('');
}

// Checks every few seconds if the teacher has opened a Live CTF for this class
async function checkForLiveCtf() {
    const ctf = await callDb('my_open_ctf');
    if (!ctf) {
        $('#ctf-banner').innerHTML = '';
        return;
    }
    const waiting = ctf.status === 'lobby' ? 'Your teacher has opened a Live CTF!' : 'A Live CTF is happening now!';
    $('#ctf-banner').innerHTML =
        '<section class="card ctf-banner"><div><span class="live-dot"></span><b>LIVE CTF</b>' +
        '<h2>' + esc(ctf.title) + '</h2><p>' + waiting + '</p></div>' +
        '<a class="button pink big" href="ctf-play.html?id=' + ctf.id + '">Join the Live CTF</a></section>';
}

async function main() {
    const me = await whoami();
    if (!me || me.role !== 'student') {
        location.href = 'index.html';
        return;
    }
    $('#hi').textContent = 'Hi ' + me.name + '!';
    $('#cls').textContent = me.class_name;
    $('#out').onclick = function () { signOutAndGo('index.html'); };

    await showLessons();
    repeat(checkForLiveCtf, 5000);
}

main();
