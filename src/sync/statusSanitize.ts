import {DEFAULT_STATUS} from '../types';

/** Canonical Lead Control status catalog (write-side). */
export const LEAD_STATUS_CATALOG = [
  'Aguardando contato',
  'Contato com problema',
  'Sem retorno',
  'Em conversa com lead',
  'Declinou',
  'Agendamento realizado',
  'Não compareceu',
  'Compareceu, em avaliação',
  'Compareceu, orçamento',
  'Compareceu, devolução',
  'Compareceu, vendido',
  'Acompanhamento',
  'Arquivo',
] as const;

const LEAD_STATUS_SET = new Set<string>(LEAD_STATUS_CATALOG);

export interface StatusSanitizeResult {
  statusLead: string;
  usedDefault: boolean;
  original?: string;
}

/**
 * Keep only canonical statuses; unknown values fall back to DEFAULT_STATUS.
 */
export function sanitizeStatusLead(value: unknown): StatusSanitizeResult {
  const candidate = String(value ?? '').trim();
  if (!candidate) {
    return {statusLead: DEFAULT_STATUS, usedDefault: true};
  }
  if (LEAD_STATUS_SET.has(candidate)) {
    return {statusLead: candidate, usedDefault: false};
  }
  return {
    statusLead: DEFAULT_STATUS,
    usedDefault: true,
    original: candidate,
  };
}
