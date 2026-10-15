// Timers for the Live CTF screens.
//
// Computers' clocks are never exactly the same, so we work out how far this
// computer's clock is from the database's clock, and use the database's time.
//
// To show a timer, put one of these in the HTML:
//   <span data-since="2026-10-15T01:00:00Z"></span>   counts up from that time
//   <span data-until="2026-10-15T01:30:00Z"></span>   counts down to that time
// startClocks() then updates them 4 times a second.

import { formatClock } from './ui.js';

let offsetMs = 0;

// Call this with the "now" time the database sends back.
export function syncClock(serverNowIso) {
    offsetMs = new Date(serverNowIso).getTime() - Date.now();
}

export function serverNow() {
    return Date.now() + offsetMs;
}

export function secondsBetween(fromIso, toMs) {
    return (toMs - new Date(fromIso).getTime()) / 1000;
}

export function updateClocks() {
    const now = serverNow();
    document.querySelectorAll('[data-since]').forEach(function (el) {
        el.textContent = formatClock(secondsBetween(el.dataset.since, now));
    });
    document.querySelectorAll('[data-until]').forEach(function (el) {
        const left = -secondsBetween(el.dataset.until, now);
        el.textContent = formatClock(left);
        el.classList.toggle('urgent', left < 60);
    });
}

export function startClocks() {
    updateClocks();
    setInterval(updateClocks, 250);
}
