# Quitar «Lo hizo» del libro diario

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/libro-diario-sin-lo-hizo |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

Tras revisar la pantalla anterior, cambio de criterio de producto: no importa quién hizo el gasto, importa de dónde salió la plata. Quitar el selector «Lo hizo» del modal, dejar solo «Registrado por» en las filas (quién lo cargó al sistema, automático), y aclarar en el modal que el bloque de forma de pago pregunta de dónde sale o a dónde entra el dinero.

## Qué se hizo

- Modal: se eliminó el selector «Lo hizo» con la lista de usuarios activos.
- Modal: se removieron `usuarioId`, `personas`, el tipo `Persona`, la función `nombreDe`, el `useEffect` que pedía `USER_ENDPOINTS.USERS`, y el import de `Select*` y `useAuth`.
- Modal: el POST deja de mandar `usuario` en el payload (el backend lo llena con `request.user` automáticamente si no llega).
- Modal: el bloque de forma de pago ahora se titula «¿De dónde sale la plata? *» para gastos y «¿A dónde entra la plata? *» para ingresos (sigue siendo obligatorio).
- Componente `FormaDePago`: se agregó prop opcional `titulo?: string` con default `"Forma de pago"` para permitir títulos personalizados; los dos consumidores existentes (`payment-dialog`, `forma-de-pago-dialog`) sin cambios.
- Libro diario: se eliminó la fila «Lo hizo» que mostraba `usuario`. Queda solo «Registrado por» con `registrado_por`, simplificándose el contenedor sin cambiar su apariencia.
- Comentario del encabezado del modal: se reescribió `QUIÉN LO HIZO NO ES SIEMPRE QUIEN LO CARGA` explicando que el backend guarda automáticamente quién cargó el movimiento y que lo importante es dejar clara la forma de pago y la descripción.

## Decisiones

- **No mandar `usuario` es seguro**: el serializer backend (`billing/serializers.py:477`) rellena automáticamente `validated_data['usuario'] = actor` (donde `actor = request.user`) si no llega el dato. El campo en la API es opcional (`null=True, blank=True` en `billing/models.py:485`) y no quedará nulo.
- **Sin cambios en backend**: el campo `usuario` sigue existiendo en la API, redundante con `registrado_por`. Retirarlo requiere análisis de `analytics/services.py:1005` (que arma la clave `usuario` de la fila) y `billing/tests_movimientos_de_caja.py:110`. Es tarea aparte, fuera del alcance de este cambio.
- **Prop opcional en `FormaDePago`** en lugar de duplicar el bloque: respeta OCP (Open/Closed Principle); los dos consumidores existentes siguen igual, el modal pasa su propio título.
- **Título dinámico según tipo**: el modal calcula el título (gasto vs ingreso) y lo pasa, aplicando el patrón Experto en Información (el dato vive donde se decide).

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/components/caja/movimiento-de-caja-dialog.tsx` | Eliminó selector usuario, imports no usados, agregó prop `titulo` dinámico a FormaDePago, actualizó comentario de encabezado |
| `src/components/caja/libro-diario-page.tsx` | Eliminó fila «Lo hizo», simplificó contenedor de atributos, comentó que el backend sigue mandando `usuario` pero no se usa |
| `src/components/common/forma-de-pago.tsx` | Agregó prop `titulo?: string` con default "Forma de pago", usada en el Label del bloque |

## Cómo se probó

```bash
npm run build
```
Resultado: sin errores de tipos, build limpio.

```bash
npm run lint
```
Resultado: 28 warnings (igual al baseline anterior, sin errores nuevos).

## Pendiente

Retirar el campo `usuario` del backend en su totalidad (`billing/models.py`, `billing/serializers.py`, `analytics/services.py:1005`, `billing/tests_movimientos_de_caja.py:110`). Requiere análisis de dependencias y pruebas. No entra en el alcance del frontend.
