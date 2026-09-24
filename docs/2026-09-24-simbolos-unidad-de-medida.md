# Botones de símbolos en la unidad de medida

## Pedido

Agregar botones al campo de unidad de medida de las determinaciones para los
símbolos que no están a mano en el teclado (por ejemplo, el micro). Cada botón
escribe su símbolo donde está el cursor del campo, o al final si el cursor no
está ahí.

## Cambios verificados

- Abajo del campo aparecen seis botones: `µ`, `°`, `Δ`, `·`, `×` y `‰`. El
  campo es el mismo en las tres pantallas: crear determinación, editarla y
  cargarla dentro del alta de un análisis.
- Los símbolos se eligieron a partir de las unidades que ya tiene el catálogo
  (`µg/dL`, `µUI/mL`, `ΔDO450`) y de otras habituales en laboratorio (`°C`,
  `mmol·L`, `‰`). No hay botón para `%` ni `/`, que están en el teclado. Los
  supraíndices tampoco tienen botón propio: siguen escribiéndose con `x²`.
- Con el cursor en el campo, el símbolo entra en esa posición y reemplaza lo
  que esté seleccionado. El foco se queda en el campo y el cursor queda justo
  después del símbolo.
- Si el cursor no está en el campo, el símbolo se agrega al final.
- El micro se guarda como U+00B5 (MICRO SIGN), el mismo carácter que ya usa el
  catálogo. Usar la mu griega (U+03BC) haría que dos unidades que se ven
  iguales no coincidan.

## Archivos

- `src/components/configuration/components/input-unidad-de-medida.tsx`

## Pruebas

- `npm run build` sin errores y `eslint` limpio sobre el archivo.
- Prueba manual del componente montado solo, en escritorio y a 375 px de ancho:
  - sin foco, `µ` se agrega al final;
  - con el cursor al principio, `µ` entra ahí y lo que se escribe después va
    detrás;
  - con un texto seleccionado, `°` lo reemplaza.

## Pendientes

Ninguno.
