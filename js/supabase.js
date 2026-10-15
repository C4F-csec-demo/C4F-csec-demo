// Connects to the database (Supabase) and has small helpers for talking to it.
// Every page imports `sb`, `callDb` and `must` from here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Runs one of the database functions from 1-setup.sql.
// Returns its result, or throws an Error with a readable message.
export async function callDb(functionName, args) {
    const result = await sb.rpc(functionName, args || {});
    return must(result);
}

// For table queries: returns the rows, or throws if something went wrong.
// Example: const classes = must(await sb.from('classes').select('*'));
export function must(result) {
    if (result.error) {
        throw new Error(friendlyError(result.error));
    }
    return result.data;
}

// Turns a few common database errors into plain English.
function friendlyError(error) {
    if (error.code === '23505') {
        return 'That already exists (for example, the same lesson on the same day, or a name that\'s taken).';
    }
    if (error.code === '42501') {
        return 'You don\'t have permission to do that.';
    }
    return error.message;
}

// Who is logged in. Returns null if nobody, otherwise an object like:
// { role: 'student' | 'teacher' | 'admin' | 'pending' | 'none', name: '...', class_name: '...' }
export async function whoami() {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) {
        return null;
    }
    return callDb('whoami');
}

export async function signOutAndGo(page) {
    await sb.auth.signOut();
    location.href = page;
}
