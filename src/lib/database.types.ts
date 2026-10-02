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
          load_kg_f: number | null
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
          load_kg_f?: number | null
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
          load_kg_f?: number | null
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
      block_skips: {
        Row: {
          athlete_id: string
          block_id: string
          created_at: string
          workout_id: string
        }
        Insert: {
          athlete_id?: string
          block_id: string
          created_at?: string
          workout_id: string
        }
        Update: {
          athlete_id?: string
          block_id?: string
          created_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_skips_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_skips_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "workout_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_skips_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_sections: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          measure: string
          name: string
          section_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measure?: string
          name: string
          section_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measure?: string
          name?: string
          section_id?: string | null
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
          {
            foreignKeyName: "exercises_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "exercise_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_programs: {
        Row: {
          invitation_id: string
          level: number
          program_id: string
        }
        Insert: {
          invitation_id: string
          level?: number
          program_id: string
        }
        Update: {
          invitation_id?: string
          level?: number
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
          label: string | null
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
          label?: string | null
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
          label?: string | null
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
      library_sections: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          athlete_id: string
          benchmark_name: string | null
          created_at: string
          date: string
          exercise_id: string | null
          id: string
          load_kg: number | null
          notes: string | null
          rep_max: number | null
          reps: number | null
          rounds: number | null
          score_type: string | null
          time_s: number | null
        }
        Insert: {
          athlete_id?: string
          benchmark_name?: string | null
          created_at?: string
          date?: string
          exercise_id?: string | null
          id?: string
          load_kg?: number | null
          notes?: string | null
          rep_max?: number | null
          reps?: number | null
          rounds?: number | null
          score_type?: string | null
          time_s?: number | null
        }
        Update: {
          athlete_id?: string
          benchmark_name?: string | null
          created_at?: string
          date?: string
          exercise_id?: string | null
          id?: string
          load_kg?: number | null
          notes?: string | null
          rep_max?: number | null
          reps?: number | null
          rounds?: number | null
          score_type?: string | null
          time_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          enrolled_at: string | null
          first_name: string | null
          gender: string | null
          id: string
          invitation_id: string | null
          is_admin: boolean
          is_app_owner: boolean
          last_name: string | null
          messages_seen: string | null
          notify_updates: boolean
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          enrolled_at?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          invitation_id?: string | null
          is_admin?: boolean
          is_app_owner?: boolean
          last_name?: string | null
          messages_seen?: string | null
          notify_updates?: boolean
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          enrolled_at?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          invitation_id?: string | null
          is_admin?: boolean
          is_app_owner?: boolean
          last_name?: string | null
          messages_seen?: string | null
          notify_updates?: boolean
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_coaches: {
        Row: {
          coach_id: string
          program_id: string
        }
        Insert: {
          coach_id: string
          program_id: string
        }
        Update: {
          coach_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_coaches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_members: {
        Row: {
          created_at: string
          level: number
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          level?: number
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          level?: number
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
          access_levels: Json
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          leaderboard_enabled: boolean
          name: string
          owner_id: string | null
          reactions_enabled: boolean
        }
        Insert: {
          access_levels?: Json
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          leaderboard_enabled?: boolean
          name: string
          owner_id?: string | null
          reactions_enabled?: boolean
        }
        Update: {
          access_levels?: Json
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          leaderboard_enabled?: boolean
          name?: string
          owner_id?: string | null
          reactions_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "programs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      result_claps: {
        Row: {
          created_at: string
          from_user: string
          result_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          from_user?: string
          result_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          from_user?: string
          result_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_claps_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_claps_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
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
          rx: boolean
          team_guests: Json | null
          team_id: string | null
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
          rx?: boolean
          team_guests?: Json | null
          team_id?: string | null
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
          rx?: boolean
          team_guests?: Json | null
          team_id?: string | null
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
      sponsors: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          link: string | null
          logo_dark: boolean
          logo_url: string | null
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          link?: string | null
          logo_dark?: boolean
          logo_url?: string | null
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          link?: string | null
          logo_dark?: boolean
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          at: string
          id: number
          key: string
          kind: string
          ms: number | null
          user_id: string
        }
        Insert: {
          at?: string
          id?: never
          key?: string
          kind: string
          ms?: number | null
          user_id: string
        }
        Update: {
          at?: string
          id?: never
          key?: string
          kind?: string
          ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_last_seen: {
        Row: {
          last_at: string
          user_id: string
        }
        Insert: {
          last_at?: string
          user_id: string
        }
        Update: {
          last_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_last_seen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
          days: number
          id: string
          notes: string | null
          program_id: string | null
          publish_at: string | null
          section_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          days?: number
          id?: string
          notes?: string | null
          program_id?: string | null
          publish_at?: string | null
          section_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          days?: number
          id?: string
          notes?: string | null
          program_id?: string | null
          publish_at?: string | null
          section_id?: string | null
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
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "library_sections"
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
      admin_usage: { Args: never; Returns: Json }
      assigned_to_me: { Args: { p_workout: string }; Returns: boolean }
      delete_team_result: { Args: { p_team: string }; Returns: undefined }
      save_team_result: {
        Args: {
          p_block: string
          p_team: string | null
          p_members: string[]
          p_guests: Json
          p_time_s: number | null
          p_capped: boolean
          p_rounds: number | null
          p_reps: number | null
          p_load_kg: number | null
          p_rx: boolean
          p_comment: string | null
        }
        Returns: string
      }
      team_candidates: {
        Args: { p_block: string }
        Returns: {
          id: string
          first_name: string | null
          last_name: string | null
          display_name: string | null
          gender: string | null
          avatar_url: string | null
        }[]
      }
      block_min_level: { Args: { p_params: Json }; Returns: number }
      can_edit_program: { Args: { p_program: string }; Returns: boolean }
      can_edit_workout: { Args: { p_workout: string }; Returns: boolean }
      can_see_block: { Args: { p_block: string }; Returns: boolean }
      can_see_workout: { Args: { p_workout: string }; Returns: boolean }
      clap_counts: {
        Args: { p_workout: string }
        Returns: {
          claps: number
          result_id: string
        }[]
      }
      copy_workout: {
        Args: {
          p_date: string
          p_program: string
          p_publish_at: string
          p_src: string
        }
        Returns: string
      }
      delete_access_level: {
        Args: { p_level: number; p_program: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      delete_pending_member: { Args: { p_user: string }; Returns: undefined }
      duplicate_workouts: {
        Args: { p_days: number; p_ids: string[]; p_program?: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_coach: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      is_pending: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: boolean
      }
      leaderboard_on: { Args: { p_workout: string }; Returns: boolean }
      level_preview: {
        Args: { p_level: number; p_workout: string }
        Returns: boolean
      }
      locked_blocks: {
        Args: { p_workouts: string[] }
        Returns: {
          id: string
          kind: string
          position: number
          title: string
          workout_id: string
        }[]
      }
      member_email: { Args: { p_user: string }; Returns: string }
      members_last_seen: {
        Args: never
        Returns: { last_at: string | null; user_id: string }[]
      }
      move_workouts: {
        Args: { p_days: number; p_ids: string[] }
        Returns: undefined
      }
      my_level: { Args: { p_workout: string }; Returns: number }
      my_role: { Args: never; Returns: string }
      my_workouts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          date: string
          days: number
          id: string
          program_id: string
          program_name: string
          publish_at: string
          title: string
        }[]
      }
      owns_program: { Args: { p_program: string }; Returns: boolean }
      remove_member: { Args: { p_user: string }; Returns: undefined }
      save_workout: { Args: { p: Json }; Returns: string }
      schedule_workout: {
        Args: { p_date: string; p_program: string; p_template: string }
        Returns: string
      }
      set_member_role: {
        Args: { p_role: string; p_user: string }
        Returns: undefined
      }
      track_usage: {
        Args: { p_key?: string; p_kind: string; p_ms?: number }
        Returns: undefined
      }
      transfer_program: {
        Args: { p_new_owner: string; p_program: string }
        Returns: undefined
      }
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
