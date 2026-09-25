"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleX, ClipboardCheck, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog"
import { Button } from "../../../ui/button"
import { Label } from "../../../ui/label"
import { TRAJO_ORDEN, type TrajoOrdenStatus, normalizeTrajoOrden } from "@/lib/protocol-order"

const ORDER_STATUS_OPTIONS: Array<{ value: TrajoOrdenStatus; label: string; description: string }> = [
  {
    value: TRAJO_ORDEN.COMPLETA,
    label: "Completa",
    description: "La orden está cerrada para este protocolo.",
  },
  {
    value: TRAJO_ORDEN.INCOMPLETA,
    label: "Incompleta",
    description: "Falta una parte de la orden y queda información pendiente.",
  },
  {
    value: TRAJO_ORDEN.NO,
    label: "No la trajo",
    description: "El paciente todavía no presentó la orden médica.",
  },
]

const getStatusClasses = (value: TrajoOrdenStatus, selected: boolean) => {
  if (value === TRAJO_ORDEN.COMPLETA) {
    return selected
      ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200"
      : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/60"
  }

  if (value === TRAJO_ORDEN.INCOMPLETA) {
    return selected
      ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/60"
  }

  return selected
    ? "border-red-600 bg-red-50 text-red-900 ring-2 ring-red-200"
    : "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/60"
}

const getStatusIcon = (value: TrajoOrdenStatus) => {
  if (value === TRAJO_ORDEN.COMPLETA) return CheckCircle2
  if (value === TRAJO_ORDEN.INCOMPLETA) return AlertTriangle
  return CircleX
}

const getStatusIconClass = (value: TrajoOrdenStatus) => {
  if (value === TRAJO_ORDEN.COMPLETA) return "text-emerald-600"
  if (value === TRAJO_ORDEN.INCOMPLETA) return "text-amber-600"
  return "text-red-600"
}

interface OrderStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  currentStatus?: TrajoOrdenStatus
  onConfirm: (status: TrajoOrdenStatus) => Promise<boolean>
  isProcessing: boolean
}

export function OrderStatusDialog({
  open,
  onOpenChange,
  protocolId,
  currentStatus,
  onConfirm,
  isProcessing,
}: OrderStatusDialogProps) {
  const [status, setStatus] = useState<TrajoOrdenStatus>(TRAJO_ORDEN.COMPLETA)

  useEffect(() => {
    if (open) {
      setStatus(normalizeTrajoOrden(currentStatus))
    }
  }, [open, currentStatus])

  const handleStatusKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return
    event.preventDefault()

    const currentIndex = ORDER_STATUS_OPTIONS.findIndex((option) => option.value === status)
    const lastIndex = ORDER_STATUS_OPTIONS.length - 1
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? currentIndex <= 0
              ? lastIndex
              : currentIndex - 1
            : currentIndex >= lastIndex
              ? 0
              : currentIndex + 1

    setStatus(ORDER_STATUS_OPTIONS[nextIndex].value)
  }

  const handleConfirm = async () => {
    const ok = await onConfirm(status)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#204983]" />
            Orden médica - Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Cambiá rápidamente el estado de la orden sin entrar a la edición completa del protocolo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <Label id="order-dialog-status-label" className="text-sm font-semibold">
            Estado de la orden
          </Label>
          <div
            role="radiogroup"
            aria-labelledby="order-dialog-status-label"
            className="grid gap-2 sm:grid-cols-3"
            onKeyDown={handleStatusKeyDown}
          >
            {ORDER_STATUS_OPTIONS.map((option) => {
              const selected = status === option.value
              const Icon = getStatusIcon(option.value)
              const descriptionId = `order-dialog-${option.value}-description`

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  role="radio"
                  aria-checked={selected}
                  aria-describedby={descriptionId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setStatus(option.value)}
                  className={`h-auto min-h-24 justify-start whitespace-normal rounded-md border p-3 text-left transition ${getStatusClasses(option.value, selected)}`}
                >
                  <span className="flex w-full items-start gap-2">
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${getStatusIconClass(option.value)}`} aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold leading-tight">{option.label}</span>
                      <span id={descriptionId} className="mt-1 block text-xs leading-snug opacity-80">
                        {option.description}
                      </span>
                    </span>
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full bg-[#204983] hover:bg-[#1a3a6a] sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Guardar orden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
