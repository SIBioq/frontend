# Confirmación de redondeo y refresco del protocolo

## Pedido

Actualizar el detalle al volver del libro diario y pedir confirmación cuando un pago supera el saldo.

## Cambio

- El detalle del protocolo fuerza la consulta al montarse y al recuperar el foco.
- Un pago mayor al saldo abre un diálogo con “Redondear”, que registra el monto completo, o “Cobrar justo”, que registra sólo el saldo y devuelve la diferencia al paciente.
- Se mantiene habilitada la devolución para excedentes que ya quedaron registrados y superan el tope.

## Validación

- `npm run build`
- `npm run lint` (sin errores; 28 advertencias preexistentes)

## Deploy

No se hizo merge, push ni deploy.
