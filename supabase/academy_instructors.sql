-- Instructor applications: people who want to teach on the Academy.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.instructors (
  -- One application per account: the same login as a learner.
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  full_name text not null,
  email text not null,
  headline text,
  country text,
  company text,
  job_title text,
  years_experience integer check (years_experience between 0 and 80),
  background text not null,
  teaching_topics text,
  linkedin_url text not null,
  website_url text,
  -- Share of each sale the Academy keeps (used for payouts, set per instructor).
  commission_percent numeric(5,2) not null default 30 check (commission_percent between 0 and 100),
  -- Answer of the Academy team.
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instructors_status on public.instructors(status, submitted_at desc);

-- Only the server (service role) reads or writes this table.
alter table public.instructors enable row level security;
