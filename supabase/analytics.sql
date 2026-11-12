-- Analytics for the PE Midterm site.
-- Run this in the site's Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again any time (after an update to this file). It never deletes visitors' data,
-- except the owner's own visits (see exclude_visitor below).
-- To start the numbers over from 0, run reset_stats.sql instead.

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
create index if not exists events_visitor_idx on public.events (visitor_id);

-- ---------------------------------------------------------------
-- The secret key from the hidden Stats link. Only its SHA-256 hash is stored here.
-- ---------------------------------------------------------------
create or replace function public.stats_key_ok(key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select encode(pg_catalog.sha256(convert_to(coalesce(key, ''), 'UTF8')), 'hex')
         = '32b267651b816095a13a2c0a0b6c0ad6031f94cd08305b8d9a2280b8e97590a3';
$$;
revoke all on function public.stats_key_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- The owner's devices. Every device that opens the secret link is added here:
-- its past visits are deleted and it can never be counted again.
-- ---------------------------------------------------------------
create table if not exists public.excluded_visitors (
  visitor_id uuid primary key,
  added_at   timestamptz not null default now()
);
alter table public.excluded_visitors enable row level security;
revoke all on public.excluded_visitors from anon, authenticated;

create or replace function public.is_excluded(visitor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.excluded_visitors where visitor_id = visitor);
$$;
revoke all on function public.is_excluded(uuid) from public;
grant execute on function public.is_excluded(uuid) to anon;

create or replace function public.exclude_visitor(key text, visitor uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.stats_key_ok(key) or visitor is null then
    return false;
  end if;
  insert into public.excluded_visitors (visitor_id) values (visitor) on conflict do nothing;
  delete from public.events where visitor_id = visitor;
  return true;
end;
$$;
revoke all on function public.exclude_visitor(text, uuid) from public;
grant execute on function public.exclude_visitor(text, uuid) to anon;

-- ---------------------------------------------------------------
-- The site can only ADD rows, and never for an excluded device.
-- Nobody with the public key can read, change or delete them.
-- ---------------------------------------------------------------
alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant insert (visitor_id, session_id, name, page, props, referrer, screen_w, standalone)
  on public.events to anon;

drop policy if exists "site can insert events" on public.events;
create policy "site can insert events" on public.events
  for insert to anon with check (not public.is_excluded(visitor_id));

-- ---------------------------------------------------------------
-- Private stats for the hidden Stats link. Wrong key: null.
-- Returns totals only: never visitor ids or single rows.
-- ---------------------------------------------------------------
drop function if exists public.public_stats();

create or replace function public.private_stats(key text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result json;
  today timestamptz := date_trunc('day', now());
begin
  if not public.stats_key_ok(key) then
    return null;
  end if;

  with e as materialized (
    select ev.* from public.events ev
    where not exists (select 1 from public.excluded_visitors x where x.visitor_id = ev.visitor_id)
  ),
  visitors as (
    select visitor_id,
           min(created_at) as first_at,
           count(distinct date_trunc('day', created_at)) as days
    from e group by visitor_id
  ),
  sessions as (
    select session_id, count(*) as n,
           extract(epoch from max(created_at) - min(created_at)) as secs
    from e group by session_id
  ),
  devices as (
    select distinct on (visitor_id) visitor_id, screen_w, standalone
    from e where screen_w is not null
    order by visitor_id, created_at desc
  ),
  starts as (
    select props from e where name = 'session_start'
  ),
  qa as (
    select props->>'q' as q, max(props->>'t') as t, count(*) as n,
           count(*) filter (where (props->>'right')::boolean) as r
    from e where name = 'question_answered' group by 1
  )
  select json_build_object(
    'since',            (select to_char(min(created_at), 'YYYY-MM-DD') from e),
    'visitors_total',   (select count(*) from visitors),
    'sessions_total',   (select count(*) from sessions),
    'views_total',      (select count(*) from e where name = 'page_view'),
    'visitors_today',   (select count(distinct visitor_id) from e where created_at >= today),
    'new_today',        (select count(*) from visitors where first_at >= today),
    'returning',        (select count(*) from visitors where days >= 2),
    'avg_session_min',  (select round((avg(secs) / 60)::numeric, 1) from sessions where n > 1),
    'tests_started',    (select count(*) from e where name = 'test_started'),
    'tests_total',      (select count(*) from e where name = 'test_finished'),
    'avg_score',        (select round(avg((props->>'right')::numeric
                                       / nullif((props->>'total')::numeric, 0)) * 100)
                         from e where name = 'test_finished'),
    'questions',        (select coalesce(sum(n), 0) from qa),
    'questions_pct',    (select round(sum(r)::numeric / nullif(sum(n), 0) * 100) from qa),
    'cards',            (select count(*) from e where name = 'card_rated'),
    'cards_pct',        (select round(avg(case when (props->>'known')::boolean then 1 else 0 end) * 100)
                         from e where name = 'card_rated'),
    'drills',           (select count(*) from e where name = 'drill_answered'),
    'drills_pct',       (select round(avg(case when (props->>'right')::boolean then 1 else 0 end) * 100)
                         from e where name = 'drill_answered'),
    'muscle',           (select count(*) from e where name = 'muscle_quiz'),
    'muscle_pct',       (select round(avg(case when (props->>'right')::boolean then 1 else 0 end) * 100)
                         from e where name = 'muscle_quiz'),
    'matches',          (select count(*) from e where name = 'match_finished'),
    'match_avg_sec',    (select round(avg((props->>'ms')::numeric) / 1000) from e where name = 'match_finished'),
    'bookmarks',        (select count(*) from e where name = 'bookmark'),
    'shares',           (select count(*) from e where name = 'share'),
    'feedback',         (select count(*) from e where name = 'feedback_click'),
    'searches',         (select count(*) from e where name = 'search_used'),
    'devices',          (select json_build_object(
                           'phone',     count(*) filter (where screen_w < 700),
                           'tablet',    count(*) filter (where screen_w >= 700 and screen_w < 1100),
                           'computer',  count(*) filter (where screen_w >= 1100),
                           'installed', count(*) filter (where standalone))
                         from devices),
    'dark_pct',         (select round(avg(case when props->>'theme' = 'dark' then 1 else 0 end) * 100) from starts),
    'simple_pct',       (select round(avg(case when (props->>'simple')::boolean then 1 else 0 end) * 100) from starts),
    'top_pages',        (select coalesce(json_agg(t), '[]'::json) from (
                           select page, count(*) as views from e
                           where name = 'page_view'
                           group by page order by views desc limit 8) t),
    'tests_by_scope',   (select coalesce(json_agg(t), '[]'::json) from (
                           select props->>'scope' as scope, count(*) as runs,
                                  round(avg((props->>'right')::numeric
                                            / nullif((props->>'total')::numeric, 0)) * 100) as pct
                           from e where name = 'test_finished'
                           group by 1 order by runs desc limit 8) t),
    'missed',           (select coalesce(json_agg(m), '[]'::json) from (
                           select q, t, n, round((n - r)::numeric / n * 100) as miss_pct
                           from qa where n >= 3
                           order by (n - r)::numeric / n desc, n desc limit 8) m),
    'search_picks',     (select coalesce(json_agg(t), '[]'::json) from (
                           select props->>'picked' as title, count(*) as n
                           from e where name = 'search_used' and props->>'picked' is not null
                           group by 1 order by n desc limit 8) t),
    'referrers',        (select coalesce(json_agg(t), '[]'::json) from (
                           select substring(referrer from '^https?://([^/:]+)') as site, count(distinct visitor_id) as n
                           from e where referrer is not null
                             and substring(referrer from '^https?://([^/:]+)') <> 'ibbucoder.github.io'
                           group by 1 order by n desc limit 6) t),
    'hours',            (select coalesce(json_agg(t order by t.hour), '[]'::json) from (
                           select (props->>'hour')::int as hour, count(*) as n
                           from starts where props ? 'hour'
                           group by 1) t),
    'daily',            (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                           select to_char(g.day, 'YYYY-MM-DD') as day,
                                  count(distinct e.visitor_id) as visitors,
                                  count(*) filter (where e.name = 'page_view') as views
                           from generate_series(
                                  coalesce((select date_trunc('day', min(created_at)) from e), today),
                                  today, interval '1 day') as g(day)
                           left join e
                             on e.created_at >= g.day and e.created_at < g.day + interval '1 day'
                           group by g.day) d)
  ) into result;

  return result;
end;
$$;

revoke all on function public.private_stats(text) from public;
grant execute on function public.private_stats(text) to anon;
