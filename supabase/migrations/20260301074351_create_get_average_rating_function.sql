CREATE OR REPLACE FUNCTION get_average_rating(p_product_id bigint)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_rating numeric;
BEGIN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    INTO avg_rating
    FROM public.ratings
    WHERE product_id = p_product_id;
    
    RETURN avg_rating;
END;
$$;
