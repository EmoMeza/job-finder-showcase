import { describe, expect, it } from 'vitest';
import { JOB_STATUSES, allowedTransitions, canTransition, isFinalStatus } from './tracking.js';

describe('tracking', () => {
  it('sigue el camino feliz de una postulación', () => {
    const path = ['new', 'interested', 'applied', 'in_process', 'offer', 'accepted'] as const;
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
    }
  });

  it('no permite postular sin haber marcado interés', () => {
    expect(canTransition('new', 'applied')).toBe(false);
  });

  it('permite que una postulación sin respuesta vuelva a estar en proceso', () => {
    expect(canTransition('no_response', 'in_process')).toBe(true);
  });

  it('los estados finales no tienen salida', () => {
    const finals = JOB_STATUSES.filter(isFinalStatus);
    expect(finals).toEqual(['accepted', 'declined', 'rejected', 'withdrawn']);
  });

  it('ningún estado transiciona a sí mismo', () => {
    for (const status of JOB_STATUSES) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });
});
