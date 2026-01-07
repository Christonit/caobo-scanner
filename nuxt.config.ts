// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false, // SPA mode required for Electron
  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss"],
  app: {
    baseURL: process.env.NODE_ENV === "production" ? "./" : "/",
  },
  vite: {
    optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      },
    },
    server: {
      fs: {
        strict: false,
      },
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.nuxt/**",
          "**/.output/**",
        ],
      },
    },
    build: {
      target: "esnext",
    },
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  ignore: [
    "**/node_modules/**",
    "**/.git/**",
    "**/.output/**",
    "**/python_backend/**",
  ],
});
