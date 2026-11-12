-- Starts the stats over from 0: deletes every recorded event.
-- Run in the site's Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- The list of your own devices (excluded_visitors) is kept, so they stay uncounted.
truncate table public.events restart identity;
