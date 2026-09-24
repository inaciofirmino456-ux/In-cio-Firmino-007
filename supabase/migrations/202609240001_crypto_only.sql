-- TopBid: crypto-only payment configuration.
-- Replace all receiving addresses and remove stale crypto quotes.
delete from public.crypto_payment_quotes;
delete from public.payment_receiving_addresses;

insert into public.payment_receiving_addresses (network, address, active)
values
  ('bitcoin', 'bc1qa9fn20r8k58vqspg24qcs4tce76xkxugmufnz', true),
  ('ethereum', '0x1291637D7635Ca893465CB764e9f2AF18C910109', true),
  ('solana', '89kWAV3yhn8RHYHtmnELuUatRRLcgyuUgUVV4zgJ9Lg', true),
  ('bsc', '0x1291637D7635Ca893465CB764e9f2AF18C910109', true),
  ('robinhood_chain', '0x1291637D7635Ca893465CB764e9f2AF18C910109', true);

-- Legacy gateway enum values cannot be removed in-place safely from PostgreSQL.
-- Constrain all payment records and internal confirmation calls to the crypto provider only.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_crypto_provider_only'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_crypto_provider_only
      check (provider is null or provider = 'crypto'::public.provider_name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_crypto_provider_only'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_crypto_provider_only
      check (provider = 'crypto'::public.provider_name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'webhook_events_crypto_provider_only'
      and conrelid = 'public.webhook_events'::regclass
  ) then
    alter table public.webhook_events
      add constraint webhook_events_crypto_provider_only
      check (provider = 'crypto'::public.provider_name);
  end if;
end $$;

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
  v_day date := (now() at time zone 'utc')::date;
  v_payment public.payments;
begin
  if p_provider <> 'crypto'::public.provider_name then
    raise exception 'only crypto payments are enabled';
  end if;

  if p_network not in ('bitcoin','ethereum','solana','bsc','robinhood_chain') then
    raise exception 'unsupported payment network';
  end if;

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

revoke execute on function public.confirm_order_payment(uuid,public.provider_name,text,bigint,text,text,text,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid,public.provider_name,text,bigint,text,text,text,text,integer,jsonb) to service_role;
