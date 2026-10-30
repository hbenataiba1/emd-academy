-- Where to send an instructor's money: the method they chose and their details.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/academy_instructors.sql first.)

create table if not exists public.instructor_payment_details (
  instructor_id uuid primary key references auth.users(id) on delete cascade,
  -- bank, paypal, wise or other
  method text not null check (method in ('bank', 'paypal', 'wise', 'other')),
  -- The fields of the chosen method (account holder, IBAN, PayPal email...).
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Only the server (service role) reads or writes this table.
alter table public.instructor_payment_details enable row level security;
