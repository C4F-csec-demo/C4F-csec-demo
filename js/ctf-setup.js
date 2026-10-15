// Teacher page view: setting up a new Live CTF (teacher.html#class/12/new-ctf)
// When the form is submitted the game is created in "lobby" mode and the
// teacher goes to the big screen (ctf-host.html) where students can join

import { sb, callDb, must } from './supabase.js';
import { esc, tip, toast } from './ui.js';

// Challenge ids in the order the teacher clicked them
let picked = [];

function radio(name, value, label, help, checked) {
    return '<label class="choice"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '>' +
        '<span><b>' + label + '</b><br><span class="hint">' + help + '</span></span></label>';
}

// Shows the order numbers on the picked challenges, without redrawing the whole form
function updatePickNumbers() {
    document.querySelectorAll('[data-action="ctf-pick"]').forEach(function (button) {
        const index = picked.indexOf(button.dataset.slug);
        button.classList.toggle('picked', index >= 0);
        button.querySelector('.pick-number').textContent = index >= 0 ? String(index + 1) : '';
    });
}

// Shows the team settings only when "Play in teams" is ticked
function updateTeamFields(form) {
    form.querySelector('.team-settings').hidden = !form.elements.teams.checked;
}

export async function render(app, me, classId) {
    picked = [];
    const results = await Promise.all([
        sb.from('classes').select('id, name').eq('id', classId).maybeSingle(),
        sb.from('challenges').select('slug, title').order('created_at')
    ]);
    const cls = must(results[0]);
    const challenges = must(results[1]);
    if (!cls) {
        app.innerHTML = '<p><a href="#classes">&larr; All classes</a></p><p>Class not found.</p>';
        return;
    }

    const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const pickButtons = challenges.map(function (ch) {
        return '<button type="button" class="pick" data-action="ctf-pick" data-slug="' + esc(ch.slug) + '">' +
            '<span class="pick-number"></span><b>' + esc(ch.title) + '</b><span class="hint"> ' + esc(ch.slug) + '</span></button>';
    }).join('');

    app.innerHTML =
        '<p><a href="#class/' + cls.id + '">&larr; Back to ' + esc(cls.name) + '</a></p>' +
        '<h1>Set up a Live CTF</h1>' +
        '<p class="hint">Fill this in, then open the lobby. Students join from their page, and nothing starts until you press START.</p>' +
        '<form data-form="create-ctf" data-class="' + cls.id + '" class="card">' +

        '<h3>1. Name</h3>' +
        '<label>Name of this CTF<input name="title" maxlength="80" value="Live CTF ' + esc(today) + '" required></label>' +

        '<h3>2. Challenges ' + tip('Click challenges in the order you want them. Click again to take one out.') + '</h3>' +
        '<div class="pick-list">' + pickButtons + '</div>' +

        '<h3>3. Pacing</h3>' +
        radio('pacing', 'self', 'Self-paced', 'Each student or team moves to the next challenge as soon as they solve one. They can skip a challenge for 0 points.', true) +
        radio('pacing', 'teacher', 'Teacher-paced (like Kahoot)', 'Everyone works on the same challenge. You click Next to move everyone on.', false) +

        '<h3>4. Time limit ' + tip('Leave empty for no time limit. You can always end the CTF early.') + '</h3>' +
        '<label class="short">Minutes<input name="minutes" type="number" min="1" max="180" placeholder="No limit"></label>' +

        '<h3>5. Teams</h3>' +
        '<label class="inline-check"><input type="checkbox" name="teams"> Play in teams</label>' +
        '<div class="team-settings" hidden>' +
        '<div class="grid">' +
        '<label>Number of teams<input name="team_count" type="number" min="2" max="12" value="4"></label>' +
        '<label>Max students per team ' + tip('Only matters when students pick their own team. Leave empty for no limit.') +
        '<input name="team_size" type="number" min="1" max="30" placeholder="No limit"></label>' +
        '</div>' +
        '<p><b>How are teams made?</b></p>' +
        radio('sorting', 'pick', 'Students pick a team', 'Students click a team to join it. You can still move anyone.', true) +
        radio('sorting', 'random', 'Random', 'Click Shuffle in the lobby to make random teams. You can still move anyone.', false) +
        '<p><b>Team names and colours</b></p>' +
        radio('naming', 'auto', 'Automatic', 'Team 1, Team 2, Team 3... each with a different colour.', true) +
        radio('naming', 'students', 'Students choose', 'Each team picks its name and colour in the lobby. You can still rename teams and change colours.', false) +
        '</div>' +

        '<p><button class="pink big">Open the lobby</button></p>' +
        '</form>';

    const form = app.querySelector('form');
    form.elements.teams.onchange = function () { updateTeamFields(form); };
}

export const actions = {
    'ctf-pick': function (data) {
        const index = picked.indexOf(data.slug);
        if (index >= 0) {
            picked.splice(index, 1);
        } else {
            picked.push(data.slug);
        }
        updatePickNumbers();
        return false;
    }
};

export const forms = {
    'create-ctf': async function (form) {
        if (!picked.length) {
            toast('Pick at least one challenge (step 2).', true);
            return false;
        }
        const teamsOn = form.elements.teams.checked;
        const newId = await callDb('ctf_create', {
            class_ref: Number(form.dataset.class),
            ctf_title: form.elements.title.value,
            challenge_slugs: picked,
            pacing_mode: form.elements.pacing.value,
            minutes: form.elements.minutes.value ? Number(form.elements.minutes.value) : null,
            teams_on: teamsOn,
            number_of_teams: teamsOn ? Number(form.elements.team_count.value) : null,
            max_team_size: teamsOn && form.elements.team_size.value ? Number(form.elements.team_size.value) : null,
            sorting: teamsOn ? form.elements.sorting.value : null,
            students_choose_names: teamsOn && form.elements.naming.value === 'students'
        });
        location.href = 'ctf-host.html?id=' + newId;
        return false;
    }
};
