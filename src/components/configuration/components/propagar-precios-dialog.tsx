"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PROTOCOL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { formatApiError, getErrorMessage } from "@/lib/api-error"

/**
 * "¿Se lo aplico también a los protocolos que ya existen?"
 *
 * POR QUÉ NO SE APLICA SOLO
 * =========================
 * Lo que cobra un protocolo sale de una foto que se sacó al crearlo, no del
 * catálogo de hoy. Es a propósito: actualizar un nomenclador o un monto fijo no
 * le puede cambiar el precio a lo que ya se cobró o ya se presentó a la obra
 * social.
 *
 * Pero cuando el cambio es una CORRECCIÓN —un UB que estaba mal cargado— los
 * protocolos de esa misma mañana normalmente sí tenían que llevarla, y quedan
 * con el número viejo sin que nadie se entere.
 *
 * Ni una cosa ni la otra: se muestran los que quedaron distintos, con la fecha
 * en que se crearon y con lo que ya se les cobró, y la persona elige cuáles.
 *
 * POR QUÉ LA FECHA ES LA COLUMNA QUE IMPORTA
 * ==========================================
 * Es con lo que se decide. Uno de hace dos horas casi seguro tiene que llevar
 * la corrección; uno de la semana pasada, que ya se cobró y se presentó, casi
 * seguro no.
 */

type CambioDeAnalisis = {
  analysis_id: number
  code: string
  name: string
  ub_actual: string
  ub_nueva: string
}

type ProtocoloDesactualizado = {
  id: number
  created_at: string
  patient: string
  insurance: string
  status: string
  total_actual: string
  pagado: string
  analisis: CambioDeAnalisis[]
  cambian_los_montos_fijos: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Acota a los protocolos que tienen ese análisis. Sin él, busca cualquier diferencia. */
  analysisId?: number
  titulo?: string
}

const plata = (valor: string) =>
  `$${Number.parseFloat(valor || "0").toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

const cuando = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

export function PropagarPreciosDialog({ open, onOpenChange, analysisId, titulo }: Props) {
  const { apiRequest } = useApi()
  const { success, error } = useToast()

  const [cargando, setCargando] = useState(true)
  const [protocolos, setProtocolos] = useState<ProtocoloDesactualizado[]>([])
  const [truncado, setTruncado] = useState(false)
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [aplicando, setAplicando] = useState(false)

  const buscar = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams({ dias: "90" })
      if (analysisId) params.append("analysis", String(analysisId))
      const respuesta = await apiRequest(
        `${PROTOCOL_ENDPOINTS.PROTOCOLOS_DESACTUALIZADOS}?${params.toString()}`,
      )
      if (!respuesta.ok) return
      const datos = await respuesta.json()
      setProtocolos(datos.protocolos || [])
      setTruncado(Boolean(datos.truncado))
      // Ninguno viene marcado: aplicar esto mueve plata, así que la decisión es
      // de a uno y a propósito, no un "seleccionar todo" por defecto.
      setElegidos(new Set())
    } finally {
      setCargando(false)
    }
  }, [apiRequest, analysisId])

  useEffect(() => {
    if (open) buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const alternar = (id: number) => {
    setElegidos((previos) => {
      const copia = new Set(previos)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  const aplicar = async () => {
    if (elegidos.size === 0) return
    setAplicando(true)
    try {
      const respuesta = await apiRequest(PROTOCOL_ENDPOINTS.REPRECAR_PROTOCOLOS, {
        method: "POST",
        body: { protocol_ids: [...elegidos] },
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudieron actualizar los protocolos."))
      }
      const datos = await respuesta.json()
      const fallidos = datos.fallidos?.length ?? 0
      success(`${datos.actualizados.length} protocolo(s) actualizado(s)`, {
        description: fallidos
          ? `${fallidos} no se pudieron: ${datos.fallidos[0].motivo}`
          : "Los totales quedaron con los precios de hoy.",
        duration: TOAST_DURATION,
      })
      await buscar()
    } catch (err) {
      error("No se pudieron actualizar", { description: getErrorMessage(err) })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-100 p-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-[#204983]" />
            {titulo || "Protocolos que quedaron con el precio viejo"}
          </DialogTitle>
          <DialogDescription>
            El cambio que acabás de guardar no alcanza a los protocolos ya creados: cada uno
            guarda los precios con los que se cargó. Elegí a cuáles corresponde aplicárselo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {cargando ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando protocolos...
            </p>
          ) : protocolos.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              Ningún protocolo quedó con un precio distinto. No hay nada que aplicar.
            </p>
          ) : (
            <>
              {truncado && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Se muestran los más recientes de los últimos 90 días. Hay más.
                </p>
              )}

              {protocolos.map((protocolo) => (
                <label
                  key={protocolo.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={elegidos.has(protocolo.id)}
                    onCheckedChange={() => alternar(protocolo.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">#{protocolo.id}</span>
                      <span className="text-sm text-gray-700">{protocolo.patient}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {protocolo.status}
                      </Badge>
                    </div>

                    {/* LA FECHA, QUE ES CON LO QUE SE DECIDE. */}
                    <p className="text-xs text-gray-500">
                      Creado el {cuando(protocolo.created_at)} · {protocolo.insurance}
                    </p>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {protocolo.analisis.map((cambio) => (
                        <span
                          key={cambio.analysis_id}
                          className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700"
                        >
                          {cambio.name}{" "}
                          <span className="font-mono text-gray-400 line-through">{cambio.ub_actual}</span>{" "}
                          <span className="font-mono font-semibold text-[#204983]">{cambio.ub_nueva}</span> UB
                        </span>
                      ))}
                      {protocolo.cambian_los_montos_fijos && (
                        <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs text-violet-800">
                          Cambian los montos fijos
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-600">
                      Cobra {plata(protocolo.total_actual)} · pagó{" "}
                      <span className={Number.parseFloat(protocolo.pagado) > 0 ? "font-semibold text-emerald-700" : ""}>
                        {plata(protocolo.pagado)}
                      </span>
                    </p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50/60 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>
            Cerrar
          </Button>
          <Button
            onClick={aplicar}
            disabled={aplicando || elegidos.size === 0}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {aplicando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Aplicar a {elegidos.size} protocolo{elegidos.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
