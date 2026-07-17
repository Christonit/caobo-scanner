import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";
import type { Database } from "~/types/database.types";

// Service-role Supabase client for server routes that must bypass RLS
// (e.g. inviting users, reading auth.users emails). Never expose this
// client or its key to the browser.
export function useSupabaseAdmin(event: H3Event): SupabaseClient<Database> {
  const config = useRuntimeConfig(event);
  const url =
    (config.public.supabase as { url?: string } | undefined)?.url ||
    process.env.NUXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = config.supabaseSecretKey as string;

  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Supabase service role no está configurado (NUXT_SUPABASE_SECRET_KEY).",
    });
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
