// The teacher page (teacher.html)
//
// This file handles logging in, then shows one "view" at a time based on the
// part of the address after the #:
//   teacher.html#classes            list of your classes (the default)
//   teacher.html#class/12           one class: lessons, students, Live CTF
//   teacher.html#class/12/new-ctf   setting up a Live CTF for that class
//   teacher.html#curriculum         all lessons, and adding new ones
//
// Each view lives in its own file and has:
//   render(app, me, ...)  draws the view
//   actions               what its buttons do (see onAction in ui.js)
//   forms                 what its forms do (see onForm in ui.js)
// After any button or form finishes, the view is drawn again with fresh data

import { sb, callDb, whoami, signOutAndGo } from './supabase.js';
import { $, tip, showMessage, onAction, onForm, redrawAfter } from './ui.js';
import * as classList from './teacher-classes.js';
import * as classView from './teacher-class.js';
import * as ctfSetup from './ctf-setup.js';
import * as curriculum from './teacher-curriculum.js';

const app = $('#app');
let me = null;

// Logging in

function showLogin(mode) {
    $('#out').hidden = true;
    const creating = mode === 'create';
    app.innerHTML =
        '<h1>Teacher login</h1>' +
        '<nav><button type="button" data-action="login-mode" data-mode="login" class="' + (creating ? 'alt' : '') + '">Log in</button>' +
        '<button type="button" data-action="login-mode" data-mode="create" class="' + (creating ? '' : 'alt') + '">Create account</button></nav>' +
        '<form data-form="' + (creating ? 'create-account' : 'login') + '" class="card narrow">' +
        '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
        '<label>Password (8+ characters)<input name="password" type="password" minlength="8" required autocomplete="' + (creating ? 'new-password' : 'current-password') + '"></label>' +
        (creating
            ? '<label>Your name<input name="name" maxlength="80" required></label>' +
              '<label>Invite code (optional) ' + tip('If an admin gave you an invite code, type it here and your account is approved straight away. No code? An admin needs to approve you first.') +
              '<input name="invite" maxlength="8" autocomplete="off"></label>' +
              '<button>Create account</button>'
            : '<button>Log in</button>') +
        '<p id="m" class="msg"></p>' +
        (creating ? '' : '<p class="hint small-print">Forgot your password? Ask an admin (Ben or Grig) to set a new one.</p>') +
        '</form>';
}

function showWaitingForApproval() {
    app.innerHTML =
        '<section class="card narrow"><h2>Waiting for approval</h2>' +
        '<p>Your account is set up. Ask Ben or Grig to approve it, then click Refresh.</p>' +
        '<button data-action="refresh">Refresh</button>' +
        '<h3>Got an invite code?</h3>' +
        '<form data-form="use-invite" class="row"><input name="invite" maxlength="8" placeholder="Invite code" required autocomplete="off"><button>Use code</button></form>' +
        '<p id="m" class="msg"></p></section>';
}

function showFinishSetup() {
    app.innerHTML =
        '<section class="card narrow"><h2>Finish setting up your account</h2>' +
        '<form data-form="finish-setup">' +
        '<label>Your name<input name="name" maxlength="80" required></label>' +
        '<label>Invite code (optional)<input name="invite" maxlength="8" autocomplete="off"></label>' +
        '<button>Continue</button><p id="m" class="msg"></p></form></section>';
}

function showStudentAccountMessage() {
    app.innerHTML =
        '<section class="card narrow"><h2>This is a student account</h2>' +
        '<p>You\'re logged in as a student. Sign out to log in as a teacher.</p>' +
        '<a class="button" href="student.html">Go to my lessons</a> <button class="alt" data-action="sign-out">Sign out</button></section>';
}

const loginActions = {
    'login-mode': function (data) { showLogin(data.mode); return false; },
    'refresh': async function () { await start(); return false; },
    'sign-out': function () { signOutAndGo('teacher.html'); return false; }
};

const loginForms = {
    'login': async function (form) {
        showMessage($('#m'), 'Logging in...');
        const result = await sb.auth.signInWithPassword({ email: form.elements.email.value, password: form.elements.password.value });
        if (result.error) {
            showMessage($('#m'), result.error.message, true);
            return false;
        }
        await start();
        return false;
    },
    'create-account': async function (form) {
        showMessage($('#m'), 'Creating your account...');
        const result = await sb.auth.signUp({ email: form.elements.email.value, password: form.elements.password.value });
        if (result.error) {
            showMessage($('#m'), result.error.message, true);
            return false;
        }
        if (!result.data.session) {
            showMessage($('#m'), 'Check your email to confirm your account, then log in.');
            return false;
        }
        await callDb('register_teacher', { teacher_name: form.elements.name.value, invite_code: form.elements.invite.value });
        await start();
        return false;
    },
    'finish-setup': async function (form) {
        await callDb('register_teacher', { teacher_name: form.elements.name.value, invite_code: form.elements.invite.value });
        await start();
        return false;
    },
    'use-invite': async function (form) {
        const result = await callDb('register_teacher', { teacher_name: me.name, invite_code: form.elements.invite.value });
        if (result.role === 'pending') {
            showMessage($('#m'), 'That code didn\'t work. Check it with an admin.', true);
            return false;
        }
        await start();
        return false;
    }
};

// The main teacher views

function tabs(current) {
    function tab(hash, label) {
        return '<a class="tab' + (current === hash ? ' on' : '') + '" href="#' + hash + '">' + label + '</a>';
    }
    return '<nav class="tabs">' + tab('classes', 'My classes') + tab('curriculum', 'Curriculum') + '</nav>';
}

// Draws whichever view the address (#...) points to
async function render() {
    const parts = location.hash.replace('#', '').split('/');
    if (parts[0] === 'class' && parts[2] === 'new-ctf') {
        await ctfSetup.render(app, me, Number(parts[1]));
    } else if (parts[0] === 'class') {
        await classView.render(app, me, Number(parts[1]));
    } else if (parts[0] === 'curriculum') {
        await curriculum.render(app, me, tabs('curriculum'));
    } else {
        await classList.render(app, me, tabs('classes'));
    }
}

// Start up

async function start() {
    me = await whoami();
    if (!me) {
        return showLogin('login');
    }
    $('#out').hidden = false;
    if (me.role === 'student') {
        return showStudentAccountMessage();
    }
    if (me.role === 'none') {
        return showFinishSetup();
    }
    if (me.role === 'pending') {
        return showWaitingForApproval();
    }
    $('#admin-link').hidden = me.role !== 'admin';
    me.id = (await sb.auth.getSession()).data.session.user.id;
    await render();
}

// Login handlers always return false so the redraw only ever happens once logged in
onAction(app, redrawAfter(Object.assign({}, loginActions, classList.actions, classView.actions, ctfSetup.actions, curriculum.actions), render));
onForm(app, redrawAfter(Object.assign({}, loginForms, classList.forms, classView.forms, ctfSetup.forms, curriculum.forms), render));
window.addEventListener('hashchange', function () {
    if (me && (me.role === 'teacher' || me.role === 'admin')) {
        render();
        window.scrollTo(0, 0);
    }
});
$('#out').onclick = function () { signOutAndGo('teacher.html'); };

start();
