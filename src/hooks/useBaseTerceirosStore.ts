/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback } from 'react';
import { BaseTerceirosRecord } from '@/types/maintenance';
import { BACKUP_RESTORED_EVENT } from '@/lib/backup';

const STORAGE_KEY = 'base_terceiros_records';
const SYNC_EVENT = 'base_terceiros_records:changed';

function load(): BaseTerceirosRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: BaseTerceirosRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* nunca derruba a aplicação por falha de persistência */
  }
}

/** Notifica todas as instâncias do hook na mesma aba (contador do cabeçalho em tempo real). */
function broadcast() {
  try {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    /* ambiente sem window (SSR) */
  }
}

export function useBaseTerceirosStore() {
  const [items, setItems] = useState<BaseTerceirosRecord[]>(load);

  useEffect(() => { save(items); broadcast(); }, [items]);

  // mantém sincronizado após restauração de backup
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(load());
    };
    window.addEventListener('storage', onStorage);
    const onLocal = () =>
      setItems(prev => {
        const next = load();
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    window.addEventListener(SYNC_EVENT, onLocal);
    window.addEventListener(BACKUP_RESTORED_EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SYNC_EVENT, onLocal);
      window.removeEventListener(BACKUP_RESTORED_EVENT, onLocal);
    };
  }, []);

  const addItem = useCallback((data: Omit<BaseTerceirosRecord, 'id' | 'createdAt'>) => {
    setItems(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateItem = useCallback((id: string, data: Partial<BaseTerceirosRecord>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...data } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const reload = useCallback(() => setItems(load()), []);

  return { items, addItem, updateItem, removeItem, reload };
}
