# 0004. SQLite + Drizzle ORM

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

Pocos usuarios (inicialmente dos), volumen de datos bajo (miles de ofertas) y despliegue en un
solo servidor. Se busca simplicidad operativa: nada de administrar un servidor de base de datos.

## Decisión

SQLite (better-sqlite3, modo WAL, foreign keys activas) con Drizzle ORM. El esquema se define en
TypeScript (`apps/api/src/database/schema.ts`), las migraciones se generan con `drizzle-kit` y se
aplican automáticamente al arrancar la API.

## Consecuencias

- La base de datos es un archivo en un volumen: respaldar es copiar un archivo.
- Tests de integración con base de datos real en memoria (`:memory:`), rápidos y sin mocks.
- Restricción: **un solo proceso escribe**. API, scheduler y scraping corren en el mismo
  contenedor. Si el scraping se separa a un worker propio, se migra a Postgres (Drizzle lo
  facilita).

## Alternativas consideradas

- **Postgres:** más robusto con varios procesos, pero agrega un servicio que no se necesita aún.
- **Prisma:** buena experiencia de desarrollo, pero más pesado (motor y generación de cliente);
  Drizzle está más cerca de SQL.
- **TypeORM:** integración histórica con NestJS, pero con tipado más débil.
