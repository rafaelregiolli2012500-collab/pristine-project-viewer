/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState } from 'react';
import { FrenteConfig, frenteNome, frenteLabel } from '@/types/maintenance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Trash2, Plus, MapPin, Pencil } from 'lucide-react';

interface Props {
  frentes: FrenteConfig[];
  onAdd: (numero: string, fazenda: string) => void;
  onRemove: (id: string) => void;
  onUpdateFazenda: (id: string, fazenda: string) => void;
  onUpdateIdentidade: (id: string, numero: string, fazenda: string) => void;
  onUpdateLider?: (id: string, lider: string) => void;
  onUpdateKmh?: (id: string, kmh: string) => void;
  onUpdatePipa?: (id: string, pipa: string) => void;
  onUpdateCmOficina?: (id: string, cmOficina: string) => void;
}

export function FrenteManager({
  frentes, onAdd, onRemove, onUpdateFazenda, onUpdateIdentidade,
  onUpdateLider, onUpdateKmh, onUpdatePipa, onUpdateCmOficina,
}: Props) {
  const [numero, setNumero] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [editing, setEditing] = useState<FrenteConfig | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editFazenda, setEditFazenda] = useState('');

  const handleAdd = () => {
    if (!numero.trim()) return;
    onAdd(numero.trim(), fazenda.trim());
    setNumero('');
    setFazenda('');
  };

  const openEdit = (f: FrenteConfig) => {
    setEditing(f);
    setEditNumero(f.numero ?? (f.nome || '').replace(/\D+/g, ''));
    setEditFazenda(f.fazenda ?? f.localidade ?? '');
  };

  const saveEdit = () => {
    if (!editing || !editNumero.trim()) return;
    onUpdateIdentidade(editing.id, editNumero.trim(), editFazenda.trim());
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          Frentes de Colheita e Localidades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-[160px]">
            <Label className="text-xs">Número da Frente</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 22" className="h-8 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setNumero(''); setFazenda(''); } }} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Fazenda</Label>
            <Input value={fazenda} onChange={e => setFazenda(e.target.value)} placeholder="Ex: Santa Maria" className="h-8 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setNumero(''); setFazenda(''); } }} />
          </div>
          <Button size="sm" onClick={handleAdd} className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {numero.trim() && (
          <p className="text-xs text-muted-foreground">
            Identificação: <span className="font-bold text-foreground">
              {frenteLabel({ nome: frenteNome(numero.trim()), fazenda: fazenda.trim(), localidade: '' })}
            </span>
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold w-[170px]">Frente</th>
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold">Fazenda</th>
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold w-[110px]">Km/h</th>
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold w-[170px]">Coordenador</th>
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold w-[140px]">Pipa</th>
                <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-semibold w-[150px]">CM oficina</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {frentes.map(f => (
                <tr key={f.id} className="border-b border-border/30">
                  <td className="py-2 px-3 font-bold">
                    <div className="flex items-center gap-1">
                      <span>{f.nome}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(f)} aria-label={`Editar ${f.nome}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      value={f.fazenda ?? f.localidade ?? ''}
                      onChange={e => onUpdateFazenda(f.id, e.target.value)}
                      placeholder="Fazenda..."
                      className="h-7 text-sm border-dashed"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      value={f.kmh || ''}
                      onChange={e => onUpdateKmh?.(f.id, e.target.value)}
                      placeholder="Km/h"
                      className="h-7 text-sm border-dashed font-mono"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      value={f.lider || ''}
                      onChange={e => onUpdateLider?.(f.id, e.target.value)}
                      placeholder="Coordenador..."
                      className="h-7 text-sm border-dashed"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      title={f.pipa || ''}
                      value={f.pipa || ''}
                      onChange={e => onUpdatePipa?.(f.id, e.target.value)}
                      placeholder="Pipa..."
                      className="h-7 text-sm border-dashed w-full text-ellipsis"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      title={f.cmOficina || ''}
                      value={f.cmOficina || ''}
                      onChange={e => onUpdateCmOficina?.(f.id, e.target.value)}
                      placeholder="CM oficina..."
                      className="h-7 text-sm border-dashed w-full text-ellipsis"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onRemove(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Frente</DialogTitle>
            <DialogDescription>
              Altera o cadastro existente — equipamentos e manutenções permanecem vinculados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Número da Frente</Label>
              <Input value={editNumero} onChange={e => setEditNumero(e.target.value)} placeholder="Ex: 25" className="h-9"
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} />
            </div>
            <div>
              <Label className="text-xs">Fazenda</Label>
              <Input value={editFazenda} onChange={e => setEditFazenda(e.target.value)} placeholder="Ex: Santa Maria" className="h-9"
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Identificação: <span className="font-bold text-foreground">
                {frenteLabel({ nome: frenteNome(editNumero.trim()), fazenda: editFazenda.trim(), localidade: '' })}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editNumero.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
