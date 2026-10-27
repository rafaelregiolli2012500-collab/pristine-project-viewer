/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
export type EquipmentType = 'colhedora' | 'trator' | 'transbordo' | 'caminhao';

export type StopReason =
  | 'manutencao'
  | 'lubrificacao'
  | 'troca_faquinhas'
  | 'programada'
  | 'sem_operador'
  | 'lavagem'
  | 'standby'
  | 'solinfitec'
  | 'combustivel'
  | 'abastecimento'
  | 'refeicao'
  | 'climatico'
  | 'prancha'
  | 'calibracao'
  | 'borracheiro'
  | 'parada_trajeto'
  | 'qru_trajeto'
  | 'aguard_oficina'
  | 'oportunidade'
  | 'terceiro'
  | 'usina_parada'
  | 'troca_turno';

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  manutencao: 'Manutenção',
  lubrificacao: 'Lubrificação',
  troca_faquinhas: 'Troca de Faquinhas',
  programada: 'Manutenção Programada',
  sem_operador: 'Falta de Operador',
  lavagem: 'Lavagem / Limpeza',
  standby: 'Stand-By',
  solinfitec: 'Solinfitec / GPS',
  combustivel: 'Falta de Combustível',
  abastecimento: 'Abastecimento',
  refeicao: 'Refeição',
  climatico: 'Climático',
  prancha: 'Prancha',
  calibracao: 'Calibração CICB',
  borracheiro: 'BORRACHARIA - PONTO',
  parada_trajeto: 'Parada no Trajeto',
  qru_trajeto: 'QRU NO TRAJETO',
  aguard_oficina: 'AG. ENTRADA NA OFICINA',
  oportunidade: 'Manutenção por Oportunidade',
  terceiro: 'Manutenção Terceiro',
  usina_parada: 'USINA PARADA',
  troca_turno: 'Troca de Turno',
};

/** Rótulos curtos usados na legenda do cronograma (economia de espaço). */
export const STOP_REASON_SHORT_LABELS: Partial<Record<StopReason, string>> = {
  aguard_oficina: 'AG. OFIC.',
};

export const STOP_REASON_COLORS: Record<StopReason, string> = {
  manutencao: 'hsl(210, 95%, 42%)',
  lubrificacao: '#8B5E34',
  troca_faquinhas: 'hsl(200, 70%, 55%)',
  programada: 'hsl(0, 75%, 50%)',
  sem_operador: 'hsl(270, 60%, 50%)',
  lavagem: 'hsl(30, 90%, 50%)',
  standby: 'hsl(50, 95%, 50%)',
  solinfitec: '#DE35EB',
  combustivel: 'hsl(0, 0%, 15%)',
  abastecimento: '#0E4A5C',
  refeicao: 'hsl(200, 80%, 75%)',
  climatico: 'hsl(220, 70%, 35%)',
  prancha: 'hsl(0, 0%, 55%)',
  calibracao: 'hsl(0, 0%, 92%)',
  borracheiro: 'hsl(160, 60%, 45%)',
  parada_trajeto: '#043710',
  qru_trajeto: '#7B1E28',
  aguard_oficina: '#B45309',
  oportunidade: 'hsl(200, 70%, 55%)',
  terceiro: 'hsl(200, 70%, 55%)',
  usina_parada: '#5C0A14',
  troca_turno: '#FFE5B4',
};

export const STOP_REASON_CSS: Record<StopReason, string> = {
  manutencao: 'bg-[hsl(210,95%,42%)]',
  lubrificacao: 'bg-[#8B5E34]',
  troca_faquinhas: 'bg-sky-400',
  programada: 'bg-red-600',
  sem_operador: 'bg-purple-600',
  lavagem: 'bg-orange-500',
  standby: 'bg-yellow-400',
  solinfitec: 'bg-pink-500',
  combustivel: 'bg-gray-900',
  abastecimento: 'bg-[#0E4A5C]',
  refeicao: 'bg-sky-200',
  climatico: 'bg-blue-800',
  prancha: 'bg-gray-400',
  calibracao: 'bg-gray-100',
  borracheiro: 'bg-emerald-600',
  parada_trajeto: 'bg-emerald-950',
  qru_trajeto: 'bg-[#7B1E28]',
  aguard_oficina: 'bg-amber-700',
  oportunidade: 'bg-sky-400',
  terceiro: 'bg-sky-400',
  usina_parada: 'bg-[#5C0A14]',
  troca_turno: 'bg-[#FFE5B4]',
};

// Text color for contrast on light backgrounds
export const STOP_REASON_TEXT: Record<StopReason, string> = {
  manutencao: 'text-white',
  lubrificacao: 'text-white',
  troca_faquinhas: 'text-white',
  programada: 'text-white',
  sem_operador: 'text-white',
  lavagem: 'text-white',
  standby: 'text-gray-900',
  solinfitec: 'text-white',
  combustivel: 'text-white',
  abastecimento: 'text-white',
  refeicao: 'text-gray-900',
  climatico: 'text-white',
  prancha: 'text-white',
  calibracao: 'text-gray-900',
  borracheiro: 'text-white',
  parada_trajeto: 'text-white',
  qru_trajeto: 'text-white',
  aguard_oficina: 'text-white',
  oportunidade: 'text-white',
  terceiro: 'text-white',
  usina_parada: 'text-white',
  troca_turno: 'text-black',
};

// Reasons that should NOT be shown for a given equipment type
export const HIDDEN_REASONS_BY_TYPE: Record<string, StopReason[]> = {
  caminhao: ['prancha', 'calibracao', 'oportunidade', 'terceiro', 'lubrificacao'],
  colhedora: ['parada_trajeto', 'qru_trajeto', 'aguard_oficina'],
  trator: ['parada_trajeto', 'qru_trajeto', 'aguard_oficina', 'lubrificacao'],
  transbordo: ['parada_trajeto', 'qru_trajeto', 'aguard_oficina', 'oportunidade', 'terceiro', 'lubrificacao'],
};

export function reasonsForType(type: string): StopReason[] {
  const hidden = HIDDEN_REASONS_BY_TYPE[type] || [];
  return (Object.keys(STOP_REASON_LABELS) as StopReason[]).filter(r => !hidden.includes(r));
}

/* ===== Base e Terceiros ===== */
export type BaseLocal = 'base' | 'terceiros';
export type BaseStatus = 'aguardando' | 'em_manutencao' | 'aguardando_peca' | 'liberado';

export const BASE_STATUS_LABELS: Record<BaseStatus, string> = {
  aguardando: 'Aguardando Entrada',
  em_manutencao: 'Em Manutenção',
  aguardando_peca: 'Aguardando Peça',
  liberado: 'Liberado',
};

export interface BaseTerceirosRecord {
  id: string;
  frota: string;
  equipmentType: EquipmentType;
  local: BaseLocal;
  motivo: string;
  dataEntrada: string; // yyyy-mm-dd
  horaEntrada: string; // HH:mm
  previsaoLiberacao?: string;
  observacoes?: string;
  status: BaseStatus;
  createdAt: string;
}


/** Tipo de manutenção ainda não definido (registros vindos da Linha do Tempo). */
export const NULL_STOP_REASON = 'NULL' as const;
export type NullStopReason = typeof NULL_STOP_REASON;
/** Tipo de manutenção do registro: um motivo oficial ou "NULL" (não definido). */
export type RecordStopReason = StopReason | NullStopReason;

export function isNullStopReason(v: unknown): v is NullStopReason {
  return v === NULL_STOP_REASON;
}

export interface MaintenanceRecord {
  id: string;
  frente: string;
  frota: string;
  equipmentType: EquipmentType;
  motivo: string;
  stopReason: RecordStopReason;
  inicioTime: string;
  fimTime?: string;
  status: 'em_manutencao' | 'finalizado';
  /* ===== Dados preservados de paradas importadas da Linha do Tempo ===== */
  operador?: string;
  operacao?: string;
  estado?: string;
  estadoOp?: string;
  /** Origem do registro: 'linha_do_tempo' quando adicionado via ADD+. */
  origem?: 'linha_do_tempo';
  /** ID original do evento na Linha do Tempo (prevenção de duplicidade). */
  sourceEventId?: string;
}

export interface Equipment {
  id: string;
  frota: string;
  equipmentType: EquipmentType;
  frente?: string;
  descricao?: string;
}

export interface FrenteConfig {
  id: string;
  /** Nome canônico da frente — sempre "FRENTE X" (usado na Descrição da manutenção). */
  nome: string;
  /** Número da frente informado no cadastro (ex.: "22", "08"). */
  numero?: string;
  /** Fazenda vinculada à frente. */
  fazenda?: string;
  /** Mantido por compatibilidade: espelha a Fazenda. */
  localidade: string;
  /** Coordenador da frente (campo interno histórico: "lider"). */
  lider?: string;
  kmh?: string;
  pipa?: string;
  cmOficina?: string;
  trajeto?: string;
  notas?: string;
}

/** Nome canônico da frente a partir do número: 22 -> "FRENTE 22". */
export function frenteNome(numero: string): string {
  return `FRENTE ${String(numero ?? '').trim()}`.trim();
}

/** Identificação completa: "FRENTE 22 — SANTA MARIA". */
export function frenteLabel(f: Pick<FrenteConfig, 'nome' | 'fazenda' | 'localidade'>): string {
  const fazenda = (f.fazenda ?? f.localidade ?? '').trim();
  return fazenda ? `${f.nome} — ${fazenda}` : f.nome;
}

/**
 * Normaliza a frente de uma ocorrência para o nome canônico do Cadastro:
 * "23", "F-23", "F23", "Frente 23" -> "FRENTE 23". Outros textos são mantidos.
 */
export function normalizeFrenteNome(frente: string | undefined | null): string {
  const s = String(frente ?? '').trim();
  const m = s.match(/^(?:frente|f)?\s*[-_.]?\s*0*(\d+)$/i);
  return m ? frenteNome(String(Number(m[1]))) : s;
}
