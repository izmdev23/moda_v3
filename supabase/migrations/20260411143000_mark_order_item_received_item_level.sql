-- Mark a single order item as received by buyer.
-- This supports mixed-status transactions where items are delivered separately.

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_seller_shipping_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_seller_shipping_status_check
  CHECK (seller_shipping_status IN ('pending', 'shipped', 'delivered'));

CREATE OR REPLACE FUNCTION public.mark_order_item_received(p_order_item_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
  v_order_id bigint;
  v_buyer_id bigint;
  v_item_status text;
BEGIN
  SELECT u.id
  INTO v_auth_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT o.id, o.buyer_id, oi.seller_shipping_status
  INTO v_order_id, v_buyer_id, v_item_status
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.uid = p_order_item_uid
    AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_order_id IS NULL OR v_buyer_id <> v_auth_user_id THEN
    RETURN false;
  END IF;

  IF v_item_status = 'delivered' THEN
    RETURN true;
  END IF;

  IF v_item_status <> 'shipped' THEN
    RETURN false;
  END IF;

  UPDATE public.order_items
  SET seller_shipping_status = 'delivered',
      updated_at = now()
  WHERE uid = p_order_item_uid
    AND seller_shipping_status = 'shipped';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.product_variants pv
  SET stock = GREATEST(0, pv.stock - oi.quantity)
  FROM public.order_items oi
  WHERE oi.uid = p_order_item_uid
    AND oi.variant_id IS NOT NULL
    AND oi.variant_id = pv.id;

  IF EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.seller_shipping_status <> 'delivered'
  ) THEN
    RETURN true;
  END IF;

  UPDATE public.orders
  SET status = 'delivered',
      updated_at = now()
  WHERE id = v_order_id
    AND status <> 'delivered';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_item_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_order_item_received(uuid) TO authenticated;
