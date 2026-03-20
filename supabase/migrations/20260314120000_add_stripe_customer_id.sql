-- Add stripe_customer_id to users table for saved card reuse.
-- Stripe requires a PaymentMethod to be attached to a Customer before it can
-- be used across multiple PaymentIntents. This column persists the Customer ID
-- so we don't create a new Stripe Customer on every card payment.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;
