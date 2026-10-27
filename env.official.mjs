/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * SUPABASE OFICIAL DO CONTROLE DE ACESSO — origem única da configuração.
 *
 * As duas variáveis oficiais ficam em `.env.production` (versionado, somente
 * chave PUBLICÁVEL). Este módulo aplica esses valores ao ambiente de build
 * ANTES do Vite montar `import.meta.env`, garantindo que o aplicativo e o
 * .exe apontem sempre para o Supabase oficial, mesmo quando a máquina de
 * build tiver outras variáveis herdadas do ambiente.
 *
 * Nunca há service_role, sb_secret ou senha do banco aqui.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const OFICIAIS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID"];

function parse(arquivo) {
  const valores = {};
  let texto = "";
  try {
    texto = readFileSync(path.join(RAIZ, arquivo), "utf8");
  } catch {
    return valores;
  }
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const i = limpa.indexOf("=");
    if (i <= 0) continue;
    valores[limpa.slice(0, i).trim()] = limpa.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return valores;
}

export function applyOfficialSupabaseEnv() {
  const valores = parse(".env.production");
  for (const nome of OFICIAIS) {
    if (valores[nome]) process.env[nome] = valores[nome];
  }
  return valores;
}
