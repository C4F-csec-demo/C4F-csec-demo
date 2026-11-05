// Teacher page view: the curriculum (teacher.html#curriculum)
// Shows every lesson grouped by level, then by lesson number, and a form to
// add new lessons. A lesson can have several pages (student challenges plus
// teacher demos), so each lesson number gets its own coloured block
// Lessons added by normal teachers wait for an admin to approve them
// Only admins can delete lessons (from the Admin page)

import { sb, callDb, must } from './supabase.js';
import { esc, tip, toast, safeUrl } from './ui.js';

// How many colours we cycle through before starting again
const GROUP_COLOURS = 4;

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

// Pages named "(DEMO) The Canteen" are teacher demos, not student challenges
function isDemo(lesson) {
    return /^\(DEMO\)/i.test(lesson.title || '');
}

function pageTitle(lesson) {
    return String(lesson.title || '').replace(/^\(DEMO\)\s*/i, '');
}

// Splits a list of lessons into blocks, one per lesson number.
// The list is already sorted by level then num, so rows with the same
// number sit next to each other
function groupByNumber(lessons) {
    const groups = [];
    lessons.forEach(function (lesson) {
        const last = groups[groups.length - 1];
        if (last && last.num === lesson.num) {
            last.rows.push(lesson);
        } else {
            groups.push({ num: lesson.num, rows: [lesson] });
        }
    });
    return groups;
}

// "6 pages, 3 teacher demos" - only shown when a lesson has more than one page
function groupCount(rows) {
    if (rows.length < 2) {
        return '';
    }
    const demos = rows.filter(isDemo).length;
    let text = rows.length + ' pages';
    if (demos > 0) {
        text += ', ' + demos + ' teacher ' + (demos === 1 ? 'demo' : 'demos');
    }
    return ' <span class="pages">' + text + '</span>';
}

function pageRow(lesson, flags, extraColumn) {
    const demoTag = isDemo(lesson) ? ' <span class="pill pink">Teacher demo</span>' : '';
    const status = lesson.approved ? '' : ' <span class="pill yellow">Waiting for approval</span>';
    return '<tr><td>' + esc(pageTitle(lesson)) + demoTag + status + '</td>' +
        '<td>' + link(lesson.project_url, 'Open') + '</td>' +
        '<td>' + link(lesson.plan_url, 'Open') + '</td>' +
        '<td>' + (lesson.challenge ? link('challenges/' + lesson.challenge + '.html', esc(lesson.challenge)) : '-') + '</td>' +
        '<td>' + hiddenFlag(flags[lesson.challenge]) + '</td>' +
        (extraColumn ? '<td class="actions">' + extraColumn(lesson) + '</td>' : '') + '</tr>';
}

export function lessonTable(lessons, flags, extraColumn) {
    const columns = extraColumn ? 6 : 5;
    const levels = [];
    lessons.forEach(function (lesson) {
        if (levels.indexOf(lesson.level) < 0) {
            levels.push(lesson.level);
        }
    });

    return levels.map(function (level) {
        const inLevel = lessons.filter(function (l) { return l.level === level; });

        const blocks = groupByNumber(inLevel).map(function (group, index) {
            const colour = 'lg-' + ((index % GROUP_COLOURS) + 1);
            const head = '<tr class="group-head"><td colspan="' + columns + '">' +
                '<span class="lesson-no">Lesson ' + esc(group.num) + '</span>' + groupCount(group.rows) + '</td></tr>';
            const rows = group.rows.map(function (l) { return pageRow(l, flags, extraColumn); }).join('');
            return '<tbody class="lesson-group ' + colour + '">' + head + rows + '</tbody>';
        }).join('');

        return '<h3>' + esc(level) + '</h3><table class="lessons">' +
            '<thead><tr><th>Page</th><th>Resource</th><th>Lesson plan</th><th>Challenge</th>' +
            '<th>Flag ' + tip('The answer to the challenge. Click to show it.') + '</th>' +
            (extraColumn ? '<th></th>' : '') + '</tr></thead>' + blocks + '</table>';
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
        '<p class="hint">A lesson can have more than one page. Each block below is one lesson.</p>' +
        (data.lessons.length ? lessonTable(data.lessons, data.flags) : '<p class="hint">No lessons yet.</p>') +
        '</section>' +
        '<section class="card"><h2>Add a lesson</h2><p class="hint">' + approvalNote + '</p>' +
        '<p class="hint">Tip: start the title with <b>(DEMO)</b> and the page is labelled <span class="pill pink">Teacher demo</span> in the list above. For example "(DEMO) The Canteen".</p>' +
        '<form data-form="add-lesson" class="grid">' +
        '<label>Level<input name="level" list="levels" placeholder="Cyber Level 1" required></label>' +
        '<datalist id="levels">' + levels.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>' +
        '<label>Lesson number<input name="num" type="number" min="1" required></label>' +
        '<label>Title ' + tip('Start the title with (DEMO) to mark a page as a teacher demo instead of a student challenge.') +
        '<input name="title" maxlength="120" required></label>' +
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
