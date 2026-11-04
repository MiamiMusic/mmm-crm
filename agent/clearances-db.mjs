#!/usr/bin/env node
// Clearance Agent ↔ Supabase bridge.
//   node agent/clearances-db.mjs list              → prints all clearances as JSON
//   node agent/clearances-db.mjs upsert file.json  → upserts an array of clearances (matched on thread_id)
//
// The service-role key lives OUTSIDE the repo in ~/.mmm-agent/.env:
//   SUPABASE_SERVICE_KEY=eyJ...
// Never commit that key: it bypasses row-level security.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SUPABASE_URL = 'https://honyobysbyhxaqmgduuc.supabase.co';
const ENV_PATH = join(homedir(), '.mmm-agent', '.env');

function loadKey() {
  if (process.env.SUPABASE_SERVICE_KEY) return process.env.SUPABASE_SERVICE_KEY;
  try {
    const line = readFileSync(ENV_PATH, 'utf8').split('\n').find(l => l.startsWith('SUPABASE_SERVICE_KEY='));
    if (line) return line.slice('SUPABASE_SERVICE_KEY='.length).trim();
  } catch {}
  console.error(`Missing SUPABASE_SERVICE_KEY. Put it in ${ENV_PATH}`);
  process.exit(2);
}

const KEY = loadKey();
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// Columns the agent may write. team_notes and owner are the team's and are never sent.
const AGENT_FIELDS = ['thread_id', 'song', 'artist', 'producer', 'label', 'counterparty', 'counterparty_email',
  'doc_type', 'stage', 'waiting_on', 'next_action', 'agent_summary', 'last_activity', 'thread_url'];
const STAGES = ['negotiating', 'draft_received', 'in_review', 'out_for_signature', 'executed', 'payment', 'closed', 'on_hold'];

async function list() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clearances?select=*&order=last_activity.desc.nullslast`, { headers });
  if (!res.ok) throw new Error(`list failed ${res.status}: ${await res.text()}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function upsert(file) {
  const input = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(input)) throw new Error('upsert file must be a JSON array');
  const rows = input.map((r, i) => {
    if (!r.thread_id || !r.song) throw new Error(`row ${i} needs thread_id and song`);
    if (r.stage && !STAGES.includes(r.stage)) throw new Error(`row ${i} has bad stage "${r.stage}"`);
    if (r.waiting_on && !['us', 'them'].includes(r.waiting_on)) throw new Error(`row ${i} waiting_on must be us|them`);
    const out = { updated_at: new Date().toISOString() };
    for (const k of AGENT_FIELDS) if (r[k] !== undefined) out[k] = r[k];
    return out;
  });
  if (!rows.length) { console.log('nothing to upsert'); return; }
  // PostgREST needs every row in a bulk upsert to have the same keys
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const uniform = rows.map(r => Object.fromEntries(keys.map(k => [k, r[k] ?? null])));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clearances?on_conflict=thread_id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(uniform),
  });
  if (!res.ok) throw new Error(`upsert failed ${res.status}: ${await res.text()}`);
  console.log(`upserted ${rows.length} clearance(s)`);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'list') await list();
  else if (cmd === 'upsert' && arg) await upsert(arg);
  else { console.error('usage: clearances-db.mjs list | upsert <file.json>'); process.exit(1); }
} catch (e) { console.error(e.message); process.exit(1); }
