-- Coupons for paid courses (managed in the CRM, applied at academy checkout).
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'amount')),
  percent_off numeric check (percent_off > 0 and percent_off <= 100),
  amount_off_cents integer check (amount_off_cents > 0),
  currency text not null default 'usd',
  -- Total number of uses across all learners (null = unlimited).
  max_redemptions integer check (max_redemptions > 0),
  -- How many times the same learner can use it.
  max_per_user integer not null default 1 check (max_per_user > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  -- Course ids the coupon works for (null or empty = every paid course).
  course_ids text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (discount_type = 'percent' and percent_off is not null) or
    (discount_type = 'amount' and amount_off_cents is not null)
  )
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null,
  course_id text not null,
  learner_email text,
  stripe_checkout_session_id text unique,
  discount_cents integer not null default 0,
  -- pending = checkout opened, redeemed = payment completed, expired = abandoned/cancelled
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id, status);
create index if not exists idx_coupon_redemptions_user on public.coupon_redemptions(user_id, coupon_id);

-- Only the server (service role) reads or writes these tables.
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
