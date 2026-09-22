"use client"

import { useState, useEffect } from "react"
import { Loader2, DollarSign, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../ui/dialog"
import { RoundingConfirmDialog } from "./rounding-confirm-dialog"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Label } from "../../../ui/label"
import { FormaDePago } from "@/components/common/forma-de-pago"

type OperationType = "patient_paid" | "refunded_to_patient"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  amountDue: string
  amountPending: string
  patientPaid: string
  amountToReturn: string
  paymentStatusName: string
  onRegularize: (
    amount: number,
    operation: OperationType,
    forma: string,
    cuentaId: string,
  ) => Promise<boolean>
  isProcessing: boolean
}

export function PaymentDialog({
  open,
  onOpenChange,
  protocolId,
  amountDue,
  amountPending,
  patientPaid,
  amountToReturn,
  paymentStatusName,
  onRegularize,
  isProcessing,
}: PaymentDialogProps) {
  const [operation, setOperation] = useState<OperationType>("patient_paid")
  const [amount, setAmount] = useState("")
  // Por dónde entró (o salió) esta plata. Obligatorio en las dos direcciones:
  // una devolución sale del cajón o de una cuenta igual que un cobro entra, y
  // el arqueo tiene que poder cuadrar contra el libro.
  const [forma, setForma] = useState("")
  const [cuenta, setCuenta] = useState("")
  const [confirmandoRedondeo, setConfirmandoRedondeo] = useState(false)
  const pagoCompleto = forma === "efectivo" || (forma === "transferencia" && !!cuenta)

  const pending = Number.parseFloat(amountPending || "0")
  const toReturn = Number.parseFloat(amountToReturn || "0")
  const due = Number.parseFloat(amountDue || "0")
  const paid = Number.parseFloat(patientPaid || "0")

  const maxAmount = operation === "patient_paid" ? pending : toReturn

  // Auto-select operation based on what makes sense
  useEffect(() => {
    if (open) {
      setAmount("")
      setForma("")
      setCuenta("")
      if (toReturn > 0 && pending <= 0) {
        setOperation("refunded_to_patient")
      } else {
        setOperation("patient_paid")
      }
    }
  }, [open, pending, toReturn])

  const handleConfirm = async () => {
    const value = Number.parseFloat(amount)
    if (isNaN(value) || value <= 0) return
    if (!pagoCompleto) return

    if (operation === "patient_paid" && value > pending) {
      setConfirmandoRedondeo(true)
      return
    }

    await registrar(value)
  }

  const registrar = async (value: number) => {
    if (isNaN(value) || value <= 0 || !pagoCompleto) return

    const success = await onRegularize(value, operation, forma, cuenta)
    if (success) {
      setAmount("")
      setForma("")
      setCuenta("")
      onOpenChange(false)
    }
  }

  const cobrarJusto = async () => {
    setConfirmandoRedondeo(false)
    setAmount(pending.toFixed(2))
    await registrar(pending)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setAmount("")
      setForma("")
      setCuenta("")
    }
    onOpenChange(isOpen)
  }

  const handleSetMax = () => {
    if (maxAmount > 0) {
      setAmount(maxAmount.toFixed(2))
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const lower = status.toLowerCase()
    if (lower.includes("cero") || lower.includes("completo") || lower.includes("pagado")) {
      return "bg-emerald-100 text-emerald-800"
    }
    if (lower.includes("incompleto") || lower.includes("parcial") || lower.includes("pendiente")) {
      return "bg-orange-100 text-orange-800"
    }
    if (lower.includes("devolver") || lower.includes("devolucion") || lower.includes("devolución")) {
      return "bg-amber-100 text-amber-800"
    }
    return "bg-gray-100 text-gray-800"
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Pagos - Protocolo #{protocolId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment Summary */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Estado de pago</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadgeColor(paymentStatusName)}`}>
                {paymentStatusName}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Total a pagar</p>
                <p className="text-lg font-bold text-gray-900">${due.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Pagado</p>
                <p className="text-lg font-bold text-emerald-700">${paid.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Pendiente</p>
                <p className="text-lg font-bold text-orange-700">${pending.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 rounded-md p-3">
                <p className="text-xs text-gray-500">A devolver</p>
                <p className="text-lg font-bold text-amber-700">${toReturn.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Operation Type Tabs */}
          <div className="flex gap-2">
            <Button
              variant={operation === "patient_paid" ? "default" : "outline"}
              size="sm"
              className={`flex-1 ${operation === "patient_paid" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => {
                setOperation("patient_paid")
                setAmount("")
              }}
              disabled={pending <= 0}
            >
              <ArrowDownLeft className="h-4 w-4 mr-1" />
              Registrar Pago
            </Button>
            <Button
              variant={operation === "refunded_to_patient" ? "default" : "outline"}
              size="sm"
              className={`flex-1 ${operation === "refunded_to_patient" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              onClick={() => {
                setOperation("refunded_to_patient")
                setAmount("")
              }}
              disabled={toReturn <= 0}
            >
              <ArrowUpRight className="h-4 w-4 mr-1" />
            Registrar devolución
            </Button>
          </div>

          {/* Amount Input with Total button */}
          <div className="space-y-2">
            <Label htmlFor="regularize-amount">
              {operation === "patient_paid" ? "Monto a cobrar" : "Monto a devolver"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="regularize-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder={`Saldo pendiente: $${maxAmount.toFixed(2)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={maxAmount <= 0}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSetMax}
                disabled={maxAmount <= 0}
                className="shrink-0 px-3 font-medium text-xs"
              >
                Total
              </Button>
            </div>
            {maxAmount > 0 && (
              <p className="text-xs text-gray-500">
                Ingrese el saldo pendiente o un monto mayor si el paciente paga de más.
              </p>
            )}
            {maxAmount <= 0 && (
              <p className="text-xs text-amber-600">
                {operation === "patient_paid"
                  ? "No hay saldo pendiente de cobro"
                  : "No hay monto pendiente de devolucion"}
              </p>
            )}
          </div>

          {/* Después del monto: primero cuánto, después cómo. Es el orden en
              que pasa en el mostrador. */}
          <FormaDePago
            formaDePago={forma}
            cuentaId={cuenta}
            onFormaChange={setForma}
            onCuentaChange={setCuenta}
            disabled={isProcessing}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isProcessing ||
              !amount ||
              Number.parseFloat(amount) <= 0 ||
              !pagoCompleto
            }
            className={`w-full sm:w-auto ${
              operation === "patient_paid"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                {operation === "patient_paid" ? "Confirmar pago" : "Confirmar devolución"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <RoundingConfirmDialog open={confirmandoRedondeo} diferencia={Number.parseFloat(amount || "0") - pending} isProcessing={isProcessing} onOpenChange={setConfirmandoRedondeo} onRedondear={() => { setConfirmandoRedondeo(false); void registrar(Number.parseFloat(amount)) }} onCobrarJusto={cobrarJusto} />
    </Dialog>
  )
}
