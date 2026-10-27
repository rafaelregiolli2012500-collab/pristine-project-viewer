# ADD+ — Enviar paradas da Linha do Tempo para o Histórico

## Objetivo
Cada parada exibida na Linha do Tempo ganha um botão **ADD+** dentro do painel de informações (o quadro que aparece ao passar o mouse sobre a barra). Ao clicar, aquela parada específica entra no Histórico existente, com o tipo de manutenção marcado como **NULL**, sem aparecer no Cronograma até o usuário editá-la e escolher um tipo válido.

## Como vai funcionar para o usuário

1. Passar o mouse sobre uma parada na Linha do Tempo → o painel de informações mostra o botão **ADD+**.
2. Clicar → a parada é registrada no Histórico do equipamento correspondente:
   - Colhedora → Histórico de Colhedoras
   - Trator / Transbordo → Histórico de Tratores
   - Caminhão → Histórico de Caminhões
3. No Histórico o registro aparece como **NULL** (destacado), com frota, frente, operador, operação, estado, data, horário inicial, horário final e duração originais.
4. Enquanto estiver como NULL, o registro NÃO aparece no Cronograma.
5. Ao editar o registro no Histórico (lápis), o campo de tipo usa exatamente a mesma lista já usada na aba Manutenções, com a opção NULL no topo. Ao salvar com um tipo válido, as validações atuais rodam e a manutenção passa a aparecer no Cronograma normalmente.
6. Clicar ADD+ duas vezes na mesma parada não cria dois registros: o botão passa a mostrar **ADICIONADO** e fica desabilitado; se já existir, um aviso informa que a parada já está no Histórico.
7. Os filtros da Linha do Tempo continuam iguais; ADD+ afeta só a parada clicada.

## Detalhes técnicos

- `src/types/maintenance.ts`: adicionar a constante `NULL_STOP_REASON = 'NULL'` e o rótulo correspondente; ampliar `MaintenanceRecord` com campos opcionais `stopReason: StopReason | 'NULL'`, `operador?`, `operacao?`, `estado?`, `estadoOp?`, `origem?: 'linha_do_tempo'`, `sourceEventId?`. Nenhuma alteração nas listas oficiais de motivos (`reasonsForType` permanece intacta).
- `src/lib/maintenanceValidation.ts`: `sanitizeRecord` preserva `'NULL'` em vez de trocar por `manutencao`; nenhuma outra regra muda.
- `src/hooks/useMaintenanceStore.ts`: nova ação `addFromTimeline(payload)` que grava no mesmo `localStorage` já usado (participa de Backup/Restauração/Exportação automaticamente) e retorna `{ ok, duplicate }` checando duplicidade por `sourceEventId` e, na falta dele, por frota + início + fim + operação.
- `src/components/LinhaDoTempo.tsx`: no `HoverCardContent` da barra, apenas para segmentos de categoria `parada`, renderizar o botão ADD+ ligado ao segmento (`s.id` como `sourceEventId`); mapear `categoria` do segmento para `equipmentType` do Histórico. O hook do Histórico é consumido diretamente (mesma fonte, sem novo armazenamento).
- `src/components/HistoryTable.tsx`: exibir `NULL` em destaque quando `stopReason === 'NULL'` e incluir a opção NULL no `Select` de edição, que continua alimentado por `reasonsForType`.
- `src/pages/Index.tsx`: o Cronograma (`TimelineChart`) recebe `records` já filtrados, excluindo os de tipo `NULL`. Demais telas e módulos ficam inalterados.
- Nada de novo banco, tabela, histórico, cronograma ou lista de motivos. Camada de acesso, Supabase, Installation ID, login e Electron não são tocados.
