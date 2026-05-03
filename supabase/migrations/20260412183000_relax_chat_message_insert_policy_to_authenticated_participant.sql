-- Ensure chat message inserts are allowed for authenticated thread participants.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

BEGIN;

DROP POLICY IF EXISTS "Thread participants can send messages" ON public.chat_messages;

CREATE POLICY "Thread participants can send messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_threads t
    JOIN public.users u ON u.auth_id = auth.uid()
    WHERE t.id = public.chat_messages.thread_id
      AND (t.buyer_id = u.id OR t.seller_id = u.id)
  )
);

COMMIT;
