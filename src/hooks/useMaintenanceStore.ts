/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MaintenanceRecord, NULL_STOP_REASON } from '@/types/maintenance';
import { sanitizeRecord, validateTimes } from '@/lib/maintenanceValidation';
import { downloadBackup, applyBackup, readFileAsText, ImportResult, ExportResult } from '@/lib/backup';

const STORAGE_KEY = 'maintenance_records';

/**
 * Carrega o Histórico de Manutenções — fonte oficial dos registros.
 * Nunca lança: registros corrompidos são saneados ou descartados,
 * de modo que o cronograma sempre consiga reconstruir os dados.
 */
function loadRecords(): MaintenanceRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeRecord).filter((r): r is MaintenanceRecord => r !== null);
  } catch {
    return [];
  }
}

function saveRecords(records: MaintenanceRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* nunca derruba a aplicação por falha de persistência */
  }
}

export interface OperationResult {
  ok: boolean;
  error?: string;
}

export function useMaintenanceStore() {
  const [records, setRecords] = useState<MaintenanceRecord[]>(loadRecords);
  /** Último estado válido conhecido — usado para recuperação automática. */
  const lastValidRef = useRef<MaintenanceRecord[]>(records);

  // Gravação em fila: agrupa alterações rápidas em uma única escrita, sem
  // nunca perder o último estado (grava ao fechar, trocar de aba ou sair).
  useEffect(() => {
    if (!Array.isArray(records)) {
      // proteção contra estado indefinido: restaura o último estado válido
      setRecords(lastValidRef.current);
      return;
    }
    lastValidRef.current = records;

    const flush = () => saveRecords(lastValidRef.current);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const id = setTimeout(flush, 250);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(id);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [records]);

  // Grava o estado pendente caso o aplicativo seja desmontado.
  useEffect(() => () => saveRecords(lastValidRef.current), []);


  const addRecord = useCallback((record: Omit<MaintenanceRecord, 'id' | 'status'>): OperationResult => {
    const check = validateTimes(record.inicioTime, record.fimTime);
    if (!check.ok) return { ok: false, error: check.error };
    const newRecord = sanitizeRecord({
      ...record,
      id: crypto.randomUUID(),
      status: record.fimTime ? 'finalizado' : 'em_manutencao',
    });
    if (!newRecord) {
      return { ok: false, error: 'Data inválida: verifique a data e o horário informados.' };
    }
    setRecords(prev => [...prev, newRecord]);
    return { ok: true };
  }, []);

  /**
   * ADD+ da Linha do Tempo: envia uma parada existente para o Histórico com o
   * tipo de manutenção "NULL" (não definido). Não cria nova ocorrência
   * operacional e nunca duplica a mesma parada.
   */
  const addFromTimeline = useCallback(
    (
      payload: Omit<MaintenanceRecord, 'id' | 'status' | 'stopReason'>
    ): OperationResult & { duplicate?: boolean } => {
      const check = validateTimes(payload.inicioTime, payload.fimTime);
      if (!check.ok) return { ok: false, error: check.error };

      const existing = lastValidRef.current.find(r =>
        payload.sourceEventId && r.sourceEventId
          ? r.sourceEventId === payload.sourceEventId
          : r.frota === payload.frota &&
            r.inicioTime === payload.inicioTime &&
            (r.fimTime ?? '') === (payload.fimTime ?? '') &&
            (r.operacao ?? '') === (payload.operacao ?? '')
      );
      if (existing) {
        return { ok: false, duplicate: true, error: 'Esta parada já foi adicionada ao Histórico.' };
      }

      const newRecord = sanitizeRecord({
        ...payload,
        id: crypto.randomUUID(),
        stopReason: NULL_STOP_REASON,
        origem: 'linha_do_tempo' as const,
      });
      if (!newRecord) {
        return { ok: false, error: 'Data inválida: verifique a data e o horário informados.' };
      }
      setRecords(prev => [...prev, newRecord]);
      return { ok: true };
    },
    []
  );

  const finalizeRecord = useCallback((id: string) => {
    setRecords(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: 'finalizado' as const, fimTime: new Date().toISOString() } : r
      )
    );
  }, []);

  const finalizeRecordAt = useCallback((id: string, fimIso: string): OperationResult => {
    const target = lastValidRef.current.find(r => r.id === id);
    const check = validateTimes(target?.inicioTime ?? null, fimIso);

    if (target && !check.ok) return { ok: false, error: check.error };
    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'finalizado' as const, fimTime: fimIso } : r))
    );
    return { ok: true };
  }, []);

  /**
   * Atualização atômica: valida antes de aplicar.
   * Em caso de erro nenhuma alteração é feita no Histórico.
   */
  const updateRecord = useCallback((id: string, data: Partial<MaintenanceRecord>): OperationResult => {
    const current = lastValidRef.current.find(r => r.id === id);
    if (!current) return { ok: false, error: 'Registro não encontrado no Histórico.' };

    const merged = { ...current, ...data };
    const check = validateTimes(merged.inicioTime, merged.fimTime);
    if (!check.ok) return { ok: false, error: check.error };

    const sanitized = sanitizeRecord(merged);
    if (!sanitized) return { ok: false, error: 'Data inválida: verifique a data e o horário informados.' };

    setRecords(prev => prev.map(r => (r.id === id ? sanitized : r)));
    return { ok: true };
  }, []);

  /**
   * Desfaz a finalização: o mesmo registro volta para "em manutenção",
   * mantendo o início original e removendo a data/hora de término.
   */
  const restoreRecord = useCallback((id: string): OperationResult => {
    const current = lastValidRef.current.find(r => r.id === id);
    if (!current) return { ok: false, error: 'Registro não encontrado no Histórico.' };
    setRecords(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: 'em_manutencao' as const, fimTime: undefined } : r
      )
    );
    return { ok: true };
  }, []);

  const renameFrente = useCallback((oldNome: string, newNome: string) => {
    if (!oldNome || !newNome || oldNome === newNome) return;
    setRecords(prev => prev.map(r => r.frente === oldNome ? { ...r, frente: newNome } : r));
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setRecords(prev => prev.filter(r => r.status === 'em_manutencao'));
  }, []);

  /** Backup completo: exporta todo o estado do sistema (validado antes do download). */
  const exportData = useCallback((): ExportResult => {
    return downloadBackup();
  }, []);

  /** Restauração integral com validação pós-importação. */
  const importData = useCallback(async (file: File): Promise<ImportResult> => {
    try {
      const text = await readFileAsText(file);
      const result = applyBackup(text);
      if (result.restoredKeys.length > 0) {
        setRecords(loadRecords());
      }
      return result;
    } catch {
      return {
        ok: false,
        restoredKeys: [],
        issues: ['Não foi possível ler o arquivo de backup.'],
        summary: { frentes: 0, equipamentos: 0, localidades: 0, manutencoes: 0 },
      };
    }
  }, []);

  const activeRecords = useMemo(() => records.filter(r => r.status === 'em_manutencao'), [records]);
  const historyRecords = useMemo(() => records.filter(r => r.status === 'finalizado'), [records]);

  return { records, activeRecords, historyRecords, addRecord, addFromTimeline, finalizeRecord, finalizeRecordAt, updateRecord, restoreRecord, renameFrente, deleteRecord, clearHistory, exportData, importData };
}
