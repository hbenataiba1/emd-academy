# Easy Medical Device Academy

Next/Vinext academy app for `easymedicaldevice.com/academy`, styled to match the Easy Medical Device brand with course browsing inspired by Udemy.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase project values and Stripe test keys.
3. Run `npm run dev` and open `/academy`.

## Supabase

Use `supabase/academy_project_schema.sql` in the separate Academy Supabase project. Published rows from `public.courses` replace the bundled sample courses automatically when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured.

Learner login/signup uses Supabase Auth. Server-side enrollment, progress, purchases, and certificates use `SUPABASE_SERVICE_ROLE_KEY`, which must never be exposed in browser code.

## Stripe

The checkout button posts to `/api/checkout`. Add `STRIPE_SECRET_KEY` and either `STRIPE_PRICE_IDS` as JSON or the per-course price variables in `.env.example`.

For production enrollments, point Stripe webhooks to `/api/stripe/webhook` and add `STRIPE_WEBHOOK_SECRET`. The webhook marks `public.enrollments.status` as `active` and writes `public.purchases` after `checkout.session.completed`.

## CRM admin connection

In `C:\Users\disfra\Desktop\CRM`, add these environment variables so the CRM can manage the separate Academy Supabase project:

- `ACADEMY_SUPABASE_URL`
- `ACADEMY_SUPABASE_SERVICE_ROLE_KEY`

Then open `/easy-medical-device/academy` inside the CRM.
