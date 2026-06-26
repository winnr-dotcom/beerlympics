export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      games: {
        Row: {
          created_at: string
          id: string
          name: string
          participant_type: string
          points_first: number
          points_second: number
          points_third: number
          scoring_type: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          participant_type: string
          points_first?: number
          points_second?: number
          points_third?: number
          scoring_type: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          participant_type?: string
          points_first?: number
          points_second?: number
          points_third?: number
          scoring_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      h2h_matches: {
        Row: {
          bracket_slot: string | null
          created_at: string
          game_id: string
          group_name: string | null
          id: string
          participant_a: string | null
          participant_b: string | null
          score_a: number | null
          score_b: number | null
          stage: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bracket_slot?: string | null
          created_at?: string
          game_id: string
          group_name?: string | null
          id?: string
          participant_a?: string | null
          participant_b?: string | null
          score_a?: number | null
          score_b?: number | null
          stage?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bracket_slot?: string | null
          created_at?: string
          game_id?: string
          group_name?: string | null
          id?: string
          participant_a?: string | null
          participant_b?: string | null
          score_a?: number | null
          score_b?: number | null
          stage?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "h2h_matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_matches_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_matches_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_groups: {
        Row: {
          game_id: string
          group_name: string
          id: string
          participant_id: string
        }
        Insert: {
          game_id: string
          group_name: string
          id?: string
          participant_id: string
        }
        Update: {
          game_id?: string
          group_name?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_groups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_groups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          color: string
          created_at: string
          id: string
          members: string | null
          name: string
          type: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          members?: string | null
          name: string
          type: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          members?: string | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      time_results: {
        Row: {
          created_at: string
          game_id: string
          id: string
          participant_id: string
          time_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          participant_id: string
          time_seconds: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          participant_id?: string
          time_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_results_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export const Constants = {
  public: { Enums: {} },
} as const
