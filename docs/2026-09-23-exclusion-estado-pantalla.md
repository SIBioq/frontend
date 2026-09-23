# Pantalla de resultados pierde ediciones concurrentes por clausuras viejas

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | fix/exclusion-estado-pantalla |
| **Estado** | hecho |
| **Tipo** | arreglo |

## Qué se pidió
Corregir que excluir una determinación y guardar otra casi al mismo tiempo hacía que la que terminaba después pisara el estado, perdiendo la primera edición de la pantalla aunque el backend la hubiera guardado correctamente.

## Qué se hizo
- Agregadas referencias `resultsRef` y `valuesRef` que se actualizan en efectos; `onSave`, `alternarCargaManual` y `alternarExclusion` leen estas referencias después de los `await` en lugar de las clausuras iniciales.
- Actualizado `estadoSubmodulos` para partir de `determinaciones_definidas` (catálogo completo sin filtrar) en lugar de `determinaciones` (ya filtrado por exclusión); aplica el filtro actual sobre el estado presente.
- Agregado tipo y comentario explicativo para `determinaciones_definidas` en `SubmoduloEvaluado`.

## Decisiones
Las referencias evitan el problema de clausuras que capturan fotos viejas del estado. Se parte de `determinaciones_definidas` porque `determinaciones` llega ya filtrado por las exclusiones del momento de la carga: una determinación que estaba excluida entonces no aparece, y reincluirla sin el catálogo completo no tiene efecto.

## Archivos tocados
| archivo | qué cambió |
|---|---|
| `src/hooks/use-protocol-results.ts` | Agregadas `resultsRef` y `valuesRef` con efectos; `onSave`, `alternarCargaManual` y `alternarExclusion` ahora leen de refs. |
| `src/types/index.ts` | Agregado campo opcional `determinaciones_definidas` a `SubmoduloEvaluado` con documentación de su propósito. |

## Cómo se probó
La prueba es manual en el navegador: abrir una pantalla de resultados con un submódulo (ej. Fórmula Leucocitaria), excluir dos determinaciones casi seguidas o guardar y excluir simultáneamente, verificar que ambas operaciones se reflejan en pantalla sin pisar la anterior. El backend rechaza validación si faltan totales correctamente.

## Pendiente
Limitación existente: si el 100% de un submódulo está excluido, el backend no lo informa (comportamiento intencional, verificado por test). Reincluir una determinación cuando el submódulo entero estaba excluido requiere recargar la pantalla.
