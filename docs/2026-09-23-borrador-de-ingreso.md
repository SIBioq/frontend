# Borrador de ingreso: guardar y restaurar automáticamente

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | fix/borrador-ingreso-precargado |
| **Estado** | hecho |
| **Tipo** | arreglo |

## Qué se pidió

Cuando entro a ingreso con un borrador guardado, quiero el formulario como lo dejé, no vacío. El cartel de aviso sigue ahí, pero ya no hace falta apretar «Continuar» para ver los datos. Si elijo «Descartar», se reinicia el formulario a vacío.

## Qué se hizo

- **Auto-restauración al entrar**: el formulario se repone apenas termina de cargar la pantalla, sin esperar que el usuario apriete «Continuar». El cartel se queda solo como aviso. Se espera a que `isLoading` sea falso para que `sendMethods` ya esté disponible (necesario para reponer el método de envío guardado).
- **«Continuar» baja el cartel únicamente**: restauración ya ocurrió de forma automática en casi todos los casos, así que el botón pasó a ser solo un cierre visual del aviso.
- **«Descartar» reinicia todo**: ahora llama a `handleReset` completo (vacía el formulario), no solo borra el borrador del storage. Eso sí cumple la expectativa «empezá de cero».
- **Excepción: paciente preseteado**: si se entra con `location.state.patient` (desde la ficha del paciente, nuevo protocolo directo), no restaura solo; el cartel se comporta como antes, restaurando solo si aprietan «Continuar». La lógica de auto-restauración respeta ese `location.state`.
- **Guardado sigue durante el cartel**: una vez que el formulario quedó igual al borrador (`marcarComoRestaurado`), el auto-guardado se rehabilita aunque el cartel siga arriba. Antes estaba bloqueado mientras hubiera borrador pendiente.
- **Señal de restauración**: un `Ref` (`restauracionArrancadaRef`) evita pedir datos dos veces (por efectos concurrentes en `StrictMode` o colisión de auto-restauración + clic en «Continuar»).

## Decisiones

- **Restauración automática siempre que sea seguro**. Se restaura auto al entrar, pero no cuando hay un paciente preseteado: ese contexto ganador (la intención explícita del usuario desde otra pantalla) pesa más que un borrador anterior.

- **Separación: restauración lógica vs visual**. La restauración de datos es una operación (`restaurarBorrador`, pedir al backend) separada de bajar el cartel. Así, la auto-restauración tira de la lógica sin tocar la UI, y «Continuar» solo maneja la UI (baja el cartel). Evita acoplamiento.

- **«Continuar» sin hacer nada en el caso normal**. Si llega auto-restauración primero, el click en «Continuar» es casi un no-op: `restauracionArrancadaRef` está en true, así que no re-inicia nada, solo baja el cartel. Eso mantiene la responsabilidad clara de cada botón.

- **Guardado: sólo ids, sin PHI**. Se mantiene la decisión anterior: localStorage guarda ids numéricos y número de afiliado. El backend provee entidades frescas al restaurar.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/hooks/use-borrador-de-ingreso.ts` | Renombró `olvidar()` → `ocultarCartel()`, `descartar()` → `marcarComoRestaurado()`, `borrar()` se usa para limpiar todo; agregó estado `yaRestaurado` para permitir guardado mientras el cartel siga visible; cambió lógica de guardado (ahora permite guardar si `yaRestaurado` es true aunque haya borrador pendiente) |
| `src/components/ingreso/ingreso-page.tsx` | Agregó efecto para restauración automática (`useEffect` que dispara `restaurarBorrador()` apenas termina `isLoading` y hay borrador, salvo paciente preseteado); agregó `vinoConPacientePreseteadoRef` y `restauracionArrancadaRef`; cambió «Descartar» a usar `handleReset` completo; creó `handleContinuarBorrador()` que restaura solo si no se ejecutó auto-restauración; cambió llamadas de `onContinuar` y `onDescartar` en `AvisoDeBorrador` |
| `src/components/ingreso/components/aviso-de-borrador.tsx` | Cambió copys: «Quedó este protocolo sin enviar» → «Recuperamos el protocolo que dejaste a medias»; ajustó explicación de los botones en comentarios (ahora «Continuar» solo baja cartel, «Descartar» borra y reinicia) |

## Cómo se probó

```bash
cd /Users/givecab/.codex-worktrees/borrador-ingreso-precargado/sibioq/frontend
npm run build       # tsc -b && vite build — limpio, sin errores de tipado
npm run lint        # 0 errores nuevos
git show b7bf45d    # Verificar el diff exacto
```

## Pendiente

Nada. Recorrido manual pendiente igual al documento anterior: entrar con borrador, ir a otra pantalla, volver, ver auto-restauración, probar «Continuar» y «Descartar», caso de paciente preseteado.
