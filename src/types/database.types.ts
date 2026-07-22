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
          business_vertical: string | null;
          business_subcategory: string | null;
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
          business_vertical?: string | null;
          business_subcategory?: string | null;
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
          business_vertical?: string | null;
          business_subcategory?: string | null;
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
          header_settings: Json | null;
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
          header_settings?: Json | null;
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
          header_settings?: Json | null;
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
      store_home_sections: {
        Row: {
          id: string;
          store_id: string;
          section_type: string;
          sort_order: number;
          is_active: boolean;
          heading: string | null;
          subheading: string | null;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          section_type: string;
          sort_order?: number;
          is_active?: boolean;
          heading?: string | null;
          subheading?: string | null;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          section_type?: string;
          sort_order?: number;
          is_active?: boolean;
          heading?: string | null;
          subheading?: string | null;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_home_section_items: {
        Row: {
          id: string;
          section_id: string;
          store_id: string;
          sort_order: number;
          is_active: boolean;
          linked_entity_type: string | null;
          linked_entity_id: string | null;
          title: string | null;
          subtitle: string | null;
          body: string | null;
          image_url: string | null;
          link_url: string | null;
          link_label: string | null;
          rating: number | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          store_id: string;
          sort_order?: number;
          is_active?: boolean;
          linked_entity_type?: string | null;
          linked_entity_id?: string | null;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          link_label?: string | null;
          rating?: number | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          store_id?: string;
          sort_order?: number;
          is_active?: boolean;
          linked_entity_type?: string | null;
          linked_entity_id?: string | null;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          link_label?: string | null;
          rating?: number | null;
          settings?: Json;
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
          parent_id: string | null;
          image_url: string | null;
          color: string | null;
          show_in_menu: boolean;
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
          parent_id?: string | null;
          image_url?: string | null;
          color?: string | null;
          show_in_menu?: boolean;
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
          parent_id?: string | null;
          image_url?: string | null;
          color?: string | null;
          show_in_menu?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_product_facets: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          input_type: string;
          show_in_product_form: boolean;
          show_in_catalog_filters: boolean;
          show_in_mega_menu: boolean;
          applies_to_all_categories: boolean;
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
          input_type?: string;
          show_in_product_form?: boolean;
          show_in_catalog_filters?: boolean;
          show_in_mega_menu?: boolean;
          applies_to_all_categories?: boolean;
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
          input_type?: string;
          show_in_product_form?: boolean;
          show_in_catalog_filters?: boolean;
          show_in_mega_menu?: boolean;
          applies_to_all_categories?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_product_facet_categories: {
        Row: {
          facet_id: string;
          category_id: string;
          applies_to_children: boolean;
          created_at: string;
        };
        Insert: {
          facet_id: string;
          category_id: string;
          applies_to_children?: boolean;
          created_at?: string;
        };
        Update: {
          facet_id?: string;
          category_id?: string;
          applies_to_children?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      store_product_facet_values: {
        Row: {
          id: string;
          store_id: string;
          facet_id: string;
          value: string;
          slug: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          facet_id: string;
          value: string;
          slug: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          facet_id?: string;
          value?: string;
          slug?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_facet_values: {
        Row: {
          product_id: string;
          facet_value_id: string;
        };
        Insert: {
          product_id: string;
          facet_value_id: string;
        };
        Update: {
          product_id?: string;
          facet_value_id?: string;
        };
        Relationships: [];
      };
      store_product_collections: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          color: string | null;
          sort_order: number;
          is_active: boolean;
          show_on_home: boolean;
          show_in_menu: boolean;
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
          image_url?: string | null;
          color?: string | null;
          sort_order?: number;
          is_active?: boolean;
          show_on_home?: boolean;
          show_in_menu?: boolean;
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
          image_url?: string | null;
          color?: string | null;
          sort_order?: number;
          is_active?: boolean;
          show_on_home?: boolean;
          show_in_menu?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_collections: {
        Row: {
          product_id: string;
          collection_id: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          collection_id: string;
          created_at?: string;
        };
        Update: {
          product_id?: string;
          collection_id?: string;
          created_at?: string;
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
          description_sections: Json | null;
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
          category_id: string | null;
          has_variants: boolean;
          show_variants_as_cards: boolean;
          size_chart_id: string | null;
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
          description_sections?: Json | null;
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
          category_id?: string | null;
          has_variants?: boolean;
          show_variants_as_cards?: boolean;
          size_chart_id?: string | null;
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
          description_sections?: Json | null;
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
          category_id?: string | null;
          has_variants?: boolean;
          show_variants_as_cards?: boolean;
          size_chart_id?: string | null;
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
          variant_id: string | null;
          option_value_id: string | null;
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
          variant_id?: string | null;
          option_value_id?: string | null;
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
          variant_id?: string | null;
          option_value_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      product_variant_options: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          name: string;
          type: string;
          use_as_public_filter: boolean;
          controls_media: boolean;
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
          type?: string;
          use_as_public_filter?: boolean;
          controls_media?: boolean;
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
          type?: string;
          use_as_public_filter?: boolean;
          controls_media?: boolean;
          is_required?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variant_option_values: {
        Row: {
          id: string;
          store_id: string;
          option_id: string;
          owner_id: string;
          value: string;
          color_hex: string | null;
          metadata: Json;
          normalized_value: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          option_id: string;
          owner_id: string;
          value: string;
          color_hex?: string | null;
          metadata?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          option_id?: string;
          owner_id?: string;
          value?: string;
          color_hex?: string | null;
          metadata?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          sku: string | null;
          barcode: string | null;
          price: number | null;
          compare_at_price: number | null;
          cost: number | null;
          stock_quantity: number;
          stock_policy: string;
          low_stock_threshold: number | null;
          weight: number | null;
          status: string;
          is_default: boolean;
          position: number;
          option_signature: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          owner_id: string;
          sku?: string | null;
          barcode?: string | null;
          price?: number | null;
          compare_at_price?: number | null;
          cost?: number | null;
          stock_quantity?: number;
          stock_policy?: string;
          low_stock_threshold?: number | null;
          weight?: number | null;
          status?: string;
          is_default?: boolean;
          position?: number;
          option_signature: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          owner_id?: string;
          sku?: string | null;
          barcode?: string | null;
          price?: number | null;
          compare_at_price?: number | null;
          cost?: number | null;
          stock_quantity?: number;
          stock_policy?: string;
          low_stock_threshold?: number | null;
          weight?: number | null;
          status?: string;
          is_default?: boolean;
          position?: number;
          option_signature?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variant_selected_values: {
        Row: {
          variant_id: string;
          option_id: string;
          option_value_id: string;
          store_id: string;
        };
        Insert: {
          variant_id: string;
          option_id: string;
          option_value_id: string;
          store_id: string;
        };
        Update: {
          variant_id?: string;
          option_id?: string;
          option_value_id?: string;
          store_id?: string;
        };
        Relationships: [];
      };
      product_size_charts: {
        Row: {
          id: string;
          store_id: string;
          owner_id: string;
          category_id: string | null;
          name: string;
          chart_type: string;
          unit: string;
          content: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          owner_id: string;
          category_id?: string | null;
          name: string;
          chart_type?: string;
          unit?: string;
          content?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          owner_id?: string;
          category_id?: string | null;
          name?: string;
          chart_type?: string;
          unit?: string;
          content?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
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
      checkout_sessions: {
        Row: {
          id: string;
          store_id: string;
          store_slug: string;
          store_location_id: string | null;
          provider: string;
          provider_reference: string;
          amount_in_cents: number;
          currency: string;
          status: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          fulfillment_method: string;
          shipping_address: string | null;
          city: string | null;
          department: string | null;
          delivery_neighborhood: string | null;
          delivery_reference: string | null;
          notes: string | null;
          items_snapshot: Json;
          subtotal_amount: number;
          shipping_amount: number;
          total_amount: number;
          checkout_url: string;
          order_id: string | null;
          wompi_transaction_id: string | null;
          expires_at: string | null;
          whatsapp_consent: boolean;
          whatsapp_consent_at: string | null;
          whatsapp_consent_source: string | null;
          whatsapp_consent_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          store_slug: string;
          store_location_id?: string | null;
          provider?: string;
          provider_reference: string;
          amount_in_cents: number;
          currency?: string;
          status?: string;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          fulfillment_method?: string;
          shipping_address?: string | null;
          city?: string | null;
          department?: string | null;
          delivery_neighborhood?: string | null;
          delivery_reference?: string | null;
          notes?: string | null;
          items_snapshot?: Json;
          subtotal_amount?: number;
          shipping_amount?: number;
          total_amount: number;
          checkout_url: string;
          order_id?: string | null;
          wompi_transaction_id?: string | null;
          expires_at?: string | null;
          whatsapp_consent?: boolean;
          whatsapp_consent_at?: string | null;
          whatsapp_consent_source?: string | null;
          whatsapp_consent_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subtotal_amount?: number;
          shipping_amount?: number;
          total_amount?: number;
          status?: string;
          order_id?: string | null;
          wompi_transaction_id?: string | null;
          expires_at?: string | null;
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
          whatsapp_consent: boolean;
          whatsapp_consent_at: string | null;
          whatsapp_consent_source: string | null;
          whatsapp_consent_version: string | null;
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
          whatsapp_consent?: boolean;
          whatsapp_consent_at?: string | null;
          whatsapp_consent_source?: string | null;
          whatsapp_consent_version?: string | null;
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
          whatsapp_consent?: boolean;
          whatsapp_consent_at?: string | null;
          whatsapp_consent_source?: string | null;
          whatsapp_consent_version?: string | null;
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
          variant_id: string | null;
          offer_id: string | null;
          product_name_snapshot: string | null;
          product_slug_snapshot: string | null;
          product_image_url_snapshot: string | null;
          variant_label_snapshot: string | null;
          variant_sku_snapshot: string | null;
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
          variant_id?: string | null;
          offer_id?: string | null;
          product_name_snapshot?: string | null;
          product_slug_snapshot?: string | null;
          product_image_url_snapshot?: string | null;
          variant_label_snapshot?: string | null;
          variant_sku_snapshot?: string | null;
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
          variant_id?: string | null;
          offer_id?: string | null;
          product_name_snapshot?: string | null;
          product_slug_snapshot?: string | null;
          product_image_url_snapshot?: string | null;
          variant_label_snapshot?: string | null;
          variant_sku_snapshot?: string | null;
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
          option_group_id: string | null;
          option_item_id: string | null;
          option_group_name: string;
          option_item_label: string;
          price_delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          option_group_id?: string | null;
          option_item_id?: string | null;
          option_group_name: string;
          option_item_label: string;
          price_delta?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_item_id?: string;
          option_group_id?: string | null;
          option_item_id?: string | null;
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
          // Real secrets — never selectable by `authenticated` (migration 086).
          // Only service_role (Edge Functions) can read these columns.
          private_key_reference: string | null;
          integrity_secret_reference: string | null;
          events_secret: string | null;
          // Generated columns (migration 086) — the only secret-derived data
          // the frontend is allowed to read: presence + masked last-4 preview.
          has_private_key: boolean;
          has_integrity_secret: boolean;
          has_events_secret: boolean;
          private_key_preview: string | null;
          integrity_secret_preview: string | null;
          events_secret_preview: string | null;
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
          events_secret?: string | null;
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
          events_secret?: string | null;
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
          amount_in_cents: number | null;
          currency: string;
          status: string;
          payment_method: string | null;
          checkout_url: string | null;
          raw_response: Json | null;
          paid_at: string | null;
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
          amount_in_cents?: number | null;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          checkout_url?: string | null;
          raw_response?: Json | null;
          paid_at?: string | null;
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
          amount_in_cents?: number | null;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          checkout_url?: string | null;
          raw_response?: Json | null;
          paid_at?: string | null;
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
          timezone: string;
          order_schedule_mode: string;
          orders_paused: boolean;
          orders_paused_until: string | null;
          orders_pause_reason: string | null;
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
          timezone?: string;
          order_schedule_mode?: string;
          orders_paused?: boolean;
          orders_paused_until?: string | null;
          orders_pause_reason?: string | null;
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
          timezone?: string;
          order_schedule_mode?: string;
          orders_paused?: boolean;
          orders_paused_until?: string | null;
          orders_pause_reason?: string | null;
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
          local_delivery_base_fee: number;
          local_delivery_free_from: number | null;
          national_shipping_base_fee: number;
          national_shipping_free_from: number | null;
          order_flow_type: string;
          has_inventory: boolean;
          has_variants: boolean;
          has_leads: boolean;
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
          local_delivery_base_fee?: number;
          local_delivery_free_from?: number | null;
          national_shipping_base_fee?: number;
          national_shipping_free_from?: number | null;
          order_flow_type?: string;
          has_inventory?: boolean;
          has_variants?: boolean;
          has_leads?: boolean;
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
          local_delivery_base_fee?: number;
          local_delivery_free_from?: number | null;
          national_shipping_base_fee?: number;
          national_shipping_free_from?: number | null;
          order_flow_type?: string;
          has_inventory?: boolean;
          has_variants?: boolean;
          has_leads?: boolean;
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
      store_domains: {
        Row: {
          id: string;
          store_id: string;
          hostname: string;
          status: string;
          is_primary: boolean;
          dns_record_type: string;
          dns_target: string;
          provider: string;
          provider_hostname_id: string | null;
          ownership_verification_name: string | null;
          ownership_verification_value: string | null;
          ssl_validation_records: Json;
          failure_reason: string | null;
          last_checked_at: string | null;
          verified_at: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          hostname: string;
          status?: string;
          is_primary?: boolean;
          dns_record_type: string;
          dns_target: string;
          provider?: string;
          provider_hostname_id?: string | null;
          ownership_verification_name?: string | null;
          ownership_verification_value?: string | null;
          ssl_validation_records?: Json;
          failure_reason?: string | null;
          last_checked_at?: string | null;
          verified_at?: string | null;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          hostname?: string;
          status?: string;
          is_primary?: boolean;
          dns_record_type?: string;
          dns_target?: string;
          provider?: string;
          provider_hostname_id?: string | null;
          ownership_verification_name?: string | null;
          ownership_verification_value?: string | null;
          ssl_validation_records?: Json;
          failure_reason?: string | null;
          last_checked_at?: string | null;
          verified_at?: string | null;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          variant_id: string | null;
          store_location_id: string | null;
          order_id: string | null;
          order_item_id: string | null;
          movement_type: string;
          reason: string;
          quantity_change: number;
          stock_before: number;
          stock_after: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          variant_id?: string | null;
          store_location_id?: string | null;
          order_id?: string | null;
          order_item_id?: string | null;
          movement_type: string;
          reason: string;
          quantity_change: number;
          stock_before: number;
          stock_after: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          variant_id?: string | null;
          store_location_id?: string | null;
          order_id?: string | null;
          order_item_id?: string | null;
          movement_type?: string;
          reason?: string;
          quantity_change?: number;
          stock_before?: number;
          stock_after?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      location_schedule_intervals: {
        Row: {
          id: string;
          store_id: string;
          location_id: string;
          schedule_kind: string;
          day_of_week: number;
          starts_at: string | null;
          ends_at: string | null;
          ends_next_day: boolean;
          is_all_day: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          location_id: string;
          schedule_kind: string;
          day_of_week: number;
          starts_at?: string | null;
          ends_at?: string | null;
          ends_next_day?: boolean;
          is_all_day?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          location_id?: string;
          schedule_kind?: string;
          day_of_week?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          ends_next_day?: boolean;
          is_all_day?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      location_schedule_exceptions: {
        Row: {
          id: string;
          store_id: string;
          location_id: string;
          schedule_kind: string;
          exception_date: string;
          is_closed: boolean;
          intervals: Json;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          location_id: string;
          schedule_kind: string;
          exception_date: string;
          is_closed?: boolean;
          intervals?: Json;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          location_id?: string;
          schedule_kind?: string;
          exception_date?: string;
          is_closed?: boolean;
          intervals?: Json;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_whatsapp_settings: {
        Row: {
          id: string;
          store_id: string;
          enabled: boolean;
          sender_mode: string;
          customer_order_confirmation_enabled: boolean;
          order_confirmed_enabled: boolean;
          payment_approved_enabled: boolean;
          payment_declined_enabled: boolean;
          order_preparing_enabled: boolean;
          order_ready_for_pickup_enabled: boolean;
          order_shipped_enabled: boolean;
          order_delivered_enabled: boolean;
          order_cancelled_enabled: boolean;
          locale: string;
          timezone: string;
          final_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          enabled?: boolean;
          sender_mode?: string;
          customer_order_confirmation_enabled?: boolean;
          order_confirmed_enabled?: boolean;
          payment_approved_enabled?: boolean;
          payment_declined_enabled?: boolean;
          order_preparing_enabled?: boolean;
          order_ready_for_pickup_enabled?: boolean;
          order_shipped_enabled?: boolean;
          order_delivered_enabled?: boolean;
          order_cancelled_enabled?: boolean;
          locale?: string;
          timezone?: string;
          final_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          enabled?: boolean;
          sender_mode?: string;
          customer_order_confirmation_enabled?: boolean;
          order_confirmed_enabled?: boolean;
          payment_approved_enabled?: boolean;
          payment_declined_enabled?: boolean;
          order_preparing_enabled?: boolean;
          order_ready_for_pickup_enabled?: boolean;
          order_shipped_enabled?: boolean;
          order_delivered_enabled?: boolean;
          order_cancelled_enabled?: boolean;
          locale?: string;
          timezone?: string;
          final_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_notifications: {
        Row: {
          id: string;
          store_id: string;
          order_id: string | null;
          channel: string;
          event_type: string;
          recipient_phone: string;
          template_name: string;
          template_language: string;
          template_params: Json | null;
          status: string;
          provider: string;
          provider_message_id: string | null;
          attempts: number;
          max_attempts: number;
          next_attempt_at: string;
          locked_at: string | null;
          locked_by: string | null;
          is_permanent_failure: boolean;
          last_error_category: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          queued_at: string;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_id?: string | null;
          channel?: string;
          event_type: string;
          recipient_phone: string;
          template_name: string;
          template_language?: string;
          template_params?: Json | null;
          status?: string;
          provider?: string;
          provider_message_id?: string | null;
          attempts?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          is_permanent_failure?: boolean;
          last_error_category?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          queued_at?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          order_id?: string | null;
          channel?: string;
          event_type?: string;
          recipient_phone?: string;
          template_name?: string;
          template_language?: string;
          template_params?: Json | null;
          status?: string;
          provider?: string;
          provider_message_id?: string | null;
          attempts?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          is_permanent_failure?: boolean;
          last_error_category?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          queued_at?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_whatsapp_connections: {
        Row: {
          id: string;
          store_id: string;
          meta_business_id: string | null;
          waba_id: string | null;
          phone_number_id: string | null;
          display_phone_number: string | null;
          verified_name: string | null;
          connection_status: string;
          onboarding_type: string | null;
          coexistence_enabled: boolean;
          template_name: string;
          template_language: string;
          template_status: string;
          template_rejected_reason: string | null;
          token_secret_reference: string | null;
          connected_by: string | null;
          connected_at: string | null;
          last_verified_at: string | null;
          disconnected_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          meta_business_id?: string | null;
          waba_id?: string | null;
          phone_number_id?: string | null;
          display_phone_number?: string | null;
          verified_name?: string | null;
          connection_status?: string;
          onboarding_type?: string | null;
          coexistence_enabled?: boolean;
          template_name?: string;
          template_language?: string;
          template_status?: string;
          template_rejected_reason?: string | null;
          token_secret_reference?: string | null;
          connected_by?: string | null;
          connected_at?: string | null;
          last_verified_at?: string | null;
          disconnected_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          meta_business_id?: string | null;
          waba_id?: string | null;
          phone_number_id?: string | null;
          display_phone_number?: string | null;
          verified_name?: string | null;
          connection_status?: string;
          onboarding_type?: string | null;
          coexistence_enabled?: boolean;
          template_name?: string;
          template_language?: string;
          template_status?: string;
          template_rejected_reason?: string | null;
          token_secret_reference?: string | null;
          connected_by?: string | null;
          connected_at?: string | null;
          last_verified_at?: string | null;
          disconnected_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_whatsapp_connection_events: {
        Row: {
          id: string;
          store_id: string;
          event_type: string;
          actor_user_id: string | null;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          event_type: string;
          actor_user_id?: string | null;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          event_type?: string;
          actor_user_id?: string | null;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      };
    Views: {
      platform_whatsapp_connections_overview: {
        Row: {
          store_id: string;
          store_name: string;
          connection_status: string;
          display_phone_number_masked: string | null;
          waba_id: string | null;
          template_status: string;
          onboarding_type: string | null;
          coexistence_enabled: boolean;
          last_verified_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          connected_at: string | null;
          disconnected_at: string | null;
        };
        Relationships: [];
      };
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
          local_delivery_base_fee: number | null;
          local_delivery_free_from: number | null;
          national_shipping_base_fee: number | null;
          national_shipping_free_from: number | null;
          header_settings: Json | null;
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
          description_sections: Json | null;
          product_type: string;
          regular_price: number;
          compare_at_price: number | null;
          sale_price: number | null;
          stock: number;
          track_inventory: boolean;
          is_featured: boolean;
          is_available: boolean;
          preparation_time_minutes: number | null;
          allows_special_instructions: boolean;
          special_instructions_label: string | null;
          special_instructions_placeholder: string | null;
          special_instructions_max_length: number;
          main_image_url: string | null;
          category: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          category_parent_id: string | null;
          collections: Json;
          facet_values: Json;
          has_variants: boolean | null;
          show_variants_as_cards: boolean | null;
          size_chart: Json | null;
          variant_options: Json;
          variants: Json;
          product_created_at: string;
        };
        Relationships: [];
      };
      public_store_collections: {
        Row: {
          id: string;
          store_id: string;
          store_slug: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          color: string | null;
          sort_order: number;
          show_on_home: boolean;
          show_in_menu: boolean;
        };
        Relationships: [];
      };
      public_product_facet_values: {
        Row: {
          product_id: string;
          store_id: string;
          facet_value_id: string;
          facet_id: string;
          facet_name: string;
          facet_slug: string;
          input_type: string;
          value: string;
          value_slug: string;
          sort_order: number;
        };
        Relationships: [];
      };
      public_store_categories: {
        Row: {
          id: string;
          store_id: string;
          store_slug: string;
          name: string;
          slug: string;
          description: string | null;
          parent_id: string | null;
          image_url: string | null;
          color: string | null;
          sort_order: number;
          show_in_menu: boolean;
        };
        Relationships: [];
      };
      public_store_facets: {
        Row: {
          id: string;
          store_id: string;
          store_slug: string;
          name: string;
          slug: string;
          input_type: string;
          show_in_catalog_filters: boolean;
          show_in_mega_menu: boolean;
          applies_to_all_categories: boolean;
          sort_order: number;
          applicable_categories: Json;
        };
        Relationships: [];
      };
      public_store_facet_values: {
        Row: {
          id: string;
          store_id: string;
          facet_id: string;
          value: string;
          slug: string;
          sort_order: number;
        };
        Relationships: [];
      };
      public_product_images: {
        Row: {
          product_id: string;
          image_url: string;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean | null;
        };
        Relationships: [];
      };
      public_product_option_groups: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          description: string | null;
          selection_type: string;
          min_select: number;
          max_select: number | null;
          is_required: boolean;
          sort_order: number;
        };
        Relationships: [];
      };
      public_product_option_items: {
        Row: {
          id: string;
          group_id: string;
          product_id: string;
          label: string;
          description: string | null;
          price_delta: number;
          is_default: boolean;
          sort_order: number;
        };
        Relationships: [];
      };
      public_store_hero_slides: {
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
        };
        Relationships: [];
      };
      public_store_home_sections: {
        Row: {
          id: string;
          store_id: string;
          section_type: string;
          sort_order: number;
          is_active: boolean;
          heading: string | null;
          subheading: string | null;
          content: Json;
        };
        Relationships: [];
      };
      public_store_home_section_items: {
        Row: {
          id: string;
          section_id: string;
          store_id: string;
          sort_order: number;
          is_active: boolean;
          linked_entity_type: string | null;
          linked_entity_id: string | null;
          title: string | null;
          subtitle: string | null;
          body: string | null;
          image_url: string | null;
          link_url: string | null;
          link_label: string | null;
          rating: number | null;
          settings: Json;
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
          timezone: string;
          order_schedule_mode: string;
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
      get_location_schedule_status: {
        Args: {
          p_location_id: string;
          p_schedule_kind: string;
          p_at?: string;
        };
        Returns: Json;
      };
      get_location_order_status: {
        Args: {
          p_location_id: string;
          p_at?: string;
        };
        Returns: Json;
      };
      save_location_schedule_configuration: {
        Args: {
          p_location_id: string;
          p_timezone: string;
          p_order_schedule_mode: string;
          p_orders_paused: boolean;
          p_orders_paused_until: string | null;
          p_orders_pause_reason: string | null;
          p_business_intervals: Json;
          p_ordering_intervals: Json;
        };
        Returns: undefined;
      };
      resolve_store_domain: {
        Args: {
          p_hostname: string;
        };
        Returns: Array<{
          store_id: string;
          store_slug: string;
          store_name: string;
          hostname: string;
        }>;
      };
      resolve_store_subdomain: {
        Args: {
          p_slug: string;
        };
        Returns: Array<{
          store_id: string;
          store_slug: string;
          store_name: string;
        }>;
      };
      check_store_slug_availability: {
        Args: {
          p_slug: string;
        };
        Returns: Array<{
          available: boolean;
          normalized_slug: string;
          reason: string;
        }>;
      };
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
          p_payment_method?: string;
          p_whatsapp_consent?: boolean;
          p_whatsapp_consent_source?: string;
        };
        Returns: Json;
      };
      enqueue_test_whatsapp_notification: {
        Args: {
          p_store_id: string;
          p_phone: string;
        };
        Returns: string;
      };
      disconnect_store_whatsapp_connection: {
        Args: {
          p_store_id: string;
        };
        Returns: Json;
      };
      get_payment_result: {
        Args: {
          p_reference: string;
        };
        Returns: Array<{
          session_status: string | null;
          order_number: string | null;
          order_status: string | null;
        }>;
      };
      cancel_store_order: {
        Args: {
          p_order_id: string;
        };
        Returns: Json;
      };
      adjust_product_stock: {
        Args: {
          p_store_id: string;
          p_product_id: string;
          p_movement_type: string;
          p_quantity_change: number;
          p_reason: string;
          p_notes?: string | null;
        };
        Returns: Array<{
          new_stock: number;
          movement_id: string;
        }>;
      };
      adjust_variant_stock: {
        Args: {
          p_store_id: string;
          p_variant_id: string;
          p_movement_type: string;
          p_quantity_change: number;
          p_reason: string;
          p_notes?: string | null;
        };
        Returns: Array<{
          new_stock: number;
          movement_id: string;
        }>;
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

export type StoreHomeSectionRow = Database['public']['Tables']['store_home_sections']['Row'];
export type StoreHomeSectionRowInsert = Database['public']['Tables']['store_home_sections']['Insert'];
export type StoreHomeSectionRowUpdate = Database['public']['Tables']['store_home_sections']['Update'];

export type StoreHomeSectionItemRow = Database['public']['Tables']['store_home_section_items']['Row'];
export type StoreHomeSectionItemRowInsert = Database['public']['Tables']['store_home_section_items']['Insert'];
export type StoreHomeSectionItemRowUpdate = Database['public']['Tables']['store_home_section_items']['Update'];

export type StoreProductCategoryRow = Database['public']['Tables']['store_product_categories']['Row'];
export type StoreProductCategoryRowInsert = Database['public']['Tables']['store_product_categories']['Insert'];
export type StoreProductCategoryRowUpdate = Database['public']['Tables']['store_product_categories']['Update'];

export type StoreProductCollectionRow = Database['public']['Tables']['store_product_collections']['Row'];
export type StoreProductCollectionRowInsert = Database['public']['Tables']['store_product_collections']['Insert'];
export type StoreProductCollectionRowUpdate = Database['public']['Tables']['store_product_collections']['Update'];
export type ProductCollectionRow = Database['public']['Tables']['product_collections']['Row'];
export type ProductCollectionRowInsert = Database['public']['Tables']['product_collections']['Insert'];

export type StoreProductFacetCategoryRow = Database['public']['Tables']['store_product_facet_categories']['Row'];
export type StoreProductFacetCategoryRowInsert = Database['public']['Tables']['store_product_facet_categories']['Insert'];

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

export type ProductVariantOptionRow = Database['public']['Tables']['product_variant_options']['Row'];
export type ProductVariantOptionRowInsert = Database['public']['Tables']['product_variant_options']['Insert'];
export type ProductVariantOptionRowUpdate = Database['public']['Tables']['product_variant_options']['Update'];

export type ProductVariantOptionValueRow = Database['public']['Tables']['product_variant_option_values']['Row'];
export type ProductVariantOptionValueRowInsert = Database['public']['Tables']['product_variant_option_values']['Insert'];
export type ProductVariantOptionValueRowUpdate = Database['public']['Tables']['product_variant_option_values']['Update'];

export type ProductVariantRow = Database['public']['Tables']['product_variants']['Row'];
export type ProductVariantRowInsert = Database['public']['Tables']['product_variants']['Insert'];
export type ProductVariantRowUpdate = Database['public']['Tables']['product_variants']['Update'];

export type ProductVariantSelectedValueRow = Database['public']['Tables']['product_variant_selected_values']['Row'];
export type ProductVariantSelectedValueRowInsert = Database['public']['Tables']['product_variant_selected_values']['Insert'];

export type ProductSizeChartRow = Database['public']['Tables']['product_size_charts']['Row'];
export type ProductSizeChartRowInsert = Database['public']['Tables']['product_size_charts']['Insert'];
export type ProductSizeChartRowUpdate = Database['public']['Tables']['product_size_charts']['Update'];

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

export type InventoryMovementRow = Database['public']['Tables']['inventory_movements']['Row'];
export type InventoryMovementRowInsert = Database['public']['Tables']['inventory_movements']['Insert'];

export type PaymentProviderRow = Database['public']['Tables']['payment_providers']['Row'];

export type StorePaymentSettingsRow = Database['public']['Tables']['store_payment_settings']['Row'];
export type StorePaymentSettingsRowInsert = Database['public']['Tables']['store_payment_settings']['Insert'];
export type StorePaymentSettingsRowUpdate = Database['public']['Tables']['store_payment_settings']['Update'];

export type PaymentTransactionRow = Database['public']['Tables']['payment_transactions']['Row'];
export type PaymentTransactionRowInsert = Database['public']['Tables']['payment_transactions']['Insert'];

export type PublicStorePageRow = Database['public']['Views']['public_store_pages']['Row'];
export type PublicProductPageRow = Database['public']['Views']['public_product_pages']['Row'];
export type PublicProductFacetValueRow = Database['public']['Views']['public_product_facet_values']['Row'];
export type PublicProductImageRow = Database['public']['Views']['public_product_images']['Row'];
export type PublicStoreHeroSlideRow = Database['public']['Views']['public_store_hero_slides']['Row'];
export type PublicStoreHomeSectionRow = Database['public']['Views']['public_store_home_sections']['Row'];
export type PublicStoreHomeSectionItemRow = Database['public']['Views']['public_store_home_section_items']['Row'];
export type PublicOfferPageRow = Database['public']['Views']['public_offer_pages']['Row'];
export type PublicStoreCampaignOfferRow = Database['public']['Views']['public_store_campaign_offers']['Row'];
export type PublicStoreCategoryRow = Database['public']['Views']['public_store_categories']['Row'];
export type PublicStoreCollectionRow = Database['public']['Views']['public_store_collections']['Row'];
export type PublicStoreFacetRow = Database['public']['Views']['public_store_facets']['Row'];
export type PublicStoreFacetValueRow = Database['public']['Views']['public_store_facet_values']['Row'];

export type StoreFacetRow = Database['public']['Tables']['store_product_facets']['Row'];
export type StoreFacetRowInsert = Database['public']['Tables']['store_product_facets']['Insert'];
export type StoreFacetRowUpdate = Database['public']['Tables']['store_product_facets']['Update'];

export type StoreFacetValueRow = Database['public']['Tables']['store_product_facet_values']['Row'];
export type StoreFacetValueRowInsert = Database['public']['Tables']['store_product_facet_values']['Insert'];
export type StoreFacetValueRowUpdate = Database['public']['Tables']['store_product_facet_values']['Update'];

export type ProductFacetValueRow = Database['public']['Tables']['product_facet_values']['Row'];
export type ProductFacetValueRowInsert = Database['public']['Tables']['product_facet_values']['Insert'];

export type CampaignOfferSessionRow = Database['public']['Tables']['campaign_offer_sessions']['Row'];
export type CampaignOfferSessionInsert = Database['public']['Tables']['campaign_offer_sessions']['Insert'];

export type CheckoutSessionRow = Database['public']['Tables']['checkout_sessions']['Row'];
export type CheckoutSessionInsert = Database['public']['Tables']['checkout_sessions']['Insert'];

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileRowInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileRowUpdate = Database['public']['Tables']['profiles']['Update'];

export type StoreMemberRow = Database['public']['Tables']['store_members']['Row'];
export type StoreMemberRowInsert = Database['public']['Tables']['store_members']['Insert'];
export type StoreMemberRowUpdate = Database['public']['Tables']['store_members']['Update'];

export type StoreLimitRow = Database['public']['Tables']['store_limits']['Row'];
export type StoreLimitRowInsert = Database['public']['Tables']['store_limits']['Insert'];
export type StoreLimitRowUpdate = Database['public']['Tables']['store_limits']['Update'];

export type StoreDomainRow = Database['public']['Tables']['store_domains']['Row'];
export type StoreDomainRowInsert = Database['public']['Tables']['store_domains']['Insert'];
export type StoreDomainRowUpdate = Database['public']['Tables']['store_domains']['Update'];

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
