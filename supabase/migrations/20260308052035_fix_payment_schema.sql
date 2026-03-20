-- Stage 1.1 — Fix `transaction_history` Schema & RLS

-- Change idempotency_key from uuid to text
ALTER TABLE public.transaction_history
  ALTER COLUMN idempotency_key TYPE text USING idempotency_key::text;

-- Add payment_channel column to track which eWallet was used
ALTER TABLE public.transaction_history
  ADD COLUMN IF NOT EXISTS payment_channel text;

-- Add payment_url for storing the Xendit checkout URL
ALTER TABLE public.transaction_history
  ADD COLUMN IF NOT EXISTS payment_url text;


-- Stage 1.2 — Add Missing RLS Policies

-- Allow authenticated users to insert their own transaction records
CREATE POLICY "Users can insert own transactions" ON public.transaction_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = transaction_history.user_id AND auth.uid() = auth_id)
  );

-- Allow service role / webhook to update transaction status
CREATE POLICY "Users can update own transactions" ON public.transaction_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = transaction_history.user_id AND auth.uid() = auth_id)
  );

-- Allow authenticated users to create orders
CREATE POLICY "Buyers can create orders" ON public.orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = orders.buyer_id AND auth.uid() = auth_id)
  );

-- Allow buyers to update own orders
CREATE POLICY "Buyers can update own orders" ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = orders.buyer_id AND auth.uid() = auth_id)
  );

-- Allow order items to be created by the order owner
CREATE POLICY "Users can create order items" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.users u ON o.buyer_id = u.id
      WHERE o.id = order_items.order_id AND u.auth_id = auth.uid()
    )
  );


-- Stage 1.3 — Add Index for Faster Polling

CREATE INDEX IF NOT EXISTS idx_transaction_history_uid ON public.transaction_history (uid);
CREATE INDEX IF NOT EXISTS idx_transaction_history_xendit_ref ON public.transaction_history (xendit_reference_id);
