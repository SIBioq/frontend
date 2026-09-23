"use client"

import { CircleMinus, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ExclusionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre de la determinación que se va a dejar fuera, para que el texto lo diga. */
  nombreDeterminacion: string
  onConfirmar: () => Promise<void>
  /** La request está en camino: el botón no se puede volver a apretar. */
  confirmando?: boolean
}

/**
 * Confirma dejar una determinación fuera del protocolo cuando la fila YA tiene
 * datos cargados.
 *
 * POR QUÉ PREGUNTA
 * ================
 * Dejar fuera una fila vacía no tiene consecuencias. Dejar fuera una que ya
 * tiene un valor —o una validación firmada— sí: ese dato deja de contar para
 * el estado del protocolo, el informe y el envío. No se borra, pero quien lo
 * hace tiene que saber qué está sacando de la cuenta.
 *
 * SIN ROJO
 * ========
 * No es una eliminación y es reversible, así que va con el azul de la página,
 * igual que los otros diálogos del protocolo: el rojo está reservado para lo
 * que no se puede deshacer.
 */
export function ExclusionConfirmDialog({
  open,
  onOpenChange,
  nombreDeterminacion,
  onConfirmar,
  confirmando = false,
}: ExclusionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !confirmando && onOpenChange(o)}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="border-b border-[#cbd8ea] bg-[#f4f7fb] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-gray-900">
              <CircleMinus className="h-5 w-5 shrink-0 text-[#204983]" />
              Dejar fuera del protocolo
            </DialogTitle>
            <DialogDescription className="pt-1 text-gray-600">
              <span className="font-medium text-gray-800">{nombreDeterminacion}</span> ya tiene datos
              cargados en este protocolo.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm text-gray-600">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              <span className="font-medium text-gray-900">El dato se conserva.</span> El valor, las
              notas y la validación quedan como están.
            </p>
          </div>
          <p>
            Lo único que cambia es que deja de contar para el estado del protocolo, el informe y el
            envío de resultados. Podés volver a incluirla cuando quieras, sin perder nada.
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onConfirmar()}
            disabled={confirmando}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {confirmando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CircleMinus className="mr-2 h-4 w-4" />
            )}
            Dejar fuera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
