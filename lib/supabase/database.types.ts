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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          group_id: string
          id: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          group_id: string
          id?: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          group_id?: string
          id?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          meeting_date: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          meeting_date: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          meeting_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          display_order: number
          group_id: string
          id: string
          name: string
          teacher_name: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_id: string
          id?: string
          name: string
          teacher_name?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          group_id?: string
          id?: string
          name?: string
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          baptism: string | null
          birthday_day: number | null
          birthday_month: number | null
          birthday_year: number | null
          class_id: string | null
          created_at: string
          deleted_at: string | null
          family_note: string | null
          gender: string | null
          grade: number | null
          graduated_at: string | null
          group_id: string
          guardian2_name: string | null
          guardian2_phone: string | null
          guardian2_relation: string | null
          guardian_name: string | null
          guardian_relation: string | null
          guardian_relation_other: string | null
          id: string
          kakao_id: string | null
          name: string
          note: string | null
          parent_chat_invited: boolean
          registration_submitted: boolean
          school: string | null
          photo_path: string | null
          phone_guardian: string | null
          phone_self: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          baptism?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          family_note?: string | null
          gender?: string | null
          grade?: number | null
          graduated_at?: string | null
          group_id: string
          guardian2_name?: string | null
          guardian2_phone?: string | null
          guardian2_relation?: string | null
          guardian_name?: string | null
          guardian_relation?: string | null
          guardian_relation_other?: string | null
          id?: string
          kakao_id?: string | null
          name: string
          note?: string | null
          parent_chat_invited?: boolean
          registration_submitted?: boolean
          school?: string | null
          photo_path?: string | null
          phone_guardian?: string | null
          phone_self?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          baptism?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          family_note?: string | null
          gender?: string | null
          grade?: number | null
          graduated_at?: string | null
          group_id?: string
          guardian2_name?: string | null
          guardian2_phone?: string | null
          guardian2_relation?: string | null
          guardian_name?: string | null
          guardian_relation?: string | null
          guardian_relation_other?: string | null
          id?: string
          kakao_id?: string | null
          name?: string
          note?: string | null
          parent_chat_invited?: boolean
          registration_submitted?: boolean
          school?: string | null
          photo_path?: string | null
          phone_guardian?: string | null
          phone_self?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          birthday_day: number | null
          birthday_month: number | null
          birthday_year: number | null
          created_at: string
          duty: string | null
          group_id: string
          id: string
          job_type: string | null
          kakao_id: string | null
          name: string
          note: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          created_at?: string
          duty?: string | null
          group_id: string
          id?: string
          job_type?: string | null
          kakao_id?: string | null
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          created_at?: string
          duty?: string | null
          group_id?: string
          id?: string
          job_type?: string | null
          kakao_id?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          group_id: string
          id: string
          reason: string | null
          session_id: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          group_id: string
          id?: string
          reason?: string | null
          session_id: string
          status: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          reason?: string | null
          session_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          note: string | null
          session_date: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          note?: string | null
          session_date: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          note?: string | null
          session_date?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          group_id: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          join_code: string
          last_promoted_year: number | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          join_code: string
          last_promoted_year?: number | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          join_code?: string
          last_promoted_year?: number | null
          name?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          group_id: string
          id: string
          invited_at: string | null
          removed_at: string | null
          removed_by: string | null
          role: Database["public"]["Enums"]["role_type"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          group_id: string
          id?: string
          invited_at?: string | null
          removed_at?: string | null
          removed_by?: string | null
          role: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          group_id?: string
          id?: string
          invited_at?: string | null
          removed_at?: string | null
          removed_by?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthday_day: number | null
          birthday_month: number | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          privacy_consent_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          privacy_consent_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          privacy_consent_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_group_by_code: {
        Args: { code_input: string }
        Returns: string
      }
      promote_group: {
        Args: { p_group_id: string }
        Returns: undefined
      }
    }
    Enums: {
      membership_status: "pending" | "active" | "removed"
      role_type: "master" | "editor" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      membership_status: ["pending", "active", "removed"],
      role_type: ["master", "editor", "viewer"],
    },
  },
} as const
