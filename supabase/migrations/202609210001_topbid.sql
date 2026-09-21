create extension if not exists pgcrypto;

create type public.order_status as enum ('pending','paid','failed','expired','review');
create type public.payment_status as enum ('pending','confirmed','failed','refunded','review');
create type public.provider_name as enum ('paygo','coinbase_commerce','nowpayments','bvnk','binance_pay','bybit_pay');

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories (slug,name) values
('ai','AI'),('developer','Developer'),('seo','SEO'),('marketing','Marketing'),
('productivity','Productivity'),('agents','Agents'),('crypto','Crypto'),
('business','Business'),('ecommerce','Ecommerce'),('design','Design'),
('education','Education'),('games','Games'),('social','Social'),('other','Other')
on conflict (slug) do nothing;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  normalized_url text not null unique,
  canonical_url text not null,
  title text not null,
  description text not null default '',
  domain text not null default '',
  category_id uuid not null references public.categories(id),
  total_paid_cents bigint not null default 0 check (total_paid_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  clicks bigint not null default 0 check (clicks >= 0),
  status text not null default 'active' check (status in ('active','removed'))
);

create table if not exists public.listing_daily_totals (
  listing_id uuid not null references public.listings(id) on delete cascade,
  day_utc date not null,
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  first_payment_at timestamptz,
  primary key (listing_id, day_utc)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  normalized_url text not null,
  canonical_url text not null,
  category_id uuid not null references public.categories(id),
  requested_total_cents bigint not null check (requested_total_cents >= 100),
  charge_cents bigint not null check (charge_cents >= 100),
  existing_listing_id uuid references public.listings(id),
  provider public.provider_name,
  provider_payment_id text,
  status public.order_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider public.provider_name not null,
  provider_payment_id text not null,
  tx_hash text,
  amount_cents bigint not null check (amount_cents > 0),
  asset text,
  network text,
  recipient_address text,
  confirmations integer,
  status public.payment_status not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique(provider, provider_payment_id),
  unique(tx_hash)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.provider_name not null,
  event_id text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique(provider, event_id)
);

create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  ip_hash text,
  user_agent text,
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists listings_rank_idx on public.listings(total_paid_cents desc, created_at asc);
create index if not exists daily_rank_idx on public.listing_daily_totals(day_utc, paid_cents desc, first_payment_at asc);
create index if not exists orders_status_idx on public.orders(status, created_at);
create index if not exists payments_order_idx on public.payments(order_id);

create or replace function public.create_order(
  p_normalized_url text,
  p_canonical_url text,
  p_category_id uuid,
  p_requested_total_cents bigint
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.listings;
  v_charge bigint;
  v_order public.orders;
  v_max bigint;
begin
  if p_requested_total_cents < 100 or p_requested_total_cents > 99999900 then
    raise exception 'requested amount outside limits';
  end if;

  select * into v_existing from public.listings
  where normalized_url = p_normalized_url and status = 'active'
  for update;

  v_charge := p_requested_total_cents;
  if found then
    if p_requested_total_cents <= v_existing.total_paid_cents then
      raise exception 'new total must exceed current total by at least $1';
    end if;
    v_charge := p_requested_total_cents - v_existing.total_paid_cents;
  end if;

  select coalesce(max(total_paid_cents),0) into v_max
  from public.listings where status='active';

  if p_requested_total_cents > 0 and v_max > 0 and p_requested_total_cents < v_max + 500 then
    -- This is intentionally not a hard rejection: lower bids are allowed.
    -- The rank is calculated after payment confirmation.
    null;
  end if;

  insert into public.orders (
    normalized_url, canonical_url, category_id, requested_total_cents,
    charge_cents, existing_listing_id, status, expires_at
  ) values (
    p_normalized_url, p_canonical_url, p_category_id, p_requested_total_cents,
    v_charge, case when found then v_existing.id else null end, 'pending',
    now() + interval '30 minutes'
  ) returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_provider public.provider_name,
  p_provider_payment_id text,
  p_amount_cents bigint,
  p_asset text,
  p_network text,
  p_tx_hash text,
  p_recipient text,
  p_confirmations integer,
  p_raw jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_listing public.listings;
  v_category uuid;
  v_day date := (now() at time zone 'utc')::date;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status='paid' then
    return jsonb_build_object('status','already_paid');
  end if;
  if p_amount_cents <> v_order.charge_cents then
    update public.orders set status='review', updated_at=now() where id=v_order.id;
    return jsonb_build_object('status','review','reason','amount_mismatch');
  end if;

  insert into public.payments(
    order_id,provider,provider_payment_id,tx_hash,amount_cents,asset,network,
    recipient_address,confirmations,status,raw,confirmed_at
  ) values (
    v_order.id,p_provider,p_provider_payment_id,nullif(p_tx_hash,''),
    p_amount_cents,p_asset,p_network,p_recipient,p_confirmations,'confirmed',
    coalesce(p_raw,'{}'::jsonb),now()
  ) on conflict (provider,provider_payment_id) do nothing
  returning * into v_payment;

  if not found then
    return jsonb_build_object('status','already_processed');
  end if;

  select * into v_listing from public.listings
  where normalized_url=v_order.normalized_url and status='active'
  for update;

  if found then
    update public.listings
    set total_paid_cents = total_paid_cents + v_order.charge_cents,
        updated_at=now()
    where id=v_listing.id;
  else
    insert into public.listings(
      normalized_url,canonical_url,title,description,domain,category_id,total_paid_cents
    ) values (
      v_order.normalized_url,v_order.canonical_url,
      coalesce(v_order.metadata->>'title',split_part(v_order.normalized_url,'/',3)),
      coalesce(v_order.metadata->>'description',''),
      coalesce(v_order.metadata->>'domain',''),
      v_order.category_id,v_order.charge_cents
    ) returning * into v_listing;
  end if;

  insert into public.listing_daily_totals(listing_id,day_utc,paid_cents,first_payment_at)
  values(v_listing.id,v_day,v_order.charge_cents,now())
  on conflict(listing_id,day_utc) do update
    set paid_cents=listing_daily_totals.paid_cents+excluded.paid_cents,
        first_payment_at=coalesce(listing_daily_totals.first_payment_at,excluded.first_payment_at);

  update public.orders set status='paid',updated_at=now() where id=v_order.id;

  return jsonb_build_object('status','paid','listing_id',v_listing.id);
end;
$$;

alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_daily_totals enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.click_events enable row level security;

create policy "public read active listings" on public.listings for select using (status='active');
create policy "public read categories" on public.categories for select using (true);
create policy "public read daily totals" on public.listing_daily_totals for select using (true);

revoke all on public.orders from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.click_events from anon, authenticated;
revoke all on public.listings from anon, authenticated;
revoke all on public.listing_daily_totals from anon, authenticated;
grant select on public.listings, public.categories, public.listing_daily_totals to anon, authenticated;
grant execute on function public.create_order(text,text,uuid,bigint) to anon, authenticated;
grant execute on function public.confirm_order_payment(uuid,public.provider_name,text,bigint,text,text,text,text,integer,jsonb) to service_role;
