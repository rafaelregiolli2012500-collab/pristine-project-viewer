/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * TESTES DE REGRESSÃO DA CAMADA PROTEGIDA DE ACESSO.
 * Nenhum dado operacional é envolvido. Somente a decisão de autorização.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../remote', () => ({ consultarAcessoRemoto: vi.fn() }));
vi.mock('../local', () => ({
  getInstallationName: () => 'INSTALACAO',
  setInstallationName: vi.fn(),
  localCredentials: async () => [],
  readVault: vi.fn(),
  saveVault: vi.fn(),
}));

import {
  MSG_BLOQUEADA,
  MSG_PENDENTE,
  MSG_SEM_ESTADO,
  INTERVALO_RECONSULTA_MS,
  decidirAcesso,
  getInstallationAccess,
  mensagemAcesso,
} from '../index';
import { readVault, saveVault } from '../local';
import { consultarAcessoRemoto } from '../remote';

const remoto = vi.mocked(consultarAcessoRemoto);
const cofre = vi.mocked(readVault);

beforeEach(() => {
  vi.clearAllMocks();
  cofre.mockResolvedValue(null);
});

describe('regra de decisão', () => {
  it('autorizada libera; pendente, bloqueada e desconhecida bloqueiam', () => {
    expect(decidirAcesso('autorizada')).toBe('permitido');
    expect(decidirAcesso('pendente')).toBe('negado');
    expect(decidirAcesso('bloqueada')).toBe('negado');
    expect(decidirAcesso(null)).toBe('negado');
  });

  it('mensagens não expõem detalhes técnicos', () => {
    expect(mensagemAcesso('autorizada')).toBeNull();
    expect(mensagemAcesso('pendente')).toBe(MSG_PENDENTE);
    expect(mensagemAcesso('bloqueada')).toBe(MSG_BLOQUEADA);
    expect(mensagemAcesso(null)).toBe(MSG_SEM_ESTADO);
  });

  it('mantém uma única periodicidade de 10 minutos', () => {
    expect(INTERVALO_RECONSULTA_MS).toBe(600000);
  });
});

describe('interface única getInstallationAccess', () => {
  it('instalação nova volta pendente e fica bloqueada', async () => {
    remoto.mockResolvedValue({ ok: true, status: 'pendente', name: 'NOVA' });
    const res = await getInstallationAccess();
    expect(res.status).toBe('pendente');
    expect(res.decision).toBe('negado');
    expect(saveVault).toHaveBeenCalled();
  });

  it('autorizada permite entrar', async () => {
    remoto.mockResolvedValue({ ok: true, status: 'autorizada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('permitido');
  });

  it('bloqueada impede a entrada', async () => {
    remoto.mockResolvedValue({ ok: true, status: 'bloqueada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('negado');
  });

  it('bloqueio remoto é reconhecido na próxima consulta', async () => {
    remoto.mockResolvedValueOnce({ ok: true, status: 'autorizada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('permitido');
    remoto.mockResolvedValueOnce({ ok: true, status: 'bloqueada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('negado');
  });

  it('desbloqueio remoto é reconhecido na próxima consulta', async () => {
    remoto.mockResolvedValueOnce({ ok: true, status: 'bloqueada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('negado');
    remoto.mockResolvedValueOnce({ ok: true, status: 'autorizada', name: 'X' });
    expect((await getInstallationAccess()).decision).toBe('permitido');
  });

  it('sem comunicação NÃO vira bloqueio: usa o último estado válido', async () => {
    remoto.mockResolvedValue({ ok: false, kind: 'sem_comunicacao' });
    cofre.mockResolvedValue({
      status: 'autorizada',
      name: 'X',
      credentials: [],
      updated_at: new Date().toISOString(),
    });
    const res = await getInstallationAccess();
    expect(res.online).toBe(false);
    expect(res.fromCache).toBe(true);
    expect(res.status).toBe('autorizada');
    expect(res.decision).toBe('permitido');
    expect(saveVault).not.toHaveBeenCalled();
  });

  it('sem comunicação e sem estado válido permanece negado', async () => {
    remoto.mockResolvedValue({ ok: false, kind: 'sem_comunicacao' });
    const res = await getInstallationAccess();
    expect(res.decision).toBe('negado');
    expect(mensagemAcesso(res.status)).toBe(MSG_SEM_ESTADO);
  });
});
