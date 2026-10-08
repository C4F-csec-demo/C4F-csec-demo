import { sb, $, esc, say } from './app.js';
const app = $('#app');
let view = 'classes',
    uid;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
const link = u => /^(https?:\/\/|challenges\/)/.test(u || '') ? `<a href="${esc(u)}" target="_blank" rel="noopener">Open</a>` : '-';

async function start() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session || session.user.is_anonymous) return login();
    uid = session.user.id;
    $('#out').hidden = false;
    let { data: t } = await sb.from('teachers').select('*').maybeSingle();
    if (!t) {
        const { error } = await sb.from('teachers').insert({ id: uid, name: session.user.user_metadata ? .name || session.user.email });
        if (error) return app.innerHTML = `<section class="card"><p class="bad">${esc(error.message)}</p></section>`;
        t = { approved: false };
    }
    if (!t.approved) return app.innerHTML = '<section class="card narrow"><h2>Waiting for approval</h2><p>Your account is set up. Ask Ben or Grig to approve it, then refresh this page.</p></section>';
    render();
}

function login() {
    $('#out').hidden = true;
    app.innerHTML = `<section class="card narrow"><h2>Teacher login</h2><form id="lf">
  <label>Email<input name="e" type="email" required></label>
  <label>Password (8+ characters)<input name="p" type="password" minlength="8" required></label>
  <label>Your name (new accounts only)<input name="n"></label>
  <div class="row"><button>Log in</button><button type="button" id="su" class="alt">Create account</button></div><p id="m" class="msg"></p></form></section>`;
    const f = $('#lf'),
        m = $('#m');
    f.onsubmit = async e => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({ email: f.e.value, password: f.p.value });
        error ? say(m, error.message, 1) : start();
    };
    $('#su').onclick = async() => {
        if (!f.reportValidity() || !f.n.value.trim()) return say(m, 'Enter your name to create an account.', 1);
        const { data, error } = await sb.auth.signUp({ email: f.e.value, password: f.p.value, options: { data: { name: f.n.value.trim() } } });
        if (error) return say(m, error.message, 1);
        data.session ? start() : say(m, 'Check your email to confirm your account, then log in.');
    };
}

async function render() {
    const [{ data: cl }, { data: ls }, { data: sub }, { data: fl }] = await Promise.all([
        sb.from('classes').select('*, students(*), assignments(*, lessons(num,title))').order('created_at'),
        sb.from('lessons').select('*').order('level').order('num'),
        sb.from('submissions').select('student_id,challenge').eq('correct', true),
        sb.from('flags').select('*')
    ]);
    const tab = (v, t) => `<button data-v="${v}" class="${view == v ? '' : 'alt'}">${t}</button>`;
    app.innerHTML = `<nav>${tab('classes', 'Classes')}${tab('curriculum', 'Curriculum')}</nav>` + (view == 'classes' ? classes(cl, ls, sub) : curriculum(ls, fl || []));
}

const classes = (cl, ls, sub) => `<section class="card"><h2>New class</h2><form data-f="class" class="row"><input name="n" placeholder="e.g. PLC Year 7 Tuesday" required><button>Create class</button></form></section>` +
    cl.map(c => `<section class="card"><h2>${esc(c.name)}</h2><p>Join code <b class="code">${esc(c.code)}</b></p>
  <h3>Students (${c.students.length})</h3>${c.students.length ? `<table><tr><th>Name</th><th>Challenges solved</th><th></th></tr>${c.students.map(s => `<tr><td>${esc(s.first)} ${esc(s.last)}${s.auth_id ? '' : ' <span class="hint">(reset)</span>'}</td><td>${sub.filter(x => x.student_id == s.id).length}</td>
  <td><button class="alt small" data-act="rename" data-id="${s.id}" data-n="${esc(s.first + ' ' + s.last)}">Rename</button> <button class="alt small" data-act="release" data-id="${s.id}">Reset</button> <button class="alt small" data-act="remove" data-id="${s.id}">Remove</button></td></tr>`).join('')}</table>` : '<p class="hint">No students yet. Share the join code.</p>'}
  <h3>Assigned lessons</h3>${c.assignments.length ? `<table>${c.assignments.sort((a, b) => a.day < b.day ? 1 : -1).map(a => `<tr><td>${esc(a.day)}</td><td>${esc(a.lessons.title)}</td><td><button class="alt small" data-act="unassign" data-id="${a.id}">Unassign</button></td></tr>`).join('')}</table>` : '<p class="hint">Nothing assigned yet.</p>'}
  <form data-f="assign" data-c="${c.id}" class="row"><select name="l" aria-label="Lesson">${ls.map(l => `<option value="${l.id}">${esc(l.level)}: ${esc(l.title)}</option>`).join('')}</select><input type="date" name="d" value="${today()}" required aria-label="Day"><button>Assign</button></form></section>`).join('');

const curriculum = (ls, fl) => `<section class="card"><h2>Curriculum</h2>${[...new Set(ls.map(l => l.level))].map(v => `<h3>${esc(v)}</h3><table><tr><th>#</th><th>Lesson</th><th>Project</th><th>Lesson plan</th><th>Challenge</th><th>Flag</th><th></th></tr>
  ${ls.filter(l => l.level == v).map(l => `<tr><td>${l.num}</td><td>${esc(l.title)}</td><td>${link(l.project_url)}</td><td>${link(l.plan_url)}</td><td>${esc(l.challenge || '')}</td><td>${esc((fl.find(x => x.challenge == l.challenge) || {}).flag || '')}</td><td><button class="alt small" data-act="dellesson" data-id="${l.id}">Delete</button></td></tr>`).join('')}</table>`).join('')}</section>
  <section class="card"><h2>Add a lesson</h2><form data-f="lesson" class="grid">
  <label>Level<input name="v" list="lv" placeholder="Cyber Level 1" required></label><datalist id="lv">${[...new Set(ls.map(l => l.level))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
  <label>Number<input name="n" type="number" min="1" required></label><label>Title<input name="t" required></label>
  <label>Project link<input name="p" placeholder="https://..."></label><label>Lesson plan link<input name="d" placeholder="https://..."></label>
  <label>Challenge id (optional)<input name="c" placeholder="inspect-html"></label><label>Flag (the answer)<input name="f"></label><button>Add lesson</button></form></section>`;

app.onclick = async e => {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset; let r;
  if (a.v) { view = a.v; return render(); }
  if (a.act == 'rename') { const n = prompt('New name (first last)', a.n); if (!n) return; const [f, ...l] = n.trim().split(/\s+/); r = await sb.from('students').update({ first: f, last: l.join(' ') }).eq('id', a.id); }
  else if (a.act == 'release') { if (!confirm('Let this student join again from a new device?')) return; r = await sb.from('students').update({ auth_id: null }).eq('id', a.id); }
  else if (a.act == 'remove') { if (!confirm('Remove this student?')) return; r = await sb.from('students').delete().eq('id', a.id); }
  else if (a.act == 'unassign') r = await sb.from('assignments').delete().eq('id', a.id);
  else if (a.act == 'dellesson') { if (!confirm('Delete this lesson for all teachers?')) return; r = await sb.from('lessons').delete().eq('id', a.id); }
  else return;
  r.error ? alert(r.error.message) : render();
};

app.onsubmit = async e => {
  const f = e.target, k = f.dataset.f; if (!k) return; e.preventDefault(); let r;
  if (k == 'class') r = await sb.from('classes').insert({ teacher_id: uid, name: f.n.value.trim() });
  if (k == 'assign') r = await sb.from('assignments').insert({ class_id: f.dataset.c, lesson_id: +f.l.value, day: f.d.value });
  if (k == 'lesson') {
    r = await sb.from('lessons').insert({ level: f.v.value.trim(), num: +f.n.value, title: f.t.value.trim(), project_url: f.p.value.trim() || null, plan_url: f.d.value.trim() || null, challenge: f.c.value.trim() || null });
    if (!r.error && f.c.value.trim() && f.f.value.trim()) r = await sb.from('flags').upsert({ challenge: f.c.value.trim(), flag: f.f.value.trim() });
  }
  r.error ? alert(r.error.message) : render();
};

$('#out').onclick = async () => { await sb.auth.signOut(); login(); };
start();
