-- Mark seller-owned pending/confirmed orders as shipped for a specific variant.
-- This runs as SECURITY DEFINER because sellers cannot directly update public.orders.

CREATE OR REPLACE FUNCTION public.mark_variant_orders_shipped(p_variant_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
  v_shop_id bigint;
  v_updated_count integer := 0;
BEGIN
  IF p_variant_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT u.id
  INTO v_auth_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT s.id
  INTO v_shop_id
  FROM public.shops s
  WHERE s.user_id = v_auth_user_id
    AND s.deleted_at IS NULL
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH target_orders AS (
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.variant_id = p_variant_id
      AND oi.shop_id = v_shop_id
      AND o.status IN ('pending', 'confirmed')
      AND o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi_other
        WHERE oi_other.order_id = o.id
          AND oi_other.shop_id <> v_shop_id
      )
  )
  UPDATE public.orders o
  SET status = 'shipped'
  FROM target_orders t
  WHERE o.id = t.id
    AND o.status IN ('pending', 'confirmed');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_variant_orders_shipped(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_variant_orders_shipped(bigint) TO authenticated;
