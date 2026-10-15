// Student login and registration page (index.html)
//
// How student accounts work: students may not have emails, so when they
// register we make up a random one (s-1234...@code4fun.com.au) and store it
// in Supabase. When they log in, the database looks up that made-up email
// from their class code and name, then Supabase checks the password.

import { sb, callDb, whoami } from './supabase.js';
import { $, showMessage } from './ui.js';

const FAKE_EMAIL_DOMAIN = 'code4fun.com.au';
let mode = 'register';

function setMode(newMode) {
    mode = newMode;
    const registering = mode === 'register';
    $('#go').textContent = registering ? 'Register' : 'Log in';
    $('#sub').textContent = registering
        ? 'First time here? Register with the code your teacher gave you.'
        : 'Welcome back! Log in with your class code, name and password.';
    $('#register-tab').className = registering ? '' : 'alt';
    $('#login-tab').className = registering ? 'alt' : '';
    $('#pw').autocomplete = registering ? 'new-password' : 'current-password';
    $('#m').textContent = '';
}

async function logIn(code, first, last, password) {
    const email = await callDb('student_login_email', { class_code: code, first_name: first, last_name: last });
    if (!email) {
        throw new Error('Class code or name not found. Check them, or register first.');
    }
    const result = await sb.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
        throw new Error('Wrong password. Ask your teacher if you forgot it.');
    }
}

async function register(code, first, last, password) {
    // 1. Check the class code and name before making an account
    const check = await callDb('check_student_name', { class_code: code, first_name: first, last_name: last });
    if (check !== 'ok') {
        throw new Error(check);
    }

    // 2. Make the account with a made-up email
    await sb.auth.signOut();
    const signUp = await sb.auth.signUp({
        email: 's-' + crypto.randomUUID() + '@' + FAKE_EMAIL_DOMAIN,
        password: password
    });
    if (signUp.error) {
        throw new Error(signUp.error.message);
    }
    if (!signUp.data.session) {
        throw new Error('Sign-up needs "Confirm email" turned off in Supabase.');
    }

    // 3. Put the new account in the class
    try {
        await callDb('join_class', { class_code: code, first_name: first, last_name: last });
    } catch (err) {
        await sb.auth.signOut();
        throw err;
    }
}

async function onSubmit(event) {
    event.preventDefault();
    const message = $('#m');
    const code = $('#code').value;
    const first = $('#first').value;
    const last = $('#last').value;
    const password = $('#pw').value;

    showMessage(message, 'Working...');
    try {
        if (mode === 'login') {
            await logIn(code, first, last, password);
        } else {
            await register(code, first, last, password);
        }
        location.href = 'student.html';
    } catch (err) {
        showMessage(message, err.message, true);
    }
}

async function main() {
    $('#register-tab').onclick = function () { setMode('register'); };
    $('#login-tab').onclick = function () { setMode('login'); };
    $('#join').onsubmit = onSubmit;
    setMode('register');

    // Already logged in? Go straight to the right page
    const me = await whoami();
    if (me && me.role === 'student') {
        location.href = 'student.html';
    } else if (me && me.role !== 'none') {
        location.href = 'teacher.html';
    }
}

main();
