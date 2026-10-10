/**
 * Estados de una oferta para un usuario. Ver docs/arquitectura.md > "Modelo de datos".
 * Cada transición se registra en el historial; nunca se sobreescribe.
 */
export const JOB_STATUSES = [
  'new',
  'discarded',
  'interested',
  'applied',
  'in_process',
  'offer',
  'accepted',
  'declined',
  'rejected',
  'no_response',
  'withdrawn',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: 'Nueva',
  discarded: 'Descartada',
  interested: 'Interesa',
  applied: 'Postulada',
  in_process: 'En proceso',
  offer: 'Oferta',
  accepted: 'Aceptada',
  declined: 'Declinada',
  rejected: 'Rechazada',
  no_response: 'Sin respuesta',
  withdrawn: 'Retirada',
};

const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  new: ['interested', 'discarded'],
  // Se puede reconsiderar una oferta descartada antes de postular.
  discarded: ['interested'],
  interested: ['applied', 'discarded'],
  applied: ['in_process', 'rejected', 'no_response', 'withdrawn'],
  in_process: ['offer', 'rejected', 'no_response', 'withdrawn'],
  offer: ['accepted', 'declined'],
  // La empresa puede responder después de marcada como sin respuesta.
  no_response: ['in_process', 'rejected'],
  accepted: [],
  declined: [],
  rejected: [],
  withdrawn: [],
};

/** Estados en los que corre el contador para pasar automáticamente a `no_response`. */
export const AWAITING_RESPONSE_STATUSES: readonly JobStatus[] = ['applied', 'in_process'];

export function allowedTransitions(from: JobStatus): readonly JobStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: JobStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
