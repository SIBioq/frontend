"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Label } from "../../../ui/label"
import { Skeleton } from "../../../ui/skeleton"
import { toast } from "sonner"
import { useApi } from "../../../../hooks/use-api"
import { PROTOCOL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import type { ProtocolStatus, UnplannedTransaction } from "@/types"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { LAB_TIME_ZONE } from "@/lib/format-utils"

interface UnplannedTransactionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  isEditable: boolean
  onChanged: () => void
  /** La transacción puede cambiar el estado del protocolo (recalcula pagos);
   * si la respuesta lo trae, se aplica directo sin esperar el refresh de fondo. */
  onStatusChange?: (status: ProtocolStatus | null) => void
}

const FORMULARIO_VACIO = {
  kind: "charge" as const,
  description: "",
  amount: "",
}

const formatMoney = (value: string | number) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value || "0")
  if (Number.isNaN(n)) return "$0.00"
  return `$${n.toFixed(2)}`
}

export function UnplannedTransactionsDialog({
  open,
  onOpenChange,
  protocolId,
  isEditable,
  onChanged,
  onStatusChange,
}: UnplannedTransactionsDialogProps) {
  const { apiRequest } = useApi()
  const [items, setItems] = useState<UnplannedTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [form, setForm] = useState(FORMULARIO_VACIO)

  // Solo un pago tiene forma de pago: un cobro es plata que el paciente pasa a
  // deber, no plata que entró. El backend rechaza un cargo con forma de pago.
  //
  // Y en el pago es obligatoria: entró plata y hay que saber si al cajón o a
  // una cuenta.
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.UNPLANNED_LIST(protocolId))
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "No se pudieron cargar las transacciones."))
      }
      const data: UnplannedTransaction[] = await response.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error("Error", { description: getErrorMessage(err), duration: TOAST_DURATION })
    } finally {
      setLoading(false)
    }
  }, [apiRequest, protocolId])

  useEffect(() => {
    if (open) {
      void fetchItems()
      setForm(FORMULARIO_VACIO)
    }
  }, [open, fetchItems])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const description = form.description.trim()
    const amount = Number.parseFloat(form.amount)
    if (!description) {
      toast.error("Falta descripción", { duration: TOAST_DURATION })
      return
    }
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Monto inválido", { duration: TOAST_DURATION })
      return
    }
    // El backend también lo rechaza; se pide antes para no perder la carga
    // entera por un campo.
    try {
      setSubmitting(true)
      const response = await apiRequest(PROTOCOL_ENDPOINTS.UNPLANNED_LIST(protocolId), {
        method: "POST",
        body: {
          kind: "charge",
          description,
          amount: amount.toFixed(2),
          // Un cobro va sin nada de esto, y una transferencia es la única que
          // lleva cuenta: mandar la vieja guardaría algo que contradice la
          // pantalla.
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "No se pudo crear la transacción."))
      }
      const data = await response.json().catch(() => ({}))
      toast.success("Transacción agregada", { duration: TOAST_DURATION })
      if (data.protocol_status !== undefined) onStatusChange?.(data.protocol_status)
      setForm(FORMULARIO_VACIO)
      await fetchItems()
      onChanged()
    } catch (err) {
      toast.error("Error al agregar", { description: getErrorMessage(err), duration: TOAST_DURATION })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (txId: number) => {
    try {
      setDeletingId(txId)
      const response = await apiRequest(PROTOCOL_ENDPOINTS.UNPLANNED_ITEM(protocolId, txId), {
        method: "DELETE",
      })
      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "No se pudo eliminar la transacción."))
      }
      toast.success("Transacción eliminada", { duration: TOAST_DURATION })
      await fetchItems()
      onChanged()
    } catch (err) {
      toast.error("Error al eliminar", { description: getErrorMessage(err), duration: TOAST_DURATION })
    } finally {
      setDeletingId(null)
    }
  }

  const chargesTotal = items
    .filter((t) => t.kind === "charge")
    .reduce((acc, t) => acc + (Number.parseFloat(t.amount) || 0), 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[560px] overflow-y-auto p-4 sm:w-[95vw] sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-start gap-2 text-left">
            <Receipt className="h-5 w-5 text-violet-600" />
            <span className="break-words">Cobros no contemplados — Protocolo #{protocolId}</span>
          </DialogTitle>
          <DialogDescription>
            Cargos que aumentan el saldo del paciente y no encajan en los conceptos estándar. No se facturan a ARCA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isEditable && (
            <form onSubmit={handleAdd} className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <div className="space-y-1.5">
                  <Label htmlFor="unplanned-desc" className="text-xs">Descripción</Label>
                  <Input
                    id="unplanned-desc"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Ej: envío a domicilio, transferencia 30/05"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unplanned-amount" className="text-xs">Monto</Label>
                  <Input
                    id="unplanned-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="bg-white"
                  />
                </div>
              </div>
              {/* Cómo entró la plata. La del protocolo es la del cobro del
                  mostrador: un pago que llega después puede entrar por otro
                  lado, y al conciliar hay que poder encontrarlo. */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Agregar transacción
              </Button>
            </form>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{items.length} transacción{items.length === 1 ? "" : "es"}</span>
              <span className="text-right">Cargos al paciente: <strong className="text-rose-700">{formatMoney(chargesTotal)}</strong></span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                Sin transacciones cargadas.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((tx) => (
                  <div
                    key={tx.id}
                    className={`rounded-md border p-2 ${
                      tx.kind === "charge" ? "border-rose-200 bg-rose-50/50" : "border-emerald-200 bg-emerald-50/50"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                          <span
                            className={tx.kind === "charge" ? "text-rose-700" : "text-emerald-700"}
                          >
                            {tx.kind === "charge" ? "Cargo al paciente" : "Pago histórico recibido"}
                          </span>
                          <span className="text-gray-900">{formatMoney(tx.amount)}</span>
                        </div>
                        <p className="text-sm text-gray-800 break-words">{tx.description}</p>
                        {tx.created_by && (
                          <p className="mt-1 text-[10px] text-gray-500">
                            {tx.created_by.first_name || tx.created_by.username}
                            {tx.created_at ? ` · ${new Date(tx.created_at).toLocaleString("es-AR", { timeZone: LAB_TIME_ZONE })}` : ""}
                          </p>
                        )}
                      </div>
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 self-end px-2 text-xs text-red-700 hover:bg-red-100 sm:self-start"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                        >
                          {deletingId === tx.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
