# 0013. Leer los portales sin dejar huella en la cuenta

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

Job Finder lee cada portal con la sesión del usuario ([ADR 0012](./0012-conexion-de-cuentas-de-portales.md)).
Con una sesión iniciada, una acción que parece de lectura puede escribir en la cuenta.

Pasó al investigar el primer portal: su feed de ofertas se pagina con una consulta que **guarda
como preferencias de la cuenta los filtros que recibe**. Una búsqueda de prueba con otros filtros
cambió las preferencias reales de la cuenta, que además definían sus alertas por correo. El portal
de demostración reproduce ese comportamiento (ver `docs/portal-demo.md`).

La app va a leer los portales varias veces al día y sin nadie mirando. Un error así, repetido por
un scheduler, es difícil de notar y de deshacer.

## Decisión

**Leer nunca modifica la cuenta del usuario**, y los adaptadores se construyen para que eso no
dependa de que el portal siga igual:

1. **El adaptador no arma consultas que puedan escribir.** Usa las que hace la propia página:
   abre la página, lee las respuestas que ella pide y avanza con sus botones. En el portal, la
   primera tanda y las preferencias guardadas salen de la consulta de lectura que la página hace
   al cargar, y las siguientes del botón "Cargar más ofertas".
2. **Una guardia revisa lo que sale.** Si una consulta de lectura puede escribir, el adaptador la
   intercepta en el navegador y solo la deja pasar si lleva exactamente lo que ya estaba guardado.
   Si no, la aborta, deja de leer y devuelve lo que alcanzó junto con un aviso.
3. **Las condiciones de búsqueda de esos portales se gestionan en el portal.** La app las muestra,
   pero se cambian allá (`conditions: 'portal'` en el contrato del adaptador).
4. **Cada portal documenta qué escribe** en una tabla "Qué escribe en la cuenta" (ver
   `docs/portal-demo.md`), y esa propiedad se prueba: el portal local de los tests guarda lo que
   recibe y un test comprueba que después de leer nada cambió.

Las acciones que sí escriben (crear el borrador de una postulación, enviarla) quedan fuera de la
lectura: solo ocurren en la postulación asistida, con revisión y confirmación del usuario.

## Consecuencias

- Si un portal cambia su página y empieza a enviar otra cosa, la lectura se corta con un aviso en
  vez de modificar la cuenta. Se pierde una ejecución, no las preferencias del usuario.
- En un portal así no se puede buscar con filtros distintos a los guardados. Los filtros propios de
  la app (sueldo, antigüedad, modalidad) se aplican después, sobre lo leído.
- Leer con los botones de la página es más lento que llamar a la consulta directamente, pero se
  parece más al uso de una persona.
- Investigar un portal nuevo incluye averiguar qué escribe antes de programar su adaptador.

## Alternativas consideradas

- **Armar la consulta en el adaptador con las preferencias leídas:** más simple y rápido, pero un
  campo mal copiado o un cambio del portal sobrescribe las preferencias sin que nadie lo note.
- **Usar la API pública del portal:** no escribe nada, pero no entrega el feed del usuario ni los
  sueldos que solo se ven con sesión, y no sirve para postular.
- **Guardar una copia de las preferencias y restaurarlas después de cada búsqueda:** deja la
  cuenta en un estado ajeno mientras dura la lectura y falla justo cuando algo sale mal a medio
  camino.
- **Leer solo las tarjetas que dibuja la página:** no hay nada que interceptar, pero las tarjetas
  no traen el sueldo.
