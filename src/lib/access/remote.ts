/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * CONTROLE DE ACESSO REMOTO — comunicação DIRETA com o banco (Lovable Cloud).
 *
 * Não existe API intermediária, webhook, heartbeat, telemetria, WebSocket ou
 * envio de localização. A única chamada é uma função controlada do banco que
 * recebe o identificador da instalação e devolve SOMENTE o nome e a situação
 * dessa instalação.
 *
 * Nenhum dado operacional trafega por aqui. Nenhuma senha trafega por aqui.
 * Qualquer falha (DNS, timeout, conexão recusada, 5xx, resposta inválida) é
 * tratada como "sem comunicação" — NUNCA como bloqueio.
 */

import { supabase } from "@/integrations/supabase/client";

import { getInstallationId, getInstallationName } from "./local";
import {
  ACCESS_TIMEOUT_MS,
  isInstallationId,
  isInstallationStatus,
  type InstallationStatus,
} from "./protocol";

export type RemoteAccess =
  { ok: true; status: InstallationStatus; name: string } | { ok: false; kind: "sem_comunicacao" };

const SEM_COMUNICACAO: RemoteAccess = { ok: false, kind: "sem_comunicacao" };

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), ms);
  });
}

/**
 * Consulta a situação da PRÓPRIA instalação. Na primeira execução a função do
 * banco registra a instalação como "pendente". Nunca lança erro.
 */
export async function consultarAcessoRemoto(): Promise<RemoteAccess> {
  try {
    const installationId = getInstallationId();
    if (!isInstallationId(installationId)) return SEM_COMUNICACAO;

    const consulta = supabase.rpc("monit_installation_access", {
      p_installation_id: installationId,
      p_name: getInstallationName(),
    });

    const { data, error } = (await Promise.race([consulta, timeout(ACCESS_TIMEOUT_MS)])) as Awaited<
      typeof consulta
    >;

    if (error) return SEM_COMUNICACAO;

    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha || !isInstallationStatus(linha.status)) return SEM_COMUNICACAO;

    return {
      ok: true,
      status: linha.status,
      name: typeof linha.name === "string" && linha.name ? linha.name : getInstallationName(),
    };
  } catch {
    /* DNS, timeout, conexão recusada, 5xx, resposta inválida… */
    return SEM_COMUNICACAO;
  }
}
