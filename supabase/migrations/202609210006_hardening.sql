-- Security and performance hardening for the TopBid Supabase backend.
revoke execute on function public.confirm_order_payment(uuid,public.provider_name,text,bigint,text,text,text,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid,public.provider_name,text,bigint,text,text,text,text,integer,jsonb) to service_role;

revoke execute on function public.increment_listing_clicks(uuid) from public, anon, authenticated;
grant execute on function public.increment_listing_clicks(uuid) to service_role;

create index if not exists click_events_listing_idx on public.click_events(listing_id);
create index if not exists listings_category_idx on public.listings(category_id);
create index if not exists orders_category_idx on public.orders(category_id);
create index if not exists orders_existing_listing_idx on public.orders(existing_listing_id);

create policy "deny public access to orders" on public.orders
  as restrictive for all to anon, authenticated using (false) with check (false);

create policy "deny public access to payments" on public.payments
  as restrictive for all to anon, authenticated using (false) with check (false);

create policy "deny public access to webhook events" on public.webhook_events
  as restrictive for all to anon, authenticated using (false) with check (false);

create policy "deny public access to click events" on public.click_events
  as restrictive for all to anon, authenticated using (false) with check (false);

create policy "deny public access to crypto quotes" on public.crypto_payment_quotes
  as restrictive for all to anon, authenticated using (false) with check (false);

create policy "deny public access to receiving addresses" on public.payment_receiving_addresses
  as restrictive for all to anon, authenticated using (false) with check (false);
