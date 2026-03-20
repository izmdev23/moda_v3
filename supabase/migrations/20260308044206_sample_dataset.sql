DO $$
DECLARE
  v_seller_id int8;
  v_shop_id int8;
  v_product1_id int8;
  v_product2_id int8;
  v_product3_id int8;
  v_product4_id int8;
BEGIN
  -- Insert Seller
  INSERT INTO public.users (first_name, last_name, gender, date_of_birth, email, role, auth_id)
  VALUES ('Sample', 'Seller', 'female', '1992-02-02', 'sample.seller@example.com', 'seller', gen_random_uuid())
  RETURNING id INTO v_seller_id;

  -- Insert Shop
  INSERT INTO public.shops (user_id, shop_name, country, province, city, address_detail, description, banner_url)
  VALUES (v_seller_id, 'Moda Sample Shop', 'Philippines', 'Metro Manila', 'Makati City', '123 Sample Avenue', 'Your one-stop shop for modern fashion.', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1200')
  RETURNING id INTO v_shop_id;

  -- Insert Product 1: Tops
  INSERT INTO public.products (shop_id, shop_name, name, description, category, tags, thumbnail_url, rating_avg, total_sales)
  VALUES (v_shop_id, 'Moda Sample Shop', 'Classic White T-Shirt', 'A comfortable and versatile classic white t-shirt for daily wear. Made from 100% cotton.', 'tops', '["casual", "summer", "basic"]'::jsonb, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500', 4.8, 150)
  RETURNING id INTO v_product1_id;

  INSERT INTO public.product_images (product_id, image_url, sort_order)
  VALUES 
  (v_product1_id, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500', 0),
  (v_product1_id, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=500', 1);

  INSERT INTO public.product_variants (product_id, name, image_url, price, sale_price, stock)
  VALUES 
  (v_product1_id, 'Small', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500', 499.00, NULL, 50),
  (v_product1_id, 'Medium', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500', 499.00, NULL, 30),
  (v_product1_id, 'Large', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500', 499.00, NULL, 10);

  -- Insert Product 2: Bottoms
  INSERT INTO public.products (shop_id, shop_name, name, description, category, tags, thumbnail_url, rating_avg, total_sales)
  VALUES (v_shop_id, 'Moda Sample Shop', 'Denim Jeans Classic Fit', 'High-quality denim jeans perfect for an everyday casual look.', 'bottoms', '["denim", "casual", "jeans"]'::jsonb, 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=500', 4.5, 85)
  RETURNING id INTO v_product2_id;

  INSERT INTO public.product_images (product_id, image_url, sort_order)
  VALUES 
  (v_product2_id, 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=500', 0),
  (v_product2_id, 'https://images.unsplash.com/photo-1475178626620-a4d074967452?q=80&w=500', 1);

  INSERT INTO public.product_variants (product_id, name, image_url, price, sale_price, stock)
  VALUES 
  (v_product2_id, 'Blue - Size 30', 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=500', 1299.00, 999.00, 20),
  (v_product2_id, 'Blue - Size 32', 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=500', 1299.00, NULL, 15);

  -- Insert Product 3: Footwear
  INSERT INTO public.products (shop_id, shop_name, name, description, category, tags, thumbnail_url, rating_avg, total_sales)
  VALUES (v_shop_id, 'Moda Sample Shop', 'Running Sneakers', 'Lightweight and durable sneakers designed for ultimate comfort.', 'footwear', '["shoes", "running", "sports"]'::jsonb, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500', 4.9, 210)
  RETURNING id INTO v_product3_id;

  INSERT INTO public.product_images (product_id, image_url, sort_order)
  VALUES 
  (v_product3_id, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500', 0),
  (v_product3_id, 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=500', 1);

  INSERT INTO public.product_variants (product_id, name, image_url, price, sale_price, stock)
  VALUES 
  (v_product3_id, 'Red - Size 8', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500', 2500.00, 1999.00, 8),
  (v_product3_id, 'Red - Size 9', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500', 2500.00, NULL, 12),
  (v_product3_id, 'Red - Size 10', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500', 2500.00, NULL, 5);
  
  -- Insert Product 4: Footwear
  INSERT INTO public.products (shop_id, shop_name, name, description, category, tags, thumbnail_url, rating_avg, total_sales)
  VALUES (v_shop_id, 'Moda Sample Shop', 'Elegant Leather Boots', 'High-quality leather boots suitable for formal and semi-formal occasions.', 'footwear', '["boots", "leather", "formal"]'::jsonb, 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=500', 4.6, 55)
  RETURNING id INTO v_product4_id;

  INSERT INTO public.product_images (product_id, image_url, sort_order)
  VALUES 
  (v_product4_id, 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=500', 0);

  INSERT INTO public.product_variants (product_id, name, image_url, price, sale_price, stock)
  VALUES 
  (v_product4_id, 'Brown - Size 8', 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=500', 3500.00, NULL, 15),
  (v_product4_id, 'Brown - Size 9', 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=500', 3500.00, NULL, 10);

END $$;
