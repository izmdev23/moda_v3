-- Migration: rename_xendit_to_stripe_columns
ALTER TABLE public.transaction_history
  RENAME COLUMN xendit_reference_id TO stripe_payment_intent_id;

ALTER TABLE public.transaction_history
  ADD COLUMN IF NOT EXISTS stripe_client_secret text;

DROP INDEX IF EXISTS idx_transaction_history_xendit_ref;
CREATE INDEX IF NOT EXISTS idx_transaction_history_stripe_pi
  ON public.transaction_history (stripe_payment_intent_id);
