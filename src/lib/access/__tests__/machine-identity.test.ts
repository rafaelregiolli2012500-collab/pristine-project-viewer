/**
 * MONIT.CAMPO — Installation ID único por máquina (electron/identity.cjs).
 * Cada "usuário do Windows" é simulado por um localStorage próprio; o
 * armazenamento compartilhado é uma pasta real no disco (equivale a ProgramData).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const identityPath = path.resolve(__dirname, '../../../../electron/identity.cjs');
const { resolveInstallationId } = require(identityPath) as {
  resolveInstallationId: (o: { legacyId?: string | null; dir?: string }) => {
    id: string;
    source: string;
    conflict: boolean;
  };
};

const LEGACY_A = '11111111-2222-4333-8444-555555555555';
const LEGACY_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const KEY = 'monit.campo/CHAVE/installation_id';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monit-programdata-'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  fs.rmSync(dir, { recursive: true, force: true });
});

function profile(initial?: string) {
  const m = new Map<string, string>(initial ? [[KEY, initial]] : []);
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
}

/** Abre o app como um usuário: preload → IPC → processo principal. */
async function openAs(storage: Storage, sharedDir = dir) {
  vi.resetModules();
  vi.stubGlobal('window', {
    localStorage: storage,
    monitCampo: {
      resolveInstallationId: (legacy: string | null) =>
        resolveInstallationId({ legacyId: legacy, dir: sharedDir }).id,
    },
  });
  const { getInstallationId } = await import('../local');
  return getInstallationId();
}

describe('Installation ID por máquina', () => {
  it('A/B/C: primeiro cria em ProgramData; demais usuários recebem o mesmo ID', async () => {
    const a = await openAs(profile());
    expect(fs.readFileSync(path.join(dir, 'installation-id'), 'utf8').trim()).toBe(a);
    const b = await openAs(profile());
    const c = await openAs(profile());
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('H: migra o ID antigo já cadastrado, preservando-o exatamente', async () => {
    const storageA = profile(LEGACY_A);
    expect(await openAs(storageA)).toBe(LEGACY_A);
    expect(storageA.getItem(KEY)).toBe(LEGACY_A); // ID antigo não é apagado
    expect(await openAs(profile())).toBe(LEGACY_A);
    // idempotente
    expect(resolveInstallationId({ dir, legacyId: LEGACY_A }).source).toBe('shared');
  });

  it('IDs divergentes entre perfis: não sobrescreve e registra para resolução', async () => {
    await openAs(profile(LEGACY_A));
    const storageB = profile(LEGACY_B);
    expect(await openAs(storageB)).toBe(LEGACY_A);
    expect(storageB.getItem(KEY)).toBe(LEGACY_B);
    const log = fs.readFileSync(path.join(dir, 'migration-conflicts.log'), 'utf8');
    expect(log).toContain(`official=${LEGACY_A}`);
    expect(log).toContain(`legacy=${LEGACY_B}`);
  });

  it('localStorage não tem autoridade sobre o ID oficial', async () => {
    await openAs(profile(LEGACY_A));
    const storage = profile(LEGACY_A);
    storage.setItem(KEY, LEGACY_B);
    expect(await openAs(storage)).toBe(LEGACY_A);
  });

  it('F: atualização/reinício mantém o mesmo ID (arquivo persistente)', async () => {
    const a = await openAs(profile());
    expect(await openAs(profile())).toBe(a);
  });

  it('G: outro computador (outro ProgramData) recebe outro ID', async () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'monit-pc2-'));
    try {
      expect(await openAs(profile(), other)).not.toBe(await openAs(profile()));
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('D: aberturas simultâneas em processos separados resultam em um só ID', async () => {
    const script = `const r=require(${JSON.stringify(identityPath)}).resolveInstallationId({dir:process.argv[1]});process.stdout.write(r.id)`;
    const run = () =>
      new Promise<string>((resolve, reject) => {
        const p = spawn(process.execPath, ['-e', script, dir]);
        let out = '';
        p.stdout.on('data', (d) => (out += d));
        p.on('error', reject);
        p.on('close', () => resolve(out));
      });
    const ids = await Promise.all(Array.from({ length: 8 }, run));
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(fs.readFileSync(path.join(dir, 'installation-id'), 'utf8').trim());
  });

  it('E: a consulta à Central usa o ID compartilhado para todos os usuários', async () => {
    const calls: unknown[] = [];
    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: {
        rpc: (_fn: string, args: unknown) => {
          calls.push(args);
          return Promise.resolve({ data: [{ status: 'bloqueada', name: 'PC' }], error: null });
        },
      },
    }));
    const official = await openAs(profile(LEGACY_A));
    const remoteA = await import('../remote');
    const ra = await remoteA.consultarAcessoRemoto();
    await openAs(profile(LEGACY_B));
    const remoteB = await import('../remote');
    const rb = await remoteB.consultarAcessoRemoto();
    expect(calls.map((c) => (c as { p_installation_id: string }).p_installation_id)).toEqual([
      official,
      official,
    ]);
    expect(ra).toMatchObject({ ok: true, status: 'bloqueada' });
    expect(rb).toMatchObject({ ok: true, status: 'bloqueada' });
    vi.doUnmock('@/integrations/supabase/client');
  });
});
