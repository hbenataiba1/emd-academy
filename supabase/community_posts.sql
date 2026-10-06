-- LinkedIn community posts shown in "Community & Recognition" on /academy.
-- Run this once in the Academy Supabase project (SQL editor).
-- Posts are managed from the CRM: emd-academy > Academy > Community.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text not null,
  -- https://www.linkedin.com/embed/feed/update/urn:li:<type>:<id>, built by the CRM
  embed_url text,
  author_name text,
  author_role text,
  post_text text,
  course text,
  is_published boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_published_idx
  on public.community_posts (is_published, sort_order, created_at desc);

alter table public.community_posts enable row level security;

-- Visitors (anon key) can only read published posts.
drop policy if exists "Anyone can read published community posts" on public.community_posts;
create policy "Anyone can read published community posts"
  on public.community_posts
  for select
  using (is_published = true);

-- Writes happen from the CRM with the service role key, which bypasses RLS.
