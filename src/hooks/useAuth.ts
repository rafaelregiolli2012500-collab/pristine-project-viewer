/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * AUTORIZAÇÃO DA INSTALAÇÃO (remota) + LOGIN OPERACIONAL (local).
 *
 * São duas coisas separadas e nesta ordem:
 *   1) a instalação precisa estar AUTORIZADA (consulta direta ao banco);
 *   2) só depois o login operacional local é permitido.
 *
 * A senha do usuário NUNCA sai do computador: a conferência é local
 * (cofre criptografado + PBKDF2 em src/lib/access/local.ts).
 *
 * Regra do controle de acesso:
 *   autorizada → acesso permitido
 *   pendente   → acesso negado
 *   bloqueada  → acesso negado
 *
 * Sem comunicação, vale o ÚLTIMO ESTADO VÁLIDO guardado localmente. Erro de
 * rede nunca é interpretado como bloqueio. Sem nenhum estado válido conhecido
 * (primeira execução offline), o acesso permanece negado.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearSession,
  clearVault,
  getInstallationId,
  readSession,
  saveSession,
  verifyLocalPassword,
} from "@/lib/access/local";
import {
  INTERVALO_RECONSULTA_MS,
  MSG_BLOQUEADA,
  MSG_PENDENTE,
  MSG_SEM_ESTADO,
  getInstallationAccess,
  mensagemAcesso,
  type AccessDecision,
} from "@/lib/access";
import type { InstallationStatus } from "@/lib/access/protocol";

export interface LoginResult {
  ok: boolean;
  message?: string;
}

export type { AccessDecision };
export { MSG_PENDENTE, MSG_BLOQUEADA, MSG_SEM_ESTADO };

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [credential, setCredential] = useState<{ name: string; is_admin: boolean } | null>(null);
  const [status, setStatus] = useState<InstallationStatus | null>(null);
  const [access, setAccess] = useState<AccessDecision>("verificando");
  const [online, setOnline] = useState(true);
  const installationId = useRef(typeof window !== "undefined" ? getInstallationId() : "");

  /* Sessão persistente: sobrevive a reload, restauração de backup e re-render. */
  useEffect(() => {
    const sessao = readSession();
    if (!sessao) return;
    setCredential({ name: sessao.name, is_admin: sessao.is_admin });
    setAuthenticated(true);
  }, []);

  /** Consulta única da situação, sempre pela interface única da camada. */
  const consultar = useCallback(async () => {
    const res = await getInstallationAccess();
    setOnline(res.online);
    setStatus(res.status);
    setAccess(res.decision);
    if (res.decision !== "permitido") {
      /* pendente/bloqueada/desconhecida: encerra a sessão operacional. */
      clearSession();
      setAuthenticated(false);
      setCredential(null);
    }
    return res;
  }, []);

  /* Verificação inicial + reconsulta periódica (timer único). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    void consultar();
    const timer = setInterval(() => void consultar(), INTERVALO_RECONSULTA_MS);
    return () => clearInterval(timer);
  }, [consultar]);

  /** Mensagem exibida quando o acesso está negado (sem detalhes técnicos). */
  const accessMessage = access === "negado" ? mensagemAcesso(status) : null;


  const login = useCallback(
    async (password: string): Promise<LoginResult> => {
      if (!password) return { ok: false, message: "Informe a senha" };

      /* 1) Situação da instalação pela interface única da camada protegida:
         remota quando houver comunicação, senão o último estado válido. */
      const res = await consultar();
      if (res.decision !== "permitido") {
        return { ok: false, message: mensagemAcesso(res.status) ?? MSG_SEM_ESTADO };
      }

      /* 2) Senha: conferência 100% local. */
      const local = await verifyLocalPassword(password);
      if (!local) return { ok: false, message: "Senha incorreta" };

      saveSession({ name: local.name, is_admin: local.is_admin });
      setCredential({ name: local.name, is_admin: local.is_admin });
      setAuthenticated(true);
      return { ok: true };
    },
    [consultar],
  );

  const logout = useCallback(() => {
    clearSession();
    setAuthenticated(false);
    setCredential(null);
  }, []);

  return {
    authenticated,
    credential,
    status,
    access,
    accessMessage,
    online,
    installationId: installationId.current,
    login,
    logout,
    esquecerAutorizacao: clearVault,
  };
}
