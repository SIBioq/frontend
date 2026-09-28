"use client"

import { useEffect, useState } from "react"
import { Loader2, Stethoscope } from "lucide-react"

import { CreateMedicoForm } from "@/components/ingreso/components/create-medico-form"
import { MedicoCombobox } from "@/components/ingreso/components/medico-combobox"
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
import { MEDICAL_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import type { Medico } from "@/types"

/**
 * Cambiar el médico solicitante.
 *
 * POR QUÉ VA EN SU PROPIA TARJETA Y NO EN "EDITAR PROTOCOLO"
 * ==========================================================
 * El diálogo de editar juntaba cosas que no tienen nada que ver entre sí
 * —método de envío, número de afiliado, si trajo la orden— y el médico ni
 * siquiera estaba. Para corregir un médico mal cargado había que buscarlo en
 * una lista de campos sueltos.
 *
 * Cada cosa se edita desde donde se muestra: el médico desde la tarjeta del
 * médico. Así el botón está donde uno mira cuando nota el error.
 *
 * No toca precios ni resultados: es un dato de la orden médica.
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  medicoActual?: { id?: number; first_name?: string; last_name?: string; license?: string } | null
  onGuardar: (medicoId: number) => Promise<boolean>
  procesando?: boolean
}

export function MedicoDialog({ open, onOpenChange, medicoActual, onGuardar, procesando = false }: Props) {
  const { apiRequest } = useApi()
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [elegido, setElegido] = useState<Medico | null>(null)
  // "Crear nuevo médico" del combo: antes no hacía nada. Se abre el mismo
  // formulario del ingreso y el recién creado queda elegido.
  const [creando, setCreando] = useState(false)

  // La primera página se trae acá: el combobox sin lista inicial no muestra
  // nada hasta que se escribe, y lo más común es elegir uno de los de siempre.
  useEffect(() => {
    if (!open) return
    setCreando(false)
    setElegido((medicoActual?.id ? (medicoActual as Medico) : null))
    apiRequest(`${MEDICAL_ENDPOINTS.DOCTORS}?limit=20&offset=0&is_active=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!datos) return
        setMedicos(Array.isArray(datos) ? datos : datos.results || [])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sinCambios = !elegido || elegido.id === medicoActual?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#204983]" />
            Médico solicitante
          </DialogTitle>
          <DialogDescription>
            Quién pidió los análisis. Cambiarlo no afecta los precios ni los resultados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label>Profesional</Label>
          <MedicoCombobox
            medicos={medicos}
            selectedMedico={elegido}
            onMedicoSelect={setElegido}
            onShowCreateMedico={() => setCreando(true)}
          />
          {creando && (
            <CreateMedicoForm
              onMedicoCreated={(nuevo) => {
                setMedicos((lista) => [...lista, nuevo])
                setElegido(nuevo)
                setCreando(false)
              }}
              onCancel={() => setCreando(false)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (elegido && (await onGuardar(elegido.id))) onOpenChange(false)
            }}
            disabled={procesando || sinCambios}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
