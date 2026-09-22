# Análisis sin resultado en la app clínica

## Pedido

Permitir configurar si un análisis lleva resultado y reflejarlo en catálogo, protocolos e informes.

## Cambios

- Alta, edición y detalle del catálogo muestran «Lleva resultado»; el alta comienza en `Sí`.
- El contrato TypeScript incorpora `lleva_resultado` en análisis y detalles de protocolo.
- Un análisis con `No` permanece visible en el protocolo como «No lleva resultado», sin badges pendientes ni acciones de carga o validación.
- El selector del informe clínico no ofrece análisis sin resultado.

La configuración enviada por el backend es la única fuente de verdad; la interfaz no reconoce códigos NBU especiales.

## Verificación

- `npm run build`: OK.

## Pendiente operativo

La rama no fue integrada ni desplegada.
