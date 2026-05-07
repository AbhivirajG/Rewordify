-- Subscriptions synced from Stripe webhooks (service role writes; users read own row).
-- Run in Supabase SQL Editor if you do not use CLI migrations.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  tier text not null default 'free' check (
    tier in ('free', 'pro', 'max')
  ),
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_stripe_customer on public.subscriptions (stripe_customer_id);
create index if not exists idx_subscriptions_stripe_sub on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid () = user_id);
