// Single server-side module responsible for talking to Supabase (PostgREST).
// Never import this from browser code.
import type { InstallationStatus } from "./validation";

export type MonitEnv = Record<string, string | undefined>;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Installation {
  id: string;
  installation_id: string;
  name: string;
  status: InstallationStatus;
  created_at: string;
  updated_at: string;
}

export class ServiceUnavailableError extends Error {}
export class UpstreamError extends Error {}
export class UpstreamTimeoutError extends Error {}
export class NotFoundError extends Error {}

export interface SupabaseConfig {
  url: string;
  key: string;
}

/** Resolves config. Rejects missing keys and publishable keys (never used for admin). */
export function getSupabaseConfig(env: MonitEnv): SupabaseConfig {
  const url = (env["MONIT_SUPABASE_URL"] || env["SUPABASE_URL"] || "").trim();
  const key = (
    env["MONIT_SUPABASE_SERVICE_ROLE_KEY"] ||
    env["SUPABASE_SERVICE_ROLE_KEY"] ||
    ""
  ).trim();
  if (!url || !/^https:\/\//.test(url) || !key) throw new ServiceUnavailableError();
  if (key.startsWith("sb_publishable_")) throw new ServiceUnavailableError();
  return { url: url.replace(/\/+$/, ""), key };
}

/** sb_secret_* keys are opaque: send only `apikey`. Legacy JWT keys also go as Bearer. */
export function buildHeaders(key: string): Record<string, string> {
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) h["Authorization"] = `Bearer ${key}`;
  return h;
}

const TIMEOUT_MS = 10_000;

export function createSupabase(env: MonitEnv, fetchImpl: FetchLike = fetch) {
  const cfg = getSupabaseConfig(env);
  const base = `${cfg.url}/rest/v1/installations`;

  async function call(
    path: string,
    init: RequestInit & { prefer?: string },
  ): Promise<Installation[]> {
    const headers: Record<string, string> = { ...buildHeaders(cfg.key) };
    if (init.prefer) headers["Prefer"] = init.prefer;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(base + path, {
        method: init.method ?? "GET",
        body: init.body ?? null,
        headers,
        signal: ctrl.signal,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw new UpstreamTimeoutError();
      throw new UpstreamError();
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw new ServiceUnavailableError();
    if (!res.ok) throw new UpstreamError();
    const text = await res.text();
    return text ? (JSON.parse(text) as Installation[]) : [];
  }

  const cols = "select=id,installation_id,name,status,created_at,updated_at";

  return {
    list: () => call(`?${cols}&order=created_at.desc&limit=5000`, { method: "GET" }),

    /** Atomic upsert. Only name/updated_at change on conflict; status & created_at preserved. */
    async register(installation_id: string, name: string): Promise<Installation> {
      const rows = await call(`?on_conflict=installation_id&${cols}`, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({ installation_id, name, updated_at: new Date().toISOString() }),
      });
      if (!rows[0]) throw new UpstreamError();
      return rows[0];
    },

    async update(installation_id: string, patch: Partial<Pick<Installation, "name" | "status">>) {
      const rows = await call(
        `?installation_id=eq.${encodeURIComponent(installation_id)}&${cols}`,
        {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        },
      );
      if (!rows[0]) throw new NotFoundError();
      return rows[0];
    },

    /** Hard delete (no blacklist): the same installation_id can register again as pendente. */
    async remove(installation_id: string): Promise<void> {
      const rows = await call(
        `?installation_id=eq.${encodeURIComponent(installation_id)}&select=installation_id`,
        { method: "DELETE", prefer: "return=representation" },
      );
      if (!rows[0]) throw new NotFoundError();
    },

    /** Deletes every row, or only rows of one status when `status` is given. */
    async removeAll(status?: InstallationStatus): Promise<number> {
      const filter = status
        ? `status=eq.${encodeURIComponent(status)}`
        : `installation_id=not.is.null`;
      const rows = await call(`?${filter}&select=installation_id`, {
        method: "DELETE",
        prefer: "return=representation",
      });
      return rows.length;
    },
  };
}
