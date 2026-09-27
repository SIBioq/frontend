"use client"

import { useEffect, useState } from "react"
import { Building2, Loader2 } from "lucide-react"

import { BillingEntitySelect } from "@/components/configuration/components/billing-entity-select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * A qué entidad se le presenta este protocolo.
 *
 * POR QUÉ SE PUEDE CORREGIR DESPUÉS
 * =================================
 * Se elige en el mostrador, mirando la preautorización del paciente, y ahí se
 * puede errar. Una entidad equivocada no da ningún error: el protocolo aparece
 * en los pendientes de la OTRA entidad y se factura ahí. Se descubre al cerrar
 * el mes, cuando ya se presentó.
 *
 * NO SE PUEDE DEJAR SIN ELEGIR
 * ============================
 * Un protocolo sin entidad no sale en los pendientes de ninguna de las dos:
 * no se factura nunca y nadie se entera. El backend lo rechaza; acá el
 * selector directamente no ofrece "sin asignar".
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidadActualId?: number | null
  nombreDeLaObraSocial?: string
  onGuardar: (entidadId: number) => Promise<boolean>
  procesando?: boolean
}

export function EntidadDeFacturacionDialog({
  open,
  onOpenChange,
  entidadActualId,
  nombreDeLaObraSocial,
  onGuardar,
  procesando = false,
}: Props) {
  const [elegida, setElegida] = useState("")

  // Se relee al abrir: si alguien la cambió desde otro lado, el diálogo no
  // puede ofrecer lo de antes como si fuera lo actual.
  useEffect(() => {
    if (!open) return
    setElegida(entidadActualId ? String(entidadActualId) : "")
  }, [open, entidadActualId])

  const sinCambios = elegida === (entidadActualId ? String(entidadActualId) : "")

  const confirmar = async () => {
    if (!elegida) return
    if (await onGuardar(Number(elegida))) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#204983]" />
            Entidad a facturar
          </DialogTitle>
          <DialogDescription>
            {nombreDeLaObraSocial
              ? `${nombreDeLaObraSocial} factura por Centro o por Clínica según cómo se preautorizó al paciente.`
              : "A qué entidad se le presenta este protocolo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="entidad-del-protocolo">¿Por cuál va? *</Label>
          <BillingEntitySelect
            id="entidad-del-protocolo"
            value={elegida}
            onValueChange={setElegida}
            allowNone={false}
            disabled={procesando}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={procesando || sinCambios || !elegida}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
