/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useMemo } from 'react';
import { MaintenanceRecord, EquipmentType, STOP_REASON_LABELS, StopReason, RecordStopReason, NULL_STOP_REASON, isNullStopReason, reasonsForType } from '@/types/maintenance';
import { formatDuration } from '@/hooks/useTimer';
import { Trash2, Pencil, Check, X, Wrench, Tractor, Truck, Search, RotateCcw } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { combineDateTime, validateTimes } from '@/lib/maintenanceValidation';
import { toast } from '@/hooks/use-toast';

type UpdateFn = (id: string, data: Partial<MaintenanceRecord>) => { ok: boolean; error?: string } | void;

interface Props {
  records: MaintenanceRecord[];
  equipmentType?: EquipmentType;
  onDelete: (id: string) => void;
  onClearAll?: () => void;
  onUpdateRecord?: UpdateFn;
  onRestore?: (id: string) => { ok: boolean; error?: string } | void;
}

function isValidIso(iso?: string | null) {
  return !!iso && Number.isFinite(new Date(iso).getTime());
}
function toTimeStr(iso: string) {
  if (!isValidIso(iso)) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function toDateStr(iso: string) {
  if (!isValidIso(iso)) return '--/--/----';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function toDateInput(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function HistorySection({ title, icon: Icon, records, onDelete, onUpdateRecord, onRestore }: {
  title: string;
  icon: typeof Wrench;
  records: MaintenanceRecord[];
  onDelete: (id: string) => void;
  onUpdateRecord?: UpdateFn;
  onRestore?: (id: string) => { ok: boolean; error?: string } | void;
}) {
  const [restoreTarget, setRestoreTarget] = useState<MaintenanceRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFimDate, setEditFimDate] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  const [editStopReason, setEditStopReason] = useState<RecordStopReason>('manutencao');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const startEdit = (r: MaintenanceRecord) => {
    setEditingId(r.id);
    setEditMotivo(r.motivo || '');
    setEditStopReason(r.stopReason || 'manutencao');
    setEditDate(toDateInput(r.inicioTime));
    setEditInicio(toTimeStr(r.inicioTime));
    setEditFimDate(r.fimTime ? toDateInput(r.fimTime) : toDateInput(r.inicioTime));
    setEditFim(r.fimTime ? toTimeStr(r.fimTime) : '');
  };

  /** Cancelamento seguro: apenas descarta as alterações não salvas. */
  const cancelEdit = () => {
    setEditingId(null);
    setEditDate('');
    setEditInicio('');
    setEditFimDate('');
    setEditFim('');
    setEditMotivo('');
    setEditStopReason('manutencao');
  };

  const saveEdit = (r: MaintenanceRecord) => {
    if (!onUpdateRecord) return;
    try {
      const updates: Partial<MaintenanceRecord> = { motivo: editMotivo, stopReason: editStopReason };

      const newInicio = editDate && editInicio ? combineDateTime(editDate, editInicio) : r.inicioTime;
      if (!newInicio) {
        toast({ variant: 'destructive', title: 'Data inválida', description: 'Verifique a data e o horário informados para o início da manutenção.' });
        return;
      }
      let newFim: string | null = r.fimTime ?? null;
      if (editFimDate && editFim) {
        newFim = combineDateTime(editFimDate, editFim);
        if (!newFim) {
          toast({ variant: 'destructive', title: 'Data inválida', description: 'Verifique a data e o horário informados para o término da manutenção.' });
          return;
        }
      }

      const check = validateTimes(newInicio, newFim);
      if (!check.ok) {
        toast({ variant: 'destructive', title: 'Horário inválido', description: check.error });
        return;
      }

      updates.inicioTime = newInicio;
      if (newFim) updates.fimTime = newFim;

      const result = onUpdateRecord(r.id, updates);
      if (result && result.ok === false) {
        toast({ variant: 'destructive', title: 'Não foi possível salvar', description: result.error });
        return;
      }
      cancelEdit();
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: 'Ocorreu um erro ao processar a alteração. O registro original foi mantido.' });
    }
  };


  const handleKey = (e: React.KeyboardEvent, r: MaintenanceRecord) => {
    if (e.key === 'Enter') saveEdit(r);
    if (e.key === 'Escape') cancelEdit();
  };

  const q = search.trim().toLowerCase();
  const visibleRecords = useMemo(() => {
    if (!q) return records;
    return records.filter(r => (r.frota || '').toLowerCase().includes(q));
  }, [records, q]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-2 space-y-1">
        <CardTitle className="flex items-center gap-2 text-xs uppercase">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title} ({visibleRecords.length}{q ? `/${records.length}` : ''})
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 ml-auto"
            onClick={() => { setSearchOpen(s => !s); if (searchOpen) setSearch(''); }}
            title="Pesquisar por frota"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
        {searchOpen && (
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar frota..."
            className="h-7 text-xs"
            autoFocus
          />
        )}
      </CardHeader>
      <CardContent className="p-2">
        {visibleRecords.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">{q ? 'Nenhuma frota encontrada' : 'Sem registros'}</p>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {visibleRecords
              .sort((a, b) => new Date(b.fimTime || b.inicioTime).getTime() - new Date(a.fimTime || a.inicioTime).getTime())
              .map(r => {
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="border border-border/50 rounded p-1.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-[10px]">{r.frente || '-'}</span>
                        <span className="font-mono font-bold">{r.frota}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {onRestore && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-primary" onClick={() => setRestoreTarget(r)} title="Restaurar manutenção">
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                        {onUpdateRecord && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-primary" onClick={() => startEdit(r)} title="Editar manutenção, data e hora">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isNullStopReason(r.stopReason) ? (
                        <span className="text-[10px] font-mono font-bold px-1 rounded bg-destructive/15 text-destructive border border-destructive/40">
                          NULL
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {STOP_REASON_LABELS[(r.stopReason || 'manutencao') as StopReason]}
                        </span>
                      )}
                      {r.origem === 'linha_do_tempo' && (
                        <span className="text-[9px] text-muted-foreground">Linha do Tempo</span>
                      )}
                    </div>

                    {/* MOTIVO + DATAS: editados via lápis */}
                    {isEditing ? (
                      <div className="space-y-1">
                        <Select value={editStopReason} onValueChange={(v) => setEditStopReason(v as RecordStopReason)}>
                          <SelectTrigger className="h-6 text-[10px] px-1 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NULL_STOP_REASON} className="text-xs font-mono">NULL</SelectItem>
                            {reasonsForType(r.equipmentType).map(reason => (
                              <SelectItem key={reason} value={reason} className="text-xs">
                                {STOP_REASON_LABELS[reason]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={editMotivo}
                          onChange={e => setEditMotivo(e.target.value)}
                          onKeyDown={e => handleKey(e, r)}
                          placeholder="Justificativa"
                          className="h-6 text-[11px]"
                          autoFocus
                        />
                        <div className="flex gap-1 items-center">
                          <span className="text-[10px] text-muted-foreground w-10">Início</span>
                          <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-6 text-[11px]" />
                          <Input type="time" step={60} lang="pt-BR" value={editInicio} onChange={e => setEditInicio(e.target.value)} onKeyDown={e => handleKey(e, r)} className="h-6 text-[11px] w-[80px]" />
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className="text-[10px] text-muted-foreground w-10">Fim</span>
                          <Input type="date" value={editFimDate} onChange={e => setEditFimDate(e.target.value)} className="h-6 text-[11px]" />
                          <Input type="time" step={60} lang="pt-BR" value={editFim} onChange={e => setEditFim(e.target.value)} onKeyDown={e => handleKey(e, r)} className="h-6 text-[11px] w-[80px]" />
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600" onClick={() => saveEdit(r)}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => cancelEdit()}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">{r.motivo || '-'}</div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span>{toDateStr(r.inicioTime)} {toTimeStr(r.inicioTime)} → {r.fimTime ? `${toDateStr(r.fimTime)} ${toTimeStr(r.fimTime)}` : '...'}</span>
                          {r.fimTime && <span className="text-primary font-bold">{formatDuration(r.inicioTime, r.fimTime)}</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => { if (!o) setRestoreTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta manutenção será retirada do histórico e voltará para a aba de manutenção do equipamento como uma manutenção em aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestoreTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!restoreTarget || !onRestore) return;
                const result = onRestore(restoreTarget.id);
                if (result && result.ok === false) {
                  toast({ variant: 'destructive', title: 'Não foi possível restaurar', description: result.error });
                }
                setRestoreTarget(null);
              }}
            >
              Restaurar manutenção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function HistoryTable({ records, equipmentType, onDelete, onClearAll, onUpdateRecord, onRestore }: Props) {
  const filtered = equipmentType ? records.filter(r => r.equipmentType === equipmentType) : records;

  if (equipmentType) {
    // single column legacy (não usado, mas mantém compat)
    return <HistorySection title={equipmentType} icon={Wrench} records={filtered} onDelete={onDelete} onUpdateRecord={onUpdateRecord} onRestore={onRestore} />;
  }

  const colhedoras = filtered.filter(r => r.equipmentType === 'colhedora');
  const tratores = filtered.filter(r => r.equipmentType === 'trator');
  const caminhoes = filtered.filter(r => r.equipmentType === 'caminhao');

  return (
    <div className="space-y-3">
      {onClearAll && filtered.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="destructive" onClick={onClearAll} className="gap-1 text-xs">
            <Trash2 className="h-3.5 w-3.5" /> Limpar Histórico
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <HistorySection onRestore={onRestore} title="Colhedoras" icon={Wrench} records={colhedoras} onDelete={onDelete} onUpdateRecord={onUpdateRecord} />
        <HistorySection onRestore={onRestore} title="Tratores" icon={Tractor} records={tratores} onDelete={onDelete} onUpdateRecord={onUpdateRecord} />
        <HistorySection onRestore={onRestore} title="Caminhões" icon={Truck} records={caminhoes} onDelete={onDelete} onUpdateRecord={onUpdateRecord} />
      </div>
    </div>
  );
}
