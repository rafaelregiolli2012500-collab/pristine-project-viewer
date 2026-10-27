/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useState } from 'react';
import { FrenteConfig } from '@/types/maintenance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Route, StickyNote } from 'lucide-react';

interface Props {
  frentes: FrenteConfig[];
  onUpdateTrajeto: (id: string, trajeto: string) => void;
  onUpdateNotas?: (id: string, notas: string) => void;
}

const GLOBAL_NOTES_KEY = 'trajetos_global_notes';

function frenteNum(s: string): number {
  const m = (s || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function TrajetosView({ frentes, onUpdateTrajeto }: Props) {
  const sorted = [...frentes].sort((a, b) => frenteNum(a.nome) - frenteNum(b.nome));

  const [globalNotes, setGlobalNotes] = useState<string>(() => {
    try { return localStorage.getItem(GLOBAL_NOTES_KEY) || ''; } catch { return ''; }
  });

  useEffect(() => {
    try { localStorage.setItem(GLOBAL_NOTES_KEY, globalNotes); } catch {}
  }, [globalNotes]);

  if (frentes.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">Nenhuma frente cadastrada</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map(f => (
          <Card key={f.id} className="shadow-sm">
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Route className="h-4 w-4 text-primary" />
                {f.nome}
                {f.localidade && <span className="text-xs font-normal text-muted-foreground ml-1">— {f.localidade}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Trajeto</Label>
              <Textarea
                value={f.trajeto || ''}
                onChange={e => onUpdateTrajeto(f.id, e.target.value)}
                placeholder="Escreva o trajeto..."
                className="min-h-[100px] text-sm"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StickyNote className="h-4 w-4 text-primary" /> Anotações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={globalNotes}
            onChange={e => setGlobalNotes(e.target.value)}
            placeholder="Observações operacionais gerais (não vinculadas a uma frente específica)..."
            className="min-h-[140px] text-sm w-full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
