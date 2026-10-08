import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const say = (el, msg, bad) => { el.textContent = msg; el.className = bad ? 'msg bad' : 'msg good'; };

// Flag box used on every challenge page. The answer is checked on the server (submit_flag).
export function flagForm(slug) {
  const f = $('#flag');
  f.innerHTML = '<label>Your answer<input name="a" autocomplete="off" required></label><button>Check answer</button><p id="r" class="msg"></p>';
  f.onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await sb.rpc('submit_flag', { ch: slug, ans: f.a.value });
    say($('#r'), error ? error.message : data ? 'Correct! You got in.' : 'Not quite. Have another look and try again.', error || !data);
  };
}
