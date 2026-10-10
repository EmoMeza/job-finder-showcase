# 0003. React + Vite como frontend

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

La interfaz es principalmente datos: tablas con filtros y orden, formularios generados a partir
de la definición de filtros de cada portal, un tablero de seguimiento y gráficos de
estadísticas. Es una app privada detrás de VPN, sin necesidad de SEO.

## Decisión

SPA con React 19 + Vite, React Router, TanStack Query (estado del servidor), TanStack Table
(tablas) y Tailwind CSS + shadcn/ui (componentes). Se sirve como archivos estáticos desde nginx.

## Consecuencias

- Ecosistema maduro para tablas y formularios complejos.
- React es el framework de frontend con más demanda en el mercado laboral chileno, lo que suma
  al proyecto como portafolio.
- Sin SSR: no hace falta para una app privada.

## Alternativas consideradas

- **Vue:** curva más suave, pero menos librerías maduras para tablas y menor demanda laboral.
- **Next.js:** su backend se superpone con NestJS y el SSR no aporta en este caso.
