# CAMADA PROTEGIDA DE ACESSO — MONIT.CAMPO

Autor e criador: Rafael Regiolli de Souza

Este documento descreve a infraestrutura crítica de controle de acesso do
MONIT.CAMPO. Ele usa apenas os caminhos e nomes realmente existentes no projeto.

---

## ATENÇÃO — CAMADA PROTEGIDA

Os arquivos e configurações identificados neste documento fazem parte
da infraestrutura crítica de controle de acesso do MONIT.CAMPO.

NÃO alterar, substituir, remover ou duplicar esta implementação durante
alterações funcionais ou visuais do sistema.

Alterações em:

- manutenção;
- gráficos;
- dashboard;
- cronograma;
- histórico;
- Linha do Tempo;
- Cadastro;
- Base e Terceiros;
- Caminhões;
- Tratores;
- Colhedoras;
- Moagem;

não devem modificar esta camada.

Somente alterar esta camada quando a solicitação mencionar
explicitamente "CAMADA PROTEGIDA DE ACESSO".

---

## CAMADA PROTEGIDA — ARQUIVOS REAIS

| Arquivo | Finalidade |
| --- | --- |
| `src/lib/access/index.ts` | **Interface única**: `getInstallationAccess()`, `decidirAcesso()`, `mensagemAcesso()`, `INTERVALO_RECONSULTA_MS`. Único ponto de entrada do controle de acesso. |
| `src/lib/access/remote.ts` | Única chamada ao Supabase: RPC `monit_installation_access` (timeout de 8 s, falha = "sem comunicação"). |
| `src/lib/access/local.ts` | Installation ID persistente, cofre AES-GCM do último estado válido, credenciais locais (salt + hash) e sessão local. |
| `src/lib/access/protocol.ts` | Contrato: estados `pendente`/`autorizada`/`bloqueada`, validação de UUID, credencial inicial ADMIN. |
| `src/lib/access/hash.ts` | PBKDF2-SHA256 do login local (a senha nunca sai do computador). |
| `src/hooks/useAuth.ts` | Orquestra: decisão de acesso (via interface única) → login local. Timer único de reconsulta. |
| `src/components/InstallationGate.tsx` | Tela exibida quando o acesso está negado ou em verificação. |
| `src/integrations/supabase/client.ts` | Cliente Supabase gerado (somente chave publicável). Não editar — arquivo gerado. |
| `src/lib/access/__tests__/` | Testes de regressão da camada (`npm run test:access`). |

Configuração de ambiente da camada: `.env`, `.env.production`,
`.env.development`, `.env.example`, `env.official.mjs` (aplica as variáveis
oficiais ao build). Todos apontam exclusivamente para o Supabase oficial.

## SUPABASE OFICIAL

- Projeto: `https://bhymidkpthyuojqcflzp.supabase.co` (único; não trocar).
- Tabela: `public.installations` (RLS restritivo; sem acesso direto do cliente).
- RPC de acesso: `public.monit_installation_access(p_installation_id, p_name)`
  — retorna apenas `name` e `status`; o cliente nunca escolhe o próprio status.

## INSTALLATION ID

UUID único gerado localmente na primeira execução e persistido em
`localStorage['monit.campo/CHAVE/installation_id']` (`src/lib/access/local.ts`).
Sobrevive a fechar/reiniciar/atualizar o aplicativo, é independente do backup
operacional e nunca é recriado. Não existe outro mecanismo de identificação.

## FLUXO DE AUTORIZAÇÃO

```text
MONIT.CAMPO.EXE
    ↓ getInstallationAccess()          (src/lib/access/index.ts)
Supabase JS → HTTPS
    ↓ RPC public.monit_installation_access(p_installation_id, p_name)
public.installations
    ↓
autorizada → permitido   |   pendente / bloqueada → negado
```

- Primeira execução: a RPC registra a instalação como `pendente` (acesso negado).
- Somente o administrador altera o status no banco. O cliente nunca escolhe o
  próprio status e não tem SELECT/INSERT/UPDATE/DELETE na tabela.
- Sem comunicação (rede, DNS, timeout, 4xx/5xx, resposta inválida) = **SEM
  COMUNICAÇÃO**, nunca BLOQUEADO: vale o último estado válido do cofre local.
  Sem nenhum estado válido conhecido, o acesso permanece negado.
- Reconsulta: um único timer de 10 minutos (`INTERVALO_RECONSULTA_MS` =
  600000 ms, definido em `src/lib/access/index.ts`).
  Não existe heartbeat, polling duplicado, WebSocket, Realtime ou telemetria.
- Login local (PBKDF2-SHA256, usuário ADMIN) só é exibido depois da
  autorização remota; a tela de bloqueio (`InstallationGate`) protege contra
  tela branca e o aplicativo continua funcionando sem internet usando o
  último estado válido.

## VARIÁVEIS DE AMBIENTE (nomes reais, sem valores)

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Somente a chave PUBLICÁVEL pode existir no cliente/.exe. Nunca `service_role`,
`sb_secret`, senha do banco, connection string ou token administrativo.

## INTERFACE ÚNICA

Toda a aplicação consome `useAuth()` (que usa `getInstallationAccess()`).
Componentes operacionais não consultam o Supabase de autorização, não leem a
tabela `installations` e não decidem se a instalação está autorizada.

---

## REGRA PARA FUTURAS ALTERAÇÕES

Antes de modificar qualquer arquivo relacionado ao controle de acesso:

1. Ler este documento.
2. Identificar a implementação atual.
3. Não criar uma segunda implementação.
4. Não trocar o projeto Supabase.
5. Não trocar a RPC.
6. Não trocar o Installation ID.
7. Não adicionar Service Role Key.
8. Não remover o comportamento offline.
9. Não alterar a regra pendente/autorizada/bloqueada.
10. Não modificar a camada protegida durante alterações operacionais.

Se uma alteração operacional parecer exigir mudança nesta camada,
PARAR e analisar antes de modificar.
