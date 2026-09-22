# Redondeo y medios de pago en caja

## Pedido

Confirmar el redondeo con una interfaz consistente y mostrar si cada ingreso o
egreso del libro diario fue en efectivo o por transferencia.

## Cambios

- Se unificó el diálogo de redondeo para registrar pago, ingreso de protocolo y
  registrar cobro desde el libro diario.
- “Cobrar justo” ajusta el importe antes de registrar el pago; “Redondear” deja
  asentado el total recibido.
- Los gastos e ingresos manuales muestran efectivo, transferencia y cuenta
  cuando corresponde.
- Los cobros de protocolos muestran explícitamente esa misma discriminación en
  cada pago, incluida la cuenta de la transferencia.

## Validación

- `npm run build`
- `npm run lint` — 0 errores; quedaron warnings preexistentes.
