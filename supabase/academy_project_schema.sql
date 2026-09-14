-- Easy Medical Device Academy schema for the separate Academy Supabase project.
-- Run this in the NEW Academy Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  slug text unique not null,
  title text not null,
  subtitle text,
  description text,
  category text not null default 'EU MDR',
  instructor text not null default 'Monir El Azzouzi',
  instructor_role text default 'MedTech Regulatory Expert',
  level text default 'Intermediate',
  duration text default '5 hours',
  lesson_count integer not null default 0,
  rating numeric not null default 4.8,
  learner_count integer not null default 0,
  price_cents integer not null default 0,
  price_label text not null default 'Free',
  badge text,
  thumbnail_url text,
  accent text not null default '#7c3aed',
  outcomes jsonb not null default '[]'::jsonb,
  stripe_price_id text,
  stripe_price_env text,
  sort_order integer not null default 100,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  section_title text not null default 'General',
  title text not null,
  lesson_type text not null default 'video',
  duration_minutes integer not null default 10,
  video_url text,
  sort_order integer not null default 100,
  preview_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  learner_email text not null,
  learner_name text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  learner_email text not null,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learner_email text not null,
  course_id text not null references public.courses(id) on delete cascade,
  lesson_id text not null,
  completed boolean not null default false,
  progress_percent integer not null default 0,
  last_accessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  certificate_number text unique not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_courses_published on public.courses(is_published, sort_order);
create index if not exists idx_enrollments_user on public.enrollments(user_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_progress_user_course on public.lesson_progress(user_id, course_id);
create index if not exists idx_certificates_user on public.certificates(user_id);

create or replace function public.handle_academy_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_academy_auth_user_created on auth.users;
create trigger on_academy_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_academy_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.purchases enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.certificates enable row level security;

drop policy if exists "Learners can read own profile" on public.profiles;
create policy "Learners can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Learners can update own profile" on public.profiles;
create policy "Learners can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Anyone can read published courses" on public.courses;
create policy "Anyone can read published courses"
on public.courses for select
using (is_published = true);

drop policy if exists "Anyone can read preview lessons" on public.lessons;
create policy "Anyone can read preview lessons"
on public.lessons for select
using (preview_enabled = true);

drop policy if exists "Learners read own enrollments" on public.enrollments;
create policy "Learners read own enrollments"
on public.enrollments for select
using (auth.uid() = user_id);

drop policy if exists "Learners read own purchases" on public.purchases;
create policy "Learners read own purchases"
on public.purchases for select
using (auth.uid() = user_id);

drop policy if exists "Learners manage own progress" on public.lesson_progress;
create policy "Learners manage own progress"
on public.lesson_progress for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Learners read own certificates" on public.certificates;
create policy "Learners read own certificates"
on public.certificates for select
using (auth.uid() = user_id);

insert into public.courses (
  id, slug, title, subtitle, category, instructor, instructor_role, level,
  duration, lesson_count, rating, learner_count, price_cents, price_label,
  badge, thumbnail_url, accent, outcomes, stripe_price_env, is_published, sort_order
) values
(
  'eu-mdr-technical-file',
  'eu-mdr-technical-file-masterclass',
  'EU MDR Technical File Masterclass',
  'Build a complete MDR-ready technical documentation set with templates, evidence maps, and reviewer logic.',
  'EU MDR',
  'Monir El Azzouzi',
  'Regulatory Affairs & Quality Specialist',
  'Intermediate',
  '6.5 hours',
  42,
  4.8,
  1820,
  24900,
  '$249',
  'Bestseller',
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
  '#7c3aed',
  '["Technical file structure for EU MDR audits", "GSPR evidence mapping and gap review", "Notified body response preparation"]'::jsonb,
  'STRIPE_PRICE_EU_MDR_TECHNICAL_FILE',
  true,
  1
),
(
  'iso-13485-qms',
  'iso-13485-qms-implementation',
  'ISO 13485 QMS Implementation Sprint',
  'Create a lean, audit-ready quality system without burying your team in unnecessary procedures.',
  'ISO 13485',
  'Monir El Azzouzi',
  'Lead Auditor & QMS Specialist',
  'Beginner to advanced',
  '5 hours',
  31,
  4.7,
  1390,
  0,
  'Free',
  'Free starter',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80',
  '#08a99f',
  '["Process map and SOP architecture", "CAPA, supplier, and training controls", "Audit evidence your team can maintain"]'::jsonb,
  'STRIPE_PRICE_ISO_13485_QMS',
  true,
  2
)
on conflict (id) do nothing;
