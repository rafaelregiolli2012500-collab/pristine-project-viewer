/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Janela por Horário Inicial / Horário Final dentro do ciclo operacional
 * 06:00 → 06:00 (24 horas). 06:00 → 06:00 significa o ciclo completo,
 * nunca zero horas.
 */

export const DEFAULT_HOUR_START = '06:00';
export const DEFAULT_HOUR_END = '06:00';

/** Converte HH:MM em offset (0..24) a partir das 06:00 do dia operacional. */
export function hourToOffset(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const opH = hh >= 6 ? hh - 6 : hh + 18;
  return opH + mm / 60;
}

/** Offsets (em horas a partir das 06:00) do período selecionado. */
export function getHourOffsets(start: string, end: string): { startOff: number; endOff: number } {
  const a = hourToOffset(start) ?? 0;
  const b = hourToOffset(end) ?? 24;
  // Período que fecha no mesmo horário (ou atravessa a virada) = ciclo completo/contínuo
  const endOff = b > a ? b : b + 24;
  return { startOff: a, endOff: Math.min(endOff, a + 24) };
}

/** Janela de datas do período selecionado, ancorada no início do dia operacional. */
export function getHourWindow(opStart: Date, start: string, end: string): { start: Date; end: Date } {
  const { startOff, endOff } = getHourOffsets(start, end);
  return {
    start: new Date(opStart.getTime() + startOff * 3_600_000),
    end: new Date(opStart.getTime() + endOff * 3_600_000),
  };
}
