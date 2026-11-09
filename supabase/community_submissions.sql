-- Learners can send us the link of their LinkedIn post (from the "Share on LinkedIn" window).
-- The post waits in the CRM (Academy > Community) until the team approves it; only then it
-- appears in "Community & Recognition" on the Academy home page.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/community_posts.sql first if you have not already.)

alter table public.community_posts
  add column if not exists status text not null default 'approved',
  add column if not exists submitted_by uuid,
  add column if not exists submitter_email text,
  add column if not exists certificate_number text,
  -- When the learner agreed that we may show their post and name.
  add column if not exists consent_at timestamptz;

alter table public.community_posts drop constraint if exists community_posts_status_check;
alter table public.community_posts
  add constraint community_posts_status_check check (status in ('pending', 'approved', 'rejected'));

create index if not exists community_posts_status_idx
  on public.community_posts (status, created_at desc);

-- Posts that already existed stay approved. New learner posts start as 'pending' and hidden
-- (is_published = false), so the public policy (only published posts) never shows them.
