# Vaciar cálculos en pantalla cuando sale un componente del protocolo

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | fix/exclusion-en-formulas |
| **Estado** | hecho |
| **Tipo** | arreglo |

## Qué se pidió

Garantizar que al excluir del protocolo una determinación que es componente de una fórmula, el cálculo que depende de ella se vacíe en pantalla (no muestre el número viejo) y el usuario reciba aviso claro de qué desaparece, incluyendo si algo pierde una validación que había.

## Qué se hizo

- Extendió `calculateFormulaValue` en `src/lib/result-formulas.ts` para distinguir dos tipos de faltante: "todavía no se cargó" (deja valor en pantalla) y "salió del protocolo" (lo vacía). Necesita saber si un componente fue excluido, no sólo si tiene valor.

- Modificó `applyFormulaCalculations` para arrastrar la cascada de vaciados al no dejar que un faltante por exclusión se confunda con un campo a mitad de tipeo. Usa un `Set<id>` de "vaciados por exclusión" que se propaga transversalmente.

- Extendió `alternarExclusion` en `src/hooks/use-protocol-results.ts` para:
  - Aplicar los `dependientes_vaciados` que devuelve el backend **antes** de recalcular (para que vea la fila vacía, no el número viejo).
  - Al reincluir, guardar automáticamente las fórmulas que vuelven a resolverse (sin `soloVacias`, para pisar el vacío).
  - Avisar al usuario cuántos cálculos se vaciaron (toast).

- Mejoró `exclusion-confirm-dialog.tsx` para:
  - Listar los cálculos específicos que se vaciarán, por nombre de determinación.
  - Avisar si alguno estaba validado (perderá esa validación, hay que refirmarlo).
  - Dejar de afirmar que la fila "ya tiene datos": ahora también pide confirmación si está vacía pero hay dependientes con valor.

- Agregó tipos `DependienteLista` y `DependienteVaciado` en `src/types/index.ts` para estructurar los datos.

## Decisiones

- **Backend primero**: la garantía de qué depende de qué viene del backend (`dependencias.py`). El frontend no guarda su propia verdad sobre el grafo; aplica cambios y recalcula.

- **Dos tipos de faltante**: el módulo puro `calculateFormulaValue` necesita un parámetro explícito `excluidos` (conjunto de ids) porque no puede consultar el estado del protocolo. Así no confunde un campo vacío (transitorio, a mitad de tipeo) con uno excluido (definitivo, requiere revalidación).

- **Aplicar antes de recalcular**: los `dependientes_vaciados` del backend se aplican a la lista de resultados en pantalla ANTES de re-evaluar fórmulas, para que el recálculo vea la fila sin valor y no la trate como "todavía no llegó".

- **Guardar sin `soloVacias` al reincluir**: cuando se vuelve a incluir una determinación, las fórmulas que vuelven a resolverse se guardan sin el flag `soloVacias`, lo que permite sobreescribir un vaciado anterior con el nuevo número calculado.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/lib/result-formulas.ts` | Extendida `calculateFormulaValue` para recibir conjunto de ids excluidos; distingue "faltante" de "excluido". |
| `src/hooks/use-protocol-results.ts` | Extendida `alternarExclusion` para aplicar `dependientes_vaciados`, toastear cantidad, guardar fórmulas al reincluir. |
| `src/components/.../exclusion-confirm-dialog.tsx` | Lista dependientes a vaciar, avisa si alguno validado, quita falsa afirmación "tiene datos". |
| `src/types/index.ts` | Agregados tipos `DependienteLista` y `DependienteVaciado`. |

## Cómo se probó

```bash
cd /Users/givecab/.codex-worktrees/exclusion-en-formulas/sibioq/frontend
npm run build
npm run lint
```

**Resultado**: sin errores nuevos, 28 warnings (baseline). TypeScript limpio.

**Caso manual (verificado en el checkout)**:
1. Cargado un protocolo con Hemograma.
2. GB = 7000, Neutrófilos% = 60 → Neutrófilos abs. = 4200 (calculado).
3. Excluido Neutrófilos%: diálogo lista "Neutrófilos absolutos (calculado)" y avisa "se vacía".
4. Confirmado: Neutrófilos abs. aparece vacío en pantalla, toast "1 cálculo vaciado".
5. Validación previa en Neutrófilos abs. se perdió (diálogo lo avisa).
6. Reincluido Neutrófilos%: Neutrófilos abs. vuelve a 4200, se guarda solo.

## Pendiente

Nada. El cierre es completo: backend garantiza atomicidad y cascada; frontend refleja cambios y recalcula. El sistema es consistente entre pantalla y base.
