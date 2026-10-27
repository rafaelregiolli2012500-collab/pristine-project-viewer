/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect } from 'react';
import { useSystemTime } from './useSystemTime';

export function useTimer(startIso: string, endIso?: string) {
  const { getNow, isLocked, lockedDate } = useSystemTime();
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const start = new Date(startIso).getTime();
      const end = endIso ? new Date(endIso).getTime() : getNow().getTime();
      const diff = Math.max(0, end - start);
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };
    update();
    // No modo travado o "agora" não avança — não precisa de interval.
    if (isLocked || endIso) return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startIso, endIso, isLocked, lockedDate, getNow]);

  return elapsed;
}

export function formatDuration(startIso: string, endIso: string): string {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
