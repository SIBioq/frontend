# Corrección del precio particular por protocolo

## Pedido

Investigar el `POST /protocols/protocols/:id/actualizar-precio-particular/` que respondía 400 con el mensaje de que el cuerpo debía ser un objeto JSON con `precio_particular`.

## Hallazgos

- El botón sólo se muestra cuando `hasPermission` encuentra `actualizar_precio_particular_protocolo`.
- `PrivatePriceDialog` valida el monto, normaliza coma decimal a punto y entrega un `string` al callback.
- `PROTOCOL_ENDPOINTS.ACTUALIZAR_PRECIO_PARTICULAR` construye correctamente el endpoint.
- `useApi().apiRequest` agrega `Content-Type: application/json` y serializa automáticamente el `body` con `JSON.stringify`.
- `protocol-card.tsx` serializaba manualmente el objeto antes de entregarlo a `apiRequest`. Eso provocaba doble serialización: el servidor recibía un string JSON en vez de un objeto JSON.

## Cambio

El handler pasa ahora `body: { precio_particular: price }` y deja la serialización a `apiRequest`. Se mantienen el permiso previo al envío, el header JSON, la lectura del error de respuesta, el mensaje fallback y la actualización del detalle tras éxito.

## Validación

- `npm run lint`
- `npm run build`

## Pendientes

Ninguno para este arreglo puntual. No se hizo merge, push ni deploy.
