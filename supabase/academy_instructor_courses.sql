-- Courses written by instructors: who owns them and where they are in the review.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/academy_instructors.sql first.)

-- The instructor who created the course (empty for the Academy's own courses).
alter table public.courses add column if not exists instructor_id uuid references auth.users(id) on delete set null;

-- draft -> in_review -> (changes_requested -> in_review ...) -> approved (published by the team).
-- The Academy's own courses are simply 'approved'.
alter table public.courses add column if not exists review_status text not null default 'approved';
alter table public.courses drop constraint if exists courses_review_status_check;
alter table public.courses add constraint courses_review_status_check
  check (review_status in ('draft', 'in_review', 'changes_requested', 'approved'));

-- What the team asked the instructor to change, and when the course was sent.
alter table public.courses add column if not exists review_note text;
alter table public.courses add column if not exists submitted_at timestamptz;

create index if not exists idx_courses_instructor on public.courses(instructor_id);
create index if not exists idx_courses_review on public.courses(review_status);

-- One presentation (slides) for the whole course, shown in every lesson of the player.
alter table public.courses add column if not exists presentation_url text;
