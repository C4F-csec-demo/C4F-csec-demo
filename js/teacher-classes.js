// Teacher page view: the list of classes (teacher.html#classes).

import { sb, callDb, must } from './supabase.js';
import { esc, tip } from './ui.js';

// Admins can tick "show all classes" to see every class, not just their own.
let showAllClasses = false;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The time box gives us "16:00", which becomes "4:00pm"
function formatTime(value) {
    const parts = value.split(':');
    const hour24 = Number(parts[0]);
    const minutes = parts[1];
    const suffix = hour24 < 12 ? 'am' : 'pm';
    let hour12 = hour24 % 12;
    if (hour12 === 0) {
        hour12 = 12;
    }
    return hour12 + ':' + minutes + suffix;
}

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

    const dayOptions = '<option value="">Pick a day</option>' +
        DAYS.map(function (day) { return '<option value="' + day + '">' + day + '</option>'; }).join('');

    app.innerHTML = tabsHtml +
        '<section class="card"><h2>Make a new class ' + tip('Each class gets a join code. Students type it on the student page to register into the class.') + '</h2>' +
        '<form data-form="new-class" class="grid">' +
        '<label>School<input name="school" maxlength="60" placeholder="PLC" required></label>' +
        '<label>Day<select name="day" required>' + dayOptions + '</select></label>' +
        '<label>Time<input name="time" type="time" required></label>' +
        '<button>Create class</button></form>' +
        '<p class="hint">The class will be named like "PLC, Tuesday 4:00pm". You can rename it later from the class page.</p>' +
        '</section>' +
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
        const f = form.elements;
        const className = f.school.value.trim() + ', ' + f.day.value + ' ' + formatTime(f.time.value);
        const newId = await callDb('create_class', { class_name: className });
        location.hash = 'class/' + newId;
        return false;
    }
};
