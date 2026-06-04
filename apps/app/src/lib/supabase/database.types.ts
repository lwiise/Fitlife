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
      chat_messages: {
        Row: {
          id: string
          user_id: string
          model: string | null
          tokens_in: number | null
          tokens_out: number | null
          cost_usd: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          model?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          model?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          activity_level: string | null
          allergies: Json | null
          birth_year: number | null
          consulted_doctor: boolean | null
          created_at: string
          dietary_restrictions: string[] | null
          dislikes: Json | null
          display_order: number
          height_cm: number | null
          high_risk_pregnancy: boolean | null
          id: string
          meal_mode: string
          medical_conditions: string[] | null
          member_type: string
          months_postpartum: number | null
          name: string
          picky_eater: boolean | null
          preferred_language: string
          primary_goal: string | null
          role: string
          school_meal_handling: string | null
          sex: string | null
          trimester: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean | null
          created_at?: string
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_order?: number
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id?: string
          meal_mode?: string
          medical_conditions?: string[] | null
          member_type?: string
          months_postpartum?: number | null
          name: string
          picky_eater?: boolean | null
          preferred_language?: string
          primary_goal?: string | null
          role: string
          school_meal_handling?: string | null
          sex?: string | null
          trimester?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean | null
          created_at?: string
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_order?: number
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id?: string
          meal_mode?: string
          medical_conditions?: string[] | null
          member_type?: string
          months_postpartum?: number | null
          name?: string
          picky_eater?: boolean | null
          preferred_language?: string
          primary_goal?: string | null
          role?: string
          school_meal_handling?: string | null
          sex?: string | null
          trimester?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          ai_generation_seconds: number | null
          ai_input_tokens: number | null
          ai_model: string | null
          ai_output_tokens: number | null
          created_at: string
          error_message: string | null
          generated_at: string | null
          id: string
          plan_data: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generation_seconds?: number | null
          ai_input_tokens?: number | null
          ai_model?: string | null
          ai_output_tokens?: number | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          plan_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generation_seconds?: number | null
          ai_input_tokens?: number | null
          ai_model?: string | null
          ai_output_tokens?: number | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          plan_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_generations: {
        Row: {
          ai_input_tokens: number
          ai_output_tokens: number
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost_usd: number
          failure_reason: string | null
          id: string
          meal_plan_id: string | null
          model: string | null
          started_at: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          ai_input_tokens?: number
          ai_output_tokens?: number
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number
          failure_reason?: string | null
          id?: string
          meal_plan_id?: string | null
          model?: string | null
          started_at?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          ai_input_tokens?: number
          ai_output_tokens?: number
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number
          failure_reason?: string | null
          id?: string
          meal_plan_id?: string | null
          model?: string | null
          started_at?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_generations_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          allergies: Json | null
          birth_year: number | null
          consulted_doctor: boolean
          cooking_methods: Json | null
          created_at: string
          cuisine_preference: string
          dietary_restrictions: string[] | null
          dislikes: Json | null
          display_name: string | null
          family_dietary_restrictions: Json | null
          family_dislikes: Json | null
          family_wide_completed_at: string | null
          has_medical_conditions: boolean
          height_cm: number | null
          high_risk_pregnancy: boolean | null
          id: string
          is_pregnant: boolean
          meal_out_frequency: string | null
          medical_conditions: string[] | null
          member_addition_order: Json | null
          member_type: string
          mom_profile_completed_at: string | null
          months_postpartum: number | null
          onboarding_completed_at: string | null
          preferred_language: string
          pregnancy_trimester: number | null
          primary_goal: string | null
          sex: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean
          cooking_methods?: Json | null
          created_at?: string
          cuisine_preference?: string
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_name?: string | null
          family_dietary_restrictions?: Json | null
          family_dislikes?: Json | null
          family_wide_completed_at?: string | null
          has_medical_conditions?: boolean
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id: string
          is_pregnant?: boolean
          meal_out_frequency?: string | null
          medical_conditions?: string[] | null
          member_addition_order?: Json | null
          member_type?: string
          mom_profile_completed_at?: string | null
          months_postpartum?: number | null
          onboarding_completed_at?: string | null
          preferred_language?: string
          pregnancy_trimester?: number | null
          primary_goal?: string | null
          sex?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean
          cooking_methods?: Json | null
          created_at?: string
          cuisine_preference?: string
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_name?: string | null
          family_dietary_restrictions?: Json | null
          family_dislikes?: Json | null
          family_wide_completed_at?: string | null
          has_medical_conditions?: boolean
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id?: string
          is_pregnant?: boolean
          meal_out_frequency?: string | null
          medical_conditions?: string[] | null
          member_addition_order?: Json | null
          member_type?: string
          mom_profile_completed_at?: string | null
          months_postpartum?: number | null
          onboarding_completed_at?: string | null
          preferred_language?: string
          pregnancy_trimester?: number | null
          primary_goal?: string | null
          sex?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cadence: string | null
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ends_at: string | null
          id: string
          lemonsqueezy_customer_id: string | null
          lemonsqueezy_subscription_id: string | null
          lemonsqueezy_variant_id: string | null
          ls_customer_id: string
          ls_order_id: string | null
          ls_subscription_id: string
          ls_variant_id: string
          status: string
          tier: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval: string
          cadence?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          lemonsqueezy_customer_id?: string | null
          lemonsqueezy_subscription_id?: string | null
          lemonsqueezy_variant_id?: string | null
          ls_customer_id: string
          ls_order_id?: string | null
          ls_subscription_id: string
          ls_variant_id: string
          status: string
          tier: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string
          cadence?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          lemonsqueezy_customer_id?: string | null
          lemonsqueezy_subscription_id?: string | null
          lemonsqueezy_variant_id?: string | null
          ls_customer_id?: string
          ls_order_id?: string | null
          ls_subscription_id?: string
          ls_variant_id?: string
          status?: string
          tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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