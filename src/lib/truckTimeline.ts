/** Browser-safe truck observations and one shared interval calculation pipeline. */
export const truckNorm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\uFEFF/, '').trim().toUpperCase();
export interface TruckPoint {
  equipamento: string; dt: Date; descricao: string; frente: string; grupoFrente: string;
  operacao: string; estado: string; estadoOp: string; operador: string;
  horimetro: number; velocidade: number; categoria: 'canavieiro';
  grupoOperacao: string; hodometro: number | null; rpm: number | null; motorLigado: 0 | 1 | null;
}
export interface TruckImport {
  rows: TruckPoint[]; totalLines: number; invalid: number; duplicates: number;
  headerDetected: boolean; delimiter: string; missingColumns: string[]; issues: string[];
}
export function truckNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const normalized = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized); return Number.isFinite(n) && n >= 0 ? n : null;
}
export function truckDate(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (m) {
    const [, day, month, year, hour, minute, second = '0'] = m;
    const d = new Date(+year, +month - 1, +day, +hour, +minute, +second);
    return d.getFullYear() === +year && d.getMonth() === +month - 1 && d.getDate() === +day && d.getHours() === +hour && d.getMinutes() === +minute && d.getSeconds() === +second ? d : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return null;
  const d = new Date(value); return Number.isFinite(d.getTime()) ? d : null;
}
function cellsOf(line: string, delimiter: string): string[] {
  const out: string[] = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { out.push(cell.trim()); cell = ''; } else cell += c;
  }
  out.push(cell.trim()); return out;
}
export function parseTruckBase(text: string): TruckImport {
  const lines = text.split(/\r?\n/).map((line, i) => ({ line, number: i + 1 })).filter(x => x.line.trim());
  const first = lines[0]?.line ?? '';
  const delimiter = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const header = cellsOf(first, delimiter).map(truckNorm);
  const required = ['EQUIPAMENTO', 'DATA/HORA', 'ESTADO', 'OPERACAO'];
  const optional = ['ESTADO OPERACIONAL', 'GRUPO OPERACAO', 'VELOCIDADE', 'HODOMETRO', 'MOTOR LIGADO', 'RPM MOTOR'];
  const headerDetected = header.includes('EQUIPAMENTO');
  const missingColumns = [...required, ...optional].filter(k => !header.includes(k));
  const result: TruckImport = { rows: [], totalLines: Math.max(0, lines.length - (headerDetected ? 1 : 0)), invalid: 0, duplicates: 0, headerDetected, delimiter, missingColumns, issues: [] };
  if (!headerDetected || required.some(k => !header.includes(k))) {
    result.invalid = result.totalLines; result.issues.push('Cabeçalho obrigatório: Equipamento, Data/Hora, Estado e Operacao.'); return result;
  }
  const index = new Map(header.map((key, i) => [key, i]));
  const seen = new Set<string>();
  for (const { line, number } of lines.slice(1)) {
    const c = cellsOf(line, delimiter);
    const get = (key: string) => { const i = index.get(key); return i === undefined ? '' : c[i] ?? ''; };
    const dt = truckDate(get('DATA/HORA')), equipamento = get('EQUIPAMENTO');
    if (!dt || !equipamento || c.length !== header.length) {
      result.invalid++; if (result.issues.length < 100) result.issues.push(`Linha ${number}: equipamento, data/hora ou número de campos inválido.`); continue;
    }
    const key = JSON.stringify(c);
    if (seen.has(key)) { result.duplicates++; continue; } seen.add(key);
    const motor = get('MOTOR LIGADO');
    result.rows.push({ equipamento, dt, descricao: get('DESCRICAO EQUIPAMENTO'), frente: 'SEM', grupoFrente: '', operacao: get('OPERACAO'), estado: get('ESTADO'), estadoOp: get('ESTADO OPERACIONAL'), operador: get('OPERADOR'), horimetro: 0, velocidade: truckNumber(get('VELOCIDADE')) ?? NaN, categoria: 'canavieiro', grupoOperacao: get('GRUPO OPERACAO'), hodometro: truckNumber(get('HODOMETRO')), rpm: truckNumber(get('RPM MOTOR')), motorLigado: motor === '1' ? 1 : motor === '0' ? 0 : null });
  }
  return result;
}
export type TruckClass = 'produtiva' | 'improdutivo' | 'manutencao' | 'naoClassificado';
export function truckClass(p: TruckPoint): TruckClass {
  const group = truckNorm(p.grupoOperacao), state = truckNorm(p.estado);
  if (group === 'MANUTENCAO' && state === 'PARADA') return 'manutencao';
  if (['IMPRODUTIVO', 'AUXILIAR', 'STANDY-BY', 'STAND-BY', 'CLIMATICO'].includes(group) && ['PARADA', 'DESLOCAMENTO'].includes(state)) return 'improdutivo';
  if (group === 'PRODUTIVA' && ['PARADA', 'DESLOCAMENTO'].includes(state) && p.estadoOp.trim() && p.operacao.trim()) return 'produtiva';
  return 'naoClassificado';
}
export interface TruckPair { point: TruckPoint; next: TruckPoint; start: number; end: number; conflict: boolean }
export function prepareTruckBase(rows: TruckPoint[]) {
  const byFleet = new Map<string, TruckPoint[]>();
  for (const p of rows) { const list = byFleet.get(p.equipamento) ?? []; list.push(p); byFleet.set(p.equipamento, list); }
  const pairs: TruckPair[] = []; let conflicts = 0;
  for (const list of byFleet.values()) {
    list.sort((a, b) => a.dt.getTime() - b.dt.getTime());
    for (let i = 0; i < list.length - 1; i++) {
      const point = list[i], next = list[i + 1];
      const start = point.dt.getTime(), end = next.dt.getTime();
      if (end <= start) { conflicts++; continue; }
      // Conflicting observations at the same instant invalidate the following interval.
      const conflict = i > 0 && list[i - 1].dt.getTime() === start;
      pairs.push({ point, next, start, end, conflict });
    }
  }
  const sorted = [...rows].sort((a, b) => a.dt.getTime() - b.dt.getTime());
  return { rows: sorted, pairs, start: sorted[0]?.dt.getTime() ?? 0, end: sorted.at(-1)?.dt.getTime() ?? 0, conflicts };
}
export interface TruckFilters { start: number; end: number; fleet: string; shift: string; operation: string; state: string; operationalState: string; group: string; motor: string; maxGapMinutes: number; speedBins: number[] }
export function truckShift(ms: number) { const h = new Date(ms).getHours(); return h >= 6 && h < 14 ? 'A' : h >= 14 && h < 22 ? 'B' : 'C'; }
function windows(start: number, end: number, shift: string): [number, number][] {
  if (!shift) return end > start ? [[start, end]] : [];
  const chunks: [number, number][] = []; let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    const until = Math.min(end, d.getTime());
    if (truckShift(cursor) === shift) chunks.push([cursor, until]);
    cursor = until;
  }
  return chunks;
}
const match = (p: TruckPoint, f: TruckFilters) => (!f.fleet || p.equipamento === f.fleet) && (!f.operation || p.operacao === f.operation) && (!f.state || p.estado === f.state) && (!f.operationalState || p.estadoOp === f.operationalState) && (!f.group || p.grupoOperacao === f.group) && (!f.motor || String(p.motorLigado) === f.motor);
export const truckPercent = (a: number, b: number) => b > 0 ? a * 100 / b : 0;
export interface TruckStats {
  name: string; records: number; stopRecords: number; stopOccurrences: number; stop: number; move: number; gap: number; other: number;
  produtiva: number; improdutivo: number; manutencao: number; naoClassificado: number;
  motorOn: number; motorOff: number; motorUnknown: number; distance: number; distancePairs: number;
  zero: number; speedKnownMove: number; speedSum: number; speedCount: number; maxSpeed: number | null; fleets: Set<string>; groups: Set<string>;
}
const stats = (name: string): TruckStats => ({ name, records: 0, stopRecords: 0, stopOccurrences: 0, stop: 0, move: 0, gap: 0, other: 0, produtiva: 0, improdutivo: 0, manutencao: 0, naoClassificado: 0, motorOn: 0, motorOff: 0, motorUnknown: 0, distance: 0, distancePairs: 0, zero: 0, speedKnownMove: 0, speedSum: 0, speedCount: 0, maxSpeed: null, fleets: new Set(), groups: new Set() });
export function analyzeTrucks(base: ReturnType<typeof prepareTruckBase>, f: TruckFilters) {
  const total = stats('Total'), fleets = new Map<string, TruckStats>(), operations = new Map<string, TruckStats>();
  const cargo = [stats('Transporte vazio'), stats('Transporte carregado')];
  const hourly = new Map<number, { time: number; paradaRecords: number; deslocamentoRecords: number; paradaHours: number; deslocamentoHours: number; gapHours: number }>();
  const histogram = f.speedBins.map((upper, i) => ({ name: i ? `>${f.speedBins[i - 1]}–${upper}` : `0–${upper}`, upper, parada: 0, deslocamento: 0, outros: 0, records: 0, pct: 0 }));
  histogram.push({ name: `>${f.speedBins.at(-1) ?? 0}`, upper: Infinity, parada: 0, deslocamento: 0, outros: 0, records: 0, pct: 0 });
  const hour = (ms: number) => { const d = new Date(ms); d.setMinutes(0, 0, 0); const time = d.getTime(); let v = hourly.get(time); if (!v) { v = { time, paradaRecords: 0, deslocamentoRecords: 0, paradaHours: 0, deslocamentoHours: 0, gapHours: 0 }; hourly.set(time, v); } return v; };
  const targets = (p: TruckPoint) => {
    let fleet = fleets.get(p.equipamento); if (!fleet) { fleet = stats(p.equipamento); fleets.set(p.equipamento, fleet); }
    const name = p.operacao || 'Operação não informada'; let operation = operations.get(name); if (!operation) { operation = stats(name); operations.set(name, operation); }
    const state = truckNorm(p.estadoOp);
    return [total, fleet, operation, ...(state === 'TRANSPORTE CANA VAZIO' ? [cargo[0]] : state === 'TRANSPORTE CANA CARREGADO' ? [cargo[1]] : [])];
  };
  const filtered = base.rows.filter(p => p.dt.getTime() >= f.start && p.dt.getTime() <= f.end && (!f.shift || truckShift(p.dt.getTime()) === f.shift) && match(p, f));
  let stopRecords = 0, moveRecords = 0, validSpeeds = 0;
  for (const p of filtered) {
    const state = truckNorm(p.estado); const stop = state === 'PARADA', move = state === 'DESLOCAMENTO';
    if (stop) stopRecords++; if (move) moveRecords++;
    const h = hour(p.dt.getTime()); if (stop) h.paradaRecords++; if (move) h.deslocamentoRecords++;
    for (const v of targets(p)) {
      v.records++; if (stop) v.stopRecords++; v.fleets.add(p.equipamento); if (p.grupoOperacao) v.groups.add(p.grupoOperacao);
      if (Number.isFinite(p.velocidade)) { v.maxSpeed = Math.max(v.maxSpeed ?? 0, p.velocidade); if (move) { v.speedSum += p.velocidade; v.speedCount++; } }
    }
    if (Number.isFinite(p.velocidade)) { validSpeeds++; const bin = histogram.find(b => p.velocidade <= b.upper); if (bin) { bin.records++; bin[stop ? 'parada' : move ? 'deslocamento' : 'outros']++; } }
  }
  let badOdometer = 0, gapIntervals = 0, motorChanges = 0;
  const lastStops = new Map<string, { end: number; operation: string; operationalState: string }>();
  for (const pair of base.pairs) {
    if (!match(pair.point, f)) continue;
    const a = Math.max(pair.start, f.start), b = Math.min(pair.end, f.end);
    if (b <= a) continue;
    const clipped = windows(a, b, f.shift); if (!clipped.length) continue;
    const gap = pair.conflict || pair.end - pair.start > f.maxGapMinutes * 60000;
    if (gap) gapIntervals++;
    const p = pair.point, state = truckNorm(p.estado), category = truckClass(p);
    const odo = p.hodometro !== null && pair.next.hodometro !== null ? pair.next.hodometro - p.hodometro : null;
    // 150 km/h is only a consistency ceiling for odometer differences, not an operational speed rule.
    const distanceValid = !gap && odo !== null && odo >= 0 && odo / ((pair.end - pair.start) / 3600000) <= 150;
    if (!gap && odo !== null && !distanceValid) badOdometer++;
    if (!gap && state === 'PARADA' && p.motorLigado !== pair.next.motorLigado) motorChanges++;
    for (const [s, e] of clipped) {
      const hours = (e - s) / 3600000;
      const last = lastStops.get(p.equipamento);
      const newStop = !gap && state === 'PARADA' && (!last || last.end !== s || last.operation !== p.operacao || last.operationalState !== p.estadoOp);
      if (!gap && state === 'PARADA') lastStops.set(p.equipamento, { end: e, operation: p.operacao, operationalState: p.estadoOp });
      else lastStops.delete(p.equipamento);
      for (const v of targets(p)) {
        v.fleets.add(p.equipamento);
        if (gap) { v.gap += hours; continue; }
        v[state === 'PARADA' ? 'stop' : state === 'DESLOCAMENTO' ? 'move' : 'other'] += hours;
        v[category] += hours;
        if (newStop) v.stopOccurrences++;
        if (state === 'PARADA') v[p.motorLigado === 1 ? 'motorOn' : p.motorLigado === 0 ? 'motorOff' : 'motorUnknown'] += hours;
        if (state === 'DESLOCAMENTO' && p.velocidade === 0) v.zero += hours;
        if (state === 'DESLOCAMENTO' && Number.isFinite(p.velocidade)) v.speedKnownMove += hours;
        if (distanceValid && odo !== null) { v.distance += odo * (e - s) / (pair.end - pair.start); v.distancePairs++; }
      }
      let cursor = s;
      while (cursor < e) {
        const h = hour(cursor); const end = Math.min(e, h.time + 3600000); const duration = (end - cursor) / 3600000;
        if (gap) h.gapHours += duration; else if (state === 'PARADA') h.paradaHours += duration; else if (state === 'DESLOCAMENTO') h.deslocamentoHours += duration;
        cursor = end;
      }
    }
  }
  for (const bin of histogram) bin.pct = truckPercent(bin.records, validSpeeds);
  const pointHours = new Set(filtered.map(p => { const d = new Date(p.dt); d.setMinutes(0, 0, 0); return d.getTime(); }));
  const hours = [...hourly.values()].sort((a, b) => a.time - b.time).map(h => {
    const hasPoints = pointHours.has(h.time);
    return { ...h, paradaRecords: hasPoints ? h.paradaRecords : null, deslocamentoRecords: hasPoints ? h.deslocamentoRecords : null,
      paradaHours: h.paradaHours + h.deslocamentoHours === 0 && !hasPoints ? null : h.paradaHours,
      deslocamentoHours: h.paradaHours + h.deslocamentoHours === 0 && !hasPoints ? null : h.deslocamentoHours };
  });
  // Preserve missing hours as null rather than inventing zeros; cap only visual buckets, never analyzed observations.
  const hourlySeries: Array<(typeof hours)[number] | { time: number; paradaRecords: null; deslocamentoRecords: null; paradaHours: null; deslocamentoHours: null; gapHours: null }> = [];
  for (let i = 0; i < hours.length; i++) { if (i && hours[i].time - hours[i - 1].time > 3600000) hourlySeries.push({ time: hours[i - 1].time + 3600000, paradaRecords: null, deslocamentoRecords: null, paradaHours: null, deslocamentoHours: null, gapHours: null }); hourlySeries.push(hours[i]); }
  return { total, fleetCount: new Set(filtered.map(p => p.equipamento)).size, fleets: [...fleets.values()], operations: [...operations.values()], cargo, hourly: hourlySeries, histogram, filtered, stopRecords, moveRecords, gapIntervals, badOdometer, motorChanges, first: filtered[0]?.dt, last: filtered.at(-1)?.dt };
}
