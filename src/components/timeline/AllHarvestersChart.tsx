import { allHarvesterWindows } from '@/lib/timelineFrontAnalysis';

type Props = { fronts: ReturnType<typeof allHarvesterWindows>; start: number; end: number };
const time = (v: number) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const duration = (v: number) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.round(v % 60)).padStart(2, '0')}`;

export function AllHarvestersChart({ fronts, start, end }: Props) {
  const period = end - start;
  if (period <= 0) return null;
  return (
    <section className="border-b border-border pb-5" aria-label="Todas as colhedoras em produção">
      <h3 className="mb-4 text-sm font-bold">Frente com todas as colhedoras em produção</h3>
      {fronts.length === 0 ? <p className="text-xs text-muted-foreground">Sem colhedoras cadastradas para as frentes selecionadas.</p> : fronts.map(front => (
        <div key={front.frente} className="mb-4 border-b border-border pb-3">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
            <strong>FRENTE {front.frente} · {front.equipamentos} colhedoras</strong>
            <span>Total simultâneo: <strong className="font-mono text-success">{duration(front.totalMin)}</strong></span>
          </div>
          <svg viewBox="0 0 1000 28" preserveAspectRatio="none" className="h-7 w-full" role="img" aria-label={`Frente ${front.frente}: ${duration(front.totalMin)} com todas em produção`}>
            <rect width="1000" height="28" fill="var(--ldt-chart-grid)" />
            {front.windows.map(w => <rect key={w.start} x={(w.start - start) / period * 1000} width={(w.end - w.start) / period * 1000} height="28" fill="var(--ldt-production)"><title>{time(w.start)} → {time(w.end)} · {duration(w.durMin)} · {front.equipamentos} colhedoras</title></rect>)}
          </svg>
          <div className="mt-1 flex justify-between gap-2 text-[10px] font-mono text-muted-foreground"><span>{time(start)}</span><span>{time(end)}</span></div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {front.windows.map(w => <div key={w.start}><dt className="text-muted-foreground">{time(w.start)} → {time(w.end)}</dt><dd className="font-mono font-bold text-success">{duration(w.durMin)}</dd></div>)}
          </dl>
          {!front.windows.length && <p className="mt-2 text-xs text-muted-foreground">Nenhum intervalo confirmado com todas em produção.</p>}
        </div>
      ))}
    </section>
  );
}