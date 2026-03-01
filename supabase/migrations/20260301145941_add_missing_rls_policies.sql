-- ─── payment_methods ───────────────────────────────────────────────────
-- All actions: Only the owner (user_id) can manage their own payment methods
CREATE POLICY "Users can manage own payment methods" ON public.payment_methods
FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = public.payment_methods.user_id AND auth.uid() = auth_id));

-- ─── product_views ─────────────────────────────────────────────────────
-- Insert: Anyone can record a view
CREATE POLICY "Anyone can record product views" ON public.product_views
FOR INSERT WITH CHECK (true);

-- Select: Anyone can view (anonymous or authenticated)
CREATE POLICY "Anyone can view product views" ON public.product_views
FOR SELECT USING (true);

-- ─── order_items ──────────────────────────────────────────────────────
-- Select: Buyers see their own items, sellers see items sold from their shop
CREATE POLICY "Buyers can view own order items" ON public.order_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.users u ON o.buyer_id = u.id
  WHERE o.id = public.order_items.order_id AND u.auth_id = auth.uid()
));

CREATE POLICY "Sellers can view own order items" ON public.order_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.shops s
  JOIN public.users u ON s.user_id = u.id
  WHERE s.id = public.order_items.shop_id AND u.auth_id = auth.uid()
));

-- Insert: Buyer can insert items linked to their order
CREATE POLICY "Buyers can insert own order items" ON public.order_items
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.users u ON o.buyer_id = u.id
  WHERE o.id = order_id AND u.auth_id = auth.uid()
));

-- ─── orders (Adding missing Insert) ───────────────────────────────────
-- Insert: Buyer can create an order for themselves
CREATE POLICY "Buyers can create own orders" ON public.orders
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = buyer_id AND auth_id = auth.uid()));
