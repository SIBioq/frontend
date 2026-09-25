"use client"

import { useEffect, useState } from "react"
import { Loader2, Wallet } from "lucide-react"
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

interface CoseguroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  currentCoseguro: string
  insuranceChargesCoseguro: boolean
  onConfirm: (amount: number) => Promise<boolean>
  isProcessing: boolean
}

export function CoseguroDialog({
  open,
  onOpenChange,
  protocolId,
  currentCoseguro,
  insuranceChargesCoseguro,
  onConfirm,
  isProcessing,
}: CoseguroDialogProps) {
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (open) {
      setAmount(currentCoseguro && currentCoseguro !== "0" ? currentCoseguro : "")
    }
  }, [open, currentCoseguro])

  const handleConfirm = async () => {
    const value = Number.parseFloat(amount)
    if (isNaN(value) || value < 0) return
    const ok = await onConfirm(value)
    if (ok) {
      setAmount("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-teal-600" />
            Coseguro - Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Cargá el monto de coseguro informado por la obra social al autorizar los análisis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!insuranceChargesCoseguro && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Esta obra social no cobra coseguro. El backend rechazará el envío.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="coseguro-amount">Monto de coseguro</Label>
            <Input
              id="coseguro-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Se suma al saldo a pagar por el paciente (extras_total).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !insuranceChargesCoseguro || amount === "" || Number.parseFloat(amount) < 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" /> Cargar coseguro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
