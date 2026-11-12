-- Analytics table for the PE Midterm site.
-- Run this once in a NEW Supabase project: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  uuid not null,
  session_id  uuid not null,
  name        text not null check (char_length(name) between 1 and 64),
  page        text check (char_length(page) <= 64),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  referrer    text check (char_length(referrer) <= 255),
  screen_w    int,
  standalone  boolean
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_name_idx on public.events (name, created_at desc);

-- The site can only ADD rows. Nobody with the public key can read, change or delete them.
alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant insert (visitor_id, session_id, name, page, props, referrer, screen_w, standalone)
  on public.events to anon;

drop policy if exists "site can insert events" on public.events;
create policy "site can insert events" on public.events
  for insert to anon with check (true);

-- ---------------------------------------------------------------
-- Handy queries (run in the SQL Editor; they use your admin access)
-- ---------------------------------------------------------------
-- Visitors and page views per day:
--   select date_trunc('day', created_at) as day,
--          count(distinct visitor_id) as visitors,
--          count(*) filter (where name = 'page_view') as views
--   from events group by 1 order by 1 desc;
--
-- Most visited pages:
--   select page, count(*) from events where name = 'page_view'
--   group by 1 order by 2 desc;
--
-- Test results by scope:
--   select props->>'scope' as scope, count(*) as runs,
--          round(avg((props->>'right')::numeric / nullif((props->>'total')::numeric, 0)) * 100) as avg_pct
--   from events where name = 'test_finished' group by 1 order by 2 desc;
