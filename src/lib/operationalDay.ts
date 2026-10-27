/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
/**
 * Dia operacional industrial: 06:00 → 05:59 (do dia seguinte).
 *
 * - Lógica: 00:00–05:59 pertence ao dia operacional iniciado às 06:00 do dia anterior.
 * - Visual: 00:00–05:59 deve ser exibido como o "novo dia" (data atual no calendário).
 *
 * Estas duas vertentes (lógica × visual) são tratadas separadamente, mas sincronizadas.
 */

export const OPERATIONAL_START_HOUR = 6;
export const OPERATIONAL_HOURS = 24; // 06:00 → 06:00 (24h)

/** Data de início (00:00) do dia operacional ao qual `d` pertence (lógica). */
export function getOperationalDayStart(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() < OPERATIONAL_START_HOUR) {
    x.setDate(x.getDate() - 1);
  }
  x.setHours(OPERATIONAL_START_HOUR, 0, 0, 0);
  return x;
}

/** Fim (exclusivo) do dia operacional de `d` — 06:00 do dia seguinte. */
export function getOperationalDayEnd(d: Date): Date {
  const start = getOperationalDayStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

/** Chave estável (yyyy-mm-dd) do dia operacional ao qual `d` pertence. */
export function getOperationalDayKey(d: Date): string {
  const s = getOperationalDayStart(d);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, '0');
  const day = String(s.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Data VISUAL: o que aparece para o usuário.
 * - Para 00:00–05:59 retorna o dia do calendário (o "novo dia"),
 *   mesmo que logicamente pertença ao dia operacional anterior.
 */
export function getVisualDate(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Hoje, dia operacional (Date apontando para 06:00 de início). */
export function getTodayOperationalStart(now: Date = new Date()): Date {
  return getOperationalDayStart(now);
}

/**
 * Offset em horas dentro do dia operacional (0 = 06:00, 24 = 06:00 do dia seguinte).
 * Permite valores fora do range para detectar "antes" / "depois" do ciclo.
 */
export function offsetInOperationalDay(d: Date, dayStart: Date): number {
  return (d.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
}

/** True se `d` cai no mesmo dia operacional de `ref`. */
export function isSameOperationalDay(d: Date, ref: Date): boolean {
  return getOperationalDayKey(d) === getOperationalDayKey(ref);
}

/** Formata HH:mm. */
export function formatHM(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Formata data real (dd/MM/yyyy). */
export function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}
