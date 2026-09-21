# Hotfix del precio particular por UB en protocolo

## Pedido

Corregir la actualización del precio particular por UB y rediseñar su modal respetando la estética existente.

## Hallazgos

- El botón sólo se muestra cuando `hasPermission` encuentra `actualizar_precio_particular_protocolo`.
- `PrivatePriceDialog` valida el monto, normaliza coma decimal a punto y entrega un `string` al callback.
- El protocolo expone `precio_particular_ub` y el desglose expone `private_ub_value_used`.
- `PROTOCOL_ENDPOINTS.ACTUALIZAR_PRECIO_PARTICULAR` construye correctamente el endpoint.
- `useApi().apiRequest` agrega `Content-Type: application/json` y serializa automáticamente el `body` con `JSON.stringify`.
- El contrato actual requiere un objeto JSON con `precio_particular_ub`; el envío queda alineado con ese contrato.

## Cambio

El handler pasa `body: { precio_particular_ub: price }` y deja la serialización a `apiRequest`. Tras el POST exitoso fuerza un GET del detalle, invalidando el estado anterior antes de aplicar el resultado; si el GET falla, la card no presenta el detalle viejo como actualizado y el modal informa la recarga fallida. El modal muestra el snapshot `billing_breakdown.private_ub_value_used` (con fallback al override del protocolo) y, separado, el valor vigente de la OOSS particular `private_ub_value`. El formulario usa `onSubmit` y botón `submit`, por lo que Enter guarda. Se mantiene el botón azul y `canUpdatePrivatePrice`.

## Diagnóstico de permisos y API

La pantalla de administración carga permisos desde `AC_ENDPOINTS.PERMISSIONS` con paginación y búsqueda; no hay una lista estática ni un filtro frontend que elimine permisos legítimos. `ManagementPage` usa el mismo endpoint con `limit=100` para roles, y `PermissionManagement` vuelve a consultar con `limit=20`, offset y search. La configuración de API sólo define la base dinámica (`VITE_API_BASE_URL` o `window.__LABSALUD_API_BASE__`) y la ruta `/ac/permissions/`; no construye una URL de “todo junto”. No se cambió ese flujo ni se filtraron permisos.

## Validación

- `npm run lint`
- `npm run build`
- Verificación estática dirigida de `AC_ENDPOINTS.PERMISSIONS`, `ManagementPage` y `PermissionManagement`.

## Pendientes

No se agregó endpoint ni campo: ambos valores requeridos ya existen en el contrato del detalle. No se hizo merge, push ni deploy.
