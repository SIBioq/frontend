# Corrección del precio particular por UB en protocolo

## Pedido

Corregir la actualización del precio particular por UB y rediseñar su modal respetando la estética existente.

## Hallazgos

- El botón sólo se muestra cuando `hasPermission` encuentra `actualizar_precio_particular_protocolo`.
- `PrivatePriceDialog` valida el monto, normaliza coma decimal a punto y entrega un `string` al callback.
- El protocolo expone `precio_particular_ub` y el desglose expone `private_ub_value_used`.
- `PROTOCOL_ENDPOINTS.ACTUALIZAR_PRECIO_PARTICULAR` construye correctamente el endpoint.
- `useApi().apiRequest` agrega `Content-Type: application/json` y serializa automáticamente el `body` con `JSON.stringify`.
- El contrato actual requiere un objeto JSON con `precio_particular_ub`; el envío queda alineado con ese contrato.

## Cambio

El handler pasa `body: { precio_particular_ub: price }` y deja la serialización a `apiRequest`. El modal muestra como valor actual el snapshot `billing_breakdown.private_ub_value_used`, con fallback al override del protocolo; no usa el valor global de la obra social. El formulario usa `onSubmit` y botón `submit`, por lo que Enter guarda sin activar acciones laterales. El botón de guardado conserva el azul institucional (`#204983`). Se mantiene `canUpdatePrivatePrice` y el contrato `precio_particular_ub`. El detalle de facturación muestra el valor UB usado.

## Validación

- `npm run lint`
- `npm run build`

## Pendientes

Ninguno para este arreglo puntual. No se hizo merge, push ni deploy.
