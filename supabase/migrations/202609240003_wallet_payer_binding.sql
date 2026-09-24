-- Store the public wallet address associated with a payment session.
-- This is never a private key or signing credential.
alter table public.crypto_payment_quotes
  add column if not exists payer_address text;

create index if not exists crypto_payment_quotes_payer_idx
  on public.crypto_payment_quotes(payer_address)
  where payer_address is not null;
