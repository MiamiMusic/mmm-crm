-- Record clearance tracker, filled by the daily Clearance Agent and edited by the team in the CRM.
-- Run once in Supabase → SQL Editor.

create table if not exists public.clearances (
  id               bigint generated always as identity primary key,
  thread_id        text unique not null,          -- Gmail thread id (one clearance = one thread)
  song             text not null,
  artist           text,
  producer         text,
  label            text,                          -- label / counterparty company
  counterparty     text,                          -- person we're dealing with (lawyer, A&R, BA)
  counterparty_email text,
  doc_type         text default 'Producer Agreement', -- Producer Agreement, Split Sheet, Sample, Admin, PO/Invoice...
  stage            text not null default 'negotiating',
    -- negotiating | draft_received | in_review | out_for_signature | executed | payment | closed | on_hold
  waiting_on       text,                          -- 'us' or 'them'
  next_action      text,                          -- one line: what has to happen next
  agent_summary    text,                          -- agent's latest read of the thread
  team_notes       text,                          -- written by the team in the CRM; the agent never overwrites it
  last_activity    date,                          -- date of the newest email in the thread
  thread_url       text,
  owner            text default 'Mike',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists clearances_stage_idx on public.clearances (stage);

alter table public.clearances enable row level security;

-- Signed-in CRM users can read and edit. The agent writes with the service-role key, which bypasses RLS.
drop policy if exists "clearances read"   on public.clearances;
drop policy if exists "clearances write"  on public.clearances;
drop policy if exists "clearances update" on public.clearances;
drop policy if exists "clearances delete" on public.clearances;
create policy "clearances read"   on public.clearances for select to authenticated using (true);
create policy "clearances write"  on public.clearances for insert to authenticated with check (true);
create policy "clearances update" on public.clearances for update to authenticated using (true);
create policy "clearances delete" on public.clearances for delete to authenticated using (true);

alter publication supabase_realtime add table public.clearances;
