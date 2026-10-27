/**
 * Build de EMPACOTAMENTO (Electron) — usa a aplicação React principal em `src`.
 * O build web/SSR (TanStack Start) continua exclusivamente em vite.config.ts.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { createRequire } from "node:module";

import { applyOfficialSupabaseEnv } from "./env.official.mjs";

// Garante que o .exe use o Supabase oficial do controle de acesso.
applyOfficialSupabaseEnv();

// Versão exibida/telemetrada: vem do package.json. Nunca compõe a identidade
// da instalação — atualizar a versão não cria uma nova instalação.
const pkg = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  // Raiz do build desktop: apenas o HTML de montagem. Todo o código React
  // continua sendo o oficial em `src` (nenhuma segunda aplicação).
  root: path.resolve(__dirname, "desktop"),
  base: "./",
  // Variáveis VITE_* vêm da raiz do projeto, não da pasta `desktop`.
  envDir: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: path.resolve(__dirname, "dist-electron"),
    emptyOutDir: true,
    target: "chrome124",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
