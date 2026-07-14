// Minimal hand-rolled type that mirrors the live Supabase schema so the
// rest of the codebase has a Database type to import. Regenerate any time
// the DB changes:
//
//   supabase gen types typescript --linked > types/database.types.ts

// A single column/field definition stored inside `templates.fields` (jsonb).
export type TemplateField = {
  name: string;
  description: string;
};

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
      client_documents: {
        Row: {
          id: string;
          client_id: string;
          document_name: string;
          // Free-text, document-level context (e.g. notes on how to
          // classify this whole "Gastos" group) fed to the LLM alongside
          // the per-attribute descriptions.
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          document_name: string;
          comment?: string | null;
        };
        Update: {
          document_name?: string;
          comment?: string | null;
          updated_at?: string;
        };
      };
      document_attributes: {
        Row: {
          id: number;
          client_document_id: string;
          document_type: string;
          document_id: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          client_document_id: string;
          document_type: string;
          document_id?: number | null;
          description?: string | null;
        };
        Update: {
          document_type?: string;
          document_id?: number | null;
          description?: string | null;
        };
      };
      client_business_rules: {
        Row: {
          id: string;
          client_id: string;
          rule_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          rule_name: string;
        };
        Update: {
          rule_name?: string;
          updated_at?: string;
        };
      };
      business_rule_attributes: {
        Row: {
          id: number;
          client_business_rule_id: string;
          rule_type: string;
          rule_value: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          client_business_rule_id: string;
          rule_type: string;
          rule_value?: string | null;
          description?: string | null;
        };
        Update: {
          rule_type?: string;
          rule_value?: string | null;
          description?: string | null;
        };
      };
      templates: {
        Row: {
          id: string;
          // Templates are intentionally NOT tied to an organization or
          // client — they are reusable extraction definitions. The column
          // exists in the DB but is nullable and left unset by the app.
          organization_id: string | null;
          created_by: string | null;
          name: string;
          description: string | null;
          is_system: boolean;
          document_type: string;
          // Ordered list of columns the extractor should produce.
          fields: TemplateField[];
          ai_instructions: string | null;
          ai_model: string | null;
          reference_file_url: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          created_by?: string | null;
          name: string;
          description?: string | null;
          is_system?: boolean;
          document_type?: string;
          fields: TemplateField[];
          ai_instructions?: string | null;
          ai_model?: string | null;
          reference_file_url?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          document_type?: string;
          fields?: TemplateField[];
          ai_instructions?: string | null;
          ai_model?: string | null;
          reference_file_url?: string | null;
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
