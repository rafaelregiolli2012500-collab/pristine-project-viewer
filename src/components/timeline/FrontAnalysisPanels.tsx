/**
 * Painéis de análise por frente (Cronograma "Colhedoras + Tratores" e Gráficos "Bases somadas").
 * Somente exibe dados já calculados pela Linha do Tempo — nenhum cálculo próprio de duração.
 */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, LabelList } from 'recharts';
import type { FrontWindow, RankingRow } from '@/lib/timelineFrontAnalysis';

export interface BaseTimes {
  total: number; parada: number; producao: number; manobra: number; deslocamento: number;
  naoClassificado: number; disp: number; paradas: number;
}
export interface FrontBreakdown { frente: string; colhedora: BaseTimes | null; trator: BaseTimes | null }

const hm = (min: number) => {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
const pct = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1).replace('.', ',')}%` : '—');
const clock = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden bg-muted/60">
      <div className="h-full" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function BaseBlock({ title, t, max, color }: { title: string; t: BaseTimes | null; max: number; color: string }) {
  if (!t) return (
    <div className="border border-dashed border-border p-3 text-xs text-muted-foreground">
      <div className="mb-1 font-bold uppercase" style={{ color }}>{title}</div>Sem registros desta base na frente.
    </div>
  );
  const rows: Array<[string, number, string]> = [
    ['Tempo total analisado', t.total, 'var(--muted-foreground)'],
    ['Tempo em parada', t.parada, 'var(--ldt-stop)'],
    ['Tempo efetivo (produção)', t.producao, 'var(--ldt-production)'],
    ['Tempo em manobra', t.manobra, 'hsl(var(--warning, 38 92% 50%))'],
    ['Tempo em deslocamento', t.deslocamento, 'hsl(var(--info, 200 80% 50%))'],
  ];
  if (t.naoClassificado > 0.5) rows.push(['Não classificado', t.naoClassificado, 'var(--muted-foreground)']);
  return (
    <div className="space-y-2 border-l-2 p-3" style={{ borderColor: color }}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase" style={{ color }}>{title}</span>
        <span className="text-[10px] text-muted-foreground">{t.paradas} parada(s)</span>
      </div>
      {rows.map(([k, v, c]) => (
        <div key={k} className="grid grid-cols-[1fr_56px_52px] items-center gap-2 text-xs">
          <div className="space-y-1"><span>{k}</span><Bar value={v} max={max} color={c} /></div>
          <span className="text-right font-mono font-semibold">{hm(v)}</span>
          <span className="text-right font-mono text-[10px] text-muted-foreground">{k.startsWith('Tempo total') ? '' : pct(v, t.total)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-1 text-xs">
        <span>Efetividade</span><strong className="font-mono">{t.disp.toFixed(1).replace('.', ',')}%</strong>
      </div>
    </div>
  );
}

export function FrontTimesComparison({ data }: { data: FrontBreakdown[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.flatMap(f => [f.colhedora?.total ?? 0, f.trator?.total ?? 0]));
  const maxStop = Math.max(...data.map(f => (f.colhedora?.parada ?? 0) + (f.trator?.parada ?? 0)));
  return (
    <section aria-label="Comparativo por frente" className="space-y-3">
      <h4 className="text-xs font-bold uppercase text-muted-foreground">Comparativo por frente — Colhedoras × Transbordo</h4>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map(f => {
          const diff = f.colhedora && f.trator ? f.colhedora.disp - f.trator.disp : null;
          const stops = (f.colhedora?.parada ?? 0) + (f.trator?.parada ?? 0);
          return (
            <div key={f.frente} className="space-y-2 border border-border bg-card/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-primary">FRENTE {f.frente}</span>
                <div className="flex gap-2 text-[10px]">
                  {stops === maxStop && data.length > 1 && stops > 0 && <span className="bg-danger/15 px-1.5 py-0.5 font-semibold text-danger">Mais paradas</span>}
                  {diff !== null && <span className="bg-muted px-1.5 py-0.5 font-mono">Dif. efetividade (Colh − Transb): {diff >= 0 ? '+' : ''}{diff.toFixed(1).replace('.', ',')} p.p.</span>}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <BaseBlock title="Colhedoras" t={f.colhedora} max={max} color="var(--ldt-stop-harvester)" />
                <BaseBlock title="Transbordo" t={f.trator} max={max} color="var(--ldt-stop-tractor)" />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cada minuto entra em uma única classe (produção, parada, manobra, deslocamento ou não classificado). Efetividade = (produção + deslocamento + manobra) ÷ tempo total — regra oficial já usada na Linha do Tempo. Percentuais sobre o tempo total da base.
      </p>
    </section>
  );
}

const STATUS = {
  sem_manutencao: { label: 'Operação sem manutenção registrada', color: 'var(--ldt-production)' },
  manutencao: { label: 'Intervalo com manutenção', color: 'var(--ldt-stop)' },
  insuficiente: { label: 'Dados insuficientes para confirmar', color: 'var(--muted-foreground)' },
} as const;

export function ConsolidatedAnalysis({
  missing, summary, stopCounts, windows, rangeStart, rangeEnd, rankingColh, rankingTrat, periodLabel,
}: {
  missing: string[]; summary: FrontBreakdown[];
  stopCounts: Array<Record<string, string | number | null>>;
  windows: Array<{ frente: string; windows: FrontWindow[] }>;
  rangeStart: number; rangeEnd: number;
  rankingColh: RankingRow[]; rankingTrat: RankingRow[]; periodLabel: string;
}) {
  const span = Math.max(1, rangeEnd - rangeStart);
  const ticks = Array.from({ length: Math.floor(span / 7200000) + 1 }, (_, i) => rangeStart + i * 7200000);
  return (
    <div className="space-y-5">
      {missing.length > 0 && (
        <p className="border border-warning/40 bg-warning/10 p-2 text-xs">Base não carregada: <strong>{missing.join(', ')}</strong>. Os indicadores dessa base não serão exibidos.</p>
      )}

      {/* 1. Resumo consolidado */}
      <section className="border-b border-border pb-5">
        <h3 className="mb-2 text-sm font-bold">Resumo consolidado por frente</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground"><tr className="border-b border-border">
              <th className="p-1 text-left">Frente</th><th className="p-1 text-right">Colh. total</th><th className="p-1 text-right">Colh. parada</th><th className="p-1 text-right">Colh. efetiv.</th>
              <th className="p-1 text-right">Transb. total</th><th className="p-1 text-right">Transb. parada</th><th className="p-1 text-right">Transb. efetiv.</th>
            </tr></thead>
            <tbody>{summary.map(f => (
              <tr key={f.frente} className="border-b border-border/50 font-mono">
                <td className="p-1 font-sans font-bold">F{f.frente}</td>
                <td className="p-1 text-right">{f.colhedora ? hm(f.colhedora.total) : '—'}</td>
                <td className="p-1 text-right">{f.colhedora ? hm(f.colhedora.parada) : '—'}</td>
                <td className="p-1 text-right">{f.colhedora ? `${f.colhedora.disp.toFixed(1).replace('.', ',')}%` : '—'}</td>
                <td className="p-1 text-right">{f.trator ? hm(f.trator.total) : '—'}</td>
                <td className="p-1 text-right">{f.trator ? hm(f.trator.parada) : '—'}</td>
                <td className="p-1 text-right">{f.trator ? `${f.trator.disp.toFixed(1).replace('.', ',')}%` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">"—" = sem registros dessa base na frente.</p>
      </section>

      {/* 2. Linhas — quantidade de paradas */}
      <section className="border-b border-border pb-5">
        <h3 className="text-sm font-bold">Quantidade de paradas por frente</h3>
        <p className="mb-2 text-xs text-muted-foreground">Ocorrências únicas de parada · {periodLabel}. Pontos ausentes = base sem registros na frente.</p>
        {stopCounts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sem eventos no período/filtros aplicados.</p> : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stopCounts} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--ldt-chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="frente" tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                <YAxis allowDecimals={false} width={36} tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                <RTooltip contentStyle={{ background: 'var(--ldt-chart-surface)', borderColor: 'var(--ldt-chart-grid)', color: 'var(--ldt-chart-text)' }} formatter={(v: unknown) => (v == null ? 'sem registros' : `${v} parada(s)`)} />
                <Legend />
                <Line type="linear" dataKey="colhedora" name="Paradas — Colhedoras" stroke="var(--ldt-stop-harvester)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false}>
                  <LabelList dataKey="colhedora" position="top" fontSize={10} fill="var(--ldt-chart-text)" />
                </Line>
                <Line type="linear" dataKey="trator" name="Paradas — Transbordo" stroke="var(--ldt-stop-tractor)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false}>
                  <LabelList dataKey="trator" position="bottom" fontSize={10} fill="var(--ldt-chart-text)" />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 3. Linha temporal */}
      <section className="border-b border-border pb-5">
        <h3 className="text-sm font-bold">Períodos sem manutenção registrada por frente</h3>
        <div className="mb-2 mt-1 flex flex-wrap gap-4 text-[10px]">
          {Object.values(STATUS).map(s => <span key={s.label} className="flex items-center gap-1"><span className="inline-block size-3" style={{ background: s.color }} />{s.label}</span>)}
        </div>
        <div className="space-y-2">
          <div className="relative ml-16 h-4 text-[9px] text-muted-foreground">
            {ticks.map(t => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${((t - rangeStart) / span) * 100}%` }}>{clock(t)}</span>)}
          </div>
          {windows.map(f => (
            <details key={f.frente} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className="w-14 shrink-0 text-xs font-bold text-primary">F{f.frente}</span>
                <div className="relative h-5 flex-1 bg-muted/40">
                  {f.windows.map(w => (
                    <div key={w.start} className="absolute top-0 h-full" title={`${STATUS[w.status].label}: ${clock(w.start)}–${clock(w.end)} (${hm(w.durMin)})`}
                      style={{ left: `${((w.start - rangeStart) / span) * 100}%`, width: `${((w.end - w.start) / span) * 100}%`, background: STATUS[w.status].color, opacity: w.status === 'insuficiente' ? 0.35 : 1 }} />
                  ))}
                </div>
              </summary>
              <table className="ml-16 mt-1 w-[calc(100%-4rem)] text-[11px]">
                <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">Situação</th><th>Início</th><th>Fim</th><th>Duração</th><th>Equip.</th><th>Categorias</th><th>Manut.</th></tr></thead>
                <tbody>{f.windows.map(w => (
                  <tr key={w.start} className="border-t border-border/40 text-center font-mono">
                    <td className="text-left font-sans" style={{ color: STATUS[w.status].color }}>{STATUS[w.status].label}</td>
                    <td>{clock(w.start)}</td><td>{clock(w.end)}</td><td>{hm(w.durMin)}</td><td>{w.equipamentos}</td>
                    <td className="font-sans">{w.categorias.map(c => (c === 'colhedora' ? 'Colh.' : c === 'trator' ? 'Transb.' : 'Canav.')).join(' + ')}</td>
                    <td>{w.ocorrencias || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </details>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Clique na frente para ver os intervalos. "Sem manutenção" exige registro de todos os equipamentos da frente no intervalo; não significa produção efetiva.</p>
      </section>

      {/* 4 e 5. Rankings */}
      <Ranking title="Ranking — Colhedoras com menos manutenção" rows={rankingColh} periodLabel={periodLabel} />
      <Ranking title="Ranking — Tratores / Transbordo com menos manutenção" rows={rankingTrat} periodLabel={periodLabel} />
    </div>
  );
}

function Ranking({ title, rows, periodLabel }: { title: string; rows: RankingRow[]; periodLabel: string }) {
  return (
    <section className="border-b border-border pb-5">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">Período analisado: {periodLabel}. Ordem: menos ocorrências → menos tempo em manutenção → frota.</p>
      {rows.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Base não carregada ou sem equipamentos no período.</p> : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-[10px] uppercase text-muted-foreground"><tr className="border-b border-border">
              <th className="p-1 text-left">Pos.</th><th className="p-1 text-left">Frota</th><th className="p-1 text-left">Frente</th><th className="p-1 text-right">Ocorrências</th><th className="p-1 text-right">Tempo manut.</th><th className="p-1 text-right">Tempo c/ dados</th>
            </tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.frota} className={`border-b border-border/50 font-mono ${r.avaliavel ? '' : 'text-muted-foreground'}`}>
                <td className="p-1">{r.posicao ?? '—'}</td><td className="p-1 font-bold">{r.frota}</td><td className="p-1 font-sans">{r.frente}</td>
                <td className="p-1 text-right">{r.ocorrencias}</td><td className="p-1 text-right">{hm(r.minutosManutencao)}</td>
                <td className="p-1 text-right">{hm(r.minutosComDados)}{!r.avaliavel && <span className="ml-1 font-sans text-[10px]">(não avaliável)</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">Não avaliável = registros cobrem menos de 50% do período; fica fora da classificação.</p>
    </section>
  );
}
