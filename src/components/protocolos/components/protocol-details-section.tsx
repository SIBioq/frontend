"use client"

import type React from "react"
import { User, Building, CreditCard, Send, DollarSign, Printer, History, ClipboardCheck, BedDouble, BookOpen, ShieldCheck, Wallet } from "lucide-react"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type {
  PagoDelProtocolo,
  PaymentStatus,
  Nbu,
  TrajoOrdenStatus,
  PreauthStatus,
  ProtocolBillingBreakdown as BillingBreakdown,
  ProtocolDetail,
} from "@/types"
import { getTrajoOrdenInfo } from "@/lib/protocol-order"
import { getPaymentStatusInfo, getPreauthStatusInfo } from "@/lib/status-styles"
import { ProtocolBillingBreakdown } from "./protocol-billing-breakdown"

interface ProtocolDetailsSectionProps {
  patientName: string
  doctorName: string
  insuranceName: string
  affiliateNumber?: string
  sendMethodName: string
  paymentStatus?: PaymentStatus | null
  balance: number
  amountDue: string
  amountPending: string
  patientPaid: string
  amountToReturn: string
  /** Lo que dejó de más y se tomó como redondeo, no como deuda del lab. */
  redondeo?: string
  insuranceUbValue?: string
  privateUbValue?: string
  isPrinted?: boolean
  trajoOrden?: TrajoOrdenStatus | boolean
  preauthStatus?: PreauthStatus
  isInPatient?: boolean
  analysesAmountDue?: string
  volumeDiscount?: string
  minimumAdjustment?: string
  coseguroAmount?: string
  materialDescartableAmount?: string
  derivacionAmount?: string
  extrasTotal?: string
  billingBreakdown?: BillingBreakdown | null
  details?: ProtocolDetail[]
  nbu?: Nbu | null
  showOrderButton?: boolean
  orderDisabledReason?: string
  showPreauthButton?: boolean
  preauthDisabledReason?: string
  showCoseguroButton?: boolean
  coseguroDisabledReason?: string
  /** Cómo pagó el paciente. Vacío en los protocolos viejos: no se inventa. */
  pagos?: PagoDelProtocolo[]
  /** Abre la corrección de UN pago. Sin esto, la lista es solo de lectura. */
  onCorregirPago?: (pago: PagoDelProtocolo) => void
  unplannedTransactions?: import("@/types").UnplannedTransaction[]
  unplannedChargesTotal?: string
  unplannedPaymentsTotal?: string
  onOpenUnplanned?: () => void
  onOpenHistoryDialog: () => void
  onSetOrder?: () => void
  onApplyPreauthorization?: () => void
  onSetCoseguro?: () => void
}

export function ProtocolDetailsSection({
  patientName,
  doctorName,
  insuranceName,
  affiliateNumber,
  sendMethodName,
  paymentStatus,
  insuranceUbValue,
  privateUbValue,
  isPrinted,
  trajoOrden,
  preauthStatus,
  isInPatient,
  analysesAmountDue,
  volumeDiscount,
  minimumAdjustment,
  coseguroAmount,
  materialDescartableAmount,
  derivacionAmount,
  extrasTotal,
  billingBreakdown,
  details = [],
  nbu,
  showOrderButton = false,
  orderDisabledReason,
  showPreauthButton = false,
  preauthDisabledReason,
  showCoseguroButton = false,
  pagos = [],
  onCorregirPago,
  coseguroDisabledReason,
  unplannedTransactions = [],
  unplannedChargesTotal,
  unplannedPaymentsTotal,
  onOpenUnplanned,
  onOpenHistoryDialog,
  onSetOrder,
  onApplyPreauthorization,
  onSetCoseguro,
  amountDue,
  amountPending,
  patientPaid,
  amountToReturn,
  redondeo = "0",
}: ProtocolDetailsSectionProps) {
  const paymentStatusInfo = getPaymentStatusInfo(paymentStatus)

  const vuelto = Number.parseFloat(redondeo || "0")
  const coseguro = Number.parseFloat(coseguroAmount || "0")
  const nbuName = nbu && typeof nbu === "object" && "name" in nbu ? nbu.name : null
  const trajoOrdenInfo = getTrajoOrdenInfo(trajoOrden)
  const preauthInfo = getPreauthStatusInfo(preauthStatus)
  const isPrivateInsurance = (insuranceName || "").trim().toLowerCase() === "particular"
  const renderDisabledTooltip = (reason: string | undefined, children: React.ReactNode) => {
    if (!reason) return children

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] bg-slate-900 text-white">
          <p>{reason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="space-y-4 mt-4">
      {/* // Improved responsive grid layout */}
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3 text-sm">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 w-28 flex-shrink-0">Paciente:</span>
          <span className="font-medium truncate">{patientName}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 w-28 flex-shrink-0">Médico:</span>
          <span className="font-medium truncate">{doctorName}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 w-28 flex-shrink-0">Obra Social:</span>
          <span className="font-medium truncate">{insuranceName}</span>
        </div>

        {affiliateNumber && (
          <div className="flex items-center gap-3 text-sm">
            <CreditCard className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">N° Afiliado:</span>
            <span className="font-medium">{affiliateNumber}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm">
          <Send className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 w-28 flex-shrink-0">Envío:</span>
          <span className="font-medium">{sendMethodName}</span>
        </div>

        {trajoOrden !== undefined && !isPrivateInsurance && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <ClipboardCheck className={`h-4 w-4 flex-shrink-0 ${trajoOrdenInfo.iconClassName}`} />
            <span className="text-gray-600 w-28 flex-shrink-0">Orden médica:</span>
            <Badge
              variant="outline"
              className={`${trajoOrdenInfo.badgeClassName}`}
            >
              {trajoOrdenInfo.label}
            </Badge>
            {showOrderButton && renderDisabledTooltip(
              orderDisabledReason,
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(orderDisabledReason)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (orderDisabledReason) return
                  onSetOrder?.()
                }}
                className="h-7 border-[#204983] bg-white px-2 text-xs text-[#204983] hover:bg-[#204983] hover:text-white disabled:opacity-60"
                data-no-expand
              >
                <ClipboardCheck className="h-3 w-3 mr-1" />
                Modificar
              </Button>,
            )}
          </div>
        )}

        {preauthStatus && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${preauthInfo.iconClassName}`} />
            <span className="text-gray-600 w-28 flex-shrink-0 whitespace-nowrap">Preautorización:</span>
            <Badge variant="outline" className={`${preauthInfo.badge}`}>
              {preauthInfo.label}
            </Badge>
            {showPreauthButton && renderDisabledTooltip(
              preauthDisabledReason,
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(preauthDisabledReason)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (preauthDisabledReason) return
                  onApplyPreauthorization?.()
                }}
                className="h-7 border-indigo-600 bg-white px-2 text-xs text-indigo-700 hover:bg-indigo-600 hover:text-white disabled:opacity-60"
                data-no-expand
              >
                <ShieldCheck className="h-3 w-3 mr-1" />
                Modificar
              </Button>,
            )}
          </div>
        )}

        {showCoseguroButton && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Wallet className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="text-gray-600 w-28 flex-shrink-0 whitespace-nowrap">Coseguro:</span>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
              ${coseguro.toFixed(2)}
            </Badge>
            {renderDisabledTooltip(
              coseguroDisabledReason,
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(coseguroDisabledReason)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (coseguroDisabledReason) return
                  onSetCoseguro?.()
                }}
                className="h-7 border-amber-600 bg-white px-2 text-xs text-amber-700 hover:bg-amber-600 hover:text-white disabled:opacity-60"
                data-no-expand
              >
                <Wallet className="h-3 w-3 mr-1" />
                {coseguro > 0 ? "Modificar" : "Cargar"}
              </Button>,
            )}
          </div>
        )}

        {/* Cómo pagó. Se muestra siempre que haya algo que mostrar o algo que
            cargar: es el dato que se necesita al conciliar la caja, y buscarlo
            adentro del diálogo de cobros no se le ocurre a nadie. */}
        {/* CADA COBRO CON SU FORMA, EN SU RENGLÓN.
            Antes era una sola línea porque el protocolo tenía UNA forma. Con un
            pago por forma hay que poder ver los dos y corregir el que está mal
            sin tocar el otro. */}
        {pagos.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 text-sm">
            <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
            <span className="w-28 flex-shrink-0 whitespace-nowrap text-gray-600">
              {pagos.length === 1 ? "Forma de pago:" : "Formas de pago:"}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              {pagos.map((pago) => (
                <div key={pago.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums text-gray-800">
                    {pago.tipo === "devolucion" ? "−" : ""}${pago.amount}
                  </span>
                  {pago.payment_method === "transferencia" ? (
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
                      Transferencia
                      {pago.payment_account_detail ? ` · ${pago.payment_account_detail.nombre}` : ""}
                      {pago.payment_account_detail?.alias
                        ? ` (${pago.payment_account_detail.alias})`
                        : ""}
                    </Badge>
                  ) : pago.payment_method === "efectivo" ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      Efectivo
                    </Badge>
                  ) : (
                    <span className="text-gray-400">Sin registrar</span>
                  )}
                  {onCorregirPago && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCorregirPago(pago)
                      }}
                      className="h-6 border-sky-600 bg-white px-2 text-xs text-sky-700 hover:bg-sky-600 hover:text-white"
                      data-no-expand
                    >
                      <Wallet className="mr-1 h-3 w-3" />
                      {pago.payment_method ? "Modificar" : "Cargar"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isInPatient && (
          <div className="flex items-center gap-3 text-sm">
            <BedDouble className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">Paciente:</span>
            <Badge className="bg-violet-100 text-violet-700">Internado</Badge>
          </div>
        )}

        {nbuName && (
          <div className="flex items-center gap-3 text-sm">
            <BookOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">Nomenclador:</span>
            <span className="font-medium">{nbuName}</span>
          </div>
        )}

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-700">Desglose de facturación</p>
          <ProtocolBillingBreakdown
            breakdown={billingBreakdown}
            details={details}
            pagos={pagos}
            unplannedTransactions={unplannedTransactions}
            legacy={{
              analysesAmountDue,
              volumeDiscount,
              coseguroAmount,
              materialDescartableAmount,
              derivacionAmount,
              minimumAdjustment,
              extrasTotal,
              amountDue,
              patientPaid,
              amountPending,
              amountToReturn,
            }}
          />
        </div>

        {/* Transacciones no contempladas (cargos/pagos extra). Siempre permitimos
            abrir el gestor con onOpenUnplanned, aún sin transacciones cargadas. */}
        {onOpenUnplanned && (
          <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">Cobros / pagos no contemplados</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-violet-600 bg-white px-2 text-xs text-violet-700 hover:bg-violet-600 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenUnplanned()
                }}
                data-no-expand
              >
                {unplannedTransactions.length > 0 ? "Gestionar" : "Agregar"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {unplannedTransactions.length === 0
                ? "Sin movimientos cargados."
                : `${unplannedTransactions.length} ${unplannedTransactions.length === 1 ? "movimiento" : "movimientos"} · cargos ${Number.parseFloat(unplannedChargesTotal || "0").toFixed(2)} · pagos ${Number.parseFloat(unplannedPaymentsTotal || "0").toFixed(2)}`}
            </p>
          </div>
        )}

        {/* El vuelto que nadie se llevó. Va con su nombre para que la
            diferencia entre lo que se debía y lo que se cobró no quede como un
            número suelto que no cierra. */}
        {vuelto > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">Redondeo:</span>
            <span className="font-medium text-emerald-600">${vuelto.toFixed(2)}</span>
            <span className="text-xs text-gray-400">pagó de más; no hay que devolver</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <CreditCard className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 w-28 flex-shrink-0">Estado Pago:</span>
          <Badge className={`${paymentStatusInfo.bgColor} ${paymentStatusInfo.color}`}>{paymentStatusInfo.label}</Badge>
        </div>


        {insuranceUbValue && (
          <div className="flex items-center gap-3 text-sm">
            <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">UB O.Social:</span>
            <span className="font-medium">${insuranceUbValue}</span>
          </div>
        )}

        {privateUbValue && (
          <div className="flex items-center gap-3 text-sm">
            <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">UB Particular:</span>
            <span className="font-medium">${privateUbValue}</span>
          </div>
        )}

        {isPrinted !== undefined && (
          <div className="flex items-center gap-3 text-sm">
            <Printer className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 w-28 flex-shrink-0">Impreso/Enviado:</span>
            <Badge variant={isPrinted ? "default" : "secondary"}>{isPrinted ? "Sí" : "No"}</Badge>
          </div>
        )}
      </div>

      <div className="pt-4 pb-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <History className="h-4 w-4 text-gray-400" />
            Historial de Cambios
          </h4>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onOpenHistoryDialog()
            }}
            className="text-xs w-full sm:w-auto"
            data-no-expand
          >
            <History className="h-3 w-3 mr-1" />
            Ver Historial
          </Button>
        </div>
      </div>
    </div>
  )
}
