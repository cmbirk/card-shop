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
      admins: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          acquired_date: string | null
          acquired_from: string | null
          autograph: string
          brand: string | null
          card_number: string
          category: string
          cost_basis: number | null
          created_at: string
          featured: boolean
          foil: boolean
          grade: Json | null
          graded: boolean
          id: string
          image_back: string | null
          image_extra: string[]
          image_front: string | null
          is_error: boolean
          is_insert: boolean
          is_rookie: boolean
          lore: Json
          parallel: string | null
          player_name: string
          price: number
          print_run: number | null
          quantity: number
          rarity: string
          raw_condition: string | null
          relic: string
          section: string | null
          seed: number
          serial_number: number | null
          set_name: string
          sport: string
          status: string
          subset: string | null
          team: string
          updated_at: string
          variation: string | null
          year: number
        }
        Insert: {
          acquired_date?: string | null
          acquired_from?: string | null
          autograph?: string
          brand?: string | null
          card_number?: string
          category: string
          cost_basis?: number | null
          created_at?: string
          featured?: boolean
          foil?: boolean
          grade?: Json | null
          graded?: boolean
          id: string
          image_back?: string | null
          image_extra?: string[]
          image_front?: string | null
          is_error?: boolean
          is_insert?: boolean
          is_rookie?: boolean
          lore?: Json
          parallel?: string | null
          player_name: string
          price?: number
          print_run?: number | null
          quantity?: number
          rarity?: string
          raw_condition?: string | null
          relic?: string
          section?: string | null
          seed?: number
          serial_number?: number | null
          set_name?: string
          sport: string
          status?: string
          subset?: string | null
          team?: string
          updated_at?: string
          variation?: string | null
          year?: number
        }
        Update: {
          acquired_date?: string | null
          acquired_from?: string | null
          autograph?: string
          brand?: string | null
          card_number?: string
          category?: string
          cost_basis?: number | null
          created_at?: string
          featured?: boolean
          foil?: boolean
          grade?: Json | null
          graded?: boolean
          id?: string
          image_back?: string | null
          image_extra?: string[]
          image_front?: string | null
          is_error?: boolean
          is_insert?: boolean
          is_rookie?: boolean
          lore?: Json
          parallel?: string | null
          player_name?: string
          price?: number
          print_run?: number | null
          quantity?: number
          rarity?: string
          raw_condition?: string | null
          relic?: string
          section?: string | null
          seed?: number
          serial_number?: number | null
          set_name?: string
          sport?: string
          status?: string
          subset?: string | null
          team?: string
          updated_at?: string
          variation?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      cards_public: {
        Row: {
          autograph: string | null
          brand: string | null
          card_number: string | null
          category: string | null
          created_at: string | null
          featured: boolean | null
          foil: boolean | null
          grade: Json | null
          graded: boolean | null
          id: string | null
          image_back: string | null
          image_extra: string[] | null
          image_front: string | null
          is_error: boolean | null
          is_insert: boolean | null
          is_rookie: boolean | null
          lore: Json | null
          parallel: string | null
          player_name: string | null
          price: number | null
          print_run: number | null
          quantity: number | null
          rarity: string | null
          raw_condition: string | null
          relic: string | null
          section: string | null
          seed: number | null
          serial_number: number | null
          set_name: string | null
          sport: string | null
          status: string | null
          subset: string | null
          team: string | null
          updated_at: string | null
          variation: string | null
          year: number | null
        }
        Insert: {
          autograph?: string | null
          brand?: string | null
          card_number?: string | null
          category?: string | null
          created_at?: string | null
          featured?: boolean | null
          foil?: boolean | null
          grade?: Json | null
          graded?: boolean | null
          id?: string | null
          image_back?: string | null
          image_extra?: string[] | null
          image_front?: string | null
          is_error?: boolean | null
          is_insert?: boolean | null
          is_rookie?: boolean | null
          lore?: Json | null
          parallel?: string | null
          player_name?: string | null
          price?: number | null
          print_run?: number | null
          quantity?: number | null
          rarity?: string | null
          raw_condition?: string | null
          relic?: string | null
          section?: string | null
          seed?: number | null
          serial_number?: number | null
          set_name?: string | null
          sport?: string | null
          status?: string | null
          subset?: string | null
          team?: string | null
          updated_at?: string | null
          variation?: string | null
          year?: number | null
        }
        Update: {
          autograph?: string | null
          brand?: string | null
          card_number?: string | null
          category?: string | null
          created_at?: string | null
          featured?: boolean | null
          foil?: boolean | null
          grade?: Json | null
          graded?: boolean | null
          id?: string | null
          image_back?: string | null
          image_extra?: string[] | null
          image_front?: string | null
          is_error?: boolean | null
          is_insert?: boolean | null
          is_rookie?: boolean | null
          lore?: Json | null
          parallel?: string | null
          player_name?: string | null
          price?: number | null
          print_run?: number | null
          quantity?: number | null
          rarity?: string | null
          raw_condition?: string | null
          relic?: string | null
          section?: string | null
          seed?: number | null
          serial_number?: number | null
          set_name?: string | null
          sport?: string | null
          status?: string | null
          subset?: string | null
          team?: string | null
          updated_at?: string | null
          variation?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: { uid: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
