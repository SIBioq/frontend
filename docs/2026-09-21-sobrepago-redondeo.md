# Sobrepago en registrar pago

## Pedido

Permitir que el laboratorio registre un monto mayor al saldo cuando el paciente paga de más por redondeo.

## Cambio

El modal de “Registrar pago” ya no limita el monto máximo al saldo pendiente. Mantiene el botón “Total” para cargar el saldo exacto y explica que se puede ingresar un monto mayor. El backend ya acepta el sobrepago y aplica el tope de redondeo configurado; el excedente que supera ese tope continúa informándose para devolución.

## Validación

- `npm run build`
- `npm run lint` (sin errores; quedaron advertencias preexistentes)
- `python manage.py test laboratory.protocols.tests_redondeo` (13 pruebas OK)

## Deploy

No se hizo merge, push ni deploy.
