# 0005. Un adaptador por portal, scraping con Playwright

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

Cada portal de empleo tiene filtros, estructura y protecciones distintas, y puede cambiar sin
aviso. El objetivo es automatizar lo que haría una persona en el sitio, no integrarse con APIs
oficiales.

## Decisión

- Contrato común `JobSource` en `packages/sources`: cada adaptador declara sus **filtros
  nativos** (la UI arma el formulario a partir de ellos), busca y trae el detalle en un formato
  normalizado, y guarda los datos crudos para debug.
- Playwright como herramienta única, usando lo más liviano que funcione en cada portal:
  `APIRequestContext` (HTTP sin navegador) si hay JSON o HTML renderizado en el servidor, y
  Chromium headless solo si el portal necesita ejecutar JavaScript.
- Antes de cada adaptador, una fase de investigación documentada: cómo se ingresa, cómo se listan
  las ofertas y qué acciones escriben en la cuenta (ver `docs/portal-demo.md`).
- Los adaptadores se prueban con un navegador real contra un portal local, sin depender de la
  red.

## Consecuencias

- Un portal roto no afecta a los demás.
- Agregar un portal es implementar una interfaz conocida.
- Mantenimiento continuo: los selectores se rompen cuando los sitios cambian. Cada ejecución
  guarda artefactos (HTML, screenshots, traces) para diagnosticar rápido.

## Alternativas consideradas

- **Filtros comunes ("mínimo común") entre portales:** pierde los filtros más útiles de cada
  sitio.
- **Cheerio/axios + Puppeteer:** dos herramientas para lo que Playwright cubre solo.
