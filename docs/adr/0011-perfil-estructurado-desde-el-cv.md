# 0011. Perfil estructurado extraído del CV

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

La evaluación de ofertas necesita una descripción fiel de cada usuario. El punto de partida es
el CV en PDF que sube cada persona. Hay que decidir:

1. Cómo se le entrega el CV a la IA: el PDF como documento (la API de Anthropic los acepta) o
   el texto extraído en el servidor. El proveedor `claude-cli` (ADR 0006) no recibe archivos.
2. Qué forma tiene el perfil que el usuario revisa y corrige: un texto Markdown libre o datos
   estructurados (experiencias, habilidades, estudios, idiomas).

Los usuarios no son necesariamente técnicos: editar Markdown a mano no es razonable para todos.

## Decisión

**Texto extraído en el servidor.** Al subir el CV se extrae su texto con `unpdf` (pdf.js) y se
guarda; ese texto es lo que recibe la IA, con cualquier proveedor.

- Se valida que el archivo realmente sea un PDF (firma `%PDF-`), no solo el tipo declarado.
- Un PDF sin texto seleccionable (escaneado) se rechaza con un mensaje que lo explica.
- El texto va entre etiquetas `<cv>` y el prompt indica tratarlo solo como datos, para mitigar
  instrucciones incrustadas en el documento.

**Perfil estructurado, para cualquier profesión.** La IA devuelve un objeto validado con
`profileDataSchema` (`packages/shared`): datos básicos, contacto y enlaces, nivel y años de
experiencia (el nivel admite "no aplica"), experiencias con su tipo (empleo, práctica,
independiente, voluntariado, proyecto), habilidades en grupos con nombres propios de la
profesión, educación con su estado (titulado, egresado, en curso, incompleto), certificaciones,
idiomas y comentarios adicionales.

**Wizard con borrador.** El perfil se arma y se edita en un wizard de 10 pasos:

- Al subir el CV, una sola llamada a la IA extrae el perfil y genera **sugerencias asociadas a
  una sección**; cada una aparece en el paso donde se resuelve.
- Lo que la IA prellenó se marca con destacador hasta que el usuario revisa ese paso.
- Cada paso se valida con el mismo esquema que la API y el avance se guarda en un **borrador**
  (`profiles.draft`). El perfil confirmado no cambia hasta "Confirmar perfil", así la evaluación
  de ofertas nunca usa un perfil a medio editar. Se puede descartar el borrador.
- Editar después recorre el wizard completo, partiendo de un CV nuevo o del perfil actual.

**`profile.md` derivado.** El texto que recibe la IA al evaluar ofertas se **arma de forma
determinística** desde los datos (`buildProfileMarkdown`). Nadie lo edita a mano; la web lo
muestra en la revisión final y en la vista del perfil. Los datos de contacto quedan fuera: la
evaluación no los necesita y así no se envían en cada evaluación.

## Consecuencias

- Mismo comportamiento con todos los proveedores, incluidos los que se agreguen (OpenRouter).
- Datos aprovechables sin IA: el pre-filtro puede cruzar las habilidades con los tags de las
  ofertas directamente.
- El esquema estructurado limita lo que el modelo puede devolver, lo que reduce respuestas mal
  formadas; a cambio, información que no calza en ninguna sección se pierde (se puede agregar al
  resumen).
- Se pierde la información visual del PDF (columnas, tablas); en CVs con diseño complejo el orden
  del texto puede mezclarse. Si pasa seguido, se puede enviar el PDF como documento con el
  proveedor de API.
- CVs escaneados no se soportan (requeriría OCR).

## Alternativas consideradas

- **Enviar el PDF a Claude como documento:** mejor lectura de diseños complejos, pero solo
  funciona con `anthropic-api`.
- **`profile.md` generado por la IA y editado como texto:** más simple de implementar, pero
  difícil de editar para usuarios no técnicos y sin datos estructurados reutilizables.
- **Formulario único editable en cualquier momento:** menos pasos, pero no guía, no asegura que
  se revise cada parte y deja sugerencias de la IA sin un lugar claro donde resolverse.
- **Categorías de habilidades fijas (lenguajes, frameworks…):** solo sirven para tecnología.
- **OCR (Tesseract):** soportaría CVs escaneados, pero agrega una dependencia pesada para un caso
  poco común.
