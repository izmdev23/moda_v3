-- Break recursive RLS evaluation between public.orders and public.order_items.
--
-- Current recursion path:
--   order_items SELECT policy -> queries orders
--   orders seller SELECT policy -> queries order_items
--
-- We use SECURITY DEFINER helper functions so relationship checks run without
-- re-entering row-level policies on these same tables.

CREATE OR REPLACE FUNCTION public.can_access_order_as_buyer(target_order_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.users u ON u.id = o.buyer_id
    WHERE o.id = target_order_id
      AND u.auth_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_order_as_seller(target_order_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.shops s ON s.id = oi.shop_id
    JOIN public.users u ON u.id = s.user_id
    WHERE oi.order_id = target_order_id
      AND u.auth_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_order_as_buyer(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_order_as_seller(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_order_as_buyer(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_order_as_seller(bigint) TO authenticated;

DROP POLICY IF EXISTS "Sellers can view orders containing their products" ON public.orders;
CREATE POLICY "Sellers can view orders containing their products" ON public.orders
FOR SELECT USING (public.can_access_order_as_seller(public.orders.id));

DROP POLICY IF EXISTS "Buyers can view own order items" ON public.order_items;
CREATE POLICY "Buyers can view own order items" ON public.order_items
FOR SELECT USING (public.can_access_order_as_buyer(public.order_items.order_id));

DROP POLICY IF EXISTS "Buyers can insert own order items" ON public.order_items;
CREATE POLICY "Buyers can insert own order items" ON public.order_items
FOR INSERT WITH CHECK (public.can_access_order_as_buyer(public.order_items.order_id));
