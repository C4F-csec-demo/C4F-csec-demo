// Teacher page view: the curriculum (teacher.html#curriculum)
// Shows every lesson grouped by level, and a form to add new lessons
// Lessons added by normal teachers wait for an admin to approve them
// Only admins can delete lessons (from the Admin page)

import { sb, callDb, must } from './supabase.js';
import { esc, tip, toast, safeUrl } from './ui.js';

function link(url, label) {
    const safe = safeUrl(url);
    return safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener">' + label + '</a>' : '-';
}

// The answer is blurred until you click it, so it isn't accidentally shown on a projector
export function hiddenFlag(flag) {
    if (!flag) {
        return '-';
    }
    return '<button type="button" class="spoiler" data-action="reveal" title="Click to show the answer">' + esc(flag) + '</button>';
}

export function lessonTable(lessons, flags, extraColumn) {
    const levels = [];
    lessons.forEach(function (lesson) {
        if (levels.indexOf(lesson.level) < 0) {
            levels.push(lesson.level);
        }
    });
    return levels.map(function (level) {
        const rows = lessons.filter(function (l) { return l.level === level; }).map(function (l) {
            const status = l.approved ? '' : ' <span class="pill yellow">Waiting for approval</span>';
            return '<tr><td>' + l.num + '</td><td>' + esc(l.title) + status + '</td>' +
                '<td>' + link(l.project_url, 'Open') + '</td><td>' + link(l.plan_url, 'Open') + '</td>' +
                '<td>' + (l.challenge ? link('challenges/' + l.challenge + '.html', esc(l.challenge)) : '-') + '</td>' +
                '<td>' + hiddenFlag(flags[l.challenge]) + '</td>' +
                (extraColumn ? '<td class="actions">' + extraColumn(l) + '</td>' : '') + '</tr>';
        }).join('');
        return '<h3>' + esc(level) + '</h3><table><tr><th>#</th><th>Lesson</th><th>Resource</th><th>Lesson plan</th><th>Challenge</th>' +
            '<th>Flag ' + tip('The answer to the challenge. Click to show it.') + '</th>' + (extraColumn ? '<th></th>' : '') + '</tr>' + rows + '</table>';
    }).join('');
}

// Loads lessons and a { challengeId: flag } lookup
export async function loadLessons() {
    const results = await Promise.all([
        sb.from('lessons').select('*').order('level').order('num').order('id'),
        sb.from('challenges').select('slug, flag')
    ]);
    const flags = {};
    must(results[1]).forEach(function (ch) { flags[ch.slug] = ch.flag; });
    return { lessons: must(results[0]), flags: flags };
}

export async function render(app, me, tabsHtml) {
    const data = await loadLessons();
    const levels = [];
    data.lessons.forEach(function (l) {
        if (levels.indexOf(l.level) < 0) {
            levels.push(l.level);
        }
    });

    const approvalNote = me.role === 'admin'
        ? 'You\'re an admin, so your lessons are approved straight away.'
        : 'New lessons need an admin (Ben or Grig) to approve them before they can be assigned to a class.';

    app.innerHTML = tabsHtml +
        '<section class="card"><h2>Curriculum</h2>' +
        (data.lessons.length ? lessonTable(data.lessons, data.flags) : '<p class="hint">No lessons yet.</p>') +
        '</section>' +
        '<section class="card"><h2>Add a lesson</h2><p class="hint">' + approvalNote + '</p>' +
        '<form data-form="add-lesson" class="grid">' +
        '<label>Level<input name="level" list="levels" placeholder="Cyber Level 1" required></label>' +
        '<datalist id="levels">' + levels.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>' +
        '<label>Lesson number<input name="num" type="number" min="1" required></label>' +
        '<label>Title<input name="title" maxlength="120" required></label>' +
        '<label>Resource link<input name="project" placeholder="https://..."></label>' +
        '<label>Lesson plan link<input name="plan" placeholder="https://..."></label>' +
        '<label>Challenge id (optional) ' + tip('The name of the challenge page in the challenges folder, without .html. For example "caesar" for challenges/caesar.html.') +
        '<input name="challenge" placeholder="inspect-html"></label>' +
        '<label>Flag (the answer) ' + tip('Only needed for a new challenge. Leave it empty if the challenge already exists.') +
        '<input name="flag" autocomplete="off"></label>' +
        '<button>Add lesson</button></form></section>';
}

export const actions = {
    'reveal': function (data, button) {
        button.classList.toggle('shown');
        return false;
    }
};

export const forms = {
    'add-lesson': async function (form) {
        const f = form.elements;
        await callDb('add_lesson', {
            lesson_level: f.level.value,
            lesson_num: Number(f.num.value),
            lesson_title: f.title.value,
            project_link: f.project.value,
            plan_link: f.plan.value,
            challenge_slug: f.challenge.value,
            challenge_answer: f.flag.value
        });
        toast('Lesson added.');
    }
};
