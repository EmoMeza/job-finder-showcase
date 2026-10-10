# Arquitectura

## Piezas

- **`apps/api`** (NestJS): API REST, tareas programadas, navegador del servidor e IA.
- **`apps/web`** (React): la interfaz. Habla solo con `/api`.
- **`packages/shared`**: tipos y esquemas zod que usan los dos lados, para que el formulario y el
  endpoint validen con la misma definición.
- **`packages/sources`**: el contrato de un adaptador de portal, el adaptador del portal de
  demostración y el propio portal ([portal-demo.md](./portal-demo.md)).

### Módulos de la API

| Módulo        | Qué hace                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `auth`        | Login con sesiones en base de datos y cookie httpOnly; guard global         |
| `users`       | Usuarios y contraseñas (argon2id); se administran con el CLI                |
| `profile`     | CV en PDF, extracción con IA y wizard con borrador hasta confirmar          |
| `llm`         | Proveedores de IA intercambiables por usuario, con salida estructurada      |
| `portals`     | Conexión de la cuenta del portal y su sesión cifrada                        |
| `browser`     | Un Chromium sin ventana: una tarea a la vez, en contextos aislados          |
| `searches`    | Ejecución de búsquedas en segundo plano, a mano o periódicas, con historial |
| `jobs`        | Ofertas guardadas y la lista de cada usuario                                |
| `demo-portal` | Levanta el portal ficticio junto con la API                                 |

## Contrato de un adaptador

```ts
interface JobSource {
  id: SourceId;
  connection: PortalConnection; // cómo conecta el usuario su cuenta
  conditions: SourceConditions; // gestionadas en el portal (con su URL) o editables en la app
  search(ctx, options?): Promise<SearchResult>; // ofertas, condiciones aplicadas y avisos
  getDetail(ctx, listing): Promise<JobDetail>;
}
```

`ctx` entrega el navegador de Playwright con la sesión del usuario, el logger, la pausa entre
páginas y dónde guardar una captura cuando algo falla. Los adaptadores devuelven datos ya
**normalizados** (además del crudo, guardado para reprocesar) y avisan con errores propios cuando
la sesión venció (`SessionExpiredError`) o el portal cambió (`PortalChangedError`).

**Leer no deja huella en la cuenta**: un adaptador usa las consultas que hace la propia página
del portal y bloquea las que modificarían algo
([ADR 0013](./adr/0013-leer-sin-dejar-huella.md)).

## Cómo corre una búsqueda

1. `POST /api/searches/:source/run` crea la ejecución "en curso" y responde de inmediato.
2. En segundo plano, la API toma la sesión cifrada del usuario y abre un contexto aislado del
   navegador. El navegador atiende una tarea a la vez.
3. El adaptador lee el feed; la API guarda las ofertas sin duplicarlas y lee el detalle de las
   que no lo tienen, con un tope por ejecución y pausas entre páginas.
4. Se guarda la sesión tal como quedó (usarla la renueva) y la ejecución se cierra con sus
   contadores, avisos y las condiciones leídas del portal.
5. Si falla, quedan el error y una captura y el HTML de la página, visibles solo para su dueño.
   Si la sesión venció, el portal pasa a "Reconectar".

La web consulta el avance mientras la ejecución está en curso. Un scheduler revisa cada 10
minutos si a alguna búsqueda periódica ya le toca.

## Modelo de datos

Las ofertas son **globales** (una fila por oferta del portal); el estado es **por usuario**.

```
users            id, email, name, password_hash, llm_provider, anthropic_api_key_enc, created_at
sessions         id (hash del token), user_id, created_at, expires_at
profiles         user_id, cv_*, data (json, confirmado), preferences (json), confirmed_at,
                 draft (json, wizard en curso), generated_*
portal_accounts  user_id, source, enabled, status, session_enc, connected_at, checked_at
searches         id, user_id, source, interval_hours, conditions (json, leídas del portal),
                 conditions_read_at, last_run_at            UNIQUE(user_id, source)
search_runs      id, search_id, trigger, status, step, started_at, finished_at, found, added,
                 reached_end, warnings (json), error, artifacts (json)
jobs             id, source, external_id, url, title, company, location, cities, countries,
                 modality, employment_type, seniority, salary_*, published_on, apply_notes,
                 raw (json), description, tags, benefits, apply_url, closed, detail_fetched_at,
                 first_seen_at, last_seen_at                UNIQUE(source, external_id)
user_jobs        id, user_id, job_id, search_id, status, notes, applied_at, created_at,
                 updated_at                                 UNIQUE(user_id, job_id)
```

`user_jobs.status` usa los estados y transiciones de `packages/shared/src/tracking.ts`, pensados
para el seguimiento de postulaciones que el proyecto original no alcanzó a construir.

## Seguridad

- Contraseñas con argon2id; sesiones guardadas como hash del token, con cookie httpOnly.
- Secretos en la base (API keys, sesiones del portal) cifrados con AES-256-GCM a partir de
  `APP_SECRET`.
- El navegador del servidor solo abre direcciones validadas del portal y cada tarea usa un
  contexto que se descarta.
- Límite de intentos por IP en el login y en la conexión de portales; cabeceras de seguridad con
  helmet y en nginx.
