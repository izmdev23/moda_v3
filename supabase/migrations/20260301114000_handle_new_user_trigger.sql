
-- Function to handle new user registration from Auth to Public
-- This ensures that a profile (and shop for sellers) is created atomically
-- when a user signs up, bypassing RLS restrictions during the unconfirmed state.
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
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    NEW.raw_user_meta_data ->> 'middle_name',
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'gender', 'male'),
    COALESCE((NEW.raw_user_meta_data ->> 'date_of_birth')::date, now()::date - interval '13 years'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'buyer')
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger to run the function when a record is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
