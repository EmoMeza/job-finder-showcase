# 0007. Acceso solo por VPN (Tailscale)

- **Estado:** Reemplazada por [0010](./0010-despliegue-servidor-propio.md)
- **Fecha:** 2026-10-09

## Contexto

La app guarda CVs, perfiles profesionales y API keys, y corre en un servidor propio. Sus
usuarios son pocos y conocidos.

## Decisión

No exponer ningún puerto a internet. docker compose publica la web solo en `BIND_ADDRESS`
(por defecto `127.0.0.1`); en el servidor se usa la IP de Tailscale, y los dispositivos de los
usuarios se unen a la misma tailnet. El login de la app se mantiene como segunda capa.

## Consecuencias

- Superficie de ataque mínima: sin dominio público, sin certificados que administrar.
- Cada usuario necesita Tailscale en sus dispositivos.
- Si en el futuro se quiere acceso público, se necesita un ADR nuevo (reverse proxy con HTTPS,
  rate limiting, endurecer la autenticación).

## Alternativas consideradas

- **Exponer con dominio + HTTPS (Caddy):** más cómodo, pero expone datos personales a internet.
- **WireGuard manual:** mismo resultado que Tailscale con más configuración.
