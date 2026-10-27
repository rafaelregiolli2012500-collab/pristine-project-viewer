# Roadmap — MONIT.CAMPO

- [ ] Dashboard logístico de caminhões na Linha do Tempo → Gráficos: mesma base, importação por cabeçalho, cálculos com lacunas, filtros, gráficos e tabelas paginadas; testes e relatório. Base original de 94.216 apontamentos e imagem de referência não foram anexadas.

- [x] Separar as linhas de paradas de colhedoras e tratores por cor e frente somente na comparação somada, preservando os gráficos individuais — 4 testes aprovados e build OK; conferência visual do gráfico bloqueada pela autorização da instalação.
- [x] Comparativo por frente (Colhedoras × Transbordo) no cronograma combinado; Bases somadas com resumo, paradas por frente, períodos sem manutenção e rankings — 10 testes OK; validação visual bloqueada pela autorização.

- [x] Remover a Central antiga (telemetria, heartbeat, eventos, health legado)
- [x] Base mínima: instalações, acessos e última localização aproximada
- [x] API mínima: autorização, instalações, acessos, localização e /health
- [x] Tela de entrada somente com senha + credencial inicial ADMIN protegida
- [x] CENTRAL DEV (ALT + F12) com ACESSOS, INSTALAÇÕES e LOCALIZAÇÃO
- [x] Cache de autorização local (pasta CHAVE) para uso offline
- [ ] Testes finais: TypeScript, build web, build Electron
- [x] Redesenhar a Linha do Tempo por frota com Parada e Efetivo
- [x] Adicionar filtro visual por categoria usando os eventos existentes
- [x] Adicionar seleção persistente por clique e painel de detalhes
- [x] Reutilizar o ADD ao Histórico existente no evento selecionado
- [ ] Validar o redesign da Linha do Tempo no navegador e em tela menor — bloqueado pela instalação pendente de autorização nesta prévia
- [x] Exibir o cronograma completo sem rolagem interna e restaurar ADD nas paradas
- [x] Comparar frentes por produção/paradas em linhas com bases juntas ou individuais
- [x] Ampliar totais do período e por frente com manobra e deslocamento
- [x] Verificar os ajustes isolados em telas 1280 e 524: seleção, ADD visual e bases juntas/individuais; build OK e 12 testes de acesso aprovados
- [ ] Validar gravação real no Histórico e Electron — instalação da prévia pendente de autorização; ambiente Windows indisponível

- [x] Linha do Tempo: base Canavieiros, 4 seletores dinâmicos, visão consolidada de efetividade por frente, Frente dos tratores pelo Grupo Equipamento, gráficos por seletor
