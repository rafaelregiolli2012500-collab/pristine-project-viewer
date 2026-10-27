// Central API dispatcher. Pure: receives Request + env (+ optional fetch) and returns Response.
import {
  createSupabase,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
  UpstreamTimeoutError,
  type FetchLike,
  type MonitEnv,
} from "./supabase";
import {
  parseInstallationId,
  parseLogin,
  parseRegister,
  parseRename,
  parseStatus,
  parseStatusChange,
  ValidationError,
} from "./validation";
import {
  clearedCookie,
  createToken,
  passwordMatches,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  verifyToken,
} from "./session";
import { createRateLimiter } from "./rateLimit";

const loginLimiter = createRateLimiter(10);
const publicLimiter = createRateLimiter(30);

export interface ApiDeps {
  fetch?: FetchLike;
  loginLimit?: (key: string) => boolean;
  publicLimit?: (key: string) => boolean;
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
const err = (status: number, message: string) => json(status, { error: message });

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 4096) throw new ValidationError("Corpo muito grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("JSON inválido.");
  }
}

function sessionTtl(env: MonitEnv): number {
  const n = Number(env["ADMIN_SESSION_TTL_SECONDS"]);
  return Number.isFinite(n) && n >= 300 && n <= 60 * 60 * 24 * 30 ? Math.floor(n) : 60 * 60 * 12;
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

async function isAdmin(req: Request, env: MonitEnv): Promise<boolean> {
  const secret = env["ADMIN_SESSION_SECRET"];
  if (!secret || secret.length < 16) return false;
  return verifyToken(secret, readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

export async function handleApi(
  req: Request,
  env: MonitEnv,
  deps: ApiDeps = {},
): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();
  const ip = clientIp(req);
  const db = () => createSupabase(env, deps.fetch ?? fetch);

  try {
    if (path === "/api/health" && method === "GET") return json(200, { status: "ok" });

    if (path === "/api/public/monit/installations") {
      if (method !== "POST") return err(405, "Método não permitido.");
      if (!(deps.publicLimit ?? publicLimiter)(ip))
        return err(429, "Muitas requisições. Tente novamente em instantes.");
      const input = parseRegister(await readJson(req));
      const row = await db().register(input.installation_id, input.name);
      return json(200, {
        installation_id: row.installation_id,
        name: row.name,
        status: row.status,
      });
    }

    if (path.startsWith("/api/admin/")) {
      if ((method === "POST" || method === "DELETE") && !sameOrigin(req))
        return err(403, "Origem não permitida.");

      if (path === "/api/admin/login" && method === "POST") {
        if (!(deps.loginLimit ?? loginLimiter)(ip))
          return err(429, "Muitas tentativas. Aguarde um minuto.");
        const { password } = parseLogin(await readJson(req));
        const expected = env["MONIT_ADMIN_PASSWORD"];
        const secret = env["ADMIN_SESSION_SECRET"];
        if (!expected || !secret || secret.length < 16)
          return err(503, "Serviço administrativo indisponível.");
        if (!(await passwordMatches(password, expected))) return err(401, "Senha incorreta.");
        const ttl = sessionTtl(env);
        return json(
          200,
          { authenticated: true },
          { "Set-Cookie": sessionCookie(await createToken(secret, ttl), ttl) },
        );
      }

      if (path === "/api/admin/logout" && method === "POST") {
        return json(200, { authenticated: false }, { "Set-Cookie": clearedCookie() });
      }

      if (path === "/api/admin/session" && method === "GET") {
        return json(200, { authenticated: await isAdmin(req, env) });
      }

      if (!(await isAdmin(req, env))) return err(401, "Não autenticado.");

      if (path === "/api/admin/installations" && method === "GET") {
        return json(200, { installations: await db().list() });
      }
      if (path === "/api/admin/installations/status" && method === "POST") {
        const input = parseStatusChange(await readJson(req));
        return json(200, {
          installation: await db().update(input.installation_id, { status: input.status }),
        });
      }
      if (path === "/api/admin/installations/name" && method === "POST") {
        const input = parseRename(await readJson(req));
        return json(200, {
          installation: await db().update(input.installation_id, { name: input.name }),
        });
      }

      if (path === "/api/admin/installations" && method === "DELETE") {
        const statusParam = new URL(req.url).searchParams.get("status");
        const status = statusParam === null ? undefined : parseStatus(statusParam);
        return json(200, { deleted: await db().removeAll(status) });
      }
      const del = path.match(/^\/api\/admin\/installations\/([^/]+)$/);
      if (del && method === "DELETE") {
        const id = parseInstallationId(decodeURIComponent(del[1] ?? ""));
        await db().remove(id);
        return json(200, { deleted: 1 });
      }
    }

    return err(404, "Rota não encontrada.");
  } catch (e) {
    if (e instanceof ValidationError) return err(400, e.message);
    if (e instanceof NotFoundError) return err(404, "Instalação não encontrada.");
    if (e instanceof ServiceUnavailableError)
      return err(503, "Serviço administrativo indisponível.");
    if (e instanceof UpstreamTimeoutError) return err(408, "Tempo de resposta excedido.");
    if (e instanceof UpstreamError) return err(502, "Falha ao comunicar com o banco de dados.");
    console.error("[monit-api] unexpected error");
    return err(500, "Erro interno.");
  }
}
