import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { OssBreakdownCard } from "./oss-breakdown-card"
import { formatDateAR } from "../format"
import type { BillingEntity, ClosedPresentation } from "../types"

const formatCurrency = (value: string | number | null) => {
  if (value == null) return "—"
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const statusBadge = {
  cerrada: { label: "Cerrada, esperando cobro", className: "border-amber-200 bg-amber-50 text-amber-700" },
  cobrada: { label: "Cobrada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
} as const

interface PresentationHistoryCardProps {
  presentation: ClosedPresentation
  entity: BillingEntity
  onSaveUbValue: (presentationId: number, insuranceId: number, value: number) => Promise<void>
  onSaveCollected: (presentationId: number, insuranceId: number, value: number, reason: string) => Promise<void>
  onSaveCollectedTotal: (presentationId: number, value: number, reason: string) => Promise<void>
}

/**
 * Presentación cerrada: acá se carga (y se puede editar en cualquier momento,
 * no es de una sola vez) el valor UB de cada OOSS y lo cobrado — antes de
 * cerrar todavía no se sabe ninguno de los dos.
 */
export function PresentationHistoryCard({
  presentation,
  entity,
  onSaveUbValue,
  onSaveCollected,
  onSaveCollectedTotal,
}: PresentationHistoryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [collectedTotalDraft, setCollectedTotalDraft] = useState("")
  // Pre-cargado con el motivo guardado: el backend lo pisa en cada cobro.
  const [reasonDraft, setReasonDraft] = useState(presentation.difference_reason ?? "")
  const [savingTotal, setSavingTotal] = useState(false)

  const totalExpected = Number.parseFloat(presentation.expected_amount)
  const totalCollected = presentation.collected_amount != null ? Number.parseFloat(presentation.collected_amount) : null
  const difference = presentation.difference_amount != null ? Number.parseFloat(presentation.difference_amount) : null

  const badge = statusBadge[presentation.status]

  const handleSaveTotal = async () => {
    const parsed = Number.parseFloat(collectedTotalDraft)
    if (Number.isNaN(parsed) || parsed < 0) return
    setSavingTotal(true)
    try {
      await onSaveCollectedTotal(presentation.id, parsed, reasonDraft.trim())
      setCollectedTotalDraft("")
    } finally {
      setSavingTotal(false)
    }
  }

  return (
    <div className={cn("rounded-lg border bg-white transition-colors", expanded ? "border-[#204983]/40" : "border-gray-200")}>
      <button type="button" className="w-full p-3 text-left" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-800">{presentation.name || presentation.reference}</p>
            <p className="text-xs text-gray-500">
              {formatDateAR(presentation.period_start)} a {formatDateAR(presentation.period_end)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", badge.className)}>
              {badge.label}
            </Badge>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-gray-50 px-2 py-1.5">
            <p className="text-gray-500">Esperado (OOSS)</p>
            <p className="font-semibold text-gray-800">{formatCurrency(totalExpected || null)}</p>
          </div>
          <div className="rounded-md bg-gray-50 px-2 py-1.5">
            <p className="text-gray-500">Cobrado (OOSS)</p>
            <p className="font-semibold text-gray-800">{formatCurrency(totalCollected)}</p>
          </div>
          <div className={cn("rounded-md px-2 py-1.5", difference == null ? "bg-gray-50" : Math.abs(difference) < 0.01 ? "bg-emerald-50" : "bg-red-50")}>
            <p className="text-gray-500">Diferencia</p>
            <p className={cn("flex items-center gap-1 font-semibold", difference == null ? "text-gray-800" : Math.abs(difference) < 0.01 ? "text-emerald-700" : "text-red-700")}>
              {difference != null && (Math.abs(difference) < 0.01 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />)}
              {formatCurrency(difference)}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {presentation.expected_by_ooss.map((o) => (
              <OssBreakdownCard
                key={o.insurance_id}
                entry={o}
                showCollectedInput={entity.reports_breakdown_by_ooss}
                onSaveUbValue={(insuranceId, value) => onSaveUbValue(presentation.id, insuranceId, value)}
                onSaveCollected={
                  entity.reports_breakdown_by_ooss
                    ? (insuranceId, value, reason) => onSaveCollected(presentation.id, insuranceId, value, reason)
                    : undefined
                }
              />
            ))}
          </div>

          {!entity.reports_breakdown_by_ooss && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
              <p className="text-sm font-semibold text-gray-800">Depósito total de {entity.name}</p>
              <p className="text-xs text-gray-500">Esta entidad no discrimina el cobro por OOSS: se carga un único monto.</p>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor={`collected-total-${presentation.id}`} className="sr-only">
                  Monto total depositado
                </Label>
                <Input
                  id={`collected-total-${presentation.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={presentation.collected_amount != null ? `Actual: ${presentation.collected_amount}` : "Monto total depositado"}
                  className="h-8 max-w-[220px] text-xs"
                  value={collectedTotalDraft}
                  onChange={(e) => setCollectedTotalDraft(e.target.value)}
                />
                <Button size="sm" className="h-8 bg-[#204983]" disabled={savingTotal || !collectedTotalDraft} onClick={handleSaveTotal}>
                  {savingTotal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Input
                placeholder="Motivo de la diferencia (opcional)"
                aria-label="Motivo de la diferencia"
                maxLength={500}
                className="mt-2 h-8 text-xs"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
              />
            </div>
          )}

          {(presentation.collected_at || presentation.notes) && (
            <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {presentation.collected_at && (
                <p>
                  <strong>Cobrada el:</strong> {formatDateAR(presentation.collected_at)}
                </p>
              )}
              {presentation.notes && (
                <p className="whitespace-pre-wrap">
                  <strong>Notas:</strong> {presentation.notes}
                </p>
              )}
            </div>
          )}

          {presentation.difference_reason && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Motivo de la diferencia:</strong> {presentation.difference_reason}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
