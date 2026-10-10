import { z } from 'zod';
import type { SourceId } from './sources.js';

/** Cómo se conecta la cuenta de un portal. Depende de lo que ofrezca cada uno (ver ADR 0012). */
export const CONNECTION_KINDS = ['magic-link', 'password', 'remote-browser'] as const;

export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

export const PORTAL_STATUSES = ['disconnected', 'connected', 'expired'] as const;

export type PortalStatus = (typeof PORTAL_STATUSES)[number];

export const PORTAL_STATUS_LABELS: Record<PortalStatus, string> = {
  disconnected: 'Sin conectar',
  connected: 'Conectado',
  expired: 'Reconectar',
};

/** Estado de un portal para el usuario. La sesión guardada nunca sale de la API. */
export interface PortalAccount {
  source: SourceId;
  name: string;
  /** `false` mientras el portal no esté implementado. */
  available: boolean;
  connectionKind: ConnectionKind | null;
  /** Dónde pide el usuario su enlace mágico (se abre en otra pestaña). */
  loginUrl: string | null;
  enabled: boolean;
  status: PortalStatus;
  connectedAt: string | null;
  checkedAt: string | null;
}

export const updatePortalSchema = z.object({ enabled: z.boolean() });

export type UpdatePortalRequest = z.infer<typeof updatePortalSchema>;

/** El enlace mágico es una credencial de un solo uso: no se guarda ni se registra. */
export const connectWithMagicLinkSchema = z.object({
  link: z.string().trim().min(1, 'Pega el enlace que te llegó al correo').max(2000),
});

export type ConnectWithMagicLinkRequest = z.infer<typeof connectWithMagicLinkSchema>;
