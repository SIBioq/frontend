# Excluir una determinación dentro de un submódulo de corroboración

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/exclusion-en-corroboracion |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

Acompañar el cambio del backend: cuando el usuario excluye una determinación del protocolo, debe salir del submódulo de corroboración en lugar de anular el grupo. La suma y la validación deben recalcularse en vivo con el nuevo conjunto de determinaciones.

## Qué se hizo

- Modificó `src/hooks/use-protocol-results.ts`, `useMemo` `estadoSubmodulos`: reemplazó el filtro anterior que descartaba el submódulo completo con un `.map()` que filtra las determinaciones excluidas de cada submódulo, seguido de un `.filter()` que descarta los submódulos que quedaron vacíos.
- Cambio de criterio: antes `s.determinaciones` traía todas las determinaciones; ahora se filtra en vivo `s.determinaciones.filter((id) => !determinacionesExcluidas.has(id))`. La suma y los faltantes se calculan sobre la lista filtrada.
- `protocol-results-loader.tsx` no requirió cambios: sólo consume las props ya calculadas del hook.
- Tests: `npm run build` limpio; `npm run lint` 0 errores, 28 warnings (igual al baseline).

## Decisiones

- **El mismo criterio que el backend**: ambos filtran determinaciones excluidas de la lista del submódulo, sin prorratear `total_esperado` ni `tolerancia`. Una determinación excluida es una que no correspondía medir.
- **En vivo, sin retrasos**: el `useMemo` recalcula en el mismo render si `results` o `submodulos` cambian, mostrando al usuario la suma actualizada mientras escribe.
- **Submódulo vacío desaparece**: si todas las determinaciones quedan excluidas, el submódulo no aparece en la UI.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/hooks/use-protocol-results.ts` | Cambió criterio de `estadoSubmodulos`: filtra determinaciones excluidas en lugar de descartar el submódulo completo |

## Cómo se probó

```bash
# Frontend: compilación y lint sin errores
npm run build && npm run lint
```

Compilación: 0 errores de TypeScript; lint 0 errores (28 warnings previos a la rama).

## Pendiente

Nada.
