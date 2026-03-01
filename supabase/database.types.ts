export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_detail: string
          barangay: string
          city: string
          country: string
          created_at: string
          id: number
          is_default: boolean
          landmark: string | null
          phone_number: string
          province: string
          uid: string
          updated_at: string
          user_id: number
        }
        Insert: {
          address_detail: string
          barangay: string
          city: string
          country: string
          created_at?: string
          id?: number
          is_default?: boolean
          landmark?: string | null
          phone_number: string
          province: string
          uid?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          address_detail?: string
          barangay?: string
          city?: string
          country?: string
          created_at?: string
          id?: number
          is_default?: boolean
          landmark?: string | null
          phone_number?: string
          province?: string
          uid?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      administrative_boundaries: {
        Row: {
          created_at: string
          id: number
          level: number
          name: string
          parent_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          level: number
          name: string
          parent_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          level?: number
          name?: string
          parent_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_boundaries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "administrative_boundaries"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: number
          product_id: number
          quantity: number
          uid: string
          updated_at: string
          user_id: number
          variant_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          product_id: number
          quantity?: number
          uid?: string
          updated_at?: string
          user_id: number
          variant_id: number
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number
          quantity?: number
          uid?: string
          updated_at?: string
          user_id?: number
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string
          id: number
          image_url: string | null
          message_type: string
          read_at: string | null
          sender_id: number
          thread_id: number
          uid: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          image_url?: string | null
          message_type: string
          read_at?: string | null
          sender_id: number
          thread_id: number
          uid?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          image_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id?: number
          thread_id?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          buyer_id: number
          created_at: string
          id: number
          last_message_at: string
          product_id: number | null
          seller_id: number
          shop_id: number
          uid: string
          updated_at: string
        }
        Insert: {
          buyer_id: number
          created_at?: string
          id?: number
          last_message_at?: string
          product_id?: number | null
          seller_id: number
          shop_id: number
          uid?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: number
          created_at?: string
          id?: number
          last_message_at?: string
          product_id?: number | null
          seller_id?: number
          shop_id?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: number
          order_id: number
          product_id: number | null
          product_name: string
          quantity: number
          shop_id: number | null
          total_price: number
          uid: string
          unit_price: number
          updated_at: string
          variant_id: number | null
          variant_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          order_id: number
          product_id?: number | null
          product_name: string
          quantity: number
          shop_id?: number | null
          total_price: number
          uid?: string
          unit_price: number
          updated_at?: string
          variant_id?: number | null
          variant_name: string
        }
        Update: {
          created_at?: string
          id?: number
          order_id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          shop_id?: number | null
          total_price?: number
          uid?: string
          unit_price?: number
          updated_at?: string
          variant_id?: number | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: number
          buyer_id: number
          created_at: string
          deleted_at: string | null
          delivery_deadline: string | null
          id: number
          status: string
          total_amount: number
          uid: string
          updated_at: string
        }
        Insert: {
          address_id: number
          buyer_id: number
          created_at?: string
          deleted_at?: string | null
          delivery_deadline?: string | null
          id?: number
          status?: string
          total_amount: number
          uid?: string
          updated_at?: string
        }
        Update: {
          address_id?: number
          buyer_id?: number
          created_at?: string
          deleted_at?: string | null
          delivery_deadline?: string | null
          id?: number
          status?: string
          total_amount?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_number: string
          created_at: string
          id: number
          is_default: boolean
          type: string
          uid: string
          updated_at: string
          user_id: number
        }
        Insert: {
          account_number: string
          created_at?: string
          id?: number
          is_default?: boolean
          type: string
          uid?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          account_number?: string
          created_at?: string
          id?: number
          is_default?: boolean
          type?: string
          uid?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          id: number
          shop_id: number
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_data: Json
          id?: number
          shop_id: number
          uid?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: number
          shop_id?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_drafts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: number
          image_url: string
          product_id: number
          sort_order: number
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          image_url: string
          product_id: number
          sort_order?: number
          uid?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string
          product_id?: number
          sort_order?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: number
          image_url: string | null
          name: string
          price: number
          product_id: number
          sale_end_date: string | null
          sale_price: number | null
          sale_start_date: string | null
          stock: number
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          image_url?: string | null
          name: string
          price: number
          product_id: number
          sale_end_date?: string | null
          sale_price?: number | null
          sale_start_date?: string | null
          stock?: number
          uid?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string | null
          name?: string
          price?: number
          product_id?: number
          sale_end_date?: string | null
          sale_price?: number | null
          sale_start_date?: string | null
          stock?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          id: number
          product_id: number
          user_id: number | null
          viewed_at: string
        }
        Insert: {
          id?: number
          product_id: number
          user_id?: number | null
          viewed_at?: string
        }
        Update: {
          id?: number
          product_id?: number
          user_id?: number | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string
          id: number
          name: string
          rating_avg: number
          search_vector: unknown
          shop_id: number | null
          shop_name: string
          tags: Json
          thumbnail_url: string
          total_sales: number
          uid: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: number
          name: string
          rating_avg?: number
          search_vector?: unknown
          shop_id?: number | null
          shop_name: string
          tags?: Json
          thumbnail_url: string
          total_sales?: number
          uid?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: number
          name?: string
          rating_avg?: number
          search_vector?: unknown
          shop_id?: number | null
          shop_name?: string
          tags?: Json
          thumbnail_url?: string
          total_sales?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string
          id: number
          product_id: number
          rating: number
          review: string | null
          uid: string
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          product_id: number
          rating: number
          review?: string | null
          uid?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number
          rating?: number
          review?: string | null
          uid?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_images: {
        Row: {
          created_at: string
          id: number
          image_url: string
          review_id: number
          sort_order: number
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          image_url: string
          review_id: number
          sort_order?: number
          uid?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string
          review_id?: number
          sort_order?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: number
          product_id: number
          review_text: string
          uid: string
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          product_id: number
          review_text: string
          uid?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number
          review_text?: string
          uid?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_analytics_cache: {
        Row: {
          created_at: string
          date_key: string
          id: number
          period: string
          shop_id: number
          top_products: Json
          top_tags: Json
          total_orders: number
          total_revenue: number
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: number
          period: string
          shop_id: number
          top_products?: Json
          top_tags?: Json
          total_orders?: number
          total_revenue?: number
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: number
          period?: string
          shop_id?: number
          top_products?: Json
          top_tags?: Json
          total_orders?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_analytics_cache_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_follows: {
        Row: {
          created_at: string
          id: number
          shop_id: number
          uid: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          shop_id: number
          uid?: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          shop_id?: number
          uid?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_follows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address_detail: string
          banner_url: string | null
          city: string
          country: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: number
          province: string
          shop_name: string
          uid: string
          updated_at: string
          user_id: number
        }
        Insert: {
          address_detail: string
          banner_url?: string | null
          city: string
          country: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          province: string
          shop_name: string
          uid?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          address_detail?: string
          banner_url?: string | null
          city?: string
          country?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          province?: string
          shop_name?: string
          uid?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_history: {
        Row: {
          amount: number
          created_at: string
          hidden_at: string | null
          id: number
          idempotency_key: string
          order_id: number
          status: string
          uid: string
          updated_at: string
          user_id: number
          xendit_reference_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          hidden_at?: string | null
          id?: number
          idempotency_key: string
          order_id: number
          status: string
          uid?: string
          updated_at?: string
          user_id: number
          xendit_reference_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          hidden_at?: string | null
          id?: number
          idempotency_key?: string
          order_id?: number
          status?: string
          uid?: string
          updated_at?: string
          user_id?: number
          xendit_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_log: {
        Row: {
          activity_type: string
          category: string | null
          created_at: string
          id: number
          product_id: number | null
          search_query: string | null
          tags: Json | null
          user_id: number
        }
        Insert: {
          activity_type: string
          category?: string | null
          created_at?: string
          id?: number
          product_id?: number | null
          search_query?: string | null
          tags?: Json | null
          user_id: number
        }
        Update: {
          activity_type?: string
          category?: string | null
          created_at?: string
          id?: number
          product_id?: number | null
          search_query?: string | null
          tags?: Json | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_category_affinity: {
        Row: {
          category: string
          id: number
          score: number
          updated_at: string
          user_id: number
        }
        Insert: {
          category: string
          id?: number
          score?: number
          updated_at?: string
          user_id: number
        }
        Update: {
          category?: string
          id?: number
          score?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_category_affinity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recommendations: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          product_id: number
          reason: string
          score: number
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: number
          product_id: number
          reason: string
          score: number
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: number
          product_id?: number
          reason?: string
          score?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tag_affinity: {
        Row: {
          id: number
          score: number
          tag: string
          updated_at: string
          user_id: number
        }
        Insert: {
          id?: number
          score?: number
          tag: string
          updated_at?: string
          user_id: number
        }
        Update: {
          id?: number
          score?: number
          tag?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_tag_affinity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string
          avatar_url: string | null
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          email: string
          email_confirmed_at: string | null
          first_name: string
          gender: string
          id: number
          last_name: string
          middle_name: string | null
          role: string
          uid: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          avatar_url?: string | null
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          email: string
          email_confirmed_at?: string | null
          first_name: string
          gender: string
          id?: number
          last_name: string
          middle_name?: string | null
          role: string
          uid?: string
          updated_at?: string
        }
        Update: {
          auth_id?: string
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          email?: string
          email_confirmed_at?: string | null
          first_name?: string
          gender?: string
          id?: number
          last_name?: string
          middle_name?: string | null
          role?: string
          uid?: string
          updated_at?: string
        }
        Relationships: []
      }
      vton_usage: {
        Row: {
          created_at: string
          id: number
          product_id: number
          result_image_url: string | null
          status: string
          uid: string
          updated_at: string
          user_id: number
          user_image_url: string
        }
        Insert: {
          created_at?: string
          id?: number
          product_id: number
          result_image_url?: string | null
          status?: string
          uid?: string
          updated_at?: string
          user_id: number
          user_image_url: string
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number
          result_image_url?: string | null
          status?: string
          uid?: string
          updated_at?: string
          user_id?: number
          user_image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "vton_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vton_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_availability: {
        Args: { target_email: string }
        Returns: { available: boolean; is_confirmed: boolean }
      }
      get_average_rating: { Args: { p_product_id: number }; Returns: number }
      recalculate_user_affinity: {
        Args: { p_user_id: number }
        Returns: undefined
      }
      refresh_user_recommendations: {
        Args: { p_user_id: number }
        Returns: undefined
      }
      update_delivered_orders: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
