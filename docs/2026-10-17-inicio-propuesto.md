# Inicio nuevo y barra de navegación de tres formas

| | |
|---|---|
| **Fecha** | 2026-10-17 |
| **Rama** | feature/inicio-propuesto (misma rama en backend) |
| **Estado** | hecho, sin desplegar |
| **Tipo** | feature |

## Qué se pidió

Programar el inicio rediseñado (canvas «Inicio» y prototipo «Inicio en
movimiento»), con la barra de navegación de la nota de diseño 1, para
desplegarlo antes de seguir con Ingreso y el resto de las pantallas, de
izquierda a derecha en la barra. Sin la nota «sólo con permiso» ni la flechita
de abierto/cerrado en el menú del usuario.

## Qué se hizo

### Inicio (`src/components/home.tsx` y `src/components/inicio/`)

- Un solo pedido a `/analytics/dashboard/inicio/?mes=&alcance=` (contrato en
  `backend/docs/API_ANALYTICS.md`). Clave `["analytics","inicio",año,mes,alcance]`,
  `keepPreviousData` al cambiar de mes, refresco cada 60 s en el mes en curso.
- Encabezado: saludo, mes con ‹ ›, «Comparar con» (mes anterior, 3, 6 o 12
  meses, siempre hasta el mismo día) y la cifra de completados con su tramo
  («vs. el 1 al 17 de septiembre»). Un «siempre» guardado de antes pasa a mes
  anterior. Un mes cerrado avisa que no muestra pendientes.
- Bloques:
  - `pacientes-atendidos.tsx`: hoy, semana, mes y crecimiento; línea de 26
    semanas contra el año anterior (cortada donde no hay datos), la semana
    elegida por día con el «día normal» y los feriados, y mes por mes.
  - `resultados.tsx`: por cargar, por validar y urgentes, cada uno enlazado a
    su lista filtrada.
  - `caja.tsx`: hoy (por cuenta, efectivo neto, falta cobrar, desglose), el
    mes, seis semanas por forma de pago (cada día abre la caja de ese día) y lo
    pendiente. «Ver el libro diario» sólo con `MANAGE_LEDGER`.
  - `papeles.tsx` y `facturacion.tsx`: lo que falta resolver, enlazado.
  - `como-viene-el-mes.tsx`: tiempos, obras sociales (protocolos o UB, top 4 y
    «Otras N»), urgentes más pedidos y pacientes por lugar.
  - `piezas.tsx` / `movimiento.ts`: piezas comunes (`Dato`, `RenglonConEnlace`,
    `retraso`, `useCuenta`).
- Todo el reacomodo usa container queries (`@container` en el inicio y
  `@min-[Npx]:` en cada bloque), así que responde al ancho de la página y no
  al de la ventana.
- `index.css`: la línea se dibuja con `clip-path` y no con `stroke-dasharray`,
  que se rompe con `vector-effect: non-scaling-stroke`.

### Enlaces que llegan filtrados

- `protocolos-page.tsx` lee de la URL `status`, `is_printed`,
  `payment_status`, `urgente` y `falta_papel`, y después limpia la URL. Los dos
  últimos no se guardan como filtro persistente: aparecen como chips que se
  sacan con un toque («Urgentes sin cerrar», «Les falta un papel de obra
  social · últimos 90 días»).
- `results-page.tsx` lee `status` y `exclude_status` al entrar.

### Barra de navegación

- `navbar.tsx` elige entre tres formas midiendo un clon invisible (`inert`) con
  `ResizeObserver`: **completa** (enlaces a los dos lados del logo),
  **dos pisos** (logo y usuario arriba, enlaces abajo, desde ~791 px) y
  **celular** (buscador y hamburguesa). `forma-de-la-navbar.ts` guarda la
  última forma para estimar la primera pintura.
- `user-dropdown.tsx`: botón con iniciales o foto y nombre recortado, sin
  flechita; el menú se despliega desde la esquina, navegable con flechas,
  Inicio/Fin y Esc (devuelve el foco al botón).
- `user-menu-items.ts`: Mi perfil, Configuración, Gestión de usuarios,
  Facturación, Contingencia, Superconfiguración. El libro diario pasó a la
  barra, junto a Resultados y Validación.

## Decisiones

- **«Impresos con pago incompleto» pasó a «Pendiente»** de la caja, que viaja
  sólo con el permiso de facturación. Antes la tarjeta la veía cualquiera.
- **La caja del día se ve sin permiso especial**, igual que los endpoints
  `/caja/` y `/pendiente/` que ya existían.
- `pendiente-del-sistema.tsx` y `carrusel-deslizable` quedan sin uso (sólo los
  usaba el inicio viejo); no se borraron para no generar conflictos con otras
  ramas.

## Archivos tocados

- `src/components/home.tsx`, `src/components/inicio/*` (nuevos)
- `src/components/navbar.tsx`, `src/components/user-dropdown.tsx`,
  `src/components/session-notification-toggle.tsx`
- `src/components/protocolos/protocolos-page.tsx`,
  `src/components/results/results-page.tsx`
- `src/config/api.ts`, `src/config/user-menu-items.ts`
- `src/lib/forma-de-la-navbar.ts`, `src/index.css`

## Cómo se probó

- `npm run build` y `npm run lint` limpios.
- Contra la base local de prueba con datos ficticios, a 1440, 1100, 820, 375 y
  360 px: sin scroll horizontal, la forma de la barra esperada en cada ancho,
  ítems de 48 px en el menú del celular, Esc devuelve el foco, cerrar sesión
  desde el menú nuevo y un mes cerrado con su aviso.
- Cada enlace abre una lista con la misma cantidad que la cifra del inicio.

## Arreglos después del primer despliegue

Lo que se vio en producción y cómo se corrigió (rama `fix/inicio-en-produccion`):

- **El gráfico «Semana por semana» se salía de su tarjeta.** La escala del eje
  dejaba afuera las semanas en cero. Con semanas parejas (por ejemplo, entre
  400 y 600) el eje arrancaba en 400, y una semana sin pacientes se dibujaba
  por debajo del gráfico, encima de lo que sigue. Ahora la escala sale de todo
  lo que se dibuja y cada punto queda dentro del rango.
- **Textos que se pisaban o se salían.** El rótulo de la semana en curso va
  del lado contrario al de la última semana completa. La fecha «esta» del
  eje se alinea a la derecha, y el encabezado ya no aprieta «Resumen
  operativo del laboratorio» en tres renglones.
- **Poco contraste.** Las tarjetas eran blancas al 70 % sobre el fondo gris
  de la app (`#adadad`, con la marca de agua), así que se veían grises.
  Ahora son blancas opacas. Los títulos de grupo y la bajada de Resultados,
  que van directo sobre el gris, pasan a casi negro. Los días futuros pasan
  de `slate-400` a `slate-500`.
- **En el celular, la barra mostraba el nombre al lado del avatar.** Va sólo
  el avatar; el nombre está adentro del menú.

## Pendiente

- Las comparaciones «contra hace una semana» de papeles, plata y facturación
  aparecen a los siete días de desplegar.
- Rediseño de Ingreso y de las pantallas que siguen en la barra.
