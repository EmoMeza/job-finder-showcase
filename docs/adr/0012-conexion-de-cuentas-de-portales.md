# 0012. Conexión de cuentas de portales con sesión capturada

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

Job Finder lee cada portal con la sesión del usuario, como lo ve una persona con su cuenta, y esa
misma sesión se usa después para postular. Hay que decidir cómo obtiene la app esa sesión.

Los portales ofrecen formas de ingreso distintas. El primero que se abordó **no tiene
contraseña**: se entra con un enlace mágico por correo o con la cuenta de un proveedor externo, y pide un captcha cuando se solicitan enlaces seguido. El portal de
demostración reproduce el ingreso por enlace mágico (ver `docs/portal-demo.md`).

Una página web no puede leer las cookies de otro sitio en el navegador del usuario: la sesión solo
se puede capturar desde un navegador que la app controle.

## Decisión

Cada portal declara su **tipo de conexión** (`PortalConnection` en `packages/sources`) y la app
guarda la **sesión resultante**, no las credenciales:

| Tipo                | Cómo se conecta                                                           | Uso                      |
| ------------------- | ------------------------------------------------------------------------- | ------------------------ |
| Enlace mágico       | El usuario pide el enlace en su navegador y lo pega en la app             | Portal de demostración   |
| Correo y contraseña | La app inicia sesión con la clave del portal, guardada cifrada            | Portales que lo ofrezcan |
| Navegador remoto    | El usuario ingresa en un navegador del servidor mostrado dentro de la app | Solo si no hay otra vía  |

Para el enlace mágico:

1. El usuario pide el enlace **en su propio navegador**; si hay captcha, lo resuelve ahí. El
   servidor nunca lo pide.
2. Pega el enlace en la app. El servidor valida que sea del portal (https, su dominio, la ruta de
   ingreso) antes de abrirlo.
3. El servidor lo abre en un Chromium sin ventana, confirma el ingreso, **verifica** que la
   sesión quedó iniciada y guarda las cookies.

La sesión se guarda **cifrada por usuario** (AES-256-GCM con `APP_SECRET`, igual que las API
keys), nunca se devuelve al frontend y se borra al desconectar. Una revisión diaria la mantiene
viva y marca como "Reconectar" las que vencieron.

**No se guardan contraseñas de proveedores de identidad externos.** Esos proveedores bloquean los ingresos
automatizados, y su contraseña abre mucho más que un portal de empleo.

## Modelo de amenazas

| Riesgo                                                  | Mitigación                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Usar el navegador del servidor para abrir cualquier URL | Solo se abren enlaces validados del dominio del portal; no hay campo de URL libre                 |
| Robo de la base de datos                                | Las sesiones están cifradas con una clave que no está en la base (`APP_SECRET`)                   |
| Filtración del enlace mágico                            | No se guarda ni se escribe en logs; los errores no lo repiten; en la web se ingresa oculto        |
| Probar enlaces en masa                                  | El endpoint de conexión comparte el límite de intentos por IP del login                           |
| Un usuario ve la sesión de otro                         | Las sesiones se guardan y consultan siempre por usuario; la API no las devuelve                   |
| Fallas de Chromium ante contenido malicioso             | Solo carga el portal; cada tarea usa un contexto aislado que se descarta; usuario sin privilegios |
| Consumo del servidor                                    | Un navegador a la vez, se abre al usarse y se cierra tras un minuto sin uso                       |

Riesgo aceptado: quien obtenga a la vez la base de datos y `APP_SECRET` puede usar las sesiones
guardadas mientras no venzan. Es el mismo nivel de exposición que las API keys de IA.

## Consecuencias

- El usuario conecta su cuenta sin entregar contraseñas y sin instalar nada.
- Funciona aunque la cuenta del portal se haya creado con un proveedor externo, mientras el portal
  ofrezca enlace mágico.
- Reconectar es manual cuando la sesión vence; si el portal la renueva con cada uso, la revisión
  diaria lo evita.
- La imagen de la API incluye Chromium (unos 600 MB más en disco).

## Alternativas consideradas

- **Guardar correo y contraseña de cada portal y automatizar el ingreso:** no aplica a un portal
  sin contraseña, y con ingresos a través de un proveedor externo no es confiable ni prudente.
- **Navegador remoto para todos los portales:** sirve con cualquier método de ingreso, pero suma
  un visor de pantalla, más superficie de ataque y más consumo. Queda como último recurso.
- **Extensión del navegador que envía las cookies:** no levanta sospechas del portal, pero hay que
  instalarla en cada navegador y no sirve en el celular.
- **Pedir el enlace mágico desde el servidor:** un paso menos para el usuario, pero el captcha lo
  bloquea.
