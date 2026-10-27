/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Derivação de senha — única fórmula usada pelo aplicativo e pela API.
 * PBKDF2-SHA256 com salt individual. Nenhuma senha em texto puro é
 * armazenada, transmitida para guarda ou registrada em log.
 */

/**
 * 100.000 iterações: é o teto aceito pelo Web Crypto do servidor de borda
 * (workerd). Acima disso a derivação falha no servidor e TODA verificação
 * de senha volta como inválida — causa real do "sem comunicação" anterior.
 */
export const PBKDF2_ITERATIONS = 100000;
const KEY_BYTES = 32;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('crypto indisponível');
  return c.subtle;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function derive(password: string, saltHex: string): Promise<string> {
  const key = await subtle().importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle().deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    KEY_BYTES * 8,
  );
  return toHex(bits);
}

export async function hashPassword(
  password: string,
): Promise<{ salt: string; password_hash: string }> {
  const salt = randomHex(16);
  return { salt, password_hash: await derive(password, salt) };
}

/** Comparação de tempo constante (não revela onde a diferença ocorre). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  try {
    return safeEqual(await derive(password, saltHex), expectedHash);
  } catch {
    return false;
  }
}
