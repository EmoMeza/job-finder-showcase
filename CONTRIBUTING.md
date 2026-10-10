# Cómo trabajar en este repo

## Flujo

1. Todo trabajo parte de un **issue** (usar las plantillas: funcionalidad o bug).
2. Se crea una rama desde `main`: `<tipo>/<descripción-corta>`, por ejemplo
   `feat/subida-cv` o `fix/paginacion-del-feed`.
3. Commits pequeños y con sentido propio (ver convención abajo).
4. Se abre un PR que cierra el issue con `Closes #12` (GitHub solo reconoce las palabras clave en
   inglés: `Closes`, `Fixes`, `Resolves`). El CI debe pasar antes de mergear.
5. Si el cambio implica una decisión de arquitectura, se agrega un ADR en `docs/adr/`. Si cambia
   la arquitectura, se actualiza `docs/arquitectura.md` en el mismo PR.

## Convención de commits

[Conventional Commits](https://www.conventionalcommits.org/es/), en español:

```
<tipo>(<ámbito>): <descripción en imperativo>
```

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.
- **Ámbitos:** `api`, `web`, `shared`, `sources`, `docker`, `ci`, `deps`.

Ejemplos:

```
feat(api): agregar endpoint de subida de CV
fix(sources): manejar ofertas sin empresa visible
docs(adr): registrar decisión de usar SQLite
```

## Antes de abrir un PR

```bash
pnpm format && pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

## Cambiar el adaptador o el portal de demostración

El adaptador (`packages/sources/src/demo`) solo se prueba contra el portal ficticio del repo. Si
cambias cómo se comporta el portal, actualiza [docs/portal-demo.md](./docs/portal-demo.md), en
especial la tabla "Qué escribe en la cuenta".

## Datos personales

Nunca commitear `.env`, CVs, bases de datos ni sesiones guardadas. Todo eso vive en
`data/` (ignorado por git). El CI corre gitleaks en cada push.
