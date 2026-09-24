import type React from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import type { ExplicacionFormula, TokenFormula } from "@/lib/result-formulas"

/**
 * PARA QUÉ ESTÁ ESTO
 * ==================
 * Una determinación calculada muestra un número, y ese número la bioquímica
 * no lo puede auditar a simple vista: no ve de dónde salió. Esta tarjeta,
 * al pasar el mouse (o enfocar el badge con el teclado), muestra la cuenta
 * con los valores reales que se usaron y, si la fórmula no calculó nada,
 * qué determinación falta para que calcule.
 */

interface FormulaHoverCardProps {
  explicacion: ExplicacionFormula
  /** La fórmula quedó de lado: el valor se carga a mano. */
  cargaManual: boolean
  /** El badge que dispara la tarjeta. */
  children: React.ReactNode
}

/**
 * Recorre los tokens de la fórmula una sola vez, mostrando nombres o valores
 * según `modo`. Evita duplicar el `map` entre la línea de nombres y la línea
 * de valores.
 */
function LineaDeFormula({ tokens, modo }: { tokens: TokenFormula[]; modo: "nombres" | "valores" }) {
  return (
    <>
      {tokens.map((token, index) => {
        // La lista de tokens es fija, derivada de la fórmula guardada: no se
        // reordena ni se filtra en pantalla, así que el índice alcanza como
        // key estable.
        const key = index

        if (token.tipo === "operador") {
          const sinMargen = token.texto === "(" || token.texto === ")"
          return (
            <span key={key} className={sinMargen ? undefined : "mx-1 text-gray-400"}>
              {token.texto}
            </span>
          )
        }

        if (token.tipo === "numero") {
          return <span key={key}>{token.texto}</span>
        }

        if (modo === "nombres") {
          return (
            <span key={key} className="font-medium">
              {token.nombre}
            </span>
          )
        }

        return token.valor === null ? (
          <span key={key} className="text-red-600">
            −
          </span>
        ) : (
          <span key={key}>{token.valor}</span>
        )
      })}
    </>
  )
}

export function FormulaHoverCard({ explicacion, cargaManual, children }: FormulaHoverCardProps) {
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        {/* Sin `aria-label`: pisaría el nombre accesible del botón y un lector
            de pantalla dejaría de anunciar el estado que dice el badge ("Auto",
            "Fórmula pendiente", "A mano"), que es el dato. La pista de qué hace
            el hover va como `title`, que es descripción y no nombre. */}
        <button
          type="button"
          className="cursor-help align-middle"
          title="Ver la fórmula y los valores con los que se calcula"
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-sm space-y-1.5 p-3">
        <p className="text-xs text-gray-500">Cómo se calcula</p>
        <p className="font-matematica text-sm text-gray-700">
          <LineaDeFormula tokens={explicacion.tokens} modo="nombres" />
        </p>
        <p className="font-matematica text-sm tabular-nums text-gray-900">
          <LineaDeFormula tokens={explicacion.tokens} modo="valores" />
        </p>
        <p
          className={
            explicacion.resultado === null
              ? "font-matematica text-base font-semibold text-red-600"
              : "font-matematica text-base font-semibold text-gray-800"
          }
        >
          = {explicacion.resultado ?? "−"}
        </p>
        {explicacion.faltantes.map((faltante) => (
          <p key={faltante.codigo} className="text-[11px] text-red-600">
            Falta: {faltante.nombre}
          </p>
        ))}
        {cargaManual && (
          <p className="text-[11px] text-violet-700">La fórmula está de lado: el valor se carga a mano.</p>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
