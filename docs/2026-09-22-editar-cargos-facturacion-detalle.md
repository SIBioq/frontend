# Edición de cargos en el detalle de facturación

## Pedido

Permitir modificar desde el contenedor Facturación del detalle de protocolo los
cargos variables que ya aparecen en el desglose, además del coseguro.

## Cambios verificados

- Se agregó el diálogo **Editar cargos** con material descartable, derivación y
  coseguro.
- El formulario carga los importes actuales, valida montos no negativos y
  deshabilita el coseguro cuando la obra social no lo cobra.
- Se reutilizaron los endpoints existentes para extras y coseguro, con guardado
  secuencial, manejo de errores y refresco del detalle.
- El acceso a **Cobro no contemplado** se mantiene para cargos libres.
- Los importes de análisis siguen dependiendo del nomenclador y no se editan
  desde este formulario.

## Decisiones y alcance

El «etc.» del pedido queda limitado a los cargos estándar existentes: coseguro,
material descartable y derivación. No se modificó la API, el cálculo de precios,
los permisos ni los flujos de pagos. Ante un guardado parcial, la interfaz
informa el estado real luego del refresco.

## Archivos

- `src/components/protocolos/components/dialogs/editar-cargos-dialog.tsx`
- `src/components/protocolos/components/dialogs/index.ts`
- `src/components/protocolos/components/protocol-card.tsx`
- `src/components/protocolos/components/protocol-detail-view.tsx`

## Validación

- TypeScript (`tsc`): aprobado.
- ESLint de los archivos modificados: aprobado.
- Backend: 14 tests de `laboratory.protocols.tests_correccion_del_cobro`:
  aprobados.
- El backend mantiene el warning MySQL W036 conocido.
- El frontend no tiene runner de tests configurado; no se ejecutaron tests de
  interfaz.

## Pendientes

No quedan pendientes funcionales para este alcance. La prueba automatizada de
interfaz queda pendiente hasta contar con un runner de tests frontend.
