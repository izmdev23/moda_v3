-- Migration: Add decrement_variant_stock RPC function
-- Called by the payment-webhook edge function to atomically decrement stock
-- after a successful payment.

CREATE OR REPLACE FUNCTION decrement_variant_stock(
  p_variant_id INTEGER,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE product_variants
  SET stock = GREATEST(0, stock - p_quantity)
  WHERE id = p_variant_id;
END;
$$;

-- Grant execute to the service role (used by edge functions)
GRANT EXECUTE ON FUNCTION decrement_variant_stock(INTEGER, INTEGER) TO service_role;
