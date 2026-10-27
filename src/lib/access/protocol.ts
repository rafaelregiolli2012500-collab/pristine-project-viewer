/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * CONTROLE DE ACESSO — contrato único do aplicativo.
 *
 * Arquitetura: MONIT.CAMPO.EXE → banco (função controlada) → installations.
 * Não existe API intermediária. Nenhum dado operacional é enviado.
 */

export const ACCESS_TIMEOUT_MS = 8000;

export type InstallationStatus = "pendente" | "autorizada" | "bloqueada";
export type CredentialStatus = "ativo" | "bloqueado";

export function isInstallationStatus(value: unknown): value is InstallationStatus {
  return value === "pendente" || value === "autorizada" || value === "bloqueada";
}

/** installation_id é sempre um UUID aleatório gerado no computador. */
export const INSTALLATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInstallationId(value: unknown): value is string {
  return typeof value === "string" && INSTALLATION_ID_RE.test(value);
}

export interface InstallationRow {
  installation_id: string;
  name: string;
  status: InstallationStatus;
  created_at: string;
  updated_at: string;
}

/** Senha nunca é guardada em texto puro: só salt + hash derivado. */
export interface CredentialDigest {
  credential_id: string;
  name: string;
  salt: string;
  password_hash: string;
  status: CredentialStatus;
  is_admin: boolean;
}

/**
 * Credencial inicial ADMIN — somente salt + hash (PBKDF2-SHA256).
 * Garante o primeiro acesso local. Nunca há senha em texto puro.
 */
export const SEED_ADMIN: CredentialDigest = {
  credential_id: "seed-admin",
  name: "ADMIN",
  salt: "3f5bf9563f8cb4af7f53b5c955aa2c40",
  password_hash: "c6ff81678ac933984edd431b1427bc9e48020ad8265b4972a06e36ea673d6ef1",
  status: "ativo",
  is_admin: true,
};
