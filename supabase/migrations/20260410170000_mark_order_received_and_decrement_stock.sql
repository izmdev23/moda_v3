-- Mark an order as received by the buyer and decrement stock once.
-- This runs as SECURITY DEFINER because buyers cannot directly update product_variants.

CREATE OR REPLACE FUNCTION public.mark_order_received(p_order_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
  v_order_id bigint;
  v_buyer_id bigint;
  v_order_status text;
BEGIN
  SELECT u.id
  INTO v_auth_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT o.id, o.buyer_id, o.status
  INTO v_order_id, v_buyer_id, v_order_status
  FROM public.orders o
  WHERE o.uid = p_order_uid
    AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_order_id IS NULL OR v_buyer_id <> v_auth_user_id THEN
    RETURN false;
  END IF;

  IF v_order_status = 'delivered' THEN
    RETURN true;
  END IF;

  IF v_order_status <> 'shipped' THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET status = 'delivered'
  WHERE id = v_order_id
    AND status = 'shipped';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.product_variants pv
  SET stock = GREATEST(0, pv.stock - oi.quantity)
  FROM public.order_items oi
  WHERE oi.order_id = v_order_id
    AND oi.variant_id IS NOT NULL
    AND oi.variant_id = pv.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_order_received(uuid) TO authenticated;
