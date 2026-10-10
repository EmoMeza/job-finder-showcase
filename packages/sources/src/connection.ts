import type { ConnectionKind, SourceId } from '@job-finder/shared';
import type { BrowserContext } from 'playwright';

/** Lo que cada portal declara para que el usuario conecte su cuenta. */
export interface PortalConnection {
  source: SourceId;
  kind: ConnectionKind;
  /** Página del portal donde el usuario inicia sesión o pide su enlace mágico. */
  loginUrl: string;
  /** Lanza `InvalidMagicLinkError` si el enlace no es de este portal. No abre nada. */
  assertMagicLink(link: string): void;
  /**
   * Abre el enlace mágico en `context` y deja la sesión iniciada. El contexto queda con las
   * cookies del portal; quien llama decide si las guarda.
   */
  openMagicLink(context: BrowserContext, link: string): Promise<void>;
  /** ¿La sesión cargada en `context` sigue iniciada? Solo abre páginas. */
  isLoggedIn(context: BrowserContext): Promise<boolean>;
}

/** El enlace no es del portal o no tiene la forma esperada: no se abre. */
export class InvalidMagicLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMagicLinkError';
  }
}
