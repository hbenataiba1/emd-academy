-- End-of-course survey: a star rating and a short comment from each learner.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Name and email as they were when the review was sent.
  learner_name text,
  learner_email text,
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per learner per course (sending again updates it).
  unique (user_id, course_id)
);

create index if not exists idx_course_reviews_course on public.course_reviews(course_id, created_at desc);

-- Only the server (service role) reads or writes this table.
alter table public.course_reviews enable row level security;
