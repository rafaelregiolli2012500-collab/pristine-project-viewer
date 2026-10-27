/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { MaintenanceRecord } from '@/types/maintenance';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSystemTime } from '@/hooks/useSystemTime';
import { useUnit } from '@/hooks/useUnit';
import { getHourWindow, DEFAULT_HOUR_START, DEFAULT_HOUR_END } from '@/lib/hourWindow';
import { HourRangeFilter } from '@/components/coa/HourRangeFilter';
import { getOperationalDayStart } from '@/lib/operationalDay';

interface Props {
  records: MaintenanceRecord[];
}

type Turno = 'A' | 'B' | 'C' | 'TOTAL';

const TURNO_OPTIONS: { value: Turno; label: string }[] = [
  { value: 'A', label: 'Turno A (06–14h)' },
  { value: 'B', label: 'Turno B (14–22h)' },
  { value: 'C', label: 'Turno C (22–06h)' },
  { value: 'TOTAL', label: 'Total' },
];

function getTurnoWindow(opStart: Date, turno: Turno): { start: Date; end: Date } {
  const start = new Date(opStart);
  const end = new Date(opStart);
  if (turno === 'A') {
    end.setHours(start.getHours() + 8);
  } else if (turno === 'B') {
    start.setHours(start.getHours() + 8);
    end.setHours(start.getHours() + 8);
  } else if (turno === 'C') {
    start.setHours(start.getHours() + 16);
    end.setHours(start.getHours() + 8);
  } else {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

function overlapMs(s: number, e: number, a: number, b: number) {
  return Math.max(0, Math.min(e, b) - Math.max(s, a));
}

function formatHM(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

export function TruckDashboard({ records }: Props) {
  const { getNow, isLocked, lockedDate } = useSystemTime();
  const now = getNow();

  const { isHourMode } = useUnit();
  const [turno, setTurno] = useState<Turno>('TOTAL');
  const [hourStart, setHourStart] = useState(DEFAULT_HOUR_START);
  const [hourEnd, setHourEnd] = useState(DEFAULT_HOUR_END);
  const [includePreventive, setIncludePreventive] = useState<boolean>(() => {
    try { return localStorage.getItem('include_preventive') !== 'false'; } catch { return true; }
  });

  const updatePreventive = (v: boolean) => {
    setIncludePreventive(v);
    try { localStorage.setItem('include_preventive', String(v)); } catch {}
  };

  const truckRecords = useMemo(() => {
    // Parada no trajeto não é contabilizada no dashboard de caminhões
    const base = records.filter(r => r.equipmentType === 'caminhao' && r.stopReason !== 'parada_trajeto');
    return includePreventive ? base : base.filter(r => r.stopReason !== 'programada');
  }, [records, includePreventive]);

  const opStart = getOperationalDayStart(now);
  const window = useMemo(
    () => (isHourMode ? getHourWindow(opStart, hourStart, hourEnd) : getTurnoWindow(opStart, turno)),
    [opStart, turno, isHourMode, hourStart, hourEnd],
  );
  const isTotal = isHourMode
    ? (window.end.getTime() - window.start.getTime()) / 3600000 >= 24
    : turno === 'TOTAL';
  const windowStartMs = window.start.getTime();
  const windowEndMs = window.end.getTime();
  const windowHours = (windowEndMs - windowStartMs) / 3600000;

  // hoursInWindow: TOTAL = duração total da parada; turno = sobreposição com janela
  type Enriched = MaintenanceRecord & { hoursInWindow: number };
  const enriched = useMemo<Enriched[]>(() => {
    return truckRecords.map(r => {
      const sMs = new Date(r.inicioTime).getTime();
      const eMs = r.fimTime ? new Date(r.fimTime).getTime() : now.getTime();
      let hoursInWindow: number;
      if (isTotal) {
        hoursInWindow = Math.max(0, (eMs - sMs) / 3600000);
      } else {
        hoursInWindow = overlapMs(sMs, eMs, windowStartMs, windowEndMs) / 3600000;
      }
      return { ...r, hoursInWindow };
    }).filter(r => r.hoursInWindow > 0);
  }, [truckRecords, isTotal, windowStartMs, windowEndMs, now]);

  const activeCount = enriched.filter(r => !r.fimTime || new Date(r.fimTime).getTime() > now.getTime()).length;
  const finalizedCount = enriched.length - activeCount;
  const totalHours = enriched.reduce((s, r) => s + r.hoursInWindow, 0);
  const totalEvents = enriched.length;
  const avgDowntime = totalEvents > 0 ? totalHours / totalEvents : 0;

  const frotaData = useMemo(() => {
    const total = isTotal ? null : windowHours;
    const m = new Map<string, { horas: number; programada: number; count: number; programadaCount: number }>();
    enriched.forEach(r => {
      const isProgramada = r.stopReason === 'programada';
      const cur = m.get(r.frota) || { horas: 0, programada: 0, count: 0, programadaCount: 0 };
      cur.horas += r.hoursInWindow;
      cur.count += 1;
      if (isProgramada) {
        cur.programada += r.hoursInWindow;
        cur.programadaCount += 1;
      }
      m.set(r.frota, cur);
    });
    return Array.from(m.entries())
      .map(([frota, v]) => {
        const cappedParadas = total != null ? Math.min(v.horas, total) : v.horas;
        const disp = total != null && total > 0
          ? Math.max(0, Math.round(((total - cappedParadas) / total) * 1000) / 10)
          : null;
        const outras = Math.max(0, v.horas - v.programada);
        return {
          frota,
          horas: Math.round(v.horas * 100) / 100,
          programada: Math.round(v.programada * 100) / 100,
          outras: Math.round(outras * 100) / 100,
          count: v.count,
          programadaCount: v.programadaCount,
          disponibilidade: disp,
          label: `${frota} — ${formatHM(v.horas)}`,
        };
      })
      .sort((a, b) => b.horas - a.horas);
  }, [enriched, isTotal, windowHours]);

  const headerLabel = isHourMode
    ? `Tempo Parado (${hourStart} → ${hourEnd})`
    : isTotal
      ? 'Tempo Parado (Histórico)'
      : `Tempo Parado ${TURNO_OPTIONS.find(o => o.value === turno)?.label}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground mr-2">Período:</span>
            {isHourMode ? (
              <HourRangeFilter start={hourStart} end={hourEnd} onStart={setHourStart} onEnd={setHourEnd} />
            ) : (
              TURNO_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={turno === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setTurno(opt.value)}
                >
                  {opt.label}
                </Button>
              ))
            )}
            <div className="flex items-center gap-2 ml-2 border-l pl-3">
              <Label htmlFor="prev-switch" className="text-xs cursor-pointer">Preventiva</Label>
              <Switch id="prev-switch" checked={includePreventive} onCheckedChange={updatePreventive} />
              <span className="text-[11px] font-semibold text-muted-foreground">{includePreventive ? 'SIM' : 'NÃO'}</span>
            </div>
            {isLocked && lockedDate && (
              <span className="ml-auto text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                🔒 Dados travados em {(() => { const [y,m,d] = lockedDate.split('-'); return `${d}/${m}/${y}`; })()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-destructive">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Em Parada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-primary">{finalizedCount}</p>
            <p className="text-xs text-muted-foreground">Paradas Finalizadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono">{formatHM(totalHours)}</p>
            <p className="text-xs text-muted-foreground">{headerLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-amber-600">{formatHM(avgDowntime)}</p>
            <p className="text-xs text-muted-foreground">Tempo Médio de Parada</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="chart-title flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-primary" /> Paradas por Frota — Caminhões
            {isLocked && <span className="ml-1 inline-flex items-center text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">TRAVADO</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {frotaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, frotaData.length * 28 + 40)}>
              <BarChart data={frotaData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fontWeight: 600 }}
                  width={150}
                  interval={0}
                />
                <Tooltip
                  formatter={(value: number, name: string, p: any) => {
                    const d = p?.payload;
                    if (name === 'programada') {
                      return [`Programada: ${formatHM(value)}`, `Frota ${d.frota}`];
                    }
                    const parts = [
                      `Total parado: ${formatHM(d.horas)}`,
                      `Ocorrências: ${d.count}`,
                    ];
                    if (d.disponibilidade != null) parts.push(`Disponibilidade: ${d.disponibilidade}%`);
                    return [parts.join(' · '), `Frota ${d.frota}`];
                  }}
                />
                <Bar dataKey="programada" stackId="a" fill="hsl(0, 75%, 50%)" name="programada" />
                <Bar dataKey="outras" stackId="a" fill="hsl(215, 70%, 45%)" name="outras" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de caminhões no período</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
