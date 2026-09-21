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

El handler pasa `body: { precio_particular_ub: price }` y deja la serialización a `apiRequest`. El modal muestra valor actual, alcance “Solo este protocolo” y ayuda sobre OOSS, catálogo y otros protocolos; conserva el permiso previo al envío y es responsive. El detalle de facturación muestra el valor UB usado.

## Validación

- `npm run lint`
- `npm run build`

## Pendientes

Ninguno para este arreglo puntual. No se hizo merge, push ni deploy.
