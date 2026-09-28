import { useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Save, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useApiQuery } from "@/hooks/use-api-query"
import { MEDICAL_ENDPOINTS } from "@/config/api"
import type { ClosedOssBreakdown } from "../types"

const formatCurrency = (value: string | number | null) => {
  if (value == null) return "—"
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface EditableAmountProps {
  label: string
  value: number | null
  placeholder: string
  /** Si se pide, abajo del monto aparece "Motivo de la diferencia" (opcional),
   * pre-cargado con el que ya estaba: el backend lo pisa en cada guardado. */
  reason?: string
  withReason?: boolean
  onSave: (value: number, reason: string) => Promise<void>
}

/** Un valor con edición inline: se muestra como texto + lápiz; al tocar el
 * lápiz aparece el input pre-cargado con el valor actual (o vacío). Se puede
 * volver a editar las veces que haga falta, no es de carga única. */
function EditableAmount({ label, value, placeholder, reason = "", withReason = false, onSave }: EditableAmountProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [reasonDraft, setReasonDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setDraft(value != null ? String(value) : "")
    setReasonDraft(reason)
    setEditing(true)
  }

  const handleSave = async () => {
    const parsed = Number.parseFloat(draft)
    if (Number.isNaN(parsed) || parsed < 0) return
    setSaving(true)
    try {
      await onSave(parsed, reasonDraft.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-md bg-gray-50 px-2 py-1.5">
        <p className="text-gray-500">{label}</p>
        <div className="mt-1 flex items-center gap-1">
          <Input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            placeholder={placeholder}
            className="h-7 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button size="sm" className="h-7 w-7 shrink-0 bg-[#204983] p-0" disabled={saving || !draft} onClick={handleSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0 text-gray-400" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {withReason && (
          <Input
            placeholder="Motivo de la diferencia (opcional)"
            aria-label="Motivo de la diferencia"
            maxLength={500}
            className="mt-1 h-7 text-xs"
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
          />
        )}
      </div>
    )
  }

  return (
    <button type="button" onClick={startEditing} className="group rounded-md bg-gray-50 px-2 py-1.5 text-left hover:bg-gray-100">
      <p className="text-gray-500">{label}</p>
      <p className="flex items-center gap-1 font-semibold text-gray-800">
        {value != null ? formatCurrency(value) : <span className="font-normal text-gray-400">Sin cargar</span>}
        <Pencil className="h-3 w-3 text-gray-300 group-hover:text-[#204983]" />
      </p>
    </button>
  )
}

interface OssBreakdownCardProps {
  entry: ClosedOssBreakdown
  /** Si la entidad informa cobro discriminado por OOSS (ej. la Clínica). Si no
   * (ej. el Centro), el cobro se carga a nivel de presentación completa. */
  showCollectedInput: boolean
  onSaveUbValue: (insuranceId: number, ubValue: number) => Promise<void>
  onSaveCollected?: (insuranceId: number, value: number, reason: string) => Promise<void>
}

/**
 * Desglose por OOSS de una presentación ya CERRADA: acá se carga (y se puede
 * volver a editar en cualquier momento) el valor UB que publicó la OOSS y lo
 * cobrado. El valor UB se sugiere pre-cargado con el último que se cargó
 * (Insurance.ub_value, a donde cascadea cada vez que se guarda acá).
 */
export function OssBreakdownCard({ entry, showCollectedInput, onSaveUbValue, onSaveCollected }: OssBreakdownCardProps) {
  const expected = Number.parseFloat(entry.expected_amount)
  const collected = entry.collected_amount != null ? Number.parseFloat(entry.collected_amount) : null
  const difference = entry.difference_amount != null ? Number.parseFloat(entry.difference_amount) : null

  const insuranceQuery = useApiQuery<{ ub_value?: string }>({
    queryKey: ["insurances", "detail", entry.insurance_id],
    url: MEDICAL_ENDPOINTS.INSURANCE_DETAIL(entry.insurance_id),
    staleTime: 60 * 1000,
  })
  const currentUbValue = insuranceQuery.data?.ub_value ? Number.parseFloat(insuranceQuery.data.ub_value) : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800">{entry.insurance_name}</p>
          <p className="text-xs text-gray-500">
            {entry.protocol_count} protocolo{entry.protocol_count === 1 ? "" : "s"}
            {entry.total_ub ? ` · UB total: ${entry.total_ub}` : ""}
          </p>
        </div>
        {difference != null && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 text-[10px]",
              Math.abs(difference) < 0.01
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {Math.abs(difference) < 0.01 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {Math.abs(difference) < 0.01 ? "Coincide" : `Dif. ${formatCurrency(difference)}`}
          </Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <EditableAmount
          label="Valor UB"
          value={currentUbValue}
          placeholder="Valor que publicó la OOSS"
          onSave={(value) => onSaveUbValue(entry.insurance_id, value)}
        />
        <div className="rounded-md bg-gray-50 px-2 py-1.5">
          <p className="text-gray-500">Esperado</p>
          <p className="font-semibold text-gray-800">{formatCurrency(Number.isNaN(expected) ? null : expected)}</p>
        </div>
      </div>

      {showCollectedInput && onSaveCollected && (
        <div className="mt-2 border-t border-gray-100 pt-2 text-xs">
          <EditableAmount
            label="Cobrado"
            value={collected}
            placeholder="Monto cobrado de esta OOSS"
            withReason
            reason={entry.difference_reason ?? ""}
            onSave={(value, reason) => onSaveCollected(entry.insurance_id, value, reason)}
          />
          {entry.difference_reason && (
            <p className="mt-1 text-amber-800">
              <strong>Motivo:</strong> {entry.difference_reason}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
