/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useTimer } from '@/hooks/useTimer';

interface TimerCellProps {
  startIso: string;
  /** Exibe somente horas e minutos (HH:MM), sem segundos */
  minutesOnly?: boolean;
}

export function TimerCell({ startIso, minutesOnly = false }: TimerCellProps) {
  const elapsed = useTimer(startIso);
  const display = minutesOnly ? elapsed.split(':').slice(0, 2).join(':') : elapsed;
  return <span className="timer-display text-accent">{display}</span>;
}
