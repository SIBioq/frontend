import { cn } from "@/lib/utils"
import type { ProtocolAnalysisPrivatePricing, ProtocolDetail } from "@/types"

const asNumber = (value?: string | null) => Number.parseFloat(value ?? "0")

const money = (value?: string | null) =>
  `$${asNumber(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const compactNumber = (value?: string | null) =>
  asNumber(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })

const snapshotLabel = (source: ProtocolAnalysisPrivatePricing["snapshot_source"]) => {
  if (source === "creation") return "guardado al crear el protocolo"
  if (source === "added") return "guardado al agregar el análisis"
  if (source === "repricing") return "guardado al repreciar el protocolo"
  if (source === "legacy_backfill") return "reconstruido desde datos históricos"
  return "registrado en el protocolo"
}

/** Datos de precio bajo el nombre, sin competir con él por el ancho de la fila. */
export function AnalysisPriceSummary({
  detail,
  className,
}: {
  detail: ProtocolDetail
  className?: string
}) {
  const pricing = detail.private_pricing
  const quantity = detail.is_authorized
    ? detail.ub_obra_social ?? detail.ub_particular ?? detail.ub
    : pricing?.ub_quantity ?? detail.ub_particular ?? detail.ub
  const amount = pricing?.amount ?? detail.precio_fijo
  const fixed = pricing?.mode === "fixed" || (!pricing?.mode && detail.precio_fijo != null)

  if (detail.is_authorized) {
    return quantity ? (
      <span
        className={cn("text-xs text-slate-500", className)}
        title={detail.ub_obra_social ? "UB del nomenclador de la obra social" : "La obra social no nombra esta práctica; se usa la cantidad UB de Particular"}
      >
        {compactNumber(quantity)} UB {detail.ub_obra_social ? "OOSS" : "base particular"}
      </span>
    ) : null
  }

  const appliedPercentage = pricing?.discount.applied_percentage
  const discounted = pricing?.mode === "ub" && appliedPercentage != null && asNumber(appliedPercentage) < 100
  const explanation = pricing?.mode === "ub"
    ? `${compactNumber(quantity)} UB × ${money(pricing.ub_unit_value)} = ${money(pricing.gross_amount)} · ${snapshotLabel(pricing.snapshot_source)}`
    : pricing?.mode === "fixed"
      ? `Precio fijo ${snapshotLabel(pricing.snapshot_source)}`
      : "Precio del protocolo"

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs", className)} title={explanation}>
      {quantity && !fixed && <span className="text-slate-500">{compactNumber(quantity)} UB</span>}
      {amount != null && (
        <span className="font-semibold tabular-nums text-slate-700">
          {money(amount)}{fixed ? " · precio fijo" : ""}
        </span>
      )}
      {discounted && (
        <span className="font-medium text-emerald-700">
          {compactNumber(appliedPercentage)}% aplicado
        </span>
      )}
    </span>
  )
}
