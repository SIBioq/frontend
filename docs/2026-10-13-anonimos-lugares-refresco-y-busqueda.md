# Anónimos en el listado, pacientes por lugar, refresco de listados y búsqueda por número

| | |
|---|---|
| **Fecha** | 2026-10-13 |
| **Rama** | feature/anonimos-y-pacientes-por-lugar (misma rama en backend) |
| **Estado** | hecho |
| **Tipo** | feature + fix |

## Qué se pidió

1. En el listado de pacientes, un anónimo muestra lo que tenga cargado: el
   nombre si lo tiene, el DNI si lo tiene. Sólo lo que falta dice "Paciente
   anónimo" / "ANÓNIMO".
2. Al final del inicio, los pacientes de cada lugar.
3. Que las pantallas muestren lo último después de crear, modificar o
   eliminar. Ejemplo: eliminar un paciente desde su ficha volvía al listado con
   el paciente todavía ahí, hasta recargar.
4. El buscador de Protocolos: por número de protocolo (ese y los anteriores),
   DNI sólo completo, y que ignore los filtros puestos.

## Qué se hizo

- `patients-table.tsx`: `fullName` y `dniCell` muestran el dato si existe, y el
  rótulo de anónimo sólo en lo que falta.
- `home.tsx`: sección "Pacientes por lugar" con barras, los 10 lugares con más
  pacientes y "Ver los N lugares restantes". Lee `pacientes_por_lugar` de
  `/analytics/dashboard/mes/`.
- `lib/query-client.ts` (nuevo): el `QueryClient` salió de `App.tsx` y se agregó
  `marcarTodoComoViejo()`.
- `use-api.tsx`: después de cada escritura (`POST`/`PUT`/`PATCH`/`DELETE`) que
  responde OK se llama a `marcarTodoComoViejo()`.
- `auth-context.tsx`: `logout` y `expireSession` hacen `queryClient.clear()`.
- `patient-detail-page.tsx`: al eliminar, se saca al paciente de los listados
  cacheados antes de volver.
- `protocolos-page.tsx`: con búsqueda no se mandan los filtros (estado,
  impreso, pago, fechas) ni entran en la queryKey; aviso "Buscando en todos los
  protocolos…" si hay filtros puestos; placeholder y estado vacío nuevos.

## Decisiones

- **Refresco central y no pantalla por pantalla.** Cada pantalla ya refrescaba
  lo suyo; lo que fallaba era el cache de otra pantalla, vigente 60 s
  (`staleTime`). Todas las escrituras pasan por `apiRequest`, así que ahí se
  marca todo viejo una sola vez (también con escrituras deduplicadas).
- **`refetchType: "none"`**: no se recarga lo que está en pantalla, para no
  pisar un formulario a medio llenar. La próxima vez que se monta una consulta
  muestra lo cacheado y pide lo nuevo por detrás.
- **Vaciar el cache al cerrar sesión.** Antes, quien entraba después en la
  misma pestaña veía hasta 5 minutos (`gcTime`) los listados del anterior,
  incluso los que su rol no puede pedir. Importa sobre todo en el cierre por
  inactividad del mostrador.
- **Buscar ignora filtros sólo en Protocolos** y sin tocarlos: al borrar la
  búsqueda vuelven los que estaban.

## Archivos tocados

- `src/App.tsx`
- `src/lib/query-client.ts` (nuevo)
- `src/hooks/use-api.tsx`
- `src/contexts/auth-context.tsx`
- `src/components/home.tsx`
- `src/components/patients/components/patients-table.tsx`
- `src/components/patients/patient-detail-page.tsx`
- `src/components/protocolos/protocolos-page.tsx`

## Cómo se probó

- `npm run build` y `npm run lint` limpios.
- Comportamiento del cache verificado con un script sobre `@tanstack/query-core`:
  sin el arreglo, volver al listado no lo pide; con el arreglo sí; `clear()`
  deja el cache vacío.
- No se probó en el navegador: la app local pide iniciar sesión.

## Pendiente

- Dentro de una misma pantalla, el refresco sigue dependiendo de cada pantalla
  (callbacks e invalidaciones propias). No se encontraron casos rotos.
