/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { MaintenanceRecord, STOP_REASON_LABELS, STOP_REASON_COLORS, StopReason, FrenteConfig, Equipment } from '@/types/maintenance';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, Line, LabelList, Cell,
} from 'recharts';
import { useSystemTime } from '@/hooks/useSystemTime';
import { useUnit } from '@/hooks/useUnit';
import { getHourWindow, DEFAULT_HOUR_START, DEFAULT_HOUR_END } from '@/lib/hourWindow';
import { HourRangeFilter } from '@/components/coa/HourRangeFilter';
import { getOperationalDayStart } from '@/lib/operationalDay';

interface Props {
  records: MaintenanceRecord[];
  frentes?: FrenteConfig[];
  equipment?: Equipment[];
}

type Turno = 'A' | 'B' | 'C' | 'TOTAL';
type EqFilter = 'todos' | 'colhedora' | 'transbordo';

const TURNO_OPTIONS: { value: Turno; label: string }[] = [
  { value: 'A', label: 'Turno A (06–14h)' },
  { value: 'B', label: 'Turno B (14–22h)' },
  { value: 'C', label: 'Turno C (22–06h)' },
  { value: 'TOTAL', label: 'Total (06–06h)' },
];

const EQ_OPTIONS: { value: EqFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'colhedora', label: 'Colhedoras' },
  { value: 'transbordo', label: 'Transbordos' },
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

function overlapHours(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, (e - s) / 3600000);
}

/** Percentual posicionado fora da barra quando há espaço; dentro (alinhado à direita) quando não há. */
function SmartPercentLabel(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  const num = Number(value);
  if (!isFinite(num)) return null;
  const text = `${value}%`;
  const textW = text.length * 6.2 + 6;
  // largura total do plot deduzida da escala (domínio 0-100)
  const plotW = num > 0 ? (width * 100) / num : width;
  const available = Math.max(0, plotW - width);
  const inside = available < textW + 6;
  return (
    <text
      x={inside ? x + width - 5 : x + width + 5}
      y={y + height / 2}
      textAnchor={inside ? 'end' : 'start'}
      dominantBaseline="central"
      fill="#ffffff"
      style={{ fontSize: 10, fontWeight: 700 }}
    >
      {text}
    </text>
  );
}


function formatHM(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

const frenteNumKey = (n: string) => {
  const m = String(n).match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
};

export function DashboardView({ records, frentes = [], equipment = [] }: Props) {
  const { isHourMode } = useUnit();
  const [turno, setTurno] = useState<Turno>('TOTAL');
  const [hourStart, setHourStart] = useState(DEFAULT_HOUR_START);
  const [hourEnd, setHourEnd] = useState(DEFAULT_HOUR_END);
  const [eqFilter, setEqFilter] = useState<EqFilter>('todos');
  const { isLocked, lockedDate, getNow } = useSystemTime();

  const now = getNow();
  const opStart = useMemo(() => {
    if (isLocked && lockedDate) {
      const [y, m, d] = lockedDate.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1, 6, 0, 0, 0);
    }
    return getOperationalDayStart(now);
  }, [isLocked, lockedDate, now]);

  const window = useMemo(
    () => (isHourMode ? getHourWindow(opStart, hourStart, hourEnd) : getTurnoWindow(opStart, turno)),
    [opStart, turno, isHourMode, hourStart, hourEnd],
  );
  const windowHours = (window.end.getTime() - window.start.getTime()) / 3600000;
  const isTotal = isHourMode ? windowHours >= 24 : turno === 'TOTAL';

  // Filtra por tipo de equipamento
  const filteredByEq = useMemo(() => {
    if (eqFilter === 'todos') return records.filter(r => r.equipmentType === 'colhedora' || r.equipmentType === 'trator');
    if (eqFilter === 'colhedora') return records.filter(r => r.equipmentType === 'colhedora');
    return records.filter(r => r.equipmentType === 'trator'); // transbordo == trator
  }, [records, eqFilter]);

  type Enriched = MaintenanceRecord & { hoursInWindow: number };
  const enriched = useMemo<Enriched[]>(() => {
    return filteredByEq.map(r => {
      const ini = new Date(r.inicioTime);
      const fim = r.fimTime ? new Date(r.fimTime) : now;
      // Todos os filtros (A, B, C e TOTAL) usam a janela do dia operacional (06h→06h).
      // TOTAL = janela completa das 06h às 06h do dia seguinte (3 turnos).
      const fimForWindow = r.fimTime ? fim : window.end;
      const hoursInWindow = overlapHours(ini, fimForWindow, window.start, window.end);
      return { ...r, hoursInWindow };
    }).filter(r => r.hoursInWindow > 0);
  }, [filteredByEq, window, isTotal, now]);

  // Conjunto de frentes (de frentes cadastradas + vistas em registros), ordenadas numericamente
  const orderedFrentes = useMemo(() => {
    const set = new Set<string>();
    frentes.forEach(f => set.add(f.nome));
    enriched.forEach(r => set.add(r.frente || 'Sem Frente'));
    return Array.from(set).sort((a, b) => frenteNumKey(a) - frenteNumKey(b));
  }, [frentes, enriched]);

  // 1) Parada por Frente (stacked colhedoras x transbordos)
  const stackByFrente = useMemo(() => {
    const map = new Map<string, { colhedoras: number; transbordos: number }>();
    enriched.forEach(r => {
      const key = r.frente || 'Sem Frente';
      const cur = map.get(key) || { colhedoras: 0, transbordos: 0 };
      if (r.equipmentType === 'colhedora') cur.colhedoras += r.hoursInWindow;
      else if (r.equipmentType === 'trator') cur.transbordos += r.hoursInWindow;
      map.set(key, cur);
    });
    return orderedFrentes
      .filter(f => map.has(f))
      .map(frente => {
        const v = map.get(frente)!;
        return {
          frente,
          colhedoras: Math.round(v.colhedoras * 100) / 100,
          transbordos: Math.round(v.transbordos * 100) / 100,
          total: v.colhedoras + v.transbordos,
        };
      });
  }, [enriched, orderedFrentes]);

  // 2) Disponibilidade por Frente — baseada em (qtd equipamentos cadastrados na frente) × horas do turno.
  // Considera o filtro de tipo de equipamento (todos / colhedoras / transbordos).
  const availabilityByFrente = useMemo(() => {
    const perEqHours = isTotal ? 24 : windowHours;
    return orderedFrentes.map(frente => {
      const eqsDaFrente = equipment.filter(e => e.frente === frente);
      const eqsFiltrados = eqFilter === 'todos'
        ? eqsDaFrente.filter(e => e.equipmentType === 'colhedora' || e.equipmentType === 'trator')
        : eqFilter === 'colhedora'
          ? eqsDaFrente.filter(e => e.equipmentType === 'colhedora')
          : eqsDaFrente.filter(e => e.equipmentType === 'trator');
      const qtd = eqsFiltrados.length;
      const totalPossivel = qtd * perEqHours;
      const paradas = enriched
        .filter(r => (r.frente || 'Sem Frente') === frente)
        .reduce((s, r) => s + r.hoursInWindow, 0);
      const cappedParadas = totalPossivel > 0 ? Math.min(paradas, totalPossivel) : paradas;
      const produzindo = Math.max(0, totalPossivel - cappedParadas);
      const disp = totalPossivel > 0 ? (produzindo / totalPossivel) * 100 : 0;
      return {
        frente,
        disponibilidade: Math.round(disp * 10) / 10,
        produzindo: Math.round(produzindo * 100) / 100,
        paradas: Math.round(paradas * 100) / 100,
        qtd,
        totalPossivel: Math.round(totalPossivel * 100) / 100,
      };
    });
  }, [enriched, orderedFrentes, windowHours, isTotal, equipment, eqFilter]);

  // 3) Pareto
  const paretoData = useMemo(() => {
    const map = new Map<StopReason, number>();
    enriched.forEach(r => {
      const reason = (r.stopReason || 'manutencao') as StopReason;
      map.set(reason, (map.get(reason) || 0) + r.hoursInWindow);
    });
    const arr = Array.from(map.entries())
      .map(([reason, hours]) => ({
        reason,
        name: STOP_REASON_LABELS[reason],
        color: STOP_REASON_COLORS[reason],
        horas: Math.round(hours * 100) / 100,
      }))
      .sort((a, b) => b.horas - a.horas);
    const total = arr.reduce((s, d) => s + d.horas, 0) || 1;
    let acc = 0;
    return arr.map(d => {
      acc += d.horas;
      return { ...d, percentual: Math.round((d.horas / total) * 1000) / 10, acumulado: Math.round((acc / total) * 1000) / 10 };
    });
  }, [enriched]);

  // 4) Paradas por Frota agrupadas por Frente (com tipo de equipamento)
  const frotasByFrente = useMemo(() => {
    const total = isTotal ? null : windowHours;
    const m = new Map<string, Map<string, { horas: number; count: number; equipmentType: string }>>();
    enriched.forEach(r => {
      const fr = r.frente || 'Sem Frente';
      if (!m.has(fr)) m.set(fr, new Map());
      const inner = m.get(fr)!;
      const cur = inner.get(r.frota) || { horas: 0, count: 0, equipmentType: r.equipmentType };
      cur.horas += r.hoursInWindow;
      cur.count += 1;
      cur.equipmentType = r.equipmentType;
      inner.set(r.frota, cur);
    });
    return orderedFrentes
      .filter(fr => m.has(fr))
      .map(fr => {
        const items = Array.from(m.get(fr)!.entries())
          .map(([frota, v]) => {
            const cappedParadas = total != null ? Math.min(v.horas, total) : v.horas;
            const disp = total != null && total > 0
              ? Math.max(0, Math.round(((total - cappedParadas) / total) * 1000) / 10)
              : null;
            return {
              frota,
              horas: Math.round(v.horas * 100) / 100,
              count: v.count,
              equipmentType: v.equipmentType,
              disponibilidade: disp,
              label: `${frota} — ${formatHM(v.horas)}`,
            };
          })
          .sort((a, b) => b.horas - a.horas);
        return { frente: fr, items };
      });
  }, [enriched, orderedFrentes, windowHours, isTotal]);

  const activeCount = enriched.filter(r => r.status === 'em_manutencao').length;
  const totalHoras = enriched.reduce((s, r) => s + r.hoursInWindow, 0);
  // Tempo Médio de Parada — média de duração das manutenções/paradas registradas no período
  const finalizedDurations = useMemo(() => enriched.map(r => r.hoursInWindow), [enriched]);
  const tempoMedioParada = finalizedDurations.length > 0
    ? finalizedDurations.reduce((s, h) => s + h, 0) / finalizedDurations.length
    : 0;
  const dispMedia = availabilityByFrente.length > 0
    ? Math.round(availabilityByFrente.reduce((s, a) => s + a.disponibilidade, 0) / availabilityByFrente.length)
    : 100;

  return (
    <div className="space-y-4">
      {/* Filtros */}
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
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">Equipamento:</span>
              {EQ_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={eqFilter === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEqFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {isLocked && lockedDate && (
              <span className="basis-full text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                🔒 Dados travados em {(() => { const [y,m,d] = lockedDate.split('-'); return `${d}/${m}/${y}`; })()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Frentes */}
      {frentes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="chart-title text-sm">Informações das Frentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-semibold">Frente</th>
                    <th className="py-1 pr-3 font-semibold">Coordenador</th>
                    <th className="py-1 pr-3 font-semibold">Fazenda</th>
                    <th className="py-1 pr-3 font-semibold">KM/H</th>
                  </tr>
                </thead>
                <tbody>
                  {[...frentes].sort((a, b) => frenteNumKey(a.nome) - frenteNumKey(b.nome)).map(f => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-1 pr-3 font-mono font-bold">{f.nome}</td>
                      <td className="py-1 pr-3">{f.lider || '-'}</td>
                      <td className="py-1 pr-3">{f.localidade || '-'}</td>
                      <td className="py-1 pr-3 font-mono">{f.kmh || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-destructive">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Paradas no Período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono">{formatHM(totalHoras)}</p>
            <p className="text-xs text-muted-foreground">Total Horas Paradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-amber-600">{formatHM(tempoMedioParada)}</p>
            <p className="text-xs text-muted-foreground">Tempo Médio de Parada</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="chart-title text-sm">Tempo de Parada por Frente — Colhedoras × Transbordos</CardTitle>
          </CardHeader>
          <CardContent>
            {stackByFrente.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stackByFrente}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 85%)" />
                  <XAxis dataKey="frente" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'horas', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${formatHM(value)}`, name === 'colhedoras' ? 'Colhedoras' : 'Transbordos']}
                  />
                  <Legend formatter={(v) => v === 'colhedoras' ? 'Colhedoras' : 'Transbordos'} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="colhedoras" stackId="a" fill="hsl(215, 75%, 50%)" />
                  <Bar dataKey="transbordos" stackId="a" fill="hsl(142, 65%, 42%)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="total" position="top" formatter={(v: number) => formatHM(v)} style={{ fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem dados no período selecionado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="chart-title text-sm">Disponibilidade Operacional por Frente (%)</CardTitle>
          </CardHeader>
          <CardContent>
            {availabilityByFrente.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={availabilityByFrente} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 85%)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="frente" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip
                    formatter={(value: number, _name, p: any) => {
                      const d = p?.payload;
                      return [
                        `${value}% · ${d.qtd} eq · possível ${formatHM(d.totalPossivel)} · prod ${formatHM(d.produzindo)} · parada ${formatHM(d.paradas)}`,
                        'Disponibilidade',
                      ];
                    }}
                  />
                  <Bar dataKey="disponibilidade" fill="hsl(142, 60%, 40%)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="disponibilidade" content={<SmartPercentLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem dados no período</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="chart-title text-sm">Principais Motivos de Parada (Pareto)</CardTitle>
          </CardHeader>
          <CardContent>
            {paretoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 85%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'horas', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'acumulado') return [`${value}%`, '% Acumulado'];
                      return [`${formatHM(value)}`, 'Horas'];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="horas" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="percentual" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 9 }} />
                    {paretoData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(0, 75%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Paradas por Frota agrupadas por Frente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="chart-title text-sm">Paradas por Frota — agrupado por Frente</CardTitle>
        </CardHeader>
        <CardContent>
          {frotasByFrente.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados no período</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frotasByFrente.map(group => {
                const colItems = group.items.filter(i => i.equipmentType === 'colhedora');
                const trItems = group.items.filter(i => i.equipmentType === 'trator');
                // Quando filtro = todos, exibe seções dentro da MESMA tabela.
                // Quando filtro = colhedora/transbordo, exibe lista única.
                const showSections = eqFilter === 'todos' && (colItems.length > 0 || trItems.length > 0);
                const sections = showSections
                  ? [
                      { title: 'Colhedoras', items: colItems, color: 'hsl(215, 75%, 50%)' },
                      { title: 'Tratores', items: trItems, color: 'hsl(142, 65%, 42%)' },
                    ].filter(s => s.items.length > 0)
                  : [{ title: '', items: group.items, color: 'hsl(0, 70%, 50%)' }];
                return (
                  <div key={group.frente} className="border rounded p-2">
                    <p className="text-xs font-bold mb-1">{group.frente} <span className="text-muted-foreground font-normal">({group.items.length} frotas)</span></p>
                    {sections.map((sec, sIdx) => {
                      const height = Math.max(100, sec.items.length * 26 + 36);
                      return (
                        <div key={sec.title || sIdx} className={sIdx > 0 ? 'mt-2 pt-2 border-t border-dashed' : ''}>
                          {sec.title && (
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 pl-1">{sec.title} ({sec.items.length})</p>
                          )}
                          <ResponsiveContainer width="100%" height={height}>
                            <BarChart data={sec.items} layout="vertical" margin={{ left: 10, right: 60, top: 4, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis type="category" dataKey="frota" tick={{ fontSize: 10 }} width={60} />
                              <Tooltip
                                formatter={(value: number, _name, p: any) => {
                                  const d = p?.payload;
                                  const parts = [
                                    `Total parado: ${formatHM(value)}`,
                                    `Ocorrências: ${d.count}`,
                                  ];
                                  if (d.disponibilidade != null) parts.push(`Disponibilidade: ${d.disponibilidade}%`);
                                  return [parts.join(' · '), `Frota ${d.frota} · ${group.frente}`];
                                }}
                              />
                              <Bar dataKey="horas" fill={sec.color} radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="horas" position="right" formatter={(v: number) => formatHM(v)} style={{ fontSize: 10, fontWeight: 600 }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
