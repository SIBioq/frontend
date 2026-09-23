import type { Result } from "@/types"
import { unidadCompleta } from "@/lib/notacion"

/**
 * Los valores de un análisis, en una línea, para cuando está colapsado.
 *
 * POR QUÉ EXISTE
 * ==============
 * Colapsar servía para sacar ruido, pero escondía justo lo único que uno
 * quiere ver de un análisis ya cargado: los números. Había que abrirlo,
 * mirarlos y volver a cerrarlo — o dejarlo abierto, que es lo mismo que no
 * tener colapso.
 *
 * Colapsado se leen los valores; abierto se editan y se ven los rangos, las
 * notas y el resultado anterior. Cada estado sirve para algo distinto.
 *
 * Lo comparten la carga de resultados y la validación a propósito: son la
 * misma información y no tienen por qué verse de dos formas.
 */

type Props = {
  determinaciones: Result[]
  /** Cuántas mostrar antes de resumir con "+N". */
  tope?: number
}

export function ResumenDeResultados({ determinaciones, tope = 4 }: Props) {
  // Las excluidas quedan afuera: no intervienen en el protocolo ni salen en el
  // informe, así que tampoco tienen por qué figurar en el resumen del análisis.
  const conValor = determinaciones.filter((d) => !!d.value && !d.excluido)
  if (conValor.length === 0) return null

  const visibles = conValor.slice(0, tope)
  const resto = conValor.length - visibles.length

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600">
      {visibles.map((d) => (
        <span key={d.id} className="whitespace-nowrap">
          <span className="text-gray-500">{d.determination.name}</span>{" "}
          {/* El valor en negrita y con `tabular-nums`: son números que se
              comparan de un vistazo entre líneas. */}
          <span className="font-semibold tabular-nums text-gray-900">{d.value}</span>
          {unidadCompleta(d.determination.measure_unit, d.determination.scientific_exponent) ? (
            <span className="text-gray-400">
              {" "}
              {unidadCompleta(d.determination.measure_unit, d.determination.scientific_exponent)}
            </span>
          ) : null}
        </span>
      ))}
      {resto > 0 ? <span className="text-gray-400">+{resto}</span> : null}
    </span>
  )
}
