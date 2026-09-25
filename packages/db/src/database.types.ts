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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
          slots?: number;
          space_id?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          total?: number;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      identity_documents: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          purged_at: string | null;
          reject_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          submitted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          purged_at?: string | null;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          purged_at?: string | null;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          storage_path?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      monthly_statements: {
        Row: {
          created_at: string;
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
        Relationships: [];
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
        Relationships: [];
      };
      orders: {
        Row: {
          application_fee_amount: number;
          created_at: string;
          expires_at: string;
          guest_id: string;
          host_id: string;
          id: string;
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
          id?: string;
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
          id?: string;
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
        Relationships: [];
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
          created_at: string;
          created_by: string | null;
          failure_reason: string | null;
          id: string;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          policy: Database["public"]["Enums"]["cancel_policy"];
          refund_amount: number;
          status: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id: string | null;
          stripe_transfer_reversal_id: string | null;
          transfer_reversal_amount: number;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          booking_id: string;
          created_at?: string;
          created_by?: string | null;
          failure_reason?: string | null;
          id?: string;
          platform_fee_excl_tax: number;
          platform_fee_tax: number;
          policy: Database["public"]["Enums"]["cancel_policy"];
          refund_amount: number;
          status?: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id?: string | null;
          stripe_transfer_reversal_id?: string | null;
          transfer_reversal_amount: number;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          booking_id?: string;
          created_at?: string;
          created_by?: string | null;
          failure_reason?: string | null;
          id?: string;
          platform_fee_excl_tax?: number;
          platform_fee_tax?: number;
          policy?: Database["public"]["Enums"]["cancel_policy"];
          refund_amount?: number;
          status?: Database["public"]["Enums"]["refund_status"];
          stripe_refund_id?: string | null;
          stripe_transfer_reversal_id?: string | null;
          transfer_reversal_amount?: number;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      stripe_events: {
        Row: {
          error: string | null;
          event_id: string;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          type: string;
        };
        Insert: {
          error?: string | null;
          event_id: string;
          payload: Json;
          processed_at?: string | null;
          received_at?: string;
          type: string;
        };
        Update: {
          error?: string | null;
          event_id?: string;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      min_price_per_30min: { Args: { p_min_slots: number }; Returns: number };
    };
    Enums: {
      account_status: "active" | "suspended";
      booking_status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
      cancel_actor: "guest" | "host" | "admin";
      cancel_policy: "full" | "half" | "none";
      host_status: "applied" | "active" | "suspended";
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
