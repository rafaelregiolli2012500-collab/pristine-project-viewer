// Browser-side helper: only calls our own /api endpoints. Never talks to Supabase.
export type Status = "pendente" | "autorizada" | "bloqueada";
export interface Installation {
  id: string;
  installation_id: string;
  name: string;
  status: Status;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Erro inesperado.");
  return data as T;
}

export const api = {
  session: () => call<{ authenticated: boolean }>("/api/admin/session"),
  login: (password: string) => call<{ authenticated: boolean }>("/api/admin/login", { password }),
  logout: () => call<{ authenticated: boolean }>("/api/admin/logout", {}),
  list: () => call<{ installations: Installation[] }>("/api/admin/installations"),
  setStatus: (installation_id: string, status: "autorizada" | "bloqueada") =>
    call<{ installation: Installation }>("/api/admin/installations/status", {
      installation_id,
      status,
    }),
  rename: (installation_id: string, name: string) =>
    call<{ installation: Installation }>("/api/admin/installations/name", {
      installation_id,
      name,
    }),
  remove: (installation_id: string) =>
    call<{ deleted: number }>(
      `/api/admin/installations/${encodeURIComponent(installation_id)}`,
      undefined,
      "DELETE",
    ),
  removeAll: (status?: Status) =>
    call<{ deleted: number }>(
      `/api/admin/installations${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      undefined,
      "DELETE",
    ),
};
