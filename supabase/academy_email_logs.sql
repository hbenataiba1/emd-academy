-- Automated emails: a log of every email the Academy sends (shown in the CRM).
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  template_name text,
  recipient_email text not null,
  recipient_name text,
  recipient_user_id uuid references auth.users(id) on delete set null,
  subject text,
  -- queued | sent | delivered | opened | clicked | failed | bounced | complained
  status text not null default 'queued',
  provider text not null default 'microsoft',
  provider_message_id text,
  -- Stops an email that must be sent once (like the welcome) from going out twice.
  dedupe_key text unique,
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  click_count integer not null default 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_created on public.email_logs(created_at desc);
create index if not exists idx_email_logs_template on public.email_logs(template_key, created_at desc);
create index if not exists idx_email_logs_message on public.email_logs(provider_message_id);

-- Only the server (service role) reads or writes this table.
alter table public.email_logs enable row level security;
