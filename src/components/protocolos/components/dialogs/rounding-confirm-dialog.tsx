"use client"

import { Coins, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  diferencia: number
  isProcessing?: boolean
  onOpenChange: (open: boolean) => void
  onRedondear: () => void
  onCobrarJusto: () => void
}

export function RoundingConfirmDialog({
  open, diferencia, isProcessing = false, onOpenChange, onRedondear, onCobrarJusto,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-amber-950">
              <Coins className="h-5 w-5 text-amber-600" />
              El paciente paga de más
            </DialogTitle>
            <DialogDescription className="pt-1 text-amber-900/80">
              Hay {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(diferencia)} por encima del saldo pendiente.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-gray-600">Elegí qué hacer con la diferencia:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onRedondear} disabled={isProcessing} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-400 hover:bg-amber-100 disabled:opacity-50">
              <Coins className="mb-2 h-5 w-5 text-amber-600" />
              <span className="block text-sm font-semibold text-gray-900">Redondear</span>
              <span className="mt-1 block text-xs text-gray-600">El laboratorio conserva la diferencia.</span>
            </button>
            <button type="button" onClick={onCobrarJusto} disabled={isProcessing} className="rounded-lg border border-[#cbd8ea] bg-[#f4f7fb] p-4 text-left transition hover:border-[#204983] hover:bg-[#eaf0f8] disabled:opacity-50">
              <RotateCcw className="mb-2 h-5 w-5 text-[#204983]" />
              <span className="block text-sm font-semibold text-gray-900">Cobrar justo</span>
              <span className="mt-1 block text-xs text-gray-600">Se cobra el saldo y se devuelve la diferencia.</span>
            </button>
          </div>
        </div>
        <DialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
