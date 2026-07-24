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

// Allowed values for public.activity_events.action (kept in sync with the
// CHECK constraint in the activity_events migration).
export type ActivityAction =
  | "client_created"
  | "client_updated"
  | "document_added"
  | "document_updated"
  | "document_removed"
  | "annotation_added"
  | "annotation_updated"
  | "annotation_removed"
  | "suplidor_added"
  | "suplidor_updated"
  | "suplidor_removed"
  | "gastos_analyzed"
  | "gastos_exported"
  | "suplidores_analyzed"
  | "suplidores_stored"
  | "suplidores_exported"
  | "rows_deferred"
  | "export_rated";

// Matches public.api_token_usage.thinking_level and the UI selector.
export type ThinkingLevel = "rapido" | "moderado" | "profundo";

// Lifecycle of an effectiveness_sessions row (see the effectiveness_metrics
// migration CHECK constraint).
export type EffectivenessSessionStatus =
  | "in_progress"
  | "exported"
  | "discarded"
  | "abandoned";

// Binary customer-satisfaction answer captured after the first Procesar.
export type EffectivenessCsat = "good" | "bad";

// Why a critical field failed on the first AI pass. Counted programmatically
// from the extractor output before human edits.
export type EffectivenessFailureReason =
  | "empty"
  | "incomplete"
  | "invalid_length"
  | "required_missing";

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
          role: "admin" | "collaborator";
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role?: "admin" | "collaborator";
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          role?: "admin" | "collaborator";
          full_name?: string | null;
          avatar_url?: string | null;
        };
      };
      // Org-less global admins. Membership is managed only via the service
      // role (setup scripts / dashboard) — never inserted/updated from the
      // browser client.
      superadmins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
      };
      organization_members: {
        Row: {
          user_id: string;
          organization_id: string;
          role: "admin" | "collaborator";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          organization_id: string;
          role?: "admin" | "collaborator";
        };
        Update: {
          role?: "admin" | "collaborator";
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
          // ERP catalogs used during extraction (configured on client detail).
          concepto_document_id: string | null;
          tipo_de_pago_document_id: string | null;
          tipo_de_gasto_context_document_id: string | null;
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
          concepto_document_id?: string | null;
          tipo_de_pago_document_id?: string | null;
          tipo_de_gasto_context_document_id?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          tax_payer_id?: string | null;
          email?: string | null;
          notes?: string | null;
          concepto_document_id?: string | null;
          tipo_de_pago_document_id?: string | null;
          tipo_de_gasto_context_document_id?: string | null;
          updated_at?: string;
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
      organization_business_rules: {
        Row: {
          id: string;
          organization_id: string;
          rule_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          rule_name: string;
        };
        Update: {
          rule_name?: string;
          updated_at?: string;
        };
      };
      organization_business_rule_attributes: {
        Row: {
          id: number;
          organization_business_rule_id: string;
          rule_type: string;
          rule_value: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organization_business_rule_id: string;
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
      client_tax_column_mappings: {
        Row: {
          id: string;
          client_id: string;
          // Which "Impuesto N" (1-5) column of the export template each
          // amount is written into. null means "do not export this amount".
          itbis_column: number | null;
          selectivo_column: number | null;
          descuento_column: number | null;
          propina_column: number | null;
          otros_impuestos_column: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          itbis_column?: number | null;
          selectivo_column?: number | null;
          descuento_column?: number | null;
          propina_column?: number | null;
          otros_impuestos_column?: number | null;
        };
        Update: {
          itbis_column?: number | null;
          selectivo_column?: number | null;
          descuento_column?: number | null;
          propina_column?: number | null;
          otros_impuestos_column?: number | null;
          updated_at?: string;
        };
      };
      client_suplidores: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          documento: string | null;
          tipo_de_factura: string | null;
          registered_on_platform: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          documento?: string | null;
          tipo_de_factura?: string | null;
          registered_on_platform?: boolean;
        };
        Update: {
          nombre?: string;
          documento?: string | null;
          tipo_de_factura?: string | null;
          registered_on_platform?: boolean;
          updated_at?: string;
        };
      };
      activity_events: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          action: ActivityAction;
          client_id: string | null;
          target_label: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          action: ActivityAction;
          client_id?: string | null;
          target_label?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          target_label?: string | null;
          metadata?: Record<string, unknown>;
        };
      };
      api_token_usage: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          client_id: string | null;
          thinking_level: ThinkingLevel;
          model: string;
          source: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          input_cost_per_1m: number;
          output_cost_per_1m: number;
          cost_usd: number;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          client_id?: string | null;
          thinking_level: ThinkingLevel;
          model: string;
          source: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          input_cost_per_1m?: number;
          output_cost_per_1m?: number;
          cost_usd?: number;
          metadata?: Record<string, unknown>;
        };
        Update: {
          metadata?: Record<string, unknown>;
        };
      };
      effectiveness_sessions: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          user_email: string | null;
          client_id: string | null;
          client_name: string | null;
          status: EffectivenessSessionStatus;
          started_at: string;
          ended_at: string | null;
          first_process_at: string | null;
          first_process_ai_ms: number | null;
          total_ai_ms: number;
          page_count: number;
          reanalysis_count: number;
          csat: EffectivenessCsat | null;
          csat_at: string | null;
          csat_comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          user_id?: string | null;
          user_email?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          status?: EffectivenessSessionStatus;
          started_at?: string;
          ended_at?: string | null;
          first_process_at?: string | null;
          first_process_ai_ms?: number | null;
          total_ai_ms?: number;
          page_count?: number;
          reanalysis_count?: number;
          csat?: EffectivenessCsat | null;
          csat_at?: string | null;
          csat_comment?: string | null;
        };
        Update: {
          client_id?: string | null;
          client_name?: string | null;
          status?: EffectivenessSessionStatus;
          ended_at?: string | null;
          first_process_at?: string | null;
          first_process_ai_ms?: number | null;
          total_ai_ms?: number;
          page_count?: number;
          reanalysis_count?: number;
          csat?: EffectivenessCsat | null;
          csat_at?: string | null;
          csat_comment?: string | null;
          updated_at?: string;
        };
      };
      effectiveness_runs: {
        Row: {
          id: string;
          session_id: string;
          organization_id: string;
          user_id: string | null;
          client_id: string | null;
          run_index: number;
          is_reanalysis: boolean;
          pages_in_run: number;
          ai_duration_ms: number | null;
          pages_ok: number;
          pages_with_failures: number;
          correctness_pct: number | null;
          field_failures: Record<string, number>;
          failure_reasons: Record<string, Record<string, number>>;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          organization_id: string;
          user_id?: string | null;
          client_id?: string | null;
          run_index: number;
          is_reanalysis?: boolean;
          pages_in_run?: number;
          ai_duration_ms?: number | null;
          pages_ok?: number;
          pages_with_failures?: number;
          correctness_pct?: number | null;
          field_failures?: Record<string, number>;
          failure_reasons?: Record<string, Record<string, number>>;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          pages_ok?: number;
          pages_with_failures?: number;
          correctness_pct?: number | null;
          field_failures?: Record<string, number>;
          failure_reasons?: Record<string, Record<string, number>>;
          finished_at?: string | null;
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
      switch_organization: {
        Args: { p_organization_id: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
      };
      is_superadmin: {
        Args: { uid?: string };
        Returns: boolean;
      };
    };
  };
};
