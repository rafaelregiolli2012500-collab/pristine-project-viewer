/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useState } from 'react';
import { PowerOff, AlertTriangle } from 'lucide-react';
import monitLogo from '@/assets/monit-logo.png';
import { WindowControls } from '@/components/coa/WindowControls';
import { useUnit } from '@/hooks/useUnit';

function turnoOf(d: Date) {
  const h = d.getHours();
  if (h >= 6 && h < 14) return 'TURNO A';
  if (h >= 14 && h < 22) return 'TURNO B';
  return 'TURNO C';
}

function safraOf(d: Date) {
  const y = d.getFullYear();
  return d.getMonth() >= 3 ? `SAFRA ${y}/${String(y + 1).slice(2)}` : `SAFRA ${y - 1}/${String(y).slice(2)}`;
}

interface Props {
  paradas: number;
  baseTerceiros: number;
}

export function CoaHeader({ paradas, baseTerceiros }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const { isHourMode } = useUnit();

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="no-print sticky top-0 z-40 h-[74px] border-b border-border/70 coa-glass"
      style={{ ['-webkit-app-region' as any]: 'drag' }}
    >
      <div className="mx-auto flex h-full max-w-[2100px] items-center gap-4 px-4 sm:px-6">
        {/* Marca */}
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={monitLogo}
            alt="MONIT.CAMPO — colhedora neon"
            className="size-11 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-extrabold tracking-[0.06em] text-foreground sm:text-base">
              MONIT<span className="text-primary">.</span>CAMPO
            </h1>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Centro de Operações Agrícolas
            </p>
          </div>
        </div>

        {/* Centro: relógio operacional */}
        <div
          className="mx-auto hidden items-center gap-6 rounded-xl border border-border/60 bg-background/40 px-5 py-2 lg:flex"
          style={{ ['-webkit-app-region' as any]: 'no-drag' }}
        >
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Data</p>
            <p className="font-mono text-sm font-bold tabular-nums text-foreground">
              {now ? now.toLocaleDateString('pt-BR') : '--/--/----'}
            </p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Hora</p>
            <p className="timer-display text-base leading-tight text-primary">
              {now ? now.toLocaleTimeString('pt-BR', { hour12: false }) : '--:--:--'}
            </p>
          </div>
          {!isHourMode && (
            <>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Turno</p>
                <p className="font-mono text-sm font-bold text-foreground">{now ? turnoOf(now) : '—'}</p>
              </div>
            </>
          )}
          <div className="h-8 w-px bg-border/70" />
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Safra</p>
            <p className="font-mono text-sm font-bold text-foreground">{now ? safraOf(now) : '—'}</p>
          </div>
        </div>

        {/* Direita: status operacional */}
        <div
          className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3"
          style={{ ['-webkit-app-region' as any]: 'no-drag' }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5">
            <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
            <span className="font-mono text-xs font-bold tabular-nums text-destructive">{paradas}</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-destructive/80 md:inline">paradas</span>
          </div>

          <div
            className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5"
            title="Equipamentos indisponíveis na Base ou em Terceiros"
          >
            <PowerOff className="size-3.5 shrink-0 text-warning" />
            <span className="font-mono text-xs font-bold tabular-nums text-warning">{baseTerceiros}</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-warning/80 md:inline">base/terceiros</span>
          </div>

          <WindowControls />
        </div>
      </div>
    </header>
  );
}