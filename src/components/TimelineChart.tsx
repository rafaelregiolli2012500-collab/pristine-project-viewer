/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import {
  MaintenanceRecord,
  STOP_REASON_LABELS,
  STOP_REASON_SHORT_LABELS,
  STOP_REASON_COLORS,
  STOP_REASON_TEXT,
  StopReason,
  Equipment,
  FrenteConfig,
  EquipmentType,
  normalizeFrenteNome,
} from '@/types/maintenance';

import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { Copy, Settings as SettingsIcon, Lock, Pencil, X } from 'lucide-react';
import { useSystemTime } from '@/hooks/useSystemTime';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CloudRain, Factory, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { combineDateTime } from '@/lib/maintenanceValidation';

import {
  OPERATIONAL_HOURS,
  OPERATIONAL_START_HOUR,
  formatDate,
  formatHM,
  getTodayOperationalStart,
  offsetInOperationalDay,
} from '@/lib/operationalDay';

export interface ClimateTarget {
  frota: string;
  frente: string;
  equipmentType: Equipment['equipmentType'];
}

interface Props {
  records: MaintenanceRecord[];
  equipment?: Equipment[];
  frentes?: FrenteConfig[];
  /** Inicia parada em grupo (Climática / Usina Parada) — um registro por frota. */
  onStartClimate?: (targets: ClimateTarget[], reason: GroupStopReason, inicioIso?: string) => void;
  /** Finaliza paradas ativas pelos ids dos registros. */
  onFinalizeClimate?: (ids: string[]) => void;
}

/** Paradas controladas por Frente com seleção individual de frotas. */
export type GroupStopReason = 'climatico' | 'usina_parada' | 'troca_turno';
export const GROUP_REASONS: GroupStopReason[] = ['climatico', 'usina_parada', 'troca_turno'];
export const GROUP_LABELS: Record<GroupStopReason, string> = {
  climatico: 'Parada Climática',
  usina_parada: 'Usina Parada',
  troca_turno: 'Troca de Turno',
};
export const GROUP_ICONS: Record<GroupStopReason, typeof CloudRain> = {
  climatico: CloudRain,
  usina_parada: Factory,
  troca_turno: RefreshCw,
};


function safeDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* =========================================================
LEGEND
========================================================= */
function Legend({ equipmentType }: { equipmentType?: 'colhedora' | 'trator' | 'caminhao' }) {
  let items = (Object.keys(STOP_REASON_LABELS) as StopReason[]).filter(k => k !== 'troca_faquinhas' && k !== 'oportunidade' && k !== 'terceiro');
  if (equipmentType !== 'colhedora') {
    items = items.filter(k => k !== 'lubrificacao');
  }
  if (equipmentType === 'caminhao') {
    items = items.filter(k => k !== 'prancha' && k !== 'calibracao');
  } else {
    items = items.filter(k => k !== 'parada_trajeto' && k !== 'qru_trajeto' && k !== 'aguard_oficina');
  }
  return (
    <div className="flex flex-wrap gap-2 px-2 py-1.5 border rounded bg-card mb-1">
      {items.map((k) => (
        <div key={k} className="flex items-center gap-1.5 text-[11px]">
          <span
            className="w-3 h-3 rounded-sm ring-1 ring-black/20"
            style={{ background: STOP_REASON_COLORS[k] }}
          />
          <span>{STOP_REASON_LABELS[k]}</span>

        </div>
      ))}
    </div>
  );
}

interface BarItem {
  rec: MaintenanceRecord;
  sReal: Date;
  eReal: Date;
  startOff: number;
  endOff: number;
  isOpen: boolean;
  isOld: boolean;
}

/* =========================================================
POSICIONAMENTO INTELIGENTE DOS RÓTULOS DE HORÁRIO
Detecta colisão real (bounding box) e escolhe, por prioridade:
1) fora da barra (acima/abaixo)  2) dentro da barra centralizado
3) dentro com fonte reduzida     4) versão compacta do horário
========================================================= */
export interface LabelPlan {
  mode: 'above' | 'below' | 'inside' | 'right' | 'left';
  text: string;
  fontSize: number;
  /** deslocamento X (px) do centro do rótulo relativo ao centro da barra (modo fora) */
  shift: number;
}

/** Largura aproximada do texto renderizado (font-semibold, tabular). */
function measureText(text: string, fontSize: number) {
  return text.length * fontSize * 0.545;
}

function overlaps(lane: Array<[number, number]>, x1: number, x2: number) {
  const GAP = 6;
  return lane.some(([a, b]) => x1 < b + GAP && x2 > a - GAP);
}

export interface LabelItem {
  id: string;
  text: string;
  compact: string;
  centerPx: number;
  barW: number;
  /** índice da linha (frota) na ordem de renderização do cronograma */
  row: number;
  reason: StopReason;
}

/**
 * Planeja a posição de TODOS os rótulos do cronograma de uma só vez.
 * Prioridade: dentro da barra → direita → esquerda → acima → abaixo.
 * O horário completo nunca é truncado; apenas o texto é deslocado.
 */
export function planLabels(items: LabelItem[], trackW: number): Record<string, LabelPlan> {
  const out: Record<string, LabelPlan> = {};
  /** chave = índice da fronteira entre linhas (acima/abaixo) */
  const lanes = new Map<number, Array<[number, number]>>();
  const laneAt = (b: number) => {
    let l = lanes.get(b);
    if (!l) { l = []; lanes.set(b, l); }
    return l;
  };

  /** espaço ocupado DENTRO de cada linha: barras + rótulos laterais já posicionados */
  const rowLanes = new Map<number, Array<[number, number]>>();
  const rowLaneAt = (r: number) => {
    let l = rowLanes.get(r);
    if (!l) { l = []; rowLanes.set(r, l); }
    return l;
  };
  items.forEach(it => {
    rowLaneAt(it.row).push([it.centerPx - it.barW / 2, it.centerPx + it.barW / 2]);
  });

  const SIDE_GAP = 4;

  items.forEach((it, idx) => {
    const barStart = it.centerPx - it.barW / 2;
    const barEnd = it.centerPx + it.barW / 2;

    // Calibração CICB: rótulo sempre dentro da barra preta
    if (it.reason === 'calibracao') {
      const avail = it.barW - 4;
      const candidates: Array<[string, number]> = [
        [it.text, 11],
        [it.text, 10],
        [it.text, 9],
        [it.compact, 9],
        [it.compact, 8],
      ];
      const fit = candidates.find(([t, fs]) => measureText(t, fs) <= avail);
      const [text, fontSize] = fit ?? [it.compact, 8];
      out[it.id] = { mode: 'inside', text, fontSize, shift: 0 };
      return;
    }

    // 1) DENTRO DA BARRA — se o horário completo couber (barra grande/média)
    const INNER_PADDING = 8;
    for (const fs of [11, 10] as const) {
      if (measureText(it.text, fs) + INNER_PADDING <= it.barW) {
        out[it.id] = { mode: 'inside', text: it.text, fontSize: fs, shift: 0 };
        return;
      }
    }

    const base = 11;
    const w = measureText(it.text, base);

    // 2) DIREITA / 3) ESQUERDA — dentro da mesma linha, se houver espaço livre
    const rowLane = rowLaneAt(it.row);
    const rightX1 = barEnd + SIDE_GAP;
    const rightX2 = rightX1 + w;
    const leftX2 = barStart - SIDE_GAP;
    const leftX1 = leftX2 - w;

    const sideOptions: Array<['right' | 'left', number, number]> = [
      ['right', rightX1, rightX2],
      ['left', leftX1, leftX2],
    ];
    for (const [mode, x1, x2] of sideOptions) {
      const insideTrack = x1 >= 0 && (trackW <= 0 || x2 <= trackW);
      if (insideTrack && !overlaps(rowLane, x1, x2)) {
        rowLane.push([x1, x2]);
        out[it.id] = { mode, text: it.text, fontSize: base, shift: 0 };
        return;
      }
    }

    // 4) ACIMA / 5) ABAIXO — faixas entre linhas
    let center = it.centerPx;
    if (center - w / 2 < 0) center = w / 2;
    if (trackW > 0 && center + w / 2 > trackW) center = Math.max(w / 2, trackW - w / 2);
    const x1 = center - w / 2;
    const x2 = center + w / 2;

    const options: Array<['above' | 'below', number]> =
      idx % 2 === 0
        ? [['above', it.row], ['below', it.row + 1]]
        : [['below', it.row + 1], ['above', it.row]];
    const free = options.find(([, b]) => !overlaps(laneAt(b), x1, x2));
    if (free) {
      laneAt(free[1]).push([x1, x2]);
      out[it.id] = { mode: free[0], text: it.text, fontSize: base, shift: center - it.centerPx };
      return;
    }

    // 6) última alternativa: empurra para a faixa acima/abaixo deslocando o texto
    for (const [mode, boundary] of options) {
      const lane = laneAt(boundary);
      const occupied = [...lane].sort((a, b) => a[0] - b[0]);
      let cursor = Math.max(0, x1);
      for (const [a, b] of occupied) {
        if (cursor + w + 6 <= a) break;
        cursor = Math.max(cursor, b + 6);
      }
      if (trackW <= 0 || cursor + w <= trackW) {
        lane.push([cursor, cursor + w]);
        out[it.id] = {
          mode,
          text: it.text,
          fontSize: base,
          shift: cursor + w / 2 - it.centerPx,
        };
        return;
      }
    }

    // fallback absoluto: acima, com fonte menor (texto completo, sem truncar)
    laneAt(it.row).push([x1, x2]);
    out[it.id] = { mode: 'above', text: it.text, fontSize: 9, shift: center - it.centerPx };
  });

  return out;
}



/* =========================================================
GRID
========================================================= */
/** Formata duração em horas decimais como HH:MM. */
function fmtDurHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function Grid({
  records,
  fixedFrotasByFrente,
  keepEmptyFrotas = false,
  summaryLabel = 'QTD PARADAS',
}: {
  records: MaintenanceRecord[];
  fixedFrotasByFrente?: Map<string, string[]>;
  keepEmptyFrotas?: boolean;
  summaryLabel?: string;
}) {

  const { getNow, isLocked, lockedDate } = useSystemTime();
  const [now, setNow] = useState<Date>(() => getNow());

  useEffect(() => {
    setNow(getNow());
    if (isLocked) return; // travado → não avança
    const id = setInterval(() => setNow(getNow()), 30000);
    return () => clearInterval(id);
  }, [getNow, isLocked, lockedDate]);

  const dayStart = useMemo(() => getTodayOperationalStart(now), [now]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, MaintenanceRecord[]>>();
    if (fixedFrotasByFrente) {
      for (const [f, frotas] of fixedFrotasByFrente.entries()) {
        const inner = new Map<string, MaintenanceRecord[]>();
        if (keepEmptyFrotas) {
          frotas.forEach(fr => inner.set(fr, []));
        }
        map.set(f, inner);
      }
    }
    records.forEach((r) => {
      // Identidade da linha: frente da ocorrência (normalizada) + frota.
      // Usa a linha já existente (Cadastro) em vez de criar outra.
      const fNorm = normalizeFrenteNome(r.frente);
      const sameNum = (a: string, b: string) =>
        a === b || (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) === Number(b));
      const f = [...map.keys()].find(k => k === fNorm || normalizeFrenteNome(k) === fNorm) || fNorm || 'SEM FRENTE';
      if (!map.has(f)) map.set(f, new Map());
      const mf = map.get(f)!;
      const frRaw = String(r.frota || 'SEM').trim();
      const fr = [...mf.keys()].find(k => sameNum(String(k).trim(), frRaw)) ?? frRaw;
      if (!mf.has(fr)) mf.set(fr, []);
      mf.get(fr)!.push(r);
    });
    if (!keepEmptyFrotas) {
      for (const [k, v] of [...map.entries()]) {
        if (v.size === 0) map.delete(k);
      }
    }
    return map;
  }, [records, fixedFrotasByFrente, keepEmptyFrotas]);

  const hours = Array.from({ length: OPERATIONAL_HOURS + 1 }, (_, i) => {
    const h = (OPERATIONAL_START_HOUR + i) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  });

  // Largura da faixa de barras — usada apenas para detectar conflito entre rótulos
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackW(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nowOffset = offsetInOperationalDay(now, dayStart);
  const nowLeft =
    nowOffset >= 0 && nowOffset <= OPERATIONAL_HOURS
      ? (nowOffset / OPERATIONAL_HOURS) * 100
      : null;

  /* Barras por linha (frota), na MESMA ordem de renderização. */
  const rowsIndex = useMemo(() => {
    const map = new Map<string, { bars: BarItem[]; mostRecentId: string | null; row: number }>();
    let row = 0;
    for (const [frente, frotas] of grouped.entries()) {
      for (const [frota, recs] of frotas.entries()) {
        const bars: BarItem[] = recs
          .map((r) => {
            const sReal = safeDate(r.inicioTime);
            if (!sReal) return null;
            const isOpen = !r.fimTime;
            const eReal = isOpen ? now : safeDate(r.fimTime!);
            if (!eReal) return null;
            const startOff = Math.max(0, offsetInOperationalDay(sReal, dayStart));
            const endOff = Math.min(OPERATIONAL_HOURS, offsetInOperationalDay(eReal, dayStart));
            if (endOff <= 0 || startOff >= OPERATIONAL_HOURS) return null;
            const isOld = offsetInOperationalDay(sReal, dayStart) < 0;
            return { rec: r, sReal, eReal, startOff, endOff, isOpen, isOld } as BarItem;
          })
          .filter((b): b is BarItem => b !== null)
          .sort((a, b) => a.startOff - b.startOff);
        map.set(`${frente}||${frota}`, {
          bars,
          mostRecentId: bars.length > 0 ? bars[bars.length - 1].rec.id : null,
          row,
        });
        row += 1;
      }
    }
    return map;
  }, [grouped, now, dayStart]);

  /** Resumo por hora: quantidade de frotas distintas paradas e tempo total parado. */
  const hourly = useMemo(() => {
    const stats = Array.from({ length: OPERATIONAL_HOURS }, () => ({
      frotas: new Set<string>(),
      minutes: 0,
    }));
    for (const [key, info] of rowsIndex.entries()) {
      const frota = key.split('||')[1] ?? key;
      for (const b of info.bars) {
        for (let i = 0; i < OPERATIONAL_HOURS; i++) {
          const overlap = Math.min(b.endOff, i + 1) - Math.max(b.startOff, i);
          if (overlap > 0) {
            stats[i].frotas.add(frota);
            stats[i].minutes += overlap * 60;
          }
        }
      }
    }
    return stats.map(s => ({ count: s.frotas.size, minutes: s.minutes }));
  }, [rowsIndex]);

  /** Total geral de tempo parado (soma de todas as frotas/período). */
  const grandTotalHours = useMemo(
    () => hourly.reduce((s, h) => s + h.minutes, 0) / 60,
    [hourly],
  );
  const grandTotalCount = useMemo(
    () => hourly.reduce((s, h) => s + h.count, 0),
    [hourly],
  );



  /**
   * Plano GLOBAL dos rótulos: a detecção de colisão considera todas as linhas,
   * pois o espaço acima de uma linha é o mesmo espaço abaixo da linha anterior.
   * Recalculado sempre que dados ou largura disponível mudarem.
   */
  const globalPlans = useMemo(() => {
    if (trackW <= 0) return {} as Record<string, LabelPlan>;
    const items: LabelItem[] = [];
    for (const { bars, mostRecentId, row } of rowsIndex.values()) {
      for (const b of bars) {
        const isNarrow = ((b.endOff - b.startOff) / OPERATIONAL_HOURS) * 100 < 6;
        if (b.rec.id === mostRecentId && !isNarrow) continue; // rótulo já renderizado dentro da barra
        const reason = (b.rec.stopReason || 'manutencao') as StopReason;
        const t = `${formatHM(b.sReal)} - ${b.isOpen ? '...' : formatHM(b.eReal)}`;
        items.push({
          id: b.rec.id,
          text: b.isOld ? `${formatDate(b.sReal)} ${t}` : t,
          compact: formatHM(b.sReal),
          centerPx: (((b.startOff + b.endOff) / 2) / OPERATIONAL_HOURS) * trackW,
          barW: ((b.endOff - b.startOff) / OPERATIONAL_HOURS) * trackW,
          row,
          reason,
        });
      }
    }
    items.sort((a, b) => a.centerPx - b.centerPx);
    return planLabels(items, trackW);
  }, [rowsIndex, trackW]);

  return (

    <TooltipProvider>
      <div className="w-full gantt-surface rounded-none border">
        {/* HEADER HORAS */}
        <div className="flex border-b bg-muted/40">
          <div className="w-24 shrink-0 px-1.5 py-1 text-xs font-semibold">Frota</div>
          <div className="flex-1 flex min-w-0">
            <div ref={trackRef} className="flex-1 flex min-w-0">
              {hours.map((h, i) => (
                <div key={i} className="flex-1 min-w-0 text-[9px] text-center border-l py-1">
                  {h}
                </div>
              ))}
            </div>
            {/* coluna vazia fina: separação visual */}
            <div className="w-3 shrink-0 border-l py-1" aria-hidden="true" />
            <div className="w-[70px] shrink-0 border-l py-1 text-[9px] font-semibold text-center leading-tight">
              TOTAL POR FROTA
            </div>
          </div>
        </div>



        {/* FRENTES */}
        {[...grouped.entries()].map(([frente, frotas]) => {
          return (
          <div key={frente}>
            <div className="px-2 py-0.5 text-[10px] font-semibold bg-muted/30 border-b leading-tight">
              {frente}
            </div>

            {[...frotas.entries()].map(([frota]) => {
              const rowInfo = rowsIndex.get(`${frente}||${frota}`);
              const bars: BarItem[] = rowInfo?.bars ?? [];
              const mostRecentId = rowInfo?.mostRecentId ?? null;
              const plans = globalPlans;
              const totalFrota = bars.reduce((s, b) => s + Math.max(0, b.endOff - b.startOff), 0);





              return (
                <div key={frota} className="flex border-b">
                  <div className="w-24 shrink-0 px-1.5 py-1 text-[13px] font-mono font-semibold flex items-center truncate">
                    {frota}
                  </div>

                  <div
                    className="flex-1 min-w-0 flex"
                    style={{ height: 36 }}
                  >
                  <div className="flex-1 min-w-0 relative h-full">
                    {nowLeft !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                        style={{ left: `${nowLeft}%` }}
                      />
                    )}

                    {bars.map((bar, idx) => {
                      const left = (bar.startOff / OPERATIONAL_HOURS) * 100;
                      const width =
                        ((bar.endOff - bar.startOff) / OPERATIONAL_HOURS) * 100;
                      const reason = (bar.rec.stopReason ||
                        'manutencao') as StopReason;
                      const color = STOP_REASON_COLORS[reason];

                      const timeText = `${formatHM(bar.sReal)} - ${
                        bar.isOpen ? '...' : formatHM(bar.eReal)
                      }`;
                      const fullText = bar.isOld
                        ? `${formatDate(bar.sReal)} ${timeText}`
                        : timeText;
                      const isMostRecent = bar.rec.id === mostRecentId;

                      // Rótulo: fora da barra quando há espaço livre; caso
                      // contrário dentro da própria barra, centralizado.
                      const plan = plans[bar.rec.id];
                      const insideTextClass = STOP_REASON_TEXT[reason] ?? 'text-white';
                      const insideShadow = insideTextClass.includes('900') || insideTextClass.includes('black')
                        ? '0 1px 2px rgba(255,255,255,0.55)'
                        : '0 1px 2px rgba(0,0,0,0.55)';
                      let labelEl: React.JSX.Element;
                      if (isMostRecent && !plan) {
                        const durH = (bar.eReal.getTime() - bar.sReal.getTime()) / 3600000;
                        const centered = bar.isOpen && durH > 2;
                        labelEl = (
                          <span
                            className={`absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold whitespace-nowrap pointer-events-none ${insideTextClass} ${
                              centered ? 'left-1/2 -translate-x-1/2' : 'right-1'
                            }`}
                            style={{ textShadow: insideShadow }}
                          >
                            {fullText}
                          </span>
                        );
                      } else if (plan && plan.mode === 'inside') {
                        labelEl = (
                          <span className="absolute inset-0 flex items-center justify-center px-0.5 pointer-events-none">
                            <span
                              className={`font-semibold whitespace-nowrap leading-none ${insideTextClass}`}
                              style={{ fontSize: plan.fontSize, textShadow: insideShadow }}
                            >
                              {plan.text}
                            </span>
                          </span>
                        );
                      } else if (plan && (plan.mode === 'right' || plan.mode === 'left')) {
                        labelEl = (
                          <span
                            className="absolute top-1/2 -translate-y-1/2 font-semibold whitespace-nowrap pointer-events-none text-foreground"
                            style={{
                              fontSize: plan.fontSize,
                              ...(plan.mode === 'right'
                                ? { left: '100%', marginLeft: 4 }
                                : { right: '100%', marginRight: 4 }),
                            }}
                          >
                            {plan.text}
                          </span>
                        );

                      } else {
                        const above = plan ? plan.mode === 'above' : idx % 2 === 0;
                        const shift = plan?.shift ?? 0;
                        const outsideTextClass = 'text-foreground';
                        labelEl = (
                          <span
                            className={`absolute font-semibold whitespace-nowrap pointer-events-none ${outsideTextClass} ${
                              above ? 'bottom-[100%] mb-[1px]' : 'top-[100%] mt-[1px]'
                            }`}
                            style={{
                              left: '50%',
                              transform: `translateX(calc(-50% + ${shift}px))`,
                              fontSize: plan?.fontSize ?? 11,
                              textShadow: 'none',
                            }}
                          >
                            {plan?.text ?? fullText}
                          </span>
                        );
                      }

                      return (
                        <Tooltip key={bar.rec.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="gantt-bar absolute h-5 top-1/2 -translate-y-1/2 rounded-none ring-1 ring-black/20"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(0.3, width)}%`,
                                background: color,
                              }}
                            >
                              {labelEl}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="gantt-info">
                            <div className="text-xs">
                              <div className="font-semibold">
                                {STOP_REASON_LABELS[reason]}
                              </div>
                              <div>{fullText}</div>
                              {bar.rec.motivo && (
                                <div className="opacity-80">
                                  {bar.rec.motivo}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <div className="w-3 shrink-0 h-full border-l" aria-hidden="true" />
                  <div className="w-[70px] shrink-0 h-full border-l flex items-center justify-center text-[11px] font-mono font-semibold">
                    {totalFrota > 0 ? fmtDurHours(totalFrota) : '—'}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}

        {/* RESUMO POR HORA — alinhado às mesmas colunas horárias */}
        <div className="flex border-t bg-muted/20">
          <div className="w-24 shrink-0 px-1.5 py-1 text-[9px] font-semibold flex items-center">
            {summaryLabel}
          </div>
          <div className="flex-1 flex min-w-0">
            <div className="flex-1 flex min-w-0">
              {hours.map((_, i) => (
                <div key={i} className="flex-1 min-w-0 text-[9px] text-center border-l py-0.5 font-semibold">
                  {i < OPERATIONAL_HOURS ? hourly[i].count : ''}
                </div>
              ))}
            </div>
            <div className="w-3 shrink-0 border-l" aria-hidden="true" />
            <div className="w-[70px] shrink-0 border-l flex items-center justify-center text-[9px] font-mono font-bold">
              {grandTotalCount > 0 ? grandTotalCount : ''}
            </div>
          </div>
        </div>
        <div className="flex border-t bg-muted/20">
          <div className="w-24 shrink-0 px-1.5 py-1 text-[10px] font-bold flex items-center">
            TEMPO PARADA
          </div>
          <div className="flex-1 flex min-w-0">
            <div className="flex-1 flex min-w-0">
              {hours.map((_, i) => (
                <div key={i} className="flex-1 min-w-0 text-[10px] text-center border-l py-0.5 font-mono font-bold">
                  {i < OPERATIONAL_HOURS ? (hourly[i].minutes > 0 ? fmtDurHours(hourly[i].minutes / 60) : '') : ''}
                </div>
              ))}
            </div>
            <div className="w-3 shrink-0 border-l" aria-hidden="true" />
            <div className="w-[70px] shrink-0 border-l flex items-center justify-center text-[10px] font-mono font-bold">
              {grandTotalHours > 0 ? fmtDurHours(grandTotalHours) : ''}
            </div>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}

/* =========================================================
MAIN
========================================================= */
export function TimelineChart({
  records,
  equipment = [],
  frentes = [],
  onStartClimate,
  onFinalizeClimate,
}: Props) {
  const col = records.filter((r) => r.equipmentType === 'colhedora');
  const tr = records.filter((r) => r.equipmentType === 'trator');
  const ca = records.filter((r) => r.equipmentType === 'caminhao');

  const [copyingTab, setCopyingTab] = useState<string | null>(null);
  /** Aba atual do cronograma — as paradas em grupo valem só para este tipo. */
  const [tab, setTab] = useState<EquipmentType>('colhedora');

  /* ===== Paradas em grupo (Climática / Usina Parada) — derivadas dos registros ===== */
  /** Registros atualmente em aberto por motivo de grupo. */
  const activeByReason = useMemo(() => {
    const m = new Map<GroupStopReason, MaintenanceRecord[]>();
    GROUP_REASONS.forEach(reason => {
      m.set(reason, records.filter(r => r.status === 'em_manutencao' && r.stopReason === reason));
    });
    return m;
  }, [records]);
  const activeFor = (reason: GroupStopReason) =>
    (activeByReason.get(reason) ?? []).filter(r => r.equipmentType === tab);
  /** frota -> registro ativo (garante 1 parada ativa por frota e motivo). */
  const byFrotaFor = (reason: GroupStopReason) => {
    const m = new Map<string, MaintenanceRecord>();
    activeFor(reason).forEach(r => { if (!m.has(r.frota)) m.set(r.frota, r); });
    return m;
  };

  /** Motivo do diálogo de frentes atualmente aberto (null = fechado). */
  const [groupOpen, setGroupOpen] = useState<GroupStopReason | null>(null);
  /** Frente + motivo abertos no lápis (seleção de frotas). */
  const [pencil, setPencil] = useState<{ frente: FrenteConfig; reason: GroupStopReason } | null>(null);
  const [pencilSel, setPencilSel] = useState<Set<string>>(new Set());

  /* ===== Horário de início das paradas em grupo ===== */
  const { getNow: getSystemNow } = useSystemTime();
  const [definirInicio, setDefinirInicio] = useState(false);
  const [horaInicio, setHoraInicio] = useState('');
  // nova operação de grupo → começa sempre no modo "horário atual"
  useEffect(() => {
    if (groupOpen) { setDefinirInicio(false); setHoraInicio(''); }
  }, [groupOpen]);

  /**
   * Resolve o início da parada em grupo.
   * - desmarcado → undefined (o horário atual é capturado na confirmação);
   * - marcado → HH:MM na data operacional atual (06:00 → 05:59);
   * - marcado sem horário válido → null (bloqueia a confirmação).
   */
  const resolverInicio = (): string | undefined | null => {
    if (!definirInicio) return undefined;
    const hm = horaInicio.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hm)) {
      toast.error('Desmarque a seleção de horário inicial ou informe o horário de início.');
      return null;
    }
    const opStart = getTodayOperationalStart(getSystemNow());
    const d = new Date(opStart);
    if (Number(hm.slice(0, 2)) < OPERATIONAL_START_HOUR) d.setDate(d.getDate() + 1);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const iso = combineDateTime(ymd, hm);
    if (!iso) {
      toast.error('Desmarque a seleção de horário inicial ou informe o horário de início.');
      return null;
    }
    return iso;
  };

  const startTimeField = (
    <div className="border rounded px-2 py-1.5 space-y-1.5">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={definirInicio} onCheckedChange={v => setDefinirInicio(v === true)} />
        <span>Definir horário de início</span>
      </label>
      {definirInicio && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Horário de início:</span>
          <Input
            type="time"
            step={60}
            lang="pt-BR"
            value={horaInicio}
            onChange={e => setHoraInicio(e.target.value)}
            className="h-7 w-[110px] text-xs"
          />
        </div>
      )}
      {definirInicio && !horaInicio && (
        <p className="text-[11px] text-destructive">Desmarque a seleção de horário inicial ou informe o horário de início.</p>
      )}
    </div>
  );
  /** Frente + motivo aguardando confirmação do X (finalizar todas). */
  const [confirmX, setConfirmX] = useState<{ frente: FrenteConfig; reason: GroupStopReason } | null>(null);

  /** Frotas cadastradas vinculadas à frente (dinâmico, sem lista fixa). */
  const frotasDaFrente = (nome: string) =>
    equipment
      .filter(e => e.frente === nome && e.equipmentType === tab)
      .map(e => ({ frota: e.frota, equipmentType: e.equipmentType }))
      .sort((a, b) => a.frota.localeCompare(b.frota));

  const groupCountFrente = (reason: GroupStopReason, nome: string) =>
    activeFor(reason).filter(r => r.frente === nome).length;

  const openPencil = (f: FrenteConfig, reason: GroupStopReason) => {
    setPencilSel(new Set(activeFor(reason).filter(r => r.frente === f.nome).map(r => r.frota)));
    setPencil({ frente: f, reason });
  };

  const togglePencilFrota = (frota: string) => {
    setPencilSel(prev => {
      const next = new Set(prev);
      if (next.has(frota)) next.delete(frota); else next.add(frota);
      return next;
    });
  };

  const confirmPencil = () => {
    if (!pencil) return;
    const { frente, reason } = pencil;
    const byFrota = byFrotaFor(reason);
    const lista = frotasDaFrente(frente.nome);
    // novas seleções → iniciar parada agora
    const toStart: ClimateTarget[] = lista
      .filter(e => pencilSel.has(e.frota) && !byFrota.has(e.frota))
      .map(e => ({ frota: e.frota, frente: frente.nome, equipmentType: e.equipmentType }));
    // desmarcadas → finalizar parada agora
    const toFinish = activeFor(reason)
      .filter(r => r.frente === frente.nome && !pencilSel.has(r.frota))
      .map(r => r.id);

    let inicio: string | undefined;
    if (toStart.length > 0) {
      const r = resolverInicio();
      if (r === null) return; // estado ambíguo: não confirma
      inicio = r;
    }
    if (toFinish.length > 0) onFinalizeClimate?.(toFinish);
    if (toStart.length > 0) onStartClimate?.(toStart, reason, inicio);
    setPencil(null);
  };

  /** Todas as frotas de todas as frentes cadastradas. */
  const todasAsFrotas = (): ClimateTarget[] =>
    frentes.flatMap(f =>
      frotasDaFrente(f.nome).map(e => ({ frota: e.frota, frente: f.nome, equipmentType: e.equipmentType }))
    );

  /** Liga/desliga a parada em grupo para TODAS as frentes de uma vez. */
  const toggleTodasFrentes = (reason: GroupStopReason, marcar: boolean) => {
    if (marcar) {
      const byFrota = byFrotaFor(reason);
      const alvos = todasAsFrotas().filter(t => !byFrota.has(t.frota));
      if (alvos.length > 0) {
        const inicio = resolverInicio();
        if (inicio === null) return; // estado ambíguo: não confirma
        onStartClimate?.(alvos, reason, inicio);
      }
    } else {
      const ids = activeFor(reason).map(r => r.id);
      if (ids.length > 0) onFinalizeClimate?.(ids);
    }
  };

  const finalizeFrente = (reason: GroupStopReason, nome: string) => {
    const ids = activeFor(reason).filter(r => r.frente === nome).map(r => r.id);
    if (ids.length > 0) onFinalizeClimate?.(ids);
    setConfirmX(null);
  };


  const colRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLDivElement>(null);
  const caRef = useRef<HTMLDivElement>(null);

  const fixedByType = (type: string) => {
    const map = new Map<string, string[]>();
    frentes.forEach((f) => {
      const frotas = equipment
        .filter((e) => e.equipmentType === (type as any) && e.frente === f.nome)
        .map((e) => e.frota)
        .sort();
      map.set(f.nome, frotas);
    });
    return map;
  };

  const fixedColhedoras = useMemo(
    () => fixedByType('colhedora'),
    [equipment, frentes]
  );
  const fixedTratores = useMemo(
    () => fixedByType('trator'),
    [equipment, frentes]
  );
  const fixedCaminhoes = useMemo(
    () => fixedByType('caminhao'),
    [equipment, frentes]
  );

  const handleCopy = async (
    ref: React.RefObject<HTMLDivElement | null>,
    tabKey: string
  ) => {
    if (!ref.current) return;
    setCopyingTab(tabKey);
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) throw new Error('Falha ao gerar imagem');
      try {
        // @ts-ignore
        await navigator.clipboard.write([
          // @ts-ignore
          new ClipboardItem({ 'image/png': blob }),
        ]);
        toast.success('Cronograma copiado!');
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cronograma-${tabKey}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Cronograma baixado!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao copiar cronograma');
    } finally {
      setCopyingTab(null);
    }
  };

  const CopyBtn = ({
    onClick,
    tabKey,
  }: {
    onClick: () => void;
    tabKey: string;
  }) => (
    <Button size="sm" variant="outline" onClick={onClick} className="gap-1">
      <Copy className="w-3.5 h-3.5" />
      {copyingTab === tabKey ? 'Copiando...' : 'Copiar Cronograma'}
    </Button>
  );

  /** Botão de parada em grupo (Climática / Usina Parada) com contagem de frotas ativas. */
  const GroupBtn = ({ reason }: { reason: GroupStopReason }) => {
    const list = activeFor(reason);
    const active = list.length > 0;
    const Icon = GROUP_ICONS[reason];
    return (
      <Button
        size="sm"
        variant={active ? 'default' : 'outline'}
        onClick={() => setGroupOpen(reason)}
        className="gap-1"
        style={active ? { background: STOP_REASON_COLORS[reason], color: reason === 'troca_turno' ? '#000' : '#fff' } : undefined}
        title={`Selecione quais frentes entram em ${GROUP_LABELS[reason]}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {active
          ? `${GROUP_LABELS[reason]}: ${list.length} frota${list.length > 1 ? 's' : ''}`
          : GROUP_LABELS[reason]}
      </Button>
    );
  };

  return (
    <Tabs value={tab} onValueChange={v => setTab(v as EquipmentType)} className="space-y-2">
      <TabsList>
        <TabsTrigger value="colhedora">Colhedora</TabsTrigger>
        <TabsTrigger value="trator">Trator</TabsTrigger>
        <TabsTrigger value="caminhao">Caminhão</TabsTrigger>
      </TabsList>

      <TabsContent value="colhedora" className="space-y-2">
        <div className="flex justify-end gap-2">
          <GroupBtn reason="climatico" />
          <GroupBtn reason="usina_parada" />
          <GroupBtn reason="troca_turno" />
          <CopyBtn
            onClick={() => handleCopy(colRef, 'colhedora')}
            tabKey="colhedora"
          />
        </div>

        <div ref={colRef} className="bg-card p-2 rounded">
          <Legend equipmentType="colhedora" />
          <div className="w-full">
            <Grid
              records={col}
              fixedFrotasByFrente={fixedColhedoras}
              keepEmptyFrotas
              summaryLabel="QTD COLHEDORA"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="trator" className="space-y-2">
        <div className="flex justify-end gap-2">
          <GroupBtn reason="climatico" />
          <GroupBtn reason="usina_parada" />
          <GroupBtn reason="troca_turno" />
          <CopyBtn
            onClick={() => handleCopy(trRef, 'trator')}
            tabKey="trator"
          />
        </div>
        <div ref={trRef} className="bg-card p-2 rounded">
          <Legend equipmentType="trator" />
          <div className="w-full">
            <Grid records={tr} fixedFrotasByFrente={fixedTratores} summaryLabel="QTD TRATOR" />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="caminhao" className="space-y-2">
        <div className="flex justify-end">
          <CopyBtn
            onClick={() => handleCopy(caRef, 'caminhao')}
            tabKey="caminhao"
          />
        </div>
        <div ref={caRef} className="bg-card p-2 rounded">
          <Legend equipmentType="caminhao" />
          <div className="w-full">
            {/* Caminhões: sem divisão por frente — agrupa todos diretamente pelas frotas que têm registros */}
            <Grid records={ca.map(r => ({ ...r, frente: 'CAMINHÕES' }))} summaryLabel="QTD CAMINHÃO" />
          </div>
        </div>
      </TabsContent>
        {/* Parada em grupo — escolher a Frente, depois as frotas pelo lápis */}
        <Dialog open={groupOpen !== null} onOpenChange={o => { if (!o) setGroupOpen(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => { const I = GROUP_ICONS[groupOpen ?? 'climatico']; return <I className="h-4 w-4" />; })()}
                {' '}{groupOpen ? GROUP_LABELS[groupOpen] : ''} — Selecionar Frente
              </DialogTitle>
            </DialogHeader>
            {startTimeField}
            {frentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma frente cadastrada.</p>
            ) : (
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
                {(() => {
                  const reason = groupOpen ?? 'climatico';
                  const total = todasAsFrotas().length;
                  const ativas = activeFor(reason).length;
                  const todas = total > 0 && ativas >= total;
                  return (
                    <label className="flex items-center gap-2 border rounded px-2 py-1.5 cursor-pointer text-sm font-semibold">
                      <Checkbox
                        checked={todas}
                        onCheckedChange={() => toggleTodasFrentes(reason, !todas)}
                      />
                      <span className="flex-1">Selecionar todas as frentes</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{ativas}/{total} frota(s)</span>
                    </label>
                  );
                })()}
                {frentes.map(f => {
                  const reason = groupOpen ?? 'climatico';
                  const qtd = groupCountFrente(reason, f.nome);
                  const total = frotasDaFrente(f.nome).length;
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-2 border rounded px-2 py-1.5 text-sm transition-colors ${
                        qtd > 0 ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/50'
                      }`}
                    >
                      <span className="flex-1 truncate">{f.nome}</span>
                      {f.localidade && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">{f.localidade}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {qtd > 0 ? `${qtd}/${total} em ${GROUP_LABELS[reason].toLowerCase()}` : `${total} frota(s)`}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Selecionar frotas desta frente"
                        onClick={() => openPencil(f, reason)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      {qtd > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title={`Finalizar ${GROUP_LABELS[reason]} de todas as frotas desta frente`}
                          onClick={() => setConfirmX({ frente: f, reason })}
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              <Button size="sm" onClick={() => setGroupOpen(null)}>Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lápis — seleção individual das frotas da frente */}
        <Dialog open={!!pencil} onOpenChange={o => { if (!o) setPencil(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => { const I = GROUP_ICONS[pencil?.reason ?? 'climatico']; return <I className="h-4 w-4" />; })()}
                {' '}{pencil?.frente?.nome} — {pencil ? GROUP_LABELS[pencil.reason] : ''}
              </DialogTitle>
            </DialogHeader>
            {startTimeField}
            {(() => {
              const lista = pencil ? frotasDaFrente(pencil.frente.nome) : [];
              if (lista.length === 0) {
                return <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma frota vinculada a esta frente.</p>;
              }
              const byFrota = pencil ? byFrotaFor(pencil.reason) : new Map<string, MaintenanceRecord>();
              const todas = lista.every(e => pencilSel.has(e.frota));
              return (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  <label className="flex items-center gap-2 border rounded px-2 py-1.5 cursor-pointer text-sm font-semibold">
                    <Checkbox
                      checked={todas}
                      onCheckedChange={() =>
                        setPencilSel(todas ? new Set() : new Set(lista.map(e => e.frota)))
                      }
                    />
                    <span>Selecionar todas</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {lista.map(e => {
                      const checked = pencilSel.has(e.frota);
                      const ativo = byFrota.has(e.frota);
                      return (
                        <label
                          key={e.frota}
                          className={`flex items-center gap-2 border rounded px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                            checked ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => togglePencilFrota(e.frota)} />
                          <span className="flex-1 font-mono">{e.frota}</span>
                          {ativo && <span className="text-[10px] text-muted-foreground">ativo</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPencil(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmPencil}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação do X — finalizar todas as frotas da frente */}
        <Dialog open={!!confirmX} onOpenChange={o => { if (!o) setConfirmX(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Finalizar {confirmX ? GROUP_LABELS[confirmX.reason] : ''}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Deseja finalizar {confirmX ? `a ${GROUP_LABELS[confirmX.reason]}` : 'a parada'} para todas as frotas desta Frente?
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmX(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => confirmX && finalizeFrente(confirmX.reason, confirmX.frente.nome)}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



    </Tabs>
  );
}
