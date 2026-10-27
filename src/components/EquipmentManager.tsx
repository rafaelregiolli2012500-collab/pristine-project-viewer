/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Equipment, EquipmentType } from '@/types/maintenance';
import { Plus, Trash2, Settings, Wrench, Tractor, Truck, Container, MapPin } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  equipment: Equipment[];
  onAdd: (item: Omit<Equipment, 'id'>) => void;
  onRemove: (id: string) => void;
  frentes: string[];
}

const TYPE_LABELS: Record<EquipmentType, string> = {
  colhedora: 'Colhedora',
  trator: 'Trator',
  transbordo: 'Transbordo',
  caminhao: 'Caminhão',
};

const TYPE_ICONS: Record<EquipmentType, typeof Wrench> = {
  colhedora: Wrench,
  trator: Tractor,
  transbordo: Container,
  caminhao: Truck,
};

const FIELD_TYPES: EquipmentType[] = ['colhedora', 'trator'];

export function EquipmentManager({ equipment, onAdd, onRemove, frentes }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<EquipmentType>('colhedora');
  const [frota, setFrota] = useState('');
  const [frente, setFrente] = useState('');
  const [descricao, setDescricao] = useState('');

  const frenteList = frentes.length > 0 ? frentes : ['F-23', 'F-24', 'F-25', 'F-26', 'F-27', 'F-28', 'F-29', 'F-30'];

  const handleAdd = () => {
    if (!frota) return;
    const needsFrente = tipo !== 'caminhao';
    if (needsFrente && !frente) return;
    onAdd({
      frota,
      equipmentType: tipo,
      frente: needsFrente ? frente : undefined,
      descricao: descricao || undefined,
    });
    setFrota('');
    setFrente('');
    setDescricao('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  const caminhoes = equipment.filter(e => e.equipmentType === 'caminhao');
  const fieldEquip = equipment.filter(e => e.equipmentType !== 'caminhao');

  // Group by frente
  const grouped = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    frenteList.forEach(f => map.set(f, []));
    fieldEquip.forEach(eq => {
      const key = eq.frente || 'Sem Frente';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(eq);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [fieldEquip, frenteList]);

  const showFrente = tipo !== 'caminhao';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Cadastro de Equipamentos
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Equipamento
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Cadastrar Equipamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={v => setTipo(v as EquipmentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colhedora">Colhedora</SelectItem>
                    <SelectItem value="trator">Trator</SelectItem>
                    <SelectItem value="caminhao">Caminhão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frota</Label>
                <Input value={frota} onChange={e => setFrota(e.target.value)} placeholder="Ex: 48031" />
              </div>
              {showFrente && (
                <div>
                  <Label>Frente</Label>
                  <Select value={frente} onValueChange={setFrente}>
                    <SelectTrigger><SelectValue placeholder="Selecione a frente" /></SelectTrigger>
                    <SelectContent>
                      {frenteList.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: John Deere 3520" />
              </div>
              <Button onClick={handleAdd} className="w-full">Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Equipamentos agrupados por Frente */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
            <MapPin className="h-4 w-4" /> Equipamentos por Frente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {grouped.map(([frenteNome, items]) => (
              <Card key={frenteNome} className="bg-secondary/30 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-primary">{frenteNome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {FIELD_TYPES.map(type => {
                    const list = items.filter(i => i.equipmentType === type);
                    const Icon = TYPE_ICONS[type];
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-1">
                          <Icon className="h-3 w-3" /> {TYPE_LABELS[type]}s ({list.length})
                        </div>
                        {list.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60 pl-4">—</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {list.map(eq => (
                              <div key={eq.id} className="group flex items-center gap-1 bg-background/60 rounded px-2 py-0.5 text-xs">
                                <span className="font-mono font-bold">{eq.frota}</span>
                                {eq.descricao && <span className="text-muted-foreground">· {eq.descricao}</span>}
                                <button
                                  onClick={() => onRemove(eq.id)}
                                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive ml-0.5"
                                  aria-label="Remover"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Caminhões — lista única, sem agrupamento por frente */}
        <div className="space-y-2 pt-4 border-t border-border">
          <h3 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            <Truck className="h-4 w-4" /> Caminhões ({caminhoes.length})
          </h3>
          {caminhoes.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-6">Nenhum cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
              {caminhoes.map(eq => (
                <div key={eq.id} className="flex items-center justify-between bg-secondary/50 rounded-md px-2.5 py-1">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-xs whitespace-nowrap">{eq.frota}</span>
                    {eq.descricao && <span className="ml-1.5 text-[11px] text-muted-foreground truncate">{eq.descricao}</span>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => onRemove(eq.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
