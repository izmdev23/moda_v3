-- Fix mark_variant_orders_shipped so it updates seller-owned variant orders reliably.
--
-- Previous behavior selected only one shop (LIMIT 1), which can miss the target
-- variant when a seller has multiple shops. It also skipped mixed-shop orders,
-- causing false "No Changes" responses despite visible to-ship counts.

CREATE OR REPLACE FUNCTION public.mark_variant_orders_shipped(p_variant_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
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

  WITH target_orders AS (
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.shops s ON s.id = oi.shop_id
    WHERE oi.variant_id = p_variant_id
      AND s.user_id = v_auth_user_id
      AND s.deleted_at IS NULL
      AND o.status IN ('pending', 'confirmed')
      AND o.deleted_at IS NULL
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
