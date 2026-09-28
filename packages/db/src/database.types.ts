// このファイルは自動生成です。直接編集しないでください（packages/db/README.md）。
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          payload: Json;
          target_id: string | null;
          target_table: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          payload?: Json;
          target_id?: string | null;
          target_table?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: number;
          payload?: Json;
          target_id?: string | null;
          target_table?: string | null;
        };
        Relationships: [
          { foreignKeyName: "audit_logs_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      availability_rules: {
        Row: {
          close_time: string;
          created_at: string;
          id: string;
          open_time: string;
          space_id: string;
          weekday: number;
        };
        Insert: {
          close_time: string;
          created_at?: string;
          id?: string;
          open_time: string;
          space_id: string;
          weekday: number;
        };
        Update: {
          close_time?: string;
          created_at?: string;
          id?: string;
          open_time?: string;
          space_id?: string;
          weekday?: number;
        };
        Relationships: [
          { foreignKeyName: "availability_rules_space_id_fkey"; columns: ["space_id"]; isOneToOne: false; referencedRelation: "spaces"; referencedColumns: ["id"] },
        ];
      };
      booking_fees: {
        Row: {
          application_fee: number;
          booking_id: string;
          created_at: string;
          hours: number;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          stripe_fee_estimated: number;
        };
        Insert: {
          application_fee: number;
          booking_id: string;
          created_at?: string;
          hours: number;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          stripe_fee_estimated: number;
        };
        Update: {
          application_fee?: number;
          booking_id?: string;
          created_at?: string;
          hours?: number;
          platform_fee_excl_tax?: number;
          platform_fee_tax?: number;
          stripe_fee_estimated?: number;
        };
        Relationships: [
          { foreignKeyName: "booking_fees_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: true; referencedRelation: "bookings"; referencedColumns: ["id"] },
        ];
      };
      bookings: {
        Row: {
          cancel_policy: Database["public"]["Enums"]["cancel_policy"] | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancel_actor"] | null;
          created_at: string;
          guest_id: string;
          host_id: string;
          id: string;
          no_show_recorded_at: string | null;
          order_id: string;
          period: string;
          price_per_30min: number;
          reminder_2h_sent_at: string | null;
          reminder_day_before_sent_at: string | null;
          slots: number;
          space_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          total: number;
          updated_at: string;
        };
        Insert: {
          cancel_policy?: Database["public"]["Enums"]["cancel_policy"] | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: Database["public"]["Enums"]["cancel_actor"] | null;
          created_at?: string;
          guest_id: string;
          host_id: string;
          id?: string;
          no_show_recorded_at?: string | null;
          order_id: string;
          period: string;
          price_per_30min: number;
          reminder_2h_sent_at?: string | null;
          reminder_day_before_sent_at?: string | null;
          slots: number;
          space_id: string;
          status?: Database["public"]["Enums"]["booking_status"];
          total: number;
          updated_at?: string;
        };
        Update: {
          cancel_policy?: Database["public"]["Enums"]["cancel_policy"] | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: Database["public"]["Enums"]["cancel_actor"] | null;
          created_at?: string;
          guest_id?: string;
          host_id?: string;
          id?: string;
          no_show_recorded_at?: string | null;
          order_id?: string;
          period?: string;
          price_per_30min?: number;
          reminder_2h_sent_at?: string | null;
          reminder_day_before_sent_at?: string | null;
          slots?: number;
          space_id?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "bookings_order_id_guest_id_host_id_fkey"; columns: ["order_id","guest_id","host_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id","guest_id","host_id"] },
          { foreignKeyName: "bookings_space_id_host_id_fkey"; columns: ["space_id","host_id"]; isOneToOne: false; referencedRelation: "spaces"; referencedColumns: ["id","host_id"] },
        ];
      };
      cancel_events: {
        Row: {
          booking_id: string;
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "cancel_events_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: true; referencedRelation: "bookings"; referencedColumns: ["id"] },
          { foreignKeyName: "cancel_events_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          period: string;
          space_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          period: string;
          space_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          period?: string;
          space_id?: string;
        };
        Relationships: [
          { foreignKeyName: "cart_items_cart_id_fkey"; columns: ["cart_id"]; isOneToOne: false; referencedRelation: "carts"; referencedColumns: ["id"] },
          { foreignKeyName: "cart_items_space_id_fkey"; columns: ["space_id"]; isOneToOne: false; referencedRelation: "spaces"; referencedColumns: ["id"] },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          guest_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          guest_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          guest_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "carts_guest_id_fkey"; columns: ["guest_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      closures: {
        Row: {
          created_at: string;
          date: string;
          space_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          space_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          space_id?: string;
        };
        Relationships: [
          { foreignKeyName: "closures_space_id_fkey"; columns: ["space_id"]; isOneToOne: false; referencedRelation: "spaces"; referencedColumns: ["id"] },
        ];
      };
      contact_messages: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          email: string;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          body: string;
          category: string;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "contact_messages_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      host_applications: {
        Row: {
          address: string;
          company_name: string;
          contact_name: string;
          created_at: string;
          email: string;
          host_id: string | null;
          id: string;
          note: string | null;
          phone: string;
          reject_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["review_status"];
          updated_at: string;
        };
        Insert: {
          address: string;
          company_name: string;
          contact_name: string;
          created_at?: string;
          email: string;
          host_id?: string | null;
          id?: string;
          note?: string | null;
          phone: string;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Update: {
          address?: string;
          company_name?: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          host_id?: string | null;
          id?: string;
          note?: string | null;
          phone?: string;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "host_applications_host_fk"; columns: ["host_id"]; isOneToOne: false; referencedRelation: "hosts"; referencedColumns: ["id"] },
          { foreignKeyName: "host_applications_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      host_members: {
        Row: {
          created_at: string;
          host_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          host_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          host_id?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "host_members_host_id_fkey"; columns: ["host_id"]; isOneToOne: false; referencedRelation: "hosts"; referencedColumns: ["id"] },
          { foreignKeyName: "host_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      hosts: {
        Row: {
          address: string | null;
          application_id: string | null;
          charges_enabled: boolean;
          company_name: string;
          created_at: string;
          deleted_at: string | null;
          details_submitted: boolean;
          id: string;
          invoice_registration_number: string | null;
          payouts_enabled: boolean;
          phone: string | null;
          status: Database["public"]["Enums"]["host_status"];
          stripe_account_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          application_id?: string | null;
          charges_enabled?: boolean;
          company_name: string;
          created_at?: string;
          deleted_at?: string | null;
          details_submitted?: boolean;
          id?: string;
          invoice_registration_number?: string | null;
          payouts_enabled?: boolean;
          phone?: string | null;
          status?: Database["public"]["Enums"]["host_status"];
          stripe_account_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          application_id?: string | null;
          charges_enabled?: boolean;
          company_name?: string;
          created_at?: string;
          deleted_at?: string | null;
          details_submitted?: boolean;
          id?: string;
          invoice_registration_number?: string | null;
          payouts_enabled?: boolean;
          phone?: string | null;
          status?: Database["public"]["Enums"]["host_status"];
          stripe_account_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "hosts_application_id_fkey"; columns: ["application_id"]; isOneToOne: false; referencedRelation: "host_applications"; referencedColumns: ["id"] },
        ];
      };
      identity_documents: {
        Row: {
          back_path: string | null;
          back_side_requested: boolean;
          created_at: string;
          deleted_at: string | null;
          document_type: Database["public"]["Enums"]["identity_document_type"];
          front_path: string;
          id: string;
          purged_at: string | null;
          reject_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["review_status"];
          submitted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          back_path?: string | null;
          back_side_requested?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          document_type: Database["public"]["Enums"]["identity_document_type"];
          front_path: string;
          id?: string;
          purged_at?: string | null;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          back_path?: string | null;
          back_side_requested?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          document_type?: Database["public"]["Enums"]["identity_document_type"];
          front_path?: string;
          id?: string;
          purged_at?: string | null;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "identity_documents_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "identity_documents_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      monthly_statements: {
        Row: {
          created_at: string;
          document_number: string | null;
          gross: number;
          host_id: string;
          id: string;
          issued_at: string | null;
          month: string;
          net: number;
          pdf_path: string | null;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          stripe_fee: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          document_number?: string | null;
          gross: number;
          host_id: string;
          id?: string;
          issued_at?: string | null;
          month: string;
          net: number;
          pdf_path?: string | null;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          stripe_fee: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document_number?: string | null;
          gross?: number;
          host_id?: string;
          id?: string;
          issued_at?: string | null;
          month?: string;
          net?: number;
          pdf_path?: string | null;
          platform_fee_excl_tax?: number;
          platform_fee_tax?: number;
          stripe_fee?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "monthly_statements_host_id_fkey"; columns: ["host_id"]; isOneToOne: false; referencedRelation: "hosts"; referencedColumns: ["id"] },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          payload: Json;
          provider_message_id: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          subject: string;
          template: string;
          to_email: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject: string;
          template: string;
          to_email: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject?: string;
          template?: string;
          to_email?: string;
          user_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      orders: {
        Row: {
          application_fee_amount: number;
          created_at: string;
          expires_at: string;
          guest_id: string;
          host_id: string;
          host_stripe_account_id: string | null;
          id: string;
          late_payment_refund_id: string | null;
          late_payment_refunded_at: string | null;
          order_number: string;
          paid_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          stripe_charge_id: string | null;
          stripe_fee_actual: number | null;
          stripe_payment_intent_id: string | null;
          stripe_transfer_id: string | null;
          total: number;
          updated_at: string;
        };
        Insert: {
          application_fee_amount: number;
          created_at?: string;
          expires_at: string;
          guest_id: string;
          host_id: string;
          host_stripe_account_id?: string | null;
          id?: string;
          late_payment_refund_id?: string | null;
          late_payment_refunded_at?: string | null;
          order_number?: string;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          stripe_charge_id?: string | null;
          stripe_fee_actual?: number | null;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          total: number;
          updated_at?: string;
        };
        Update: {
          application_fee_amount?: number;
          created_at?: string;
          expires_at?: string;
          guest_id?: string;
          host_id?: string;
          host_stripe_account_id?: string | null;
          id?: string;
          late_payment_refund_id?: string | null;
          late_payment_refunded_at?: string | null;
          order_number?: string;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          stripe_charge_id?: string | null;
          stripe_fee_actual?: number | null;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "orders_guest_id_fkey"; columns: ["guest_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_host_id_fkey"; columns: ["host_id"]; isOneToOne: false; referencedRelation: "hosts"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          email: string;
          id: string;
          identity_status: Database["public"]["Enums"]["identity_status"];
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
          withdrawn_at: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email: string;
          id: string;
          identity_status?: Database["public"]["Enums"]["identity_status"];
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string;
          id?: string;
          identity_status?: Database["public"]["Enums"]["identity_status"];
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          attempts: number;
          booking_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          failure_reason: string | null;
          id: string;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          policy: Database["public"]["Enums"]["cancel_policy"];
          refund_amount: number;
          reversal_attempted_at: string | null;
          status: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id: string | null;
          stripe_transfer_reversal_id: string | null;
          transfer_reversal_amount: number;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          booking_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          failure_reason?: string | null;
          id?: string;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          policy: Database["public"]["Enums"]["cancel_policy"];
          refund_amount: number;
          reversal_attempted_at?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id?: string | null;
          stripe_transfer_reversal_id?: string | null;
          transfer_reversal_amount: number;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          booking_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          failure_reason?: string | null;
          id?: string;
          platform_fee_excl_tax?: number;
          platform_fee_tax?: number;
          policy?: Database["public"]["Enums"]["cancel_policy"];
          refund_amount?: number;
          reversal_attempted_at?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id?: string | null;
          stripe_transfer_reversal_id?: string | null;
          transfer_reversal_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "refunds_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: true; referencedRelation: "bookings"; referencedColumns: ["id"] },
          { foreignKeyName: "refunds_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      space_photos: {
        Row: {
          created_at: string;
          id: string;
          sort_order: number;
          space_id: string;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          space_id: string;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          space_id?: string;
          storage_path?: string;
        };
        Relationships: [
          { foreignKeyName: "space_photos_space_id_fkey"; columns: ["space_id"]; isOneToOne: false; referencedRelation: "spaces"; referencedColumns: ["id"] },
        ];
      };
      spaces: {
        Row: {
          address: string;
          amenities: string[];
          area: string;
          capacity: number;
          created_at: string;
          deleted_at: string | null;
          description: string;
          host_id: string;
          id: string;
          min_slots: number;
          name: string;
          price_per_30min: number;
          status: Database["public"]["Enums"]["space_status"];
          updated_at: string;
        };
        Insert: {
          address: string;
          amenities?: string[];
          area: string;
          capacity: number;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          host_id: string;
          id?: string;
          min_slots?: number;
          name: string;
          price_per_30min: number;
          status?: Database["public"]["Enums"]["space_status"];
          updated_at?: string;
        };
        Update: {
          address?: string;
          amenities?: string[];
          area?: string;
          capacity?: number;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          host_id?: string;
          id?: string;
          min_slots?: number;
          name?: string;
          price_per_30min?: number;
          status?: Database["public"]["Enums"]["space_status"];
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "spaces_host_id_fkey"; columns: ["host_id"]; isOneToOne: false; referencedRelation: "hosts"; referencedColumns: ["id"] },
        ];
      };
      stripe_events: {
        Row: {
          attempts: number;
          error: string | null;
          event_id: string;
          locked_until: string | null;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          type: string;
        };
        Insert: {
          attempts?: number;
          error?: string | null;
          event_id: string;
          locked_until?: string | null;
          payload: Json;
          processed_at?: string | null;
          received_at?: string;
          type: string;
        };
        Update: {
          attempts?: number;
          error?: string | null;
          event_id?: string;
          locked_until?: string | null;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_hosts: {
        Row: {
          company_name: string | null;
          id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_host_member: { Args: { p_host_id: string; p_inviter_id: string; p_user_id: string }; Returns: undefined };
      admin_cancel_monitor: { Args: { p_min_30d?: number; p_limit?: number }; Returns: { user_id: string; display_name: string; email: string; status: Database["public"]["Enums"]["account_status"]; cancels_24h: number; cancels_30d: number; last_cancel_at: string }[] };
      admin_host_month_summaries: { Args: { p_month: string }; Returns: { host_id: string; company_name: string; gross: number; platform_fee_excl_tax: number; platform_fee_tax: number; stripe_fee: number; net: number; stripe_fee_actual: number; stripe_fee_difference: number; statement_issued_at: string }[] };
      admin_month_summary: { Args: { p_month: string }; Returns: { booking_count: number; gross: number; platform_fee_excl_tax: number; platform_fee_tax: number; full_refund_stripe_fee: number; stripe_fee_estimated: number; stripe_fee_actual: number; stripe_fee_difference: number; net_income: number }[] };
      admin_record_action: { Args: { p_action: string; p_target_table: string; p_target_id: string; p_payload?: Json }; Returns: number };
      admin_set_host_status: { Args: { p_host_id: string; p_status: Database["public"]["Enums"]["host_status"]; p_reason: string }; Returns: number };
      admin_set_profile_status: { Args: { p_user_id: string; p_status: Database["public"]["Enums"]["account_status"]; p_reason: string }; Returns: undefined };
      admin_set_space_suspended: { Args: { p_space_id: string; p_suspended: boolean; p_reason: string }; Returns: undefined };
      approve_host_application: { Args: { p_application_id: string; p_user_id: string }; Returns: string };
      cancel_booking: { Args: { p_booking_id: string; p_actor: Database["public"]["Enums"]["cancel_actor"]; p_actor_id: string; p_reason?: string }; Returns: { refund_id: string; policy: Database["public"]["Enums"]["cancel_policy"]; refund_amount: number; transfer_reversal_amount: number; nth_cancel_in_window: number; stripe_charge_id: string; stripe_transfer_id: string }[] };
      claim_day_before_reminders: { Args: { p_date: string; p_limit?: number }; Returns: { booking_id: string }[] };
      claim_stripe_event: { Args: { p_event_id: string; p_type: string; p_payload: Json }; Returns: boolean };
      claim_two_hour_reminders: { Args: { p_limit?: number }; Returns: { booking_id: string }[] };
      close_pending_order: { Args: { p_order_id: string; p_status: Database["public"]["Enums"]["order_status"] }; Returns: string };
      complete_finished_bookings: { Args: never; Returns: number };
      complete_stripe_event: { Args: { p_event_id: string; p_error?: string }; Returns: undefined };
      consume_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: { allowed: boolean; hits: number; retry_after_seconds: number }[] };
      create_order_from_cart: { Args: { p_guest_id: string }; Returns: { order_id: string; order_number: string; total: number; application_fee_amount: number; host_stripe_account_id: string }[] };
      expire_due_orders: { Args: { p_limit?: number }; Returns: { order_id: string; payment_intent_id: string }[] };
      host_bookings: { Args: { p_from?: string; p_to?: string; p_space_id?: string; p_status?: Database["public"]["Enums"]["booking_status"]; p_limit?: number; p_booking_id?: string }; Returns: { booking_id: string; order_id: string; order_number: string; space_id: string; space_name: string; period_start: string; period_end: string; slots: number; total: number; status: Database["public"]["Enums"]["booking_status"]; cancelled_by: Database["public"]["Enums"]["cancel_actor"]; cancel_reason: string; guest_name: string; application_fee: number; refund_amount: number; transfer_reversal_amount: number }[] };
      host_member_list: { Args: never; Returns: { user_id: string; display_name: string; email: string; created_at: string }[] };
      host_statement_lines: { Args: { p_host_id: string; p_month: string }; Returns: { occurred_at: string; kind: string; booking_id: string; order_number: string; space_name: string; gross: number; platform_fee_excl_tax: number; platform_fee_tax: number; stripe_fee: number; net: number }[] };
      host_statement_summary: { Args: { p_host_id: string; p_month: string }; Returns: { gross: number; platform_fee_excl_tax: number; platform_fee_tax: number; stripe_fee: number; net: number }[] };
      identity_documents_due_for_purge: { Args: { p_retention_days: number; p_limit?: number }; Returns: { document_id: string; front_path: string; back_path: string }[] };
      issue_monthly_statement: { Args: { p_host_id: string; p_month: string; p_pdf_path: string; p_document_number: string }; Returns: string };
      mark_identity_documents_purged: { Args: { p_document_ids: string[] }; Returns: undefined };
      mark_order_paid: { Args: { p_order_id: string; p_payment_intent_id: string; p_amount: number; p_charge_id: string; p_transfer_id: string }; Returns: string };
      mark_refund_succeeded: { Args: { p_refund_id: string; p_stripe_refund_id: string }; Returns: boolean };
      min_price_per_30min: { Args: { p_min_slots: number }; Returns: number };
      orphan_identity_files: { Args: { p_older_than?: unknown; p_limit?: number }; Returns: { name: string }[] };
      purge_rate_limit_counters: { Args: never; Returns: number };
      recent_guest_cancel_count: { Args: { p_guest_id: string }; Returns: number };
      record_late_payment_refund: { Args: { p_order_id: string; p_refund_id: string }; Returns: undefined };
      record_no_show: { Args: { p_booking_id: string }; Returns: undefined };
      record_refund_progress: { Args: { p_refund_id: string; p_stripe_refund_id: string; p_stripe_transfer_reversal_id: string; p_error?: string }; Returns: undefined };
      reject_host_application: { Args: { p_application_id: string; p_reason: string }; Returns: undefined };
      replace_availability_rules: { Args: { p_space_id: string; p_rules: Json }; Returns: undefined };
      review_identity_document: { Args: { p_document_id: string; p_approve: boolean; p_reject_reason?: string; p_request_back_side?: boolean }; Returns: undefined };
      search_spaces: { Args: { p_keyword?: string; p_min_capacity?: number; p_limit?: number }; Returns: { id: string; host_id: string; company_name: string; name: string; area: string; address: string; capacity: number; price_per_30min: number; min_slots: number; cover_path: string }[] };
      set_order_payment_intent: { Args: { p_order_id: string; p_payment_intent_id: string }; Returns: undefined };
      set_order_stripe_fee_actual: { Args: { p_order_id: string; p_fee: number }; Returns: undefined };
      space_busy_periods: { Args: { p_space_id: string; p_from: string; p_to: string }; Returns: { period_start: string; period_end: string }[] };
      spaces_busy_periods: { Args: { p_space_ids: string[]; p_from: string; p_to: string }; Returns: { space_id: string; period_start: string; period_end: string }[] };
      submit_identity_document: { Args: { p_document_type: Database["public"]["Enums"]["identity_document_type"]; p_front_path: string; p_back_path?: string }; Returns: string };
      withdraw_account: { Args: never; Returns: undefined };
    };
    Enums: {
      account_status: "active" | "suspended";
      booking_status: "pending" | "expired" | "confirmed" | "cancelled" | "completed" | "no_show";
      cancel_actor: "guest" | "host" | "admin";
      cancel_policy: "full" | "half" | "none";
      host_status: "applied" | "active" | "suspended";
      identity_document_type: "drivers_license" | "my_number_card" | "passport" | "residence_card";
      identity_status: "unsubmitted" | "pending" | "approved" | "rejected";
      notification_status: "queued" | "sent" | "failed";
      order_status: "pending" | "paid" | "expired" | "failed";
      refund_status: "pending" | "succeeded" | "failed";
      review_status: "pending" | "approved" | "rejected";
      space_status: "draft" | "published" | "suspended";
      user_role: "guest" | "host" | "admin";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
