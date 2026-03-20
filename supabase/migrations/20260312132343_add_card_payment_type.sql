-- Drop the existing check constraint on the `type` column if it's named `payment_methods_type_check`
ALTER TABLE public.payment_methods 
  DROP CONSTRAINT IF EXISTS payment_methods_type_check;

-- If Postgres generated a different name, dynamically find the constraint and drop it
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.payment_methods'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%IN%gcash%paymaya%';
    
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.payment_methods DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- Add the new check constraint allowing 'card' type
ALTER TABLE public.payment_methods 
  ADD CONSTRAINT payment_methods_type_check 
  CHECK (type IN ('gcash', 'paymaya', 'card'));
