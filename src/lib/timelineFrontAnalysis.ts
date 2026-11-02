/**
 * Camada de análise da Linha do Tempo (somente leitura).
 * Recebe os segmentos JÁ recortados pelo pipeline oficial (período, turnos e filtros)
 * e nunca altera as bases originais.
 */
import { frontKey } from './timelineFrontComparison';

export type AnalysisBase = 'colhedora' | 'trator' | 'canavieiro';

export interface AnalysisSegment {
  id: string;            // "<idEvento>@<inicioRecorte>" — o id do evento é a parte antes do "@"
  equipamento: string;
  frente: string;
  categoria: AnalysisBase;
  category: string;      // producao | parada | deslocamento | manobra | standby | outros
  clipStart: Date;
  clipEnd: Date;
  manutencao: boolean;   // parada classificada como manutenção pela regra existente
}

/** Id único da ocorrência: recortes do mesmo evento compartilham este id. */
export const eventId = (s: { id: string }) => s.id.split('@')[0];

const mins = (s: AnalysisSegment) => (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
const sortFronts = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/** Soma de intervalos sem contar minutos sobrepostos duas vezes. */
export function unionMinutes(ranges: Array<[number, number]>): number {
  const sorted = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, curS = -Infinity, curE = -Infinity;
  for (const [a, b] of sorted) {
    if (a > curE) { if (curE > curS) total += curE - curS; curS = a; curE = b; }
    else curE = Math.max(curE, b);
  }
  if (curE > curS) total += curE - curS;
  return total / 60000;
}

/**
 * Quantidade de ocorrências de parada por frente e base.
 * `null` = base sem nenhum registro na frente (ausência de dados ≠ zero).
 */
export function stopCountsByFront(segs: AnalysisSegment[], bases: AnalysisBase[]) {
  const seen = new Map<string, Map<AnalysisBase, Set<string>>>();
  for (const s of segs) {
    if (!bases.includes(s.categoria)) continue;
    const f = frontKey(s.frente);
    const byBase = seen.get(f) ?? new Map<AnalysisBase, Set<string>>();
    const ids = byBase.get(s.categoria) ?? new Set<string>();
    if (s.category === 'parada') ids.add(eventId(s));
    byBase.set(s.categoria, ids);
    seen.set(f, byBase);
  }
  return [...seen.keys()].sort(sortFronts).map(f => {
    const row: Record<string, string | number | null> = { frente: `F${f}` };
    for (const b of bases) row[b] = seen.get(f)!.has(b) ? seen.get(f)!.get(b)!.size : null;
    return row;
  });
}

export type WindowStatus = 'sem_manutencao' | 'manutencao' | 'insuficiente';
export interface FrontWindow {
  frente: string; status: WindowStatus; start: number; end: number; durMin: number;
  equipamentos: number; categorias: AnalysisBase[]; ocorrencias: number;
}

/**
 * Períodos por frente: "manutencao" se algum equipamento da frente estava em manutenção;
 * "sem_manutencao" somente se TODOS os equipamentos da frente têm registro cobrindo o
 * intervalo e nenhum está em manutenção; caso contrário "insuficiente".
 */
export function maintenanceWindows(segs: AnalysisSegment[], rangeStart: number, rangeEnd: number) {
  const byFront = new Map<string, AnalysisSegment[]>();
  for (const s of segs) {
    const f = frontKey(s.frente);
    const arr = byFront.get(f) ?? [];
    arr.push(s); byFront.set(f, arr);
  }
  const out: Array<{ frente: string; windows: FrontWindow[] }> = [];
  for (const f of [...byFront.keys()].sort(sortFronts)) {
    const items = byFront.get(f)!;
    const equips = new Set(items.map(s => `${s.categoria}|${s.equipamento}`));
    const cats = [...new Set(items.map(s => s.categoria))];
    const points = new Set<number>([rangeStart, rangeEnd]);
    for (const s of items) {
      points.add(Math.max(rangeStart, Math.min(rangeEnd, s.clipStart.getTime())));
      points.add(Math.max(rangeStart, Math.min(rangeEnd, s.clipEnd.getTime())));
    }
    const pts = [...points].sort((a, b) => a - b);
    const windows: FrontWindow[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (b <= a) continue;
      const covering = items.filter(s => s.clipStart.getTime() < b && s.clipEnd.getTime() > a);
      const maint = covering.filter(s => s.manutencao);
      const covered = new Set(covering.map(s => `${s.categoria}|${s.equipamento}`));
      const status: WindowStatus = maint.length ? 'manutencao' : covered.size === equips.size ? 'sem_manutencao' : 'insuficiente';
      const maintIds = new Set(maint.map(eventId));
      const last = windows[windows.length - 1];
      if (last && last.status === status && last.end === a) {
        last.end = b; last.durMin = (b - last.start) / 60000;
        const ids = (last as FrontWindow & { _ids: Set<string> })._ids;
        maintIds.forEach(id => ids.add(id)); last.ocorrencias = ids.size;
      } else {
        const w = { frente: f, status, start: a, end: b, durMin: (b - a) / 60000, equipamentos: equips.size, categorias: cats, ocorrencias: maintIds.size, _ids: maintIds };
        windows.push(w);
      }
    }
    out.push({ frente: f, windows: windows.map(({ _ids, ...w }: FrontWindow & { _ids?: Set<string> }) => w) });
  }
  return out;
}

export interface RankingRow {
  posicao: number | null; frota: string; frente: string; ocorrencias: number;
  minutosManutencao: number; minutosComDados: number; avaliavel: boolean;
}

/**
 * Ranking de menor manutenção: ocorrências únicas ↑, depois minutos ↑, depois frota.
 * Equipamentos com registros cobrindo menos de `minCoverage` do período ficam
 * como "não avaliáveis" (sem posição), para não premiar dados incompletos.
 */
export function maintenanceRanking(segs: AnalysisSegment[], base: AnalysisBase, periodMin: number, minCoverage = 0.5): RankingRow[] {
  const map = new Map<string, { frentes: Set<string>; ids: Set<string>; manut: number; ranges: Array<[number, number]> }>();
  for (const s of segs) {
    if (s.categoria !== base) continue;
    const cur = map.get(s.equipamento) ?? { frentes: new Set<string>(), ids: new Set<string>(), manut: 0, ranges: [] };
    cur.frentes.add(frontKey(s.frente));
    cur.ranges.push([s.clipStart.getTime(), s.clipEnd.getTime()]);
    if (s.manutencao) { cur.ids.add(eventId(s)); cur.manut += mins(s); }
    map.set(s.equipamento, cur);
  }
  const rows = [...map.entries()].map(([frota, v]) => {
    const cov = unionMinutes(v.ranges);
    return {
      posicao: null as number | null, frota,
      frente: [...v.frentes].sort(sortFronts).map(f => `F${f}`).join(', '),
      ocorrencias: v.ids.size, minutosManutencao: v.manut, minutosComDados: cov,
      avaliavel: periodMin > 0 && cov / periodMin >= minCoverage,
    };
  });
  const cmp = (a: RankingRow, b: RankingRow) =>
    a.ocorrencias - b.ocorrencias || a.minutosManutencao - b.minutosManutencao || a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true });
  const ok = rows.filter(r => r.avaliavel).sort(cmp).map((r, i) => ({ ...r, posicao: i + 1 }));
  return [...ok, ...rows.filter(r => !r.avaliavel).sort(cmp)];
}
