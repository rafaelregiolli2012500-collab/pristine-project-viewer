/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Save, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

export function VersionHistoryView() {
  const { versions, saveVersion, restoreVersion, deleteVersion, clearVersions } = useVersionHistory();
  const [label, setLabel] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const handleSave = () => {
    const finalLabel = label.trim() || `Versão ${new Date().toLocaleString('pt-BR')}`;
    saveVersion(finalLabel);
    setLabel('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Save className="h-4 w-4" /> Salvar Versão Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Nome da versão (opcional)"
            className="flex-1"
          />
          <Button onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4" /> Versões Salvas ({versions.length})
          </CardTitle>
          {versions.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearVersions} className="text-xs gap-1">
              <Trash2 className="h-3 w-3" /> Limpar Tudo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma versão salva</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-sm">{v.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(v.timestamp), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {confirmRestore === v.id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => { restoreVersion(v.id); setConfirmRestore(null); }}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setConfirmRestore(null)}>
                            Não
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setConfirmRestore(v.id)}>
                            <RotateCcw className="h-3 w-3" /> Restaurar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => deleteVersion(v.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
