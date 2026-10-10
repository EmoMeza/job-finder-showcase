# 0009. Sesiones en base de datos con cookie httpOnly (no JWT)

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

La app necesita autenticar a pocos usuarios (inicialmente dos) que acceden desde un navegador a
un único servidor. Frontend y API se sirven desde el mismo origen (nginx). Se necesita poder
cerrar sesión de verdad y cortar el acceso al cambiar una contraseña.

Las dos opciones habituales son **JWT** (token firmado que el servidor valida sin guardar estado)
y **sesiones en el servidor** (token aleatorio que el servidor busca en su almacenamiento).

## Decisión

Sesiones guardadas en la tabla `sessions`:

- Al hacer login se genera un token aleatorio de 256 bits. La cookie lleva el token; la base de
  datos guarda solo su **hash SHA-256**, así que una copia filtrada de la base no sirve para
  suplantar sesiones.
- Cookie `sid` con `HttpOnly` (inaccesible desde JavaScript), `SameSite=Lax` (mitiga CSRF) y
  `Secure` configurable (`SESSION_COOKIE_SECURE`, para cuando haya HTTPS).
- Expiración de 30 días (`SESSION_TTL_DAYS`), **deslizante**: si se usa pasada la mitad de su
  duración, se extiende.
- Un guard global (`AuthGuard`) protege todas las rutas; las abiertas se marcan con `@Public()`.
- Logout borra la sesión; cambiar la contraseña por CLI cierra todas las sesiones del usuario.

Contraseñas hasheadas con **argon2id** (`@node-rs/argon2`), con los parámetros recomendados por
OWASP (19 MiB de memoria, 2 iteraciones). Verificar un email inexistente tarda lo mismo que uno
existente, para no revelar qué emails tienen cuenta.

## Por qué no JWT

| Criterio                        | Sesiones                      | JWT                                                         |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Logout / cambio de contraseña   | Inmediato: se borra la fila   | El token sigue válido hasta expirar, salvo lista negra      |
| Token robado                    | Se revoca                     | Sirve hasta expirar                                         |
| Exposición a XSS                | Cookie httpOnly               | Habitualmente en `localStorage`, legible por scripts        |
| Piezas para hacerlo seguro      | Token aleatorio + tabla       | Access token corto + refresh token + rotación + lista negra |
| Escalar a muchos servidores     | Requiere almacenamiento común | Sin estado                                                  |
| Clientes móviles / APIs de 3ros | Menos natural                 | Natural (`Authorization: Bearer`)                           |

La ventaja principal de JWT, validar sin consultar un almacenamiento central, no aporta con un
solo servidor y SQLite en el mismo proceso (la consulta toma microsegundos). En cambio sus
desventajas sí: para revocar tokens habría que agregar una lista negra o refresh tokens, que
vuelven a introducir estado en el servidor con más piezas que configurar bien.

## Consecuencias

- Una consulta a la base de datos por request (despreciable en este contexto).
- Si la API se escala a varios procesos o servidores, las sesiones deben vivir en un
  almacenamiento compartido (Postgres o Redis).
- Si en el futuro hay app móvil o API pública, se evalúa JWT o tokens de API para esos
  clientes en un ADR nuevo.

## Alternativas consideradas

- **JWT con refresh tokens:** ver tabla; más complejo para el mismo nivel de seguridad.
- **express-session + store SQLite:** resuelve lo mismo, pero agrega dependencias y oculta un
  mecanismo que en este caso son ~80 líneas fáciles de testear.
- **bcrypt:** sigue siendo seguro, pero solo es costoso en CPU (más atacable con GPU) y trunca
  las contraseñas a 72 bytes. Argon2id es la primera recomendación de OWASP.
