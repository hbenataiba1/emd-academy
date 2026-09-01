create table if not exists public.courses (
  id text primary key,
  slug text unique not null,
  title text not null,
  subtitle text,
  description text,
  category text not null,
  instructor text,
  instructor_role text,
  level text,
  duration text,
  lesson_count integer default 0,
  rating numeric default 4.8,
  learner_count integer default 0,
  price_cents integer not null default 0,
  price_label text,
  badge text,
  thumbnail_url text,
  accent text,
  outcomes jsonb default '[]'::jsonb,
  stripe_price_id text,
  stripe_price_env text,
  sort_order integer default 100,
  is_published boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text references public.courses(id) on delete cascade,
  title text not null,
  lesson_type text default 'video',
  duration_minutes integer default 0,
  sort_order integer default 100,
  preview_enabled boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id text references public.courses(id) on delete cascade,
  learner_email text not null,
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;

create policy "Published courses are public"
  on public.courses
  for select
  using (is_published = true);

create policy "Preview lessons are public"
  on public.lessons
  for select
  using (
    preview_enabled = true and exists (
      select 1
      from public.courses
      where public.courses.id = public.lessons.course_id
        and public.courses.is_published = true
    )
  );
