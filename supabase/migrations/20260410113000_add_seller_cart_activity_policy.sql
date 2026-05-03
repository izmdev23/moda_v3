-- Allow shop owners to read cart activity for products in their own shop.
CREATE POLICY "Shop owners can view cart activity for own products" ON public.cart_items
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.shops s ON p.shop_id = s.id
    JOIN public.users u ON s.user_id = u.id
    WHERE p.id = public.cart_items.product_id
      AND u.auth_id = auth.uid()
  )
);
