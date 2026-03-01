-- Add email_confirmed_at to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamp with time zone;

-- Update the handle_new_user function to include email_confirmed_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_user_id int8;
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (
    auth_id,
    email,
    first_name,
    middle_name,
    last_name,
    gender,
    date_of_birth,
    role,
    email_confirmed_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    NEW.raw_user_meta_data ->> 'middle_name',
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'gender', 'male'),
    COALESCE((NEW.raw_user_meta_data ->> 'date_of_birth')::date, now()::date - interval '13 years'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'buyer'),
    NEW.email_confirmed_at
  )
  RETURNING id INTO new_user_id;

  -- Create shop if user is a seller
  IF (NEW.raw_user_meta_data ->> 'role' = 'seller') THEN
    INSERT INTO public.shops (
      user_id,
      shop_name,
      country,
      province,
      city,
      address_detail
    )
    VALUES (
      new_user_id,
      COALESCE(NEW.raw_user_meta_data ->> 'shop_name', 'My Shop'),
      COALESCE(NEW.raw_user_meta_data ->> 'shop_country', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'shop_province', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'shop_city', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'shop_address_detail', '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New function to handle user updates in auth (sync email_confirmed_at)
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET 
    email_confirmed_at = NEW.email_confirmed_at,
    updated_at = now()
  WHERE auth_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users UPDATE
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
