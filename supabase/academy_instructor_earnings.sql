-- What instructors earn from their courses, and the payouts the team sends them.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/academy_instructors.sql first.)

-- Payments sent to an instructor (recorded by the team in the CRM).
create table if not exists public.instructor_payouts (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  method text not null,
  reference text,
  note text,
  paid_by text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_instructor_payouts_instructor on public.instructor_payouts(instructor_id, paid_at desc);

-- One row per sale of an instructor course, and one negative row per refund.
create table if not exists public.instructor_earnings (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  kind text not null default 'sale' check (kind in ('sale', 'refund')),
  -- A refund points to the sale it reduces.
  parent_id uuid references public.instructor_earnings(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  user_id uuid,
  learner_email text,
  learner_name text,
  -- Money paid by the learner (negative for a refund).
  gross_cents integer not null,
  -- Share of the Academy at the time of the sale.
  commission_percent numeric(5,2) not null,
  platform_cents integer not null,
  -- What the instructor earns (negative for a refund).
  net_cents integer not null,
  currency text not null default 'usd',
  -- pending = not paid out yet. It can be paid out once available_at has passed.
  status text not null default 'pending' check (status in ('pending', 'paid')),
  available_at timestamptz not null,
  payout_id uuid references public.instructor_payouts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_instructor_earnings_instructor on public.instructor_earnings(instructor_id, status, available_at);
create index if not exists idx_instructor_earnings_intent on public.instructor_earnings(stripe_payment_intent_id);
create index if not exists idx_instructor_earnings_parent on public.instructor_earnings(parent_id);

-- Only the server (service role) reads or writes these tables.
alter table public.instructor_payouts enable row level security;
alter table public.instructor_earnings enable row level security;
