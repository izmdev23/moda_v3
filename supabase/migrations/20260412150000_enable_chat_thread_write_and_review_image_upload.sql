-- Enable missing RLS write paths for chat threads/messages and review image uploads.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_threads'
      AND policyname = 'Participants can create chat threads'
  ) THEN
    CREATE POLICY "Participants can create chat threads" ON public.chat_threads
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (u.id = public.chat_threads.buyer_id OR u.id = public.chat_threads.seller_id)
          AND u.auth_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_threads'
      AND policyname = 'Participants can update chat threads'
  ) THEN
    CREATE POLICY "Participants can update chat threads" ON public.chat_threads
    FOR UPDATE USING (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (u.id = public.chat_threads.buyer_id OR u.id = public.chat_threads.seller_id)
          AND u.auth_id = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (u.id = public.chat_threads.buyer_id OR u.id = public.chat_threads.seller_id)
          AND u.auth_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Thread participants can update messages'
  ) THEN
    CREATE POLICY "Thread participants can update messages" ON public.chat_messages
    FOR UPDATE USING (
      EXISTS (
        SELECT 1
        FROM public.chat_threads t
        JOIN public.users ub ON t.buyer_id = ub.id
        JOIN public.users us ON t.seller_id = us.id
        WHERE t.id = public.chat_messages.thread_id
          AND (ub.auth_id = auth.uid() OR us.auth_id = auth.uid())
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.chat_threads t
        JOIN public.users ub ON t.buyer_id = ub.id
        JOIN public.users us ON t.seller_id = us.id
        WHERE t.id = public.chat_messages.thread_id
          AND (ub.auth_id = auth.uid() OR us.auth_id = auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload review images'
  ) THEN
    CREATE POLICY "Authenticated users can upload review images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'review-images'
      AND auth.role() = 'authenticated'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete review images'
  ) THEN
    CREATE POLICY "Authenticated users can delete review images" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'review-images'
      AND auth.role() = 'authenticated'
    );
  END IF;
END
$$;
