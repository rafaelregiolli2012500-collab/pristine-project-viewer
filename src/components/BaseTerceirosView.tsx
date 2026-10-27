/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, Tractor, Truck, Combine, Pencil } from 'lucide-react';
import { BaseLocal, BaseTerceirosRecord, EquipmentType } from '@/types/maintenance';
import { useBaseTerceirosStore } from '@/hooks/useBaseTerceirosStore';
import { useEquipmentStore } from '@/hooks/useEquipmentStore';
import { TimerCell } from './TimerCell';

const SECTIONS: { type: EquipmentType; label: string; icon: React.JSX.Element }[] = [
  { type: 'colhedora', label: 'Colhedoras', icon: <Combine className="h-4 w-4 text-green-600" /> },
  { type: 'trator', label: 'Tratores', icon: <Tractor className="h-4 w-4 text-accent" /> },
  { type: 'caminhao', label: 'Caminhões', icon: <Truck className="h-4 w-4 text-primary" /> },
];

const LOCAL_LABELS: Record<BaseLocal, string> = { base: 'Manutenção Base', terceiros: 'Terceiro' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function entradaIso(r: BaseTerceirosRecord) {
  return `${r.dataEntrada}T${r.horaEntrada || '00:00'}:00`;
}

function entradaMs(r: BaseTerceirosRecord) {
  const t = new Date(entradaIso(r)).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function AddDialog({ type, label, frotas, onAdd }: { type: EquipmentType; label: string; frotas: string[]; onAdd: (d: Omit<BaseTerceirosRecord, 'id' | 'createdAt'>) => void }) {
  const [open, setOpen] = useState(false);
  const [frota, setFrota] = useState('');
  const [local, setLocal] = useState<BaseLocal>('base');
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState(todayStr());
  const [hora, setHora] = useState(nowStr());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const frotaInputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFrota(''); setLocal('base'); setMotivo(''); setData(todayStr()); setHora(nowStr()); };

  const suggestions = useMemo(() => {
    const typed = frota.trim().toLowerCase();
    if (!typed) return [];
    return frotas.filter(f => f.toLowerCase().includes(typed)).slice(0, 8);
  }, [frotas, frota]);

  useEffect(() => { setHighlight(0); }, [suggestions.length]);

  useEffect(() => {
    if (open) setTimeout(() => frotaInputRef.current?.focus(), 50);
  }, [open]);

  const onFrotaKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setShowSuggestions(false); setOpen(false); return; }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); setShowSuggestions(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      setFrota(suggestions[highlight]);
      setShowSuggestions(false);
    }
  };

  const submit = () => {
    if (!frota.trim() || !data || !hora) return;
    onAdd({
      frota: frota.trim().toUpperCase(),
      equipmentType: type,
      local,
      motivo: motivo.trim(),
      dataEntrada: data,
      horaEntrada: hora,
      status: 'em_manutencao',
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setData(todayStr()); setHora(nowStr()); } else reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-9 px-4 text-xs uppercase tracking-wider">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <DialogHeader>
          <DialogTitle>Nova Manutenção — {label.slice(0, -1)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Label>Frota</Label>
            <Input
              ref={frotaInputRef}
              value={frota}
              onChange={e => { setFrota(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={onFrotaKey}
              placeholder="Digite a frota..."
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                {suggestions.map((f, idx) => (
                  <button
                    key={f}
                    type="button"
                    onMouseDown={(ev) => { ev.preventDefault(); setFrota(f); setShowSuggestions(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm ${idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
                  >
                    <span className="font-mono font-semibold">{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Status</Label>
            <Select value={local} onValueChange={v => setLocal(v as BaseLocal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base">{LOCAL_LABELS.base}</SelectItem>
                <SelectItem value="terceiros">{LOCAL_LABELS.terceiros}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo da Manutenção</Label>
            <Input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo (opcional)"
              autoComplete="off"
            />
          </div>

          <div>
            <Label>Data / Hora (24h)</Label>
            <div className="flex gap-2">
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              <Input type="time" step={60} lang="pt-BR" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>

          <Button onClick={submit} disabled={!frota.trim()} className="w-full">Salvar (Enter)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BaseTerceirosView() {
  const { items, addItem, updateItem, removeItem } = useBaseTerceirosStore();
  const { equipment } = useEquipmentStore();
  const [confirmFinalize, setConfirmFinalize] = useState<BaseTerceirosRecord | null>(null);
  const [editing, setEditing] = useState<BaseTerceirosRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  const openTimeEdit = (r: BaseTerceirosRecord) => {
    setEditDate(r.dataEntrada);
    setEditTime(r.horaEntrada || '00:00');
    setEditing(r);
  };

  const saveTimeEdit = () => {
    if (!editing || !editDate || !editTime) return;
    updateItem(editing.id, { dataEntrada: editDate, horaEntrada: editTime });
    setEditing(null);
  };

  const frotasByType = useMemo(() => {
    const map = new Map<EquipmentType, string[]>();
    SECTIONS.forEach(s => map.set(s.type, []));
    equipment.forEach(e => {
      const list = map.get(e.equipmentType) ?? [];
      if (!list.includes(e.frota)) list.push(e.frota);
      map.set(e.equipmentType, list);
    });
    map.forEach(list => list.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })));
    return map;
  }, [equipment]);

  const grouped = useMemo(() => {
    const map = new Map<EquipmentType, BaseTerceirosRecord[]>();
    SECTIONS.forEach(s => map.set(s.type, []));
    items.forEach(i => {
      if (!map.has(i.equipmentType)) map.set(i.equipmentType, []);
      map.get(i.equipmentType)!.push(i);
    });
    return map;
  }, [items]);

  return (
    <div className="space-y-4">
      {SECTIONS.map(sec => {
        const list = (grouped.get(sec.type) ?? []).slice().sort((a, b) =>
          `${a.dataEntrada} ${a.horaEntrada}`.localeCompare(`${b.dataEntrada} ${b.horaEntrada}`));
        return (
          <Card key={sec.type} className="shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-sm">
                {sec.icon} {sec.label}
                <Badge variant="secondary" className="font-mono">{list.length}</Badge>
              </CardTitle>
              <AddDialog type={sec.type} label={sec.label} frotas={frotasByType.get(sec.type) ?? []} onAdd={addItem} />
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Nenhum equipamento em manutenção na Base ou em Terceiros.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[860px] table-fixed text-xs">
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Frota</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Status</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Motivo</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Início</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Tempo</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(r => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-middle">
                          <td className="py-1.5 px-2 font-mono font-semibold truncate">{r.frota}</td>
                          <td className="py-1.5 px-2">
                            <Select value={r.local} onValueChange={v => updateItem(r.id, { local: v as BaseLocal })}>
                              <SelectTrigger className="h-6 text-xs w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="base">{LOCAL_LABELS.base}</SelectItem>
                                <SelectItem value="terceiros">{LOCAL_LABELS.terceiros}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5 px-2 min-w-0">
                            <Input
                              className="h-6 text-xs"
                              value={r.motivo}
                              onChange={e => updateItem(r.id, { motivo: e.target.value })}
                              placeholder="Motivo da manutenção"
                            />
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 group min-w-0">
                              <span className="font-mono text-[11px] leading-snug whitespace-nowrap">
                                {new Date(entradaIso(r)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                                {new Date(entradaIso(r)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                                onClick={() => openTimeEdit(r)}
                                title="Editar data e horário de início"
                              >
                                <Pencil className="h-3 w-3 text-primary" />
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap font-mono font-semibold text-[11px]">
                            {Number.isFinite(entradaMs(r)) ? <TimerCell startIso={entradaIso(r)} minutesOnly /> : '—'}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-[10px] uppercase tracking-wide border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_22px_-6px_hsl(var(--primary))]"
                              onClick={() => setConfirmFinalize(r)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
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
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveTimeEdit} disabled={!editDate || !editTime}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmFinalize} onOpenChange={(o) => { if (!o) setConfirmFinalize(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar manutenção</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja finalizar a manutenção da frota {confirmFinalize?.frota}? O registro será removido desta lista e não será enviado ao Histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmFinalize(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmFinalize) removeItem(confirmFinalize.id); setConfirmFinalize(null); }}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
