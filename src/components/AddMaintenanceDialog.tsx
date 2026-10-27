/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useMemo, useEffect, useRef, KeyboardEvent } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Equipment, EquipmentType, StopReason, STOP_REASON_LABELS, FrenteConfig, MaintenanceRecord, reasonsForType } from '@/types/maintenance';
import { Plus, ChevronRight } from 'lucide-react';

interface Props {
  onAdd: (data: {
    frente: string;
    frota: string;
    equipmentType: EquipmentType;
    motivo: string;
    stopReason: StopReason;
    inicioTime: string;
  }) => void;
  equipmentType: EquipmentType;
  registeredEquipment?: Equipment[];
  frentes?: FrenteConfig[];
  prefillFrota?: string;
  prefillFrente?: string;
  activeRecords?: MaintenanceRecord[];
  onFinalizeAt?: (id: string, fimIso: string) => void;
  autoDetectType?: boolean;
  typeSelectable?: boolean;
  triggerLabel?: string;
}


function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getTodayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AddMaintenanceDialog({
  onAdd,
  equipmentType,
  registeredEquipment = [],
  frentes = [],
  prefillFrota,
  prefillFrente,
  activeRecords = [],
  onFinalizeAt,
  autoDetectType = false,
  typeSelectable = false,
  triggerLabel,
}: Props) {

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<EquipmentType>(equipmentType);
  const [confirmReplace, setConfirmReplace] = useState<{ oldId: string; newStartIso: string } | null>(null);

  const [frente, setFrente] = useState(prefillFrente || '');
  const [frota, setFrota] = useState(prefillFrota || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [hora, setHora] = useState('');
  const [data, setData] = useState(getTodayLocalDate());
  const [stopReason, setStopReason] = useState<StopReason>('manutencao');

  // Detect equipment for autoDetect mode
  const detectedEquipment = useMemo(() => {
    if (!autoDetectType) return null;
    const t = frota.trim().toLowerCase();
    if (!t) return null;
    return registeredEquipment.find(e => e.frota.toLowerCase() === t) || null;
  }, [autoDetectType, frota, registeredEquipment]);

  const effectiveType: EquipmentType = typeSelectable
    ? selectedType
    : (autoDetectType && detectedEquipment?.equipmentType) || equipmentType;

  // Reason picker (com setas) — lista filtrada pelo tipo efetivo
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonHl, setReasonHl] = useState(0);
  const reasonKeys = useMemo(() => reasonsForType(effectiveType), [effectiveType]);
  const reasonContainerRef = useRef<HTMLDivElement>(null);

  // Se o tipo mudar e o stopReason atual ficar oculto, volta para 'manutencao'
  useEffect(() => {
    if (!reasonKeys.includes(stopReason)) setStopReason('manutencao');
  }, [reasonKeys, stopReason]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!reasonOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!reasonContainerRef.current?.contains(e.target as Node)) setReasonOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [reasonOpen]);

  const allEquipment = registeredEquipment;
  const frotaInputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const typed = frota.trim().toLowerCase();
    if (!typed) return [];
    const list = autoDetectType && !typeSelectable
      ? allEquipment
      : allEquipment.filter(e => e.equipmentType === effectiveType);
    return list.filter(e => e.frota.toLowerCase().includes(typed)).slice(0, 8);
  }, [allEquipment, frota, effectiveType, autoDetectType, typeSelectable]);

  useEffect(() => { setHighlight(0); }, [suggestions.length]);

  // Atalho global "+" para abrir dialog
  useEffect(() => {
    const handler = (e: any) => {
      if (open) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.key === '+' || (e.shiftKey && e.code === 'Equal') || e.code === 'NumpadAdd') {
        e.preventDefault();
        handleOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeSelectable, equipmentType]);

  // Focus no input frota ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => frotaInputRef.current?.focus(), 50);
    }
  }, [open]);

  const resetForm = () => {
    setFrota(prefillFrota || '');
    setFrente(prefillFrente || '');
    setMotivo('');
    setStopReason('manutencao');
    setShowSuggestions(false);
    setHighlight(0);
    setReasonOpen(false);
    setReasonHl(0);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      resetForm();
      setHora(getCurrentTime());
      setData(getTodayLocalDate());
      if (typeSelectable) setSelectedType(equipmentType);
    } else {
      resetForm();
    }
    setOpen(isOpen);
  };

  const pickFrota = (eq: Equipment) => {
    setFrota(eq.frota);
    if (eq.frente) setFrente(eq.frente);
    setShowSuggestions(false);
  };

  const onFrotaKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setShowSuggestions(false); handleOpen(false); return; }
    if (suggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); /* keep typed */ }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); setShowSuggestions(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      pickFrota(suggestions[highlight]);
    }
  };

  const onReasonKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { setReasonOpen(false); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); setReasonOpen(true); return; }
    if (!reasonOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setReasonHl(h => Math.min(h + 1, reasonKeys.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setReasonHl(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); setStopReason(reasonKeys[reasonHl]); setReasonOpen(false); }
  };

  const buildPayload = () => {
    let finalFrente = frente;
    if (effectiveType === 'colhedora' || effectiveType === 'trator') {
      const eq = allEquipment.find(
        e => e.frota.toLowerCase() === frota.toLowerCase() && e.equipmentType === effectiveType
      );
      if (eq?.frente) finalFrente = eq.frente;
    }
    const [h, m] = hora.split(':').map(Number);
    const [y, mo, d] = data.split('-').map(Number);
    const localDate = new Date(y, mo - 1, d, h, m, 0);
    return {
      finalFrente,
      inicioIso: localDate.toISOString(),
      inicioDate: localDate,
    };
  };

  const handleSubmit = () => {
    if (!frota) return;
    if (autoDetectType && !detectedEquipment) {
      // No registered equipment match — block submission for safety
      return;
    }
    const { finalFrente, inicioIso, inicioDate } = buildPayload();

    const conflict = activeRecords.find(
      r =>
        r.equipmentType === effectiveType &&
        r.frota.trim().toLowerCase() === frota.trim().toLowerCase()
    );
    if (conflict && onFinalizeAt) {
      setConfirmReplace({ oldId: conflict.id, newStartIso: inicioIso });
      return;
    }

    onAdd({
      frente: finalFrente, frota, equipmentType: effectiveType, motivo, stopReason,
      inicioTime: inicioIso,
    });
    handleOpen(false);
    void inicioDate;
  };

  const handleConfirmReplace = () => {
    if (!confirmReplace) return;
    const { finalFrente, inicioIso } = buildPayload();
    // Sem sobreposição: a parada anterior encerra exatamente no início da nova.
    onFinalizeAt?.(confirmReplace.oldId, confirmReplace.newStartIso);
    onAdd({
      frente: finalFrente, frota, equipmentType: effectiveType, motivo, stopReason,
      inicioTime: inicioIso,
    });
    setConfirmReplace(null);
    handleOpen(false);
  };



  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-9 px-4 text-xs uppercase tracking-wider">
          <Plus className="h-4 w-4" /> {triggerLabel || 'Adicionar'}
        </Button>
      </DialogTrigger>

      <DialogContent
        onKeyDown={(e) => { if (e.key === 'Escape') handleOpen(false); }}
      >
        <DialogHeader>
          <DialogTitle>Nova Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {typeSelectable && (
            <div>
              <Label>Tipo de Equipamento</Label>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {(['colhedora', 'trator', 'caminhao'] as EquipmentType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSelectedType(t); setFrota(''); setFrente(''); }}
                    className={`rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                      selectedType === t ? 'border-primary bg-primary/15 text-primary' : 'hover:bg-accent'
                    }`}
                  >
                    {t === 'colhedora' ? 'Colhedora' : t === 'trator' ? 'Trator' : 'Caminhão'}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                {suggestions.map((eq, idx) => (
                  <button
                    key={eq.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickFrota(eq); }}
                    className={`w-full text-left px-3 py-1.5 text-sm flex justify-between items-center ${idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
                  >
                    <span className="font-mono font-semibold">{eq.frota}</span>
                    {eq.frente && <span className="text-xs text-muted-foreground">{eq.frente}</span>}
                  </button>
                ))}
              </div>
            )}
            {(effectiveType === 'colhedora' || effectiveType === 'trator') && frota.trim() && (() => {
              const eq = allEquipment.find(
                e => e.frota.toLowerCase() === frota.trim().toLowerCase() && e.equipmentType === effectiveType
              );
              if (eq?.frente) return <p className="mt-1 text-xs">Frente: <span className="font-bold text-primary">{eq.frente}</span> {autoDetectType && <span className="text-muted-foreground">· {effectiveType}</span>}</p>;
              return null;
            })()}
            {autoDetectType && frota.trim() && !detectedEquipment && (
              <p className="mt-1 text-xs text-destructive">Frota não cadastrada</p>
            )}
          </div>

          <div ref={reasonContainerRef} onKeyDown={onReasonKey} tabIndex={0} className="outline-none">
            <Label>Status (→ expandir, ↑↓ Enter selecionar, Esc fechar)</Label>
            <button
              type="button"
              onClick={() => setReasonOpen(o => !o)}
              className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-background hover:bg-accent"
            >
              <span>{STOP_REASON_LABELS[stopReason]}</span>
              <ChevronRight className={`h-4 w-4 transition-transform ${reasonOpen ? 'rotate-90' : ''}`} />
            </button>
            {reasonOpen && (
              <div className="mt-1 border rounded-md bg-popover shadow-md max-h-60 overflow-y-auto">
                {reasonKeys.map((k, idx) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setStopReason(k); setReasonOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm ${idx === reasonHl ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
                    onMouseEnter={() => setReasonHl(idx)}
                  >
                    {STOP_REASON_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
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
              <Input type="time" step={60} value={hora} onChange={e => setHora(e.target.value)} lang="pt-BR" />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full">Salvar (Enter)</Button>
        </div>
      </DialogContent>

      <AlertDialog open={!!confirmReplace} onOpenChange={(o) => { if (!o) setConfirmReplace(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manutenção em aberto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta frota já possui uma manutenção em aberto. Deseja finalizar a manutenção atual e abrir uma nova?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmReplace(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

