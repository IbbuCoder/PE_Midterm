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
-- Never returns visitor ids or names: each person is only "Student <number>".
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

  -- Every count comes in two forms: n = total (repeats included), people = unique people.
  with e as materialized (
    select ev.* from public.events ev
    where not exists (select 1 from public.excluded_visitors x where x.visitor_id = ev.visitor_id)
  ),
  -- Active study time, in seconds. Each chunk is capped so one bad row can't skew it.
  st as (
    select visitor_id, session_id, page, created_at,
           least(greatest(coalesce((props->>'secs')::numeric, 0), 0), 600) as secs
    from e where name = 'study_time'
  ),
  visitors as (
    select visitor_id,
           min(created_at) as first_at,
           max(created_at) as last_at,
           count(distinct date_trunc('day', created_at)) as days,
           count(distinct session_id) as sessions
    from e group by visitor_id
  ),
  -- Anonymous labels: Student 1 is the first person ever counted, and so on.
  labels as (
    select visitor_id, row_number() over (order by first_at, visitor_id) as num from visitors
  ),
  -- Each person's latest teacher answer (an empty answer clears it).
  teacher_raw as (
    select distinct on (visitor_id) visitor_id,
           nullif(btrim(left(props->>'teacher', 40)), '') as teacher
    from e where props ? 'teacher'
    order by visitor_id, created_at desc
  ),
  teacher_of as (
    select visitor_id, teacher,
           btrim(regexp_replace(lower(teacher), '[.,\s]+', ' ', 'g')) as tkey
    from teacher_raw where teacher is not null
  ),
  act as (
    select name, count(*) as n, count(distinct visitor_id) as people from e group by name
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
           count(distinct visitor_id) as people,
           count(*) filter (where (props->>'right')::boolean) as r
    from e where name = 'question_answered' group by 1
  ),
  per_person as (
    select v.visitor_id, l.num, t.teacher, v.first_at, v.last_at, v.days, v.sessions,
           coalesce((select sum(secs) from st where st.visitor_id = v.visitor_id), 0) as secs,
           (select count(*) from e where e.visitor_id = v.visitor_id and e.name = 'page_view') as views,
           (select count(*) from e where e.visitor_id = v.visitor_id and e.name = 'question_answered') as questions,
           (select round(avg(case when (props->>'right')::boolean then 1 else 0 end) * 100)
              from e where e.visitor_id = v.visitor_id and e.name = 'question_answered') as q_pct,
           (select count(*) from e where e.visitor_id = v.visitor_id and e.name = 'card_rated') as cards,
           (select count(*) from e where e.visitor_id = v.visitor_id and e.name = 'test_finished') as tests,
           (select round(avg((props->>'right')::numeric / nullif((props->>'total')::numeric, 0)) * 100)
              from e where e.visitor_id = v.visitor_id and e.name = 'test_finished') as avg_score
    from visitors v
    join labels l using (visitor_id)
    left join teacher_of t using (visitor_id)
  )
  select json_build_object(
    'since',            (select to_char(min(created_at), 'YYYY-MM-DD') from e),
    'visitors_total',   (select count(*) from visitors),
    'sessions_total',   (select count(*) from sessions),
    'visitors_today',   (select count(distinct visitor_id) from e where created_at >= today),
    'sessions_today',   (select count(distinct session_id) from e where created_at >= today),
    'new_today',        (select count(*) from visitors where first_at >= today),
    'returning',        (select count(*) from visitors where days >= 2),
    'avg_session_min',  (select round((avg(secs) / 60)::numeric, 1) from sessions where n > 1),
    'activity',         (select coalesce(json_object_agg(name, json_build_object('n', n, 'people', people)), '{}'::json) from act),
    'study_secs',       (select coalesce(sum(secs), 0) from st),
    'study_people',     (select count(distinct visitor_id) from st),
    'study_today_secs', (select coalesce(sum(secs), 0) from st where created_at >= today),
    'study_today_people', (select count(distinct visitor_id) from st where created_at >= today),
    'avg_score',        (select round(avg((props->>'right')::numeric
                                       / nullif((props->>'total')::numeric, 0)) * 100)
                         from e where name = 'test_finished'),
    'questions_pct',    (select round(sum(r)::numeric / nullif(sum(n), 0) * 100) from qa),
    'cards_pct',        (select round(avg(case when (props->>'known')::boolean then 1 else 0 end) * 100)
                         from e where name = 'card_rated'),
    'drills_pct',       (select round(avg(case when (props->>'right')::boolean then 1 else 0 end) * 100)
                         from e where name = 'drill_answered'),
    'muscle_pct',       (select round(avg(case when (props->>'right')::boolean then 1 else 0 end) * 100)
                         from e where name = 'muscle_quiz'),
    'match_avg_sec',    (select round(avg((props->>'ms')::numeric) / 1000) from e where name = 'match_finished'),
    'devices',          (select json_build_object(
                           'phone',     count(*) filter (where screen_w < 700),
                           'tablet',    count(*) filter (where screen_w >= 700 and screen_w < 1100),
                           'computer',  count(*) filter (where screen_w >= 1100),
                           'installed', count(*) filter (where standalone))
                         from devices),
    'dark_pct',         (select round(avg(case when props->>'theme' = 'dark' then 1 else 0 end) * 100) from starts),
    'simple_pct',       (select round(avg(case when (props->>'simple')::boolean then 1 else 0 end) * 100) from starts),
    'top_pages',        (select coalesce(json_agg(x), '[]'::json) from (
                           select p.page, p.views, p.people,
                                  coalesce((select round(sum(secs) / 60) from st where st.page = p.page), 0) as mins
                           from (select page, count(*) as views, count(distinct visitor_id) as people
                                 from e where name = 'page_view' group by page) p
                           order by p.views desc limit 10) x),
    'tests_by_scope',   (select coalesce(json_agg(x), '[]'::json) from (
                           select props->>'scope' as scope, count(*) as runs, count(distinct visitor_id) as people,
                                  round(avg((props->>'right')::numeric
                                            / nullif((props->>'total')::numeric, 0)) * 100) as pct
                           from e where name = 'test_finished'
                           group by 1 order by runs desc limit 8) x),
    'missed',           (select coalesce(json_agg(m), '[]'::json) from (
                           select q, t, n, people, round((n - r)::numeric / n * 100) as miss_pct
                           from qa where n >= 3
                           order by (n - r)::numeric / n desc, n desc limit 8) m),
    'search_picks',     (select coalesce(json_agg(x), '[]'::json) from (
                           select props->>'picked' as title, count(*) as n, count(distinct visitor_id) as people
                           from e where name = 'search_used' and props->>'picked' is not null
                           group by 1 order by n desc limit 8) x),
    'referrers',        (select coalesce(json_agg(x), '[]'::json) from (
                           select substring(referrer from '^https?://([^/:]+)') as site,
                                  count(*) as n, count(distinct visitor_id) as people
                           from e where referrer is not null
                             and substring(referrer from '^https?://([^/:]+)') <> 'ibbucoder.github.io'
                           group by 1 order by people desc limit 6) x),
    'hours',            (select coalesce(json_agg(x order by x.hour), '[]'::json) from (
                           select (props->>'hour')::int as hour, count(*) as n
                           from starts where props ? 'hour'
                           group by 1) x),
    'teachers',         (select coalesce(json_agg(x), '[]'::json) from (
                           select mode() within group (order by t.teacher) as name,
                                  count(*) as people,
                                  sum(pp.sessions) as sessions,
                                  round(sum(pp.secs) / 60) as mins,
                                  sum(pp.tests) as tests,
                                  round(avg(pp.avg_score)) as avg_score
                           from teacher_of t join per_person pp using (visitor_id)
                           group by t.tkey order by people desc, mins desc limit 30) x),
    'no_teacher',       (select count(*) from visitors v where not exists (select 1 from teacher_of t where t.visitor_id = v.visitor_id)),
    'students',         (select coalesce(json_agg(x), '[]'::json) from (
                           select num, teacher,
                                  to_char(first_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as first_seen,
                                  to_char(last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_seen,
                                  days, sessions, round(secs / 60) as mins, views,
                                  questions, q_pct, cards, tests, avg_score
                           from per_person
                           order by secs desc, last_at desc limit 300) x),
    -- Time log: the latest 150 visits, each with start and end time (UTC; the page shows local time).
    'visits_log',       (select coalesce(json_agg(x order by x.started desc), '[]'::json) from (
                           select l.num, tt.teacher,
                                  to_char(min(e.created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as started,
                                  to_char(max(e.created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ended,
                                  round(coalesce(sum(least(greatest(coalesce((e.props->>'secs')::numeric, 0), 0), 600))
                                                 filter (where e.name = 'study_time'), 0) / 60) as mins,
                                  count(*) filter (where e.name = 'page_view') as views,
                                  count(*) filter (where e.name = 'question_answered') as questions,
                                  count(*) filter (where e.name = 'card_rated') as cards,
                                  count(*) filter (where e.name = 'test_finished') as tests,
                                  (array_agg(e.page order by e.created_at) filter (where e.name = 'page_view'))[1:6] as pages
                           from e join labels l using (visitor_id)
                           left join teacher_of tt using (visitor_id)
                           group by e.session_id, l.num, tt.teacher
                           order by min(e.created_at) desc limit 150) x),
    'daily',            (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                           select to_char(g.day, 'YYYY-MM-DD') as day,
                                  count(distinct e.visitor_id) as visitors,
                                  count(distinct e.session_id) as sessions,
                                  count(*) filter (where e.name = 'page_view') as views,
                                  coalesce(round(sum(least(greatest(coalesce((e.props->>'secs')::numeric, 0), 0), 600))
                                                 filter (where e.name = 'study_time') / 60), 0) as mins
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
