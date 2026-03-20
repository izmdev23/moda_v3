-- Correct enum label typo in existing databases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'product_category'
      AND e.enumlabel = 'accesory'
  ) THEN
    ALTER TYPE public.product_category RENAME VALUE 'accesory' TO 'accessory';
  END IF;
END
$$;
