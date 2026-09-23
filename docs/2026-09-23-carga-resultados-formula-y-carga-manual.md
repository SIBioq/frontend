# Carga a mano debajo del input + fórmula al hacer hover

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/carga-resultados-formula |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

En la carga de resultados de un protocolo, dos mejoras de UX: 1) el botón "Cargar a mano" está hoy en la cabecera de la fila confundido con los badges de estado, debe ir debajo del input del valor, 2) al pasar el mouse (o enfocar con Tab) en el badge "Auto" de una determinación calculada, mostrar la fórmula y los valores reales con los que se llegó al resultado, para que la bioquímica pueda auditar la cuenta.

## Qué se hizo

- Movió el botón "Cargar a mano" de la cabecera de la fila a debajo del input del valor, dentro de la columna `lg:w-48`, con separación clara (`mt-3`). El botón ganó `aria-pressed` y `aria-label` con el nombre de la determinación para accesibilidad.
- Creó función pura `describirFormula` en `result-formulas.ts` que devuelve `ExplicacionFormula` (fórmula original, lista de tokens con nombres y valores, lista de componentes faltantes, y resultado calculado). Tokeniza la fórmula respetando operadores, números y referencias a componentes, reutilizando funciones existentes (`normalizeExpression`, `buildResultCodeMap`, `resolveRelativeCode`, `calculateFormulaValue`).
- Creó componente `FormulaHoverCard` que envuelve el badge de fórmula y abre una tarjeta al hover (150ms) mostrando la fórmula con nombres, la misma con valores reales (faltantes como `−` en rojo), `= resultado` (en rojo si no calculó), y línea `Falta: <nombre>` por componente sin cargar. El disparador es un `<button>` enfocable, así que Tab también abre la tarjeta.
- Agregó tipografía "STIX Two Text" de Google Fonts en `index.html` (preconnect + link con `display=swap`) y token `--font-matematica` en `src/index.css` (bloque `@theme` que habilita la utilidad `font-matematica` de Tailwind v4) para que operadores (`×`, `÷`, `−`, `^`) y números se lean legibles sin librería de tipesetting.
- Modificó `protocol-results-loader.tsx` para calcular la `formulaExplicacion` y pasarla a cada fila.

## Decisiones

- **Sin KaTeX ni librería de math**: una determinación calculada puede mostrar `([cod_3] × 10) ÷ [cod_1]` en una tarjeta de hover; expresiones de una línea no justifican ~280 kB de KaTeX. Tipografía "STIX Two Text" por Google Fonts alcanza para que signos y números se lean bien sin sumar dependencias.
- **Sin layout de fracción**: al escribir `÷` la fórmula ya se lee correcta y los paréntesis están en la fórmula original. Si aparecen fórmulas anidadas en el futuro, la evolución es pasar de lista de tokens a AST y render recursivo detrás de `describirFormula`, sin tocar el componente.
- **Función pura separada**: `describirFormula` no toca React ni el DOM; la calcula una sola vez en `protocol-results-loader.tsx` (que ya tiene `results` y `values` a mano) y la pasa como prop a la fila. Reutiliza funciones de cálculo y mapeo que ya estaban en `result-formulas.ts`.
- **Sin tests**: el repo no tiene vitest ni runner de tests centralizado. No se agregó infraestructura de testing para esta tarea.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/components/results/components/result-determination-row.tsx` | Movió botón debajo del input; nueva prop `formulaExplicacion` opcional; con explicación envuelve badge en `FormulaHoverCard` |
| `src/lib/result-formulas.ts` | Agregó tipos `TokenFormula`, `ComponenteFaltante`, `ExplicacionFormula` y función `describirFormula` |
| `src/components/results/components/formula-hover-card.tsx` | Componente nuevo, renderiza tarjeta de hover con fórmula tokenizada y valores |
| `index.html` | Preconnect a `fonts.googleapis.com` / `fonts.gstatic.com`; link a `STIX+Two+Text:ital,wght@0,400;0,600` con `display=swap` |
| `src/index.css` | Bloque `@theme` con token `--font-matematica` (habilita utilidad `font-matematica` de Tailwind v4) |
| `src/components/results/components/protocol-results-loader.tsx` | Calcula `formulaExplicacion` por cada resultado y la pasa a `ResultDeterminationRow` |

## Cómo se probó

```bash
# Compilación
npm run build

# Lint
npm run lint

# Resultado: 0 errores de TypeScript, 28 warnings (baseline previo a la rama)
```

Prueba manual (sin framework de test centralizado):
1. Abrir un protocolo con determinaciones calculadas (con `formula` en la base)
2. Verificar que el botón "Cargar a mano" aparece debajo del input (no en cabecera)
3. Pasar el mouse sobre el badge "Auto": se abre tarjeta con fórmula en nombres + valores
4. Si falta un componente: valor muestra `−` en rojo, y aparece línea "Falta: <nombre>"
5. Presionar Tab sobre el badge: tarjeta también se abre (enfocabilidad)
6. Cambiar a carga a mano: badge pasa a "A mano" violeta, tarjeta dice "La fórmula está de lado"

## Pendiente

Nada. Las dos funciones pedidas se implementaron completas. El plan técnico en `docs/plan/carga-resultados-formula-y-carga-manual.md` quedó versionado a propósito para referencia; puede descartarse en un commit futuro de limpieza.
