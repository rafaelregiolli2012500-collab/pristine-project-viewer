/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { MaintenanceRecord, NULL_STOP_REASON } from '@/types/maintenance';

/** Converte com segurança um valor qualquer em ISO válido, ou null. */
export function toSafeIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/** Combina data (yyyy-mm-dd) + hora (HH:mm) em ISO. Nunca lança exceção. */
export function combineDateTime(dateInput: string, timeStr: string): string | null {
  if (!dateInput || !timeStr) return null;
  const [y, mo, d] = dateInput.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  if (![y, mo, d, h, m].every(n => Number.isFinite(n))) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23 || m < 0 || m > 59) return null;
  const date = new Date(y, mo - 1, d, h, m, 0, 0);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.toISOString();
}

export interface ValidationResult {
  ok: boolean;
  /** Mensagem específica do problema encontrado. */
  error?: string;
}

/**
 * Valida datas/horários de uma manutenção.
 * Bloqueia apenas combinações realmente inválidas.
 */
export function validateTimes(inicio: string | null, fim: string | null | undefined): ValidationResult {
  if (!inicio) {
    return { ok: false, error: 'Data inválida: verifique a data e o horário informados para o início da manutenção.' };
  }
  const startIso = toSafeIso(inicio);
  if (!startIso) {
    return { ok: false, error: 'Data inválida: verifique a data informada para o início da manutenção.' };
  }
  if (fim != null && fim !== '') {
    const endIso = toSafeIso(fim);
    if (!endIso) {
      return { ok: false, error: 'Data inválida: verifique a data informada para o término da manutenção.' };
    }
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      return {
        ok: false,
        error: 'A data e o horário informados são inválidos. A data e o horário de término não podem ser anteriores ao início da manutenção.',
      };
    }
  }
  return { ok: true };
}

/**
 * Sanitiza um registro vindo do armazenamento. Retorna null quando o registro
 * é irrecuperável (assim ele é descartado sem quebrar o carregamento).
 */
export function sanitizeRecord(raw: any): MaintenanceRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const inicio = toSafeIso(raw.inicioTime);
  if (!inicio) return null;
  let fim = toSafeIso(raw.fimTime);
  if (fim && new Date(fim).getTime() < new Date(inicio).getTime()) {
    // registro corrompido por edição inválida anterior: reabre a parada
    fim = null;
  }
  const status: MaintenanceRecord['status'] = fim ? 'finalizado' : 'em_manutencao';
  return {
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    inicioTime: inicio,
    fimTime: fim,
    status,
    // preserva "NULL" (tipo ainda não definido) sem forçar um motivo oficial
    stopReason: raw.stopReason === NULL_STOP_REASON ? NULL_STOP_REASON : raw.stopReason || 'manutencao',
  } as MaintenanceRecord;
}
