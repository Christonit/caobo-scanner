// Minimal hand-rolled type that mirrors the live Supabase schema so the
// rest of the codebase has a Database type to import. Regenerate any time
// the DB changes:
//
//   supabase gen types typescript --linked > types/database.types.ts

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          deleted_at?: string | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          organization_id: string;
          role: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role?: string;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          role?: string;
          full_name?: string | null;
          avatar_url?: string | null;
        };
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          tax_payer_id: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          tax_payer_id?: string | null;
          email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          tax_payer_id?: string | null;
          email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
        };
      };
    };
    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_slug?: string | null;
          p_full_name?: string | null;
        };
        Returns: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
      };
      current_user_org: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
  };
};
