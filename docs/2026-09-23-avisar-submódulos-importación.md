# Avisar cuántos submódulos se crearon en la importación del catálogo

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/submodulos-en-exportacion |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

Que el resumen de la importación del catálogo refleje los submódulos de corroboración creados, omitidos y con error — información que ya mandaba el backend pero se perdía en la UI.

## Qué se hizo

- Resumen de importación incluye contadores de submódulos: creados y omitidos, en la misma línea de análisis/determinaciones.
- Si hubo errores en submódulos, un toast de advertencia aparte con la cantidad (sin detalles de fila, para no saturar).
- Ayuda del diálogo documenta la tercera hoja `Submodulos` (opcional): qué columnas trae, que es igual para una planilla vieja de dos hojas.

## Decisiones

- **Toast aparte para errores**: el éxito suena bien pero los errores merecen atención. Se reporta sólo la cantidad, no las filas, porque son muchas y saturarían la pantalla.
- **Mismo lugar de éxito**: el resumen de creados/omitidos viaja en el mismo mensaje, sin separación visual.
- **Ayuda inline**: la tercera hoja es opcional; el texto de ayuda lo explica.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/components/configuration/components/import-data-dialog.tsx` | Parse de `data.submodulos`, contadores, resumen de creados/omitidos, toast de advertencia con errores, 28 líneas de ayuda sobre tabla 3 |

## Cómo se probó

- Resumen en éxito: "X análisis creados, Y omitidos; Z determinaciones creadas, W omitidas; U submódulos creados, V omitidos."
- Toast de advertencia: aparece si `submodulos.errors.length > 0`, reporta cantidad.
- Ayuda visible: quinta sección del alert documenta tabla 3 con columnas, ejemplo de carga de planilla vieja.

## Qué NO viaja en la planilla

**(Véase documentación del backend: `docs/2026-09-23-exportar-importar-submodulos-catalogo.md`)**

Resumen: no viajan campos de tarifa fija, metadata NBU, `requires_derivacion` (hoja propia), `scientific_exponent`, `orden`, rangos por edad. Análisis/determinaciones/submódulos inactivos no se exportan. En importación, nada se actualiza: lo existente se omite.

## Pendiente

Nada. Hecho.
