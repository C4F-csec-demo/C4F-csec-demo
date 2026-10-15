# Code4Fun Cybersecurity

A small classroom website for the Code4Fun cybersecurity course. It's a static site (GitHub Pages) with a Supabase database for logins, classes, lessons and Live CTFs.

## Pages

| Page | Who uses it | What it does |
| --- | --- | --- |
| `index.html` | Students | Register / log in with class code, name and password |
| `student.html` | Students | Their assigned lessons, and the Join button for a Live CTF |
| `teacher.html` | Teachers | Log in, classes, students, assigning lessons, curriculum, setting up a Live CTF |
| `admin.html` | Admins | Approving teachers, invite codes, approving/deleting lessons, sharing classes |
| `ctf-host.html` | Teachers | The Live CTF "big screen" for the projector |
| `ctf-play.html` | Students | The student's Live CTF screen |
| `help-teacher.html`, `help-student.html` | Everyone | How to use the site |
| `challenges/*.html` | Everyone | One page per challenge |

## Scripts (`js` folder)

Every page has its own script, and they share a few helpers.

| File | What's in it |
| --- | --- |
| `supabase.js` | Connects to Supabase. `callDb()` runs a database function, `must()` checks a table query worked, `whoami()` says who's logged in |
| `ui.js` | Shared helpers: `esc()` (safe text), `tip()` (the "?" tooltips), dates and times, `onAction` / `onForm` / `onChange` (wiring buttons and forms), `repeat()` (polling) |
| `login.js` | Student register / log in (`index.html`) |
| `student.js` | Student's lessons page |
| `teacher.js` | Teacher login and switching between views |
| `teacher-classes.js` | View: list of classes |
| `teacher-class.js` | View: one class (lessons, students, Live CTF box) |
| `teacher-curriculum.js` | View: curriculum and adding lessons |
| `ctf-setup.js` | View: setting up a Live CTF |
| `admin.js` | Admin page |
| `ctf-host.js` | Live CTF big screen |
| `ctf-play.js` | Live CTF student screen |
| `ctf-clock.js` | Timers for the Live CTF screens |
| `challenge.js` | Answer box on every challenge page |

### How buttons work

Buttons and forms don't have their own `onclick`. Instead they have a `data-action` (or `data-form`) name, and each script has an `actions` (or `forms`) object with a function of the same name. For example:

```html
<button data-action="remove-student" data-id="5">Remove</button>
```

runs `actions['remove-student']` with `data.id === '5'`. After it finishes, the page redraws itself with fresh data from the database.

## Code rules

- No `?.` or `??` (the editor's formatter breaks them).
- No inline `<script>` code. Every script is a separate `.js` file.
- Anything typed by a user goes through `esc()` before it goes into HTML.
- Never put passwords or the Supabase secret key in any file. `config.js` only has the publishable key, which is safe to be public.

## Database

The database setup SQL is NOT in this repo, because it would show students the answers. Ben has it separately.

All the important rules (who can see what, checking answers, scoring) run in the database, so students can't get around them by editing the page.

## Adding a challenge

1. Copy an existing challenge page (e.g. `challenges/caesar.html`) and rename it, e.g. `challenges/passwords.html`.
2. Change `<body data-challenge="caesar">` to the new name, e.g. `data-challenge="passwords"`.
3. Write the challenge.
4. On the site, go to **Curriculum > Add a lesson**, type `passwords` as the challenge id and the answer as the flag.
