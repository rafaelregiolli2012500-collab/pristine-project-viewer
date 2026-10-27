/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  BarChart3, FileSpreadsheet, Download, Trash2,
  ChevronDown, Combine, AlertTriangle, CheckCircle2, Clock3, Plus, X, Gauge, HelpCircle, TrendingUp, TrendingDown, Upload,
} from 'lucide-react';
import { HarvesterIcon, TractorIcon, TruckIcon } from '@/components/coa/MachineIcons';

import * as XLSX from 'xlsx';
import type { MaintenanceRecord } from '@/types/maintenance';
import { buildFrontComparison, shouldSplitStopLines, frontKey } from '@/lib/timelineFrontComparison';
import { toast } from '@/hooks/use-toast';
import { stopCountsByFront, maintenanceWindows, maintenanceRanking, unionMinutes } from '@/lib/timelineFrontAnalysis';
import { FrontTimesComparison, ConsolidatedAnalysis, type FrontBreakdown, type BaseTimes } from '@/components/timeline/FrontAnalysisPanels';
import { TruckLogisticsDashboard } from '@/components/timeline/TruckLogisticsDashboard';
import { truckNorm, type TruckImport } from '@/lib/truckTimeline';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, Cell, LabelList, LineChart,
} from 'recharts';

/** Valor na ponta da barra: fora quando cabe, dentro (alinhado à direita) quando não cabe. */
function BarEndLabel(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, value, format, viewBox } = props;
  const num = Number(value);
  if (!isFinite(num)) return null;
  const text = format ? format(num) : String(value);
  const textW = String(text).length * 5.6 + 8;
  const plotRight = (viewBox?.x ?? 0) + (viewBox?.width ?? 0);
  const available = plotRight - (x + width);
  const inside = available < textW;
  return (
    <text
      x={inside ? x + width - 4 : x + width + 4}
      y={y + height / 2}
      textAnchor={inside ? 'end' : 'start'}
      dominantBaseline="central"
      fill={inside ? '#ffffff' : 'hsl(var(--foreground))'}
      style={{ fontSize: 10, fontWeight: 700 }}
    >
      {text}
    </text>
  );
}


/* ================= TYPES ================= */
interface Row {
  equipamento: string; descricao: string; dt: Date;
  frente: string; grupoFrente: string; operacao: string;
  estado: string; estadoOp: string; operador: string;
  horimetro: number; velocidade: number;
  categoria: Base;
}
type Base = 'colhedora' | 'trator' | 'canavieiro';
type Selector = Base | 'combinado';
type Category = 'producao' | 'parada' | 'deslocamento' | 'manobra' | 'standby' | 'outros';
interface Segment {
  id: string; equipamento: string; frente: string; grupoFrente: string; operacao: string;
  estado: string; estadoOp: string; operador: string;
  start: Date; end: Date; duracaoMin: number;
  horimetroIni: number; horimetroFim: number; velMedia: number;
  category: Category;
  categoria: Base;
}
type ClippedSegment = Segment & { clipStart: Date; clipEnd: Date };
interface ParseResult {
  rows: Row[]; totalLines: number; invalid: number; duplicates: number;
  headerDetected: boolean; delimiter: string; missingColumns: string[];
}
type Filters = {
  data: string; frente: string[]; equipamento: string[]; operador: string[];
  operacao: string[]; estadoOp: string[]; turno: string[]; categoria: Selector;
};
import { useUnit } from '@/hooks/useUnit';
import { getHourOffsets, DEFAULT_HOUR_START, DEFAULT_HOUR_END } from '@/lib/hourWindow';
import { HourRangeFilter } from '@/components/coa/HourRangeFilter';

const EMPTY_FILTERS: Filters = { data:'', frente:[], equipamento:[], operador:[], operacao:[], estadoOp:[], turno:[], categoria: 'colhedora' };

const LDT_COLH_KEY = 'ldt_raw_colhedoras';
const LDT_TRAT_KEY = 'ldt_raw_tratores';
const LDT_CANA_KEY = 'ldt_raw_canavieiros';
const BASE_LABEL: Record<Selector, string> = { colhedora: 'Colhedoras', trator: 'Tratores', canavieiro: 'Canavieiros', combinado: 'Colhedoras + Tratores' };
/** Seletor → bases incluídas (combinado = colhedoras + tratores). */
const inSelector = (b: Base, sel: Selector) => sel === 'combinado' ? b !== 'canavieiro' : b === sel;
/** Manutenção / espera de colhedora identificadas pela descrição da parada. */
const isManutencao = (s: { operacao: string; estadoOp: string }) => /MANUT|MECANIC|ELETRIC|OFICINA|QUEBRA/.test(`${s.operacao} ${s.estadoOp}`.toUpperCase());
const isEsperaColhedora = (s: { operacao: string; estadoOp: string }) => { const t = `${s.operacao} ${s.estadoOp}`.toUpperCase(); return /(ESPERA|AGUARD)/.test(t) && /COLHED/.test(t); };
const LDT_FILTERS_KEY = 'ldt_filters';

const COLORS: Record<Category, string> = {
  producao: '#16a34a', parada: '#dc2626', deslocamento: '#facc15',
  manobra: '#f97316', standby: '#a855f7', outros: '#94a3b8',
};
const CAT_LABEL: Record<Category, string> = {
  producao: 'Produção / Corte Cana Crua', parada: 'Parada',
  deslocamento: 'Deslocamento', manobra: 'Manobra',
  standby: 'Stand-By', outros: 'Outros',
};

/* ================= HELPERS ================= */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find(l => l.trim()) || '';
  const counts: Record<string, number> = {
    ';': (line.match(/;/g)||[]).length,
    '\t': (line.match(/\t/g)||[]).length,
    ',': (line.match(/,/g)||[]).length,
    '|': (line.match(/\|/g)||[]).length,
  };
  for (const d of [';','\t',',','|']) if (counts[d] > 0) return d;
  return ';';
}
function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.map(norm).join('|');
  return /equipamento|data|operacao|estado|frente|horimetro/.test(joined);
}
const HEADER_ALIASES: Record<string, string[]> = {
  equipamento: ['equipamento','equip','cod equipamento','codigo equipamento'],
  dataHora: ['data/hora','data hora','datahora','data-hora','timestamp'],
  data: ['data','dia'],
  hora: ['hora','horario'],
  frente: ['codigo frente (digitada)','codigo frente digitada','codigo frente','frente'],
  grupoFrente: ['grupo equipamento/frente','grupo equipamento frente','grupo frente','grupo equipamento','grupo do equipamento'],
  descricao: ['descricao equipamento','descricao','descrição equipamento','descrição'],
  operacao: ['operacao','operação','descricao operacao','descrição operação'],
  estadoOp: ['estado operacional','estado op','estado op.','estado'],
  operador: ['operador','nome operador'],
  horimetro: ['horimetro','horímetro'],
  velocidade: ['velocidade','vel'],
};
const FALLBACK: Record<string, number> = {
  equipamento:0, dataHora:1, frente:4, descricao:7, estadoOp:9,
  grupoFrente:12, horimetro:14, operacao:20, operador:21, velocidade:31,
};
function buildHeaderIndex(cells: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  cells.forEach((c, i) => {
    const n = norm(c);
    for (const key of Object.keys(HEADER_ALIASES)) {
      if (HEADER_ALIASES[key].includes(n) && idx[key] === undefined) idx[key] = i;
    }
  });
  return idx;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const d = new Date(y, +m[2]-1, +m[1], +m[4], +m[5], +(m[6]||0));
    return isNaN(d.getTime()) ? null : d;
  }
  const n = parseFloat(s);
  if (!isNaN(n) && n > 20000 && n < 80000) {
    const ms = (n - 25569) * 86400 * 1000;
    return new Date(ms);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function num(v: string): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function isMuda(r: { equipamento: string; descricao: string; frente: string; grupoFrente: string }) {
  const blob = (r.equipamento + ' ' + r.descricao + ' ' + r.frente + ' ' + r.grupoFrente).toUpperCase();
  return blob.includes('MUDA');
}

function parseSmart(text: string, categoria: Base): ParseResult {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  let headerDetected = false;
  let idx: Record<string, number> = {};
  let start = 0;
  let missingColumns: string[] = [];
  if (lines.length > 0) {
    const first = lines[0].split(delimiter);
    if (looksLikeHeader(first)) {
      headerDetected = true;
      idx = buildHeaderIndex(first);
      start = 1;
      missingColumns = ['equipamento','operacao','estadoOp'].filter(k => idx[k] === undefined);
    }
  }
  const col = (k: string) => (idx[k] !== undefined ? idx[k] : (FALLBACK[k] ?? -1));
  const rows: Row[] = [];
  let invalid = 0, duplicates = 0;
  const seen = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const c = lines[i].split(delimiter);
    if (c.length < 3) { invalid++; continue; }
    const get = (k: string) => { const j = col(k); return j >= 0 && j < c.length ? (c[j] ?? '').trim() : ''; };
    let dtStr = '';
    if (col('dataHora') >= 0 && get('dataHora')) dtStr = get('dataHora');
    else if (col('data') >= 0 && col('hora') >= 0) dtStr = `${get('data')} ${get('hora')}`;
    const dt = parseDate(dtStr);
    if (!dt) { invalid++; continue; }
    const row: Row = {
      equipamento: get('equipamento') || 'SEM',
      descricao: get('descricao'),
      dt,
      frente: get('frente') || 'SEM',
      grupoFrente: get('grupoFrente'),
      operacao: get('operacao'),
      estado: get('estadoOp'),
      estadoOp: get('estadoOp'),
      operador: get('operador'),
      horimetro: num(get('horimetro')),
      velocidade: num(get('velocidade')),
      categoria,
    };
    // Tratores: a Frente vem sempre do GRUPO EQUIPAMENTO (nunca da descrição).
    if (categoria === 'trator' && row.grupoFrente) row.frente = row.grupoFrente;
    if (isMuda(row)) continue;
    const key = `${row.equipamento}|${dt.getTime()}|${row.operacao}|${row.estadoOp}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    rows.push(row);
  }
  return { rows, totalLines: lines.length - start, invalid, duplicates, headerDetected, delimiter, missingColumns };
}

function categorize(operacao: string, estado: string): Category {
  const o = (operacao||'').toUpperCase();
  const e = (estado||'').toUpperCase();
  if (o.includes('STAND') || o.includes('STAND-BY') || o.includes('STAND BY') || o.includes('STANDBY') ||
      e.includes('STAND') || e.includes('STAND-BY') || e.includes('STAND BY') || e.includes('STANDBY')) return 'standby';
  if (e.includes('PARADA')) return 'parada';
  if (o.includes('MANOBRA')) return 'manobra';
  if (o.includes('DESLOCAMENTO')) return 'deslocamento';
  if (o.includes('CORTE') || o.includes('COLHEITA') || e.includes('TRABALHANDO')) return 'producao';
  return 'outros';
}

function buildSegments(rows: Row[]): Segment[] {
  const byEq = new Map<string, Row[]>();
  rows.forEach(r => {
    if (!byEq.has(r.equipamento)) byEq.set(r.equipamento, []);
    byEq.get(r.equipamento)!.push(r);
  });
  const segs: Segment[] = [];
  for (const [eq, list] of byEq.entries()) {
    list.sort((a,b) => a.dt.getTime() - b.dt.getTime());
    let cur: Row[] = [];
    const flush = (next?: Row) => {
      if (cur.length === 0) return;
      const first = cur[0], last = cur[cur.length-1];
      const end = next ? next.dt : new Date(last.dt.getTime() + 10000);
      const dur = (end.getTime() - first.dt.getTime()) / 60000;
      const vels = cur.map(r => r.velocidade).filter(v => !isNaN(v));
      const velMedia = vels.length ? vels.reduce((a,b)=>a+b,0)/vels.length : 0;
      segs.push({
        id: `${eq}-${first.dt.getTime()}`,
        equipamento: eq,
        frente: first.frente,
        grupoFrente: first.grupoFrente,
        operacao: first.operacao,
        estado: first.estado,
        estadoOp: first.estadoOp,
        operador: first.operador,
        start: first.dt,
        end,
        duracaoMin: dur,
        horimetroIni: first.horimetro,
        horimetroFim: last.horimetro,
        velMedia,
        category: categorize(first.operacao, first.estadoOp),
        categoria: first.categoria,
      });
      cur = [];
    };
    for (const r of list) {
      if (cur.length === 0) cur.push(r);
      else {
        const prev = cur[cur.length-1];
        const same = prev.operacao === r.operacao && prev.estado === r.estado && prev.estadoOp === r.estadoOp;
        if (same) cur.push(r);
        else { flush(r); cur.push(r); }
      }
    }
    flush();
  }
  return segs;
}

const pad2 = (n: number) => String(n).padStart(2,'0');
const fmtDateBR = (d: Date) => d.toLocaleDateString('pt-BR');
const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
function fmtDur(min: number): string {
  const h = Math.floor(min/60); const m = Math.round(min % 60);
  return h > 0 ? `${h}h${pad2(m)}` : `${m}min`;
}


/* ================= MULTISELECT ================= */
function MultiSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const isAll = value.length === 0 || value.length === options.length;
  const trigger = isAll ? 'Todos' : `${value.length} selecionado(s)`;
  const toggle = (o: string) => {
    const set = new Set(value.length === 0 ? options : value);
    if (set.has(o)) set.delete(o); else set.add(o);
    const arr = [...set];
    onChange(arr.length === options.length ? [] : arr);
  };
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-8 w-full justify-between text-xs font-normal">
            <span className="truncate">{trigger}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="flex gap-1 mb-2">
            <Button size="sm" variant="outline" className="h-7 flex-1 text-[10px]" onClick={() => onChange([])}>Selecionar Todos</Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-[10px]" onClick={() => onChange(['__none__'])}>Limpar</Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {options.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">Sem opções</p>}
            {options.map(o => {
              const checked = value.length === 0 ? true : value.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(o)} />
                  <span className="truncate">{o}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function inFilter(v: string, sel: string[]): boolean {
  if (sel.length === 0) return true;
  if (sel.length === 1 && sel[0] === '__none__') return false;
  return sel.includes(v);
}

/* ================= PASTE PANEL ================= */
function PastePanel({
  title, iconEl, accentBar, value, onChange, res, onClear,
}: {
  title: string;
  iconEl: React.ReactNode;
  accentBar: string;
  value: string;
  onChange: (v: string) => void;
  res: ParseResult | null;
  onClear: () => void;
}) {
  const has = res && res.rows.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Importa base de arquivo: .txt/.csv/.tsv (texto) ou .xlsx (1ª planilha → TSV). */
  const handleImportFile = async (file: File) => {
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const wb = XLSX.read(await file.arrayBuffer());
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('Planilha vazia');
        onChange(XLSX.utils.sheet_to_csv(ws, { FS: '\t' }));
      } else {
        onChange(await file.text());
      }
      toast({ title: `Base de ${title} importada`, description: file.name });
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao importar arquivo', description: 'Verifique o formato do arquivo e tente novamente.' });
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${accentBar}`} />
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">{iconEl} {title}</CardTitle>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.tsv,.xlsx,.xls"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3" /> Importar Base
          </Button>
        {value && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-7 gap-1 text-xs">
                <Trash2 className="h-3 w-3" /> Apagar Base
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover base importada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja realmente remover esta base importada? Cronogramas, gráficos, indicadores e estatísticas serão atualizados automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onClear}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {has && res && (
          <div className="text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {res.rows.length} registros válidos</span>
            <span className="text-muted-foreground">· delim.: {res.delimiter === '\t' ? 'TAB' : res.delimiter}</span>
            <span className="text-muted-foreground">· cabeçalho: {res.headerDetected ? 'detectado' : 'padrão'}</span>
            {res.invalid > 0 && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {res.invalid} inválidos</span>}
            {res.duplicates > 0 && <span className="text-amber-600">· {res.duplicates} duplicados</span>}
            {res.missingColumns.length > 0 && <span className="text-red-600">· faltando: {res.missingColumns.join(', ')}</span>}
          </div>
        )}
        {!has && (
          <p className="text-xs text-muted-foreground">
            Copie a planilha original (com ou sem cabeçalho) e cole abaixo, ou use <strong>Importar Base</strong> para carregar um arquivo (.txt, .csv, .tsv, .xlsx). O sistema detecta o delimitador (<code>;</code>, <code>TAB</code>, <code>,</code>) e mapeia as colunas automaticamente.
          </p>
        )}
        <textarea
          className="w-full h-56 rounded border bg-background p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={`Cole aqui a base de ${title.toLowerCase()}...`}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}

/* ================= MAIN ================= */
type AddToHistoryFn = (
  payload: Omit<MaintenanceRecord, 'id' | 'status' | 'stopReason'>
) => { ok: boolean; error?: string; duplicate?: boolean };

export function LinhaDoTempo({ records = [], onAddToHistory }: {
  records?: MaintenanceRecord[];
  onAddToHistory?: AddToHistoryFn;
} = {}) {
  /** IDs de eventos da Linha do Tempo já enviados ao Histórico. */
  const addedEventIds = useMemo(
    () => new Set(records.map(r => r.sourceEventId).filter((v): v is string => !!v)),
    [records],
  );
  const handleAddToHistory = (s: Segment) => {
    if (!onAddToHistory) return;
    const sourceEventId = s.id.split('@')[0];
    const result = onAddToHistory({
      frota: s.equipamento,
      frente: s.frente,
      equipmentType: s.categoria === 'colhedora' ? 'colhedora' : s.categoria === 'canavieiro' ? 'caminhao' : 'trator',
      motivo: [s.operacao, s.estadoOp].filter(Boolean).join(' — '),
      inicioTime: s.start.toISOString(),
      fimTime: s.end.toISOString(),
      operador: s.operador || undefined,
      operacao: s.operacao || undefined,
      estado: s.estado || undefined,
      estadoOp: s.estadoOp || undefined,
      sourceEventId,
    });
    if (result.ok) toast({ title: 'Parada adicionada ao Histórico', description: 'Tipo de manutenção: NULL' });
    else if (result.duplicate) toast({ title: 'Parada já adicionada', description: result.error });
    else toast({ variant: 'destructive', title: 'Não foi possível adicionar', description: result.error });
  };
  const [rawColh, setRawColh] = useState<string>('');
  const [rawTrat, setRawTrat] = useState<string>('');
  const [resColh, setResColh] = useState<ParseResult | null>(null);
  const [resTrat, setResTrat] = useState<ParseResult | null>(null);
  const [rawCana, setRawCana] = useState<string>('');
  const [resCana, setResCana] = useState<ParseResult | null>(null);
  const [truckImport, setTruckImport] = useState<TruckImport | null>(null);
  const [truckProcessing, setTruckProcessing] = useState(false);
  const [truckError, setTruckError] = useState('');
  const [graphicsMode, setGraphicsMode] = useState<'timeline' | 'trucks'>('timeline');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [comparisonBase, setComparisonBase] = useState<'auto' | 'colhedora' | 'trator'>('auto');
  const [categoryView, setCategoryView] = useState<Category | 'todos'>('todos');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [highlightHour, setHighlightHour] = useState<number | null>(null);
  const [innerTab, setInnerTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'cronograma';
    try { return localStorage.getItem('ldt_inner_tab') || 'cronograma'; } catch { return 'cronograma'; }
  });
  const timelineRef = useRef<HTMLDivElement>(null);
  const selectionAreaRef = useRef<HTMLDivElement>(null);

  // Init from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const c = localStorage.getItem(LDT_COLH_KEY);
      const t = localStorage.getItem(LDT_TRAT_KEY);
      const f = localStorage.getItem(LDT_FILTERS_KEY);
      if (c) { setRawColh(c); setResColh(parseSmart(c, 'colhedora')); }
      if (t) { setRawTrat(t); setResTrat(parseSmart(t, 'trator')); }
      const cn = localStorage.getItem(LDT_CANA_KEY);
      if (cn) setRawCana(cn);
      if (f) { const p = JSON.parse(f); if (p.categoria === 'todos' || !p.categoria) p.categoria = 'colhedora'; setFilters({ ...EMPTY_FILTERS, ...p }); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(LDT_FILTERS_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);

  const handlePasteColh = (v: string) => {
    setRawColh(v);
    if (v) { setResColh(parseSmart(v, 'colhedora')); if (typeof window !== 'undefined') localStorage.setItem(LDT_COLH_KEY, v); }
    else { setResColh(null); if (typeof window !== 'undefined') localStorage.removeItem(LDT_COLH_KEY); }
  };
  const handlePasteTrat = (v: string) => {
    setRawTrat(v);
    if (v) { setResTrat(parseSmart(v, 'trator')); if (typeof window !== 'undefined') localStorage.setItem(LDT_TRAT_KEY, v); }
    else { setResTrat(null); if (typeof window !== 'undefined') localStorage.removeItem(LDT_TRAT_KEY); }
  };

  const handlePasteCana = (v: string) => {
    setRawCana(v);
    try {
      if (v) localStorage.setItem(LDT_CANA_KEY, v);
      else localStorage.removeItem(LDT_CANA_KEY);
    } catch { toast({ variant: 'destructive', title: 'Base carregada apenas nesta sessão', description: 'Sem espaço para guardar a base neste dispositivo.' }); }
  };

  useEffect(() => {
    setTruckImport(null); setResCana(null); setTruckError('');
    if (!rawCana.trim()) { setTruckProcessing(false); return; }
    const header = truckNorm(rawCana.split(/\r?\n/).find(line => line.trim()) ?? '');
    if (!header.includes('ESTADO OPERACIONAL') && !header.includes('GRUPO OPERACAO') && !header.includes('MOTOR LIGADO')) {
      setTruckProcessing(false); setResCana(parseSmart(rawCana, 'canavieiro')); return;
    }
    setTruckProcessing(true);
    const worker = new Worker(new URL('../workers/truckImport.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ result?: TruckImport; error?: string }>) => {
      setTruckProcessing(false);
      if (event.data.result) { setTruckImport(event.data.result); setResCana(event.data.result); }
      else setTruckError(event.data.error ?? 'Falha ao interpretar a base de caminhões.');
    };
    worker.onerror = () => { setTruckProcessing(false); setTruckError('Falha ao processar a base de caminhões. Importe novamente.'); };
    worker.postMessage({ text: rawCana });
    return () => worker.terminate();
  }, [rawCana]);

  const rows = useMemo(() => [...(resColh?.rows ?? []), ...(resTrat?.rows ?? []), ...(resCana?.rows ?? [])], [resColh, resTrat, resCana]);
  /** Seletores dinâmicos conforme as bases realmente carregadas. */
  const availableSelectors = useMemo<Selector[]>(() => {
    const hasC = !!resColh?.rows.length, hasT = !!resTrat?.rows.length, hasN = !!resCana?.rows.length;
    const out: Selector[] = [];
    if (hasC) out.push('colhedora');
    if (hasT) out.push('trator');
    if (hasN) out.push('canavieiro');
    if (hasC && hasT) out.push('combinado');
    return out;
  }, [resColh, resTrat, resCana]);
  useEffect(() => {
    if (availableSelectors.length && !availableSelectors.includes(filters.categoria)) {
      setFilters(f => ({ ...f, categoria: availableSelectors[0] }));
    }
  }, [availableSelectors, filters.categoria]);
  const isCombined = filters.categoria === 'combinado';
  /** ADD AO HISTÓRICO é exclusivo da visualização Colhedoras (não aparece em Tratores, Canavieiros nem na consolidada). */
  const showAddToHistory = filters.categoria === 'colhedora';
  const segments = useMemo(() => buildSegments(rows), [rows]);

  // Rows/segments filtered pelo Tipo de Equipamento (para popular listas de filtros)
  const catRows = useMemo(
    () => rows.filter(r => inSelector(r.categoria, filters.categoria)),
    [rows, filters.categoria],
  );
  const catSegments = useMemo(
    () => segments.filter(s => inSelector(s.categoria, filters.categoria)),
    [segments, filters.categoria],
  );

  const uniqFrom = (arr: Row[], k: keyof Row) =>
    [...new Set(arr.map(r => String(r[k])).filter(Boolean))].sort();
  const frentes      = useMemo(() => uniqFrom(catRows, 'frente'),      [catRows]);
  const equipamentos = useMemo(() => uniqFrom(catRows, 'equipamento'), [catRows]);
  const operadores   = useMemo(() => uniqFrom(catRows, 'operador'),    [catRows]);
  const operacoes    = useMemo(() => uniqFrom(catRows, 'operacao'),    [catRows]);
  const estadosOp    = useMemo(() => uniqFrom(catRows, 'estadoOp'),    [catRows]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of catSegments) {
      const x = new Date(s.start);
      if (x.getHours() < 6) x.setDate(x.getDate() - 1);
      const key = `${x.getFullYear()}-${pad2(x.getMonth()+1)}-${pad2(x.getDate())}`;
      set.add(key);
    }
    return [...set].sort();
  }, [catSegments]);

  const latestBaseDate = useMemo(() => segments.reduce((latest, segment) => {
    const date = new Date(segment.start);
    if (date.getHours() < 6) date.setDate(date.getDate() - 1);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    return key > latest ? key : latest;
  }, ''), [segments]);
  const activeDate = filters.data || availableDates[availableDates.length - 1] || latestBaseDate;
  const { isHourMode } = useUnit();
  const [hourStart, setHourStart] = useState(DEFAULT_HOUR_START);
  const [hourEnd, setHourEnd] = useState(DEFAULT_HOUR_END);
  /** Janela visível (offsets em horas a partir das 06:00 do dia operacional). */
  const { startOff: viewStartOff, endOff: viewEndOff } = isHourMode
    ? getHourOffsets(hourStart, hourEnd)
    : { startOff: 0, endOff: 24 };
  const viewHours = Math.max(0.25, viewEndOff - viewStartOff);
  /** Converte um offset em horas (a partir das 06:00) em % dentro da janela visível. */
  const pctOf = (offH: number) => ((offH - viewStartOff) / viewHours) * 100;
  const { dayStart, dayEnd } = useMemo(() => {
    if (!activeDate) return { dayStart: null as Date | null, dayEnd: null as Date | null };
    const [y,m,d] = activeDate.split('-').map(Number);
    const ds = new Date(y, m-1, d, 6, 0, 0);
    // 24h completos: 06:00 → 06:00 do dia seguinte (representa até 05:59:59)
    return { dayStart: ds, dayEnd: new Date(ds.getTime() + 24*3600*1000) };
  }, [activeDate]);

  const clippedSegments = useMemo<ClippedSegment[]>(() => {
    if (!dayStart || !dayEnd) return [];
    // Janelas do dia operacional: A 06-14, B 14-22, C 22-06
    const allTurnos: Array<'A'|'B'|'C'> = ['A','B','C'];
    const selTurnos = allTurnos.filter(t => inFilter(t, filters.turno));
    const raw = isHourMode
      ? [{
          start: dayStart.getTime() + viewStartOff * 3600 * 1000,
          end: dayStart.getTime() + viewEndOff * 3600 * 1000,
        }]
      : selTurnos.map(t => {
          const offset = t === 'A' ? 0 : t === 'B' ? 8 : 16;
          const ws = dayStart.getTime() + offset * 3600 * 1000;
          return { start: ws, end: ws + 8 * 3600 * 1000 };
        }).sort((a, b) => a.start - b.start);
    // Une janelas contíguas (ex.: A+B+C = 24h corridas)
    const windows: { start: number; end: number }[] = [];
    for (const w of raw) {
      const last = windows[windows.length - 1];
      if (last && last.end === w.start) last.end = w.end;
      else windows.push({ ...w });
    }
    const out: ClippedSegment[] = [];
    for (const s of segments) {
      if (s.end <= dayStart || s.start >= dayEnd) continue;
      if (!inFilter(s.frente,      filters.frente)) continue;
      if (!inFilter(s.equipamento, filters.equipamento)) continue;
      if (!inFilter(s.operador,    filters.operador)) continue;
      if (!inFilter(s.operacao,    filters.operacao)) continue;
      if (!inFilter(s.estadoOp,    filters.estadoOp)) continue;
      for (const w of windows) {
        const cs = Math.max(s.start.getTime(), w.start);
        const ce = Math.min(s.end.getTime(), w.end);
        if (ce <= cs) continue;
        out.push({ ...s, id: `${s.id}@${cs}`, clipStart: new Date(cs), clipEnd: new Date(ce) });
      }
    }
    return out;
  }, [segments, dayStart, dayEnd, filters, isHourMode, viewStartOff, viewEndOff]);
  const daySegments = useMemo(
    () => clippedSegments.filter(s => inSelector(s.categoria, filters.categoria)),
    [clippedSegments, filters.categoria],
  );


  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ClippedSegment[]>>();
    const useGrupo = filters.categoria === 'trator';
    const visibleSegments = categoryView === 'todos'
      ? daySegments
      : daySegments.filter(s => s.category === categoryView);
    for (const s of visibleSegments) {
      const key = useGrupo ? (s.grupoFrente || s.frente || 'SEM') : (s.frente || 'SEM');
      if (!map.has(key)) map.set(key, new Map());
      const inner = map.get(key)!;
      if (!inner.has(s.equipamento)) inner.set(s.equipamento, []);
      inner.get(s.equipamento)!.push(s);
    }
    return map;
  }, [daySegments, filters.categoria, categoryView]);

  const summary = useCallback((segs: ClippedSegment[]) => {
    const totals = { producao:0, parada:0, deslocamento:0, manobra:0, outros:0 } as Record<Category, number>;
    let paradas = 0;
    let hIni = Infinity, hFim = -Infinity;
    for (const s of segs) {
      const dur = (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
      totals[s.category] += dur;
      if (s.category === 'parada') paradas++;
      if (s.horimetroIni && s.horimetroIni < hIni) hIni = s.horimetroIni;
      if (s.horimetroFim && s.horimetroFim > hFim) hFim = s.horimetroFim;
    }
    const totalMin = totals.producao + totals.parada + totals.deslocamento + totals.manobra + totals.outros;
    const uptime = totals.producao + totals.deslocamento + totals.manobra;
    const disp = totalMin ? (uptime / totalMin) * 100 : 0;
    const mttr = paradas ? totals.parada / paradas : 0;
    const mtbf = paradas ? uptime / paradas : uptime;
    const horas = isFinite(hIni) && isFinite(hFim) ? hFim - hIni : 0;
    return { totals, paradas, hIni, hFim, horas, totalMin, disp, uptime, mttr, mtbf };
  }, []);

  /** O mesmo conjunto renderizado alimenta linhas, totais e seleção. */
  const visibleSegments = useMemo(
    () => categoryView === 'todos' ? daySegments : daySegments.filter(s => s.category === categoryView),
    [daySegments, categoryView],
  );
  const periodSummary = useMemo(() => summary(visibleSegments), [summary, visibleSegments]);
  const summarizeFrentes = useCallback((segs: ClippedSegment[]) => {
    const fronts = new Map<string, ClippedSegment[]>();
    for (const segment of segs) {
      const key = frontKey(segment.frente);
      const items = fronts.get(key) ?? [];
      items.push(segment);
      fronts.set(key, items);
    }
    return [...fronts.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([frente, items]) => ({ frente, ...summary(items) }));
  }, [summary]);
  const frontSummaries = useMemo(() => summarizeFrentes(visibleSegments), [summarizeFrentes, visibleSegments]);
  /** Efetividade por frente: mesma fórmula oficial (summary().disp) sobre o mesmo conjunto filtrado. */
  const frontEffectiveness = useMemo(() => frontSummaries
    .filter(f => f.totalMin > 0)
    .map(f => ({ frente: f.frente, label: `F${f.frente}`, pct: Math.round(f.disp * 10) / 10, uptime: f.uptime, totalMin: f.totalMin, parada: f.totals.parada })),
  [frontSummaries]);
  const effBest = useMemo(() => frontEffectiveness.reduce<typeof frontEffectiveness[number] | null>((b, f) => !b || f.pct > b.pct ? f : b, null), [frontEffectiveness]);
  const effWorst = useMemo(() => frontEffectiveness.reduce<typeof frontEffectiveness[number] | null>((b, f) => !b || f.pct < b.pct ? f : b, null), [frontEffectiveness]);
  /** Comparativo operacional dos tratores por frente (Grupo Equipamento). */
  const tractorComparison = useMemo(() => {
    if (filters.categoria !== 'trator') return [];
    const map = new Map<string, { frotas: Set<string>; manut: number; prod: number; desl: number; espera: number }>();
    for (const s of visibleSegments) {
      const key = frontKey(s.frente);
      const cur = map.get(key) ?? { frotas: new Set<string>(), manut: 0, prod: 0, desl: 0, espera: 0 };
      const dur = (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
      cur.frotas.add(s.equipamento);
      if (s.category === 'parada' && isManutencao(s)) cur.manut += dur;
      if (s.category === 'producao') cur.prod += dur;
      if (s.category === 'deslocamento') cur.desl += dur;
      if (isEsperaColhedora(s)) cur.espera += dur;
      map.set(key, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([frente, v]) => ({ frente, tratores: v.frotas.size, manut: v.manut, prod: v.prod, desl: v.desl, espera: v.espera }));
  }, [filters.categoria, visibleSegments]);
  /** DEFT de manutenção por horário (minutos de parada por manutenção em cada hora). */
  const deftManutencao = useMemo(() => {
    const mins: Record<number, number> = {};
    for (const s of visibleSegments) {
      if (s.category !== 'parada' || !isManutencao(s)) continue;
      let t = s.clipStart.getTime();
      const end = s.clipEnd.getTime();
      while (t < end) {
        const d = new Date(t);
        const next = Math.min(end, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime());
        mins[d.getHours()] = (mins[d.getHours()] || 0) + (next - t) / 60000;
        t = next;
      }
    }
    return Array.from({ length: 24 }, (_, i) => (6 + i) % 24).map(h => ({ hora: `${pad2(h)}:00`, min: Math.round(mins[h] || 0) }));
  }, [visibleSegments]);
  /** Paradas por frota (canavieiros). */
  const paradasPorFrota = useMemo(() => {
    const map = new Map<string, { qtd: number; min: number }>();
    for (const s of visibleSegments) {
      if (s.category !== 'parada') continue;
      const cur = map.get(s.equipamento) ?? { qtd: 0, min: 0 };
      cur.qtd += 1; cur.min += (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
      map.set(s.equipamento, cur);
    }
    return [...map.entries()].map(([frota, v]) => ({ frota, qtd: v.qtd, horas: Math.round(v.min / 60 * 100) / 100 })).sort((a, b) => b.horas - a.horas);
  }, [visibleSegments]);
  const comparisonSegments = useMemo(() => clippedSegments.filter(s =>
    (comparisonBase === 'auto' || s.categoria === comparisonBase) &&
    (categoryView === 'todos' || s.category === categoryView)
  ), [clippedSegments, comparisonBase, categoryView]);
  const splitStopLines = shouldSplitStopLines(comparisonBase, Boolean(resColh?.rows.length), Boolean(resTrat?.rows.length));
  const frontComparison = useMemo(() => buildFrontComparison(
    summarizeFrentes(comparisonSegments),
    splitStopLines ? summarizeFrentes(comparisonSegments.filter(s => s.categoria === 'colhedora')) : [],
    splitStopLines ? summarizeFrentes(comparisonSegments.filter(s => s.categoria === 'trator')) : [],
  ), [summarizeFrentes, comparisonSegments, splitStopLines]);
  /* ===== Camada de análise por frente (somente leitura, sobre o mesmo recorte oficial) ===== */
  const analysisSegs = useMemo(() => clippedSegments.map(s => ({ ...s, manutencao: s.category === 'parada' && isManutencao(s) })), [clippedSegments]);
  const frontBreakdown = useMemo<FrontBreakdown[]>(() => {
    const toTimes = (f: ReturnType<typeof summarizeFrentes>[number], segs: ClippedSegment[]): BaseTimes => {
      const t = f.totals as Record<string, number>;
      const ids = new Set(segs.filter(s => frontKey(s.frente) === f.frente && s.category === 'parada').map(s => s.id.split('@')[0]));
      return { total: f.totalMin, parada: t.parada || 0, producao: t.producao || 0, manobra: t.manobra || 0, deslocamento: t.deslocamento || 0, naoClassificado: t.outros || 0, disp: f.disp, paradas: ids.size };
    };
    const colhSegs = clippedSegments.filter(s => s.categoria === 'colhedora');
    const tratSegs = clippedSegments.filter(s => s.categoria === 'trator');
    const c = new Map(summarizeFrentes(colhSegs).map(f => [f.frente, toTimes(f, colhSegs)]));
    const t = new Map(summarizeFrentes(tratSegs).map(f => [f.frente, toTimes(f, tratSegs)]));
    return [...new Set([...c.keys(), ...t.keys()])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(frente => ({ frente, colhedora: c.get(frente) ?? null, trator: t.get(frente) ?? null }));
  }, [clippedSegments, summarizeFrentes]);
  const analysisRange = useMemo(() => {
    if (!dayStart || !dayEnd) return { start: 0, end: 0 };
    return isHourMode
      ? { start: dayStart.getTime() + viewStartOff * 3600000, end: dayStart.getTime() + viewEndOff * 3600000 }
      : { start: dayStart.getTime(), end: dayEnd.getTime() };
  }, [dayStart, dayEnd, isHourMode, viewStartOff, viewEndOff]);
  const consolidated = useMemo(() => {
    if (comparisonBase !== 'auto') return null;
    const cs = analysisSegs.filter(s => s.categoria !== 'canavieiro');
    const periodMin = unionMinutes(cs.map(s => [s.clipStart.getTime(), s.clipEnd.getTime()] as [number, number]));
    return {
      stopCounts: stopCountsByFront(cs, ['colhedora', 'trator']),
      windows: maintenanceWindows(cs, analysisRange.start, analysisRange.end),
      rankingColh: maintenanceRanking(cs, 'colhedora', periodMin),
      rankingTrat: maintenanceRanking(cs, 'trator', periodMin),
    };
  }, [comparisonBase, analysisSegs, analysisRange]);
  const selectedSegment = useMemo(
    () => visibleSegments.find(s => s.id === selectedSegmentId) ?? null,
    [visibleSegments, selectedSegmentId],
  );

  useEffect(() => {
    if (selectedSegmentId && !selectedSegment) setSelectedSegmentId(null);
  }, [selectedSegment, selectedSegmentId]);

  useEffect(() => {
    if (!selectedSegmentId) return;
    const clearOutsideSelection = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || selectionAreaRef.current?.contains(target)) return;
      setSelectedSegmentId(null);
    };
    document.addEventListener('pointerdown', clearOutsideSelection);
    return () => document.removeEventListener('pointerdown', clearOutsideSelection);
  }, [selectedSegmentId]);

  // Pareto in chronological order (06→05 operational day)
  const pareto = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const s of daySegments) {
      if (s.category !== 'parada') continue;
      const h = s.clipStart.getHours();
      counts[h] = (counts[h] || 0) + 1;
    }
    // Chronological hours 06..05
    const hoursOrder = Array.from({ length: 24 }, (_, i) => (6 + i) % 24);
    const arr = hoursOrder
      .map(h => ({ hora: `${pad2(h)}:00`, qtd: counts[h] || 0, hourNum: h, acumPct: 0 }))
      .filter(a => a.qtd > 0);
    const tot = arr.reduce((a,b) => a + b.qtd, 0) || 1;
    let acc = 0;
    arr.forEach(a => { acc += a.qtd; a.acumPct = (acc/tot)*100; });
    return arr;
  }, [daySegments]);

  // Principais paradas por operação — respeita TODOS os filtros do cronograma
  const paradasPorOperacao = useMemo(() => {
    const map = new Map<string, { qtd: number; min: number }>();
    for (const s of daySegments) {
      if (s.category !== 'parada') continue;
      const key = (s.operacao || s.estadoOp || 'PARADA').toUpperCase();
      const cur = map.get(key) || { qtd: 0, min: 0 };
      cur.qtd += 1;
      cur.min += (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
      map.set(key, cur);
    }
    const arr = [...map.entries()].map(([operacao, v]) => ({ operacao, qtd: v.qtd, min: Math.round(v.min), horas: Math.round((v.min / 60) * 100) / 100, pct: 0 }));
    const totMin = arr.reduce((a,b) => a + b.min, 0) || 1;
    arr.forEach(a => { a.pct = (a.min / totMin) * 100; });
    arr.sort((a,b) => b.min - a.min);
    return arr;
  }, [daySegments]);

  // Operador predominante por equipamento dentro do turno (só quando UM turno único é aplicado)
  const singleTurnoActive = !isHourMode && filters.turno.length === 1 && filters.turno[0] !== '__none__'
    ? (filters.turno[0] as 'A'|'B'|'C') : null;
  const predominantOperador = useMemo(() => {
    const result = new Map<string, string>();
    if (!singleTurnoActive) return result;
    const byEq = new Map<string, ClippedSegment[]>();
    for (const s of daySegments) {
      const h = s.clipStart.getHours();
      const t = h >= 6 && h < 14 ? 'A' : h >= 14 && h < 22 ? 'B' : 'C';
      if (t !== singleTurnoActive) continue;
      if (!s.operador) continue;
      if (!byEq.has(s.equipamento)) byEq.set(s.equipamento, []);
      byEq.get(s.equipamento)!.push(s);
    }
    for (const [eq, segs] of byEq) {
      const totals = new Map<string, { min: number; firstStart: number }>();
      for (const s of segs) {
        const dur = (s.clipEnd.getTime() - s.clipStart.getTime()) / 60000;
        const cur = totals.get(s.operador) || { min: 0, firstStart: s.clipStart.getTime() };
        cur.min += dur;
        cur.firstStart = Math.min(cur.firstStart, s.clipStart.getTime());
        totals.set(s.operador, cur);
      }
      const arr = [...totals.entries()].sort((a,b) => b[1].min - a[1].min || a[1].firstStart - b[1].firstStart);
      if (arr.length) result.set(eq, arr[0][0]);
    }
    return result;
  }, [daySegments, singleTurnoActive]);

  const shifts = [
    { start: 0, end: 8, bg: 'rgba(59,130,246,0.08)', label: 'A' },
    { start: 8, end: 16, bg: 'rgba(234,179,8,0.10)', label: 'B' },
    { start: 16, end: 24, bg: 'rgba(139,92,246,0.10)', label: 'C' },
  ];
  // Escala completa 06:00 → 06:00 (25 marcas de hora — inclui borda final)
  const hourTicks = Array.from({ length: Math.floor(viewHours) + 1 }, (_, i) => {
    const offsetH = viewStartOff + i;
    const h = Math.floor((6 + offsetH) % 24);
    return { label: `${pad2(h)}:00`, hour: h, offsetH };
  });
  const offsetPct = (d: Date) => {
    if (!dayStart) return 0;
    const h = (d.getTime() - dayStart.getTime()) / 3_600_000;
    return pctOf(h);
  };

  /* ============ QUERY LINE (consulta por horário) ============ */
  const [queryMode, setQueryMode] = useState<'ponto' | 'intervalo'>('ponto');
  const [queryTime, setQueryTime] = useState<string>('');
  const [queryTimeEnd, setQueryTimeEnd] = useState<string>('');
  /** Converte HH:MM em offset (0..24) dentro do dia operacional 06→06. */
  const timeToOffset = (t: string): number | null => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = +m[1], mm = +m[2];
    if (hh > 23 || mm > 59) return null;
    const opH = hh >= 6 ? hh - 6 : hh + 18;
    return opH + mm / 60;
  };
  const queryOffsetPct = useMemo(() => {
    if (!queryTime || !dayStart) return null;
    const off = timeToOffset(queryTime);
    if (off === null) return null;
    return pctOf(off);
  }, [queryTime, dayStart]);
  const queryDate = useMemo(() => {
    if (queryOffsetPct === null || !dayStart) return null;
    return new Date(dayStart.getTime() + (viewStartOff + (queryOffsetPct / 100) * viewHours) * 3600 * 1000);
  }, [queryOffsetPct, dayStart]);
  const queryStopped = useMemo(() => {
    if (!queryDate || queryMode !== 'ponto') return [] as ClippedSegment[];
    return daySegments.filter(s =>
      s.category === 'parada' && s.clipStart <= queryDate && s.clipEnd > queryDate
    );
  }, [queryDate, daySegments, queryMode]);

  /** Consulta por intervalo: qualquer parada que se sobreponha à janela informada. */
  const rangeBounds = useMemo(() => {
    if (queryMode !== 'intervalo' || !dayStart || !queryTime || !queryTimeEnd) return null;
    const a = timeToOffset(queryTime);
    const b = timeToOffset(queryTimeEnd);
    if (a === null || b === null) return null;
    // intervalo que "vira" o dia operacional é tratado até o fim do dia (05:59)
    const end = b > a ? b : 24;
    const startDate = new Date(dayStart.getTime() + a * 3600 * 1000);
    const endDate = new Date(dayStart.getTime() + end * 3600 * 1000);
    return { startDate, endDate, startPct: pctOf(a), endPct: pctOf(end) };
  }, [queryMode, queryTime, queryTimeEnd, dayStart]);

  const rangeStopped = useMemo(() => {
    if (!rangeBounds) return [] as ClippedSegment[];
    const { startDate, endDate } = rangeBounds;
    const out: ClippedSegment[] = [];
    for (const s of daySegments) {
      if (s.category !== 'parada') continue;
      if (s.clipEnd <= startDate || s.clipStart >= endDate) continue;
      out.push(s);
    }
    return out.sort((a, b) => a.clipStart.getTime() - b.clipStart.getTime());
  }, [rangeBounds, daySegments]);



  /* PNG/PDF exports removed — apenas Excel */

  const exportXLSX = () => {
    const data = daySegments.map(s => ({
      Frente: s.frente, Equipamento: s.equipamento, Operador: s.operador,
      Operacao: s.operacao, Estado: s.estado, EstadoOp: s.estadoOp,
      Inicio: `${fmtDateBR(s.start)} ${fmtTime(s.start)}`,
      Fim: `${fmtDateBR(s.end)} ${fmtTime(s.end)}`,
      DuracaoMin: Math.round(s.duracaoMin),
      HorimetroIni: s.horimetroIni, HorimetroFim: s.horimetroFim,
      VelMedia: s.velMedia.toFixed(1),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LinhaDoTempo');
    XLSX.writeFile(wb, `linha-do-tempo-${activeDate}.xlsx`);
  };

  /* ============ RENDER ============ */
  const Info = ({ k, v, light = false }: { k: string; v: React.ReactNode; light?: boolean }) => (
    <div className={`flex justify-between gap-3 ${light ? 'text-foreground' : 'text-white'}`}>
      <span className={light ? 'text-muted-foreground' : 'text-white/80'}>{k}</span>
      <span className={`font-mono text-right truncate ${light ? 'text-foreground' : 'text-white'}`}>{v || '—'}</span>
    </div>
  );

  return (
    <Tabs value={innerTab} onValueChange={(v) => { setInnerTab(v); try { localStorage.setItem('ldt_inner_tab', v); } catch {/* ignore */} }} className="space-y-3">
      <TabsList>
        <TabsTrigger value="cronograma" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> Cronograma</TabsTrigger>
        <TabsTrigger value="grafico" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> Gráfico</TabsTrigger>
        <TabsTrigger value="planilha" className="gap-1 text-xs"><FileSpreadsheet className="h-3 w-3" /> Importar Bases</TabsTrigger>
      </TabsList>

      {/* PLANILHA */}
      <TabsContent value="planilha" className="space-y-3">
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" aria-label="Como obter as bases no SGPA">
                <HelpCircle className="size-4" /> ?
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-2 text-xs">
              <p className="font-bold uppercase">Como obter as bases no SGPA</p>
              <p>Na plataforma SGPA vá em <strong>Ferramentas → Integração</strong>.</p>
              <p>Depois utilize:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Ferramentas/Exportação Monit Colhedoras</li>
                <li>Ferramentas/Exportação Monit Transbordo</li>
                <li>Ferramentas/Exportação Monit Canavieiros</li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <PastePanel
            title="Base de Colhedoras"
            iconEl={<Combine className="h-4 w-4 text-green-600" />}
            accentBar="bg-green-500"
            value={rawColh}
            onChange={handlePasteColh}
            res={resColh}
            onClear={() => handlePasteColh('')}
          />
          <PastePanel
            title="Base de Tratores"
            iconEl={<span className="text-lg leading-none">🚜</span>}
            accentBar="bg-orange-500"
            value={rawTrat}
            onChange={handlePasteTrat}
            res={resTrat}
            onClear={() => handlePasteTrat('')}
          />
          <PastePanel
            title="Base de Canavieiros"
            iconEl={<TruckIcon className="h-4 w-4 text-blue-600" />}
            accentBar="bg-blue-500"
            value={rawCana}
            onChange={handlePasteCana}
            res={resCana}
            onClear={() => handlePasteCana('')}
          />
          {truckProcessing && <p role="status" className="text-xs text-info">Processando a base de caminhões…</p>}
          {truckError && <p role="alert" className="text-xs text-danger">{truckError}</p>}
        </div>
      </TabsContent>

      {/* CRONOGRAMA */}
      <TabsContent value="cronograma" className="space-y-3">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold uppercase text-foreground">Linha do Tempo</h2>
            <p className="text-xs text-muted-foreground">Visão operacional por frota e período</p>
          </div>
          <div role="group" aria-label="Seletor do cronograma" className="grid w-full grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1 sm:w-fit sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
            {availableSelectors.map(sel => (
              <Button
                key={sel}
                type="button"
                size="sm"
                aria-pressed={filters.categoria === sel}
                variant={filters.categoria === sel ? 'default' : 'ghost'}
                className="h-9 gap-2 px-3 text-xs font-bold uppercase"
                onClick={() => { setSelectedSegmentId(null); setFilters(f => ({ ...f, categoria: sel, frente: [], equipamento: [] })); }}
              >
                {sel === 'colhedora' && <HarvesterIcon className="size-4" />}
                {sel === 'trator' && <TractorIcon className="size-4" />}
                {sel === 'canavieiro' && <TruckIcon className="size-4" />}
                {sel === 'combinado' && <Gauge className="size-4" />}
                {BASE_LABEL[sel]}
              </Button>
            ))}
          </div>
        </div>
        {/* Filtros */}
        <Card>
          <CardContent className="py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Data</Label>
                <Select value={filters.data || activeDate} onValueChange={(v) => setFilters(f => ({ ...f, data: v }))}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Data" /></SelectTrigger>
                  <SelectContent>
                    {availableDates.map(d => {
                      const [y,mo,da] = d.split('-');
                      return <SelectItem key={d} value={d}>{`${da}/${mo}/${y}`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <MultiSelect label="Frente"      options={frentes}      value={filters.frente}      onChange={v => setFilters(f => ({ ...f, frente: v }))} />
              <MultiSelect label="Equipamento" options={equipamentos} value={filters.equipamento} onChange={v => setFilters(f => ({ ...f, equipamento: v }))} />
              <MultiSelect label="Operador"    options={operadores}   value={filters.operador}    onChange={v => setFilters(f => ({ ...f, operador: v }))} />
              <MultiSelect label="Operação"    options={operacoes}    value={filters.operacao}    onChange={v => setFilters(f => ({ ...f, operacao: v }))} />
              <MultiSelect label="Estado Op."  options={estadosOp}    value={filters.estadoOp}    onChange={v => setFilters(f => ({ ...f, estadoOp: v }))} />
              {isHourMode ? (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">Horário</Label>
                  <HourRangeFilter start={hourStart} end={hourEnd} onStart={setHourStart} onEnd={setHourEnd} />
                </div>
              ) : (
                <MultiSelect label="Turno"       options={['A','B','C']} value={filters.turno}      onChange={v => setFilters(f => ({ ...f, turno: v }))} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legenda, filtro visual + ações */}
        <Card>
          <CardContent className="py-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Exibir eventos</Label>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant={categoryView === 'todos' ? 'default' : 'outline'} className="h-7 text-[10px]" onClick={() => setCategoryView('todos')}>Todos</Button>
                {(Object.keys(COLORS) as Category[]).map(k => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={categoryView === k ? 'default' : 'outline'}
                    className="h-7 gap-1.5 text-[10px]"
                    onClick={() => setCategoryView(k)}
                  >
                    <span className="size-2.5 rounded-sm" style={{ background: COLORS[k] }} />
                    {CAT_LABEL[k]}
                  </Button>
                ))}
              </div>
            </div>
            {highlightHour !== null && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHighlightHour(null)}>
                Remover destaque {pad2(highlightHour)}:00
              </Button>
            )}
            <div className="flex items-center gap-1 ml-2">
              <Label className="text-[10px] text-muted-foreground">Consultar</Label>
              <Select value={queryMode} onValueChange={(v) => setQueryMode(v as 'ponto' | 'intervalo')}>
                <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ponto">Horário</SelectItem>
                  <SelectItem value="intervalo">Intervalo</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="time"
                value={queryTime}
                onChange={e => setQueryTime(e.target.value)}
                className="h-7 rounded border bg-background px-2 text-xs"
                placeholder="HH:MM"
              />
              {queryMode === 'intervalo' && (
                <>
                  <span className="text-[10px] text-muted-foreground">até</span>
                  <input
                    type="time"
                    value={queryTimeEnd}
                    onChange={e => setQueryTimeEnd(e.target.value)}
                    className="h-7 rounded border bg-background px-2 text-xs"
                    placeholder="HH:MM"
                  />
                </>
              )}
              {(queryTime || queryTimeEnd) && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setQueryTime(''); setQueryTimeEnd(''); }}>×</Button>
              )}
            </div>

            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportXLSX}><Download className="h-3 w-3" /> Excel</Button>
            </div>
          </CardContent>
        </Card>

        {/* Cronograma */}
        {rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Cole a base de Colhedoras, Tratores e/ou Canavieiros na aba <strong>Importar Bases</strong> para gerar o cronograma automaticamente.
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  {isCombined ? 'Efetividade das Frentes' : BASE_LABEL[filters.categoria]} {dayStart && (isHourMode
                    ? `— ${fmtDateBR(dayStart)} ${hourStart} → ${hourEnd}`
                    : `— ${fmtDateBR(dayStart)} 06:00 → ${dayEnd && fmtDateBR(dayEnd)} 05:59`)}
                </CardTitle>
                <span className="text-[10px] uppercase text-muted-foreground">{isCombined ? 'Colhedoras + Tratores consolidados por frente' : 'Clique em um evento para fixar os detalhes'}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {queryMode === 'ponto' && queryTime && queryDate && (
                <div className="mb-2 rounded border bg-muted/40 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">Consulta {queryTime}</span>
                    <span>Equipamentos parados: <strong>{queryStopped.length}</strong></span>
                  </div>
                  {queryStopped.length > 0 && (
                    <div className="mt-1 max-h-32 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                      {queryStopped.map(s => {
                        const acumMin = (queryDate.getTime() - s.clipStart.getTime()) / 60000;
                        return (
                          <div key={s.id} className="rounded bg-background/70 px-2 py-1 border text-[11px]">
                            <div className="font-mono font-bold">{s.equipamento} <span className="text-muted-foreground font-normal">({s.categoria})</span></div>
                            <div className="text-muted-foreground truncate">Frente {s.frente} · {s.operacao || s.estadoOp}</div>
                            <div className="text-muted-foreground">Parado há {fmtDur(acumMin)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {queryMode === 'intervalo' && rangeBounds && (
                <div className="mb-2 rounded border bg-muted/40 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">Consulta {queryTime} → {queryTimeEnd}</span>
                    <span>Paradas no intervalo: <strong>{rangeStopped.length}</strong></span>
                  </div>
                  {rangeStopped.length === 0 ? (
                    <p className="mt-1 text-muted-foreground">Nenhuma parada encontrada nesse intervalo com os filtros atuais.</p>
                  ) : (
                    <div className="mt-1 max-h-64 overflow-auto border rounded bg-background/70">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-card">
                          <tr className="text-left text-muted-foreground border-b">
                            <th className="px-2 py-1">Frota</th>
                            <th className="px-2 py-1">Frente</th>
                            <th className="px-2 py-1">Equipamento</th>
                            <th className="px-2 py-1">Operação</th>
                            <th className="px-2 py-1">Motivo</th>
                            <th className="px-2 py-1">Data</th>
                            <th className="px-2 py-1">Início</th>
                            <th className="px-2 py-1">Fim</th>
                            <th className="px-2 py-1">Tempo</th>
                            <th className="px-2 py-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rangeStopped.map(s => (
                            <tr key={s.id} className="border-b last:border-0">
                              <td className="px-2 py-1 font-mono font-bold">{s.equipamento}</td>
                              <td className="px-2 py-1">{s.frente}</td>
                              <td className="px-2 py-1">{s.categoria}</td>
                              <td className="px-2 py-1 max-w-[180px] truncate">{s.operacao || '—'}</td>
                              <td className="px-2 py-1 max-w-[180px] truncate">{s.estadoOp || s.operacao || '—'}</td>
                              <td className="px-2 py-1 font-mono">{fmtDateBR(s.start)}</td>
                              <td className="px-2 py-1 font-mono">{fmtTime(s.start)}</td>
                              <td className="px-2 py-1 font-mono">{fmtTime(s.end)}</td>
                              <td className="px-2 py-1 font-mono">{fmtDur(s.duracaoMin)}</td>
                              <td className="px-2 py-1">{s.estadoOp || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {isCombined ? (
                <section aria-label="Efetividade das frentes" className="space-y-4 border border-border bg-card/60 p-4">
                  {frontEffectiveness.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sem eventos no período/filtros aplicados.</p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {effBest && (
                          <div className="flex items-center gap-3 border-l-2 border-success pl-3">
                            <TrendingUp className="size-5 text-success" />
                            <div><div className="text-[10px] font-semibold uppercase text-muted-foreground">Maior efetividade</div>
                              <div className="font-mono text-lg font-bold">F{effBest.frente} — {effBest.pct.toFixed(1).replace('.', ',')}%</div></div>
                          </div>
                        )}
                        {effWorst && (
                          <div className="flex items-center gap-3 border-l-2 border-danger pl-3">
                            <TrendingDown className="size-5 text-danger" />
                            <div><div className="text-[10px] font-semibold uppercase text-muted-foreground">Menor efetividade</div>
                              <div className="font-mono text-lg font-bold">F{effWorst.frente} — {effWorst.pct.toFixed(1).replace('.', ',')}%</div></div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {frontEffectiveness.map(f => (
                          <div key={f.frente} className="grid grid-cols-[88px_1fr_64px] items-center gap-3">
                            <span className="text-xs font-bold uppercase text-primary">Frente {f.frente}</span>
                            <div className="h-6 w-full overflow-hidden border border-border bg-muted/50" title={`Efetivo ${fmtDur(f.uptime)} de ${fmtDur(f.totalMin)}`}>
                              <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, f.pct))}%`, background: f === effWorst && frontEffectiveness.length > 1 ? 'var(--ldt-stop)' : 'var(--ldt-production)' }} />
                            </div>
                            <span className="text-right font-mono text-sm font-bold">{f.pct.toFixed(1).replace('.', ',')}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Efetividade = tempo efetivo (produção + deslocamento + manobra) ÷ tempo total, com os filtros ativos.</p>
                      <FrontTimesComparison data={frontBreakdown} />
                    </>
                  )}
                </section>
              ) : (
              <div ref={selectionAreaRef} className="space-y-3">
                <div
                  ref={timelineRef}
                  className="ldt-timeline border rounded-none gantt-surface"
                  onClick={() => setSelectedSegmentId(null)}
                >
                <div className="w-full min-w-0">
                  {/* Header turnos */}
                  <div className="flex bg-card border-b">
                    <div className="ldt-fleet shrink-0" />
                    <div className="min-w-0 flex-1 relative h-6">
                      {!isHourMode && shifts.map((sh, i) => (
                        <div key={i} className="absolute top-0 bottom-0 flex items-center justify-center text-[9px] font-semibold"
                          style={{ left: `${pctOf(sh.start)}%`, width: `${((sh.end-sh.start)/viewHours)*100}%`, background: sh.bg }}>
                          Turno {sh.label}
                        </div>
                      ))}
                      {isHourMode && (
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                          Período {hourStart} → {hourEnd} ({Math.round(viewHours)}h)
                        </div>
                      )}
                    </div>
                    <div className="grid ldt-totals shrink-0 grid-cols-2" />
                  </div>
                  {/* Header horas */}
                  <div className="flex bg-card border-b" >
                    <div className="ldt-fleet shrink-0 px-1 sm:px-2 text-[10px] font-semibold flex items-center uppercase">Frota</div>
                    <div className="min-w-0 flex-1 relative h-5">
                      {hourTicks.map((t,i) => {
                        const isEnd = t.offsetH >= viewEndOff;
                        const showLabel = !isEnd;
                        return (
                          <div key={i} className="absolute top-0 bottom-0 border-l border-border/60 text-[9px] text-muted-foreground"
                            style={{ left: `${pctOf(t.offsetH)}%` }}>
                            {showLabel && <span className={`ldt-hour pl-0.5 ${i % 6 === 0 ? 'ldt-hour-major' : i % 3 === 0 ? 'ldt-hour-mid' : ''}`}>{t.label.slice(0, 2)}</span>}
                          </div>
                        );
                      })}
                      <div className="absolute top-0 bottom-0 right-0 text-[9px] text-muted-foreground pr-1">
                        {isHourMode ? hourEnd : '05:59'}
                      </div>
                    </div>
                    <div className="grid ldt-totals shrink-0 grid-cols-2 border-l border-border/70 text-center text-[10px] font-semibold uppercase">
                      <span className="flex items-center justify-center">Parada</span>
                      <span className="flex items-center justify-center border-l border-border/70">Efetivo</span>
                    </div>
                  </div>

                  {[...grouped.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([frente, eqs]) => (
                    <div key={frente}>
                      <div className="flex bg-primary/10 border-b py-1" >
                        <div className="ldt-fleet shrink-0 px-1 sm:px-2 text-xs font-bold text-primary">
                          FRENTE {frente}
                        </div>
                        <div className="flex-1" />
                        <div className="ldt-totals shrink-0" />
                      </div>
                      {[...eqs.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([eq, segs]) => {
                        const sm = summary(segs);
                        const operador = singleTurnoActive ? (predominantOperador.get(eq) || '') : '';
                        return (
                          <div key={eq} className="flex min-h-11 border-b hover:bg-muted/30">
                            <div className="ldt-fleet shrink-0 px-1 sm:px-2 py-1.5 flex items-center gap-2">
                              {filters.categoria === 'colhedora'
                                ? <HarvesterIcon className="hidden sm:block size-4 shrink-0 text-primary" />
                                : filters.categoria === 'canavieiro'
                                  ? <TruckIcon className="hidden sm:block size-4 shrink-0 text-primary" />
                                  : <TractorIcon className="hidden sm:block size-4 shrink-0 text-accent" />}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-mono font-bold truncate">{eq}</div>
                                {singleTurnoActive && operador && (
                                  <div className="text-[9px] text-muted-foreground truncate">{operador}</div>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 relative h-11">
                              {!isHourMode && shifts.map((sh, i) => (
                                <div key={i} className="absolute top-0 bottom-0"
                                  style={{ left: `${pctOf(sh.start)}%`, width: `${((sh.end-sh.start)/viewHours)*100}%`, background: sh.bg }} />
                              ))}
                              {hourTicks.map((t,i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-l border-border/40"
                                  style={{ left: `${pctOf(t.offsetH)}%` }} />
                              ))}
                              {highlightHour !== null && dayStart && (() => {
                                const opH = highlightHour >= 6 ? highlightHour - 6 : highlightHour + 18;
                                return (
                                  <div className="absolute top-0 bottom-0 bg-primary/25 border-x-2 border-primary z-10"
                                    style={{ left: `${pctOf(opH)}%`, width: `${(1/viewHours)*100}%` }} />
                                );
                              })()}
                              {queryMode === 'ponto' && queryOffsetPct !== null && (
                                <div className="absolute top-0 bottom-0 z-30 pointer-events-none"
                                  style={{ left: `${queryOffsetPct}%`, width: '1px', background: '#ef4444', boxShadow: '0 0 0 0.5px #ef4444' }} />
                              )}
                              {queryMode === 'intervalo' && rangeBounds && (
                                <div className="absolute top-0 bottom-0 z-30 pointer-events-none bg-red-500/10 border-x border-red-500"
                                  style={{ left: `${rangeBounds.startPct}%`, width: `${rangeBounds.endPct - rangeBounds.startPct}%` }} />
                              )}

                              {segs.map(s => {
                                const l = offsetPct(s.clipStart);
                                const w = offsetPct(s.clipEnd) - l;
                                if (w <= 0 || l >= 100 || l + w <= 0) return null;
                                const left = Math.max(0, l);
                                const width = Math.min(100 - left, w - (left - l));
                                const selected = selectedSegmentId === s.id;
                                return (
                                  <HoverCard key={s.id} openDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${CAT_LABEL[s.category]} da frota ${s.equipamento}, ${fmtTime(s.start)} até ${fmtTime(s.end)}`}
                                        aria-pressed={selected}
                                        className={`gantt-bar absolute top-1.5 bottom-1.5 rounded-none cursor-pointer border shadow-sm transition-all hover:z-20 hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'z-30 border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'border-foreground/20'}`}
                                        style={{ left: `${left}%`, width: `max(2px, ${width}%)`, background: COLORS[s.category] }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedSegmentId(s.id);
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setSelectedSegmentId(s.id);
                                          }
                                        }}
                                      />
                                    </HoverCardTrigger>
                                    <HoverCardContent className="gantt-info w-80 text-xs space-y-1 text-white">
                                      <div className="font-semibold pb-1 text-white">{CAT_LABEL[s.category]}</div>
                                      <Info k="Frente" v={s.frente} />
                                      <Info k="Equipamento" v={s.equipamento} />
                                      <Info k="Operador" v={s.operador} />
                                      <Info k="Operação" v={s.operacao} />
                                      <Info k="Estado" v={s.estado} />
                                      <Info k="Estado Operacional" v={s.estadoOp} />
                                      <div className="border-t my-1" />
                                      <Info k="Início" v={`${fmtDateBR(s.start)} ${fmtTime(s.start)}`} />
                                      <Info k="Fim" v={`${fmtDateBR(s.end)} ${fmtTime(s.end)}`} />
                                      <Info k="Duração" v={fmtDur(s.duracaoMin)} />
                                      <div className="border-t my-1" />
                                      <Info k="Horímetro Inicial" v={s.horimetroIni.toFixed(1)} />
                                      <Info k="Horímetro Final" v={s.horimetroFim.toFixed(1)} />
                                      <Info k="Velocidade Média" v={`${s.velMedia.toFixed(1)} km/h`} />
                                      {s.category === 'parada' && onAddToHistory && showAddToHistory && (
                                        <Button type="button" size="sm" className="mt-2 w-full gap-2"
                                          disabled={addedEventIds.has(s.id.split('@')[0])}
                                          onClick={event => { event.stopPropagation(); handleAddToHistory(s); }}>
                                          {addedEventIds.has(s.id.split('@')[0]) ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}
                                          {addedEventIds.has(s.id.split('@')[0]) ? 'ADICIONADO' : 'ADD AO HISTÓRICO'}
                                        </Button>
                                      )}
                                    </HoverCardContent>
                                  </HoverCard>
                                );
                              })}
                            </div>
                            <div className="grid ldt-totals shrink-0 grid-cols-2 border-l border-border/70 text-xs font-mono">
                              <span className="flex items-center justify-center font-bold text-danger">{fmtDur(sm.totals.parada)}</span>
                              <span className="flex items-center justify-center border-l border-border/70 font-bold text-success">{fmtDur(sm.uptime)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  </div>
                </div>

                {selectedSegment && (
                  <section
                    className="border border-primary/45 bg-card/85 shadow-lg"
                    aria-label="Detalhes do evento selecionado"
                    onClick={event => event.stopPropagation()}
                  >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-3 shrink-0 rounded-sm" style={{ background: COLORS[selectedSegment.category] }} />
                      <div>
                        <h3 className="text-sm font-bold uppercase text-foreground">{CAT_LABEL[selectedSegment.category]} — Frota {selectedSegment.equipamento}</h3>
                        <p className="text-[11px] text-muted-foreground">{fmtDateBR(selectedSegment.start)} · {fmtTime(selectedSegment.start)}–{fmtTime(selectedSegment.end)}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Fechar detalhes" onClick={() => setSelectedSegmentId(null)}>
                      <X className="size-4" />
                    </Button>
                  </header>
                  <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1 text-xs">
                      <Info light k="Frota" v={selectedSegment.equipamento} />
                      <Info light k="Equipamento" v={selectedSegment.categoria === 'colhedora' ? 'Colhedora' : selectedSegment.categoria === 'canavieiro' ? 'Canavieiro' : 'Trator'} />
                      <Info light k="Frente" v={selectedSegment.frente} />
                      <Info light k="Operador" v={selectedSegment.operador} />
                    </div>
                    <div className="space-y-1 text-xs">
                      <Info light k="Operação" v={selectedSegment.operacao} />
                      <Info light k="Status / Motivo" v={selectedSegment.estadoOp || selectedSegment.estado} />
                      <Info light k="Início" v={`${fmtDateBR(selectedSegment.start)} ${fmtTime(selectedSegment.start)}`} />
                      <Info light k="Fim" v={`${fmtDateBR(selectedSegment.end)} ${fmtTime(selectedSegment.end)}`} />
                      <Info light k="Duração" v={fmtDur(selectedSegment.duracaoMin)} />
                    </div>
                    <div className="flex min-w-52 flex-col justify-between gap-3 border-l border-border pl-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock3 className="size-4" />
                        <span>Evento selecionado</span>
                      </div>
                      {selectedSegment.category === 'parada' && onAddToHistory && showAddToHistory && (() => {
                        const added = addedEventIds.has(selectedSegment.id.split('@')[0]);
                        return (
                          <Button
                            type="button"
                            size="sm"
                            variant={added ? 'secondary' : 'default'}
                            className="gap-2 font-bold"
                            disabled={added}
                            onClick={() => handleAddToHistory(selectedSegment)}
                          >
                            {added ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}
                            {added ? 'ADICIONADO' : 'ADD AO HISTÓRICO'}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                  </section>
                )}
              </div>
              )}

              <section className="border border-border bg-muted/25 px-4 py-4">
                <div className="mb-3 text-xs font-bold uppercase text-foreground">Totais do período</div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                  {([
                    ['Produção', periodSummary.totals.producao, 'border-success'],
                    ['Paradas', periodSummary.totals.parada, 'border-danger'],
                    ['Tempo efetivo', periodSummary.uptime, 'border-success'],
                    ['Manobra', periodSummary.totals.manobra, 'border-accent'],
                    ['Deslocamento', periodSummary.totals.deslocamento, 'border-warning'],
                  ] as const).map(([label, minutes, accent]) => (
                    <div key={label} className={`border-l-2 pl-3 ${accent}`}>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
                      <div className="font-mono text-lg font-bold text-foreground">{fmtDur(minutes)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-border pt-3">
                  <h3 className="mb-2 text-[11px] font-bold uppercase">Totais por frente</h3>
                  <div className="grid gap-x-6 gap-y-3 xl:grid-cols-2">
                    {frontSummaries.map(front => (
                      <div key={front.frente} className="border-b border-border/60 pb-3">
                        <div className="mb-2 text-xs font-bold text-primary">FRENTE {front.frente}</div>
                        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]">
                          {(['producao', 'parada', 'manobra', 'deslocamento'] as const).map(key => (
                            <div key={key}>
                              <dt className="text-muted-foreground">{key === 'producao' ? 'Produção' : key === 'parada' ? 'Paradas' : CAT_LABEL[key]}</dt>
                              <dd className="font-mono text-xs font-bold">{fmtDur(front.totals[key])}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* GRÁFICO */}
      <TabsContent value="grafico" className="space-y-3">
        <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="group" aria-label="Análise dos gráficos">
          <Button size="sm" variant={graphicsMode === 'timeline' ? 'default' : 'outline'} aria-pressed={graphicsMode === 'timeline'} onClick={() => setGraphicsMode('timeline')}><BarChart3 className="mr-2 size-4" />Frentes e equipamentos</Button>
          <Button size="sm" variant={graphicsMode === 'trucks' ? 'default' : 'outline'} aria-pressed={graphicsMode === 'trucks'} onClick={() => setGraphicsMode('trucks')}><TruckIcon className="mr-2 size-4" />Caminhões — Logística</Button>
        </div>
        {graphicsMode === 'trucks' ? <TruckLogisticsDashboard key={rawCana} imported={truckImport} processing={truckProcessing} error={truckError || (resCana?.rows.length && !truckImport ? 'Base de canavieiros carregada no formato anterior. Para os indicadores logísticos, use a exportação com os campos Estado, Estado Operacional e Grupo Operacao.' : undefined)} /> : rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Importe as bases para visualizar os gráficos.
          </CardContent></Card>
        ) : (
          <>
            <section className="border-b border-border pb-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Produção e paradas por frente</h3>
                  <p className="text-xs text-muted-foreground">{comparisonBase === 'auto'
                    ? (resColh?.rows.length && resTrat?.rows.length ? 'Colhedoras + Tratores' : resColh?.rows.length ? 'Colhedoras' : 'Tratores')
                    : comparisonBase === 'colhedora' ? 'Colhedoras' : 'Tratores'} · {activeDate} · Tempo em horas</p>
                </div>
                <Select value={comparisonBase} onValueChange={value => setComparisonBase(value as 'auto' | 'colhedora' | 'trator')}>
                  <SelectTrigger className="w-56" aria-label="Base da comparação"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Bases carregadas (somadas)</SelectItem>
                    <SelectItem value="colhedora">Somente colhedoras</SelectItem>
                    <SelectItem value="trator">Somente tratores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frontComparison.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos no período/filtros aplicados.</p> : (
                <div className="h-80 w-full min-w-0" aria-label="Gráfico de linhas de produção e paradas por frente">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={frontComparison} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="var(--ldt-chart-grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="frente" tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                      <YAxis unit="h" width={48} tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                      <RTooltip contentStyle={{ background: 'var(--ldt-chart-surface)', borderColor: 'var(--ldt-chart-grid)', color: 'var(--ldt-chart-text)' }} formatter={(value: number) => fmtDur(Number(value) * 60)} />
                      <Legend />
                      <Line type="linear" dataKey="producao" name="Produção" stroke="var(--ldt-production)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      {splitStopLines ? (
                        <>
                          <Line type="linear" dataKey="paradaColhedoras" name="Paradas — Colhedoras" stroke="var(--ldt-stop-harvester)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                          <Line type="linear" dataKey="paradaTratores" name="Paradas — Tratores" stroke="var(--ldt-stop-tractor)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                        </>
                      ) : (
                        <Line type="linear" dataKey="parada" name="Paradas" stroke="var(--ldt-stop)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            {consolidated && (
              <ConsolidatedAnalysis
                missing={[!resColh?.rows.length && 'Colhedoras', !resTrat?.rows.length && 'Tratores / Transbordo'].filter((v): v is string => !!v)}
                summary={frontBreakdown}
                stopCounts={consolidated.stopCounts}
                windows={consolidated.windows}
                rangeStart={analysisRange.start}
                rangeEnd={analysisRange.end}
                rankingColh={consolidated.rankingColh}
                rankingTrat={consolidated.rankingTrat}
                periodLabel={`${activeDate}${isHourMode ? ` · ${hourStart}–${hourEnd}` : ''}`}
              />
            )}
            {isCombined && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Efetividade das Frentes — Colhedoras + Tratores</CardTitle></CardHeader>
                <CardContent>
                  {frontEffectiveness.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos no período/filtros aplicados.</p> : (
                    <>
                      <div className="mb-3 flex flex-wrap gap-6 text-xs">
                        {effBest && <span>Maior efetividade: <strong className="text-success">F{effBest.frente} — {effBest.pct.toFixed(1).replace('.', ',')}%</strong></span>}
                        {effWorst && <span>Menor efetividade: <strong className="text-danger">F{effWorst.frente} — {effWorst.pct.toFixed(1).replace('.', ',')}%</strong></span>}
                      </div>
                      <div style={{ height: Math.max(220, frontEffectiveness.length * 44) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={frontEffectiveness} layout="vertical" margin={{ left: 10, right: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--ldt-chart-grid)" />
                            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                            <YAxis type="category" dataKey="label" width={60} tick={{ fill: 'var(--ldt-chart-text)', fontSize: 11 }} />
                            <RTooltip formatter={(v: number) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: 'var(--ldt-chart-surface)', borderColor: 'var(--ldt-chart-grid)', color: 'var(--ldt-chart-text)' }} />
                            <Bar dataKey="pct" name="Efetividade" barSize={18} isAnimationActive={false}>
                              {frontEffectiveness.map(f => <Cell key={f.frente} fill={f === effWorst && frontEffectiveness.length > 1 ? 'var(--ldt-stop)' : 'var(--ldt-production)'} />)}
                              <LabelList dataKey="pct" content={<BarEndLabel format={(v: number) => `${v.toFixed(1).replace('.', ',')}%`} />} />
                            </Bar>
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            {filters.categoria === 'trator' && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Comparativo operacional dos tratores por frente</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  {tractorComparison.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sem eventos no período/filtros aplicados.</p> : (() => {
                    const maxManut = Math.max(...tractorComparison.map(t => t.manut));
                    return (
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-left text-muted-foreground">
                          <th className="px-2 py-1">Frente</th><th className="px-2 py-1 text-right">Tratores</th><th className="px-2 py-1 text-right">Manutenção</th>
                          <th className="px-2 py-1 text-right">Produção</th><th className="px-2 py-1 text-right">Deslocamento</th><th className="px-2 py-1 text-right">Esperando colhedora</th>
                        </tr></thead>
                        <tbody>
                          {tractorComparison.map(t => (
                            <tr key={t.frente} className="border-b last:border-0">
                              <td className="px-2 py-1 font-bold text-primary">FRENTE {t.frente}</td>
                              <td className="px-2 py-1 text-right font-mono">{t.tratores}</td>
                              <td className={`px-2 py-1 text-right font-mono ${maxManut > 0 && t.manut === maxManut ? 'font-bold text-danger' : ''}`}>{fmtDur(t.manut)}</td>
                              <td className="px-2 py-1 text-right font-mono">{fmtDur(t.prod)}</td>
                              <td className="px-2 py-1 text-right font-mono">{fmtDur(t.desl)}</td>
                              <td className="px-2 py-1 text-right font-mono">{fmtDur(t.espera)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            {filters.categoria === 'canavieiro' && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Paradas por frota — Canavieiros ({periodSummary.paradas} paradas · {fmtDur(periodSummary.totals.parada)})</CardTitle></CardHeader>
                <CardContent>
                  {paradasPorFrota.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem paradas no período/filtros aplicados.</p> : (
                    <div style={{ height: Math.max(240, paradasPorFrota.length * 30) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={paradasPorFrota} layout="vertical" margin={{ left: 10, right: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v: any) => `${v}h`} />
                          <YAxis type="category" dataKey="frota" width={70} tick={{ fontSize: 11 }} />
                          <RTooltip formatter={(v: any, n: string) => n === 'Tempo (h)' ? fmtDur(Number(v) * 60) : v} />
                          <Legend />
                          <Bar dataKey="horas" name="Tempo (h)" fill="#dc2626" barSize={9} />
                          <Bar dataKey="qtd" name="Ocorrências" fill="#0ea5e9" barSize={9} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {!isCombined && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">DEFT de manutenção por horário (min)</CardTitle></CardHeader>
                <CardContent>
                  {deftManutencao.every(d => d.min === 0) ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma parada de manutenção no período filtrado.</p> : (
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={deftManutencao}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                          <YAxis unit="min" width={52} />
                          <RTooltip formatter={(v: any) => fmtDur(Number(v))} />
                          <Bar dataKey="min" name="Manutenção" fill="#2563eb" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {!isCombined && <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Pareto de Paradas por Hora (06:00 → 05:59)</CardTitle>
              </CardHeader>
              <CardContent>
                {pareto.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parada registrada no período filtrado.</p>
                ) : (
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={pareto}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hora" />
                        <YAxis yAxisId="l" />
                        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" />
                        <RTooltip />
                        <Legend />
                        <Bar yAxisId="l" dataKey="qtd" name="Qtd. Paradas" cursor="pointer"
                          onClick={(d: any) => setHighlightHour(d.hourNum)}>
                          {pareto.map((p, i) => (
                            <Cell key={i} fill={highlightHour === p.hourNum ? '#7c3aed' : '#dc2626'} />
                          ))}
                        </Bar>
                        <Line yAxisId="r" dataKey="acumPct" name="% Acumulado" stroke="#0ea5e9" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>}

            {!isCombined && <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  Principais Paradas — {BASE_LABEL[filters.categoria]}
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                    (sincronizado com filtros do cronograma)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paradasPorOperacao.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem paradas no período/filtros aplicados.</p>
                ) : (
                  <div style={{ height: Math.max(300, paradasPorOperacao.length * 34) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={paradasPorOperacao} layout="vertical" margin={{ left: 40, right: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v: any) => `${v}h`} />
                        <YAxis type="category" dataKey="operacao" width={180} tick={{ fontSize: 11 }} />
                        <RTooltip formatter={(v: any, n: string) => {
                          if (n === 'Tempo (h)') return [`${Number(v).toFixed(2)} h (${fmtDur(Number(v) * 60)})`, n];
                          if (n === '% do tempo') return [`${Number(v).toFixed(1)}%`, n];
                          return [v, n];
                        }} />
                        <Legend />
                        <Bar dataKey="horas" name="Tempo (h)" fill="#dc2626" barSize={9}>
                          <LabelList dataKey="horas" content={<BarEndLabel format={(v: number) => fmtDur(v * 60)} />} />
                        </Bar>
                        <Bar dataKey="qtd" name="Ocorrências" fill="#0ea5e9" barSize={9}>
                          <LabelList dataKey="qtd" content={<BarEndLabel format={(v: number) => String(v)} />} />
                        </Bar>
                        <Bar dataKey="pct" name="% do tempo" fill="#a855f7" barSize={9}>
                          <LabelList dataKey="pct" content={<BarEndLabel format={(v: number) => `${v.toFixed(1).replace('.', ',')}%`} />} />
                        </Bar>

                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>}
          </>
        )}
      </TabsContent>

    </Tabs>
  );
}

export default LinhaDoTempo;
