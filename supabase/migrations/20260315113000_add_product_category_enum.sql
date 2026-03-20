-- Create enum for product categories and migrate products.category from text.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'product_category'
  ) THEN
    CREATE TYPE public.product_category AS ENUM (
      'headwear',
      'tops',
      'bottoms',
      'footwear',
      'full_body',
      'accessory'
    );
  END IF;
END
$$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

-- Normalize historical values before converting to enum.
UPDATE public.products
SET category = CASE
  WHEN category IN ('headwear', 'tops', 'bottoms', 'footwear', 'full_body', 'accessory') THEN category
  WHEN category = 'accesory' THEN 'accessory'
  ELSE 'accessory'
END;

ALTER TABLE public.products
  ALTER COLUMN category TYPE public.product_category
  USING category::public.product_category;

ALTER TABLE public.products
  ALTER COLUMN category SET NOT NULL;
