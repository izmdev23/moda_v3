-- Fix invalid Postgres format() placeholder in refund approval notification message.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

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
      format(
        'Your refund for %s (%s) was approved. %s credits were added to your wallet.',
        v_product_name,
        v_variant_name,
        to_char(v_refund_amount, 'FM999999990D00')
      ),
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

REVOKE ALL ON FUNCTION public.process_refund_request_decision(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_refund_request_decision(uuid, text, text) TO authenticated;
