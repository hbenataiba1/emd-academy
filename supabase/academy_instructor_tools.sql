-- Coupons created by instructors: who owns them.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/academy_instructors.sql and supabase/academy_coupons.sql first.)

alter table public.coupons add column if not exists instructor_id uuid references auth.users(id) on delete set null;
create index if not exists idx_coupons_instructor on public.coupons(instructor_id);
