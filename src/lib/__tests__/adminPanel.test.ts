/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * ABERTURA DO PAINEL CENTRAL (Central Admin).
 * No app instalado usa a ponte do Electron; na versão web (prévia/navegador)
 * abre a URL oficial do painel em nova aba.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CENTRAL_ADMIN_URL, openAdminPanel } from '../adminPanel';

describe('openAdminPanel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no app instalado usa a ponte do Electron e não abre aba no navegador', () => {
    const bridge = vi.fn();
    const open = vi.fn();
    vi.stubGlobal('window', { monitCampo: { openAdminPanel: bridge }, open } as unknown as Window);

    openAdminPanel();

    expect(bridge).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('na versão web abre a URL oficial do painel em nova aba', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open } as unknown as Window);

    openAdminPanel();

    expect(open).toHaveBeenCalledTimes(1);
    const [url, alvo, recursos] = open.mock.calls[0];
    expect(url).toBe(CENTRAL_ADMIN_URL);
    expect(alvo).toBe('_blank');
    expect(String(recursos)).toContain('noopener');
  });

  it('a URL oficial é a mesma do Electron (electron/main.cjs)', () => {
    expect(CENTRAL_ADMIN_URL).toBe('https://monit-field-guard.lovable.app');
  });
});
