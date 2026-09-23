"use client"

import { Loader2, Check, X, ShieldCheck, History, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  formatEvaluatedReference,
  formatNamedReferenceRanges,
  formatReferenceRange,
  formatReferenceValues,
  getReferenceEvaluationLabel,
} from "@/lib/catalog-format"
import { LAB_TIME_ZONE } from "@/lib/format-utils"
import { cn } from "@/lib/utils"
import { unidadCompleta } from "@/lib/notacion"
import type { PreviousResult, Result } from "@/types"

interface ValidationResultRowProps {
  result: Result
  saving: boolean
  disabled?: boolean
  onValidate: (isValid: boolean) => void
  onLoadPrevious: () => void
  previous: PreviousResult[]
  loadingPrevious: boolean
}

function fmtDateTime(v?: string | null) {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-AR", { timeZone: LAB_TIME_ZONE, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}
function fmtDate(v?: string | null) {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Muestra los valores anteriores del paciente al abrir (click/tap; carga on-open).
// Popover en vez de hover: en tablet/mobile no hay puntero persistente, así que
// un trigger basado en hover queda inalcanzable por touch. Reutilizable: se
// envuelve tanto el nombre de la determinación como el chip.
function HistoryHover({
  previous,
  loading,
  onOpen,
  children,
}: {
  previous: PreviousResult[]
  loading: boolean
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <Popover onOpenChange={(o) => o && onOpen()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <p className="mb-1 text-xs font-semibold text-gray-700">Valores anteriores del paciente</p>
        {loading ? (
          <p className="py-2 text-xs text-gray-400">Buscando…</p>
        ) : previous.length === 0 ? (
          <p className="py-2 text-xs text-gray-400">Sin resultados anteriores</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {previous.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-50">
                <span className="font-medium text-gray-800">{p.value || "—"}</span>
                <span className="text-[10px] text-gray-400">{fmtDate(p.validated_at || p.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ValidationResultRow({ result, saving, disabled = false, onValidate, onLoadPrevious, previous, loadingPrevious }: ValidationResultRowProps) {
  const det = result.determination
  // Con la notación: acá se valida el valor tal como se cargó.
  const unit = unidadCompleta(det.measure_unit, det.scientific_exponent)
  const isValidated = result.is_valid
  const isWrong = result.is_wrong
  const hasValue = !!result.value
  // Fuera del protocolo: se ve con su valor, pero no se valida
  // —el backend lo rechaza— y no interviene en el informe. Se saca desde la
  // pantalla de carga, no desde acá.
  const excluido = !!result.excluido
  const noSeValida = disabled || excluido

  // Primero los rangos del paciente —los que se evalúan— y después los
  // rangos con nombre, que sólo informan. Ver `NamedReferenceRange`.
  const referenceItems = [
    ...(det.reference_ranges?.length
      ? det.reference_ranges.map(formatReferenceRange)
      : formatReferenceValues(det.reference_values)),
    ...formatNamedReferenceRanges(det.named_ranges),
  ]
  const evaluation = result.reference_range_evaluation
  const isOutOfRange = result.is_out_of_reference_range || evaluation?.is_out_of_reference_range
  const evaluatedReference = formatEvaluatedReference(evaluation)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center",
        // La exclusión manda sobre el resto: de esta fila lo que importa es que
        // no cuenta.
        excluido ? "border-slate-300 bg-slate-50" : isWrong ? "border-red-300 bg-red-50" : isValidated ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white",
      )}
    >
      {/* Determinación + valor + referencia */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <HistoryHover previous={previous} loading={loadingPrevious} onOpen={onLoadPrevious}>
            <button
              type="button"
              className="cursor-pointer bg-transparent p-0 font-semibold text-gray-900 underline decoration-dotted decoration-gray-300 underline-offset-2"
            >
              {det.name}
            </button>
          </HistoryHover>
          <span className={cn("text-lg font-bold", isOutOfRange ? "text-red-600" : "text-gray-900")}>
            {hasValue ? result.value : "—"}
          </span>
          {unit && <span className="text-xs text-gray-500">{unit}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {excluido && (
            <Badge variant="secondary" className="text-[10px]">
              Fuera del protocolo
            </Badge>
          )}
          {referenceItems.slice(0, 2).map((item) => (
            <Badge key={item} variant="outline" className="bg-slate-50 text-[10px] text-slate-600">
              {item}
            </Badge>
          ))}
          {evaluation && evaluation.status !== "not_evaluated" && (
            <Badge variant="outline" className={cn("text-[10px]", isOutOfRange ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
              {isOutOfRange && <AlertTriangle className="mr-1 h-3 w-3" />}
              {getReferenceEvaluationLabel(evaluation)}
            </Badge>
          )}
          {evaluatedReference && <span className="text-[10px] text-gray-500">{evaluatedReference}</span>}
          {/* QUIEN VALIDA TIENE QUE SABER QUE ESTO NO LO CALCULÓ LA FÓRMULA.
              La determinación es calculada, pero alguien dejó de lado el
              cálculo y escribió el valor a mano. Sin esta marca, el que firma
              lo lee como un número que salió de la fórmula. */}
          {result.carga_manual && !!det.formula?.trim() && (
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-700">
              Cargado a mano
            </Badge>
          )}
          {result.is_sent && (
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-700">
              Enviado
            </Badge>
          )}
        </div>
        {result.notes && <p className="mt-1 text-xs text-gray-500">Nota: {result.notes}</p>}
      </div>

      {/* Acción: validar / rechazar + historial (funciona con mouse y touch) */}
      <div className="flex shrink-0 items-center gap-2 lg:w-72 lg:justify-end">
        {/* Sección de historial: click/tap despliega los valores anteriores */}
        <HistoryHover previous={previous} loading={loadingPrevious} onOpen={onLoadPrevious}>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-gray-200 bg-transparent px-2 py-1.5 text-[11px] text-gray-400 transition-colors hover:border-[#204983] hover:text-[#204983]"
          >
            <History className="h-3.5 w-3.5" />
            Historial
          </button>
        </HistoryHover>
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : isValidated ? (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Validado
              </span>
              {result.validated_at && (
                <p className="text-[10px] text-emerald-600">
                  {fmtDateTime(result.validated_at)}
                  {result.validated_by && ` · ${result.validated_by.first_name}`}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-8 text-red-600 hover:bg-red-50" onClick={() => onValidate(false)} disabled={noSeValida}>
              Rechazar
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => onValidate(false)}
              disabled={!hasValue || noSeValida}
            >
              <X className="mr-1 h-4 w-4" />
              Rechazar
            </Button>
            <Button
              size="sm"
              className="h-9 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onValidate(true)}
              disabled={!hasValue || noSeValida}
            >
              <Check className="mr-1 h-4 w-4" />
              Validar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
