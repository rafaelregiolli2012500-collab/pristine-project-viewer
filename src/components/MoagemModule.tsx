/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useUnit } from '@/hooks/useUnit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Factory, Plus, Pencil, Trash2, Check, X, Eraser } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSystemTime } from '@/hooks/useSystemTime';
import { getOperationalDayKey } from '@/lib/operationalDay';

const STORAGE_KEY = 'moagem_data';
const MOAGEM_RECORDS_KEY = 'moagem_records';
const MOAGEM_BY_DAY_KEY = 'moagem_by_day';

interface HourEntry {
  horario: string;
  moagem: number;
  cargas: number;
  justificativa: string;
}

interface TurnoData {
  entries: HourEntry[];
}

interface MoagemState {
  turnos: { A: TurnoData; B: TurnoData; C: TurnoData };
  data: string;
  raioMedio: string;
}

interface MoagemRecord {
  id: string;
  horario: string; // HH:MM format
  moagem: number;
}

const TURNO_HOURS: Record<string, string[]> = {
  A: ['06','07','08','09','10','11','12','13'],
  B: ['14','15','16','17','18','19','20','21'],
  C: ['22','23','00','01','02','03','04','05'],
};

const ALL_HOURS_ORDER = ['06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','00','01','02','03','04','05'];

const TURNO_LABELS: Record<string, string> = {
  A: 'Turno A',
  B: 'Turno B',
  C: 'Turno C',
};

// Convert HH:MM to a sortable numeric value (minutes from 06:00, wrapping at midnight)
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = isNaN(h) ? 0 : h;
  const min = isNaN(m) ? 0 : m;
  // Shift so 06:00 = 0, 05:59 = 1439
  const shifted = hour >= 6 ? (hour - 6) * 60 + min : (hour + 18) * 60 + min;
  return shifted;
}

function sortRecordsByTime(records: MoagemRecord[]): MoagemRecord[] {
  return [...records].sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
}

function createTurnoData(turno: string): TurnoData {
  return {
    entries: (TURNO_HOURS[turno] || []).map(h => ({ horario: h, moagem: 0, cargas: 0, justificativa: '' })),
  };
}

function loadMoagem(): MoagemState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const t of ['A', 'B', 'C'] as const) {
        const hours = TURNO_HOURS[t];
        if (!parsed.turnos?.[t]?.entries || parsed.turnos[t].entries.length !== hours.length) {
          parsed.turnos[t] = createTurnoData(t);
        } else {
          parsed.turnos[t].entries = parsed.turnos[t].entries.map((e: any, i: number) => ({
            horario: hours[i],
            moagem: e.moagem ?? e.tc ?? 0,
            cargas: e.cargas ?? 0,
            justificativa: e.justificativa ?? '',
          }));
        }
      }
      if (!parsed.raioMedio) parsed.raioMedio = '';
      return parsed;
    }
  } catch { /* nada */ }
  return {
    turnos: { A: createTurnoData('A'), B: createTurnoData('B'), C: createTurnoData('C') },
    data: new Date().toISOString().slice(0, 10),
    raioMedio: '',
  };
}

function loadRecords(): MoagemRecord[] {
  try {
    const raw = localStorage.getItem(MOAGEM_RECORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Gravação com fila: o valor mais recente é sempre gravado, mas nunca uma
// vez por tecla digitada. Ao sair da página/aba a gravação é imediata.
function useDebouncedSave<T>(key: string, value: T, delay = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const valueRef = useRef(value);
  valueRef.current = value;

  const flush = useCallback(() => {
    try { localStorage.setItem(key, JSON.stringify(valueRef.current)); } catch {}
  }, [key]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay, flush]);

  // Segurança: grava imediatamente ao fechar, atualizar ou trocar de aba.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);
}


type Turno = 'A' | 'B' | 'C';

// Build chart data with minute-level precision and carry-forward
function buildChartData(records: MoagemRecord[]) {
  const sorted = sortRecordsByTime(records);
  
  if (sorted.length === 0) {
    // Return hourly empty points
    return ALL_HOURS_ORDER.map(h => ({ hora: `${h}:00`, moagem: 0, sortKey: timeToMinutes(`${h}:00`) }));
  }

  // Create data points: hour markers + record points
  const pointMap = new Map<string, number>();
  
  // Add all record points
  sorted.forEach(r => {
    const key = r.horario.includes(':') ? r.horario : `${r.horario}:00`;
    pointMap.set(key, r.moagem);
  });

  // Add hour markers for X axis readability
  ALL_HOURS_ORDER.forEach(h => {
    const key = `${h}:00`;
    if (!pointMap.has(key)) {
      pointMap.set(key, -1); // -1 = inherit
    }
  });

  // Sort all points
  const allPoints = Array.from(pointMap.entries())
    .map(([hora, moagem]) => ({ hora, moagem, sortKey: timeToMinutes(hora) }))
    .sort((a, b) => a.sortKey - b.sortKey);

  // Apply carry-forward
  let lastValue = 0;
  return allPoints.map(p => {
    if (p.moagem >= 0) {
      lastValue = p.moagem;
    }
    return { ...p, moagem: lastValue };
  });
}

// Validate HH:MM format
function isValidTime(time: string): boolean {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function loadByDay(): Record<string, { state: MoagemState; records: MoagemRecord[] }> {
  try {
    const raw = localStorage.getItem(MOAGEM_BY_DAY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveByDay(key: string, snapshot: { state: MoagemState; records: MoagemRecord[] }) {
  try {
    const all = loadByDay();
    all[key] = snapshot;
    localStorage.setItem(MOAGEM_BY_DAY_KEY, JSON.stringify(all));
  } catch {}
}

export function MoagemModule() {
  const { isHourMode } = useUnit();
  const { isLocked, lockedDate, getNow } = useSystemTime();
  const activeDayKey = isLocked && lockedDate ? lockedDate : getOperationalDayKey(getNow());

  // Load initial state considering active day
  const initialLoad = () => {
    const byDay = loadByDay();
    if (byDay[activeDayKey]) return byDay[activeDayKey];
    // Fallback to legacy live keys (current day)
    return { state: loadMoagem(), records: loadRecords() };
  };
  const initial = initialLoad();
  const [state, setState] = useState<MoagemState>(initial.state);
  const [records, setRecords] = useState<MoagemRecord[]>(initial.records);
  const [newHorario, setNewHorario] = useState('');
  const [newMoagem, setNewMoagem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMoagem, setEditMoagem] = useState('');
  const [dateEdited, setDateEdited] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const currentDayRef = useRef<string>(activeDayKey);

  // Swap data when active day (lock) changes
  useEffect(() => {
    if (currentDayRef.current === activeDayKey) return;
    // Save current buffer to previous day
    saveByDay(currentDayRef.current, { state, records });
    // Load new day
    const byDay = loadByDay();
    const snap = byDay[activeDayKey];
    if (snap) {
      setState(snap.state);
      setRecords(snap.records);
    } else {
      // Empty template
      setState({
        turnos: { A: createTurnoData('A'), B: createTurnoData('B'), C: createTurnoData('C') },
        data: activeDayKey,
        raioMedio: '',
      });
      setRecords([]);
    }
    currentDayRef.current = activeDayKey;
  }, [activeDayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Atualiza data automaticamente em tempo real (a menos que usuário edite)
  useEffect(() => {
    if (isLocked) return; // in lock mode, keep the historical date
    const tick = () => {
      if (dateEdited) return;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setState(prev => prev.data === today ? prev : { ...prev, data: today });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [dateEdited, isLocked]);

  useDebouncedSave(STORAGE_KEY, state);
  useDebouncedSave(MOAGEM_RECORDS_KEY, records);

  // Snapshot do dia: gravado em fila (nunca a cada tecla) e sempre com o
  // valor mais recente, inclusive ao sair da tela.
  const snapshotRef = useRef({ state, records, activeDayKey });
  snapshotRef.current = { state, records, activeDayKey };
  useEffect(() => {
    const flush = () => {
      const s = snapshotRef.current;
      saveByDay(s.activeDayKey, { state: s.state, records: s.records });
    };
    const id = setTimeout(flush, 400);
    window.addEventListener('beforeunload', flush);
    return () => {
      clearTimeout(id);
      window.removeEventListener('beforeunload', flush);
    };
  }, [state, records, activeDayKey]);

  // Ao sair da aba Moagem, garante a gravação do que ainda estava na fila.
  useEffect(() => () => {
    const s = snapshotRef.current;
    saveByDay(s.activeDayKey, { state: s.state, records: s.records });
  }, []);




  const updateEntry = useCallback((turno: Turno, index: number, field: keyof HourEntry, value: string | number) => {
    setState(prev => {
      const entries = [...prev.turnos[turno].entries];
      entries[index] = { ...entries[index], [field]: value };
      return { ...prev, turnos: { ...prev.turnos, [turno]: { ...prev.turnos[turno], entries } } };
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.moagem-input'));
    const idx = inputs.indexOf(e.currentTarget);
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) inputs[idx - 1].focus();
    } else if (e.key === 'Escape') {
      (e.currentTarget as HTMLInputElement).blur();
    }
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // Normalize horario input: add :00 if only hours given
  const normalizeHorario = (h: string): string => {
    const trimmed = h.trim();
    if (/^\d{1,2}$/.test(trimmed)) return trimmed.padStart(2, '0') + ':00';
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed.padStart(5, '0');
    return trimmed;
  };

  const addRecord = () => {
    const horario = normalizeHorario(newHorario);
    if (!isValidTime(horario) || !newMoagem) return;
    const filtered = records.filter(r => r.horario !== horario);
    const newRecord: MoagemRecord = {
      id: Date.now().toString(),
      horario,
      moagem: Number(newMoagem),
    };
    setRecords([...filtered, newRecord]);
    setNewHorario('');
    setNewMoagem('');
  };

  const deleteRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const startEdit = (record: MoagemRecord) => {
    setEditingId(record.id);
    setEditMoagem(String(record.moagem));
  };

  const confirmEdit = (id: string) => {
    setRecords(records.map(r => r.id === id ? { ...r, moagem: Number(editMoagem) } : r));
    setEditingId(null);
    setEditMoagem('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMoagem('');
  };

  // Limpa apenas as cargas do pátio (zera coluna "cargas" em todos os turnos/horas).
  // Não toca em justificativas, registros de moagem, raio nem data.
  const clearPatioLoads = useCallback(() => {
    setState(prev => {
      const turnos = { ...prev.turnos };
      (['A', 'B', 'C'] as Turno[]).forEach(t => {
        turnos[t] = {
          ...turnos[t],
          entries: turnos[t].entries.map(e => ({ ...e, cargas: 0 })),
        };
      });
      return { ...prev, turnos };
    });
  }, []);

  const sortedRecords = sortRecordsByTime(records);
  const chartData = buildChartData(records);
  const filledValues = chartData.filter(d => d.moagem > 0);
  const avgMoagem = filledValues.length > 0 ? filledValues.reduce((s, d) => s + d.moagem, 0) / filledValues.length : 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da aba MOAGEM com botão Limpar Cargas */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
          <Factory className="h-5 w-5 text-primary" /> MOAGEM
        </h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Eraser className="h-3.5 w-3.5" /> Limpar Cargas do Pátio
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deseja realmente limpar todas as cargas do pátio?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação zera apenas a coluna <strong>CARGAS</strong> do cenário pátio em todos os horários e turnos,
                atualizando indicadores, dashboard, fila de descarga e cálculos de moagem.
                Não apaga histórico, viagens, lançamentos nem dados das frentes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={clearPatioLoads} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* HISTÓRICO DE MOAGEM + CENÁRIO PÁTIO */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
                <Factory className="h-5 w-5 text-primary" /> HISTÓRICO DE MOAGEM
              </CardTitle>
              {state.raioMedio && (
                <p className="text-xs text-muted-foreground font-semibold mt-1">Raio Médio - {state.raioMedio}KM</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">

              <Input
                value={state.raioMedio}
                onChange={e => setState(prev => ({ ...prev, raioMedio: e.target.value }))}
                placeholder="Raio Médio (km)"
                className="h-8 text-xs w-[120px]"
              />
              <Input
                type="date"
                value={state.data}
                onChange={e => { setDateEdited(true); setState(prev => ({ ...prev, data: e.target.value })); }}
                className="h-8 text-xs w-[160px]"
                lang="pt-BR"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={captureRef} className="flex flex-col lg:flex-row bg-card mx-auto w-full max-w-[1220px]">
            {/* Left side: Turnos */}
            <div className="flex-1 border-r border-border">
              {/* Alinha o topo com o cabeçalho do CENÁRIO PÁTIO */}
              <div className="hidden lg:block h-7" aria-hidden="true" />
              {(['A', 'B', 'C'] as Turno[]).map(turno => (
                <div key={turno}>
                  {!isHourMode && (
                    <div className="flex h-7 items-center justify-center bg-primary text-primary-foreground font-bold text-sm">
                      {TURNO_LABELS[turno]}
                    </div>
                  )}
                  {state.turnos[turno].entries.map((entry, idx) => (
                    <div key={entry.horario} className="flex h-7 items-center border-b border-border/30 px-2">
                      <Input
                        value={entry.justificativa}
                        onChange={e => updateEntry(turno, idx, 'justificativa', e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-6 text-xs moagem-input border border-border/80 bg-transparent text-center rounded-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                        placeholder=""
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Right side: CENÁRIO PÁTIO table */}
            <div className="lg:w-[400px] w-full flex flex-col">
              <div className="flex h-7 items-center justify-center bg-destructive text-destructive-foreground font-black text-base uppercase tracking-wide">
                CENÁRIO PÁTIO
              </div>
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-destructive/90 h-7">
                    <TableHead className="h-7 text-destructive-foreground font-bold text-xs text-center py-0">HORAS</TableHead>
                    <TableHead className="h-7 text-destructive-foreground font-bold text-xs text-center py-0">CARGAS</TableHead>
                    <TableHead className="h-7 text-destructive-foreground font-bold text-xs text-center py-0">CAMINHÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_HOURS_ORDER.map(h => {
                    const turnoKey = (['A', 'B', 'C'] as Turno[]).find(t => TURNO_HOURS[t].includes(h))!;
                    const entryIdx = state.turnos[turnoKey].entries.findIndex(e => e.horario === h);
                    const entry = state.turnos[turnoKey].entries[entryIdx];
                    /* Espaçador que espelha a faixa de turno da coluna do histórico */
                    const isTurnoStart = TURNO_HOURS[turnoKey][0] === h;

                    return (
                      <Fragment key={h}>
                        {isTurnoStart && !isHourMode && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={3} className="h-7 p-0 bg-destructive/10" />
                          </TableRow>
                        )}
                        <TableRow className="border-b border-border/30">
                          <TableCell className="h-7 font-mono font-semibold text-xs text-center py-0">{h}:00</TableCell>
                          <TableCell className="h-7 text-center py-0">
                            <Input
                              type="number"
                              min={0}
                              value={entry?.cargas || ''}
                              onChange={e => updateEntry(turnoKey, entryIdx, 'cargas', Number(e.target.value))}
                              onKeyDown={handleKeyDown}
                              className="h-5 text-xs w-[62px] mx-auto text-center moagem-input"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="h-7 font-mono text-xs font-semibold text-center py-0">
                            {entry ? Math.floor(entry.cargas / 2) : 0}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Gráfico de Moagem + Input lateral */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Factory className="h-4 w-4 text-primary" /> Gráfico de Moagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Gráfico */}
            <div className="flex-1 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10 }} className="fill-muted-foreground" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number) => [`${value}`, 'Moagem']}
                    labelFormatter={(label) => label}
                  />
                  {avgMoagem > 0 && (
                    <ReferenceLine y={avgMoagem} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: `Média: ${avgMoagem.toFixed(1)}`, position: 'right', fontSize: 10, fill: 'hsl(var(--destructive))' }} />
                  )}
                  <Line
                    type="stepAfter"
                    dataKey="moagem"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Área de entrada lateral */}
            <div className="lg:w-[240px] w-full space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Adicionar Registro</p>
                <Input
                  type="time"
                  step={60}
                  lang="pt-BR"
                  value={newHorario}
                  onChange={e => setNewHorario(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="HH:MM"
                />
                <Input
                  type="number"
                  min={0}
                  value={newMoagem}
                  onChange={e => setNewMoagem(e.target.value)}
                  placeholder="Moagem"
                  className="h-8 text-xs"
                  onKeyDown={e => { if (e.key === 'Enter') addRecord(); }}
                />
                <Button onClick={addRecord} size="sm" className="w-full h-8 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>

              {/* Lista de registros */}
              {sortedRecords.length > 0 && (
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Registros</p>
                  {sortedRecords.map(record => (
                    <div key={record.id} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                      {editingId === record.id ? (
                        <>
                          <span className="font-mono font-semibold whitespace-nowrap">{record.horario}</span>
                          <Input
                            type="number"
                            value={editMoagem}
                            onChange={e => setEditMoagem(e.target.value)}
                            className="h-5 text-xs w-[60px] mx-1"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') confirmEdit(record.id); if (e.key === 'Escape') cancelEdit(); }}
                          />
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => confirmEdit(record.id)}>
                            <Check className="h-3 w-3 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={cancelEdit}>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono font-semibold whitespace-nowrap">{record.horario}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-semibold flex-1">{record.moagem}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEdit(record)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteRecord(record.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
