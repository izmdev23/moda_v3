-- Make chat_messages INSERT checks deterministic under RLS by using
-- security-definer helper functions for current user and thread participation.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_id_by_auth()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_id_by_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_id_by_auth() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_thread_participant(p_thread_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = p_thread_id
      AND (
        t.buyer_id = public.current_user_id_by_auth()
        OR t.seller_id = public.current_user_id_by_auth()
      )
  )
$$;

REVOKE ALL ON FUNCTION public.is_chat_thread_participant(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_thread_participant(bigint) TO authenticated;

DROP POLICY IF EXISTS "Thread participants can send messages" ON public.chat_messages;

CREATE POLICY "Thread participants can send messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  sender_id = public.current_user_id_by_auth()
  AND public.is_chat_thread_participant(thread_id)
);

COMMIT;
