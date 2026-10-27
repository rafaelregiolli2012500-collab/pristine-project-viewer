/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * PASTA CHAVE (local) — identificador da instalação e cache de autorização.
 *
 * Tudo aqui fica no computador e sobrevive à atualização do programa:
 *   - installation_id (UUID aleatório, gerado uma única vez);
 *   - cache criptografado com a situação da instalação e as credenciais
 *     (salt + hash — nunca a senha) para permitir entrar OFFLINE.
 */

import { derive, randomHex, safeEqual, verifyPassword } from './hash';
import { SEED_ADMIN, type CredentialDigest, type InstallationStatus } from './protocol';

const CHAVE = 'monit.campo/CHAVE';
const KEY_INSTALLATION = `${CHAVE}/installation_id`;
const KEY_NAME = `${CHAVE}/installation_name`;
const KEY_VAULT = `${CHAVE}/autorizacao`;
const KEY_SESSION = `${CHAVE}/sessao`;

/**
 * Credencial inicial ADMIN (salt + hash), usada quando o computador ainda
 * não recebeu nenhuma credencial da API. Permite o primeiro acesso offline.
 */
const SEED: CredentialDigest = SEED_ADMIN;

export interface AccessVault {
  status: InstallationStatus;
  name: string;
  credentials: CredentialDigest[];
  updated_at: string;
}

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Identificação da instalação                                         */
/* ------------------------------------------------------------------ */

export function getInstallationId(): string {
  const s = store();
  const existing = s?.getItem(KEY_INSTALLATION);
  if (existing) return existing;
  const gerado =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${randomHex(4)}-${randomHex(2)}-${randomHex(2)}-${randomHex(2)}-${randomHex(6)}`;
  s?.setItem(KEY_INSTALLATION, gerado);
  return gerado;
}

export function getInstallationName(fallback = 'Instalação'): string {
  return store()?.getItem(KEY_NAME) ?? fallback;
}

export function setInstallationName(name: string): void {
  store()?.setItem(KEY_NAME, name.trim().slice(0, 60));
}

/* ------------------------------------------------------------------ */
/* Cofre local criptografado                                           */
/* ------------------------------------------------------------------ */

async function vaultKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${CHAVE}:${getInstallationId()}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(CHAVE) as unknown as BufferSource,
      iterations: 50000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function b64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function unb64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function saveVault(vault: AccessVault): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      await vaultKey(),
      new TextEncoder().encode(JSON.stringify(vault)),
    );
    s.setItem(KEY_VAULT, `${b64(iv)}.${b64(new Uint8Array(cipher))}`);
  } catch {
    /* cofre indisponível: o sistema continua funcionando normalmente */
  }
}

export async function readVault(): Promise<AccessVault | null> {
  const raw = store()?.getItem(KEY_VAULT);
  if (!raw) return null;
  const [ivPart, dataPart] = raw.split('.');
  if (!ivPart || !dataPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(ivPart) as unknown as BufferSource },
      await vaultKey(),
      unb64(dataPart) as unknown as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as AccessVault;
  } catch {
    return null;
  }
}

export function clearVault(): void {
  store()?.removeItem(KEY_VAULT);
}

/* ------------------------------------------------------------------ */
/* Verificação local (offline)                                         */
/* ------------------------------------------------------------------ */

/** Credenciais conhecidas localmente (cache ou credencial inicial). */
export async function localCredentials(): Promise<CredentialDigest[]> {
  const vault = await readVault();
  const cached = vault?.credentials?.filter((c) => c.status === 'ativo') ?? [];
  return cached.length ? cached : [SEED];
}

export async function verifyLocalPassword(
  password: string,
  somenteAdmin = false,
): Promise<CredentialDigest | null> {
  const lista = (await localCredentials()).filter((c) => (somenteAdmin ? c.is_admin : true));
  for (const c of lista) {
    if (await verifyPassword(password, c.salt, c.password_hash)) return c;
  }
  return null;
}

/** Confere se a senha informada corresponde a algum hash (uso interno). */
export async function matchesDigest(
  password: string,
  digest: CredentialDigest,
): Promise<boolean> {
  return safeEqual(await derive(password, digest.salt), digest.password_hash);
}

/* ------------------------------------------------------------------ */
/* Sessão local (independente dos dados operacionais)                  */
/* ------------------------------------------------------------------ */

export interface LocalSession {
  name: string;
  is_admin: boolean;
  started_at: string;
}

/** Prefixo das chaves de autenticação — nunca entram/saem em backups. */
export const CHAVE_PREFIX = CHAVE;

export function readSession(): LocalSession | null {
  const raw = store()?.getItem(KEY_SESSION);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as LocalSession;
    return s && typeof s.name === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session: { name: string; is_admin: boolean }): void {
  try {
    store()?.setItem(
      KEY_SESSION,
      JSON.stringify({ ...session, started_at: new Date().toISOString() }),
    );
  } catch {
    /* sessão apenas em memória */
  }
}

export function clearSession(): void {
  store()?.removeItem(KEY_SESSION);
}
