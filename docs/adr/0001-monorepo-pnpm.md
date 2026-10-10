# 0001. Monorepo con pnpm workspaces

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

El proyecto tiene un backend (NestJS), un frontend (React) y lógica que comparten ambos: estados
de seguimiento, plataformas soportadas, esquemas de respuesta. Además, los adaptadores de cada
portal deben poder testearse sin levantar NestJS.

## Decisión

Un solo repositorio con pnpm workspaces:

- `apps/api`, `apps/web`: aplicaciones desplegables.
- `packages/shared`: tipos, constantes y esquemas zod usados por front y back.
- `packages/sources`: contrato `JobSource` y adaptadores, sin dependencia de NestJS.

Los paquetes internos se compilan a `dist/` con `tsc` y se consumen como dependencias
`workspace:*`.

## Consecuencias

- Un cambio que cruza front y back (ej. un estado nuevo) va en un solo PR y el compilador
  detecta inconsistencias.
- Los paquetes deben compilarse antes que las apps (`pnpm dev` y el CI lo hacen en orden).
- Las imágenes Docker se construyen desde la raíz y usan `pnpm deploy` para empaquetar solo las
  dependencias de producción de la API.

## Alternativas consideradas

- **Repos separados para front y back:** duplica tipos y complica cambios coordinados.
- **Turborepo / Nx:** útiles con muchos paquetes; con cuatro, `pnpm --recursive` basta.
