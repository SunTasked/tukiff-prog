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
      block_items: {
        Row: {
          block_id: string
          calories: number | null
          distance_m: number | null
          duration_s: number | null
          exercise_id: string | null
          id: string
          label: string | null
          levels: Json
          load_kg: number | null
          notes: string | null
          pct_1rm: number | null
          position: number
          reps: string | null
        }
        Insert: {
          block_id: string
          calories?: number | null
          distance_m?: number | null
          duration_s?: number | null
          exercise_id?: string | null
          id?: string
          label?: string | null
          levels?: Json
          load_kg?: number | null
          notes?: string | null
          pct_1rm?: number | null
          position: number
          reps?: string | null
        }
        Update: {
          block_id?: string
          calories?: number | null
          distance_m?: number | null
          duration_s?: number | null
          exercise_id?: string | null
          id?: string
          label?: string | null
          levels?: Json
          load_kg?: number | null
          notes?: string | null
          pct_1rm?: number | null
          position?: number
          reps?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_items_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "workout_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          measure: string
          name: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measure?: string
          name: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measure?: string
          name?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_programs: {
        Row: {
          invitation_id: string
          program_id: string
        }
        Insert: {
          invitation_id: string
          program_id: string
        }
        Update: {
          invitation_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_programs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          role: string
          uses: number
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          enrolled_at: string | null
          id: string
          role: string | null
          share_scores: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          enrolled_at?: string | null
          id: string
          role?: string | null
          share_scores?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          enrolled_at?: string | null
          id?: string
          role?: string | null
          share_scores?: boolean
        }
        Relationships: []
      }
      program_members: {
        Row: {
          created_at: string
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_members_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          athlete_id: string
          block_id: string
          capped: boolean
          comment: string | null
          created_at: string
          id: string
          level: string
          load_kg: number | null
          reps: number | null
          rounds: number | null
          time_s: number | null
          updated_at: string
          workout_id: string
        }
        Insert: {
          athlete_id?: string
          block_id: string
          capped?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          level?: string
          load_kg?: number | null
          reps?: number | null
          rounds?: number | null
          time_s?: number | null
          updated_at?: string
          workout_id: string
        }
        Update: {
          athlete_id?: string
          block_id?: string
          capped?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          level?: string
          load_kg?: number | null
          reps?: number | null
          rounds?: number | null
          time_s?: number | null
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "workout_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_assignments: {
        Row: {
          athlete_id: string | null
          id: string
          program_id: string | null
          workout_id: string
        }
        Insert: {
          athlete_id?: string | null
          id?: string
          program_id?: string | null
          workout_id: string
        }
        Update: {
          athlete_id?: string | null
          id?: string
          program_id?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_assignments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_assignments_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_blocks: {
        Row: {
          format: string
          id: string
          kind: string
          notes: string | null
          params: Json
          position: number
          title: string | null
          workout_id: string
        }
        Insert: {
          format: string
          id?: string
          kind: string
          notes?: string | null
          params?: Json
          position: number
          title?: string | null
          workout_id: string
        }
        Update: {
          format?: string
          id?: string
          kind?: string
          notes?: string | null
          params?: Json
          position?: number
          title?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_blocks_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          created_by: string | null
          date: string | null
          id: string
          notes: string | null
          publish_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          publish_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          publish_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_created_by_fkey"
            columns: ["created_by"]
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
      accept_invitation: { Args: { p_code: string }; Returns: string }
      assigned_to_me: { Args: { p_workout: string }; Returns: boolean }
      can_see_workout: { Args: { p_workout: string }; Returns: boolean }
      copy_workout: {
        Args: {
          p_date: string
          p_publish_at: string
          p_src: string
          p_with_assignments: boolean
        }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      duplicate_week: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      duplicate_workout: {
        Args: { p_date: string; p_id: string }
        Returns: string
      }
      is_coach: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      my_role: { Args: never; Returns: string }
      my_workouts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          date: string
          id: string
          title: string
        }[]
      }
      remove_member: { Args: { p_user: string }; Returns: undefined }
      save_workout: { Args: { p: Json }; Returns: string }
      schedule_workout: {
        Args: { p_date: string; p_template: string }
        Returns: string
      }
      shares_scores: { Args: { p_user: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
