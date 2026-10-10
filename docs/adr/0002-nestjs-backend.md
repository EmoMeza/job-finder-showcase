# 0002. NestJS como backend

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

El backend tiene varios dominios bien separados (auth, perfil, búsquedas, scraping, IA,
seguimiento, estadísticas) y tareas periódicas (búsquedas programadas, marcar postulaciones sin
respuesta). El autor viene de Express y uno de los objetivos del proyecto es ganar experiencia
real con NestJS.

## Decisión

NestJS 12 (ESM) con un módulo por dominio, inyección de dependencias, `@nestjs/config` con
validación de variables de entorno usando zod, y `@nestjs/schedule` para tareas periódicas.

## Consecuencias

- La estructura modular escala bien a medida que se agregan dominios y facilita testear cada
  pieza aislada.
- Más ceremonia que Express para endpoints simples.
- La lógica que no depende del framework (adaptadores, reglas de seguimiento) vive en
  `packages/` para no acoplarla a NestJS.

## Alternativas consideradas

- **Express:** conocido, pero sin estructura impuesta; no cumple el objetivo de aprendizaje.
- **Fastify / Hono:** más livianos, mismo argumento que Express.
