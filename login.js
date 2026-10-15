// The admin page (admin.html). Only admins (Ben and Grig) can use it.
//
// Three tabs, picked by the part of the address after the #:
//   admin.html#teachers   approve, add and manage teachers (the default)
//   admin.html#lessons    approve and delete lessons
//   admin.html#classes    see every class, share or hand classes over to other teachers

import { sb, callDb, must, whoami, signOutAndGo } from './supabase.js';
import { $, esc, tip, toast, formatDay, onAction, onForm, redrawAfter } from './ui.js';
import { lessonTable, loadLessons } from './teacher-curriculum.js';

const app = $('#app');
let me = null;

// ---------- Loading data ----------

async function loadEverything() {
    const results = await Promise.all([
        sb.from('teachers').select('*').order('created_at'),
        sb.from('teacher_invites').select('*').order('created_at'),
        sb.from('classes').select('id, name, code, class_teachers(teacher_id), students(count)').order('name'),
        loadLessons()
    ]);
    return {
        teachers: must(results[0]),
        invites: must(results[1]),
        classes: must(results[2]),
        lessons: results[3].lessons,
        flags: results[3].flags
    };
}

function teacherName(teachers, id) {
    const teacher = teachers.find(function (t) { return t.id === id; });
    return teacher ? teacher.name : 'Unknown';
}

// ---------- Teachers tab ----------

function teachersTab(data) {
    const pending = data.teachers.filter(function (t) { return !t.approved; });
    const approved = data.teachers.filter(function (t) { return t.approved; });

    let html = '';

    html += '<section class="card"><h2>Waiting for approval</h2>';
    if (pending.length) {
        html += '<table>' + pending.map(function (t) {
            return '<tr><td><b>' + esc(t.name) + '</b><br><span class="hint">' + esc(t.email) + '</span></td>' +
                '<td class="hint">Signed up ' + esc(formatDay(t.created_at.slice(0, 10))) + '</td>' +
                '<td class="actions"><button class="small" data-action="approve-teacher" data-id="' + t.id + '">Approve</button> ' +
                '<button class="alt small danger" data-action="delete-teacher" data-id="' + t.id + '" data-name="' + esc(t.name) + '">Reject and delete</button></td></tr>';
        }).join('') + '</table>';
    } else {
        html += '<p class="hint">Nobody is waiting.</p>';
    }
    html += '</section>';

    html += '<section class="card"><h2>Add a teacher ' +
        tip('This makes a one-time invite code. The new teacher goes to the Teacher login page, clicks Create account, and types the code. Their account is approved straight away.') + '</h2>' +
        '<form data-form="invite" class="row"><input name="teacher" maxlength="80" placeholder="Teacher\'s name" required><button>Make invite code</button></form>';
    if (data.invites.length) {
        html += '<h3>Unused invite codes</h3><table>' + data.invites.map(function (inv) {
            return '<tr><td>' + esc(inv.name) + '</td><td><b class="code small-code">' + esc(inv.code) + '</b></td>' +
                '<td class="actions"><button class="alt small" data-action="delete-invite" data-code="' + esc(inv.code) + '">Cancel code</button></td></tr>';
        }).join('') + '</table>';
    }
    html += '</section>';

    html += '<section class="card"><h2>Teachers (' + approved.length + ')</h2><table>' +
        '<tr><th>Name</th><th>Role ' + tip('Admins can use this page. Teachers can only see their own classes.') + '</th><th>Classes</th><th></th></tr>' +
        approved.map(function (t) {
            const classCount = data.classes.filter(function (c) {
                return c.class_teachers.some(function (link) { return link.teacher_id === t.id; });
            }).length;
            const isMe = t.id === me.id;
            const buttons = isMe ? '<span class="hint">This is you</span>' :
                '<button class="alt small" data-action="toggle-admin" data-id="' + t.id + '" data-admin="' + t.is_admin + '">' + (t.is_admin ? 'Remove admin' : 'Make admin') + '</button> ' +
                '<button class="alt small" data-action="teacher-password" data-id="' + t.id + '" data-name="' + esc(t.name) + '">New password</button> ' +
                '<button class="alt small" data-action="unapprove-teacher" data-id="' + t.id + '" data-name="' + esc(t.name) + '">Block</button> ' +
                '<button class="alt small danger" data-action="delete-teacher" data-id="' + t.id + '" data-name="' + esc(t.name) + '">Delete</button>';
            return '<tr><td><b>' + esc(t.name) + '</b><br><span class="hint">' + esc(t.email) + '</span></td>' +
                '<td>' + (t.is_admin ? '<span class="pill pink">Admin</span>' : '<span class="pill">Teacher</span>') + '</td>' +
                '<td>' + classCount + '</td><td class="actions">' + buttons + '</td></tr>';
        }).join('') + '</table></section>';

    return html;
}

// ---------- Lessons tab ----------

function lessonsTab(data) {
    const pending = data.lessons.filter(function (l) { return !l.approved; });

    function adminButtons(lesson) {
        let buttons = '';
        if (!lesson.approved) {
            buttons += '<button class="small" data-action="approve-lesson" data-id="' + lesson.id + '">Approve</button> ';
        }
        buttons += '<button class="alt small danger" data-action="delete-lesson" data-id="' + lesson.id + '" data-title="' + esc(lesson.title) + '">Delete</button>';
        if (lesson.added_by && !lesson.approved) {
            buttons += '<br><span class="hint">Added by ' + esc(teacherName(data.teachers, lesson.added_by)) + '</span>';
        }
        return buttons;
    }

    return '<section class="card"><h2>Waiting for approval</h2>' +
        (pending.length ? lessonTable(pending, data.flags, adminButtons) : '<p class="hint">No lessons are waiting.</p>') +
        '</section>' +
        '<section class="card"><h2>All lessons ' + tip('Deleting a lesson removes it from every class it was assigned to. The challenge page itself is not deleted.') + '</h2>' +
        lessonTable(data.lessons, data.flags, adminButtons) + '</section>';
}

// ---------- Classes tab ----------

function classesTab(data) {
    const approved = data.teachers.filter(function (t) { return t.approved; });

    const rows = data.classes.map(function (cls) {
        const teacherIds = cls.class_teachers.map(function (link) { return link.teacher_id; });
        const chips = teacherIds.map(function (id) {
            return '<span class="chip">' + esc(teacherName(data.teachers, id)) +
                ' <button class="chip-x" data-action="unshare-class" data-class="' + cls.id + '" data-teacher="' + id + '" ' +
                'data-name="' + esc(teacherName(data.teachers, id)) + '" title="Take this teacher off the class" aria-label="Remove">&times;</button></span>';
        }).join(' ');
        const options = approved
            .filter(function (t) { return teacherIds.indexOf(t.id) < 0; })
            .map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; })
            .join('');
        const studentCount = cls.students.length ? cls.students[0].count : 0;

        return '<tr><td><b>' + esc(cls.name) + '</b><br><span class="hint">Code ' + esc(cls.code) + ' &middot; ' + studentCount + ' students</span></td>' +
            '<td>' + (chips || '<b class="bad">No teacher</b>') +
            (options ? '<form data-form="share-class" data-class="' + cls.id + '" class="row tight"><select name="teacher" aria-label="Teacher">' + options + '</select><button class="small">Add</button></form>' : '') +
            '</td>' +
            '<td class="actions"><a class="button alt small" href="teacher.html#class/' + cls.id + '">Open</a> ' +
            '<button class="alt small danger" data-action="delete-class" data-id="' + cls.id + '" data-name="' + esc(cls.name) + '">Delete</button></td></tr>';
    }).join('');

    return '<section class="card"><h2>Every class (' + data.classes.length + ')</h2>' +
        '<p class="hint">To <b>share</b> a class (for example with a substitute), add another teacher. ' +
        'To <b>hand a class over</b>, add the new teacher, then click &times; next to the old one.</p>' +
        (rows ? '<table><tr><th>Class</th><th>Teachers</th><th></th></tr>' + rows + '</table>' : '<p class="hint">No classes yet.</p>') +
        '</section>';
}

// ---------- Drawing the page ----------

async function render() {
    const data = await loadEverything();
    const current = location.hash.replace('#', '') || 'teachers';
    const waitingTeachers = data.teachers.filter(function (t) { return !t.approved; }).length;
    const waitingLessons = data.lessons.filter(function (l) { return !l.approved; }).length;

    function tab(hash, label, waiting) {
        return '<a class="tab' + (current === hash ? ' on' : '') + '" href="#' + hash + '">' + label +
            (waiting ? ' <span class="count">' + waiting + '</span>' : '') + '</a>';
    }

    let body = teachersTab(data);
    if (current === 'lessons') {
        body = lessonsTab(data);
    } else if (current === 'classes') {
        body = classesTab(data);
    }

    app.innerHTML = '<h1>Admin</h1>' +
        '<nav class="tabs">' + tab('teachers', 'Teachers', waitingTeachers) + tab('lessons', 'Lessons', waitingLessons) + tab('classes', 'Classes', 0) + '</nav>' +
        body;
}

const actions = {
    'approve-teacher': function (data) {
        return callDb('admin_update_teacher', { teacher_uuid: data.id, make_approved: true, make_admin: false });
    },
    'unapprove-teacher': function (data) {
        if (!confirm('Block ' + data.name + '? They won\'t be able to use the teacher page until you approve them again.')) {
            return false;
        }
        return callDb('admin_update_teacher', { teacher_uuid: data.id, make_approved: false, make_admin: false });
    },
    'toggle-admin': function (data) {
        const makeAdmin = data.admin !== 'true';
        return callDb('admin_update_teacher', { teacher_uuid: data.id, make_approved: true, make_admin: makeAdmin });
    },
    'delete-teacher': function (data) {
        if (!confirm('Delete ' + data.name + '\'s account completely? Their classes will stay (you can give them to another teacher).')) {
            return false;
        }
        return callDb('admin_remove_teacher', { teacher_uuid: data.id });
    },
    'teacher-password': async function (data) {
        const password = prompt('Type a new password for ' + data.name + ' (8+ characters).\nDon\'t reuse a password from anywhere else.');
        if (!password) {
            return false;
        }
        await callDb('admin_set_teacher_password', { teacher_uuid: data.id, new_password: password });
        toast('Done. Give ' + data.name + ' the new password.');
        return false;
    },
    'delete-invite': async function (data) {
        must(await sb.from('teacher_invites').delete().eq('code', data.code));
    },
    'approve-lesson': async function (data) {
        must(await sb.from('lessons').update({ approved: true }).eq('id', data.id));
    },
    'delete-lesson': async function (data) {
        if (!confirm('Delete "' + data.title + '"? It will also be unassigned from every class.')) {
            return false;
        }
        must(await sb.from('lessons').delete().eq('id', data.id));
    },
    'unshare-class': async function (data) {
        if (!confirm('Take ' + data.name + ' off this class?')) {
            return false;
        }
        must(await sb.from('class_teachers').delete().eq('class_id', data.class).eq('teacher_id', data.teacher));
    },
    'delete-class': function (data) {
        const typed = prompt('This deletes "' + data.name + '", all its students\' logins, and its Live CTF results. It can\'t be undone.\n\nType DELETE to confirm.');
        if (typed !== 'DELETE') {
            return false;
        }
        return callDb('admin_delete_class', { class_ref: Number(data.id) });
    },
    'reveal': function (data, button) {
        button.classList.toggle('shown');
        return false;
    }
};

const forms = {
    'invite': async function (form) {
        const code = await callDb('admin_create_invite', { teacher_name: form.elements.teacher.value });
        alert('Give this invite code to ' + form.elements.teacher.value + ':\n\n' + code +
            '\n\nThey go to the Teacher login page, click "Create account", and type the code in.');
    },
    'share-class': async function (form) {
        must(await sb.from('class_teachers').insert({ class_id: Number(form.dataset.class), teacher_id: form.elements.teacher.value }));
        toast('Class shared.');
    }
};

async function main() {
    $('#out').onclick = function () { signOutAndGo('teacher.html'); };
    me = await whoami();
    if (!me || me.role !== 'admin') {
        app.innerHTML = '<section class="card narrow"><h2>Admins only</h2><p>This page is only for admins. <a href="teacher.html">Go to the teacher page</a>.</p></section>';
        return;
    }
    me.id = (await sb.auth.getSession()).data.session.user.id;
    onAction(app, redrawAfter(actions, render));
    onForm(app, redrawAfter(forms, render));
    window.addEventListener('hashchange', render);
    await render();
}

main();
