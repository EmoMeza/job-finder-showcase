/** La sesión guardada ya no sirve: el usuario tiene que volver a conectar el portal. */
export class SessionExpiredError extends Error {
  constructor(message = 'La sesión del portal venció') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/** El portal respondió algo que el adaptador no reconoce: probablemente cambió el sitio. */
export class PortalChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalChangedError';
  }
}
