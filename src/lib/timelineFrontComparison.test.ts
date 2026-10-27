import { describe, expect, it } from 'vitest';
import { buildFrontComparison, shouldSplitStopLines, frontKey } from './timelineFrontComparison';

describe('comparação de paradas por frente', () => {
  it('separa as paradas de colhedoras e tratores na mesma frente sem mudar a produção somada', () => {
    const data = buildFrontComparison(
      [{ frente: '22', totals: { producao: 360, parada: 180 } }],
      [{ frente: '22', totals: { producao: 240, parada: 120 } }],
      [{ frente: '22', totals: { producao: 120, parada: 60 } }],
    );
    expect(data).toEqual([{ frente: 'F22', producao: 6, parada: 3, paradaColhedoras: 2, paradaTratores: 1 }]);
  });

  it('não mistura paradas entre frentes e mantém zero quando uma base não tem eventos na frente', () => {
    const data = buildFrontComparison(
      [
        { frente: '08', totals: { producao: 60, parada: 30 } },
        { frente: '22', totals: { producao: 120, parada: 90 } },
      ],
      [{ frente: '08', totals: { producao: 60, parada: 30 } }],
      [{ frente: '22', totals: { producao: 120, parada: 90 } }],
    );
    expect(data.map(s => [s.frente, s.paradaColhedoras, s.paradaTratores])).toEqual([
      ['F08', 0.5, 0], ['F22', 0, 1.5],
    ]);
  });

  it('separa as linhas somente na comparação somada com as duas bases carregadas', () => {
    expect(shouldSplitStopLines('auto', true, true)).toBe(true);
    expect(shouldSplitStopLines('auto', true, false)).toBe(false);
    expect(shouldSplitStopLines('auto', false, true)).toBe(false);
    expect(shouldSplitStopLines('colhedora', true, true)).toBe(false);
    expect(shouldSplitStopLines('trator', true, true)).toBe(false);
  });

  it('preserva os valores das linhas individuais de produção e paradas', () => {
    const [data] = buildFrontComparison([{ frente: '22', totals: { producao: 150, parada: 45 } }]);
    expect(data.producao).toBe(2.5);
    expect(data.parada).toBe(0.75);
  });
});
describe('chave da frente', () => {
  it('une variações da mesma frente sem repetir', () => {
    expect(['22', 'F22', 'F-022', 'FRENTE 22', 'Frente 022', 'GRUPO FRENTE 22'].map(frontKey)).toEqual(['22','22','22','22','22','22']);
  });
});
