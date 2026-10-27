/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * CAMADA PROTEGIDA DE ACESSO — INTERFACE ÚNICA.
 *
 * Este é o ÚNICO ponto de entrada do controle de acesso da instalação.
 * Todo o restante do aplicativo (Dashboard, Manutenção, Linha do Tempo,
 * Cronograma, Histórico, Cadastro, Moagem, Base e Terceiros, Caminhões,
 * Tratores, Colhedoras…) deve consumir a decisão pronta e NUNCA falar
 * diretamente com o Supabase, com a tabela `installations` ou com a RPC.
 *
 * Fluxo:
 *   Aplicação → getInstallationAccess() → RPC monit_installation_access
 *
 * Regras invariáveis:
 *   autorizada → permitido
 *   pendente   → negado
 *   bloqueada  → negado
 *   sem comunicação → último estado válido (NUNCA vira bloqueio)
 *
 * Nenhum dado operacional, telemetria, heartbeat, WebSocket, Realtime ou
 * localização trafega por esta camada.
 *
 * Ler PROTECAO_CAMADA_ACESSO_MONIT_CAMPO.md antes de alterar.
 */
import { getInstallationName, localCredentials, readVault, saveVault, setInstallationName } from './local';
import type { InstallationStatus } from './protocol';
import { consultarAcessoRemoto } from './remote';

/** Intervalo único de reconsulta. Não criar outro timer no projeto. */
export const INTERVALO_RECONSULTA_MS = 10 * 60 * 1000;

export type AccessDecision = 'verificando' | 'permitido' | 'negado';

export const MSG_PENDENTE =
  'Esta instalação ainda não foi autorizada. Entre em contato com o administrador.';
export const MSG_BLOQUEADA = 'Esta instalação está bloqueada. Entre em contato com o administrador.';
export const MSG_SEM_ESTADO =
  'Não foi possível verificar a autorização desta instalação. Conecte este computador à internet para concluir a liberação.';

export interface InstallationAccess {
  /** Situação vigente: remota quando houver comunicação, senão a do cofre. */
  status: InstallationStatus | null;
  /** Decisão final consumida pela aplicação. */
  decision: Exclude<AccessDecision, 'verificando'>;
  /** true quando a última consulta ao Supabase respondeu. */
  online: boolean;
  /** Situação vinda do cache local (sem comunicação). */
  fromCache: boolean;
}

/** Única regra de decisão do aplicativo. */
export function decidirAcesso(
  status: InstallationStatus | null,
): Exclude<AccessDecision, 'verificando'> {
  return status === 'autorizada' ? 'permitido' : 'negado';
}

/** Mensagem exibida quando o acesso está negado (sem detalhes técnicos). */
export function mensagemAcesso(status: InstallationStatus | null): string | null {
  if (decidirAcesso(status) === 'permitido') return null;
  if (status === 'bloqueada') return MSG_BLOQUEADA;
  if (status === 'pendente') return MSG_PENDENTE;
  return MSG_SEM_ESTADO;
}

/**
 * INTERFACE ÚNICA de consulta da autorização desta instalação.
 * Nunca lança erro; falha de comunicação devolve o último estado válido.
 */
export async function getInstallationAccess(): Promise<InstallationAccess> {
  const res = await consultarAcessoRemoto();

  if (res.ok) {
    if (res.name) setInstallationName(res.name);
    const vault = await readVault();
    await saveVault({
      status: res.status,
      name: res.name || getInstallationName(),
      credentials: vault?.credentials ?? (await localCredentials()),
      updated_at: new Date().toISOString(),
    });
    return { status: res.status, decision: decidirAcesso(res.status), online: true, fromCache: false };
  }

  const cache = (await readVault())?.status ?? null;
  return { status: cache, decision: decidirAcesso(cache), online: false, fromCache: cache !== null };
}

export type { InstallationStatus };
