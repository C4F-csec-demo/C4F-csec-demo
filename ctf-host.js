// Teacher page view: one class (teacher.html#class/12)
// Shows the join code, the Live CTF box, assigned lessons and students

import { sb, callDb, must } from './supabase.js';
import { esc, tip, toast, todayInSydney, formatDay } from './ui.js';

async function loadClass(classId) {
    const results = await Promise.all([
        sb.from('classes').select('id, name, code, class_teachers(teacher_id, teachers(name))').eq('id', classId).maybeSingle(),
        sb.from('students').select('id, first, last').eq('class_id', classId).order('first').order('last'),
        sb.from('assignments').select('id, day, lessons(title, level, num)').eq('class_id', classId).order('day', { ascending: false }),
        sb.from('lessons').select('id, level, num, title').eq('approved', true).order('level').order('num'),
        sb.from('solves').select('student_id, challenge, students!inner(class_id)').eq('students.class_id', classId),
        sb.from('ctfs').select('id, title, status, created_at').eq('class_id', classId).order('created_at', { ascending: false })
    ]);
    return {
        cls: must(results[0]),
        students: must(results[1]),
        assignments: must(results[2]),
        lessons: must(results[3]),
        solves: must(results[4]),
        ctfs: must(results[5])
    };
}

// ---------- Pieces of the page ----------

function headerSection(cls) {
    const teacherNames = cls.class_teachers
        .map(function (link) { return link.teachers ? link.teachers.name : 'a teacher'; })
        .join(', ');
    return '<p><a href="#classes">&larr; All classes</a></p>' +
        '<div class="row space-between"><h1>' + esc(cls.name) + '</h1>' +
        '<button class="alt small" data-action="rename-class" data-id="' + cls.id + '" data-name="' + esc(cls.name) + '">Rename class</button></div>' +
        '<p>Join code <b class="code">' + esc(cls.code) + '</b> ' +
        tip('Students go to the student page, click Register and type this code with their name and a password.') + '</p>' +
        '<p class="hint">Teachers: ' + esc(teacherNames || 'none') + '</p>';
}

function liveCtfSection(cls, ctfs) {
    const open = ctfs.find(function (ctf) { return ctf.status !== 'finished'; });
    const finished = ctfs.filter(function (ctf) { return ctf.status === 'finished'; });

    let html = '<section class="card ctf-card"><h2><span class="flag-icon">&#9873;</span> Live CTF ' +
        tip('A timed hacking competition with a live leaderboard. It is separate from lessons: answers in a Live CTF don\'t count as lesson progress.') + '</h2>';

    if (open) {
        const where = open.status === 'lobby' ? 'is open and students can join' : 'is running right now';
        html += '<p><span class="live-dot"></span><b>' + esc(open.title) + '</b> ' + where + '.</p>' +
            '<a class="button pink" href="ctf-host.html?id=' + open.id + '">Open the big screen</a>';
    } else {
        html += '<p>Students race to solve challenges. The faster they solve each one, the more points they get.</p>' +
            '<a class="button pink" href="#class/' + cls.id + '/new-ctf">Set up a Live CTF</a>';
    }

    if (finished.length) {
        html += '<h3>Past Live CTFs</h3><table>' + finished.map(function (ctf) {
            return '<tr><td>' + esc(ctf.title) + '</td><td class="hint">' + esc(new Date(ctf.created_at).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) + '</td>' +
                '<td class="actions"><a class="button alt small" href="ctf-host.html?id=' + ctf.id + '">Results</a> ' +
                '<button class="alt small" data-action="delete-ctf" data-id="' + ctf.id + '">Delete</button></td></tr>';
        }).join('') + '</table>';
    }
    return html + '</section>';
}

function lessonsSection(cls, assignments, lessons) {
    const today = todayInSydney();
    const options = lessons.map(function (lesson) {
        return '<option value="' + lesson.id + '">' + esc(lesson.level) + ' #' + lesson.num + ': ' + esc(lesson.title) + '</option>';
    }).join('');

    const rows = assignments.map(function (a) {
        const status = a.day > today
            ? '<span class="pill">Unlocks ' + esc(formatDay(a.day)) + '</span>'
            : '<span class="pill green">Students can see it</span>';
        return '<tr><td>' + esc(formatDay(a.day)) + '</td><td>' + esc(a.lessons.title) + '</td><td>' + status + '</td>' +
            '<td class="actions"><button class="alt small" data-action="unassign" data-id="' + a.id + '">Unassign</button></td></tr>';
    }).join('');

    return '<section class="card"><h2>Lessons ' +
        tip('Pick a lesson and a day. Students see the lesson (and its challenge) from that day onwards, so you can set lessons up early.') + '</h2>' +
        '<form data-form="assign" data-class="' + cls.id + '" class="row">' +
        '<select name="lesson" aria-label="Lesson" required>' + options + '</select>' +
        '<input type="date" name="day" value="' + todayInSydney() + '" required aria-label="Day">' +
        '<button>Assign</button></form>' +
        (rows ? '<table>' + rows + '</table>' : '<p class="hint">Nothing assigned yet.</p>') +
        '</section>';
}

function studentsSection(students, solves) {
    if (!students.length) {
        return '<section class="card"><h2>Students</h2><p class="hint">No students yet. Share the join code above.</p></section>';
    }
    const rows = students.map(function (s) {
        const solved = solves.filter(function (x) { return x.student_id === s.id; }).map(function (x) { return x.challenge; });
        const fullName = s.first + ' ' + s.last;
        return '<tr><td>' + esc(fullName) + '</td>' +
            '<td title="' + esc(solved.join(', ')) + '">' + solved.length + '</td>' +
            '<td class="actions">' +
            '<button class="alt small" data-action="rename-student" data-id="' + s.id + '" data-name="' + esc(fullName) + '">Rename</button> ' +
            '<button class="alt small" data-action="student-password" data-id="' + s.id + '" data-name="' + esc(fullName) + '">New password</button> ' +
            '<button class="alt small danger" data-action="remove-student" data-id="' + s.id + '" data-name="' + esc(fullName) + '">Remove</button>' +
            '</td></tr>';
    }).join('');
    return '<section class="card"><h2>Students (' + students.length + ')</h2><table>' +
        '<tr><th>Name</th><th>Challenges solved ' + tip('Challenges solved during normal lessons. Hover over a number to see which ones.') + '</th><th></th></tr>' +
        rows + '</table></section>';
}

// ---------- Draw the view ----------

export async function render(app, me, classId) {
    const data = await loadClass(classId);
    if (!data.cls) {
        app.innerHTML = '<p><a href="#classes">&larr; All classes</a></p><section class="card"><p>Class not found, or it isn\'t one of your classes.</p></section>';
        return;
    }
    app.innerHTML = headerSection(data.cls) +
        liveCtfSection(data.cls, data.ctfs) +
        lessonsSection(data.cls, data.assignments, data.lessons) +
        studentsSection(data.students, data.solves);
}

export const actions = {
    'rename-class': async function (data) {
        const name = prompt('New name for this class', data.name);
        if (!name || !name.trim()) {
            return false;
        }
        must(await sb.from('classes').update({ name: name.trim() }).eq('id', data.id));
    },
    'unassign': async function (data) {
        must(await sb.from('assignments').delete().eq('id', data.id));
    },
    'rename-student': async function (data) {
        const name = prompt('Type the student\'s first and last name', data.name);
        if (!name || !name.trim()) {
            return false;
        }
        const words = name.trim().split(/\s+/);
        if (words.length < 2) {
            toast('Type a first AND last name.', true);
            return false;
        }
        must(await sb.from('students').update({ first: words[0], last: words.slice(1).join(' ') }).eq('id', data.id));
    },
    'student-password': async function (data) {
        const password = prompt('Type a new temporary password for ' + data.name + ' (6+ characters).\nDon\'t reuse a password from anywhere else.');
        if (!password) {
            return false;
        }
        await callDb('set_student_password', { student_uuid: data.id, new_password: password });
        toast('Done. Tell ' + data.name + ' to log in with that password.');
        return false;
    },
    'remove-student': async function (data) {
        if (!confirm('Remove ' + data.name + ' and their login? This can\'t be undone.')) {
            return false;
        }
        await callDb('remove_student', { student_uuid: data.id });
    },
    'delete-ctf': async function (data) {
        if (!confirm('Delete this Live CTF and its results?')) {
            return false;
        }
        must(await sb.from('ctfs').delete().eq('id', data.id));
    }
};

export const forms = {
    'assign': async function (form) {
        must(await sb.from('assignments').insert({
            class_id: Number(form.dataset.class),
            lesson_id: Number(form.elements.lesson.value),
            day: form.elements.day.value
        }));
    }
};
