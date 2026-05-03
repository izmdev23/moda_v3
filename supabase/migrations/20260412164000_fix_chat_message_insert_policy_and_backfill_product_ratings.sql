-- Harden chat_messages insert RLS and ensure product rating aggregates stay in sync.
-- Local-first migration: review this SQL, then run `supabase db push` manually.

BEGIN;

DROP POLICY IF EXISTS "Thread participants can send messages" ON public.chat_messages;
CREATE POLICY "Thread participants can send messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_threads t
    JOIN public.users u ON u.id = public.chat_messages.sender_id
    WHERE t.id = public.chat_messages.thread_id
      AND u.auth_id = auth.uid()
      AND (t.buyer_id = public.chat_messages.sender_id OR t.seller_id = public.chat_messages.sender_id)
  )
);

CREATE OR REPLACE FUNCTION public.recalculate_product_rating_avg()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.products
    SET rating_avg = COALESCE((
      SELECT ROUND(AVG(r.rating)::numeric, 1)::double precision
      FROM public.ratings r
      WHERE r.product_id = OLD.product_id
    ), 0)
    WHERE id = OLD.product_id;

    RETURN OLD;
  END IF;

  UPDATE public.products
  SET rating_avg = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 1)::double precision
    FROM public.ratings r
    WHERE r.product_id = NEW.product_id
  ), 0)
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ratings_recalculate_avg ON public.ratings;
CREATE TRIGGER tr_ratings_recalculate_avg
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_product_rating_avg();

UPDATE public.products p
SET rating_avg = COALESCE(agg.avg_rating, 0)
FROM (
  SELECT r.product_id, ROUND(AVG(r.rating)::numeric, 1)::double precision AS avg_rating
  FROM public.ratings r
  GROUP BY r.product_id
) agg
WHERE p.id = agg.product_id;

UPDATE public.products p
SET rating_avg = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ratings r
  WHERE r.product_id = p.id
);

COMMIT;
