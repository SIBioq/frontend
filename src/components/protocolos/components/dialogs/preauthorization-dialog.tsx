"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleX, Loader2, ShieldCheck } from "lucide-react"
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
import { Textarea } from "../../../ui/textarea"
import type { PreauthStatus } from "@/types"

type EditablePreauthStatus = Exclude<PreauthStatus, "not_required">

const PREAUTH_STATUS_OPTIONS: Array<{ value: EditablePreauthStatus; label: string; description: string }> = [
  {
    value: "completa",
    label: "Completa",
    description: "Ya trajo todo lo que va a traer; lo no cubierto se cobra particular.",
  },
  {
    value: "incompleta",
    label: "Incompleta",
    description: "Falta una preautorización pendiente para que el protocolo avance.",
  },
  {
    value: "no_trajo",
    label: "No la trajo",
    description: "No presentó preautorización; todo queda particular por ahora.",
  },
]

const getStatusClasses = (value: EditablePreauthStatus, selected: boolean) => {
  if (value === "completa") {
    return selected
      ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200"
      : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/60"
  }
  if (value === "incompleta") {
    return selected
      ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
      : "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/60"
  }
  return selected
    ? "border-red-600 bg-red-50 text-red-900 ring-2 ring-red-200"
    : "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/60"
}

const getStatusIcon = (value: EditablePreauthStatus) => {
  if (value === "completa") return CheckCircle2
  if (value === "incompleta") return AlertTriangle
  return CircleX
}

const getStatusIconClass = (value: EditablePreauthStatus) => {
  if (value === "completa") return "text-emerald-600"
  if (value === "incompleta") return "text-amber-600"
  return "text-red-600"
}

interface PreauthorizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  currentStatus?: PreauthStatus
  currentReference?: string
  currentNotes?: string
  onConfirm: (payload: {
    preauth_status: EditablePreauthStatus
    preauth_reference?: string
    preauth_notes?: string
  }) => Promise<boolean>
  isProcessing: boolean
}

export function PreauthorizationDialog({
  open,
  onOpenChange,
  protocolId,
  currentStatus,
  currentReference,
  currentNotes,
  onConfirm,
  isProcessing,
}: PreauthorizationDialogProps) {
  const [preauthStatus, setPreauthStatus] = useState<EditablePreauthStatus>("completa")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      setPreauthStatus(currentStatus && currentStatus !== "not_required" ? currentStatus : "completa")
      setReference(currentReference || "")
      setNotes(currentNotes || "")
    }
  }, [open, currentStatus, currentReference, currentNotes])

  const handleStatusKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const currentIndex = PREAUTH_STATUS_OPTIONS.findIndex((option) => option.value === preauthStatus)
    const lastIndex = PREAUTH_STATUS_OPTIONS.length - 1
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

    setPreauthStatus(PREAUTH_STATUS_OPTIONS[nextIndex].value)
  }

  const handleConfirm = async () => {
    const ok = await onConfirm({
      preauth_status: preauthStatus,
      preauth_reference: preauthStatus === "no_trajo" ? "" : reference.trim(),
      preauth_notes: notes.trim(),
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Preautorización - Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Marcá el estado global de la preautorización y registrá la referencia o notas del papel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <Label id="preauth-dialog-status-label" className="text-sm font-semibold">
              Estado de la preautorización
            </Label>
            <div
              role="radiogroup"
              aria-labelledby="preauth-dialog-status-label"
              className="grid gap-2 sm:grid-cols-3"
              onKeyDown={handleStatusKeyDown}
            >
              {PREAUTH_STATUS_OPTIONS.map((option) => {
                const selected = preauthStatus === option.value
                const Icon = getStatusIcon(option.value)
                const descriptionId = `preauth-dialog-${option.value}-description`

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={selected}
                    aria-describedby={descriptionId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setPreauthStatus(option.value)}
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

          {preauthStatus !== "no_trajo" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reference" className="flex min-h-10 items-end">
                  Referencia / Nº de preautorización
                </Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="OOSS-12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="flex min-h-10 items-end">
                  Notas
                </Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Comentarios..."
                />
              </div>
            </div>
          )}

          {preauthStatus === "no_trajo" && (
            <div className="space-y-2">
              <Label htmlFor="missing-preauth-notes">Notas</Label>
              <Textarea
                id="missing-preauth-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo o aclaración (opcional)"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aplicando...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Aplicar preautorización
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
