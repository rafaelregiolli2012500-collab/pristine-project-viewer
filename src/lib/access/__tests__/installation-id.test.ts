/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * PERSISTÊNCIA DO INSTALLATION ID — mesmo identificador após fechar, abrir,
 * reiniciar e atualizar o programa (o armazenamento local sobrevive).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INSTALLATION_ID_RE } from '../protocol';

function memoriaLocalStorage() {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
    clear: () => dados.clear(),
    key: (i: number) => Array.from(dados.keys())[i] ?? null,
    get length() {
      return dados.size;
    },
  } as unknown as Storage;
}

const storage = memoriaLocalStorage();

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: storage } as unknown as Window);
});

describe('installation id', () => {
  it('é UUID, único e estável entre execuções', async () => {
    const { getInstallationId } = await import('../local');
    const primeiro = getInstallationId();
    expect(INSTALLATION_ID_RE.test(primeiro)).toBe(true);

    /* fechar/abrir/reiniciar/atualizar: novo import, mesmo armazenamento */
    vi.resetModules();
    const { getInstallationId: novaExecucao } = await import('../local');
    expect(novaExecucao()).toBe(primeiro);
  });

  it('as chaves da camada protegida têm prefixo próprio, fora dos dados operacionais', async () => {
    const { CHAVE_PREFIX } = await import('../local');
    expect(CHAVE_PREFIX).toBe('monit.campo/CHAVE');
  });
});
