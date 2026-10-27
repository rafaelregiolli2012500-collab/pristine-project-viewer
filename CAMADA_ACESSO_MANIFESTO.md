# CAMADA_ACESSO_MANIFESTO — MONIT.CAMPO

Autor e criador: Rafael Regiolli de Souza

Manifesto declarativo da camada protegida de acesso. É documentação: não
existe checksum ou travamento que impeça o desenvolvimento normal do sistema
operacional (manutenção, gráficos, dashboards, cronograma, histórico etc.).

## Arquivos protegidos

| Arquivo | Finalidade | Dependências |
| --- | --- | --- |
| `src/lib/access/index.ts` | Interface única do controle de acesso | `remote.ts`, `local.ts`, `protocol.ts` |
| `src/lib/access/remote.ts` | Chamada da RPC de autorização | `@/integrations/supabase/client`, `local.ts`, `protocol.ts` |
| `src/lib/access/local.ts` | Installation ID, cofre do último estado válido, sessão local | `hash.ts`, `protocol.ts` |
| `src/lib/access/protocol.ts` | Estados e contratos | — |
| `src/lib/access/hash.ts` | PBKDF2-SHA256 do login local | Web Crypto |
| `src/hooks/useAuth.ts` | Orquestração acesso → login local | `src/lib/access/*` |
| `src/components/InstallationGate.tsx` | Tela de acesso negado/verificando | UI |
| `src/integrations/supabase/client.ts` | Cliente Supabase (gerado) | variáveis de ambiente |
| `src/lib/access/__tests__/*.test.ts` | Regressão da camada | vitest |

## Fluxo de autorização

```text
Aplicação → getInstallationAccess() → Supabase JS → HTTPS
          → RPC public.monit_installation_access → public.installations
          → autorizada | pendente | bloqueada
```

## RPC utilizada

`public.monit_installation_access(p_installation_id uuid, p_name text)`
retorna somente `name` e `status`. Nenhum outro parâmetro é aceito; o cliente
não pode enviar status.

## Variáveis necessárias

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
(somente chave publicável).

## Invariantes

- Um único Installation ID (UUID local, persistente, fora do backup operacional).
- Uma única implementação de consulta de autorização.
- Um único timer de reconsulta: 10 minutos.
- Offline nunca vira bloqueio.
- Nenhum dado operacional, telemetria, heartbeat, WebSocket ou Realtime.
