create table if not exists public.crypto_payment_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  network text not null,
  asset text not null,
  recipient_address text not null,
  rate_usd numeric(30,12) not null check (rate_usd > 0),
  expected_amount numeric(60,30) not null check (expected_amount > 0),
  expected_units numeric(80,0) not null check (expected_units > 0),
  decimals integer not null check (decimals between 0 and 30),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, network, asset)
);

create index if not exists crypto_payment_quotes_order_idx
  on public.crypto_payment_quotes(order_id);

alter table public.crypto_payment_quotes enable row level security;
revoke all on public.crypto_payment_quotes from anon, authenticated;
grant select, insert, update on public.crypto_payment_quotes to service_role;

comment on table public.crypto_payment_quotes is
  'Server-side payment quotes. Never expose quote rows directly to anonymous clients.';
