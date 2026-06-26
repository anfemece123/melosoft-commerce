// ============================================================
// Database types — aligned with Supabase multistore schema
// To regenerate after db push:
//   npx supabase gen types typescript --project-id <id> --schema public
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          slogan: string | null;
          business_type: string | null;
          description: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          hero_enabled: boolean;
          hero_title: string | null;
          hero_subtitle: string | null;
          hero_cta_label: string | null;
          hero_image_url: string | null;
          hero_background_image_url: string | null;
          whatsapp_number: string | null;
          support_email: string | null;
          instagram_url: string | null;
          facebook_url: string | null;
          tiktok_url: string | null;
          country: string;
          city: string | null;
          currency: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          slogan?: string | null;
          business_type?: string | null;
          description?: string | null;
          logo_url?: string | null;
          favicon_url?: string | null;
          hero_enabled?: boolean;
          hero_title?: string | null;
          hero_subtitle?: string | null;
          hero_cta_label?: string | null;
          hero_image_url?: string | null;
          hero_background_image_url?: string | null;
          whatsapp_number?: string | null;
          support_email?: string | null;
          instagram_url?: string | null;
          facebook_url?: string | null;
          tiktok_url?: string | null;
          country?: string;
          city?: string | null;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          slogan?: string | null;
          business_type?: string | null;
          description?: string | null;
          logo_url?: string | null;
          favicon_url?: string | null;
          hero_enabled?: boolean;
          hero_title?: string | null;
          hero_subtitle?: string | null;
          hero_cta_label?: string | null;
          hero_image_url?: string | null;
          hero_background_image_url?: string | null;
          whatsapp_number?: string | null;
          support_email?: string | null;
          instagram_url?: string | null;
          facebook_url?: string | null;
          tiktok_url?: string | null;
          country?: string;
          city?: string | null;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_theme_settings: {
        Row: {
          id: string;
          store_id: string;
          mode: string;
          theme_preset: string;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          background_color: string | null;
          text_color: string | null;
          button_radius: string | null;
          template_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          mode?: string;
          theme_preset?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
          background_color?: string | null;
          text_color?: string | null;
          button_radius?: string | null;
          template_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          mode?: string;
          theme_preset?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
          background_color?: string | null;
          text_color?: string | null;
          button_radius?: string | null;
          template_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_policies: {
        Row: {
          id: string;
          store_id: string;
          shipping_policy: string | null;
          returns_policy: string | null;
          warranty_policy: string | null;
          privacy_policy: string | null;
          terms_and_conditions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          shipping_policy?: string | null;
          returns_policy?: string | null;
          warranty_policy?: string | null;
          privacy_policy?: string | null;
          terms_and_conditions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          shipping_policy?: string | null;
          returns_policy?: string | null;
          warranty_policy?: string | null;
          privacy_policy?: string | null;
          terms_and_conditions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_hero_slides: {
        Row: {
          id: string;
          store_id: string;
          sort_order: number;
          is_active: boolean;
          show_title: boolean;
          show_subtitle: boolean;
          show_cta: boolean;
          show_main_image: boolean;
          show_badge_image: boolean;
          title: string | null;
          subtitle: string | null;
          cta_label: string | null;
          main_image_url: string | null;
          background_image_url: string | null;
          badge_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          sort_order?: number;
          is_active?: boolean;
          show_title?: boolean;
          show_subtitle?: boolean;
          show_cta?: boolean;
          show_main_image?: boolean;
          show_badge_image?: boolean;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          main_image_url?: string | null;
          background_image_url?: string | null;
          badge_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          sort_order?: number;
          is_active?: boolean;
          show_title?: boolean;
          show_subtitle?: boolean;
          show_cta?: boolean;
          show_main_image?: boolean;
          show_badge_image?: boolean;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          main_image_url?: string | null;
          background_image_url?: string | null;
          badge_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_product_categories: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string;
          short_description: string | null;
          product_type: string;
          regular_price: number;
          compare_at_price: number | null;
          sale_price: number | null;
          cost_price: number | null;
          stock: number;
          sku: string | null;
          track_inventory: boolean;
          is_featured: boolean;
          is_available: boolean;
          preparation_time_minutes: number | null;
          allows_special_instructions: boolean;
          special_instructions_label: string | null;
          special_instructions_placeholder: string | null;
          special_instructions_max_length: number;
          sort_order: number;
          status: string;
          main_image_url: string | null;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string;
          short_description?: string | null;
          product_type?: string;
          regular_price: number;
          compare_at_price?: number | null;
          sale_price?: number | null;
          cost_price?: number | null;
          stock?: number;
          sku?: string | null;
          track_inventory?: boolean;
          is_featured?: boolean;
          is_available?: boolean;
          preparation_time_minutes?: number | null;
          allows_special_instructions?: boolean;
          special_instructions_label?: string | null;
          special_instructions_placeholder?: string | null;
          special_instructions_max_length?: number;
          sort_order?: number;
          status?: string;
          main_image_url?: string | null;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          description?: string;
          short_description?: string | null;
          product_type?: string;
          regular_price?: number;
          compare_at_price?: number | null;
          sale_price?: number | null;
          cost_price?: number | null;
          stock?: number;
          sku?: string | null;
          track_inventory?: boolean;
          is_featured?: boolean;
          is_available?: boolean;
          preparation_time_minutes?: number | null;
          allows_special_instructions?: boolean;
          special_instructions_label?: string | null;
          special_instructions_placeholder?: string | null;
          special_instructions_max_length?: number;
          sort_order?: number;
          status?: string;
          main_image_url?: string | null;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          image_url: string;
          storage_path: string | null;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          image_url: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          owner_id?: string;
          image_url?: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_option_groups: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          name: string;
          description: string | null;
          selection_type: string;
          min_select: number;
          max_select: number | null;
          is_required: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          name: string;
          description?: string | null;
          selection_type?: string;
          min_select?: number;
          max_select?: number | null;
          is_required?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          selection_type?: string;
          min_select?: number;
          max_select?: number | null;
          is_required?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_option_items: {
        Row: {
          id: string;
          store_id: string;
          group_id: string;
          owner_id: string;
          label: string;
          description: string | null;
          price_delta: number;
          is_default: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          group_id: string;
          owner_id: string;
          label: string;
          description?: string | null;
          price_delta?: number;
          is_default?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          group_id?: string;
          owner_id?: string;
          label?: string;
          description?: string | null;
          price_delta?: number;
          is_default?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          product_id: string | null;
          title: string;
          slug: string;
          subtitle: string | null;
          description: string;
          regular_price: number;
          offer_price: number;
          starts_at: string | null;
          ends_at: string | null;
          duration_minutes: number | null;
          countdown_mode: string;
          show_countdown: boolean;
          is_visible_in_store: boolean;
          sort_order: number;
          status: string;
          whatsapp_number: string | null;
          whatsapp_message: string | null;
          cta_label: string;
          hero_image_url: string | null;
          terms_and_conditions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          owner_id: string;
          product_id?: string | null;
          title: string;
          slug: string;
          subtitle?: string | null;
          description: string;
          regular_price?: number;
          offer_price: number;
          starts_at?: string | null;
          ends_at?: string | null;
          duration_minutes?: number | null;
          countdown_mode?: string;
          show_countdown?: boolean;
          is_visible_in_store?: boolean;
          sort_order?: number;
          status?: string;
          whatsapp_number?: string | null;
          whatsapp_message?: string | null;
          cta_label?: string;
          hero_image_url?: string | null;
          terms_and_conditions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          owner_id?: string;
          product_id?: string | null;
          title?: string;
          slug?: string;
          subtitle?: string | null;
          description?: string;
          regular_price?: number;
          offer_price?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          duration_minutes?: number | null;
          countdown_mode?: string;
          show_countdown?: boolean;
          is_visible_in_store?: boolean;
          sort_order?: number;
          status?: string;
          whatsapp_number?: string | null;
          whatsapp_message?: string | null;
          cta_label?: string;
          hero_image_url?: string | null;
          terms_and_conditions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_offer_sessions: {
        Row: {
          id: string;
          offer_id: string;
          visitor_token: string;
          first_seen_at: string;
          expires_at: string;
          claim_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          visitor_token: string;
          first_seen_at?: string;
          expires_at: string;
          claim_code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          expires_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offer_images: {
        Row: {
          id: string;
          store_id: string;
          offer_id: string;
          owner_id: string;
          image_url: string;
          storage_path: string | null;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          offer_id: string;
          owner_id: string;
          image_url: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          offer_id?: string;
          owner_id?: string;
          image_url?: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          store_location_id: string | null;
          order_number: string | null;
          source: string;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          customer_document: string | null;
          shipping_address: string | null;
          city: string | null;
          department: string | null;
          delivery_neighborhood: string | null;
          delivery_reference: string | null;
          subtotal: number;
          shipping_amount: number;
          discount_amount: number;
          total_amount: number;
          currency: string;
          status: string;
          payment_status: string;
          payment_method: string;
          fulfillment_method: string;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          store_location_id?: string | null;
          order_number?: string | null;
          source?: string;
          customer_name: string;
          customer_email?: string | null;
          customer_phone: string;
          customer_document?: string | null;
          shipping_address?: string | null;
          city?: string | null;
          department?: string | null;
          delivery_neighborhood?: string | null;
          delivery_reference?: string | null;
          subtotal?: number;
          shipping_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          currency?: string;
          status?: string;
          payment_status?: string;
          payment_method?: string;
          fulfillment_method?: string;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          store_location_id?: string | null;
          order_number?: string | null;
          source?: string;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string;
          customer_document?: string | null;
          shipping_address?: string | null;
          city?: string | null;
          department?: string | null;
          delivery_neighborhood?: string | null;
          delivery_reference?: string | null;
          subtotal?: number;
          shipping_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          currency?: string;
          status?: string;
          payment_status?: string;
          payment_method?: string;
          fulfillment_method?: string;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          offer_id: string | null;
          product_name_snapshot: string | null;
          product_slug_snapshot: string | null;
          product_image_url_snapshot: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          customer_note: string | null;
          customizations_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          offer_id?: string | null;
          product_name_snapshot?: string | null;
          product_slug_snapshot?: string | null;
          product_image_url_snapshot?: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          customer_note?: string | null;
          customizations_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          offer_id?: string | null;
          product_name_snapshot?: string | null;
          product_slug_snapshot?: string | null;
          product_image_url_snapshot?: string | null;
          name?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          customer_note?: string | null;
          customizations_snapshot?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_item_customizations: {
        Row: {
          id: string;
          order_item_id: string;
          option_group_name: string;
          option_item_label: string;
          price_delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          option_group_name: string;
          option_item_label: string;
          price_delta?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_item_id?: string;
          option_group_name?: string;
          option_item_label?: string;
          price_delta?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_providers: {
        Row: {
          id: string;
          code: string;
          name: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      store_payment_settings: {
        Row: {
          id: string;
          store_id: string;
          provider_id: string;
          public_key: string | null;
          private_key_reference: string | null;
          integrity_secret_reference: string | null;
          environment: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          provider_id: string;
          public_key?: string | null;
          private_key_reference?: string | null;
          integrity_secret_reference?: string | null;
          environment?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          provider_id?: string;
          public_key?: string | null;
          private_key_reference?: string | null;
          integrity_secret_reference?: string | null;
          environment?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          id: string;
          store_id: string;
          order_id: string | null;
          provider_id: string | null;
          provider_transaction_id: string | null;
          provider_reference: string | null;
          amount: number;
          currency: string;
          status: string;
          payment_method: string | null;
          raw_response: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_id?: string | null;
          provider_id?: string | null;
          provider_transaction_id?: string | null;
          provider_reference?: string | null;
          amount: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          raw_response?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          order_id?: string | null;
          provider_id?: string | null;
          provider_transaction_id?: string | null;
          provider_reference?: string | null;
          amount?: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          raw_response?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          document_type: string | null;
          document_number: string | null;
          platform_role: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          document_type?: string | null;
          document_number?: string | null;
          platform_role?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          document_type?: string | null;
          document_number?: string | null;
          platform_role?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_locations: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          slug: string | null;
          address_line: string | null;
          neighborhood: string | null;
          city: string | null;
          department: string | null;
          country: string;
          postal_code: string | null;
          latitude: number | null;
          longitude: number | null;
          is_public: boolean;
          is_primary: boolean;
          is_active: boolean;
          allows_pickup: boolean;
          allows_local_delivery: boolean;
          phone: string | null;
          whatsapp_number: string | null;
          sort_order: number;
          delivery_notes: string | null;
          pickup_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name?: string;
          slug?: string | null;
          address_line?: string | null;
          neighborhood?: string | null;
          city?: string | null;
          department?: string | null;
          country?: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_public?: boolean;
          is_primary?: boolean;
          is_active?: boolean;
          allows_pickup?: boolean;
          allows_local_delivery?: boolean;
          phone?: string | null;
          whatsapp_number?: string | null;
          sort_order?: number;
          delivery_notes?: string | null;
          pickup_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          slug?: string | null;
          address_line?: string | null;
          neighborhood?: string | null;
          city?: string | null;
          department?: string | null;
          country?: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_public?: boolean;
          is_primary?: boolean;
          is_active?: boolean;
          allows_pickup?: boolean;
          allows_local_delivery?: boolean;
          phone?: string | null;
          whatsapp_number?: string | null;
          sort_order?: number;
          delivery_notes?: string | null;
          pickup_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      geo_departments: {
        Row: {
          id: string;
          country_code: string;
          name: string;
          code: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          country_code?: string;
          name: string;
          code: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          country_code?: string;
          name?: string;
          code?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      geo_cities: {
        Row: {
          id: string;
          department_id: string;
          name: string;
          code: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          department_id: string;
          name: string;
          code?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          department_id?: string;
          name?: string;
          code?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      product_location_availability: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          store_location_id: string;
          is_available: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          store_location_id: string;
          is_available?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          store_location_id?: string;
          is_available?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_business_hours: {
        Row: {
          id: string;
          store_id: string;
          day_of_week: number;
          is_open: boolean;
          opens_at: string | null;
          closes_at: string | null;
          break_starts_at: string | null;
          break_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          day_of_week: number;
          is_open?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          break_starts_at?: string | null;
          break_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          day_of_week?: number;
          is_open?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          break_starts_at?: string | null;
          break_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_commerce_settings: {
        Row: {
          id: string;
          store_id: string;
          business_category: string;
          catalog_type: string;
          commerce_mode: string;
          delivery_mode: string;
          allows_pickup: boolean;
          allows_local_delivery: boolean;
          allows_national_shipping: boolean;
          whatsapp_checkout_enabled: boolean;
          web_order_enabled: boolean;
          online_checkout_enabled: boolean;
          cash_on_delivery_enabled: boolean;
          default_order_method: string;
          local_delivery_notes: string | null;
          shipping_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          business_category?: string;
          catalog_type?: string;
          commerce_mode?: string;
          delivery_mode?: string;
          allows_pickup?: boolean;
          allows_local_delivery?: boolean;
          allows_national_shipping?: boolean;
          whatsapp_checkout_enabled?: boolean;
          web_order_enabled?: boolean;
          online_checkout_enabled?: boolean;
          cash_on_delivery_enabled?: boolean;
          default_order_method?: string;
          local_delivery_notes?: string | null;
          shipping_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          business_category?: string;
          catalog_type?: string;
          commerce_mode?: string;
          delivery_mode?: string;
          allows_pickup?: boolean;
          allows_local_delivery?: boolean;
          allows_national_shipping?: boolean;
          whatsapp_checkout_enabled?: boolean;
          web_order_enabled?: boolean;
          online_checkout_enabled?: boolean;
          cash_on_delivery_enabled?: boolean;
          default_order_method?: string;
          local_delivery_notes?: string | null;
          shipping_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_members: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          role: string;
          status: string;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          role?: string;
          status?: string;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          role?: string;
          status?: string;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_limits: {
        Row: {
          id: string;
          store_id: string;
          plan_key: string;
          max_products: number;
          max_staff: number;
          max_active_offers: number;
          max_monthly_orders: number | null;
          can_use_payments: boolean;
          can_use_custom_domain: boolean;
          can_use_advanced_theme: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          plan_key?: string;
          max_products?: number;
          max_staff?: number;
          max_active_offers?: number;
          max_monthly_orders?: number | null;
          can_use_payments?: boolean;
          can_use_custom_domain?: boolean;
          can_use_advanced_theme?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          plan_key?: string;
          max_products?: number;
          max_staff?: number;
          max_active_offers?: number;
          max_monthly_orders?: number | null;
          can_use_payments?: boolean;
          can_use_custom_domain?: boolean;
          can_use_advanced_theme?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_store_pages: {
        Row: {
          store_id: string;
          store_slug: string;
          store_name: string;
          slogan: string | null;
          business_type: string | null;
          description: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          hero_enabled: boolean | null;
          hero_title: string | null;
          hero_subtitle: string | null;
          hero_cta_label: string | null;
          hero_image_url: string | null;
          hero_background_image_url: string | null;
          whatsapp_number: string | null;
          support_email: string | null;
          country: string;
          city: string | null;
          currency: string;
          theme_mode: string | null;
          theme_preset: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          background_color: string | null;
          text_color: string | null;
          button_radius: string | null;
          template_key: string | null;
          shipping_policy: string | null;
          returns_policy: string | null;
          warranty_policy: string | null;
          privacy_policy: string | null;
          terms_and_conditions: string | null;
          location_address: string | null;
          location_neighborhood: string | null;
          location_city: string | null;
          location_department: string | null;
          location_country: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          catalog_type: string | null;
          business_category: string | null;
          commerce_mode: string | null;
          delivery_mode: string | null;
          allows_pickup: boolean | null;
          allows_local_delivery: boolean | null;
          allows_national_shipping: boolean | null;
          whatsapp_checkout_enabled: boolean | null;
          web_order_enabled: boolean | null;
          cash_on_delivery_enabled: boolean | null;
          online_checkout_enabled: boolean | null;
          default_order_method: string | null;
          local_delivery_notes: string | null;
          shipping_notes: string | null;
        };
        Relationships: [];
      };
      public_product_pages: {
        Row: {
          store_slug: string;
          store_name: string;
          store_whatsapp_number: string | null;
          logo_url: string | null;
          theme_mode: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          background_color: string | null;
          text_color: string | null;
          button_radius: string | null;
          template_key: string | null;
          whatsapp_checkout_enabled: boolean | null;
          web_order_enabled: boolean | null;
          allows_pickup: boolean | null;
          allows_local_delivery: boolean | null;
          commerce_mode: string | null;
          catalog_type: string | null;
          product_id: string;
          product_slug: string;
          product_name: string;
          description: string;
          short_description: string | null;
          product_type: string;
          regular_price: number;
          compare_at_price: number | null;
          sale_price: number | null;
          stock: number;
          is_featured: boolean;
          is_available: boolean;
          preparation_time_minutes: number | null;
          main_image_url: string | null;
          category: string | null;
        };
        Relationships: [];
      };
      public_offer_pages: {
        Row: {
          store_slug: string;
          store_name: string;
          store_whatsapp_number: string | null;
          logo_url: string | null;
          theme_mode: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          background_color: string | null;
          text_color: string | null;
          button_radius: string | null;
          template_key: string | null;
          offer_id: string;
          offer_slug: string;
          title: string;
          subtitle: string | null;
          description: string;
          regular_price: number;
          offer_price: number;
          starts_at: string | null;
          ends_at: string | null;
          duration_minutes: number | null;
          countdown_mode: string;
          show_countdown: boolean;
          is_visible_in_store: boolean;
          sort_order: number;
          status: string;
          offer_whatsapp_number: string | null;
          whatsapp_message: string | null;
          cta_label: string;
          hero_image_url: string | null;
          terms_and_conditions: string | null;
          product_name: string | null;
          product_slug: string | null;
          product_main_image_url: string | null;
        };
        Relationships: [];
      };
      public_store_locations: {
        Row: {
          location_id: string;
          store_id: string;
          store_slug: string;
          name: string;
          city: string | null;
          department: string | null;
          country: string | null;
          address_line: string | null;
          neighborhood: string | null;
          phone: string | null;
          whatsapp_number: string | null;
          allows_pickup: boolean;
          allows_local_delivery: boolean;
          delivery_notes: string | null;
          pickup_notes: string | null;
          is_primary: boolean;
          sort_order: number;
        };
        Relationships: [];
      };
      public_store_campaign_offers: {
        Row: {
          id: string;
          store_id: string;
          store_slug: string;
          offer_slug: string;
          title: string;
          subtitle: string | null;
          offer_price: number;
          regular_price: number;
          countdown_mode: string;
          starts_at: string | null;
          ends_at: string | null;
          duration_minutes: number | null;
          show_countdown: boolean;
          sort_order: number;
          hero_image_url: string | null;
          product_name: string | null;
          product_slug: string | null;
          product_main_image_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_or_create_campaign_offer_session: {
        Args: {
          p_offer_id: string;
          p_visitor_token: string;
        };
        Returns: Json;
      };
      create_store_order: {
        Args: {
          p_store_slug: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email?: string | null;
          p_fulfillment_method?: string;
          p_shipping_address?: string | null;
          p_city?: string | null;
          p_department?: string | null;
          p_delivery_neighborhood?: string | null;
          p_delivery_reference?: string | null;
          p_notes?: string | null;
          p_items?: Json;
          p_store_location_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}

// ── Convenience aliases ──────────────────────────────────────

export type StoreRow = Database['public']['Tables']['stores']['Row'];
export type StoreRowInsert = Database['public']['Tables']['stores']['Insert'];
export type StoreRowUpdate = Database['public']['Tables']['stores']['Update'];

export type StoreThemeRow = Database['public']['Tables']['store_theme_settings']['Row'];
export type StoreThemeRowInsert = Database['public']['Tables']['store_theme_settings']['Insert'];
export type StoreThemeRowUpdate = Database['public']['Tables']['store_theme_settings']['Update'];

export type StorePoliciesRow = Database['public']['Tables']['store_policies']['Row'];
export type StorePoliciesRowInsert = Database['public']['Tables']['store_policies']['Insert'];
export type StorePoliciesRowUpdate = Database['public']['Tables']['store_policies']['Update'];

export type StoreHeroSlideRow = Database['public']['Tables']['store_hero_slides']['Row'];
export type StoreHeroSlideRowInsert = Database['public']['Tables']['store_hero_slides']['Insert'];
export type StoreHeroSlideRowUpdate = Database['public']['Tables']['store_hero_slides']['Update'];

export type StoreProductCategoryRow = Database['public']['Tables']['store_product_categories']['Row'];
export type StoreProductCategoryRowInsert = Database['public']['Tables']['store_product_categories']['Insert'];
export type StoreProductCategoryRowUpdate = Database['public']['Tables']['store_product_categories']['Update'];

export type ProductRow = Database['public']['Tables']['products']['Row'];
export type ProductRowInsert = Database['public']['Tables']['products']['Insert'];
export type ProductRowUpdate = Database['public']['Tables']['products']['Update'];

export type ProductImageRow = Database['public']['Tables']['product_images']['Row'];
export type ProductImageRowInsert = Database['public']['Tables']['product_images']['Insert'];
export type ProductOptionGroupRow = Database['public']['Tables']['product_option_groups']['Row'];
export type ProductOptionGroupRowInsert = Database['public']['Tables']['product_option_groups']['Insert'];
export type ProductOptionGroupRowUpdate = Database['public']['Tables']['product_option_groups']['Update'];
export type ProductOptionItemRow = Database['public']['Tables']['product_option_items']['Row'];
export type ProductOptionItemRowInsert = Database['public']['Tables']['product_option_items']['Insert'];
export type ProductOptionItemRowUpdate = Database['public']['Tables']['product_option_items']['Update'];

export type OfferRow = Database['public']['Tables']['offers']['Row'];
export type OfferRowInsert = Database['public']['Tables']['offers']['Insert'];
export type OfferRowUpdate = Database['public']['Tables']['offers']['Update'];

export type OfferImageRow = Database['public']['Tables']['offer_images']['Row'];
export type OfferImageRowInsert = Database['public']['Tables']['offer_images']['Insert'];

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderRowInsert = Database['public']['Tables']['orders']['Insert'];
export type OrderRowUpdate = Database['public']['Tables']['orders']['Update'];

export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
export type OrderItemRowInsert = Database['public']['Tables']['order_items']['Insert'];
export type OrderItemCustomizationRow = Database['public']['Tables']['order_item_customizations']['Row'];
export type OrderItemCustomizationRowInsert = Database['public']['Tables']['order_item_customizations']['Insert'];

export type PaymentProviderRow = Database['public']['Tables']['payment_providers']['Row'];

export type StorePaymentSettingsRow = Database['public']['Tables']['store_payment_settings']['Row'];
export type StorePaymentSettingsRowInsert = Database['public']['Tables']['store_payment_settings']['Insert'];
export type StorePaymentSettingsRowUpdate = Database['public']['Tables']['store_payment_settings']['Update'];

export type PaymentTransactionRow = Database['public']['Tables']['payment_transactions']['Row'];
export type PaymentTransactionRowInsert = Database['public']['Tables']['payment_transactions']['Insert'];

export type PublicStorePageRow = Database['public']['Views']['public_store_pages']['Row'];
export type PublicProductPageRow = Database['public']['Views']['public_product_pages']['Row'];
export type PublicOfferPageRow = Database['public']['Views']['public_offer_pages']['Row'];
export type PublicStoreCampaignOfferRow = Database['public']['Views']['public_store_campaign_offers']['Row'];

export type CampaignOfferSessionRow = Database['public']['Tables']['campaign_offer_sessions']['Row'];
export type CampaignOfferSessionInsert = Database['public']['Tables']['campaign_offer_sessions']['Insert'];

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileRowInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileRowUpdate = Database['public']['Tables']['profiles']['Update'];

export type StoreMemberRow = Database['public']['Tables']['store_members']['Row'];
export type StoreMemberRowInsert = Database['public']['Tables']['store_members']['Insert'];
export type StoreMemberRowUpdate = Database['public']['Tables']['store_members']['Update'];

export type StoreLimitRow = Database['public']['Tables']['store_limits']['Row'];
export type StoreLimitRowInsert = Database['public']['Tables']['store_limits']['Insert'];
export type StoreLimitRowUpdate = Database['public']['Tables']['store_limits']['Update'];

export type StoreLocationRow = Database['public']['Tables']['store_locations']['Row'];
export type StoreLocationRowInsert = Database['public']['Tables']['store_locations']['Insert'];
export type StoreLocationRowUpdate = Database['public']['Tables']['store_locations']['Update'];

export type StoreBusinessHourRow = Database['public']['Tables']['store_business_hours']['Row'];
export type StoreBusinessHourRowInsert = Database['public']['Tables']['store_business_hours']['Insert'];
export type StoreBusinessHourRowUpdate = Database['public']['Tables']['store_business_hours']['Update'];

export type StoreCommerceSettingsRow = Database['public']['Tables']['store_commerce_settings']['Row'];
export type StoreCommerceSettingsRowInsert = Database['public']['Tables']['store_commerce_settings']['Insert'];
export type StoreCommerceSettingsRowUpdate = Database['public']['Tables']['store_commerce_settings']['Update'];

export type GeoDepartmentRow = Database['public']['Tables']['geo_departments']['Row'];
export type GeoCityRow = Database['public']['Tables']['geo_cities']['Row'];

export type ProductLocationAvailabilityRow = Database['public']['Tables']['product_location_availability']['Row'];
export type ProductLocationAvailabilityInsert = Database['public']['Tables']['product_location_availability']['Insert'];
export type ProductLocationAvailabilityUpdate = Database['public']['Tables']['product_location_availability']['Update'];

export type PublicStoreLocationRow = Database['public']['Views']['public_store_locations']['Row'];
