-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.addresses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  country text NOT NULL,
  province text NOT NULL,
  city text NOT NULL,
  barangay text NOT NULL,
  landmark text,
  address_detail text NOT NULL,
  phone_number text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.administrative_boundaries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  parent_id bigint,
  name text NOT NULL,
  level integer NOT NULL CHECK (level = ANY (ARRAY[0, 1, 2, 3])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT administrative_boundaries_pkey PRIMARY KEY (id),
  CONSTRAINT administrative_boundaries_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.administrative_boundaries(id)
);
CREATE TABLE public.app_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  recipient_user_id bigint NOT NULL,
  actor_user_id bigint,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT app_notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id),
  CONSTRAINT app_notifications_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.buyer_credit_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  refund_request_id bigint,
  order_id bigint,
  order_item_id bigint,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['refund_credit'::text, 'spend_credit'::text, 'adjustment'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyer_credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT buyer_credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT buyer_credit_transactions_refund_request_id_fkey FOREIGN KEY (refund_request_id) REFERENCES public.refund_requests(id),
  CONSTRAINT buyer_credit_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT buyer_credit_transactions_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
);
CREATE TABLE public.buyer_credits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyer_credits_pkey PRIMARY KEY (id),
  CONSTRAINT buyer_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.cart_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  product_id bigint NOT NULL,
  variant_id bigint NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);
CREATE TABLE public.chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  thread_id bigint NOT NULL,
  sender_id bigint NOT NULL,
  message_type text NOT NULL CHECK (message_type = ANY (ARRAY['text'::text, 'image'::text])),
  content text,
  image_url text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id),
  CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.chat_threads (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  buyer_id bigint NOT NULL,
  seller_id bigint NOT NULL,
  shop_id bigint NOT NULL,
  product_id bigint,
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT chat_threads_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id),
  CONSTRAINT chat_threads_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id),
  CONSTRAINT chat_threads_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id),
  CONSTRAINT chat_threads_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  order_id bigint NOT NULL,
  product_id bigint,
  variant_id bigint,
  shop_id bigint,
  product_name text NOT NULL,
  variant_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price > 0::numeric),
  total_price numeric NOT NULL CHECK (total_price > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  seller_shipping_status text NOT NULL DEFAULT 'pending'::text CHECK (seller_shipping_status = ANY (ARRAY['pending'::text, 'shipped'::text, 'delivered'::text])),
  refund_status text NOT NULL DEFAULT 'none'::text CHECK (refund_status = ANY (ARRAY['none'::text, 'pending'::text, 'accepted'::text, 'rejected'::text])),
  refund_requested_at timestamp with time zone,
  refund_resolved_at timestamp with time zone,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT order_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  buyer_id bigint NOT NULL,
  address_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])),
  total_amount numeric NOT NULL CHECK (total_amount >= 0::numeric),
  delivery_deadline timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id),
  CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id)
);
CREATE TABLE public.payment_methods (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['gcash'::text, 'paymaya'::text, 'card'::text])),
  account_number text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.product_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  shop_id bigint NOT NULL,
  draft_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT product_drafts_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id)
);
CREATE TABLE public.product_images (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id bigint NOT NULL,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_variants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id bigint NOT NULL,
  name text NOT NULL,
  image_url text,
  price numeric NOT NULL CHECK (price > 0::numeric),
  sale_price numeric,
  sale_start_date timestamp with time zone,
  sale_end_date timestamp with time zone,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_full_body boolean NOT NULL DEFAULT false,
  try_on_image_url text,
  extracted_outfit_url text,
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_views (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint,
  product_id bigint NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_views_pkey PRIMARY KEY (id),
  CONSTRAINT product_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT product_views_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  shop_id bigint,
  shop_name text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category USER-DEFINED NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url text NOT NULL,
  rating_avg double precision NOT NULL DEFAULT 0 CHECK (rating_avg >= 0::double precision AND rating_avg <= 5::double precision),
  total_sales integer NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  search_vector tsvector,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id)
);
CREATE TABLE public.ratings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  product_id bigint NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ratings_pkey PRIMARY KEY (id),
  CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT ratings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.refund_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  order_item_id bigint NOT NULL UNIQUE,
  order_item_uid uuid NOT NULL,
  order_id bigint NOT NULL,
  buyer_id bigint NOT NULL,
  seller_user_id bigint NOT NULL,
  shop_id bigint,
  product_name text NOT NULL,
  variant_name text NOT NULL,
  refund_amount numeric NOT NULL CHECK (refund_amount > 0::numeric),
  reason text NOT NULL,
  evidence_image_urls ARRAY NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  seller_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT refund_requests_pkey PRIMARY KEY (id),
  CONSTRAINT refund_requests_seller_user_id_fkey FOREIGN KEY (seller_user_id) REFERENCES public.users(id),
  CONSTRAINT refund_requests_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id),
  CONSTRAINT refund_requests_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT refund_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT refund_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id)
);
CREATE TABLE public.review_images (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  review_id bigint NOT NULL,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_images_pkey PRIMARY KEY (id),
  CONSTRAINT review_images_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id)
);
CREATE TABLE public.reviews (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  product_id bigint NOT NULL,
  review_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.shop_analytics_cache (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  shop_id bigint NOT NULL,
  period text NOT NULL CHECK (period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])),
  date_key date NOT NULL,
  top_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_analytics_cache_pkey PRIMARY KEY (id),
  CONSTRAINT shop_analytics_cache_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id)
);
CREATE TABLE public.shop_follows (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  shop_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_follows_pkey PRIMARY KEY (id),
  CONSTRAINT shop_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT shop_follows_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id)
);
CREATE TABLE public.shops (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  shop_name text NOT NULL,
  country text NOT NULL,
  province text NOT NULL,
  city text NOT NULL,
  address_detail text NOT NULL,
  banner_url text,
  description text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shops_pkey PRIMARY KEY (id),
  CONSTRAINT shops_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.transaction_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  order_id bigint NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text])),
  stripe_payment_intent_id text,
  idempotency_key text NOT NULL UNIQUE,
  hidden_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_channel text,
  payment_url text,
  stripe_client_secret text,
  CONSTRAINT transaction_history_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT transaction_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.user_activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['view'::text, 'search'::text, 'purchase'::text, 'cart_add'::text])),
  product_id bigint,
  search_query text,
  category text,
  tags jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT user_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_activity_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.user_category_affinity (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  category text NOT NULL,
  score double precision NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_category_affinity_pkey PRIMARY KEY (id),
  CONSTRAINT user_category_affinity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_recommendations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  product_id bigint NOT NULL,
  score double precision NOT NULL,
  reason text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_recommendations_pkey PRIMARY KEY (id),
  CONSTRAINT user_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_recommendations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.user_tag_affinity (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  tag text NOT NULL,
  score double precision NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_tag_affinity_pkey PRIMARY KEY (id),
  CONSTRAINT user_tag_affinity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  gender text NOT NULL CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'non-binary'::text])),
  date_of_birth date NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['buyer'::text, 'seller'::text])),
  avatar_url text,
  auth_id uuid NOT NULL UNIQUE,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email_confirmed_at timestamp with time zone,
  stripe_customer_id text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vton_usage (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id bigint NOT NULL,
  product_id bigint NOT NULL,
  user_image_url text NOT NULL,
  result_image_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vton_usage_pkey PRIMARY KEY (id),
  CONSTRAINT vton_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT vton_usage_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);