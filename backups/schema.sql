


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_action" AS ENUM (
    'created',
    'updated',
    'deleted',
    'restored',
    'exported',
    'field_edited',
    'status_changed'
);


ALTER TYPE "public"."activity_action" OWNER TO "postgres";


CREATE TYPE "public"."activity_entity_type" AS ENUM (
    'document',
    'template',
    'client',
    'report',
    'export'
);


ALTER TYPE "public"."activity_entity_type" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text" DEFAULT NULL::"text", "p_full_name" "text" DEFAULT NULL::"text") RETURNS "public"."organizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_org  public.organizations;
  v_slug text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.user_profiles where id = v_user) then
    raise exception 'user already belongs to an organization'
      using errcode = '23505';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'organization name must be at least 2 characters'
      using errcode = '22023';
  end if;

  v_slug := coalesce(
    nullif(trim(p_slug), ''),
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
  );
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;

  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (name, slug)
  values (trim(p_name), v_slug)
  returning * into v_org;

  insert into public.user_profiles (id, organization_id, role, full_name)
  values (v_user, v_org.id, 'admin', nullif(trim(p_full_name), ''));

  return v_org;
end;
$$;


ALTER FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text", "p_full_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_org"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select organization_id
  from public.user_profiles
  where id = (select auth.uid())
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "performed_by" "uuid",
    "entity_type" "public"."activity_entity_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "public"."activity_action" NOT NULL,
    "diff" "jsonb",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_rule_attributes" (
    "id" bigint NOT NULL,
    "client_business_rule_id" "uuid" NOT NULL,
    "rule_type" "text" NOT NULL,
    "rule_value" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_rule_attributes" OWNER TO "postgres";


ALTER TABLE "public"."business_rule_attributes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."business_rule_attributes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."client_business_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_business_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "document_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_suplidores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "documento" "text",
    "tipo_de_factura" "text",
    "registered_on_platform" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_suplidores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_tax_column_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "itbis_column" smallint,
    "selectivo_column" smallint,
    "descuento_column" smallint,
    "propina_column" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_tax_column_mappings_descuento_column_check" CHECK ((("descuento_column" >= 1) AND ("descuento_column" <= 5))),
    CONSTRAINT "client_tax_column_mappings_itbis_column_check" CHECK ((("itbis_column" >= 1) AND ("itbis_column" <= 5))),
    CONSTRAINT "client_tax_column_mappings_propina_column_check" CHECK ((("propina_column" >= 1) AND ("propina_column" <= 5))),
    CONSTRAINT "client_tax_column_mappings_selectivo_column_check" CHECK ((("selectivo_column" >= 1) AND ("selectivo_column" <= 5)))
);


ALTER TABLE "public"."client_tax_column_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "tax_payer_id" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_attributes" (
    "id" bigint NOT NULL,
    "client_document_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_id" integer,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_attributes" OWNER TO "postgres";


ALTER TABLE "public"."document_attributes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."document_attributes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "template_id" "uuid",
    "report_id" "uuid",
    "created_by" "uuid",
    "source_file_url" "text",
    "source_file_name" "text",
    "source_file_type" "text",
    "source_file_size" integer,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "export_file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "document_type" "text" DEFAULT 'invoice'::"text" NOT NULL,
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ai_instructions" "text",
    "ai_model" "text",
    "reference_file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_rule_attributes"
    ADD CONSTRAINT "business_rule_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_business_rules"
    ADD CONSTRAINT "client_business_rules_client_name_unique" UNIQUE ("client_id", "rule_name");



ALTER TABLE ONLY "public"."client_business_rules"
    ADD CONSTRAINT "client_business_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_client_name_unique" UNIQUE ("client_id", "document_name");



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_suplidores"
    ADD CONSTRAINT "client_suplidores_client_documento_unique" UNIQUE ("client_id", "documento");



ALTER TABLE ONLY "public"."client_suplidores"
    ADD CONSTRAINT "client_suplidores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_tax_column_mappings"
    ADD CONSTRAINT "client_tax_column_mappings_client_unique" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_tax_column_mappings"
    ADD CONSTRAINT "client_tax_column_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_attributes"
    ADD CONSTRAINT "document_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "business_rule_attributes_client_business_rule_id_idx" ON "public"."business_rule_attributes" USING "btree" ("client_business_rule_id");



CREATE INDEX "client_business_rules_client_id_idx" ON "public"."client_business_rules" USING "btree" ("client_id");



CREATE INDEX "client_documents_client_id_idx" ON "public"."client_documents" USING "btree" ("client_id");



CREATE INDEX "client_suplidores_client_id_idx" ON "public"."client_suplidores" USING "btree" ("client_id");



CREATE UNIQUE INDEX "client_suplidores_client_nombre_no_doc_idx" ON "public"."client_suplidores" USING "btree" ("client_id", "nombre") WHERE ("documento" IS NULL);



CREATE INDEX "client_tax_column_mappings_client_id_idx" ON "public"."client_tax_column_mappings" USING "btree" ("client_id");



CREATE INDEX "document_attributes_client_document_id_idx" ON "public"."document_attributes" USING "btree" ("client_document_id");



CREATE INDEX "idx_activity_entity" ON "public"."activity_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_activity_org" ON "public"."activity_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_activity_time" ON "public"."activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_user" ON "public"."activity_logs" USING "btree" ("performed_by");



CREATE INDEX "idx_clients_org" ON "public"."clients" USING "btree" ("organization_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_documents_client" ON "public"."documents" USING "btree" ("client_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_documents_data" ON "public"."documents" USING "gin" ("data");



CREATE INDEX "idx_documents_org" ON "public"."documents" USING "btree" ("organization_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_documents_report" ON "public"."documents" USING "btree" ("report_id");



CREATE INDEX "idx_documents_template" ON "public"."documents" USING "btree" ("template_id");



CREATE INDEX "idx_reports_client" ON "public"."reports" USING "btree" ("client_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_reports_org" ON "public"."reports" USING "btree" ("organization_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_templates_org" ON "public"."templates" USING "btree" ("organization_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_user_profiles_org" ON "public"."user_profiles" USING "btree" ("organization_id");



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_templates_updated_at" BEFORE UPDATE ON "public"."templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_rule_attributes"
    ADD CONSTRAINT "business_rule_attributes_client_business_rule_id_fkey" FOREIGN KEY ("client_business_rule_id") REFERENCES "public"."client_business_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_business_rules"
    ADD CONSTRAINT "client_business_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_suplidores"
    ADD CONSTRAINT "client_suplidores_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_tax_column_mappings"
    ADD CONSTRAINT "client_tax_column_mappings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."document_attributes"
    ADD CONSTRAINT "document_attributes_client_document_id_fkey" FOREIGN KEY ("client_document_id") REFERENCES "public"."client_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_org_isolation" ON "public"."activity_logs" USING (("organization_id" = "public"."current_org_id"()));



ALTER TABLE "public"."business_rule_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_rule_attributes_delete_org" ON "public"."business_rule_attributes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_business_rules" "cbr"
     JOIN "public"."clients" "c" ON (("c"."id" = "cbr"."client_id")))
  WHERE (("cbr"."id" = "business_rule_attributes"."client_business_rule_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "business_rule_attributes_insert_org" ON "public"."business_rule_attributes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."client_business_rules" "cbr"
     JOIN "public"."clients" "c" ON (("c"."id" = "cbr"."client_id")))
  WHERE (("cbr"."id" = "business_rule_attributes"."client_business_rule_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "business_rule_attributes_select_org" ON "public"."business_rule_attributes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_business_rules" "cbr"
     JOIN "public"."clients" "c" ON (("c"."id" = "cbr"."client_id")))
  WHERE (("cbr"."id" = "business_rule_attributes"."client_business_rule_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "business_rule_attributes_update_org" ON "public"."business_rule_attributes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_business_rules" "cbr"
     JOIN "public"."clients" "c" ON (("c"."id" = "cbr"."client_id")))
  WHERE (("cbr"."id" = "business_rule_attributes"."client_business_rule_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."client_business_rules" "cbr"
     JOIN "public"."clients" "c" ON (("c"."id" = "cbr"."client_id")))
  WHERE (("cbr"."id" = "business_rule_attributes"."client_business_rule_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."client_business_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_business_rules_delete_org" ON "public"."client_business_rules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_business_rules"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_business_rules_insert_org" ON "public"."client_business_rules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_business_rules"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_business_rules_select_org" ON "public"."client_business_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_business_rules"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_business_rules_update_org" ON "public"."client_business_rules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_business_rules"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_business_rules"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_documents_delete_org" ON "public"."client_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_documents_insert_org" ON "public"."client_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_documents_select_org" ON "public"."client_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_documents_update_org" ON "public"."client_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."client_suplidores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_suplidores_delete_org" ON "public"."client_suplidores" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_suplidores"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_suplidores_insert_org" ON "public"."client_suplidores" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_suplidores"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_suplidores_select_org" ON "public"."client_suplidores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_suplidores"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_suplidores_update_org" ON "public"."client_suplidores" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_suplidores"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_suplidores"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."client_tax_column_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_tax_column_mappings_delete_org" ON "public"."client_tax_column_mappings" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tax_column_mappings"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_tax_column_mappings_insert_org" ON "public"."client_tax_column_mappings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tax_column_mappings"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_tax_column_mappings_select_org" ON "public"."client_tax_column_mappings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tax_column_mappings"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "client_tax_column_mappings_update_org" ON "public"."client_tax_column_mappings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tax_column_mappings"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tax_column_mappings"."client_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete_org" ON "public"."clients" FOR DELETE TO "authenticated" USING (("organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")));



CREATE POLICY "clients_insert_org" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")));



CREATE POLICY "clients_select_org" ON "public"."clients" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")));



CREATE POLICY "clients_update_org" ON "public"."clients" FOR UPDATE TO "authenticated" USING (("organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))) WITH CHECK (("organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")));



ALTER TABLE "public"."document_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_attributes_delete_org" ON "public"."document_attributes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_documents" "cd"
     JOIN "public"."clients" "c" ON (("c"."id" = "cd"."client_id")))
  WHERE (("cd"."id" = "document_attributes"."client_document_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "document_attributes_insert_org" ON "public"."document_attributes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."client_documents" "cd"
     JOIN "public"."clients" "c" ON (("c"."id" = "cd"."client_id")))
  WHERE (("cd"."id" = "document_attributes"."client_document_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "document_attributes_select_org" ON "public"."document_attributes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_documents" "cd"
     JOIN "public"."clients" "c" ON (("c"."id" = "cd"."client_id")))
  WHERE (("cd"."id" = "document_attributes"."client_document_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



CREATE POLICY "document_attributes_update_org" ON "public"."document_attributes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."client_documents" "cd"
     JOIN "public"."clients" "c" ON (("c"."id" = "cd"."client_id")))
  WHERE (("cd"."id" = "document_attributes"."client_document_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."client_documents" "cd"
     JOIN "public"."clients" "c" ON (("c"."id" = "cd"."client_id")))
  WHERE (("cd"."id" = "document_attributes"."client_document_id") AND ("c"."organization_id" = ( SELECT "public"."current_user_org"() AS "current_user_org"))))));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_org_isolation" ON "public"."documents" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "org_isolation" ON "public"."organizations" USING (("id" = "public"."current_org_id"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_org_isolation" ON "public"."reports" USING (("organization_id" = "public"."current_org_id"()));



ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "templates_org_isolation" ON "public"."templates" USING ((("organization_id" = "public"."current_org_id"()) OR ("organization_id" IS NULL)));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_org_isolation" ON "public"."user_profiles" USING (("organization_id" = "public"."current_org_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text", "p_full_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization"("p_name" "text", "p_slug" "text", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_org"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."business_rule_attributes" TO "anon";
GRANT ALL ON TABLE "public"."business_rule_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."business_rule_attributes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."business_rule_attributes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."business_rule_attributes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."business_rule_attributes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."client_business_rules" TO "anon";
GRANT ALL ON TABLE "public"."client_business_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."client_business_rules" TO "service_role";



GRANT ALL ON TABLE "public"."client_documents" TO "anon";
GRANT ALL ON TABLE "public"."client_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."client_documents" TO "service_role";



GRANT ALL ON TABLE "public"."client_suplidores" TO "anon";
GRANT ALL ON TABLE "public"."client_suplidores" TO "authenticated";
GRANT ALL ON TABLE "public"."client_suplidores" TO "service_role";



GRANT ALL ON TABLE "public"."client_tax_column_mappings" TO "anon";
GRANT ALL ON TABLE "public"."client_tax_column_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."client_tax_column_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."document_attributes" TO "anon";
GRANT ALL ON TABLE "public"."document_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."document_attributes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_attributes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_attributes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_attributes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































