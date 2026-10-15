// Teacher page view: the list of classes (teacher.html#classes).

import { sb, callDb, must } from './supabase.js';
import { esc, tip } from './ui.js';

// Admins can tick "show all classes" to see every class, not just their own.
let showAllClasses = false;

function classTile(cls) {
    const teacherNames = cls.class_teachers
        .map(function (link) { return link.teachers ? link.teachers.name : 'a teacher'; })
        .join(', ');
    const studentCount = cls.students.length ? cls.students[0].count : 0;
    return '<a class="tile" href="#class/' + cls.id + '">' +
        '<h3>' + esc(cls.name) + '</h3>' +
        '<p>Join code <b class="code small-code">' + esc(cls.code) + '</b></p>' +
        '<p class="hint">' + studentCount + ' student' + (studentCount === 1 ? '' : 's') +
        (teacherNames ? ' &middot; ' + esc(teacherNames) : ' &middot; <b class="bad">no teacher</b>') + '</p>' +
        '</a>';
}

export async function render(app, me, tabsHtml) {
    const allClasses = must(await sb.from('classes')
        .select('id, name, code, class_teachers(teacher_id, teachers(name)), students(count)')
        .order('created_at'));

    const myClasses = allClasses.filter(function (cls) {
        return cls.class_teachers.some(function (link) { return link.teacher_id === me.id; });
    });
    const shown = showAllClasses ? allClasses : myClasses;

    let adminToggle = '';
    if (me.role === 'admin') {
        adminToggle = '<label class="inline-check"><input type="checkbox" data-action="toggle-all-classes"' +
            (showAllClasses ? ' checked' : '') + '> Show every class (admin)</label>';
    }

    app.innerHTML = tabsHtml +
        '<section class="card"><h2>Make a new class ' + tip('Each class gets a join code. Students type it on the student page to register into the class.') + '</h2>' +
        '<form data-form="new-class" class="row"><input name="name" maxlength="80" placeholder="e.g. PLC Year 7 Tuesday" required><button>Create class</button></form></section>' +
        '<div class="row space-between"><h2>' + (showAllClasses ? 'Every class' : 'My classes') + '</h2>' + adminToggle + '</div>' +
        (shown.length
            ? '<div class="tiles">' + shown.map(classTile).join('') + '</div>'
            : '<p class="hint">No classes yet. Make one above, or ask an admin to share a class with you.</p>');
}

export const actions = {
    'toggle-all-classes': function (data, checkbox) {
        showAllClasses = checkbox.checked;
    }
};

export const forms = {
    'new-class': async function (form) {
        const newId = await callDb('create_class', { class_name: form.elements.name.value });
        location.hash = 'class/' + newId;
        return false;
    }
};
