import { sb, $, say } from './app.js';
const DOMAIN = 'code4fun.com.au';
let mode = 'register';

function setMode(x) {
    mode = x;
    $('#go').textContent = x == 'register' ? 'Register' : 'Log in';
    $('#sub').textContent = x == 'register' ? 'First time here? Register with the code your teacher gave you.' : 'Welcome back! Log in with your class code, name and password.';
    $('#tr').className = x == 'register' ? '' : 'alt';
    $('#tl').className = x == 'login' ? '' : 'alt';
    $('#pw').autocomplete = x == 'register' ? 'new-password' : 'current-password';
    $('#m').textContent = '';
}
$('#tr').onclick = () => setMode('register');
$('#tl').onclick = () => setMode('login');
setMode('register');

const { data: { session } } = await sb.auth.getSession();
if (session) { const { data } = await sb.rpc('my_info'); if (data && data.length) location.href = 'student.html'; }

$('#join').onsubmit = async e => {
    e.preventDefault();
    const m = $('#m'),
        c = $('#code').value,
        f = $('#first').value,
        l = $('#last').value,
        pw = $('#pw').value;
    say(m, 'Working...');
    if (mode == 'login') {
        const r = await sb.rpc('login_email', { c: c, f: f, l: l });
        if (r.error || !r.data) return say(m, 'Class code or name not found. Check them, or register first.', 1);
        const s = await sb.auth.signInWithPassword({ email: r.data, password: pw });
        if (s.error) return say(m, 'Wrong password. Ask your teacher if you forgot it.', 1);
    } else {
        const k = await sb.rpc('check_register', { c: c, f: f, l: l });
        if (k.error || k.data != 'ok') return say(m, k.error ? k.error.message : k.data, 1);
        await sb.auth.signOut();
        const s = await sb.auth.signUp({ email: 's-' + crypto.randomUUID() + '@' + DOMAIN, password: pw });
        if (s.error) return say(m, s.error.message, 1);
        if (!s.data.session) return say(m, 'Sign-up needs "Confirm email" turned off in Supabase.', 1);
        const j = await sb.rpc('join_class', { c: c, f: f, l: l });
        if (j.error) { await sb.auth.signOut(); return say(m, j.error.message, 1); }
    }
    location.href = 'student.html';
};
