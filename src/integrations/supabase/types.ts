export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_messages: {
        Row: {
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ai_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          created_at: string;
          duration_minutes: number | null;
          id: string;
          location: string | null;
          meeting_url: string | null;
          mode: string;
          notes: string | null;
          provider_avatar_url: string | null;
          provider_name: string;
          specialty: string | null;
          starts_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          mode?: string;
          notes?: string | null;
          provider_avatar_url?: string | null;
          provider_name: string;
          specialty?: string | null;
          starts_at: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          mode?: string;
          notes?: string | null;
          provider_avatar_url?: string | null;
          provider_name?: string;
          specialty?: string | null;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          active: boolean;
          color: string | null;
          created_at: string;
          dose: string | null;
          end_date: string | null;
          frequency: string | null;
          id: string;
          name: string;
          notes: string | null;
          scheduled_time: string | null;
          start_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          color?: string | null;
          created_at?: string;
          dose?: string | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          scheduled_time?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          color?: string | null;
          created_at?: string;
          dose?: string | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          scheduled_time?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          read_at: string | null;
          severity: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          read_at?: string | null;
          severity?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          severity?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          allergies: string[] | null;
          avatar_url: string | null;
          blood_type: string | null;
          chronic_conditions: string[] | null;
          created_at: string;
          date_of_birth: string | null;
          display_name: string | null;
          emergency_contacts: Json | null;
          height_cm: number | null;
          id: string;
          locale: string | null;
          preferences: Json | null;
          sex: string | null;
          updated_at: string;
        };
        Insert: {
          allergies?: string[] | null;
          avatar_url?: string | null;
          blood_type?: string | null;
          chronic_conditions?: string[] | null;
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          emergency_contacts?: Json | null;
          height_cm?: number | null;
          id: string;
          locale?: string | null;
          preferences?: Json | null;
          sex?: string | null;
          updated_at?: string;
        };
        Update: {
          allergies?: string[] | null;
          avatar_url?: string | null;
          blood_type?: string | null;
          chronic_conditions?: string[] | null;
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          emergency_contacts?: Json | null;
          height_cm?: number | null;
          id?: string;
          locale?: string | null;
          preferences?: Json | null;
          sex?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      records: {
        Row: {
          ai_summary: string | null;
          category: string | null;
          created_at: string;
          description: string | null;
          file_path: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_summary?: string | null;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          file_path: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_summary?: string | null;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          file_path?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      medverify_checks: {
        Row: {
          created_at: string;
          id: string;
          medication_name: string;
          result_summary: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          medication_name: string;
          result_summary?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          medication_name?: string;
          result_summary?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_plans: {
        Row: {
          id: string;
          user_id: string;
          generated_at: string;
          plan_data: Record<string, unknown>;
          medication_reminders: Record<string, unknown>[];
        };
        Insert: {
          id?: string;
          user_id?: string;
          generated_at?: string;
          plan_data?: Record<string, unknown>;
          medication_reminders?: Record<string, unknown>[];
        };
        Update: {
          id?: string;
          user_id?: string;
          generated_at?: string;
          plan_data?: Record<string, unknown>;
          medication_reminders?: Record<string, unknown>[];
        };
        Relationships: [];
      };
      sleep_logs: {
        Row: {
          id: string;
          user_id: string;
          bedtime: string;
          wake_time: string;
          quality_rating: number | null;
          notes: string | null;
          logged_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bedtime: string;
          wake_time: string;
          quality_rating?: number | null;
          notes?: string | null;
          logged_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bedtime?: string;
          wake_time?: string;
          quality_rating?: number | null;
          notes?: string | null;
          logged_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      hydration_logs: {
        Row: {
          id: string;
          user_id: string;
          amount_ml: number;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_ml: number;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount_ml?: number;
          logged_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fitness_logs: {
        Row: {
          id: string;
          user_id: string;
          workout_type: string | null;
          duration_minutes: number;
          intensity: string | null;
          logged_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_type?: string | null;
          duration_minutes: number;
          intensity?: string | null;
          logged_date: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_type?: string | null;
          duration_minutes?: number;
          intensity?: string | null;
          logged_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      schedule_items: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          item_type: string;
          scheduled_at: string;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          item_type?: string;
          scheduled_at: string;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          item_type?: string;
          scheduled_at?: string;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_shares: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "health_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      health_vault: {
        Row: {
          id: string;
          user_id: string;
          age: number | null;
          body_weight_kg: number | null;
          gender: string | null;
          country: string | null;
          city: string | null;
          past_illnesses: string[] | null;
          hereditary_diseases: string[] | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          allergies: string[] | null;
          chronic_conditions: string[] | null;
          smoking_status: string | null;
          alcohol_use: string | null;
          dietary_preference: string | null;
          dietary_preference_other: string | null;
          health_goals: string[] | null;
          is_pregnant: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age?: number | null;
          body_weight_kg?: number | null;
          gender?: string | null;
          country?: string | null;
          city?: string | null;
          past_illnesses?: string[] | null;
          hereditary_diseases?: string[] | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          smoking_status?: string | null;
          alcohol_use?: string | null;
          dietary_preference?: string | null;
          dietary_preference_other?: string | null;
          health_goals?: string[] | null;
          is_pregnant?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          age?: number | null;
          body_weight_kg?: number | null;
          gender?: string | null;
          country?: string | null;
          city?: string | null;
          past_illnesses?: string[] | null;
          hereditary_diseases?: string[] | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          smoking_status?: string | null;
          alcohol_use?: string | null;
          dietary_preference?: string | null;
          dietary_preference_other?: string | null;
          health_goals?: string[] | null;
          is_pregnant?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      allergies: {
        Row: {
          id: string;
          user_id: string;
          allergen: string;
          reaction: string | null;
          severity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          allergen: string;
          reaction?: string | null;
          severity: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          allergen?: string;
          reaction?: string | null;
          severity?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      medical_history_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          description: string;
          related_person: string | null;
          event_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          description: string;
          related_person?: string | null;
          event_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          description?: string;
          related_person?: string | null;
          event_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vitals: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          notes: string | null;
          taken_at: string;
          unit: string | null;
          user_id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          notes?: string | null;
          taken_at?: string;
          unit?: string | null;
          user_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          notes?: string | null;
          taken_at?: string;
          unit?: string | null;
          user_id?: string;
          value?: number;
        };
        Relationships: [];
      };
      whatsapp_links: {
        Row: {
          created_at: string;
          id: string;
          linked_at: string | null;
          linking_code: string;
          phone_number: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          linked_at?: string | null;
          linking_code: string;
          phone_number?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          linked_at?: string | null;
          linking_code?: string;
          phone_number?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clock_reminders: {
        Row: {
          enabled: boolean;
          id: string;
          label: string;
          time: string;
          user_id: string;
        };
        Insert: {
          enabled?: boolean;
          id?: string;
          label: string;
          time: string;
          user_id: string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          label?: string;
          time?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      web_push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      web_push_jobs: {
        Row: {
          body: string;
          created_at: string;
          fire_at: string;
          id: string;
          job_type: string;
          repeat: string;
          sent_at: string | null;
          status: string;
          time: string | null;
          timezone: string | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          fire_at: string;
          id?: string;
          job_type: string;
          repeat?: string;
          sent_at?: string | null;
          status?: string;
          time?: string | null;
          timezone?: string | null;
          title: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          fire_at?: string;
          id?: string;
          job_type?: string;
          repeat?: string;
          sent_at?: string | null;
          status?: string;
          time?: string | null;
          timezone?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "web_push_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "user" | "doctor" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "doctor", "admin"],
    },
  },
} as const;
