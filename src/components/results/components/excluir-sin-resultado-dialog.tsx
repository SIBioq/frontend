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

interface ExcluirSinResultadoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre del análisis cuyas filas vacías se van a dejar fuera. */
  nombreAnalisis: string
  /** Cuántas filas ve vacías la pantalla, contando lo tipeado sin guardar. */
  cantidad: number
  onConfirmar: () => Promise<void>
  /** La request está en camino: el botón no se puede volver a apretar. */
  confirmando?: boolean
}

/**
 * Confirma dejar fuera del protocolo, de una, las determinaciones sin resultado
 * de un análisis.
 *
 * POR QUÉ PREGUNTA SI NO SE PIERDE NADA
 * =====================================
 * Una fila por vez no pregunta cuando está vacía. Acá son muchas de un clic, y
 * el botón está al lado del de colapsar: un clic de más no puede sacar treinta
 * determinaciones del informe sin que nadie lo haya querido.
 *
 * Es reversible y nunca saca un dato —el backend omite las filas con datos o
 * con cálculos que dependen de ellas—, así que va con el azul de la página, no
 * con rojo.
 */
export function ExcluirSinResultadoDialog({
  open,
  onOpenChange,
  nombreAnalisis,
  cantidad,
  onConfirmar,
  confirmando = false,
}: ExcluirSinResultadoDialogProps) {
  const enPlural = cantidad === 1 ? "1 determinación sin resultado" : `${cantidad} determinaciones sin resultado`
  return (
    <Dialog open={open} onOpenChange={(o) => !confirmando && onOpenChange(o)}>
      <DialogContent className="flex max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 rounded-t-xl border-b border-[#cbd8ea] bg-[#f4f7fb] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-gray-900">
              <CircleMinus className="h-5 w-5 shrink-0 text-[#204983]" />
              Dejar fuera las vacías
            </DialogTitle>
            <DialogDescription className="pt-1 text-gray-600">
              Se van a dejar fuera del protocolo {enPlural} de{" "}
              <span className="font-medium text-gray-800">{nombreAnalisis}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm text-gray-600">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              <span className="font-medium text-gray-900">No se toca ningún dato.</span> Las que
              tengan valor, notas o validación, o que se usen en un cálculo con valor, quedan como
              están.
            </p>
          </div>
          <p>
            Dejan de contar para el estado del protocolo, el informe y el envío de resultados. Podés
            volver a incluir cualquiera desde su fila.
          </p>
        </div>

        <DialogFooter className="shrink-0 gap-2 rounded-b-xl border-t border-gray-100 bg-gray-50 px-6 py-4">
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
