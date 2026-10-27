export const STATUSES = ["pendente", "autorizada", "bloqueada"] as const;
export type InstallationStatus = (typeof STATUSES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Letters (any language), numbers, spaces and common punctuation. No control chars, no < >.
const NAME_RE = /^[\p{L}\p{N} ._\-()#/&+,:'@]+$/u;

export class ValidationError extends Error {}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function only(body: unknown, allowed: string[]): Record<string, unknown> {
  if (!isPlainObject(body)) throw new ValidationError("Corpo da requisição inválido.");
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) throw new ValidationError(`Campo não permitido: ${k.slice(0, 40)}`);
  }
  return body;
}

export function parseInstallationId(v: unknown): string {
  if (typeof v !== "string" || v.length > 36 || !UUID_RE.test(v.trim())) {
    throw new ValidationError("installation_id inválido (UUID esperado).");
  }
  return v.trim().toLowerCase();
}

export function parseName(v: unknown): string {
  if (typeof v !== "string") throw new ValidationError("name obrigatório.");
  const name = v.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 80)
    throw new ValidationError("name deve ter 1 a 80 caracteres.");
  if (!NAME_RE.test(name)) throw new ValidationError("name contém caracteres inválidos.");
  return name;
}

export function parseStatus(v: unknown): InstallationStatus {
  if (typeof v !== "string" || !(STATUSES as readonly string[]).includes(v)) {
    throw new ValidationError("status inválido.");
  }
  return v as InstallationStatus;
}

export function parseRegister(body: unknown) {
  const b = only(body, ["installation_id", "name"]);
  return { installation_id: parseInstallationId(b["installation_id"]), name: parseName(b["name"]) };
}

export function parseStatusChange(body: unknown) {
  const b = only(body, ["installation_id", "status"]);
  const status = parseStatus(b["status"]);
  if (status === "pendente") throw new ValidationError("status inválido.");
  return { installation_id: parseInstallationId(b["installation_id"]), status };
}

export function parseRename(body: unknown) {
  const b = only(body, ["installation_id", "name"]);
  return { installation_id: parseInstallationId(b["installation_id"]), name: parseName(b["name"]) };
}

export function parseLogin(body: unknown) {
  const b = only(body, ["password"]);
  if (typeof b["password"] !== "string" || b["password"].length < 1 || b["password"].length > 256) {
    throw new ValidationError("Senha inválida.");
  }
  return { password: b["password"] };
}
