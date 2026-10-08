import { sb, $, esc } from './app.js';

const info = (await sb.rpc('my_info')).data;
if (!(info && info.length)) location.href = 'index.html';
$('#hi').textContent = `Hi ${info[0].first}!`;
$('#cls').textContent = info[0].class_name;

const rows = (await sb.rpc('my_assignments')).data;
const none = `<section class="card"><p>No lessons yet. Your teacher will unlock them in class.</p></section>`;
const card = r => `<section class="card"><h2>${esc(r.title)}</h2><p class="hint">${esc(r.day)}</p>` +
    (r.challenge ? `<a href="challenges/${esc(r.challenge)}.html"><button>Open challenge</button></a> ${r.solved ? '<span class="badge">Solved</span>' : ''}` : '') + `</section>`;
$('#list').innerHTML = rows && rows.length ? rows.map(card).join('') : none;

$('#out').onclick = async() => { await sb.auth.signOut();
    location.href = 'index.html'; };
