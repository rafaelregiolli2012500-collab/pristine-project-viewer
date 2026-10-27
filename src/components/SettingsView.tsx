/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Upload, Info, Save, Lock, Clock, FileSpreadsheet, LogOut, Shield } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { EquipmentType } from '@/types/maintenance';
import { downloadMaintenanceExcel, EQUIPMENT_LABELS } from '@/lib/excelExport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaintenanceRecord } from '@/types/maintenance';
import { useSystemTime, getAvailableOperationalDates } from '@/hooks/useSystemTime';
import type { ImportResult, ExportResult } from '@/lib/backup';
import { saveBackupToFolder } from '@/lib/backup';
import { AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { useUnit } from '@/hooks/useUnit';


interface Props {
  onExport: () => void | ExportResult;
  onImport: (file: File) => void | Promise<ImportResult>;
  records?: MaintenanceRecord[];
  onLogout?: () => void;
}

declare global {
  interface Window {
    monitCampo?: {
      isDesktop?: boolean;
      openAdminPanel?: () => void;
    };
  }
}

const AUTO_BACKUP_KEY = 'auto_backup_enabled';

function formatDateBR(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function SettingsView({ onExport, onImport, records = [], onLogout }: Props) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem(AUTO_BACKUP_KEY) === 'true');
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportResult | null>(null);
  const [exportReport, setExportReport] = useState<{ ok: boolean; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const { lockedDate, isLocked, setMode } = useSystemTime();
  const { unit, units, setUnit } = useUnit();
  const ALL_TYPES: EquipmentType[] = ['colhedora', 'trator', 'caminhao'];
  const [excelTypes, setExcelTypes] = useState<EquipmentType[]>(ALL_TYPES);
  const [excelReport, setExcelReport] = useState<{ ok: boolean; message: string } | null>(null);

  const todayKey = (() => {
    const d = new Date();
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const toggleType = (t: EquipmentType, on: boolean) => {
    setExcelTypes(prev => (on ? Array.from(new Set([...prev, t])) : prev.filter(x => x !== t)));
  };

  const handleGenerateExcel = () => {
    setExcelReport(null);
    if (excelTypes.length === 0) {
      setExcelReport({ ok: false, message: 'Selecione ao menos um tipo de equipamento.' });
      return;
    }
    try {
      const res = downloadMaintenanceExcel(records, excelTypes);
      setExcelReport(
        res.count === 0
          ? { ok: false, message: `Nenhuma manutenção encontrada em ${res.ctx.dayLabel} para os tipos selecionados.` }
          : { ok: true, message: `${res.count} manutenção(ões) exportadas — ${res.fileName}` },
      );
    } catch {
      setExcelReport({ ok: false, message: 'Falha ao gerar o Excel.' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportReport(null);
    try {
      const result = await onImport(file);
      if (result) {
        setImportReport(result);
        if (result.restoredKeys.length > 0) {
          // Recarrega o sistema para que TODAS as abas leiam o estado restaurado.
          setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 2500);
        }
      }
    } catch {
      setImportReport({
        ok: false,
        restoredKeys: [],
        issues: ['Falha inesperada durante a restauração. Nenhum dado foi alterado.'],
        summary: { frentes: 0, equipamentos: 0, localidades: 0, manutencoes: 0 },
      });
    } finally {
      setImporting(false);
    }
  };


  const handleExport = async () => {
    setExportReport(null);
    setExporting(true);
    try {
      const result = await saveBackupToFolder();
      setExportReport(
        result.ok
          ? {
              ok: true,
              message: result.choseFolder
                ? `Backup íntegro salvo na pasta escolhida: ${result.label}`
                : `Backup íntegro gerado e validado: ${result.label}`,
            }
          : { ok: false, message: `Backup NÃO gerado — ${result.issues.join(' ')}` },
      );
    } catch {
      setExportReport({ ok: false, message: 'Falha ao gerar o backup. Nenhum arquivo foi criado.' });
    } finally {
      setExporting(false);
    }
  };


  const availableDates = useMemo(() => getAvailableOperationalDates(records), [records]);

  useEffect(() => {
    localStorage.setItem(AUTO_BACKUP_KEY, String(autoBackup));
    if (!autoBackup) return;
    const id = setInterval(() => { onExport(); }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoBackup, onExport]);


  const handleToggleLock = (locked: boolean) => {
    if (locked) {
      const initial = lockedDate || availableDates[0] || null;
      setMode('historical_locked', initial);
    } else {
      setMode('realtime');
    }
  };

  const openAdmin = () => {
    openAdminPanel();
  };

  return (
    <div className="space-y-4">

      {/* Acesso administrativo — Painel Central (online) */}
      <Card className="border-primary/20">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" /> Acesso administrativo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 pt-0">
          <p className="text-xs text-muted-foreground">
            Abre o Painel Central em janela separada. Login e permissões são os do painel original.
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={openAdmin}>
            <Shield className="h-4 w-4" /> Abrir Central
          </Button>
        </CardContent>
      </Card>

      {/* TRAVAR CRONOGRAMA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" /> Modo do cronograma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Travar cronograma em data histórica</p>
              <p className="text-xs text-muted-foreground">
                Congela o sistema na data selecionada. Quando desligado, volta ao tempo real.
              </p>
            </div>
            <Switch checked={isLocked} onCheckedChange={handleToggleLock} />
          </div>

          {isLocked && (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Data operacional travada (06:00 → 05:59)</Label>
              {availableDates.length === 0 ? (
                <p className="text-xs text-destructive">Nenhuma data disponível no histórico.</p>
              ) : (
                <Select
                  value={lockedDate || ''}
                  onValueChange={(v) => setMode('historical_locked', v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione uma data" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(d => (
                      <SelectItem key={d} value={d}>{formatDateBR(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                <Lock className="h-3 w-3" />
                Sistema travado em {lockedDate ? formatDateBR(lockedDate) : '—'}. Cálculos, barras e indicadores não avançam.
              </div>
            </div>
          )}

          {!isLocked && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
              <strong>Tempo real:</strong> o sistema usa o horário atual do computador.
            </div>
          )}
        </CardContent>
      </Card>

      {/* EXPORTAÇÃO DE MANUTENÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4" /> Exportação de Manutenções
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`rounded-md border px-2 py-1.5 text-xs ${isLocked ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-600/40 bg-green-600/10'}`}>
            {isLocked
              ? `🔒 DATA TRAVADA: ${lockedDate ? formatDateBR(lockedDate) : '—'}`
              : `🟢 TEMPO REAL: ${formatDateBR(todayKey)}`}
          </div>

          <div>
            <Label className="text-xs">Tipos de equipamento</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {ALL_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={excelTypes.includes(t)} onCheckedChange={v => toggleType(t, v === true)} />
                  {EQUIPMENT_LABELS[t]}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={excelTypes.length === ALL_TYPES.length}
                  onCheckedChange={v => setExcelTypes(v === true ? ALL_TYPES : [])}
                />
                Todos
              </label>
            </div>
          </div>

          {excelReport && (
            <div className={`rounded-md border p-2 text-xs flex items-center gap-2 ${excelReport.ok ? 'border-green-600/40 bg-green-600/10' : 'border-destructive/40 bg-destructive/10'}`}>
              {excelReport.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
              <span>{excelReport.message}</span>
            </div>
          )}

          <Button onClick={handleGenerateExcel} variant="outline" className="gap-2 w-full">
            <FileSpreadsheet className="h-4 w-4" /> 📊 Gerar Excel
          </Button>
        </CardContent>
      </Card>




      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Save className="h-4 w-4" /> Backup Automático</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Salvar backup a cada 1 hora</p>
            <p className="text-xs text-muted-foreground">Quando ativo, gera download automático do backup.</p>
          </div>
          <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> Backup e Restauração</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O backup exporta <strong>todas</strong> as informações do sistema: cadastros de frentes, fazendas,
            coordenadores, pipas, CM oficina, equipamentos, manutenções abertas e finalizadas, histórico, moagem,
            trajetos, cronograma, preferências e configurações. O arquivo só é entregue após validação automática.
            Antes de qualquer restauração, um <strong>backup de segurança</strong> do estado atual é gerado.
          </p>

          {exportReport && (
            <div className={`rounded-md border p-2 text-xs flex items-center gap-2 ${exportReport.ok ? 'border-green-600/40 bg-green-600/10' : 'border-destructive/40 bg-destructive/10'}`}>
              {exportReport.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
              <span>{exportReport.message}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={handleExport} variant="outline" className="gap-2 flex-1" disabled={exporting}><Download className="h-4 w-4" /> {exporting ? 'Exportando…' : 'Exportar Backup (escolher pasta)'}</Button>
            <Button variant="outline" className="gap-2 flex-1" disabled={importing} onClick={() => document.getElementById('import-file')?.click()}><Upload className="h-4 w-4" /> {importing ? 'Importando…' : 'Importar Backup'}</Button>
            <input id="import-file" type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </div>

          {importReport && (
            <div className={`rounded-md border p-3 text-xs space-y-1 ${importReport.ok ? 'border-green-600/40 bg-green-600/10' : 'border-destructive/40 bg-destructive/10'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {importReport.ok
                  ? <><CheckCircle2 className="h-4 w-4 text-green-600" /> Backup restaurado com sucesso</>
                  : <><AlertCircle className="h-4 w-4 text-destructive" /> Restauração concluída com inconsistências</>}
              </div>
              {importReport.label && <p>Backup restaurado: <strong>{importReport.label}</strong></p>}
              {importReport.safetyLabel && <p>Backup de segurança do estado anterior: {importReport.safetyLabel}</p>}
              <p>
                Frentes: {importReport.summary.frentes} · Equipamentos: {importReport.summary.equipamentos} ·
                Localidades: {importReport.summary.localidades} · Manutenções: {importReport.summary.manutencoes}
              </p>
              {importReport.issues.length > 0 && (
                <ul className="list-disc pl-4 space-y-0.5">
                  {importReport.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Info className="h-4 w-4" /> Informações</CardTitle></CardHeader>
        <CardContent className="text-sm grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
          <p><strong>Sistema:</strong> MONIT.CAMPO</p>
          <p><strong>Desenvolvedor:</strong> Rafael Regiolli</p>
          <p><strong>Versão:</strong> 1.2</p>
          <p className="text-muted-foreground text-xs mt-2">Os dados são salvos automaticamente no navegador após cada modificação.</p>
          <p className="text-muted-foreground text-xs mt-3 border-t pt-2">
            Software de uso privado. Sua distribuição, compartilhamento ou comercialização sem autorização expressa é vedada.
          </p>
          </div>

          {/* UNIDADE */}
          <div className="sm:justify-self-end sm:text-right space-y-2 rounded-md border border-border/70 bg-muted/30 p-3 min-w-[220px]">
            <Label className="flex items-center gap-2 justify-start text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Unidade
            </Label>
            <Select value={unit.id} onValueChange={setUnit}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-snug text-muted-foreground text-left">
              Cada unidade possui seus próprios dados. Ao trocar, o sistema carrega apenas
              a unidade selecionada — os dados da outra permanecem salvos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SAIR DA CONTA */}
      {onLogout && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <LogOut className="h-4 w-4" /> Sair da conta
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Encerra apenas a sessão atual. Nenhum dado do sistema é apagado.
            </p>
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmLogout(true)}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você voltará para a tela de login. Os dados do sistema continuam salvos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmLogout(false); onLogout?.(); }}>
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
