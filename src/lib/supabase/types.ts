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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      elo_history: {
        Row: {
          match_id: string
          played_at: string
          player_id: string
          rating_after: number
          rating_before: number
          tournament_id: string
        }
        Insert: {
          match_id: string
          played_at: string
          player_id: string
          rating_after: number
          rating_before: number
          tournament_id: string
        }
        Update: {
          match_id?: string
          played_at?: string
          player_id?: string
          rating_after?: number
          rating_before?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elo_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elo_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elo_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elo_history_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      legs: {
        Row: {
          leg_no: number
          match_id: string
          starter: number
          winner: number | null
        }
        Insert: {
          leg_no: number
          match_id: string
          starter: number
          winner?: number | null
        }
        Update: {
          leg_no?: number
          match_id?: string
          starter?: number
          winner?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          best_of: number
          board: number | null
          finished_at: string | null
          group_index: number | null
          id: string
          is_bye: boolean
          is_manual: boolean
          legs_p1: number
          legs_p2: number
          p1: string | null
          p2: string | null
          round: number
          slot: number
          sort_order: number
          stage: string
          start_score: number
          started_at: string | null
          status: string
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          best_of: number
          board?: number | null
          finished_at?: string | null
          group_index?: number | null
          id?: string
          is_bye?: boolean
          is_manual?: boolean
          legs_p1?: number
          legs_p2?: number
          p1?: string | null
          p2?: string | null
          round?: number
          slot?: number
          sort_order?: number
          stage: string
          start_score: number
          started_at?: string | null
          status?: string
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          best_of?: number
          board?: number | null
          finished_at?: string | null
          group_index?: number | null
          id?: string
          is_bye?: boolean
          is_manual?: boolean
          legs_p1?: number
          legs_p2?: number
          p1?: string | null
          p2?: string | null
          round?: number
          slot?: number
          sort_order?: number
          stage?: string
          start_score?: number
          started_at?: string | null
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_p1_fkey"
            columns: ["p1"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_p1_fkey"
            columns: ["p1"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_p2_fkey"
            columns: ["p2"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_p2_fkey"
            columns: ["p2"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          nickname: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          nickname?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          nickname?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          data: Json
          id: number
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      tournament_players: {
        Row: {
          group_index: number | null
          player_id: string
          seed: number
          tournament_id: string
        }
        Insert: {
          group_index?: number | null
          player_id: string
          seed: number
          tournament_id: string
        }
        Update: {
          group_index?: number | null
          player_id?: string
          seed?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_results: {
        Row: {
          place: number
          player_id: string
          points: number
          tournament_id: string
        }
        Insert: {
          place: number
          player_id: string
          points: number
          tournament_id: string
        }
        Update: {
          place?: number
          player_id?: string
          points?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          advance: number
          boards: number
          created_at: string
          date: string
          finished_at: string | null
          fmt: Json
          format: string
          group_count: number
          id: string
          ko: Json | null
          name: string
          season_id: string | null
          seeding: string
          status: string
          third_place: boolean
        }
        Insert: {
          advance?: number
          boards?: number
          created_at?: string
          date?: string
          finished_at?: string | null
          fmt: Json
          format: string
          group_count?: number
          id?: string
          ko?: Json | null
          name: string
          season_id?: string | null
          seeding?: string
          status?: string
          third_place?: boolean
        }
        Update: {
          advance?: number
          boards?: number
          created_at?: string
          date?: string
          finished_at?: string | null
          fmt?: Json
          format?: string
          group_count?: number
          id?: string
          ko?: Json | null
          name?: string
          season_id?: string | null
          seeding?: string
          status?: string
          third_place?: boolean
        }
        Relationships: []
      }
      visits: {
        Row: {
          bust: boolean
          created_at: string
          darts: number
          darts_at_double: number
          id: number
          is_checkout: boolean
          leg_no: number
          match_id: string
          player: number
          score: number
          seq: number
        }
        Insert: {
          bust?: boolean
          created_at?: string
          darts?: number
          darts_at_double?: number
          id?: never
          is_checkout?: boolean
          leg_no: number
          match_id: string
          player: number
          score: number
          seq: number
        }
        Update: {
          bust?: boolean
          created_at?: string
          darts?: number
          darts_at_double?: number
          id?: never
          is_checkout?: boolean
          leg_no?: number
          match_id?: string
          player?: number
          score?: number
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "visits_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_match_id_leg_no_fkey"
            columns: ["match_id", "leg_no"]
            isOneToOne: false
            referencedRelation: "legs"
            referencedColumns: ["match_id", "leg_no"]
          },
        ]
      }
    }
    Views: {
      player_summary: {
        Row: {
          active: boolean | null
          created_at: string | null
          elo: number | null
          has_entries: boolean | null
          id: string | null
          name: string | null
          nickname: string | null
          points: number | null
          tournaments: number | null
        }
        Relationships: []
      }
      player_tournament_record: {
        Row: {
          legs_lost: number | null
          legs_won: number | null
          matches: number | null
          matches_won: number | null
          player_id: string | null
          tournament_id: string | null
        }
        Relationships: []
      }
      player_tournament_stats: {
        Row: {
          best_leg_darts: number | null
          checkouts: number | null
          darts: number | null
          darts_at_double: number | null
          first9_darts: number | null
          first9_points: number | null
          highest_checkout: number | null
          player_id: string | null
          points: number | null
          t100: number | null
          t140: number | null
          t180: number | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_organizer: { Args: never; Returns: boolean }
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
