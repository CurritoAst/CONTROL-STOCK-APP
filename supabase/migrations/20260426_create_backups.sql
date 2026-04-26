-- Backups table: stores point-in-time snapshots of the entire database state.
-- Each row contains the full payload (products, events, daily_logs, log_items)
-- as a JSONB blob, plus metadata for the UI.
--
-- Usage:
--   1. Open Supabase SQL editor
--   2. Paste this file and run
--
-- After running, the app's "Copias de Seguridad" tab will start working.

create table if not exists public.backups (
    id           text primary key,
    created_at   timestamptz not null default now(),
    label        text,                                  -- human readable label
    trigger_type text not null default 'manual',        -- manual | auto-approve | auto-edit | auto-delete | auto-restore | scheduled
    description  text,                                  -- extra context (e.g. which log was edited)
    payload      jsonb not null,                        -- full backup data
    products_count integer,
    events_count integer,
    daily_logs_count integer,
    log_items_count integer,
    size_bytes   bigint
);

-- Index for chronological listing (most recent first)
create index if not exists backups_created_at_idx
    on public.backups (created_at desc);

-- RLS: allow anyone with the anon key to read/insert/delete (matches existing app pattern)
alter table public.backups enable row level security;

drop policy if exists "backups_all_anon" on public.backups;
create policy "backups_all_anon"
    on public.backups
    for all
    to anon, authenticated
    using (true)
    with check (true);
