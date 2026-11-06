ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_crypto_provider_only;
ALTER TABLE public.orders ADD CONSTRAINT orders_supported_provider
  CHECK (provider IS NULL OR provider IN ('crypto'::public.provider_name, 'paypal'::public.provider_name));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_crypto_provider_only;
ALTER TABLE public.payments ADD CONSTRAINT payments_supported_provider
  CHECK (provider IN ('crypto'::public.provider_name, 'paypal'::public.provider_name));

ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_crypto_provider_only;
ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_supported_provider
  CHECK (provider IN ('crypto'::public.provider_name, 'paypal'::public.provider_name));
