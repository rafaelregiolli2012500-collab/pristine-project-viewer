# Redesign da Linha do Tempo e seleção persistente

## Objetivo
Atualizar somente a apresentação e a interação da aba **Linha do Tempo**, preservando importação, filtros, cálculos, cores e a função existente de adicionar ao Histórico.

## Implementação

1. **Reorganizar o cabeçalho e os filtros**
   - Manter as abas e todos os filtros atuais, agrupando-os em uma faixa operacional mais limpa.
   - Dar destaque à alternância entre Colhedoras e Tratores sem criar um novo filtro.
   - Preservar consultas por horário/intervalo e exportação para Excel.

2. **Redesenhar a grade por frota**
   - Exibir cada colhedora em uma linha limpa, identificada por ícone e número da frota.
   - Manter a separação atual de frentes/grupos onde ela é necessária para a organização dos dados.
   - Criar cabeçalho fixo com **Frota**, escala de horas, **Parada** e **Efetivo**.
   - Manter rolagem horizontal e cabeçalhos fixos em telas menores.

3. **Reutilizar os cálculos existentes**
   - Usar o resumo já calculado para cada frota: `totals.parada` em **Parada** e `uptime` em **Efetivo**.
   - Criar **Totais do período** somando os mesmos resumos filtrados, sem fórmula paralela.
   - Fazer os totais e as linhas refletirem exatamente os filtros ativos.

4. **Seleção persistente por clique**
   - Adicionar um único estado de evento selecionado.
   - Clicar numa barra seleciona e trava a ocorrência; clicar noutra troca a seleção.
   - Clicar fora da grade ou usar o controle de fechar limpa a seleção.
   - Preservar a cor original da categoria e aplicar apenas contorno/destaque adicional.
   - Limpar automaticamente uma seleção que deixe de existir após troca de data, categoria ou filtros.

5. **Painel de detalhes da ocorrência**
   - Mostrar persistentemente os dados reais disponíveis: frota, equipamento, operação, operador, frente, categoria/status, motivo, data, início, fim, duração, horímetros e velocidade.
   - Exibir o botão **+ ADD AO HISTÓRICO** somente para uma parada selecionada.
   - Ligar esse botão à função `handleAddToHistory` já existente, sem alterar payload, persistência ou prevenção de duplicidade.
   - Manter o estado **ADICIONADO** já existente após sucesso.

6. **Filtro por tipo visualizado**
   - Acrescentar uma seleção visual de categoria usando as categorias já existentes, sem duplicar o processamento dos eventos.
   - Quando **Parada** estiver ativa, renderizar apenas barras de parada; os totais usarão exatamente o mesmo conjunto visível.
   - Aplicar o mesmo comportamento às demais categorias.

## Validação
- Conferir tipos e compilação automática.
- Testar no navegador com dados importados: filtros, linhas por frota, tempos, clique persistente, troca/limpeza de seleção, detalhes e ADD existente.
- Conferir em largura de notebook e tela menor, incluindo rolagem horizontal.
- Não tocar na camada protegida de acesso, Histórico, persistência, backup, restauração ou Electron.
