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

-- ---------------------------------------------------------------
-- Public lifetime stats for the site's Stats page.
-- Returns totals only: never visitor ids or single rows.
-- ---------------------------------------------------------------
create or replace function public.public_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'since',          (select to_char(min(created_at), 'YYYY-MM-DD') from public.events),
    'visitors_total', (select count(distinct visitor_id) from public.events),
    'sessions_total', (select count(distinct session_id) from public.events),
    'views_total',    (select count(*) from public.events where name = 'page_view'),
    'visitors_today', (select count(distinct visitor_id) from public.events
                       where created_at >= date_trunc('day', now())),
    'tests_total',    (select count(*) from public.events where name = 'test_finished'),
    'avg_score',      (select round(avg((props->>'right')::numeric
                                      / nullif((props->>'total')::numeric, 0)) * 100)
                       from public.events where name = 'test_finished'),
    'top_pages',      (select coalesce(json_agg(t), '[]'::json) from (
                         select page, count(*) as views from public.events
                         where name = 'page_view'
                         group by page order by views desc limit 8) t),
    'daily',          (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                         select to_char(g.day, 'YYYY-MM-DD') as day,
                                count(distinct e.visitor_id) as visitors
                         from generate_series(
                                coalesce((select date_trunc('day', min(created_at)) from public.events),
                                         date_trunc('day', now())),
                                date_trunc('day', now()), interval '1 day') as g(day)
                         left join public.events e
                           on e.created_at >= g.day and e.created_at < g.day + interval '1 day'
                         group by g.day) d)
  );
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon;
