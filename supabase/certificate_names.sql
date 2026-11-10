-- The name a learner confirms before their certificate is created.
-- It is saved on the certificate, so the PDF, the picture and the public verify page all show
-- the same name. Certificates issued before this keep using the name of the account.
-- Run once in the Academy Supabase project: SQL Editor -> New query -> paste -> Run.

alter table public.certificates
  add column if not exists learner_name text;
