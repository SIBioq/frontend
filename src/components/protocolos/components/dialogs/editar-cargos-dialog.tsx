"use client"

import { useEffect, useState } from "react"
import { Loader2, Receipt } from "lucide-react"
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

export interface CargosDelProtocolo {
  materialDescartable: number
  derivacion: number
  coseguro: number
}

interface EditarCargosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  materialDescartableActual?: string
  derivacionActual?: string
  coseguroActual?: string
  insuranceChargesCoseguro: boolean
  onConfirm: (cargos: CargosDelProtocolo) => Promise<boolean>
  isProcessing: boolean
}

const valorInicial = (monto?: string) => monto ?? "0"

const montoValido = (monto: string) => {
  if (monto.trim() === "") return false
  const valor = Number(monto)
  return Number.isFinite(valor) && valor >= 0
}

export function EditarCargosDialog({
  open,
  onOpenChange,
  protocolId,
  materialDescartableActual,
  derivacionActual,
  coseguroActual,
  insuranceChargesCoseguro,
  onConfirm,
  isProcessing,
}: EditarCargosDialogProps) {
  const [materialDescartable, setMaterialDescartable] = useState("0")
  const [derivacion, setDerivacion] = useState("0")
  const [coseguro, setCoseguro] = useState("0")
  const [mostrarErrores, setMostrarErrores] = useState(false)

  useEffect(() => {
    if (!open) return
    setMaterialDescartable(valorInicial(materialDescartableActual))
    setDerivacion(valorInicial(derivacionActual))
    setCoseguro(valorInicial(coseguroActual))
    setMostrarErrores(false)
  }, [open, materialDescartableActual, derivacionActual, coseguroActual])

  const materialValido = montoValido(materialDescartable)
  const derivacionValida = montoValido(derivacion)
  const coseguroValido = !insuranceChargesCoseguro || montoValido(coseguro)
  const formularioValido = materialValido && derivacionValida && coseguroValido

  const handleConfirm = async () => {
    if (!formularioValido) {
      setMostrarErrores(true)
      return
    }

    const ok = await onConfirm({
      materialDescartable: Number(materialDescartable),
      derivacion: Number(derivacion),
      coseguro: Number(coseguro),
    })
    if (ok) onOpenChange(false)
  }

  const mensajeDeError = "Ingresá un monto válido, igual o mayor a cero."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-teal-600" />
            Editar cargos - Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Corregí material descartable, derivación y coseguro. Los análisis mantienen el precio del nomenclador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <CampoMonetario
            id="material-descartable-amount"
            label="Material descartable"
            value={materialDescartable}
            onChange={setMaterialDescartable}
            invalid={mostrarErrores && !materialValido}
            error={mensajeDeError}
          />
          <CampoMonetario
            id="derivacion-amount"
            label="Derivación"
            value={derivacion}
            onChange={setDerivacion}
            invalid={mostrarErrores && !derivacionValida}
            error={mensajeDeError}
          />

          {!insuranceChargesCoseguro && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Esta obra social no cobra coseguro, por eso ese monto no se puede modificar.
            </p>
          )}
          <CampoMonetario
            id="coseguro-amount"
            label="Coseguro"
            value={coseguro}
            onChange={setCoseguro}
            disabled={!insuranceChargesCoseguro}
            invalid={mostrarErrores && !coseguroValido}
            error={mensajeDeError}
            description="Se suma al saldo a pagar por el paciente."
          />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Receipt className="mr-2 h-4 w-4" /> Guardar cargos</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CampoMonetarioProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid: boolean
  error: string
  description?: string
}

function CampoMonetario({ id, label, value, onChange, disabled, invalid, error, description }: CampoMonetarioProps) {
  const errorId = `${id}-error`
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={[descriptionId, invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
      />
      {description && <p id={descriptionId} className="text-xs text-gray-500">{description}</p>}
      {invalid && <p id={errorId} role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
