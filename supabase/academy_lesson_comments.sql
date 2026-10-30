-- Comments under each lesson: learners write, everyone enrolled reads, the team replies from the CRM.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  lesson_id text not null,
  -- The learner who wrote it. Empty for a reply written by the team from the CRM.
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_email text,
  -- Profile picture of the learner when they wrote it.
  author_avatar text,
  is_staff boolean not null default false,
  -- A reply points to the comment it answers (replies are one level deep).
  parent_id uuid references public.lesson_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Already ran an earlier version of this file? This adds the picture column.
alter table public.lesson_comments add column if not exists author_avatar text;

create index if not exists idx_lesson_comments_lesson on public.lesson_comments(course_id, lesson_id, created_at);
create index if not exists idx_lesson_comments_parent on public.lesson_comments(parent_id);

-- Only the server (service role) reads or writes this table.
alter table public.lesson_comments enable row level security;
