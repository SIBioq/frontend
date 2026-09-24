# Autor visible en el libro diario

## Pedido

Mostrar todos los pagos y devoluciones de un protocolo expandido, con monto,
fecha cuando exista, medio de pago y autor. En las filas de caja distinguir
quién hizo el movimiento de quién lo registró. Mantener corrección, permisos,
llamadas, resumen y orden sin tocar backend.

## Cambios reales

- `pagos[]` completo aparece al expandir un protocolo, incluso sin controles de
  corrección.
- Cada pago o devolución muestra tipo, monto, fecha disponible, medio de pago y
  «Registrado por».
- Las filas de caja muestran «Lo hizo» desde `usuario` y «Registrado por» desde
  `registrado_por`.
- Autor ausente o vacío muestra «No informado»; no se atribuye al usuario actual.

## Decisiones y permisos

- `usuario` conserva semántica de ejecutor del movimiento; `registrado_por`
  identifica al registrador del pago o movimiento.
- `CorreccionDelCobro` sigue siendo el único control de corrección y depende de
  `puedeCorregir`.
- El detalle de lectura no depende de `puedeCorregir`.
- La ruta y el endpoint siguen exigiendo `MANAGE_LEDGER` /
  `administrar_libro_diario`, permiso que en la configuración actual puede
  coincidir con corrección. Este cambio no concede acceso nuevo a lectores sin
  corrección.

## Archivos

- `src/components/caja/libro-diario-page.tsx`
- `docs/plan/autor-libro-diario.md`
- `docs/2026-09-22-autor-libro-diario.md`
- `docs/INDICE.md`

## Pruebas

- `npx tsc -b --noEmit` — pasada.
- `npx eslint src/components/caja/libro-diario-page.tsx` — pasada.
- `git diff --check` — pasada.

## Pendientes

Ninguno dentro del alcance frontend. El acceso efectivo y la separación entre
lectura y corrección siguen dependiendo del permiso backend existente.

## Revertido el 2026-09-23

La distinción entre «Lo hizo» (`usuario`) y «Registrado por» (`registrado_por`) se dio de baja por cambio de criterio de producto: tras revisar la pantalla, importa de dónde salió la plata, no quién hizo el gasto. Las filas ahora muestran solo «Registrado por». El selector «Lo hizo» se eliminó del modal, y el POST deja de enviar `usuario` (el backend lo rellena automáticamente con `request.user`).

Detalles en [`docs/2026-09-23-libro-diario-sin-lo-hizo.md`](2026-09-23-libro-diario-sin-lo-hizo.md).
