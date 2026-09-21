import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  FormaDePago,
  PagoDelProtocolo,
  ProtocolBillingBreakdown as BillingBreakdown,
  ProtocolDetail,
  UnplannedTransaction,
} from "@/types"

const numeric = (value?: string | null) => Number.parseFloat(value ?? "0")
const nonZero = (value?: string | null) => Math.abs(numeric(value)) > 0.001
const money = (value?: string | null) => {
  const parsed = numeric(value)
  const absolute = Math.abs(parsed).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${parsed < 0 ? "−" : ""}$${absolute}`
}
const decimal = (value?: string | null) =>
  numeric(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })

interface LegacyBillingValues {
  analysesAmountDue?: string
  volumeDiscount?: string
  coseguroAmount?: string
  materialDescartableAmount?: string
  derivacionAmount?: string
  minimumAdjustment?: string
  extrasTotal?: string
  amountDue?: string
  patientPaid?: string
  amountPending?: string
  amountToReturn?: string
}

interface DisplayPayment {
  key: string
  label: string
  amount: string
  method?: FormaDePago
  refund?: boolean
}

function Row({
  label,
  value,
  note,
  className,
}: {
  label: string
  value: string
  note?: string
  className?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="min-w-0 text-sm text-gray-600">
        {label}
        {note && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{note}</span>}
      </span>
      <span className={cn("shrink-0 text-sm font-medium tabular-nums text-gray-900", className)}>
        {value}
      </span>
    </div>
  )
}

function discountRule(details: ProtocolDetail[]) {
  const pricing = details
    .map((detail) => detail.private_pricing)
    .find((item) => item?.mode === "ub" && item.discount.threshold_ub)
  if (!pricing?.discount.threshold_ub) {
    return { threshold: null, percentage: null }
  }
  return {
    threshold: decimal(pricing.discount.threshold_ub),
    percentage: decimal(pricing.discount.percentage_at_or_above),
  }
}

function fallbackPayments(
  pagos: PagoDelProtocolo[],
  unplanned: UnplannedTransaction[],
): DisplayPayment[] {
  return [
    ...pagos.map((payment) => ({
      key: `regular-${payment.id}`,
      label: payment.tipo === "devolucion" ? "Devolución" : "Pago del paciente",
      amount: payment.amount,
      method: payment.payment_method,
      refund: payment.tipo === "devolucion",
    })),
    ...unplanned
      .filter((item) => item.kind === "payment")
      .map((payment) => ({
        key: `extra-${payment.id}`,
        label: payment.description || "Pago extra",
        amount: payment.amount,
        method: payment.payment_method,
      })),
  ]
}

/**
 * Desglose único para las dos vistas del protocolo. Prefiere el contrato
 * canónico y cae a los campos planos sin duplicar `extras_total`.
 */
export function ProtocolBillingBreakdown({
  breakdown,
  details = [],
  legacy = {},
  pagos = [],
  unplannedTransactions = [],
  showBalance = true,
  className,
}: {
  breakdown?: BillingBreakdown | null
  details?: ProtocolDetail[]
  legacy?: LegacyBillingValues
  pagos?: PagoDelProtocolo[]
  unplannedTransactions?: UnplannedTransaction[]
  showBalance?: boolean
  className?: string
}) {
  const rule = discountRule(details)
  const belowThresholdLabel = rule.threshold
    ? `Particulares · menos de ${rule.threshold} UB`
    : "Particulares · por UB sin descuento"
  const atOrAboveLabel = rule.threshold
    ? `Particulares · ${rule.threshold} UB o más`
    : "Particulares · por UB con porcentaje"
  const analyses = breakdown?.analyses
  const charges = breakdown?.charges
  const payments = breakdown?.payments
  const completeAnalysisHistory =
    Boolean(analyses) &&
    analyses?.private_ub_below_threshold_amount !== null &&
    analyses?.private_ub_at_or_above_threshold_amount !== null &&
    analyses?.private_fixed_amount !== null

  const fallbackCharges = [
    { key: "coseguro", label: "Coseguro", amount: legacy.coseguroAmount },
    { key: "material", label: "Material descartable", amount: legacy.materialDescartableAmount },
    { key: "derivation", label: "Derivación", amount: legacy.derivacionAmount },
    { key: "minimum", label: "Ajuste hasta mínimo particular", amount: legacy.minimumAdjustment },
    ...unplannedTransactions
      .filter((item) => item.kind === "charge")
      .map((item) => ({ key: `extra-${item.id}`, label: item.description || "Cargo extra", amount: item.amount })),
  ].filter((item): item is { key: string; label: string; amount: string } => nonZero(item.amount))

  // extras_total ya contiene los cargos anteriores. Solo aparece si una
  // respuesta vieja no trajo ningún componente discriminado.
  if (!charges && fallbackCharges.length === 0 && nonZero(legacy.extrasTotal)) {
    fallbackCharges.push({
      key: "legacy-extras",
      label: "Otros cargos",
      amount: legacy.extrasTotal!,
    })
  }

  const displayPayments: DisplayPayment[] = payments
    ? [
        ...payments.regular.items.map((payment) => ({
          key: `regular-${payment.id}`,
          label: payment.type === "devolucion" ? "Devolución" : "Pago del paciente",
          amount: payment.amount,
          method: payment.payment_method,
          refund: payment.type === "devolucion",
        })),
        ...payments.unplanned.items.map((payment) => ({
          key: `extra-${payment.id}`,
          label: payment.description || "Pago extra",
          amount: payment.amount,
        })),
      ]
    : fallbackPayments(pagos, unplannedTransactions)

  const due = charges?.total_due ?? legacy.amountDue
  const paid = payments?.total ?? legacy.patientPaid
  const pending = payments ? (numeric(payments.balance) > 0 ? payments.balance : "0") : legacy.amountPending
  const toReturn = payments?.amount_to_return ?? legacy.amountToReturn

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Análisis</p>
        {completeAnalysisHistory && analyses ? (
          <div className="divide-y divide-gray-100">
            {nonZero(analyses.private_ub_below_threshold_amount) && (
              <Row
                label={belowThresholdLabel}
                value={money(analyses.private_ub_below_threshold_amount)}
                note="Se cobra el 100% del valor por UB."
              />
            )}
            {nonZero(analyses.private_ub_at_or_above_threshold_amount) && (
              <Row
                label={atOrAboveLabel}
                value={money(analyses.private_ub_at_or_above_threshold_amount)}
                note={
                  rule.percentage
                    ? `Se cobra el ${rule.percentage}% del importe bruto.`
                    : "Se aplicó el porcentaje histórico guardado."
                }
              />
            )}
            {nonZero(analyses.private_fixed_amount) && (
              <Row
                label="Particulares · precio fijo"
                value={money(analyses.private_fixed_amount)}
                note="No se calculan por UB."
              />
            )}
          </div>
        ) : nonZero(analyses?.patient_total ?? legacy.analysesAmountDue) ? (
          <>
            <Row
              label="Análisis particulares"
              value={money(analyses?.patient_total ?? legacy.analysesAmountDue)}
            />
          </>
        ) : (
          <p className="text-xs text-gray-400">Sin análisis a cargo del paciente.</p>
        )}

        {nonZero(analyses?.insurance_authorized_ub) && (
          <Row
            label="Análisis cubiertos por OOSS"
            value={`${decimal(analyses?.insurance_authorized_ub)} UB`}
            note="El monto no es $0: se define al cerrar la presentación de la obra social."
            className="text-sky-700"
          />
        )}
      </div>

      <div className="border-t border-gray-100 pt-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Cargos</p>
        {charges ? (
          <div className="divide-y divide-gray-100">
            {nonZero(charges.coseguro) && <Row label="Coseguro" value={money(charges.coseguro)} />}
            {nonZero(charges.material) && <Row label="Material descartable" value={money(charges.material)} />}
            {nonZero(charges.derivation) && <Row label="Derivación" value={money(charges.derivation)} />}
            {charges.unplanned.items.map((charge) => (
              <Row key={`charge-${charge.id}`} label={charge.description || "Cargo extra"} value={money(charge.amount)} />
            ))}
            {nonZero(charges.minimum_adjustment) && (
              <Row
                label="Ajuste hasta mínimo particular"
                value={money(charges.minimum_adjustment)}
                note={charges.particular_minimum ? `Mínimo histórico: ${money(charges.particular_minimum)}.` : undefined}
              />
            )}
            {!nonZero(charges.coseguro) &&
              !nonZero(charges.material) &&
              !nonZero(charges.derivation) &&
              charges.unplanned.items.length === 0 &&
              !nonZero(charges.minimum_adjustment) && (
                <p className="py-1 text-xs text-gray-400">Sin cargos adicionales.</p>
              )}
          </div>
        ) : fallbackCharges.length ? (
          <div className="divide-y divide-gray-100">
            {fallbackCharges.map((charge) => (
              <Row key={charge.key} label={charge.label} value={money(charge.amount)} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin cargos adicionales.</p>
        )}
      </div>

      <div className="border-t border-gray-100 pt-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pagos</p>
          {displayPayments.length > 0 && (
            <Badge variant="outline" className="font-normal text-gray-500">
              {displayPayments.length} {displayPayments.length === 1 ? "movimiento" : "movimientos"}
            </Badge>
          )}
        </div>
        {displayPayments.length ? (
          <div className="divide-y divide-gray-100">
            {displayPayments.map((payment) => (
              <Row
                key={payment.key}
                label={`${payment.label}${
                  payment.method === "transferencia"
                    ? " · Transferencia"
                    : payment.method === "efectivo"
                      ? " · Efectivo"
                      : ""
                }`}
                value={money(payment.amount)}
                className={payment.refund ? "text-amber-700" : "text-emerald-700"}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin pagos registrados.</p>
        )}
        {payments && nonZero(payments.rounding) && (
          <Row
            label="Redondeo"
            value={money(payments.rounding)}
            note="Pagó de más dentro del tope; no hay que devolverlo."
            className="text-emerald-700"
          />
        )}
      </div>

      {showBalance && (
        <div className="border-t border-gray-200 pt-2">
          <Row label="Total a pagar" value={money(due)} className="font-bold" />
          <Row label="Pagado" value={money(paid)} className="text-emerald-700" />
          {numeric(pending) > 0 ? (
            <Row label="Saldo pendiente" value={money(pending)} className="font-semibold text-red-600" />
          ) : numeric(toReturn) > 0 ? (
            <Row label="A favor del paciente" value={money(toReturn)} className="font-semibold text-amber-700" />
          ) : (
            <p className="pt-1 text-right text-sm font-medium text-emerald-700">Saldado</p>
          )}
        </div>
      )}
    </div>
  )
}
