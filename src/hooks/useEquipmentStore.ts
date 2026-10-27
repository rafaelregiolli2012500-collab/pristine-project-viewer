/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Equipment, EquipmentType } from '@/types/maintenance';
import { BACKUP_RESTORED_EVENT } from '@/lib/backup';

const STORAGE_KEY = 'equipment_registry';

function load(): Equipment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function save(items: Equipment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* nunca derruba a aplicação por falha de persistência */
  }
}

export function useEquipmentStore() {
  const [equipment, setEquipment] = useState<Equipment[]>(load);
  const skipSave = useRef(false);

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    save(equipment);
  }, [equipment]);

  useEffect(() => {
    const reload = () => { skipSave.current = true; setEquipment(load()); };
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) reload(); };
    window.addEventListener(BACKUP_RESTORED_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BACKUP_RESTORED_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addEquipment = useCallback((item: Omit<Equipment, 'id'>) => {
    setEquipment(prev => [...prev, { ...item, id: crypto.randomUUID() }]);
  }, []);

  const removeEquipment = useCallback((id: string) => {
    setEquipment(prev => prev.filter(e => e.id !== id));
  }, []);

  const renameFrente = useCallback((oldNome: string, newNome: string) => {
    if (!oldNome || !newNome || oldNome === newNome) return;
    setEquipment(prev => prev.map(e => e.frente === oldNome ? { ...e, frente: newNome } : e));
  }, []);

  const getByType = useCallback((type: EquipmentType) => {
    return equipment.filter(e => e.equipmentType === type);
  }, [equipment]);

  const getByFrente = useCallback((frente: string) => {
    return equipment.filter(e => e.frente === frente);
  }, [equipment]);

  const getFrentes = useCallback(() => {
    const frentes = new Set(equipment.filter(e => e.frente).map(e => e.frente!));
    return Array.from(frentes).sort();
  }, [equipment]);

  return { equipment, addEquipment, removeEquipment, renameFrente, getByType, getByFrente, getFrentes };
}
