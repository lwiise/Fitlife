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
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          detail: Json | null
          id: string
          subscriber_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          subscriber_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      body_logs: {
        Row: {
          created_at: string
          id: string
          member_id: string
          recorded_on: string
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string
          recorded_on: string
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          recorded_on?: string
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          cost_usd: number | null
          created_at: string
          id: string
          model: string | null
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          id?: string
          model?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          id?: string
          model?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          activity_level: string | null
          allergies: Json | null
          birth_year: number | null
          consulted_doctor: boolean | null
          created_at: string
          day_nature: string | null
          dietary_restrictions: string[] | null
          dislikes: Json | null
          display_order: number
          exercise_days: string | null
          exercise_profile: Json | null
          exercise_type: string | null
          feeding_mode: string | null
          height_cm: number | null
          high_risk_pregnancy: boolean | null
          id: string
          meal_mode: string
          medical_conditions: string[] | null
          medications: Json | null
          member_type: string
          months_postpartum: number | null
          name: string
          nausea_foods: Json | null
          picky_eater: boolean | null
          preferred_language: string
          primary_goal: string | null
          role: string
          school_meal_handling: string | null
          sex: string | null
          sleep_hours: number | null
          supplements: Json | null
          target_weight_kg: number | null
          trimester: number | null
          updated_at: string
          user_id: string
          water_cups: number | null
          water_liters: string | null
          weight_kg: number | null
          workout_profile: Json | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean | null
          created_at?: string
          day_nature?: string | null
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_order?: number
          exercise_days?: string | null
          exercise_profile?: Json | null
          exercise_type?: string | null
          feeding_mode?: string | null
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id?: string
          meal_mode?: string
          medical_conditions?: string[] | null
          medications?: Json | null
          member_type?: string
          months_postpartum?: number | null
          name: string
          nausea_foods?: Json | null
          picky_eater?: boolean | null
          preferred_language?: string
          primary_goal?: string | null
          role: string
          school_meal_handling?: string | null
          sex?: string | null
          sleep_hours?: number | null
          supplements?: Json | null
          target_weight_kg?: number | null
          trimester?: number | null
          updated_at?: string
          user_id: string
          water_cups?: number | null
          water_liters?: string | null
          weight_kg?: number | null
          workout_profile?: Json | null
        }
        Update: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          consulted_doctor?: boolean | null
          created_at?: string
          day_nature?: string | null
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_order?: number
          exercise_days?: string | null
          exercise_profile?: Json | null
          exercise_type?: string | null
          feeding_mode?: string | null
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          id?: string
          meal_mode?: string
          medical_conditions?: string[] | null
          medications?: Json | null
          member_type?: string
          months_postpartum?: number | null
          name?: string
          nausea_foods?: Json | null
          picky_eater?: boolean | null
          preferred_language?: string
          primary_goal?: string | null
          role?: string
          school_meal_handling?: string | null
          sex?: string | null
          sleep_hours?: number | null
          supplements?: Json | null
          target_weight_kg?: number | null
          trimester?: number | null
          updated_at?: string
          user_id?: string
          water_cups?: number | null
          water_liters?: string | null
          weight_kg?: number | null
          workout_profile?: Json | null
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
      meal_checkins: {
        Row: {
          created_at: string
          day_index: number
          id: string
          local_date: string
          meal_plan_id: string
          reason: string | null
          slot: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_index: number
          id?: string
          local_date: string
          meal_plan_id: string
          reason?: string | null
          slot: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          local_date?: string
          meal_plan_id?: string
          reason?: string | null
          slot?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_checkins_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_checkins_user_id_fkey"
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
      meal_verdicts: {
        Row: {
          canonical_key: string
          created_at: string
          day_index: number
          id: string
          meal_plan_id: string
          member_id: string
          recipe_name_ar: string
          slot: string
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          day_index: number
          id?: string
          meal_plan_id: string
          member_id: string
          recipe_name_ar: string
          slot: string
          updated_at?: string
          user_id: string
          verdict: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          day_index?: number
          id?: string
          meal_plan_id?: string
          member_id?: string
          recipe_name_ar?: string
          slot?: string
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_verdicts_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_verdicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_exceptions: {
        Row: {
          checkin_id: string
          created_at: string
          id: string
          kind: string
          member_id: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          id?: string
          kind: string
          member_id: string
          user_id: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          id?: string
          kind?: string
          member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_exceptions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "meal_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_exceptions_user_id_fkey"
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
          plan_kind: string
          started_at: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
          workout_plan_id: string | null
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
          plan_kind?: string
          started_at?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
          workout_plan_id?: string | null
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
          plan_kind?: string
          started_at?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
          workout_plan_id?: string | null
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
          {
            foreignKeyName: "plan_generations_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          allergies: Json | null
          birth_year: number | null
          breakfast_habit: string | null
          consulted_doctor: boolean
          cooking_methods: Json | null
          cooking_time: string | null
          created_at: string
          cuisine_preference: string
          day_nature: string | null
          deep_dive_completed_at: string | null
          dietary_restrictions: string[] | null
          dislikes: Json | null
          display_name: string | null
          exercise_days: string | null
          exercise_duration: string | null
          exercise_profile: Json | null
          exercise_prompt_shown_at: string | null
          exercise_type: string | null
          family_dietary_restrictions: Json | null
          family_dislikes: Json | null
          family_wide_completed_at: string | null
          feeding_mode: string | null
          food_budget: string | null
          food_preferences: Json
          food_recall_24h: string | null
          has_medical_conditions: boolean
          height_cm: number | null
          high_risk_pregnancy: boolean | null
          hip_cm: number | null
          id: string
          intermittent_fasting: string | null
          is_pregnant: boolean
          liked_foods: Json | null
          meal_mode: string
          meal_out_frequency: string | null
          meals_per_day: number | null
          medical_conditions: string[] | null
          medications: Json | null
          member_addition_order: Json | null
          member_type: string
          mom_profile_completed_at: string | null
          months_postpartum: number | null
          nausea_foods: Json | null
          never_eat_foods: Json | null
          notes: string | null
          onboarding_completed_at: string | null
          phone: string | null
          preferred_language: string
          pregnancy_month: number | null
          pregnancy_trimester: number | null
          previous_diets: string | null
          primary_goal: string | null
          sex: string | null
          sleep_band: string | null
          sleep_hours: number | null
          sleep_quality: string | null
          snacks_habit: string | null
          steps_daily: number | null
          stress_level: string | null
          supplements: Json | null
          target_weight_kg: number | null
          updated_at: string
          waist_cm: number | null
          water_cups: number | null
          water_liters: string | null
          weight_kg: number | null
          who_cooks: string | null
          workout_profile: Json | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          breakfast_habit?: string | null
          consulted_doctor?: boolean
          cooking_methods?: Json | null
          cooking_time?: string | null
          created_at?: string
          cuisine_preference?: string
          day_nature?: string | null
          deep_dive_completed_at?: string | null
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_name?: string | null
          exercise_days?: string | null
          exercise_duration?: string | null
          exercise_profile?: Json | null
          exercise_prompt_shown_at?: string | null
          exercise_type?: string | null
          family_dietary_restrictions?: Json | null
          family_dislikes?: Json | null
          family_wide_completed_at?: string | null
          feeding_mode?: string | null
          food_budget?: string | null
          food_preferences?: Json
          food_recall_24h?: string | null
          has_medical_conditions?: boolean
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          hip_cm?: number | null
          id: string
          intermittent_fasting?: string | null
          is_pregnant?: boolean
          liked_foods?: Json | null
          meal_mode?: string
          meal_out_frequency?: string | null
          meals_per_day?: number | null
          medical_conditions?: string[] | null
          medications?: Json | null
          member_addition_order?: Json | null
          member_type?: string
          mom_profile_completed_at?: string | null
          months_postpartum?: number | null
          nausea_foods?: Json | null
          never_eat_foods?: Json | null
          notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_language?: string
          pregnancy_month?: number | null
          pregnancy_trimester?: number | null
          previous_diets?: string | null
          primary_goal?: string | null
          sex?: string | null
          sleep_band?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          snacks_habit?: string | null
          steps_daily?: number | null
          stress_level?: string | null
          supplements?: Json | null
          target_weight_kg?: number | null
          updated_at?: string
          waist_cm?: number | null
          water_cups?: number | null
          water_liters?: string | null
          weight_kg?: number | null
          who_cooks?: string | null
          workout_profile?: Json | null
        }
        Update: {
          activity_level?: string | null
          allergies?: Json | null
          birth_year?: number | null
          breakfast_habit?: string | null
          consulted_doctor?: boolean
          cooking_methods?: Json | null
          cooking_time?: string | null
          created_at?: string
          cuisine_preference?: string
          day_nature?: string | null
          deep_dive_completed_at?: string | null
          dietary_restrictions?: string[] | null
          dislikes?: Json | null
          display_name?: string | null
          exercise_days?: string | null
          exercise_duration?: string | null
          exercise_profile?: Json | null
          exercise_prompt_shown_at?: string | null
          exercise_type?: string | null
          family_dietary_restrictions?: Json | null
          family_dislikes?: Json | null
          family_wide_completed_at?: string | null
          feeding_mode?: string | null
          food_budget?: string | null
          food_preferences?: Json
          food_recall_24h?: string | null
          has_medical_conditions?: boolean
          height_cm?: number | null
          high_risk_pregnancy?: boolean | null
          hip_cm?: number | null
          id?: string
          intermittent_fasting?: string | null
          is_pregnant?: boolean
          liked_foods?: Json | null
          meal_mode?: string
          meal_out_frequency?: string | null
          meals_per_day?: number | null
          medical_conditions?: string[] | null
          medications?: Json | null
          member_addition_order?: Json | null
          member_type?: string
          mom_profile_completed_at?: string | null
          months_postpartum?: number | null
          nausea_foods?: Json | null
          never_eat_foods?: Json | null
          notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_language?: string
          pregnancy_month?: number | null
          pregnancy_trimester?: number | null
          previous_diets?: string | null
          primary_goal?: string | null
          sex?: string | null
          sleep_band?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          snacks_habit?: string | null
          steps_daily?: number | null
          stress_level?: string | null
          supplements?: Json | null
          target_weight_kg?: number | null
          updated_at?: string
          waist_cm?: number | null
          water_cups?: number | null
          water_liters?: string | null
          weight_kg?: number | null
          who_cooks?: string | null
          workout_profile?: Json | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
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
          ls_customer_id: string | null
          ls_order_id: string | null
          ls_subscription_id: string | null
          ls_variant_id: string | null
          status: string
          tier: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
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
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          status?: string
          tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
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
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
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
      workout_plans: {
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
            foreignKeyName: "workout_plans_user_id_fkey"
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
