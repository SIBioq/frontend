# Autor visible en el libro diario

## Análisis y contrato

Ticket único frontend, rama `feature/autor-libro-diario`. Backend entrega `registrado_por` como string en cada `pagos[]` agrupado y fila de caja; `usuario` de caja identifica a quien hizo el movimiento. El frontend consulta `agrupado=protocolo`. Fila de protocolo expandida hoy muestra sólo `CorreccionDelCobro` bajo `puedeCorregir`.

Requisito funcional: mostrar todos los pagos y devoluciones del protocolo expandido, cada uno con monto, fecha si existe, medio de pago y «Registrado por»; detalle legible aunque no se rendericen controles de corrección. En caja, mostrar «Lo hizo» para `usuario` y «Registrado por» para `registrado_por`, aun si difieren. Ante autor histórico ausente o vacío, mostrar «No informado» sin atribuirlo al usuario actual.

Requisito no funcional: texto en español rioplatense, jerarquía visual sobria y lectura accesible; conservar permisos, llamadas, edición, resumen y orden. No tocar backend ni modo no agrupado. No commit, merge ni push.

Casos de uso: (1) abrir protocolo con varios cobros y devolución: aparecen todos, cada autor correspondiente; (2) abrir protocolo sin controles de corrección: mismos datos de lectura; (3) consultar caja: ejecutor y registrador con etiquetas distintas; (4) leer pago/caja histórico sin autor: «No informado».

## Diseño → pruebas → implementación

Un coder modifica sólo `src/components/caja/libro-diario-page.tsx`. Extender tipos locales `PagoEnLibro` y `FilaAgrupada` con `registrado_por` opcional (histórico), mantener `usuario` con semántica de ejecutor. La página presenta detalle de sólo lectura; `CorreccionDelCobro` conserva responsabilidad exclusiva de corregir y su condición de permiso. Reusar estilos y HTML semántico existentes; no crear abstracciones para una sola pantalla. Sin diagrama UML: una única vista, sin nueva interacción entre componentes.

Aceptación: `pagos[]` completo visible al expandir, con y sin corrección; caja diferencia ambos autores; fallback explícito; sin cambios de permisos/endpoint ni efectos sobre cálculos. Arquitecto revisa diff y corre `tsc` y ESLint acotados. Documentación final queda para documentador posterior.

Nota contractual: ruta y endpoint hoy exigen `MANAGE_LEDGER`, mismo permiso de corrección. Este ticket desacopla presentación de datos y controles dentro de pantalla; no concede acceso nuevo.

## Estado

Completado. Implementación y revisión frontend verificadas en `feature/autor-libro-diario`.
