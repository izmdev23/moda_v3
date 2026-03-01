
-- Function to safely check if an email is already taken without exposing user profiles via RLS.
-- This is used during the signup process by unauthenticated users.
CREATE OR REPLACE FUNCTION public.check_email_availability(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses RLS
SET search_path = public -- security best practice for SECURITY DEFINER
AS $$
DECLARE
    found_user_id int8;
    is_confirmed boolean;
BEGIN
    SELECT id, (email_confirmed_at IS NOT NULL)
    INTO found_user_id, is_confirmed
    FROM public.users
    WHERE email = target_email
    LIMIT 1;

    IF found_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'available', false,
            'is_confirmed', is_confirmed
        );
    ELSE
        -- Also check auth.users directly as a fallback if users row doesn't exist yet but auth does
        -- Note: this requires the trigger to be correctly working, but checking auth.users 
        -- via SECURITY DEFINER functions is allowed if you have the right permissions.
        -- However, it's safer to rely on the public users table which is synced by the trigger.
        RETURN jsonb_build_object(
            'available', true,
            'is_confirmed', false
        );
    END IF;
END;
$$;
