-- Enable item-level seller shipping updates so one product can be sent to courier
-- without forcing all products in the same order to shipped.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_shipping_status text NOT NULL DEFAULT 'pending'
  CHECK (seller_shipping_status IN ('pending', 'shipped'));

-- Backfill legacy rows that were already moved to shipped/delivered at order-level.
UPDATE public.order_items oi
SET seller_shipping_status = 'shipped'
FROM public.orders o
WHERE oi.order_id = o.id
  AND o.status IN ('shipped', 'delivered')
  AND oi.seller_shipping_status <> 'shipped';

CREATE OR REPLACE FUNCTION public.mark_variant_orders_shipped(p_variant_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  IF p_variant_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.order_items oi
  SET seller_shipping_status = 'shipped',
      updated_at = now()
  FROM public.shops s
  JOIN public.users u ON u.id = s.user_id
  JOIN public.orders o ON true
  WHERE oi.shop_id = s.id
    AND o.id = oi.order_id
    AND oi.variant_id = p_variant_id
    AND u.auth_id = auth.uid()
    AND s.deleted_at IS NULL
    AND o.deleted_at IS NULL
    AND o.status IN ('pending', 'confirmed', 'shipped')
    AND oi.seller_shipping_status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_variant_orders_shipped(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_variant_orders_shipped(bigint) TO authenticated;
