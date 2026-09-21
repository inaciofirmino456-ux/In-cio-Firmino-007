create table if not exists public.payment_receiving_addresses (
  network text primary key,
  address text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.payment_receiving_addresses (network, address) values
  ('bitcoin', 'bc1qa9fn20r8k58vqspg24qcs4cte76xkxugmufnzr'),
  ('solana', '89kWAV3yhn8RHYHtmnELuUatRRLcgwyuUgUV4zgJ9Lg'),
  ('ethereum', '0x1291637D7635Ca893465CB764e9f2AF18C910109'),
  ('bsc', '0x1291637D7635Ca893465CB764e9f2AF18C910109'),
  ('robinhood_chain', '0x1291637D7635Ca893465CB764e9f2AF18C910109')
on conflict (network) do update
set address = excluded.address,
    active = true,
    updated_at = now();

alter table public.payment_receiving_addresses enable row level security;

revoke all on public.payment_receiving_addresses from anon, authenticated;
grant select on public.payment_receiving_addresses to service_role;

comment on table public.payment_receiving_addresses is
  'Public receiving addresses only. Never store seed phrases or private keys here.';

comment on column public.payment_receiving_addresses.address is
  'Public blockchain receiving address. Private keys and seed phrases must never be stored.';

create index if not exists payment_receiving_addresses_active_idx
  on public.payment_receiving_addresses(active, network);
