# Dejar una determinación fuera del protocolo en carga de resultados

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
- Creó `exclusion-confirm-dialog.tsx`: confirmación no destructiva que aclara que los datos se conservan. Usa la misma estructura que los diálogos del protocolo (`Dialog` con franja de encabezado, azul `#204983`, pie gris), no el `AlertDialog` genérico.
- Modificó `result-determination-row.tsx`: botón "Dejar fuera del protocolo" (ícono `CircleMinus`) abajo a la derecha de la fila; excluida, pasa a "Volver a incluir" y se marca en naranja con el badge "Fuera del protocolo". No aparece sin permiso, con el protocolo cancelado o con el resultado ya validado.
- Actualizó `use-protocol-results.ts` (hook principal) para: excluir/incluir en conteos de progreso, omitir en navegación por teclado, filtrar en lista de validación, y manejar `409 requires_confirmation`.
- Modificó `result-formulas.ts` para tratar determinaciones excluidas como dependencias faltantes en el cálculo de fórmulas.
- Actualizó `protocol-results-loader.tsx` para mostrar "X/Y cargados · N fuera del protocolo" en la barra de progreso.
- Modificó `protocol-validation-loader.tsx` y `validation-result-row.tsx` para omitir excluidas en validación y "Validar todos".
- Modificó `resumen-de-resultados.tsx` para filtrar las determinaciones excluidas de la lista de resultados con valor. Este componente no interviene en los submódulos de corroboración: no los calcula ni los muestra.

## Decisiones

- **"Dejar fuera del protocolo", abajo a la derecha**: primero fue un toggle "No corresponde" al lado de "Cargar a mano". Se cambió a pedido: el nombre dice qué pasa con la fila y el botón queda lejos del valor, porque es una decisión sobre la fila entera y no una edición del dato.

- **Diálogo sin estilo destructivo**: aunque la acción es reversible, se abrió un modal para que sea imposible excluir por accidente con datos; sin embargo, la paleta visual no es la de peligro (rojo).
- **Excluida en naranja**: la fila excluida va con fondo naranja claro, borde izquierdo naranja grueso y badge naranja sólido, en carga y en validación; el conteo "fuera del protocolo" del encabezado también va en naranja. Primero se usó gris, pero pasaba desapercibida. No es rojo porque no es un error.
- **Fila sigue visible**: permite el usuario ver qué está excluido, comparar valores históricos, y reactivar sin navegar. El progreso la excluye de los conteos.
- **Botón oculto si validada**: una vez que la bioquímico firma un resultado, es una decisión hecha; aunque técnicamente reversible en backend, la UI sólo permite excluir si no fue validada.
- **Formulario de progreso**: en lugar de cero, se informa "X cargados · N fuera del protocolo" para aclarar que los pendientes no son errores sino filas no aplicables.
- **Exclusión dentro de submódulos**: una determinación excluida sale del submódulo (no lo anula). Si todas quedan excluidas, el submódulo no se informa. Ver la tarea correlativa [2026-09-23-exclusion-en-corroboracion.md](2026-09-23-exclusion-en-corroboracion.md).

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/types/index.ts` | Agregó `excluido?: boolean` al tipo `Result` |
| `src/config/api.ts` | Agregó ruta `POST /results/{id}/exclusion/` |
| `src/components/results/components/exclusion-confirm-dialog.tsx` | Componente nuevo de diálogo |
| `src/components/results/components/result-determination-row.tsx` | Botón "Dejar fuera del protocolo" abajo a la derecha |
| `src/hooks/use-protocol-results.ts` | Filtrado en conteos, navegación, validación, y manejo de 409 |
| `src/lib/result-formulas.ts` | Tratamiento de excluidas en dependencias de fórmulas |
| `src/components/results/components/protocol-results-loader.tsx` | Barra de progreso con contador de las que quedaron fuera |
| `src/components/validacion/components/protocol-validation-loader.tsx` | Omisión de excluidas en vista de validación |
| `src/components/validacion/components/validation-result-row.tsx` | UI y filtrado en filas de validación |
| `src/components/common/resumen-de-resultados.tsx` | Excluidas fuera de la lista de resultados con valor |

## Cómo se probó

```bash
# Frontend: compilación y lint sin errores
npm run build && npm run lint

# Prueba manual de comportamiento (sin framework de test centralizado):
# 1. Crear un protocolo con análisis que tenga múltiples determinaciones
# 2. En carga: verificar que aparece "Dejar fuera del protocolo" abajo a la derecha de la fila
# 3. Click en toggle vacío: cambio inmediato, progreso recalcula
# 4. Con dato cargado: diálogo pregunta confirmación, dice "se conservan"
# 5. Reactivar desde excluida: sin datos
# 6. Validación: excluidas no aparecen en la lista
# 7. Sin permiso: el botón no aparece, backend rechaza
```

Compilación: 0 errores de TypeScript; lint con 0 errores (los 28 warnings son previos a la rama).

## Pendiente

Nada. El plan del frontend está integrado en este documento; no se versionó `docs/plan/excluir-determinacion-protocolo.md` del frontend porque su contenido es subsidiario del plan de backend.
