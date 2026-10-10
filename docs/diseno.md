# Sistema visual

La web está pensada para que cualquier persona, técnica o no, entienda al instante **qué puede
editar, qué es un botón y en qué paso va**.

## Dónde se define

Toda la paleta y la tipografía están en [`apps/web/src/index.css`](../apps/web/src/index.css),
como variables con nombre. Cambiar un color ahí lo cambia en toda la app; los componentes de
shadcn/ui usan esas mismas variables.

Los estilos de cada componente van como clases de Tailwind dentro del propio componente
(`className="rounded-lg border px-3"`), en vez de un archivo `.css` por componente.

## Paleta

| Variable             | Color     | Uso                                                  |
| -------------------- | --------- | ---------------------------------------------------- |
| `--tinta`            | `#1f2a44` | Texto principal                                      |
| `--tinta-secundaria` | `#4a5670` | Texto de apoyo (contraste AA sobre fondo y hoja)     |
| `--fondo`            | `#eef1f5` | Fondo de la app                                      |
| `--hoja`             | `#ffffff` | Campos editables, paneles y documentos               |
| `--petroleo`         | `#1d5c63` | Acciones principales, enlaces, foco de teclado       |
| `--destacador`       | `#ffe45c` | Lo que la IA completó desde el CV y aún no se revisa |
| `--linea`            | `#8e9aab` | Borde de los campos editables (marcado a propósito)  |
| `--linea-suave`      | `#d3dae3` | Separadores y bordes de paneles                      |
| `--error`            | `#b42318` | Errores y acciones destructivas                      |

## Reglas

- **Editable = caja blanca con borde marcado** sobre el fondo gris. Si no tiene caja, es texto.
- **Tres niveles de acción**, todos reconocibles como clicables:
  - principal: petróleo sólido (`<Button>`);
  - secundaria: borde petróleo sobre blanco (`variant="outline"`);
  - terciaria: texto petróleo subrayado (`variant="ghost"`). Nunca texto suelto que sea clicable
    sin parecerlo.
- **Destacador** (`.ai-prefilled`): marca solo lo que prellenó la IA, solo en el paso que aún no
  se revisa. No se usa como decoración.
- **Foco de teclado siempre visible**; se respeta "reducir movimiento" del sistema.

## Tipografía

[Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) para todo: diseñada para
máxima legibilidad, útil en formularios largos.
