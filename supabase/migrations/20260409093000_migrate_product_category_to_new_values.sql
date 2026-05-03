-- Migrate product categories to the new enum set used by upload and VTON.
DO $$
DECLARE
  has_product_category_type boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_category'
  ) INTO has_product_category_type;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_category_v2'
  ) THEN
    CREATE TYPE public.product_category_v2 AS ENUM (
      'headwear',
      'upperwear',
      'lowerwear',
      'footwear',
      'accessory'
    );
  END IF;

  ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_category_check;

  ALTER TABLE public.products
    ALTER COLUMN category TYPE text
    USING category::text;

  UPDATE public.products
  SET category = CASE
    WHEN category = 'tops' THEN 'upperwear'
    WHEN category = 'bottoms' THEN 'lowerwear'
    WHEN category = 'full_body' THEN 'upperwear'
    WHEN category = 'accesory' THEN 'accessory'
    WHEN category IN ('headwear', 'upperwear', 'lowerwear', 'footwear', 'accessory') THEN category
    ELSE 'accessory'
  END;

  ALTER TABLE public.products
    ALTER COLUMN category TYPE public.product_category_v2
    USING category::public.product_category_v2;

  ALTER TABLE public.products
    ALTER COLUMN category SET NOT NULL;

  IF has_product_category_type THEN
    DROP TYPE public.product_category;
  END IF;

  ALTER TYPE public.product_category_v2 RENAME TO product_category;
END
$$;
