/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { getActiveUnit, setActiveUnit, UNITS, type UnitDef } from '@/lib/units';

/**
 * Unidade operacional ativa. A troca de unidade recarrega o ambiente,
 * portanto o valor é estável durante toda a sessão.
 */
export function useUnit(): { unit: UnitDef; units: UnitDef[]; isHourMode: boolean; setUnit: (id: string) => void } {
  const unit = getActiveUnit();
  return {
    unit,
    units: UNITS,
    isHourMode: unit.timeMode === 'horario',
    setUnit: setActiveUnit,
  };
}
