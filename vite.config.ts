// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

import { applyOfficialSupabaseEnv } from "./env.official.mjs";

// Garante que o build use o Supabase oficial do controle de acesso.
applyOfficialSupabaseEnv();

// Versão vinda do package.json — apenas informativa (nunca compõe identidade).
const pkg = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  },
});
