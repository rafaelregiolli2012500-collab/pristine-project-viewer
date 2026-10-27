/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Filtro por Horário Inicial / Horário Final (unidades sem turno).
 */
import { Input } from '@/components/ui/input';

interface Props {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}

export function HourRangeFilter({ start, end, onStart, onEnd }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold uppercase text-muted-foreground">Horário inicial:</span>
      <Input
        type="time"
        value={start}
        onChange={e => onStart(e.target.value)}
        className="h-8 w-[110px] text-xs"
      />
      <span className="text-xs font-bold uppercase text-muted-foreground">Horário final:</span>
      <Input
        type="time"
        value={end}
        onChange={e => onEnd(e.target.value)}
        className="h-8 w-[110px] text-xs"
      />
    </div>
  );
}
