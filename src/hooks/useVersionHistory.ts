/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useCallback } from 'react';

const HISTORY_KEY = 'version_history';
const MAX_VERSIONS = 50;

export interface VersionEntry {
  id: string;
  timestamp: string;
  label: string;
  data: {
    records: string;
    equipment: string | null;
    frentes: string | null;
    moagem_data: string | null;
    moagem_records: string | null;
  };
}

function loadHistory(): VersionEntry[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: VersionEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_VERSIONS)));
}

export function useVersionHistory() {
  const [versions, setVersions] = useState<VersionEntry[]>(loadHistory);

  const saveVersion = useCallback((label: string) => {
    const entry: VersionEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      label,
      data: {
        records: localStorage.getItem('maintenance_records') || '[]',
        equipment: localStorage.getItem('equipment_registry'),
        frentes: localStorage.getItem('frente_configs'),
        moagem_data: localStorage.getItem('moagem_data'),
        moagem_records: localStorage.getItem('moagem_records'),
      },
    };
    const updated = [entry, ...versions].slice(0, MAX_VERSIONS);
    setVersions(updated);
    saveHistory(updated);
  }, [versions]);

  const restoreVersion = useCallback((id: string) => {
    const version = versions.find(v => v.id === id);
    if (!version) return false;
    localStorage.setItem('maintenance_records', version.data.records);
    if (version.data.equipment) localStorage.setItem('equipment_registry', version.data.equipment);
    if (version.data.frentes) localStorage.setItem('frente_configs', version.data.frentes);
    if (version.data.moagem_data) localStorage.setItem('moagem_data', version.data.moagem_data);
    if (version.data.moagem_records) localStorage.setItem('moagem_records', version.data.moagem_records);
    window.location.reload();
    return true;
  }, [versions]);

  const deleteVersion = useCallback((id: string) => {
    const updated = versions.filter(v => v.id !== id);
    setVersions(updated);
    saveHistory(updated);
  }, [versions]);

  const clearVersions = useCallback(() => {
    setVersions([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return { versions, saveVersion, restoreVersion, deleteVersion, clearVersions };
}
