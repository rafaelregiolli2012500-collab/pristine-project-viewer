/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
/**
 * Global "system time" store.
 *
 * Two modes:
 *  - realtime: getNow() returns real wall clock (new Date()).
 *  - historical_locked: getNow() returns a frozen operational moment derived
 *    from a chosen historical operational day (date string yyyy-mm-dd).
 *    Locked "now" is the END of that operational day (05:59:59 of day+1).
 *
 * Components subscribe via useSystemTime(). Non-react code can call
 * getOperationalNow() directly (synchronous).
 *
 * Persistence: localStorage('system_time_mode').
 */

import { useSyncExternalStore } from 'react';

export type SystemTimeMode = 'realtime' | 'historical_locked';

interface State {
  mode: SystemTimeMode;
  /** yyyy-mm-dd — operational day key (date when operational day starts at 06:00). */
  lockedDate: string | null;
}

const STORAGE_KEY = 'system_time_mode';

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && (p.mode === 'realtime' || p.mode === 'historical_locked')) {
        return { mode: p.mode, lockedDate: p.lockedDate ?? null };
      }
    }
  } catch {}
  return { mode: 'realtime', lockedDate: null };
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function emit() {
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): State {
  return state;
}

/**
 * Resolve current "now" depending on mode.
 *  - realtime → new Date()
 *  - locked   → 05:59:59 of (lockedDate + 1) — i.e. end of operational day.
 */
export function getOperationalNow(): Date {
  if (state.mode === 'historical_locked' && state.lockedDate) {
    const [y, m, d] = state.lockedDate.split('-').map(Number);
    // Operational day = 06:00 day → 05:59:59 of day+1
    const end = new Date(y, (m || 1) - 1, d || 1);
    end.setDate(end.getDate() + 1);
    end.setHours(5, 59, 59, 999);
    return end;
  }
  return new Date();
}

export function isLocked(): boolean {
  return state.mode === 'historical_locked' && !!state.lockedDate;
}

export function setSystemMode(mode: SystemTimeMode, lockedDate: string | null = null) {
  state = { mode, lockedDate: mode === 'historical_locked' ? lockedDate : null };
  persist();
  emit();
}

/** React hook — re-renders when mode/lockedDate change. */
export function useSystemTime() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    mode: s.mode,
    lockedDate: s.lockedDate,
    isLocked: s.mode === 'historical_locked' && !!s.lockedDate,
    getNow: getOperationalNow,
    setMode: setSystemMode,
  };
}

/** Lista de chaves yyyy-mm-dd presentes no histórico (ordenadas desc). */
export function getAvailableOperationalDates(records: Array<{ inicioTime?: string; fimTime?: string }>): string[] {
  const set = new Set<string>();
  const addKey = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return;
    const x = new Date(d);
    if (x.getHours() < 6) x.setDate(x.getDate() - 1);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    set.add(`${y}-${m}-${day}`);
  };
  records.forEach(r => {
    if (r.inicioTime) addKey(r.inicioTime);
    if (r.fimTime) addKey(r.fimTime);
  });
  return Array.from(set).sort().reverse();
}
