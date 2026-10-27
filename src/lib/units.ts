/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * UNIDADES OPERACIONAIS
 *
 * Cada unidade é um ambiente operacional independente: possui seus próprios
 * cadastros, manutenções, histórico, moagem, cronograma, trajetos e
 * configurações. O isolamento é feito escopando TODO o armazenamento local
 * da aplicação por unidade.
 *
 * - Vale do Paraná  → chaves sem prefixo (mantém todos os dados já existentes).
 * - Demais unidades → chaves prefixadas com `unit:<id>:`.
 *
 * A unidade ativa é a única carregada na memória: ao trocar de unidade o
 * sistema persiste o estado atual, descarrega a memória e recarrega o app
 * apenas com os dados da nova unidade (os dados da anterior permanecem
 * salvos e protegidos).
 */

export type UnitTimeMode = 'turno' | 'horario';

export interface UnitDef {
  id: string;
  name: string;
  /** 'turno' = filtros por Turno A/B/C · 'horario' = Horário Inicial/Final */
  timeMode: UnitTimeMode;
  /** Prefixo das chaves de armazenamento desta unidade ('' = base legada). */
  prefix: string;
}

export const UNITS: UnitDef[] = [
  { id: 'vale_parana', name: 'Vale do Paraná', timeMode: 'turno', prefix: '' },
  { id: 'nova_londrina', name: 'Nova Londrina - PR', timeMode: 'horario', prefix: 'unit:nova_londrina:' },
];

export const DEFAULT_UNIT_ID = 'vale_parana';

/** Chave global (não escopada) que guarda a unidade selecionada. */
const ACTIVE_UNIT_KEY = 'active_unit';

/** Chaves que nunca são escopadas por unidade (estado de sessão/global). */
const GLOBAL_KEYS = new Set([
  ACTIVE_UNIT_KEY,
  'edit_lock',
  'edit_lock_force',
  // Identificador técnico da instalação: único por computador, nunca por unidade.
  'monit_installation_id',
]);

/** Prefixo genérico usado por unidades escopadas. */
const UNIT_PREFIX = 'unit:';

export function getUnitById(id: string | null | undefined): UnitDef {
  return UNITS.find(u => u.id === id) ?? UNITS[0]!;
}

let activeUnitId: string = DEFAULT_UNIT_ID;

/** Unidade ativa (id). */
export function getActiveUnitId(): string {
  return activeUnitId;
}

/** Unidade ativa (definição completa). */
export function getActiveUnit(): UnitDef {
  return getUnitById(activeUnitId);
}

export function isHourMode(): boolean {
  return getActiveUnit().timeMode === 'horario';
}

/* ------------------------------------------------------------------ */
/* Escopo de armazenamento                                             */
/* ------------------------------------------------------------------ */

let installed = false;

/**
 * Instala o escopo de armazenamento por unidade.
 * Deve rodar ANTES de qualquer módulo da aplicação ler o localStorage.
 */
export function installUnitStorageScope() {
  if (installed || typeof window === 'undefined' || !window.localStorage) return;
  installed = true;

  const proto = Storage.prototype;
  const rawGet = proto.getItem;
  const rawSet = proto.setItem;
  const rawRemove = proto.removeItem;
  const rawKey = proto.key;
  const rawLengthDesc = Object.getOwnPropertyDescriptor(proto, 'length');

  // Lê a unidade persistida com o método original (chave global).
  try {
    const saved = rawGet.call(window.localStorage, ACTIVE_UNIT_KEY);
    if (saved && UNITS.some(u => u.id === saved)) activeUnitId = saved;
  } catch {
    /* noop */
  }

  const isLocal = (s: Storage) => {
    try { return s === window.localStorage; } catch { return false; }
  };

  const scope = (key: string) => {
    if (GLOBAL_KEYS.has(key)) return key;
    return getActiveUnit().prefix + key;
  };

  /** Chaves reais pertencentes à unidade ativa (retorna nome lógico). */
  const ownKeys = (): string[] => {
    const prefix = getActiveUnit().prefix;
    const out: string[] = [];
    const total = rawLengthDesc?.get?.call(window.localStorage) ?? 0;
    for (let i = 0; i < total; i++) {
      const k = rawKey.call(window.localStorage, i);
      if (!k) continue;
      if (GLOBAL_KEYS.has(k)) continue;
      if (prefix) {
        if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
      } else if (!k.startsWith(UNIT_PREFIX)) {
        out.push(k);
      }
    }
    return out;
  };

  proto.getItem = function (key: string) {
    if (!isLocal(this)) return rawGet.call(this, key);
    return rawGet.call(this, scope(key));
  };

  proto.setItem = function (key: string, value: string) {
    if (!isLocal(this)) return rawSet.call(this, key, value);
    return rawSet.call(this, scope(key), value);
  };

  proto.removeItem = function (key: string) {
    if (!isLocal(this)) return rawRemove.call(this, key);
    return rawRemove.call(this, scope(key));
  };

  proto.key = function (index: number) {
    if (!isLocal(this)) return rawKey.call(this, index);
    return ownKeys()[index] ?? null;
  };

  if (rawLengthDesc?.get) {
    Object.defineProperty(proto, 'length', {
      configurable: true,
      get(this: Storage) {
        if (!isLocal(this)) return rawLengthDesc.get!.call(this);
        return ownKeys().length;
      },
    });
  }
}

/**
 * Troca a unidade ativa: persiste o estado atual, descarta a memória ativa e
 * recarrega o ambiente já com os dados da nova unidade.
 */
export function setActiveUnit(id: string) {
  const unit = getUnitById(id);
  if (unit.id === activeUnitId) return;
  try {
    // Persistência garantida antes de descarregar (PERSISTIR → DESCARREGAR → CARREGAR)
    Storage.prototype.setItem.call(window.localStorage, ACTIVE_UNIT_KEY, unit.id);
  } catch {
    /* noop */
  }
  activeUnitId = unit.id;
  try { window.location.reload(); } catch { /* noop */ }
}
