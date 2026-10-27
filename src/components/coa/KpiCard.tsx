/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  color: string;
  spark?: number[];
  onClick?: () => void;
}

const DEFAULT_SPARK = [4, 7, 5, 9, 6, 11, 8, 13];

export function KpiCard({ label, value, hint, icon, color, spark = DEFAULT_SPARK, onClick }: Props) {
  const max = Math.max(...spark, 1);
  const pts = spark
    .map((v, i) => `${(i / (spark.length - 1)) * 100},${28 - (v / max) * 24}`)
    .join(' ');

  return (
    <div
      className={`coa-glass coa-kpi coa-enter select-none p-4 sm:p-5 outline-none ${onClick ? 'cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:brightness-95' : ''}`}
      style={{ ['--kpi' as any]: color }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start gap-4">
        <div className="neon-tile size-14 shrink-0" style={{ ['--tile' as any]: color }}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p
            className="font-mono text-4xl font-extrabold leading-none tabular-nums"
            style={{ color, textShadow: `0 0 26px color-mix(in oklab, ${color} 45%, transparent)` }}
          >
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>

        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="hidden h-10 w-20 shrink-0 sm:block" aria-hidden="true">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          <polyline points={`${pts} 100,30 0,30`} fill={color} opacity="0.12" stroke="none" />
        </svg>
      </div>
    </div>
  );
}