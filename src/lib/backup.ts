/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 * © Rafael Regiolli de Souza — MONIT.CAMPO
 *
 * Sistema de backup integral.
 *
 * O backup é uma cópia fiel e completa do estado do sistema (todo o armazenamento
 * local do app), garantindo que nenhum dado — cadastros de frentes, fazendas,
 * coordenadores, pipas, CM oficina, equipamentos, manutenções abertas/finalizadas,
 * moagem, trajetos, cronograma, preferências e configurações — seja perdido.
 *
 * Garantias:
 *  - Backup atômico: o arquivo só é entregue depois de gerado E validado.
 *  - Restauração atômica: valida antes, grava depois e faz rollback total em caso
 *    de qualquer inconsistência.
 *  - Backup de segurança automático do estado atual antes de qualquer restauração.
 *  - Compatibilidade com backups de versões anteriores (aliases legados).
 */

import { getActiveUnit, getUnitById, UNITS } from './units';

export const BACKUP_VERSION = 3;
/** Versão do aplicativo — injetada no build; apenas informativa no backup. */
declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = (typeof __APP_VERSION__ === 'string' && __APP_VERSION__) || '1.0.0';
export const APP_NAME = 'MONIT.CAMPO';

/** Evento disparado após restaurar um backup — as abas recarregam do localStorage. */
export const BACKUP_RESTORED_EVENT = 'backup:restored';

/** Chaves que nunca devem ir para o backup (estado efêmero de sessão). */
const VOLATILE_KEYS = new Set([
  'edit_lock',
  'edit_lock_force',
  // Identidade técnica do computador: pertence à máquina, não aos dados.
  // Restaurar um backup NUNCA pode substituir nem duplicar a identidade da
  // instalação em outro computador.
  'monit_installation_id',
]);

/**
 * Chaves de autenticação (pasta CHAVE): instalação, cofre de autorização e
 * sessão. Nunca são exportadas nem removidas/substituídas na restauração —
 * importar um backup jamais desloga o usuário.
 */
const AUTH_PREFIX = 'monit.campo/CHAVE';

/** Verdadeiro para chaves que não pertencem aos dados operacionais. */
function isProtectedKey(key: string): boolean {
  return VOLATILE_KEYS.has(key) || key.startsWith(AUTH_PREFIX);
}

/** Chaves críticas — validadas na exportação e na importação. */
export const CRITICAL_KEYS = ['frente_configs', 'equipment_registry', 'maintenance_records'] as const;

/** Aliases antigos usados em backups gerados por versões anteriores. */
const LEGACY_ALIASES: Record<string, string> = {
  equipment: 'equipment_registry',
  frentes: 'frente_configs',
  password: 'app_password',
  settingsPassword: 'app_settings_password',
};

export interface BackupMeta {
  app: string;
  /** Identificador único do backup */
  id: string;
  /** Nome legível: MONIT.CAMPO_BACKUP_2026-08-18_07-30-00 */
  label: string;
  /** Versão do sistema */
  appVersion: string;
  /** Versão da estrutura dos dados */
  schemaVersion: number;
  date: string;
  time: string;
  createdAt: string;
  /** Quantidade de chaves e soma de tamanhos — checagem de integridade */
  keyCount: number;
  byteLength: number;
  /** Unidade operacional de origem do backup */
  unidadeId: string;
  unidade: string;
}

export interface BackupFile {
  __backup: true;
  version: number;
  exportDate: string;
  meta: BackupMeta;
  /** Snapshot integral: chave -> valor bruto (string) do localStorage */
  storage: Record<string, string>;
  /** Espelho legível dos registros de manutenção (compatibilidade) */
  records?: unknown;
  counts?: Record<string, number>;
}

function safeParse<T>(raw: string | null): T | null {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function countOf(raw: string | null): number {
  const parsed = safeParse<unknown>(raw);
  if (Array.isArray(parsed)) return parsed.length;
  if (parsed && typeof parsed === 'object') return Object.keys(parsed as object).length;
  return raw ? 1 : 0;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function stamp(d: Date) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return { date, time };
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `bkp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Lê todo o armazenamento local relevante. */
export function snapshotStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isProtectedKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value != null) out[key] = value;
  }
  return out;
}

export function buildBackup(): BackupFile {
  const storage = snapshotStorage();
  const counts: Record<string, number> = {};
  Object.keys(storage).forEach(k => { counts[k] = countOf(storage[k] ?? null); });

  const now = new Date();
  const { date, time } = stamp(now);
  const byteLength = Object.entries(storage).reduce((acc, [k, v]) => acc + k.length + v.length, 0);

  return {
    __backup: true,
    version: BACKUP_VERSION,
    exportDate: now.toISOString(),
    meta: {
      app: APP_NAME,
      id: newId(),
      label: `${APP_NAME}_BACKUP_${getActiveUnit().name.replace(/[^\p{L}\p{N}]+/gu, '_')}_${date}_${time}`,
      appVersion: APP_VERSION,
      schemaVersion: BACKUP_VERSION,
      date,
      time,
      createdAt: now.toISOString(),
      keyCount: Object.keys(storage).length,
      byteLength,
      unidadeId: getActiveUnit().id,
      unidade: getActiveUnit().name,
    },
    storage,
    records: safeParse(storage['maintenance_records'] ?? null) ?? [],
    counts,
  };
}

export interface VerifyResult {
  ok: boolean;
  issues: string[];
}

/**
 * Verificação automática do backup gerado: compara o conteúdo serializado com o
 * estado atual do armazenamento, chave por chave.
 */
export function verifyBackup(serialized: string): VerifyResult {
  const issues: string[] = [];
  const parsed = safeParse<BackupFile>(serialized);

  if (!parsed || parsed.__backup !== true || !parsed.storage) {
    return { ok: false, issues: ['O arquivo gerado não pôde ser lido de volta como um backup válido.'] };
  }

  const current = snapshotStorage();
  const currentKeys = Object.keys(current);
  const backupKeys = Object.keys(parsed.storage);

  const missing = currentKeys.filter(k => parsed.storage[k] == null);
  if (missing.length > 0) issues.push(`Dados ausentes no backup: ${missing.join(', ')}.`);

  const diverging = currentKeys.filter(k => parsed.storage[k] != null && parsed.storage[k] !== current[k]);
  if (diverging.length > 0) issues.push(`Dados divergentes no backup: ${diverging.join(', ')}.`);

  if (parsed.meta && parsed.meta.keyCount !== backupKeys.length) {
    issues.push('Contagem de chaves do backup inconsistente.');
  }

  CRITICAL_KEYS.forEach(k => {
    if (current[k] != null && countOf(parsed.storage[k] ?? null) !== countOf(current[k])) {
      issues.push(`Quantidade de registros divergente em "${k}".`);
    }
  });

  return { ok: issues.length === 0, issues };
}

export interface ExportResult {
  ok: boolean;
  label: string;
  issues: string[];
  data: BackupFile;
}

function triggerDownload(serialized: string, filename: string) {
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Salva escolhendo a pasta (quando o navegador suporta File System Access API).
 * Retorna false quando não há suporte; true quando o arquivo foi gravado.
 * Lança 'cancelado' quando o usuário fecha o seletor.
 */
async function saveWithPicker(serialized: string, filename: string): Promise<boolean> {
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker !== 'function') return false;
  let handle: any;
  try {
    handle = await picker.call(window, {
      suggestedName: filename,
      types: [{ description: 'Backup MONIT.CAMPO', accept: { 'application/json': ['.json'] } }],
    });
  } catch {
    throw new Error('cancelado');
  }
  const writable = await handle.createWritable();
  await writable.write(new Blob([serialized], { type: 'application/json' }));
  await writable.close();
  return true;
}

/**
 * Gera o backup em memória, valida e só então entrega o arquivo ao usuário.
 * Nunca entrega um arquivo parcial: se a validação falhar, nada é baixado.
 */
export function downloadBackup(prefix = 'MONIT.CAMPO_BACKUP'): ExportResult {
  const data = buildBackup();
  const serialized = JSON.stringify(data, null, 2);

  const verification = verifyBackup(serialized);
  const label = `${prefix}_${data.meta.date}_${data.meta.time}`;

  if (!verification.ok) {
    return { ok: false, label, issues: verification.issues, data };
  }

  triggerDownload(serialized, `${label}.json`);
  return { ok: true, label, issues: [], data };
}

export interface SaveBackupResult extends ExportResult {
  /** true quando o usuário escolheu a pasta de destino */
  choseFolder: boolean;
  /** true quando o usuário cancelou a seleção de pasta */
  canceled?: boolean;
}

/**
 * Exportação com escolha da pasta de destino.
 * Sem suporte do navegador, recai para o download padrão.
 */
export async function saveBackupToFolder(prefix = 'MONIT.CAMPO_BACKUP'): Promise<SaveBackupResult> {
  const data = buildBackup();
  const serialized = JSON.stringify(data, null, 2);
  const verification = verifyBackup(serialized);
  const label = `${prefix}_${data.meta.date}_${data.meta.time}`;

  if (!verification.ok) {
    return { ok: false, label, issues: verification.issues, data, choseFolder: false };
  }

  try {
    const saved = await saveWithPicker(serialized, `${label}.json`);
    if (saved) {
      return { ok: true, label, issues: [], data, choseFolder: true };
    }
  } catch {
    return { ok: false, label, issues: ['Exportação cancelada pelo usuário.'], data, choseFolder: false, canceled: true };
  }

  triggerDownload(serialized, `${label}.json`);
  return { ok: true, label, issues: [], data, choseFolder: false };
}


export interface ImportResult {
  ok: boolean;
  restoredKeys: string[];
  issues: string[];
  summary: { frentes: number; equipamentos: number; localidades: number; manutencoes: number };
  /** Rótulo do backup restaurado, quando disponível */
  label?: string;
  /** Rótulo do backup de segurança gerado antes da restauração */
  safetyLabel?: string;
}

const EMPTY_SUMMARY = { frentes: 0, equipamentos: 0, localidades: 0, manutencoes: 0 };

function fail(issues: string[], extra: Partial<ImportResult> = {}): ImportResult {
  return { ok: false, restoredKeys: [], issues, summary: { ...EMPTY_SUMMARY }, ...extra };
}

/**
 * Normaliza qualquer formato de backup (novo ou legado) para um mapa chave->string.
 */
function normalizeBackup(data: any): Record<string, string> {
  const map: Record<string, string> = {};

  const put = (key: string, value: unknown) => {
    if (value == null) return;
    map[key] = typeof value === 'string' ? value : JSON.stringify(value);
  };

  if (data && typeof data === 'object' && data.storage && typeof data.storage === 'object') {
    Object.entries(data.storage).forEach(([k, v]) => put(k, v));
  }

  // Formato legado: chaves soltas na raiz do JSON
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => {
      if (['storage', '__backup', 'version', 'exportDate', 'counts', 'meta'].includes(k)) return;
      if (k === 'records') { if (map['maintenance_records'] == null) put('maintenance_records', v); return; }
      const target = LEGACY_ALIASES[k] ?? k;
      if (map[target] == null) put(target, v);
    });
  }

  Object.keys(map).forEach(k => { if (isProtectedKey(k)) delete map[k]; });
  return map;
}

/** Restaura integralmente um mapa de chaves, removendo o que não pertence ao backup. */
function writeStorage(map: Record<string, string>) {
  const keep = new Set(Object.keys(map));
  const existing: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) existing.push(k);
  }
  existing.forEach(k => {
    if (!keep.has(k) && !isProtectedKey(k)) localStorage.removeItem(k);
  });
  Object.entries(map).forEach(([k, v]) => localStorage.setItem(k, v));
}

/**
 * Aplica o backup de forma atômica:
 *  1. valida a estrutura do arquivo;
 *  2. gera um backup de segurança do estado atual (arquivo baixado);
 *  3. grava os dados;
 *  4. valida o resultado — qualquer divergência dispara rollback total.
 */
export function applyBackup(raw: string, options: { safetyBackup?: boolean } = {}): ImportResult {
  const issues: string[] = [];
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail(['Arquivo inválido: não foi possível ler o conteúdo JSON do backup. Nenhum dado foi alterado.']);
  }

  // ---- VALIDAÇÃO DE UNIDADE (antes de qualquer alteração nos dados) ----
  const atual = getActiveUnit();
  const backupUnitId: string | undefined = data?.meta?.unidadeId ?? data?.unidadeId;
  const backupUnitNome: string | undefined =
    data?.meta?.unidade ?? (backupUnitId ? getUnitById(backupUnitId).name : undefined);
  // Backups antigos (sem identificação) pertencem à unidade base — Vale do Paraná.
  const resolvedUnitId = backupUnitId && UNITS.some(u => u.id === backupUnitId) ? backupUnitId : (backupUnitId ? backupUnitId : UNITS[0]!.id);
  if (resolvedUnitId !== atual.id) {
    return fail([
      'BACKUP INCOMPATÍVEL.',
      `Este backup pertence à unidade: ${backupUnitNome ?? resolvedUnitId}.`,
      `Unidade atualmente selecionada: ${atual.name}.`,
      'O backup não pode ser restaurado nesta unidade. Nenhum dado foi alterado.',
    ]);
  }

  const map = normalizeBackup(data);
  if (Object.keys(map).length === 0) {
    return fail(['O arquivo não contém dados de backup reconhecíveis. Nenhum dado foi alterado.']);
  }

  // Pré-validação: as chaves presentes precisam ser JSON íntegro
  const corrupted = Object.entries(map).filter(([, v]) => {
    const trimmed = v.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false; // valores simples são válidos
    return safeParse(v) === null;
  }).map(([k]) => k);
  if (corrupted.length > 0) {
    return fail([`Backup corrompido em: ${corrupted.join(', ')}. Nenhum dado foi alterado.`]);
  }

  const label: string | undefined = data?.meta?.label ?? undefined;

  // Snapshot de segurança para rollback + arquivo de segurança
  const rollback = snapshotStorage();
  let safetyLabel: string | undefined;
  if (options.safetyBackup !== false) {
    try {
      const safety = downloadBackup('MONIT.CAMPO_BACKUP_SEGURANCA');
      if (safety.ok) safetyLabel = safety.label;
      else issues.push('Não foi possível gerar o backup de segurança do estado atual.');
    } catch {
      issues.push('Não foi possível gerar o backup de segurança do estado atual.');
    }
  }

  const restoreRollback = () => {
    try { writeStorage(rollback); } catch { /* noop */ }
    try { window.dispatchEvent(new CustomEvent(BACKUP_RESTORED_EVENT)); } catch { /* noop */ }
  };

  const restoredKeys: string[] = Object.keys(map);
  try {
    writeStorage(map);
  } catch {
    restoreRollback();
    return fail(
      ['Falha ao gravar os dados restaurados. O estado anterior foi restaurado integralmente.'],
      { safetyLabel, label },
    );
  }

  // ---- VALIDAÇÃO PÓS-IMPORTAÇÃO (fidelidade byte a byte) ----
  const mismatched = Object.entries(map)
    .filter(([k, v]) => localStorage.getItem(k) !== v)
    .map(([k]) => k);
  if (mismatched.length > 0) {
    restoreRollback();
    return fail(
      [`Restauração inconsistente em: ${mismatched.join(', ')}. O estado anterior foi restaurado integralmente.`],
      { safetyLabel, label },
    );
  }

  try {
    window.dispatchEvent(new CustomEvent(BACKUP_RESTORED_EVENT));
  } catch {
    /* ambiente sem window */
  }

  const frentes = safeParse<any[]>(localStorage.getItem('frente_configs')) ?? [];
  const equipamentos = safeParse<any[]>(localStorage.getItem('equipment_registry')) ?? [];
  const manutencoes = safeParse<any[]>(localStorage.getItem('maintenance_records')) ?? [];

  const expectedFrentes = safeParse<any[]>(map['frente_configs'] ?? null);
  const expectedEquip = safeParse<any[]>(map['equipment_registry'] ?? null);
  const expectedRec = safeParse<any[]>(map['maintenance_records'] ?? null);

  if (map['frente_configs'] == null) {
    issues.push('O backup não continha a Tabela de Frentes de Colheita.');
  } else if (!Array.isArray(frentes) || (Array.isArray(expectedFrentes) && frentes.length !== expectedFrentes.length)) {
    issues.push('Frentes de colheita: quantidade restaurada diferente da esperada.');
  }

  if (map['equipment_registry'] == null) {
    issues.push('O backup não continha o cadastro de equipamentos.');
  } else if (Array.isArray(expectedEquip) && equipamentos.length !== expectedEquip.length) {
    issues.push('Equipamentos: quantidade restaurada diferente da esperada.');
  }

  if (Array.isArray(expectedRec) && manutencoes.length !== expectedRec.length) {
    issues.push('Histórico de manutenções: quantidade restaurada diferente da esperada.');
  }

  // Integridade das manutenções: status, datas e horários preservados
  if (Array.isArray(expectedRec)) {
    const byId = new Map(manutencoes.map((r: any) => [r?.id, r]));
    const divergentes = expectedRec.filter((e: any) => {
      const atual = byId.get(e?.id);
      if (!atual) return true;
      return atual.status !== e.status || atual.inicioTime !== e.inicioTime || atual.fimTime !== e.fimTime;
    });
    if (divergentes.length > 0) {
      issues.push(`${divergentes.length} manutenção(ões) não foram restauradas exatamente como no backup.`);
    }
  }

  // Vínculos frente <-> equipamento
  const nomesFrentes = new Set(frentes.map((f: any) => f?.nome).filter(Boolean));
  const orfaos = equipamentos.filter((e: any) => e?.frente && !nomesFrentes.has(e.frente));
  if (orfaos.length > 0) {
    issues.push(`${orfaos.length} equipamento(s) referenciam frentes que não existem no backup.`);
  }

  const localidades = frentes.filter((f: any) => (f?.fazenda ?? f?.localidade ?? '').toString().trim() !== '').length;
  const expectedLocalidades = Array.isArray(expectedFrentes)
    ? expectedFrentes.filter((f: any) => (f?.fazenda ?? f?.localidade ?? '').toString().trim() !== '').length
    : localidades;
  if (localidades !== expectedLocalidades) {
    issues.push('Localidades: nem todas as fazendas vinculadas às frentes foram restauradas.');
  }

  return {
    ok: issues.length === 0,
    restoredKeys,
    issues,
    label,
    safetyLabel,
    summary: {
      frentes: frentes.length,
      equipamentos: equipamentos.length,
      localidades,
      manutencoes: manutencoes.length,
    },
  };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}
