# Easy Medical Device Academy

Next/Vinext academy app for `easymedicaldevice.com/academy`, styled to match the Easy Medical Device brand with course browsing inspired by Udemy.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase project values and Stripe test keys.
3. Run `npm run dev` and open `/academy`.

## Supabase

Use `supabase/schema.sql` as the starter schema. Published rows from `public.courses` replace the bundled sample courses automatically when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured.

## Stripe

The checkout button posts to `/api/checkout`. Add `STRIPE_SECRET_KEY` and either `STRIPE_PRICE_IDS` as JSON or the per-course price variables in `.env.example`.

For production enrollments, add a Stripe webhook that marks `public.enrollments.status` as `active` after `checkout.session.completed`.
