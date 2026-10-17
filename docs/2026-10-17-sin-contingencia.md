# Sin contingencia: fuera la pantalla, el permiso y la cola de envíos

| | |
|---|---|
| **Fecha** | 2026-10-17 |
| **Rama** | feature/sin-contingencia (misma rama en backend) |
| **Estado** | hecho, sin mergear |
| **Tipo** | refactor |

## Qué se pidió

«Saques contingencia, limpiá todo lo que se refiera a la contingencia, no se
utiliza más.» El backend retira la app `sync_feed` en la misma rama (ver
`backend/docs/2026-10-17-sin-contingencia.md`).

## Qué se hizo

- Se borró `src/components/contingencia/`: la pantalla `/contingencia`, los
  pendientes del servidor, el diálogo «¿lo mando cuando vuelva la conexión?»
  (`ConfirmarEnvio`) y `pedirInforme`.
- `App.tsx`: fuera la ruta `/contingencia` y el `<ConfirmarEnvio />` global.
- Los envíos de informe (acción rápida, tarjeta del protocolo, lote e informe
  unificado) llaman directo a `apiRequest(url, { method: "POST", body })`. El
  servidor ya no contesta `202 en_cola`, así que desaparecen las ramas
  «se canceló» y «queda esperando».
- `config/api.ts`: fuera `CONTINGENCY_ENDPOINTS` y la API inyectada en
  ejecución (`window.__LABSALUD_API_BASE__`), que solo la ponía la app de
  escritorio de la PC. La base sale de `VITE_API_BASE_URL`.
- `config/permissions.ts`: fuera `UPLOAD_CONTINGENCY`.
- Menú de usuario y título de pestaña: fuera «Contingencia».
- `types/index.ts`: fuera los tipos del diario de contingencia.
- Comentarios que nombraban la PC (`use-protocol-list-nav`,
  `use-protocol-results`, `result-formulas`, `seguimiento-de-whatsapp`)
  reescritos con la razón que sigue valiendo.

## Decisiones

- `mismaApi()` en `use-protocol-list-nav.ts` se queda: corrige el host del
  `next` de DRF, que detrás de un proxy no tiene por qué ser el de la app.
- Los documentos fechados (`2026-10-17-inicio-propuesto.md`,
  `plan/libro-diario-sin-lo-hizo.md`) no se tocan: cuentan lo que era cierto
  cuando se escribieron.

## Cómo se probó

- `npm run build` limpio.
- `npm run lint`: sin errores; ninguno de los avisos que quedan es de un
  archivo tocado.

## Pendiente

- Mergear junto con la rama del backend: sin ella, el backend sigue
  ofreciendo `/sync/` y el permiso, sin pantalla que los use.
