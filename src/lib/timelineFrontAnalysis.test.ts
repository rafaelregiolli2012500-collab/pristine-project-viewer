import { describe, expect, it } from 'vitest';
import { stopCountsByFront, maintenanceWindows, maintenanceRanking, unionMinutes, allHarvesterWindows, showsAllHarvesters, type AnalysisSegment } from './timelineFrontAnalysis';

const H = 3600000, T0 = new Date(2026, 9, 9, 6).getTime();
const seg = (id: string, equipamento: string, frente: string, categoria: AnalysisSegment['categoria'], category: string, h0: number, h1: number, manutencao = false): AnalysisSegment =>
  ({ id, equipamento, frente, categoria, category, clipStart: new Date(T0 + h0 * H), clipEnd: new Date(T0 + h1 * H), manutencao });

describe('todas as colhedoras em produção', () => {
  const fleet = ['A', 'B'].map(frota => ({ frota, frente: 'FRENTE 22', equipmentType: 'colhedora' }));
  const run = (items: AnalysisSegment[]) => allHarvesterWindows(items, fleet, T0, T0 + 4 * H)[0];
  it('marca início, fim e total simultâneo sem somar horas-frota', () => {
    const result = run([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4), seg('b', 'B', 'F022', 'colhedora', 'producao', 1, 3)]);
    expect(result.windows).toEqual([{ start: T0 + H, end: T0 + 3 * H, durMin: 120 }]);
    expect(result.totalMin).toBe(120);
    expect(result.equipamentos).toBe(2);
  });
  it('não considera todas quando uma colhedora cadastrada não tem cobertura', () => {
    expect(run([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4)]).totalMin).toBe(0);
  });
  it('lacunas dividem os intervalos sem inventar operação', () => {
    const result = run([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4), seg('b', 'B', '22', 'colhedora', 'producao', 0, 1), seg('c', 'B', '22', 'colhedora', 'producao', 2, 4)]);
    expect(result.windows.map(w => w.durMin)).toEqual([60, 120]);
    expect(result.totalMin).toBe(180);
  });
  it('parada e manobra não contam como produção, inclusive em sobreposição', () => {
    const result = run([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4), seg('b', 'B', '22', 'colhedora', 'producao', 0, 4), seg('c', 'B', '22', 'colhedora', 'parada', 1, 2), seg('d', 'B', '22', 'colhedora', 'manobra', 2, 3)]);
    expect(result.windows.map(w => w.durMin)).toEqual([60, 60]);
  });
  it('respeita o recorte, une trechos contíguos e não duplica duração', () => {
    const result = allHarvesterWindows([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4), seg('b', 'B', '22', 'colhedora', 'producao', 0, 2), seg('c', 'B', '22', 'colhedora', 'producao', 2, 4), seg('dup', 'A', '22', 'colhedora', 'producao', 0, 4)], [...fleet, fleet[0]], T0 + H, T0 + 3 * H)[0];
    expect(result.windows).toEqual([{ start: T0 + H, end: T0 + 3 * H, durMin: 120 }]);
  });
  it('exclui tratores e frotas de outra frente; cadastro vazio não confirma operação', () => {
    expect(allHarvesterWindows([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4)], [], T0, T0 + H)).toEqual([]);
    expect(run([seg('a', 'A', '22', 'colhedora', 'producao', 0, 4), seg('b', 'B', '23', 'colhedora', 'producao', 0, 4), seg('c', 'B', '22', 'trator', 'producao', 0, 4)]).totalMin).toBe(0);
  });
  it('exibe apenas com seleção exclusiva de colhedoras', () => {
    expect(showsAllHarvesters('colhedora')).toBe(true);
    for (const selector of ['trator', 'canavieiro', 'combinado']) expect(showsAllHarvesters(selector)).toBe(false);
  });
});

describe('paradas por frente', () => {
  it('conta cada ocorrência uma vez mesmo recortada em turnos e une as variações da frente', () => {
    const rows = stopCountsByFront([
      seg('e1@a', '48050', '22', 'colhedora', 'parada', 0, 1),
      seg('e1@b', '48050', '22', 'colhedora', 'parada', 8, 9),
      seg('e2@a', 'T1', 'FRENTE 22', 'trator', 'producao', 0, 2),
    ], ['colhedora', 'trator']);
    expect(rows).toEqual([{ frente: 'F22', colhedora: 1, trator: 0 }]);
  });
  it('diferencia base ausente (null) de zero', () => {
    const rows = stopCountsByFront([seg('e1', 'C', '23', 'colhedora', 'producao', 0, 1)], ['colhedora', 'trator']);
    expect(rows[0]).toEqual({ frente: 'F23', colhedora: 0, trator: null });
  });
});

describe('períodos sem manutenção', () => {
  it('classifica manutenção, sem manutenção e dados insuficientes', () => {
    const [f] = maintenanceWindows([
      seg('a', 'C1', '22', 'colhedora', 'producao', 0, 4),
      seg('b', 'T1', '22', 'trator', 'producao', 0, 2),
      seg('c', 'T1', '22', 'trator', 'parada', 2, 3, true),
    ], T0, T0 + 4 * H);
    expect(f.windows.map(w => [w.status, w.durMin])).toEqual([['sem_manutencao', 120], ['manutencao', 60], ['insuficiente', 60]]);
  });
});

describe('rankings de manutenção', () => {
  it('ordena por ocorrências, depois tempo, e marca dados incompletos como não avaliáveis', () => {
    const r = maintenanceRanking([
      seg('m1', 'A', '22', 'colhedora', 'parada', 0, 2, true),
      seg('p', 'A', '22', 'colhedora', 'producao', 2, 10),
      seg('m2', 'B', '22', 'colhedora', 'parada', 0, 1, true),
      seg('p2', 'B', '22', 'colhedora', 'producao', 1, 10),
      seg('m3', 'C', '23', 'colhedora', 'parada', 0, 1, true),
      seg('m4', 'C', '23', 'colhedora', 'parada', 1, 2, true),
      seg('p3', 'C', '23', 'colhedora', 'producao', 2, 10),
      seg('x', 'D', '23', 'colhedora', 'producao', 0, 1),
      seg('t', 'T1', '22', 'trator', 'producao', 0, 10),
    ], 'colhedora', 600);
    expect(r.map(x => [x.posicao, x.frota, x.ocorrencias])).toEqual([[1, 'B', 1], [2, 'A', 1], [3, 'C', 2], [null, 'D', 0]]);
  });
  it('não conta minutos sobrepostos duas vezes', () => {
    expect(unionMinutes([[0, 2 * H], [H, 3 * H]])).toBe(180);
  });
});
