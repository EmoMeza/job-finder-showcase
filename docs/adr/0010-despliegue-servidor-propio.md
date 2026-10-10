# 0010. Despliegue en servidor propio detrás de reverse proxy HTTPS

- **Estado:** Aceptada
- **Fecha:** 2026-10-09
- **Reemplaza a:** [0007](./0007-acceso-vpn.md)

## Contexto

El ADR 0007 definía el acceso solo por VPN (Tailscale). En la práctica, exigir Tailscale en cada
dispositivo de los usuarios es una fricción innecesaria, y el servidor donde se despliega ya
cuenta con un reverse proxy que termina HTTPS para otros servicios.

Servir la app desde internet cambia el modelo de amenazas: la app guarda CVs, perfiles y API
keys, y el login queda expuesto a cualquiera.

## Decisión

La app se publica a través del reverse proxy HTTPS existente en el servidor:

```
Internet ──HTTPS──► reverse proxy del servidor ──HTTP──► 127.0.0.1:8080 (web: nginx) ──► api
```

- docker compose publica la web solo en `127.0.0.1` (`BIND_ADDRESS`); el reverse proxy es la
  única entrada desde internet.
- **HTTPS obligatorio**, terminado en el reverse proxy, que también pone HSTS.
- **Cookie de sesión `Secure`** por defecto cuando `NODE_ENV=production`.
- **`trust proxy`** en la API solo para direcciones privadas (loopback, link-local, redes
  privadas de Docker): la API obtiene la IP real del cliente desde `X-Forwarded-For` y un
  cliente no puede falsificarla agregando esa cabecera.
- **Límite de intentos en el login**: 5 por minuto por IP (`@nestjs/throttler`), 429 al exceder.
- **Cabeceras de seguridad**: `helmet` en la API; en el nginx de la web, `Content-Security-Policy`
  restrictiva, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy` y
  `Permissions-Policy`.
- El nginx de la web respeta el `X-Forwarded-Proto` del reverse proxy en vez de reemplazarlo.

## Consecuencias

- Acceso desde cualquier dispositivo sin instalar nada.
- Mayor superficie de ataque: la seguridad depende del login, del límite de intentos y de
  mantener las dependencias al día (Dependabot + CI).
- El límite de intentos se guarda en memoria: se reinicia con la API y no se comparte entre
  procesos (suficiente con un solo proceso, ver ADR 0004).
- Para probar en local por HTTP con `NODE_ENV=production` (docker compose), los navegadores
  aceptan cookies `Secure` en `localhost`; en otro host sin HTTPS hay que usar
  `SESSION_COOKIE_SECURE=false`.

## Alternativas consideradas

- **Mantener VPN (ADR 0007):** más seguro, pero exige Tailscale en cada dispositivo.
- **Exponer el puerto de la app directamente con su propio TLS:** duplica la gestión de
  certificados que ya resuelve el reverse proxy existente.
- **Autenticación en el reverse proxy (basic auth, SSO):** agrega una segunda capa, pero
  duplica el login; se puede sumar más adelante sin cambios en la app.
