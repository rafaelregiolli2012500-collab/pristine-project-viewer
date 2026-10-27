interface FrontTotals {
  frente: string;
  totals: { producao: number; parada: number };
}

export function shouldSplitStopLines(
  base: 'auto' | 'colhedora' | 'trator',
  hasHarvesters: boolean,
  hasTractors: boolean,
) {
  return base === 'auto' && hasHarvesters && hasTractors;
}

/** Recebe os resumos oficiais já recortados; apenas une as séries pela frente. */
export function buildFrontComparison(
  totals: FrontTotals[],
  harvesters: FrontTotals[] = [],
  tractors: FrontTotals[] = [],
) {
  const harvesterStops = new Map(harvesters.map(s => [s.frente, s.totals.parada]));
  const tractorStops = new Map(tractors.map(s => [s.frente, s.totals.parada]));
  return totals.map(s => ({
    frente: `F${s.frente}`,
    producao: s.totals.producao / 60,
    parada: s.totals.parada / 60,
    paradaColhedoras: (harvesterStops.get(s.frente) ?? 0) / 60,
    paradaTratores: (tractorStops.get(s.frente) ?? 0) / 60,
  }));
}
/** Chave única da frente: "22", "F22", "F-022", "FRENTE 22", "GRUPO FRENTE 22" -> "22". */
export function frontKey(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'SEM';
  const m = s.match(/^(?:frente|f)?\s*[-_.]?\s*0*(\d+)$/i) || s.match(/frente\s*[-_.]?\s*0*(\d+)/i);
  return m ? String(Number(m[1])) : s.toUpperCase();
}
