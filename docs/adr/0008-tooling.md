# 0008. oxlint + Vitest + ESM

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

NestJS 12 se distribuye como ESM y su plantilla oficial usa Vitest y oxlint. El frontend (Vite)
también es ESM y usa Vitest de forma natural.

## Decisión

- Todo el monorepo es ESM (`"type": "module"`, `module: nodenext`).
- Vitest como test runner en todos los paquetes.
- oxlint como linter único en la raíz y Prettier para formato.
- TypeScript 6.0.x: TypeScript 7 todavía no es compatible con `typescript-eslint` ni con el CLI
  de NestJS.

## Consecuencias

- Una sola configuración de lint y un solo runner de tests en todo el repo.
- oxlint es mucho más rápido que ESLint, pero tiene menos reglas que dependan de tipos.

## Alternativas consideradas

- **ESLint + typescript-eslint:** más reglas que dependen de tipos, pero es más lento y la
  configuración tiene más piezas.
- **Jest:** el estándar histórico de NestJS, pero exige configuración extra para ESM.
