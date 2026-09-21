-- Allow verified on-chain payments to use the crypto provider.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'provider_name'
      AND e.enumlabel = 'crypto'
  ) THEN
    ALTER TYPE public.provider_name ADD VALUE 'crypto';
  END IF;
END $$;
