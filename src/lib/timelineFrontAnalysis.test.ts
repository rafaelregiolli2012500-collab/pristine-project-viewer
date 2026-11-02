import { describe, expect, it } from 'vitest';
import { stopCountsByFront, maintenanceWindows, maintenanceRanking, unionMinutes, type AnalysisSegment } from './timelineFrontAnalysis';

const H = 3600000, T0 = new Date(2026, 9, 9, 6).getTime();
const seg = (id: string, equipamento: string, frente: string, categoria: AnalysisSegment['categoria'], category: string, h0: number, h1: number, manutencao = false): AnalysisSegment =>
  ({ id, equipamento, frente, categoria, category, clipStart: new Date(T0 + h0 * H), clipEnd: new Date(T0 + h1 * H), manutencao });

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
