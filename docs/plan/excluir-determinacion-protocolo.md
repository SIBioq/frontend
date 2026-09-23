# Plan: excluir una determinación de un protocolo

Plan frontend del cambio cruzado. El contrato y diagrama completos están documentados en el plan homónimo del backend.

## Conducta visible

- Cada fila de Carga de resultados ofrece “No corresponde”.
- La fila excluida sigue visible, claramente diferenciada, no editable y puede reactivarse.
- Si tiene valor, notas o validación, se pide confirmación y se aclara que la información se conserva.
- Progreso, resumen, navegación por teclado, fórmulas y Validar todos ignoran excluidas.
- Sin permiso o con protocolo cancelado no se puede cambiar la exclusión.

## Contrato API

`POST /api/results/results/{id}/exclusion/` con `{excluido, confirmar_con_datos?}`. Un `409` con `requires_confirmation=true` abre el diálogo y permite repetir con confirmación.

## Ticket FE-1

- **Archivos previstos:** `src/types/index.ts`, `src/config/api.ts`, `src/hooks/use-protocol-results.ts`, componentes de carga/validación, `src/lib/result-formulas.ts` y pruebas disponibles.
- **Aceptación:** exclusión y reactivación actualizan fila y estado; no hay guardados/validaciones accidentales; la UI es accesible y mantiene lectura de datos preservados.

## Validación

- TypeScript y lint focalizado.
- Pruebas unitarias de fórmulas/selección si la infraestructura existente lo permite.
- Revisión manual de estados vacío, con dato, excluido, sin permiso y cancelado.
