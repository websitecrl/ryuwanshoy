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
      chapters: {
        Row: {
          chapter_number: number
          created_at: string | null
          id: string
          is_draft: boolean | null
          is_early_access: boolean | null
          is_published: boolean | null
          published_at: string | null
          series_id: string | null
          title: string | null
        }
        Insert: {
          chapter_number: number
          created_at?: string | null
          id?: string
          is_draft?: boolean | null
          is_early_access?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          series_id?: string | null
          title?: string | null
        }
        Update: {
          chapter_number?: number
          created_at?: string | null
          id?: string
          is_draft?: boolean | null
          is_early_access?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          series_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          chapter_id: string | null
          content: string
          created_at: string | null
          edit_token: string
          id: string
          ip_hash: string | null
          is_read: boolean | null
          name: string
          parent_id: string | null
          post_id: string | null
          series_id: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          content: string
          created_at?: string | null
          edit_token: string
          id?: string
          ip_hash?: string | null
          is_read?: boolean | null
          name: string
          parent_id?: string | null
          post_id?: string | null
          series_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          content?: string
          created_at?: string | null
          edit_token?: string
          id?: string
          ip_hash?: string | null
          is_read?: boolean | null
          name?: string
          parent_id?: string | null
          post_id?: string | null
          series_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      early_access: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          device: string | null
          error_digest: string | null
          error_message: string | null
          id: string
          is_read: boolean
          kind: string
          message: string
          page_url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          error_digest?: string | null
          error_message?: string | null
          id?: string
          is_read?: boolean
          kind: string
          message?: string
          page_url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          error_digest?: string | null
          error_message?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          message?: string
          page_url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          banner_image: string | null
          chapter_id: string | null
          created_at: string | null
          headline: string | null
          id: string
          is_visible: boolean | null
          order_index: number
          series_id: string | null
        }
        Insert: {
          banner_image?: string | null
          chapter_id?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          is_visible?: boolean | null
          order_index: number
          series_id?: string | null
        }
        Update: {
          banner_image?: string | null
          chapter_id?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          is_visible?: boolean | null
          order_index?: number
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_slides_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          like_token: string
          post_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          like_token: string
          post_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          like_token?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          chapter_id: string | null
          id: string
          image_url: string
          is_spread: boolean
          page_number: number
        }
        Insert: {
          chapter_id?: string | null
          id?: string
          image_url: string
          is_spread?: boolean
          page_number: number
        }
        Update: {
          chapter_id?: string | null
          id?: string
          image_url?: string
          is_spread?: boolean
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          post_type: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          post_type?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          post_type?: string | null
          title?: string | null
        }
        Relationships: []
      }
      series: {
        Row: {
          banner_image: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          genre: string | null
          id: string
          is_published: boolean | null
          min_age: number
          slug: string
          status: string | null
          title: string
        }
        Insert: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          is_published?: boolean | null
          min_age?: number
          slug: string
          status?: string | null
          title: string
        }
        Update: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          is_published?: boolean | null
          min_age?: number
          slug?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          creator_name: string | null
          donation_message: string | null
          ea_headline: string | null
          ea_subtext: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          kofi_url: string | null
          logo_url: string | null
          patreon_url: string | null
          paypal_url: string | null
          site_description: string | null
          site_title: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          youtube_url: string | null
        }
        Insert: {
          creator_name?: string | null
          donation_message?: string | null
          ea_headline?: string | null
          ea_subtext?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          kofi_url?: string | null
          logo_url?: string | null
          patreon_url?: string | null
          paypal_url?: string | null
          site_description?: string | null
          site_title?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          youtube_url?: string | null
        }
        Update: {
          creator_name?: string | null
          donation_message?: string | null
          ea_headline?: string | null
          ea_subtext?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          kofi_url?: string | null
          logo_url?: string | null
          patreon_url?: string | null
          paypal_url?: string | null
          site_description?: string | null
          site_title?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          youtube_url?: string | null
        }
        Relationships: []
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
