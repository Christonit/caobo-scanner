import { serverSupabaseUser } from "#supabase/server";

// Exposes the AI models the app is configured to use so the Settings page can
// display them. Model names are not secret; the API key never leaves the
// server.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado" });
  }

  const config = useRuntimeConfig(event);

  return {
    models: [
      {
        id: "template-analysis",
        label: "Análisis de plantillas",
        description:
          "Extrae columnas e instrucciones a partir de un archivo de referencia.",
        provider: "Google Gemini",
        model: (config.templateAnalysisModel as string) || null,
        envVar: "TEMPLATE_ANALYSIS_MODEL",
      },
      {
        id: "invoice-analysis",
        label: "Extracción de facturas",
        description:
          "Lee recibos y facturas para extraer los datos contables.",
        provider: "Google Gemini",
        model: (config.invoiceAnalysisModel as string) || null,
        envVar: "INVOICE_ANALYSIS_MODEL",
      },
    ],
    apiKeyConfigured: Boolean(config.geminiApiKey),
  };
});
