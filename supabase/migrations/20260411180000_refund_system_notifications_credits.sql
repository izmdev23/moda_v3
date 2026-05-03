-- Refund workflow, app notifications, and buyer credits support.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamp with time zone;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS refund_resolved_at timestamp with time zone;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_refund_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_refund_status_check
  CHECK (refund_status IN ('none', 'pending', 'accepted', 'rejected'));

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  order_item_id int8 REFERENCES public.order_items(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  order_item_uid uuid NOT NULL,
  order_id int8 REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  buyer_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  seller_user_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  shop_id int8 REFERENCES public.shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
  product_name text NOT NULL,
  variant_name text NOT NULL,
  refund_amount numeric NOT NULL CHECK (refund_amount > 0),
  reason text NOT NULL,
  evidence_image_urls text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  seller_response text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  CONSTRAINT refund_requests_order_item_unique UNIQUE (order_item_id)
);

CREATE TABLE IF NOT EXISTS public.buyer_credits (
  id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  user_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT buyer_credits_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.buyer_credit_transactions (
  id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  user_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  refund_request_id int8 REFERENCES public.refund_requests(id) ON UPDATE CASCADE ON DELETE SET NULL,
  order_id int8 REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
  order_item_id int8 REFERENCES public.order_items(id) ON UPDATE CASCADE ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('refund_credit', 'spend_credit', 'adjustment')),
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  recipient_user_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT NULL,
  actor_user_id int8 REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_created_at
  ON public.refund_requests (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refund_requests_seller_status
  ON public.refund_requests (seller_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyer_credit_transactions_user_created_at
  ON public.buyer_credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient_read_created_at
  ON public.app_notifications (recipient_user_id, is_read, created_at DESC);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tr_refund_requests_set_updated_at ON public.refund_requests;
CREATE TRIGGER tr_refund_requests_set_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_buyer_credits_set_updated_at ON public.buyer_credits;
CREATE TRIGGER tr_buyer_credits_set_updated_at
BEFORE UPDATE ON public.buyer_credits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Users can view refund requests they are part of" ON public.refund_requests;
CREATE POLICY "Users can view refund requests they are part of" ON public.refund_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.refund_requests.buyer_id
      AND u.auth_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.refund_requests.seller_user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Buyers can create own refund requests" ON public.refund_requests;
CREATE POLICY "Buyers can create own refund requests" ON public.refund_requests
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.orders o ON o.buyer_id = u.id
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE u.auth_id = auth.uid()
      AND u.id = public.refund_requests.buyer_id
      AND oi.id = public.refund_requests.order_item_id
      AND oi.seller_shipping_status = 'delivered'
  )
);

DROP POLICY IF EXISTS "Sellers can update own refund requests" ON public.refund_requests;
CREATE POLICY "Sellers can update own refund requests" ON public.refund_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.refund_requests.seller_user_id
      AND u.auth_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.refund_requests.seller_user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own buyer credits" ON public.buyer_credits;
CREATE POLICY "Users can view own buyer credits" ON public.buyer_credits
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.buyer_credits.user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.buyer_credit_transactions;
CREATE POLICY "Users can view own credit transactions" ON public.buyer_credit_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.buyer_credit_transactions.user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Recipients can view own app notifications" ON public.app_notifications;
CREATE POLICY "Recipients can view own app notifications" ON public.app_notifications
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.app_notifications.recipient_user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Recipients can update own app notifications" ON public.app_notifications;
CREATE POLICY "Recipients can update own app notifications" ON public.app_notifications
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.app_notifications.recipient_user_id
      AND u.auth_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.app_notifications.recipient_user_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert app notifications" ON public.app_notifications;
CREATE POLICY "Authenticated users can insert app notifications" ON public.app_notifications
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    public.app_notifications.actor_user_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = public.app_notifications.actor_user_id
        AND u.auth_id = auth.uid()
    )
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('refund-evidence', 'refund-evidence', true, 10485760, '{image/jpeg,image/png,image/webp}')
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own refund evidence'
  ) THEN
    CREATE POLICY "Users can upload own refund evidence" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'refund-evidence'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own refund evidence'
  ) THEN
    CREATE POLICY "Users can delete own refund evidence" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'refund-evidence'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.submit_refund_request(
  p_order_item_uid uuid,
  p_reason text,
  p_evidence_urls text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
  v_order_item_id bigint;
  v_order_id bigint;
  v_buyer_id bigint;
  v_seller_user_id bigint;
  v_shop_id bigint;
  v_product_name text;
  v_variant_name text;
  v_refund_amount numeric;
  v_shipping_status text;
  v_existing_refund_status text;
  v_refund_uid uuid;
BEGIN
  SELECT u.id
  INTO v_auth_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    oi.id,
    oi.order_id,
    o.buyer_id,
    s.user_id,
    oi.shop_id,
    oi.product_name,
    oi.variant_name,
    oi.total_price,
    oi.seller_shipping_status,
    oi.refund_status
  INTO
    v_order_item_id,
    v_order_id,
    v_buyer_id,
    v_seller_user_id,
    v_shop_id,
    v_product_name,
    v_variant_name,
    v_refund_amount,
    v_shipping_status,
    v_existing_refund_status
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.shops s ON s.id = oi.shop_id
  WHERE oi.uid = p_order_item_uid
    AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF v_buyer_id <> v_auth_user_id THEN
    RAISE EXCEPTION 'You can only request refunds for your own orders';
  END IF;

  IF v_shipping_status <> 'delivered' THEN
    RAISE EXCEPTION 'Only received items can be refunded';
  END IF;

  IF v_existing_refund_status = 'pending' THEN
    RAISE EXCEPTION 'A refund request is already pending for this item';
  END IF;

  IF v_existing_refund_status = 'accepted' THEN
    RAISE EXCEPTION 'This item has already been refunded';
  END IF;

  IF trim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Refund reason is required';
  END IF;

  INSERT INTO public.refund_requests (
    order_item_id,
    order_item_uid,
    order_id,
    buyer_id,
    seller_user_id,
    shop_id,
    product_name,
    variant_name,
    refund_amount,
    reason,
    evidence_image_urls,
    status
  )
  VALUES (
    v_order_item_id,
    p_order_item_uid,
    v_order_id,
    v_buyer_id,
    v_seller_user_id,
    v_shop_id,
    v_product_name,
    v_variant_name,
    v_refund_amount,
    trim(p_reason),
    coalesce(p_evidence_urls, '{}'::text[]),
    'pending'
  )
  RETURNING uid INTO v_refund_uid;

  UPDATE public.order_items
  SET refund_status = 'pending',
      refund_requested_at = now(),
      updated_at = now()
  WHERE id = v_order_item_id;

  INSERT INTO public.app_notifications (
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    message,
    metadata
  ) VALUES (
    v_seller_user_id,
    v_buyer_id,
    'refund_request_submitted',
    'New Refund Request',
    format('A buyer requested a refund for %s (%s).', v_product_name, v_variant_name),
    jsonb_build_object('refundUid', v_refund_uid, 'orderItemUid', p_order_item_uid)
  );

  RETURN v_refund_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_refund_request_decision(
  p_refund_uid uuid,
  p_decision text,
  p_seller_response text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id bigint;
  v_refund_id bigint;
  v_order_item_id bigint;
  v_order_item_uid uuid;
  v_order_id bigint;
  v_buyer_id bigint;
  v_seller_user_id bigint;
  v_product_name text;
  v_variant_name text;
  v_refund_amount numeric;
  v_status text;
  v_normalized_decision text;
  v_default_response text;
BEGIN
  SELECT u.id
  INTO v_auth_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    rr.id,
    rr.order_item_id,
    rr.order_item_uid,
    rr.order_id,
    rr.buyer_id,
    rr.seller_user_id,
    rr.product_name,
    rr.variant_name,
    rr.refund_amount,
    rr.status
  INTO
    v_refund_id,
    v_order_item_id,
    v_order_item_uid,
    v_order_id,
    v_buyer_id,
    v_seller_user_id,
    v_product_name,
    v_variant_name,
    v_refund_amount,
    v_status
  FROM public.refund_requests rr
  WHERE rr.uid = p_refund_uid
  LIMIT 1;

  IF v_refund_id IS NULL THEN
    RAISE EXCEPTION 'Refund request not found';
  END IF;

  IF v_seller_user_id <> v_auth_user_id THEN
    RAISE EXCEPTION 'Only the seller can process this refund request';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'This refund request has already been resolved';
  END IF;

  v_normalized_decision := lower(trim(coalesce(p_decision, '')));

  IF v_normalized_decision = 'accept' THEN
    v_normalized_decision := 'accepted';
  ELSIF v_normalized_decision = 'reject' THEN
    v_normalized_decision := 'rejected';
  END IF;

  IF v_normalized_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid refund decision';
  END IF;

  IF v_normalized_decision = 'accepted' THEN
    v_default_response := 'Refund request approved.';

    UPDATE public.refund_requests
    SET status = 'accepted',
        seller_response = coalesce(nullif(trim(coalesce(p_seller_response, '')), ''), v_default_response),
        resolved_at = now(),
        updated_at = now()
    WHERE id = v_refund_id;

    UPDATE public.order_items
    SET refund_status = 'accepted',
        refund_resolved_at = now(),
        updated_at = now()
    WHERE id = v_order_item_id;

    INSERT INTO public.buyer_credits (user_id, balance)
    VALUES (v_buyer_id, v_refund_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = public.buyer_credits.balance + EXCLUDED.balance,
      updated_at = now();

    INSERT INTO public.buyer_credit_transactions (
      user_id,
      refund_request_id,
      order_id,
      order_item_id,
      transaction_type,
      amount,
      note
    ) VALUES (
      v_buyer_id,
      v_refund_id,
      v_order_id,
      v_order_item_id,
      'refund_credit',
      v_refund_amount,
      format('Credit from approved refund for %s (%s)', v_product_name, v_variant_name)
    );

    UPDATE public.transaction_history
    SET status = 'refunded',
        updated_at = now()
    WHERE order_id = v_order_id
      AND user_id = v_buyer_id
      AND status = 'success';

    INSERT INTO public.app_notifications (
      recipient_user_id,
      actor_user_id,
      notification_type,
      title,
      message,
      metadata
    ) VALUES (
      v_buyer_id,
      v_seller_user_id,
      'refund_request_accepted',
      'Refund Approved',
      format('Your refund for %s (%s) was approved. %.2f credits were added to your wallet.', v_product_name, v_variant_name, v_refund_amount),
      jsonb_build_object(
        'refundUid', p_refund_uid,
        'orderItemUid', v_order_item_uid,
        'creditedAmount', v_refund_amount
      )
    );

    RETURN true;
  END IF;

  v_default_response := 'Refund request rejected.';

  UPDATE public.refund_requests
  SET status = 'rejected',
      seller_response = coalesce(nullif(trim(coalesce(p_seller_response, '')), ''), v_default_response),
      resolved_at = now(),
      updated_at = now()
  WHERE id = v_refund_id;

  UPDATE public.order_items
  SET refund_status = 'rejected',
      refund_resolved_at = now(),
      updated_at = now()
  WHERE id = v_order_item_id;

  INSERT INTO public.app_notifications (
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    message,
    metadata
  ) VALUES (
    v_buyer_id,
    v_seller_user_id,
    'refund_request_rejected',
    'Refund Rejected',
    format('Your refund request for %s (%s) was rejected.', v_product_name, v_variant_name),
    jsonb_build_object('refundUid', p_refund_uid, 'orderItemUid', v_order_item_uid)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_refund_request(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_refund_request(uuid, text, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.process_refund_request_decision(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_refund_request_decision(uuid, text, text) TO authenticated;
