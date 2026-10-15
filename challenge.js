// Small helpers used by every page: finding elements, safe text, messages,
// tooltips, dates and times, and wiring up buttons and forms

export function $(selector) {
    return document.querySelector(selector);
}

// Makes text safe to put inside HTML (so a name like <b>Bob</b> shows as text)
// ALWAYS use this for anything typed by a user.
export function esc(text) {
    if (text === null || text === undefined) {
        return '';
    }
    return String(text).replace(/[&<>"']/g, function (c) {
        return '&#' + c.charCodeAt(0) + ';';
    });
}

// Shows a green (good) or red (bad) message in an element with class "msg"
export function showMessage(element, text, isError) {
    element.textContent = text;
    element.className = isError ? 'msg bad' : 'msg good';
}

// Only allows normal web links and links to our challenge pages, so nobody
// can sneak a "javascript:" link into a lesson! Returns '' for anything else
export function safeUrl(url) {
    if (/^(https?:\/\/|challenges\/)/.test(url || '')) {
        return url;
    }
    return '';
}

// A short message that pops up at the bottom of the screen for a few seconds
export function toast(text, isError) {
    const box = document.createElement('div');
    box.className = isError ? 'toast bad-toast' : 'toast';
    box.textContent = text;
    document.body.appendChild(box);
    setTimeout(function () {
        box.remove();
    }, isError ? 6000 : 3000);
}

// A little "?" bubble you can hover over (or tap) to see a tooltip type thing
export function tip(text) {
    return '<span class="tip" tabindex="0" role="note" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">?</span>';
}

// Today's date in as YYYY-MM-DD
export function todayInSydney() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

// "2026-10-15" becomes "Thu 15 Oct 2026"
export function formatDay(isoDay) {
    const parts = isoDay.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// 75 becomes "1:15", 3725 becomes "1:02:05"
export function formatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = String(s % 60).padStart(2, '0');
    if (hours > 0) {
        return hours + ':' + String(minutes).padStart(2, '0') + ':' + seconds;
    }
    return minutes + ':' + seconds;
}

// 1 becomes "1st", 2 becomes "2nd", 11 becomes "11th"
export function ordinal(n) {
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) {
        return n + 'th';
    }
    const endings = { 1: 'st', 2: 'nd', 3: 'rd' };
    return n + (endings[n % 10] || 'th');
}

// White or dark text, whichever is easier to read on a background colour
export function textColourFor(hex) {
    if (!hex) {
        return '#1d2340';
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#1d2340' : '#fff';
}

// A coloured team name tag. Teams without a colour (solo players) get a plain tag
export function teamTag(name, colour) {
    if (!colour) {
        return '<span class="team-tag plain">' + esc(name) + '</span>';
    }
    return '<span class="team-tag" style="background:' + esc(colour) + ';color:' + textColourFor(colour) + '">' + esc(name) + '</span>';
}

// Runs an async function and shows any error as a red toast instead of failing silently
export async function runSafely(work) {
    try {
        await work();
    } catch (err) {
        toast(err.message, true);
    }
}

// Buttons: any element with data-action="something" inside `container` runs
// handlers.something(element.dataset, element) when clicked
// Example: <button data-action="remove" data-id="5"> runs handlers.remove({ action: 'remove', id: '5' })
export function onAction(container, handlers) {
    container.addEventListener('click', function (event) {
        const button = event.target.closest('[data-action]');
        if (!button || !container.contains(button)) {
            return;
        }
        const handler = handlers[button.dataset.action];
        if (handler) {
            // Stop links/buttons doing their normal thing, but let checkboxes tick
            if (button.tagName !== 'INPUT') {
                event.preventDefault();
            }
            runSafely(function () {
                return handler(button.dataset, button);
            });
        }
    });
}

// Dropdowns: any <select data-change="something"> inside `container` runs
// handlers.something(select.dataset, select) when a new option is chosen
export function onChange(container, handlers) {
    container.addEventListener('change', function (event) {
        const select = event.target.closest('[data-change]');
        if (!select || !container.contains(select)) {
            return;
        }
        const handler = handlers[select.dataset.change];
        if (handler) {
            runSafely(function () {
                return handler(select.dataset, select);
            });
        }
    });
}

// Forms: any <form data-form="something"> inside `container` runs
// handlers.something(form) when submitted. The page doesn't reload
export function onForm(container, handlers) {
    container.addEventListener('submit', function (event) {
        const form = event.target;
        const handler = handlers[form.dataset.form];
        if (handler) {
            event.preventDefault();
            runSafely(function () {
                return handler(form);
            });
        }
    });
}

// Wraps button/form handlers so the page redraws (by calling `redraw`) after
// each one finishes. A handler can return false to skip the redraw, for
// example when the user clicked Cancel
export function redrawAfter(handlers, redraw) {
    const wrapped = {};
    Object.keys(handlers).forEach(function (name) {
        wrapped[name] = async function (data, element) {
            const result = await handlers[name](data, element);
            if (result !== false) {
                await redraw();
            }
        };
    });
    return wrapped;
}

// Calls `work` now and then every `ms` milliseconds. If one call is slow,
// the next one waits for it, so they never pile up
export function repeat(work, ms) {
    let busy = false;
    async function tick() {
        if (busy) {
            return;
        }
        busy = true;
        try {
            await work();
        } catch (err) {
            console.error(err);
        }
        busy = false;
    }
    tick();
    return setInterval(tick, ms);
}
