# Marcar una determinación como "no corresponde" en carga de resultados

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/excluir-determinacion-protocolo |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

Ofrecer un toggle en cada fila de carga de resultados para marcar una determinación como "no aplicable" al protocolo. La fila debe seguir siendo visible pero quedar fuera del progreso, validación y resumen. Si hay datos guardados, pedir confirmación reversible antes de excluir.

## Qué se hizo

- Agregó tipo `Result.excluido` en `src/types/index.ts` y endpoint en `src/config/api.ts`.
- Creó componente `exclusion-confirm-dialog.tsx` con confirmación no destructiva (sin rojo) que aclara que los datos se conservan.
- Modificó `result-determination-row.tsx` para mostrar toggle "No corresponde" con mismo estilo que "Cargar a mano"; deshabilitado si hay validación previa o sin permiso/protocolo cancelado.
- Actualizó `use-protocol-results.ts` (hook principal) para: excluir/incluir en conteos de progreso, omitir en navegación por teclado, filtrar en lista de validación, y manejar `409 requires_confirmation`.
- Modificó `result-formulas.ts` para contar excluidas como "dependencia faltante" en fórmulas.
- Actualizó `protocol-results-loader.tsx` para mostrar "X/Y cargados · N no corresponden" en la barra de progreso.
- Modificó `protocol-validation-loader.tsx` y `validation-result-row.tsx` para omitir excluidas en validación y "Validar todos".
- Actualizó `resumen-de-resultados.tsx` para descartar submódulos si tienen una determinación excluida.

## Decisiones

- **Diálogo sin estilo destructivo**: aunque la acción es reversible, se abrió un modal para que sea imposible excluir por accidente con datos; sin embargo, la paleta visual no es la de peligro (rojo).
- **Fila sigue visible**: permite el usuario ver qué está excluido, comparar valores históricos, y reactivar sin navegar. El progreso la excluye de los conteos.
- **Toggle deshabilitado si validada**: una vez que la bioquímico firma un resultado, es una decisión hecha; aunque técnicamente reversible en backend, la UI sólo permite excluir si no fue validada.
- **Formulario de progreso**: en lugar de cero, se informa "X cargados · N no corresponden" para aclarar que los pendientes no son errores sino filas no aplicables.
- **Sin recursión en submódulos**: si un submódulo tiene una determinación excluida, el submódulo entero se descarta; el frontend no deja excluir parcialmente un grupo.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/types/index.ts` | Agregó `excluido?: boolean` al tipo `Result` |
| `src/config/api.ts` | Agregó ruta `POST /results/{id}/exclusion/` |
| `src/components/common/exclusion-confirm-dialog.tsx` | Componente nuevo de diálogo |
| `src/components/results/components/result-determination-row.tsx` | Toggle "No corresponde" con lógica de deshabilitación |
| `src/hooks/use-protocol-results.ts` | Filtrado en conteos, navegación, validación, y manejo de 409 |
| `src/lib/result-formulas.ts` | Tratamiento de excluidas en dependencias de fórmulas |
| `src/components/results/components/protocol-results-loader.tsx` | Barra de progreso con contador de no corresponden |
| `src/components/results/components/protocol-validation-loader.tsx` | Omisión de excluidas en vista de validación |
| `src/components/results/components/validation-result-row.tsx` | UI y filtrado en filas de validación |
| `src/components/common/resumen-de-resultados.tsx` | Rechazo de submódulos con excluidas |

## Cómo se probó

```bash
# Frontend: compilación y lint sin errores
npm run build && npm run lint

# Prueba manual de comportamiento (sin framework de test centralizado):
# 1. Crear un protocolo con análisis que tenga múltiples determinaciones
# 2. En carga: verificar que aparece "No corresponde" al lado de "Cargar a mano"
# 3. Click en toggle vacío: cambio inmediato, progreso recalcula
# 4. Con dato cargado: diálogo pregunta confirmación, dice "se conservan"
# 5. Reactivar desde excluida: sin datos
# 6. Validación: excluidas no aparecen en la lista
# 7. Sin permiso: toggle deshabilitado, backend rechaza
```

Compilación: 0 errores de TypeScript, 0 warnings de linter.

## Pendiente

Nada. El plan del frontend está integrado en este documento; no se versionó `docs/plan/excluir-determinacion-protocolo.md` del frontend porque su contenido es subsidiario del plan de backend.
