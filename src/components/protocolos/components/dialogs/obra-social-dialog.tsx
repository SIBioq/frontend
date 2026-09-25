"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, Shield } from "lucide-react"

import { ObraSocialCombobox } from "@/components/ingreso/components/obra-social-combobox"
import { CreateObraSocialForm } from "@/components/ingreso/components/create-obra-social-form"
import { BillingEntitySelect } from "@/components/configuration/components/billing-entity-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MEDICAL_ENDPOINTS, PATIENT_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import type { Insurance } from "@/types"

/**
 * Cambiar la obra social de un protocolo ya creado.
 *
 * LO QUE HAY QUE AVISAR ANTES
 * ===========================
 * No es un dato más: la obra social decide cuántas UB vale cada análisis, si se
 * cobra material descartable y derivación, y quién paga qué. Al guardar, el
 * backend vuelve a sacar la foto de precios del protocolo entero.
 *
 * Por eso el cartel. Si el paciente ya pagó, el saldo se mueve — puede quedar
 * debiendo o a favor— y eso se ve en el momento, no cuando alguien cierra la
 * caja.
 *
 * EL NÚMERO DE AFILIADO SE EDITA ACÁ
 * =================================
 * Porque es de la obra social: es el número CON EL QUE ESA obra social conoce
 * al paciente, y el que va impreso en el informe y en la presentación. No tenía
 * dónde corregirse, y un dígito mal copiado en el mostrador se descubría cuando
 * la obra social rechazaba la presentación.
 *
 * Se puede guardar solo el número, sin tocar la obra social: corregir un
 * dígito no tiene por qué rehacer los precios de todo el protocolo.
 *
 * Al elegir OTRA obra social el número se reemplaza por el que el paciente
 * tenga con ESA —el laboratorio ya lo vio en un protocolo anterior— y si no hay
 * ninguno, se vacía. Dejar ahí el número de la obra social anterior sería
 * ofrecer un dato equivocado justo cuando nadie lo va a revisar.
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  obraSocialActual?: { id?: number; name?: string } | null
  entidadActualId?: number | null
  /** El número de afiliado que tiene hoy el protocolo. */
  numeroDeAfiliadoActual?: string
  /** Para ofrecer el número que el paciente ya usó con la obra social elegida. */
  pacienteId?: number | null
  /** `insuranceId` viene `null` cuando solo se corrigió el número de afiliado. */
  onGuardar: (
    insuranceId: number | null,
    billingEntityId: number | null,
    numeroDeAfiliado: string,
  ) => Promise<boolean>
  procesando?: boolean
}

export function ObraSocialDialog({
  open,
  onOpenChange,
  obraSocialActual,
  entidadActualId,
  numeroDeAfiliadoActual = "",
  pacienteId,
  onGuardar,
  procesando = false,
}: Props) {
  const { apiRequest } = useApi()
  const [obrasSociales, setObrasSociales] = useState<Insurance[]>([])
  const [elegida, setElegida] = useState<Insurance | null>(null)
  const [entidad, setEntidad] = useState("")
  const [numero, setNumero] = useState(numeroDeAfiliadoActual)
  /** Los números que este paciente ya usó, por obra social. */
  const [afiliacionesConocidas, setAfiliacionesConocidas] = useState<Record<number, string>>({})
  // "Crear nueva obra social" del combo: antes no hacía nada. Se abre el mismo
  // formulario del ingreso y la recién creada queda elegida.
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (!open) return
    setElegida(null)
    setCreando(false)
    setEntidad(entidadActualId ? String(entidadActualId) : "")
    setNumero(numeroDeAfiliadoActual)
    apiRequest(`${MEDICAL_ENDPOINTS.INSURANCES}?limit=20&offset=0&is_active=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!datos) return
        setObrasSociales(Array.isArray(datos) ? datos : datos.results || [])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !pacienteId) return
    apiRequest(PATIENT_ENDPOINTS.PATIENT_AFILIACIONES(pacienteId))
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!datos) return
        const porOoss: Record<number, string> = {}
        for (const fila of datos.afiliaciones || []) porOoss[fila.insurance_id] = fila.affiliate_number
        setAfiliacionesConocidas(porOoss)
      })
      .catch(() => {
        // Que no se sepa el número de antes no puede romper el diálogo: se
        // escribe a mano, como siempre.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pacienteId])

  // La entidad solo se pide en las que facturan por Centro o por Clínica según
  // la preautorización. En el resto sale de la obra social.
  const pideEntidad = Boolean(elegida?.chooses_billing_entity)
  const cambio = Boolean(elegida) && elegida?.id !== obraSocialActual?.id
  const cambioDeNumero = numero.trim() !== (numeroDeAfiliadoActual || "").trim()

  // La que va a quedar: la elegida si eligió, la de ahora si no.
  const obraSocialEfectiva = elegida ?? obraSocialActual
  const esParticular = (obraSocialEfectiva?.name || "Particular").trim().toLowerCase() === "particular"

  const puedeGuardar = (cambio || cambioDeNumero) && (!pideEntidad || Boolean(entidad))

  /** Al cambiar de obra social, el número que se ofrece es el de ESA. */
  const elegirObraSocial = (nueva: Insurance | null) => {
    setElegida(nueva)
    if (!nueva || nueva.id === obraSocialActual?.id) {
      setNumero(numeroDeAfiliadoActual)
      return
    }
    setNumero(afiliacionesConocidas[nueva.id] || "")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#204983]" />
            Obra social
          </DialogTitle>
          <DialogDescription>
            Actual: <strong>{obraSocialActual?.name || "Particular"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nueva obra social</Label>
            <ObraSocialCombobox
              obrasSociales={obrasSociales}
              selectedObraSocial={elegida}
              onObraSocialSelect={elegirObraSocial}
              onShowCreateObraSocial={() => setCreando(true)}
            />
          </div>

          {creando && (
            <CreateObraSocialForm
              onObraSocialCreated={(nueva) => {
                setObrasSociales((lista) => [...lista, nueva])
                elegirObraSocial(nueva)
                setCreando(false)
              }}
              onCancel={() => setCreando(false)}
            />
          )}

          {!esParticular && (
            <div className="space-y-1.5">
              <Label htmlFor="numero-de-afiliado">
                N° de afiliado
                {obraSocialEfectiva?.name && (
                  <span className="ml-1 font-normal text-gray-500">
                    en {obraSocialEfectiva.name}
                  </span>
                )}
              </Label>
              <Input
                id="numero-de-afiliado"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Sin número de afiliado"
                disabled={procesando}
                className="h-9 text-sm"
              />
            </div>
          )}

          {pideEntidad && (
            <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor="entidad-al-cambiar" className="text-sm text-amber-900">
                ¿Por dónde factura este paciente? *
              </Label>
              <p className="text-xs text-amber-800">
                {elegida?.name} va por Centro o por Clínica según cómo se preautorizó.
              </p>
              <BillingEntitySelect
                id="entidad-al-cambiar"
                value={entidad}
                onValueChange={setEntidad}
                allowNone={false}
                disabled={procesando}
              />
            </div>
          )}

          {cambio && (
            <p className="flex items-start gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Se recalculan los precios del protocolo: la cantidad de UB de cada análisis
                según el nomenclador de {elegida?.name}, y el material descartable y la
                derivación según lo que esa obra social cobre. Si el paciente ya pagó, el
                saldo se mueve.
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!puedeGuardar) return
              const guardado = await onGuardar(
                cambio && elegida ? elegida.id : null,
                pideEntidad && entidad ? Number(entidad) : null,
                numero.trim(),
              )
              if (guardado) onOpenChange(false)
            }}
            disabled={procesando || !puedeGuardar}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            {cambio ? "Cambiar y recalcular" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
