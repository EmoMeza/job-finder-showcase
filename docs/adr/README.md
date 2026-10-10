# Decisiones de arquitectura (ADR)

Cada decisión relevante de arquitectura o stack queda registrada como un ADR corto: contexto,
decisión, consecuencias y alternativas consideradas. Los ADRs no se editan una vez aceptados;
si una decisión cambia, se escribe un ADR nuevo que reemplaza al anterior.

| #                                                 | Decisión                                             | Estado               |
| ------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| [0001](./0001-monorepo-pnpm.md)                   | Monorepo con pnpm workspaces                         | Aceptada             |
| [0002](./0002-nestjs-backend.md)                  | NestJS como backend                                  | Aceptada             |
| [0003](./0003-react-frontend.md)                  | React + Vite como frontend                           | Aceptada             |
| [0004](./0004-sqlite-drizzle.md)                  | SQLite + Drizzle ORM                                 | Aceptada             |
| [0005](./0005-adaptadores-scraping.md)            | Un adaptador por portal, scraping con Playwright     | Aceptada             |
| [0006](./0006-proveedores-ia.md)                  | Proveedor de IA intercambiable por usuario           | Aceptada             |
| [0007](./0007-acceso-vpn.md)                      | Acceso solo por VPN (Tailscale)                      | Reemplazada por 0010 |
| [0008](./0008-tooling.md)                         | oxlint + Vitest + ESM                                | Aceptada             |
| [0009](./0009-sesiones-no-jwt.md)                 | Sesiones en base de datos (no JWT)                   | Aceptada             |
| [0010](./0010-despliegue-servidor-propio.md)      | Servidor propio detrás de reverse proxy HTTPS        | Aceptada             |
| [0011](./0011-perfil-estructurado-desde-el-cv.md) | Perfil estructurado extraído del CV                  | Aceptada             |
| [0012](./0012-conexion-de-cuentas-de-portales.md) | Conexión de cuentas de portales con sesión capturada | Aceptada             |
| [0013](./0013-leer-sin-dejar-huella.md)           | Leer los portales sin dejar huella en la cuenta      | Aceptada             |

Plantilla: copiar [0000-plantilla.md](./0000-plantilla.md).
