/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { FrenteConfig, frenteNome } from '@/types/maintenance';
import { BACKUP_RESTORED_EVENT } from '@/lib/backup';

const STORAGE_KEY = 'frente_configs';

function makeDefault(id: string, numero: string): FrenteConfig {
  return { id, numero, nome: frenteNome(numero), fazenda: '', localidade: '' };
}

const DEFAULT_FRENTES: FrenteConfig[] = ['23', '24', '25', '26', '27', '28', '29', '30'].map((n, i) =>
  makeDefault(String(i + 1), n)
);

/**
 * Normaliza registros antigos ("F-23", sem Fazenda) para a estrutura atual
 * sem perder nenhum dado já cadastrado.
 */
function migrate(items: FrenteConfig[]): FrenteConfig[] {
  return items.map(f => {
    const numero = (f.numero ?? (f.nome ?? '').replace(/\D+/g, '')).trim();
    const fazenda = f.fazenda ?? f.localidade ?? '';
    return {
      ...f,
      numero,
      nome: numero ? frenteNome(numero) : f.nome,
      fazenda,
      localidade: fazenda,
    };
  });
}

function load(): FrenteConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : null;
    return Array.isArray(parsed) ? migrate(parsed) : DEFAULT_FRENTES;
  } catch {
    return DEFAULT_FRENTES;
  }
}

function save(items: FrenteConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* nunca derruba a aplicação por falha de persistência */
  }
}

export function useFrenteStore() {
  const [frentes, setFrentes] = useState<FrenteConfig[]>(load);
  /** Evita regravar por cima dos dados recém-restaurados de um backup. */
  const skipSave = useRef(false);

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    save(frentes);
  }, [frentes]);

  // Recarrega a tabela de frentes/localidades após importar um backup
  useEffect(() => {
    const reload = () => { skipSave.current = true; setFrentes(load()); };
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) reload(); };
    window.addEventListener(BACKUP_RESTORED_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BACKUP_RESTORED_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addFrente = useCallback((numero: string, fazenda: string) => {
    const num = numero.trim();
    if (!num) return;
    setFrentes(prev => [
      ...prev,
      { id: crypto.randomUUID(), numero: num, nome: frenteNome(num), fazenda, localidade: fazenda },
    ]);
  }, []);

  const removeFrente = useCallback((id: string) => {
    setFrentes(prev => prev.filter(f => f.id !== id));
  }, []);

  /** Edição pelo lápis: altera o cadastro existente, sem duplicar registros. */
  const updateIdentidade = useCallback((id: string, numero: string, fazenda: string) => {
    const num = numero.trim();
    setFrentes(prev => prev.map(f => f.id === id
      ? { ...f, numero: num, nome: num ? frenteNome(num) : f.nome, fazenda, localidade: fazenda }
      : f));
  }, []);

  const updateFazenda = useCallback((id: string, fazenda: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, fazenda, localidade: fazenda } : f));
  }, []);

  // Mantido pelo nome antigo por compatibilidade com o restante do sistema
  const updateLocalidade = updateFazenda;

  const updateLider = useCallback((id: string, lider: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, lider } : f));
  }, []);

  const updateKmh = useCallback((id: string, kmh: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, kmh } : f));
  }, []);

  const updatePipa = useCallback((id: string, pipa: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, pipa } : f));
  }, []);

  const updateCmOficina = useCallback((id: string, cmOficina: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, cmOficina } : f));
  }, []);

  const updateTrajeto = useCallback((id: string, trajeto: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, trajeto } : f));
  }, []);

  const updateNotas = useCallback((id: string, notas: string) => {
    setFrentes(prev => prev.map(f => f.id === id ? { ...f, notas } : f));
  }, []);

  return {
    frentes,
    addFrente,
    removeFrente,
    updateIdentidade,
    updateFazenda,
    updateLocalidade,
    updateLider,
    updateKmh,
    updatePipa,
    updateCmOficina,
    updateTrajeto,
    updateNotas,
  };
}
