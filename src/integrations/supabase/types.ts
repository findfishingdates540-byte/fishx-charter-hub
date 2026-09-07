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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta_json: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta_json?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta_json?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      boats: {
        Row: {
          business_id: string | null
          capacity: number
          captain_id: string
          created_at: string
          description: string | null
          hero_image_url: string | null
          home_port: string | null
          id: string
          image_urls: string[]
          is_active: boolean
          length_ft: number | null
          make: string | null
          model: string | null
          name: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          capacity?: number
          captain_id: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          home_port?: string | null
          id?: string
          image_urls?: string[]
          is_active?: boolean
          length_ft?: number | null
          make?: string | null
          model?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          capacity?: number
          captain_id?: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          home_port?: string | null
          id?: string
          image_urls?: string[]
          is_active?: boolean
          length_ft?: number | null
          make?: string | null
          model?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boats_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      bookable_services: {
        Row: {
          accept_window_hours: number
          base_price_cents: number
          boat_id: string | null
          business_id: string
          cancellation_policy: string
          capacity: number
          charter_id: string | null
          created_at: string
          departure_location: string | null
          deposit_cents: number
          description: string | null
          duration_minutes: number | null
          hero_url: string | null
          id: string
          includes: string[]
          instant_book: boolean
          is_published: boolean
          kind: Database["public"]["Enums"]["service_kind"]
          policies_json: Json
          pricing_json: Json
          slug: string | null
          target_species: string[]
          title: string
          updated_at: string
          water_type: string | null
        }
        Insert: {
          accept_window_hours?: number
          base_price_cents?: number
          boat_id?: string | null
          business_id: string
          cancellation_policy?: string
          capacity?: number
          charter_id?: string | null
          created_at?: string
          departure_location?: string | null
          deposit_cents?: number
          description?: string | null
          duration_minutes?: number | null
          hero_url?: string | null
          id?: string
          includes?: string[]
          instant_book?: boolean
          is_published?: boolean
          kind: Database["public"]["Enums"]["service_kind"]
          policies_json?: Json
          pricing_json?: Json
          slug?: string | null
          target_species?: string[]
          title: string
          updated_at?: string
          water_type?: string | null
        }
        Update: {
          accept_window_hours?: number
          base_price_cents?: number
          boat_id?: string | null
          business_id?: string
          cancellation_policy?: string
          capacity?: number
          charter_id?: string | null
          created_at?: string
          departure_location?: string | null
          deposit_cents?: number
          description?: string | null
          duration_minutes?: number | null
          hero_url?: string | null
          id?: string
          includes?: string[]
          instant_book?: boolean
          is_published?: boolean
          kind?: Database["public"]["Enums"]["service_kind"]
          policies_json?: Json
          pricing_json?: Json
          slug?: string | null
          target_species?: string[]
          title?: string
          updated_at?: string
          water_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookable_services_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookable_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookable_services_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "charters"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          addon_id: string | null
          booking_id: string
          created_at: string
          id: string
          quantity: number
          title: string
          total_cents: number
          unit: string
          unit_price_cents: number
        }
        Insert: {
          addon_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          quantity?: number
          title: string
          total_cents?: number
          unit?: string
          unit_price_cents?: number
        }
        Update: {
          addon_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          quantity?: number
          title?: string
          total_cents?: number
          unit?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          angler_id: string | null
          booking_id: string | null
          created_at: string
          expires_at: string
          id: string
          released_at: string | null
          slot_id: string
        }
        Insert: {
          angler_id?: string | null
          booking_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          released_at?: string | null
          slot_id: string
        }
        Update: {
          angler_id?: string | null
          booking_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          released_at?: string | null
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "service_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_messages: {
        Row: {
          body: string | null
          booking_id: string
          created_at: string
          id: string
          media_json: Json
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          booking_id: string
          created_at?: string
          id?: string
          media_json?: Json
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          media_json?: Json
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_transitions: {
        Row: {
          actor_id: string | null
          actor_kind: string
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          metadata: Json
          reason: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_transitions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accept_deadline_at: string | null
          angler_id: string | null
          application_fee_cents: number | null
          assigned_guide_id: string | null
          balance_collected_at: string | null
          balance_due_cents: number
          boat_id: string | null
          business_id: string | null
          cancellation_policy: Json
          captain_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          dispute_window_ends_at: string | null
          escrow_state: string
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          instant_book: boolean
          notes: string | null
          party_size: number
          payout_cents: number
          payout_released_at: string | null
          refunded_cents: number
          service_id: string | null
          slot_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          template_id: string | null
          total_cents: number
          trip_date: string
          updated_at: string
        }
        Insert: {
          accept_deadline_at?: string | null
          angler_id?: string | null
          application_fee_cents?: number | null
          assigned_guide_id?: string | null
          balance_collected_at?: string | null
          balance_due_cents?: number
          boat_id?: string | null
          business_id?: string | null
          cancellation_policy?: Json
          captain_id: string
          commission_rate?: number | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deposit_cents?: number
          dispute_window_ends_at?: string | null
          escrow_state?: string
          hold_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          instant_book?: boolean
          notes?: string | null
          party_size?: number
          payout_cents?: number
          payout_released_at?: string | null
          refunded_cents?: number
          service_id?: string | null
          slot_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_fee_cents?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          template_id?: string | null
          total_cents?: number
          trip_date: string
          updated_at?: string
        }
        Update: {
          accept_deadline_at?: string | null
          angler_id?: string | null
          application_fee_cents?: number | null
          assigned_guide_id?: string | null
          balance_collected_at?: string | null
          balance_due_cents?: number
          boat_id?: string | null
          business_id?: string | null
          cancellation_policy?: Json
          captain_id?: string
          commission_rate?: number | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deposit_cents?: number
          dispute_window_ends_at?: string | null
          escrow_state?: string
          hold_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          instant_book?: boolean
          notes?: string | null
          party_size?: number
          payout_cents?: number
          payout_released_at?: string | null
          refunded_cents?: number
          service_id?: string | null
          slot_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_fee_cents?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          template_id?: string | null
          total_cents?: number
          trip_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "service_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "trip_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_blockouts: {
        Row: {
          business_id: string
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          reason: string | null
          service_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          reason?: string | null
          service_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          service_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_blockouts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_blockouts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_buddies: {
        Row: {
          angler_id: string
          business_id: string
          created_at: string
          id: string
          status: string
        }
        Insert: {
          angler_id: string
          business_id: string
          created_at?: string
          id?: string
          status?: string
        }
        Update: {
          angler_id?: string
          business_id?: string
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_buddies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      business_conversations: {
        Row: {
          angler_id: string
          business_id: string
          created_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          angler_id: string
          business_id: string
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          angler_id?: string
          business_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_followers: {
        Row: {
          business_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_followers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          media_json: Json
          read_at: string | null
          sender_id: string
          sender_side: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_json?: Json
          read_at?: string | null
          sender_id: string
          sender_side: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_json?: Json
          read_at?: string | null
          sender_id?: string
          sender_side?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "business_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_posts: {
        Row: {
          author_id: string
          body: string
          business_id: string
          created_at: string
          id: string
          linked_challenge_id: string | null
          media_json: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          business_id: string
          created_at?: string
          id?: string
          linked_challenge_id?: string | null
          media_json?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          linked_challenge_id?: string | null
          media_json?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_subscriptions: {
        Row: {
          business_id: string
          created_at: string
          current_period_end: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          amenities_json: Json
          category_key: string
          charges_enabled: boolean
          city: string | null
          commission_rate: number
          country: string | null
          created_at: string
          created_by: string
          deposit_rate: number
          description: string | null
          email: string | null
          fishx_business_id: string | null
          hero_url: string | null
          hours_json: Json
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          payout_delay_days: number
          payouts_enabled: boolean
          phone: string | null
          premium_until: string | null
          product_commission_rate: number
          region: string | null
          slug: string
          stripe_account_id: string | null
          stripe_account_type: string
          tagline: string | null
          updated_at: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          amenities_json?: Json
          category_key: string
          charges_enabled?: boolean
          city?: string | null
          commission_rate?: number
          country?: string | null
          created_at?: string
          created_by: string
          deposit_rate?: number
          description?: string | null
          email?: string | null
          fishx_business_id?: string | null
          hero_url?: string | null
          hours_json?: Json
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          payout_delay_days?: number
          payouts_enabled?: boolean
          phone?: string | null
          premium_until?: string | null
          product_commission_rate?: number
          region?: string | null
          slug: string
          stripe_account_id?: string | null
          stripe_account_type?: string
          tagline?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          amenities_json?: Json
          category_key?: string
          charges_enabled?: boolean
          city?: string | null
          commission_rate?: number
          country?: string | null
          created_at?: string
          created_by?: string
          deposit_rate?: number
          description?: string | null
          email?: string | null
          fishx_business_id?: string | null
          hero_url?: string | null
          hours_json?: Json
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          payout_delay_days?: number
          payouts_enabled?: boolean
          phone?: string | null
          premium_until?: string | null
          product_commission_rate?: number
          region?: string | null
          slug?: string
          stripe_account_id?: string | null
          stripe_account_type?: string
          tagline?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      charter_departure_times: {
        Row: {
          business_id: string | null
          charter_id: string
          created_at: string
          days_of_week: number[]
          id: string
          is_active: boolean
          label: string | null
          sort_order: number
          start_time: string
        }
        Insert: {
          business_id?: string | null
          charter_id: string
          created_at?: string
          days_of_week?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          start_time: string
        }
        Update: {
          business_id?: string | null
          charter_id?: string
          created_at?: string
          days_of_week?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_departure_times_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_departure_times_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "charters"
            referencedColumns: ["id"]
          },
        ]
      }
      charters: {
        Row: {
          base_price_cents: number
          boat_id: string | null
          business_id: string
          capacity: number
          commission_rate: number
          created_at: string
          departure_location: string | null
          deposit_rate: number
          description: string | null
          duration_minutes: number | null
          hero_url: string | null
          id: string
          image_urls: string[]
          is_published: boolean
          name: string
          slug: string | null
          target_species: string[]
          updated_at: string
          water_type: string | null
        }
        Insert: {
          base_price_cents?: number
          boat_id?: string | null
          business_id: string
          capacity?: number
          commission_rate?: number
          created_at?: string
          departure_location?: string | null
          deposit_rate?: number
          description?: string | null
          duration_minutes?: number | null
          hero_url?: string | null
          id?: string
          image_urls?: string[]
          is_published?: boolean
          name: string
          slug?: string | null
          target_species?: string[]
          updated_at?: string
          water_type?: string | null
        }
        Update: {
          base_price_cents?: number
          boat_id?: string | null
          business_id?: string
          capacity?: number
          commission_rate?: number
          created_at?: string
          departure_location?: string | null
          deposit_rate?: number
          description?: string | null
          duration_minutes?: number | null
          hero_url?: string | null
          id?: string
          image_urls?: string[]
          is_published?: boolean
          name?: string
          slug?: string | null
          target_species?: string[]
          updated_at?: string
          water_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charters_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          captain_id: string
          created_at: string
          email: string | null
          fishx_user_id: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          email?: string | null
          fishx_user_id?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          email?: string | null
          fishx_user_id?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          booking_id: string
          created_at: string
          description: string | null
          id: string
          kind: string
          metadata: Json
          opened_by: string | null
          opened_by_kind: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          stripe_dispute_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          metadata?: Json
          opened_by?: string | null
          opened_by_kind: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stripe_dispute_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          metadata?: Json
          opened_by?: string | null
          opened_by_kind?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stripe_dispute_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          dispatched_at: string | null
          id: string
          last_error: string | null
          payload: Json
          status: string
          topic: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          status?: string
          topic: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          status?: string
          topic?: string
        }
        Relationships: []
      }
      fishx_link: {
        Row: {
          fishx_user_id: string
          id: string
          linked_at: string
          scopes: string[]
          user_id: string
        }
        Insert: {
          fishx_user_id: string
          id?: string
          linked_at?: string
          scopes?: string[]
          user_id: string
        }
        Update: {
          fishx_user_id?: string
          id?: string
          linked_at?: string
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      fishx_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      guide_availability: {
        Row: {
          booked_count: number
          business_id: string
          capacity: number
          created_at: string
          end_time: string | null
          id: string
          notes: string | null
          price_cents: number | null
          service_id: string | null
          slot_date: string
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booked_count?: number
          business_id: string
          capacity?: number
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          price_cents?: number | null
          service_id?: string | null
          slot_date: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booked_count?: number
          business_id?: string
          capacity?: number
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          price_cents?: number | null
          service_id?: string | null
          slot_date?: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_availability_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          actor_id: string | null
          completed_at: string | null
          created_at: string
          key: string
          request_hash: string | null
          response: Json | null
          scope: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          key: string
          request_hash?: string | null
          response?: Json | null
          scope: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          key?: string
          request_hash?: string | null
          response?: Json | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          boat_id: string | null
          business_id: string
          created_at: string
          from_user_id: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          message: string
          party_size: number | null
          preferred_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          boat_id?: string | null
          business_id: string
          created_at?: string
          from_user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          message: string
          party_size?: number | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          boat_id?: string | null
          business_id?: string
          created_at?: string
          from_user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          message?: string
          party_size?: number | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_products: {
        Row: {
          business_id: string
          category: string | null
          compare_at_cents: number | null
          created_at: string
          description: string | null
          id: string
          images: Json
          is_published: boolean
          low_stock_threshold: number
          metadata: Json
          price_cents: number
          sku: string | null
          stock_qty: number
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          compare_at_cents?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_published?: boolean
          low_stock_threshold?: number
          metadata?: Json
          price_cents?: number
          sku?: string | null
          stock_qty?: number
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          compare_at_cents?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_published?: boolean
          low_stock_threshold?: number
          metadata?: Json
          price_cents?: number
          sku?: string | null
          stock_qty?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_impressions: {
        Row: {
          angler_id: string | null
          business_id: string | null
          created_at: string
          event_kind: string
          experiment_key: string | null
          feature_vector: Json
          id: string
          position: number | null
          query_json: Json
          service_id: string | null
          session_id: string | null
          user_agent: string | null
          variant: string | null
        }
        Insert: {
          angler_id?: string | null
          business_id?: string | null
          created_at?: string
          event_kind?: string
          experiment_key?: string | null
          feature_vector?: Json
          id?: string
          position?: number | null
          query_json?: Json
          service_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Update: {
          angler_id?: string | null
          business_id?: string | null
          created_at?: string
          event_kind?: string
          experiment_key?: string | null
          feature_vector?: Json
          id?: string
          position?: number | null
          query_json?: Json
          service_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_impressions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_metrics: {
        Row: {
          acceptance_rate: number | null
          avg_rating: number | null
          booking_velocity_30d: number
          bookings_30d: number
          business_id: string
          cancellation_rate: number | null
          computed_at: string
          impressions_30d: number
          last_availability_at: string | null
          no_show_rate: number | null
          response_rate: number | null
          response_time_ms: number | null
          review_count: number
          service_id: string
        }
        Insert: {
          acceptance_rate?: number | null
          avg_rating?: number | null
          booking_velocity_30d?: number
          bookings_30d?: number
          business_id: string
          cancellation_rate?: number | null
          computed_at?: string
          impressions_30d?: number
          last_availability_at?: string | null
          no_show_rate?: number | null
          response_rate?: number | null
          response_time_ms?: number | null
          review_count?: number
          service_id: string
        }
        Update: {
          acceptance_rate?: number | null
          avg_rating?: number | null
          booking_velocity_30d?: number
          bookings_30d?: number
          business_id?: string
          cancellation_rate?: number | null
          computed_at?: string
          impressions_30d?: number
          last_availability_at?: string | null
          no_show_rate?: number | null
          response_rate?: number | null
          response_time_ms?: number | null
          review_count?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_metrics_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      marina_reservations: {
        Row: {
          arrive_date: string
          business_id: string
          captain_name: string | null
          created_at: string
          depart_date: string
          id: string
          nightly_rate_cents: number | null
          notes: string | null
          slip_id: string | null
          status: string
          total_cents: number | null
          updated_at: string
          vessel_length_ft: number | null
          vessel_name: string
        }
        Insert: {
          arrive_date: string
          business_id: string
          captain_name?: string | null
          created_at?: string
          depart_date: string
          id?: string
          nightly_rate_cents?: number | null
          notes?: string | null
          slip_id?: string | null
          status?: string
          total_cents?: number | null
          updated_at?: string
          vessel_length_ft?: number | null
          vessel_name: string
        }
        Update: {
          arrive_date?: string
          business_id?: string
          captain_name?: string | null
          created_at?: string
          depart_date?: string
          id?: string
          nightly_rate_cents?: number | null
          notes?: string | null
          slip_id?: string | null
          status?: string
          total_cents?: number | null
          updated_at?: string
          vessel_length_ft?: number | null
          vessel_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "marina_reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marina_reservations_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "marina_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      marina_service_requests: {
        Row: {
          business_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          note: string | null
          requested_date: string | null
          requester_id: string | null
          service_key: string
          slip_id: string | null
          staff_note: string | null
          status: string
          updated_at: string
          vessel_name: string | null
        }
        Insert: {
          business_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          note?: string | null
          requested_date?: string | null
          requester_id?: string | null
          service_key: string
          slip_id?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
          vessel_name?: string | null
        }
        Update: {
          business_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          note?: string | null
          requested_date?: string | null
          requester_id?: string | null
          service_key?: string
          slip_id?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marina_service_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marina_service_requests_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "marina_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      marina_slips: {
        Row: {
          amperage: string | null
          beam_ft: number | null
          business_id: string
          created_at: string
          draft_ft: number | null
          id: string
          is_bookable: boolean
          length_ft: number | null
          monthly_rate_cents: number | null
          nightly_rate_cents: number | null
          notes: string | null
          service_id: string | null
          slip_number: string
          status: string
          updated_at: string
        }
        Insert: {
          amperage?: string | null
          beam_ft?: number | null
          business_id: string
          created_at?: string
          draft_ft?: number | null
          id?: string
          is_bookable?: boolean
          length_ft?: number | null
          monthly_rate_cents?: number | null
          nightly_rate_cents?: number | null
          notes?: string | null
          service_id?: string | null
          slip_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          amperage?: string | null
          beam_ft?: number | null
          business_id?: string
          created_at?: string
          draft_ft?: number | null
          id?: string
          is_bookable?: boolean
          length_ft?: number | null
          monthly_rate_cents?: number | null
          nightly_rate_cents?: number | null
          notes?: string | null
          service_id?: string | null
          slip_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marina_slips_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marina_slips_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          dedupe_key: string
          error: string | null
          event_id: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          dedupe_key: string
          error?: string | null
          event_id?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          dedupe_key?: string
          error?: string | null
          event_id?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          categories: Json
          created_at: string
          email_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          email_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          created_at?: string
          email_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          meta: Json
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          booking_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_reconciliations: {
        Row: {
          actual_cents: number
          booking_id: string | null
          business_id: string | null
          created_at: string
          delta_cents: number
          detail: string | null
          expected_cents: number
          id: string
          order_id: string | null
          payout_id: string | null
          run_date: string
          scope: string
          status: string
        }
        Insert: {
          actual_cents?: number
          booking_id?: string | null
          business_id?: string | null
          created_at?: string
          delta_cents?: number
          detail?: string | null
          expected_cents?: number
          id?: string
          order_id?: string | null
          payout_id?: string | null
          run_date?: string
          scope: string
          status: string
        }
        Update: {
          actual_cents?: number
          booking_id?: string | null
          business_id?: string | null
          created_at?: string
          delta_cents?: number
          detail?: string | null
          expected_cents?: number
          id?: string
          order_id?: string | null
          payout_id?: string | null
          run_date?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_reconciliations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reconciliations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reconciliations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reconciliations_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          arrival_date: string | null
          booking_id: string | null
          business_id: string
          created_at: string
          currency: string
          failure_message: string | null
          id: string
          paid_at: string | null
          status: string
          stripe_payout_id: string | null
        }
        Insert: {
          amount_cents: number
          arrival_date?: string | null
          booking_id?: string | null
          business_id: string
          created_at?: string
          currency?: string
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_payout_id?: string | null
        }
        Update: {
          amount_cents?: number
          arrival_date?: string | null
          booking_id?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_payout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "business_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "business_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          title: string
          unit_price_cents: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_orders: {
        Row: {
          application_fee_cents: number | null
          business_id: string
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payout_cents: number | null
          payout_due_at: string | null
          payout_released_at: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_transfer_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          application_fee_cents?: number | null
          business_id: string
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payout_cents?: number | null
          payout_due_at?: string | null
          payout_released_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          application_fee_cents?: number | null
          business_id?: string
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payout_cents?: number | null
          payout_due_at?: string | null
          payout_released_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          min_qty: number
          product_id: string
          unit_price_cents: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          min_qty: number
          product_id: string
          unit_price_cents: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          min_qty?: number
          product_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          option_name: string
          option_value: string
          price_delta_cents: number
          product_id: string
          sku: string | null
          sort_order: number
          stock_qty: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_name?: string
          option_value: string
          price_delta_cents?: number
          product_id: string
          sku?: string | null
          sort_order?: number
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_name?: string
          option_value?: string
          price_delta_cents?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_wholesale_settings: {
        Row: {
          business_id: string
          case_pack: number
          created_at: string
          min_order_qty: number
          product_id: string
          updated_at: string
          wholesale_only: boolean
          wholesale_price_cents: number | null
        }
        Insert: {
          business_id: string
          case_pack?: number
          created_at?: string
          min_order_qty?: number
          product_id: string
          updated_at?: string
          wholesale_only?: boolean
          wholesale_price_cents?: number | null
        }
        Update: {
          business_id?: string
          case_pack?: number
          created_at?: string
          min_order_qty?: number
          product_id?: string
          updated_at?: string
          wholesale_only?: boolean
          wholesale_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_wholesale_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_wholesale_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          created_by: string | null
          failure_message: string | null
          id: string
          policy_applied: string | null
          reason: string | null
          reverse_transfer: boolean
          status: string
          stripe_refund_id: string | null
          succeeded_at: string | null
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          failure_message?: string | null
          id?: string
          policy_applied?: string | null
          reason?: string | null
          reverse_transfer?: boolean
          status?: string
          stripe_refund_id?: string | null
          succeeded_at?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          failure_message?: string | null
          id?: string
          policy_applied?: string | null
          reason?: string | null
          reverse_transfer?: boolean
          status?: string
          stripe_refund_id?: string | null
          succeeded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          angler_id: string
          body: string | null
          booking_id: string
          business_id: string
          created_at: string
          id: string
          rating: number
          response_body: string | null
          updated_at: string
        }
        Insert: {
          angler_id: string
          body?: string | null
          booking_id: string
          business_id: string
          created_at?: string
          id?: string
          rating: number
          response_body?: string | null
          updated_at?: string
        }
        Update: {
          angler_id?: string
          body?: string | null
          booking_id?: string
          business_id?: string
          created_at?: string
          id?: string
          rating?: number
          response_body?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          business_id: string
          capacity_per_slot: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lead_time_hours: number
          max_per_booking: number | null
          price_cents: number
          service_id: string
          sort_order: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          business_id: string
          capacity_per_slot?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lead_time_hours?: number
          max_per_booking?: number | null
          price_cents?: number
          service_id: string
          sort_order?: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          capacity_per_slot?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lead_time_hours?: number
          max_per_booking?: number | null
          price_cents?: number
          service_id?: string
          sort_order?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_availability: {
        Row: {
          booked_booking_id: string | null
          created_at: string
          ends_at: string
          id: string
          is_blackout: boolean
          notes: string | null
          price_cents: number | null
          seats_available: number
          seats_booked: number
          service_id: string
          source: string
          starts_at: string
        }
        Insert: {
          booked_booking_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          is_blackout?: boolean
          notes?: string | null
          price_cents?: number | null
          seats_available?: number
          seats_booked?: number
          service_id: string
          source?: string
          starts_at: string
        }
        Update: {
          booked_booking_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          is_blackout?: boolean
          notes?: string | null
          price_cents?: number | null
          seats_available?: number
          seats_booked?: number
          service_id?: string
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_availability_booked_booking_id_fkey"
            columns: ["booked_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_departure_times: {
        Row: {
          business_id: string | null
          created_at: string
          days_of_week: number[]
          id: string
          is_active: boolean
          label: string | null
          service_id: string
          sort_order: number
          start_time: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          service_id: string
          sort_order?: number
          start_time: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          service_id?: string
          sort_order?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_departure_times_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_departure_times_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "bookable_services"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_challenges: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          ends_at: string
          fishx_challenge_id: string | null
          id: string
          prize_value_cents: number
          region_json: Json | null
          signed_at: string | null
          species: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          ends_at: string
          fishx_challenge_id?: string | null
          id?: string
          prize_value_cents?: number
          region_json?: Json | null
          signed_at?: string | null
          species?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          fishx_challenge_id?: string | null
          id?: string
          prize_value_cents?: number
          region_json?: Json | null
          signed_at?: string | null
          species?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_challenges_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_accounts: {
        Row: {
          business_id: string
          buyer_id: string
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          status: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          buyer_id: string
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          buyer_id?: string
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_templates: {
        Row: {
          base_price_cents: number
          boat_id: string | null
          captain_id: string
          created_at: string
          departure_location: string | null
          description: string | null
          duration_hours: number
          hero_image_url: string | null
          id: string
          includes: string[]
          is_published: boolean
          max_anglers: number
          slug: string | null
          target_species: string[]
          title: string
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          boat_id?: string | null
          captain_id: string
          created_at?: string
          departure_location?: string | null
          description?: string | null
          duration_hours?: number
          hero_image_url?: string | null
          id?: string
          includes?: string[]
          is_published?: boolean
          max_anglers?: number
          slug?: string | null
          target_species?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          boat_id?: string | null
          captain_id?: string
          created_at?: string
          departure_location?: string | null
          description?: string | null
          duration_hours?: number
          hero_image_url?: string | null
          id?: string
          includes?: string[]
          is_published?: boolean
          max_anglers?: number
          slug?: string | null
          target_species?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_templates_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_shipping_settings: {
        Row: {
          business_id: string
          created_at: string
          flat_rate_cents: number
          free_over_cents: number | null
          per_item_cents: number
          policy_note: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          flat_rate_cents?: number
          free_over_cents?: number | null
          per_item_cents?: number
          policy_note?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          flat_rate_cents?: number
          free_over_cents?: number | null
          per_item_cents?: number
          policy_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_shipping_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          business_id: string
          created_at: string
          decided_at: string | null
          doc_urls: string[]
          id: string
          notes: string | null
          reviewer_id: string | null
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          decided_at?: string | null
          doc_urls?: string[]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          decided_at?: string | null
          doc_urls?: string[]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      addon_block_reason: {
        Args: { _addon_id: string; _quantity: number; _slot_id: string }
        Returns: string
      }
      addon_remaining_for_slot: {
        Args: { _addon_id: string; _slot_id: string }
        Returns: number
      }
      advance_trip_lifecycle: {
        Args: { _grace_hours?: number; _limit?: number }
        Returns: Json
      }
      apply_blockout_slots: {
        Args: {
          _block: boolean
          _business_id: string
          _end_date: string
          _start_date: string
        }
        Returns: undefined
      }
      auto_decline_expired_requests: {
        Args: { _limit?: number }
        Returns: number
      }
      booking_status_releases_seats: {
        Args: { _s: Database["public"]["Enums"]["booking_status"] }
        Returns: boolean
      }
      create_business_with_owner: {
        Args: {
          _category_key: string
          _city?: string
          _description?: string
          _name: string
          _phone?: string
          _slug: string
        }
        Returns: {
          address: string | null
          amenities_json: Json
          category_key: string
          charges_enabled: boolean
          city: string | null
          commission_rate: number
          country: string | null
          created_at: string
          created_by: string
          deposit_rate: number
          description: string | null
          email: string | null
          fishx_business_id: string | null
          hero_url: string | null
          hours_json: Json
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          payout_delay_days: number
          payouts_enabled: boolean
          phone: string | null
          premium_until: string | null
          product_commission_rate: number
          region: string | null
          slug: string
          stripe_account_id: string | null
          stripe_account_type: string
          tagline: string | null
          updated_at: string
          verified_at: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      emit_domain_event: {
        Args: {
          _aggregate_id: string
          _aggregate_type: string
          _available_at?: string
          _payload?: Json
          _topic: string
        }
        Returns: string
      }
      expire_stale_holds: { Args: { _limit?: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_allowed_booking_transition: {
        Args: {
          _from: Database["public"]["Enums"]["booking_status"]
          _to: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      is_business_member: {
        Args: {
          _business_id: string
          _min_role?: Database["public"]["Enums"]["business_member_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_listing_event: {
        Args: {
          _event_kind: string
          _features?: Json
          _position?: number
          _query?: Json
          _service_id: string
          _session_id?: string
        }
        Returns: undefined
      }
      mark_product_order_delivered: {
        Args: { _order_id: string }
        Returns: undefined
      }
      public_service_slots: {
        Args: { _service_id: string }
        Returns: {
          ends_at: string
          id: string
          price_cents: number
          seats_available: number
          seats_booked: number
          starts_at: string
        }[]
      }
      rank_listings: {
        Args: { _city?: string; _kinds?: string[]; _limit?: number }
        Returns: {
          business_id: string
          features: Json
          score: number
          service_id: string
        }[]
      }
      recompute_listing_metrics: { Args: never; Returns: number }
      reconcile_payouts: { Args: { _run_date?: string }; Returns: Json }
      release_delivered_product_payouts: {
        Args: { _limit?: number }
        Returns: number
      }
      release_due_booking_payouts: {
        Args: { _limit?: number }
        Returns: number
      }
      reschedule_booking: {
        Args: { _booking_id: string; _reason?: string; _slot_id: string }
        Returns: {
          accept_deadline_at: string | null
          angler_id: string | null
          application_fee_cents: number | null
          assigned_guide_id: string | null
          balance_collected_at: string | null
          balance_due_cents: number
          boat_id: string | null
          business_id: string | null
          cancellation_policy: Json
          captain_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          dispute_window_ends_at: string | null
          escrow_state: string
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          instant_book: boolean
          notes: string | null
          party_size: number
          payout_cents: number
          payout_released_at: string | null
          refunded_cents: number
          service_id: string | null
          slot_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          template_id: string | null
          total_cents: number
          trip_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_booking_addons: {
        Args: { _booking_id: string; _lines: Json }
        Returns: undefined
      }
      reserve_slip_stay: {
        Args: {
          _end: string
          _hold_minutes?: number
          _idempotency_key?: string
          _service_id: string
          _start: string
        }
        Returns: {
          accept_deadline_at: string | null
          angler_id: string | null
          application_fee_cents: number | null
          assigned_guide_id: string | null
          balance_collected_at: string | null
          balance_due_cents: number
          boat_id: string | null
          business_id: string | null
          cancellation_policy: Json
          captain_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          dispute_window_ends_at: string | null
          escrow_state: string
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          instant_book: boolean
          notes: string | null
          party_size: number
          payout_cents: number
          payout_released_at: string | null
          refunded_cents: number
          service_id: string | null
          slot_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          template_id: string | null
          total_cents: number
          trip_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_slot: {
        Args: {
          _addon_cents?: number
          _hold_minutes?: number
          _idempotency_key?: string
          _notes?: string
          _party_size: number
          _slot_id: string
        }
        Returns: {
          accept_deadline_at: string | null
          angler_id: string | null
          application_fee_cents: number | null
          assigned_guide_id: string | null
          balance_collected_at: string | null
          balance_due_cents: number
          boat_id: string | null
          business_id: string | null
          cancellation_policy: Json
          captain_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          dispute_window_ends_at: string | null
          escrow_state: string
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          instant_book: boolean
          notes: string | null
          party_size: number
          payout_cents: number
          payout_released_at: string | null
          refunded_cents: number
          service_id: string | null
          slot_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          template_id: string | null
          total_cents: number
          trip_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_cron_secret: { Args: { _value: string }; Returns: undefined }
      transition_booking: {
        Args: {
          _booking_id: string
          _metadata?: Json
          _reason?: string
          _to_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: {
          accept_deadline_at: string | null
          angler_id: string | null
          application_fee_cents: number | null
          assigned_guide_id: string | null
          balance_collected_at: string | null
          balance_due_cents: number
          boat_id: string | null
          business_id: string | null
          cancellation_policy: Json
          captain_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          dispute_window_ends_at: string | null
          escrow_state: string
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          instant_book: boolean
          notes: string | null
          party_size: number
          payout_cents: number
          payout_released_at: string | null
          refunded_cents: number
          service_id: string | null
          slot_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          template_id: string | null
          total_cents: number
          trip_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      trip_block_conflict: {
        Args: {
          _ends: string
          _exclude_slot?: string
          _service_id: string
          _starts: string
        }
        Returns: string
      }
      withdraw_dispute: { Args: { _dispute_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "captain"
        | "admin"
        | "angler"
        | "business_owner"
        | "business_staff"
        | "marina"
        | "tackle_shop"
        | "bait_shop"
        | "gear_mfg"
        | "apparel"
        | "guide_service"
        | "lodge"
      booking_status:
        | "inquiry"
        | "pending_payment"
        | "pending_confirmation"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "reviewed"
        | "declined"
        | "expired"
        | "cancelled_angler"
        | "cancelled_captain"
        | "no_show"
        | "disputed"
        | "refunded"
        | "weather_cancelled"
      business_member_role: "owner" | "manager" | "staff"
      service_kind:
        | "charter_trip"
        | "guided_trip"
        | "slip_rental"
        | "lodging"
        | "workshop"
        | "rental"
        | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "captain",
        "admin",
        "angler",
        "business_owner",
        "business_staff",
        "marina",
        "tackle_shop",
        "bait_shop",
        "gear_mfg",
        "apparel",
        "guide_service",
        "lodge",
      ],
      booking_status: [
        "inquiry",
        "pending_payment",
        "pending_confirmation",
        "confirmed",
        "in_progress",
        "completed",
        "reviewed",
        "declined",
        "expired",
        "cancelled_angler",
        "cancelled_captain",
        "no_show",
        "disputed",
        "refunded",
        "weather_cancelled",
      ],
      business_member_role: ["owner", "manager", "staff"],
      service_kind: [
        "charter_trip",
        "guided_trip",
        "slip_rental",
        "lodging",
        "workshop",
        "rental",
        "other",
      ],
    },
  },
} as const
