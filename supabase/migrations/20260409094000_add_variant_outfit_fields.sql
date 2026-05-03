-- Add variant-level fields required for outfit extraction upload flow.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS is_full_body boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS try_on_image_url text,
  ADD COLUMN IF NOT EXISTS extracted_outfit_url text;
