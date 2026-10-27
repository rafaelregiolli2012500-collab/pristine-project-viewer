/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import * as XLSX from 'xlsx';
import { MaintenanceRecord, EquipmentType, STOP_REASON_LABELS, StopReason } from '@/types/maintenance';
import { getOperationalDayKey, getOperationalDayStart } from '@/lib/operationalDay';
import { getOperationalNow, isLocked } from '@/hooks/useSystemTime';

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  colhedora: 'Colhedora',
  trator: 'Trator',
  transbordo: 'Transbordo',
  caminhao: 'Caminhão',
};

export interface ExcelExportOptions {
  types: EquipmentType[];
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDateTime(d: Date) {
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Data operacional de referência (travada ou tempo real) — mesma base do cronograma. */
export function getExportContext() {
  const now = getOperationalNow();
  const dayStart = getOperationalDayStart(now);
  return {
    locked: isLocked(),
    dayKey: getOperationalDayKey(now),
    dayStart,
    now,
    dayLabel: fmtDate(dayStart),
  };
}

/** Para exportação, transbordo é tratado como trator. */
function exportTypeOf(type: EquipmentType): EquipmentType {
  return type === 'transbordo' ? 'trator' : type;
}

export function selectRecordsForExport(records: MaintenanceRecord[], types: EquipmentType[]) {
  const { dayKey, now } = getExportContext();
  const exportTypes = new Set(types.map(exportTypeOf));
  return records
    .filter(r => {
      if (!exportTypes.has(exportTypeOf(r.equipmentType))) return false;
      const ini = new Date(r.inicioTime);
      if (isNaN(ini.getTime())) return false;
      if (ini.getTime() > now.getTime()) return false; // sem registros futuros
      return getOperationalDayKey(ini) === dayKey;
    })
    .sort((a, b) => {
      const ta = new Date(a.inicioTime).getTime();
      const tb = new Date(b.inicioTime).getTime();
      if (ta !== tb) return ta - tb;
      return a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true });
    });
}

export function generateMaintenanceWorkbook(records: MaintenanceRecord[], types: EquipmentType[]) {
  const ctx = getExportContext();
  const nowMs = ctx.now.getTime();
  const list = selectRecordsForExport(records, types);

  const rows = list.map(r => {
    const ini = new Date(r.inicioTime);
    const fim = r.fimTime ? new Date(r.fimTime) : null;
    const endMs = fim && !isNaN(fim.getTime()) ? Math.min(fim.getTime(), nowMs) : nowMs;
    const dur = endMs - ini.getTime();
    const aberta = !fim || isNaN(fim.getTime());
    return {
      DATA: fmtDate(getOperationalDayStart(ini)),
      FROTA: r.frota,
      'TIPO DE EQUIPAMENTO': EQUIPMENT_LABELS[r.equipmentType] ?? r.equipmentType,
      FRENTE: r.frente || '',
      'TIPO DE MANUTENÇÃO': STOP_REASON_LABELS[r.stopReason as StopReason] ?? r.stopReason ?? '',
      MOTIVO: r.motivo || '',
      'INÍCIO': fmtDateTime(ini),
      FINAL: aberta ? 'EM ABERTO' : fmtDateTime(fim!),
      'TEMPO TOTAL': fmtDuration(dur),
      STATUS: aberta ? 'EM ANDAMENTO' : 'FINALIZADA',
      _type: exportTypeOf(r.equipmentType),
      _reason: STOP_REASON_LABELS[r.stopReason as StopReason] ?? r.stopReason ?? '—',
      _ms: dur,
    };
  });

  const visible = rows.map(({ _type, _reason, _ms, ...rest }) => rest);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(visible, {
    header: ['DATA', 'FROTA', 'TIPO DE EQUIPAMENTO', 'FRENTE', 'TIPO DE MANUTENÇÃO', 'MOTIVO', 'INÍCIO', 'FINAL', 'TEMPO TOTAL', 'STATUS'],
  });
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 26 },
    { wch: 70 }, { wch: 20 }, { wch: 20 }, { wch: 13 }, { wch: 15 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, visible.length), c: 9 } }) };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = 0; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'D9E1F2' } } };
  }
  for (let r = 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (cell) cell.s = { alignment: { wrapText: true, vertical: 'top' } };
  }
  XLSX.utils.book_append_sheet(wb, ws, 'HISTÓRICO');

  const totalMs = rows.reduce((a, r) => a + r._ms, 0);
  const byType = new Map<string, { n: number; ms: number }>();
  const byReason = new Map<string, { n: number; ms: number }>();
  rows.forEach(r => {
    const t = byType.get(r._type) ?? { n: 0, ms: 0 };
    byType.set(r._type, { n: t.n + 1, ms: t.ms + r._ms });
    const s = byReason.get(r._reason) ?? { n: 0, ms: 0 };
    byReason.set(r._reason, { n: s.n + 1, ms: s.ms + r._ms });
  });

  const resumo: (string | number)[][] = [
    ['RESUMO — HISTÓRICO DE MANUTENÇÕES'],
    ['Período', ctx.locked ? `DATA TRAVADA: ${ctx.dayLabel}` : `TEMPO REAL: ${ctx.dayLabel}`],
    ['Gerado em', fmtDateTime(new Date())],
    [],
    ['TOTAL DE MANUTENÇÕES', rows.length],
    ['TEMPO TOTAL DE PARADAS', fmtDuration(totalMs)],
    [],
    ['POR TIPO DE EQUIPAMENTO', 'OCORRÊNCIAS', 'TEMPO TOTAL'],
    ...types.map(t => {
      const v = byType.get(t) ?? { n: 0, ms: 0 };
      return [EQUIPMENT_LABELS[t], v.n, fmtDuration(v.ms)];
    }),
    [],
    ['POR TIPO DE MANUTENÇÃO', 'OCORRÊNCIAS', 'TEMPO TOTAL'],
    ...Array.from(byReason.entries())
      .sort((a, b) => b[1].ms - a[1].ms)
      .map(([k, v]) => [k, v.n, fmtDuration(v.ms)]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(resumo);
  ws2['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'RESUMO');

  const stamp = ctx.dayLabel.replace(/\//g, '-');
  const hhmm = `${pad(new Date().getHours())}${pad(new Date().getMinutes())}`;
  return { wb, ctx, count: rows.length, fileName: `HISTORICO_MANUTENCOES_${stamp}_${hhmm}.xlsx` };
}

export function downloadMaintenanceExcel(records: MaintenanceRecord[], types: EquipmentType[]) {
  const { wb, fileName, count, ctx } = generateMaintenanceWorkbook(records, types);
  XLSX.writeFile(wb, fileName);
  return { fileName, count, ctx };
}
