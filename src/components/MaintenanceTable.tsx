/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState } from 'react';
import { MaintenanceRecord, EquipmentType, StopReason, STOP_REASON_LABELS, STOP_REASON_CSS, STOP_REASON_TEXT } from '@/types/maintenance';
import { TimerCell } from './TimerCell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { combineDateTime, validateTimes } from '@/lib/maintenanceValidation';

interface Props {
  records: MaintenanceRecord[];
  equipmentType: EquipmentType;
  onFinalize: (id: string) => void;
  onUpdateRecord?: (id: string, updates: Partial<MaintenanceRecord>) => { ok: boolean; error?: string } | void;
  showFrente?: boolean;
}

function frenteNum(s: string): number {
  const m = (s || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function MaintenanceTable({ records, equipmentType, onFinalize, onUpdateRecord, showFrente = false }: Props) {
  const filtered = records
    .filter(r => r.equipmentType === equipmentType && r.status === 'em_manutencao')
    .sort((a, b) => frenteNum(a.frente) - frenteNum(b.frente) || a.frota.localeCompare(b.frota));

  



  // Edição de data/hora de início via modal (lápis)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // 🔥 NOVO (edição do motivo)
  const [editingMotivo, setEditingMotivo] = useState<string | null>(null);
  const [motivoValue, setMotivoValue] = useState('');

  if (filtered.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhum equipamento em manutenção</div>;
  }

  const openTimeEdit = (record: MaintenanceRecord) => {
    const d = new Date(record.inicioTime);
    if (Number.isFinite(d.getTime())) {
      setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setEditDate('');
      setEditTime('');
    }
    setEditingRecord(record);
  };

  const saveTimeEdit = () => {
    if (!editingRecord) return;
    const iso = combineDateTime(editDate, editTime);
    if (!iso) {
      toast({ variant: 'destructive', title: 'Data/horário inválidos', description: 'Informe uma data válida e um horário no formato HH:MM.' });
      return;
    }
    const check = validateTimes(iso, editingRecord.fimTime ?? null);
    if (!check.ok) {
      toast({ variant: 'destructive', title: 'Horário inválido', description: check.error });
      return;
    }
    const result = onUpdateRecord?.(editingRecord.id, { inicioTime: iso }) as { ok: boolean; error?: string } | void;
    if (result && result.ok === false) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: result.error });
      return;
    }
    setEditingRecord(null);
  };

  // 🔥 SALVAR MOTIVO
  const saveMotivoEdit = (record: MaintenanceRecord) => {
    if (onUpdateRecord) {
      onUpdateRecord(record.id, { motivo: motivoValue });
    }
    setEditingMotivo(null);
  };


  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed text-xs">
        <colgroup>
          {showFrente && <col style={{ width: '12%' }} />}
          <col style={{ width: showFrente ? '9%' : '12%' }} />
          {showFrente && <col style={{ width: '12%' }} />}
          <col style={{ width: showFrente ? '36%' : '48%' }} />
          <col style={{ width: showFrente ? '11%' : '14%' }} />
          <col style={{ width: showFrente ? '10%' : '13%' }} />
          <col style={{ width: showFrente ? '10%' : '13%' }} />
        </colgroup>





        <thead>
          <tr className="border-b border-border bg-muted/50">
            {showFrente && <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Frente</th>}
            <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Frota</th>
            {showFrente && <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Status</th>}
            <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Motivo</th>
            <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Início</th>
            <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Tempo</th>
            <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Ação</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(record => (
            <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-middle">
              
              {showFrente && <td className="py-1.5 px-2 font-bold text-primary whitespace-nowrap" title={record.frente}>{record.frente}</td>}
              
              <td className="py-1.5 px-2 font-mono font-semibold truncate">{record.frota}</td>

              {showFrente && (
                <td className="py-1.5 px-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-semibold break-words ${STOP_REASON_CSS[(record.stopReason || 'manutencao') as StopReason]} ${STOP_REASON_TEXT[(record.stopReason || 'manutencao') as StopReason]}`}>
                    {STOP_REASON_LABELS[(record.stopReason || 'manutencao') as StopReason]}
                  </span>
                </td>
              )}

              {/* MOTIVO EDITÁVEL com ícone lápis */}
              <td className="py-1.5 px-2 min-w-0">
                {editingMotivo === record.id ? (
                  <Input
                    value={motivoValue}
                    onChange={(e) => setMotivoValue(e.target.value)}
                    onBlur={() => saveMotivoEdit(record)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveMotivoEdit(record);
                      if (e.key === 'Escape') setEditingMotivo(null);
                    }}
                    className="h-6 text-xs"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-1 group min-w-0">
                    <span className="flex-1 min-w-0 truncate leading-snug" title={record.motivo || ''}>{record.motivo || '-'}</span>
                    <button
                      type="button"
                      className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setEditingMotivo(record.id); setMotivoValue(record.motivo || ''); }}
                      title="Editar justificativa"
                    >
                      <Pencil className="h-3 w-3 text-primary" />
                    </button>
                  </div>
                )}

              </td>

              {/* INÍCIO (data/hora) — editável pelo lápis */}
              <td className="py-1.5 px-2 whitespace-nowrap">
                <div className="flex items-center gap-1 group min-w-0">
                  <span className="font-mono text-[11px] leading-snug whitespace-nowrap">
                    {new Date(record.inicioTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(record.inicioTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  {onUpdateRecord && (
                    <button
                      type="button"
                      className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                      onClick={() => openTimeEdit(record)}
                      title="Editar data e horário de início"
                    >
                      <Pencil className="h-3 w-3 text-primary" />
                    </button>
                  )}
                </div>
              </td>

              <td className="py-1.5 px-2 whitespace-nowrap">
                <TimerCell startIso={record.inicioTime} />
              </td>

              <td className="py-1.5 px-2 whitespace-nowrap">
                <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px] uppercase tracking-wide border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_22px_-6px_hsl(var(--primary))]" onClick={() => onFinalize(record.id)}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Finalizar
                </Button>
              </td>

            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!editingRecord} onOpenChange={(o) => { if (!o) setEditingRecord(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar início da manutenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label>Horário de início</Label>
              <Input type="time" step={60} lang="pt-BR" value={editTime} onChange={e => setEditTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancelar</Button>
            <Button onClick={saveTimeEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
                      }
