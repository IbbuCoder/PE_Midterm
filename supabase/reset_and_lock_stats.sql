-- Run ONCE in the site's Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- 1. Deletes every recorded event, so the stats start again from 0.
-- 2. Removes the old public_stats() that anyone could call.
-- 3. Adds private_stats(key), which only answers with the secret key from the hidden link.

truncate table public.events restart identity;

-- ---------------------------------------------------------------
-- Private stats for the hidden Stats link.
-- Only works with the secret key from the link. Only its SHA-256 hash is stored here.
-- Returns totals only: never visitor ids or single rows.
-- ---------------------------------------------------------------
create or replace function public.private_stats(key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when encode(pg_catalog.sha256(convert_to(coalesce(key, ''), 'UTF8')), 'hex')
              = '32b267651b816095a13a2c0a0b6c0ad6031f94cd08305b8d9a2280b8e97590a3'
  then json_build_object(
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
  ) end;
$$;

drop function if exists public.public_stats();
revoke all on function public.private_stats(text) from public;
grant execute on function public.private_stats(text) to anon;
