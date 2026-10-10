# Portal de demostración

"Empleos Demo" es un portal de empleo **ficticio** que vive en este repositorio
([`packages/sources/src/demo/portal.ts`](../packages/sources/src/demo/portal.ts)). La API lo
levanta junto con ella (por defecto en `http://localhost:4100`) y los tests levantan uno propio.
Sus ofertas y empresas son inventadas ([`catalog.ts`](../packages/sources/src/demo/catalog.ts)).

Existe para que la automatización tenga contra qué correr sin tocar ningún sitio real, y reproduce
a propósito los comportamientos que hacen difícil automatizar un portal.

## Cómo se comporta

| Tema                    | Comportamiento                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Ingreso                 | Sin contraseña: entrega un enlace de un solo uso, que además pide confirmar con "Ingresar" |
| Sesión                  | Cookie `demo_session`, `HttpOnly`, de 7 días                                               |
| Página privada          | `/postulaciones` carga solo con sesión; sin ella redirige a la portada                     |
| Ofertas                 | Feed "Para ti" (`/para-ti`), por tandas                                                    |
| Condiciones de búsqueda | Son las preferencias guardadas en la cuenta                                                |
| Detalle                 | Una página por oferta, con el contenido marcado con `itemprop` (schema.org)                |

### Ingreso

1. En `/ingresar` se pide el enlace. Un portal real lo enviaría por correo; este lo muestra en
   pantalla.
2. Abrir el enlace no inicia sesión por sí solo: muestra una página de confirmación y recién el
   botón **Ingresar** crea la sesión.
3. El enlace sirve una sola vez.

La app nunca pide el enlace: lo pide la persona en su navegador y lo pega. El servidor valida que
sea del portal antes de abrirlo ([ADR 0012](./adr/0012-conexion-de-cuentas-de-portales.md)).

### Feed

La página llega sin ofertas y las pide a su propio servidor:

1. **Al cargar:** `GET /para-ti.json`. Responde `{ offers, meta: { nextOffset, pageSize,
preferences } }` con la primera tanda y las preferencias guardadas en la cuenta. Es una
   consulta de lectura: no recibe filtros.
2. **Con el botón "Cargar más ofertas":** `POST /ofertas/mas.json` con `{ offset, preferences }`.
   La página manda las mismas preferencias que recibió en el paso 1.

> **`POST /ofertas/mas.json` guarda como preferencias de la cuenta los filtros que recibe.** No
> hay forma de pedir más ofertas con otros filtros sin modificar la cuenta.

Los nombres de las categorías, niveles, países y jornadas vienen en los atributos `data-*` del
contenedor `#feed`, como listas de `[nombre, id]`.

Otros detalles que el adaptador tiene que resolver:

- El sueldo viene como texto ("1900 - 2600") aunque la empresa no lo publique; los montos
  numéricos vienen solo cuando es público.
- La fecha viene en palabras ("09 de octubre de 2026").
- Dentro de la descripción hay un párrafo oculto con CSS que no es parte de la oferta.

## Qué escribe en la cuenta

| Acción                                             | ¿Escribe?                            |
| -------------------------------------------------- | ------------------------------------ |
| Abrir `/para-ti`, una oferta o `/postulaciones`    | No                                   |
| `GET /para-ti.json` (lo pide la página al cargar)  | No                                   |
| "Cargar más ofertas" con las preferencias actuales | No cambia nada (reenvía lo mismo)    |
| `POST /ofertas/mas.json` con otros filtros         | **Sí: sobrescribe las preferencias** |

## Cómo lo lee el adaptador

[`source.ts`](../packages/sources/src/demo/source.ts), dentro de un navegador con la sesión del
usuario y usando solo lo que hace la propia página
([ADR 0013](./adr/0013-leer-sin-dejar-huella.md)):

1. Abre `/para-ti` y lee la respuesta de `/para-ti.json`: primera tanda y preferencias guardadas.
2. Pide las tandas siguientes con el botón "Cargar más ofertas", con una pausa antes de cada una
   y hasta un máximo de ofertas.
3. **Guardia:** intercepta `POST /ofertas/mas.json` y solo lo deja salir si lleva exactamente las
   preferencias del paso 1. Si no, lo aborta, deja de pedir tandas y devuelve lo leído con un
   aviso.
4. Si `/para-ti` redirige o el feed responde 401, informa que la sesión venció.
5. Si algo falla, deja una captura y el HTML de la página.

## Fallas simuladas

El portal expone interruptores para los tests:

- `faults.feedBroken`: el feed responde otra cosa, como si el portal hubiera cambiado.
- `faults.sessionRevoked`: deja de reconocer la sesión, como cuando vence.
- `loadMoreChangesPreferences`: la página envía filtros distintos a los guardados, para comprobar
  que la guardia bloquea la consulta.

Además `account` muestra lo que quedó guardado en la cuenta y cada consulta recibida. Con eso un
test comprueba que, después de leer, las preferencias siguen iguales.
