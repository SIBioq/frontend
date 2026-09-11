"use client"

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage, readApiError } from "@/lib/api-error"

/**
 * Carga las obras sociales desde la planilla de Excel.
 *
 * POR QUÉ SON DOS PASOS
 * =====================
 * La planilla trae 45 filas y de cada una salen DOS obras sociales: la común y
 * la de internación. Son casi cien registros de un clic, sobre un archivo que
 * se llena a mano.
 *
 * Así que primero se muestra qué va a pasar —cuántas se crean, cuáles se
 * modifican y qué campos— y recién después se confirma. Subir el archivo no
 * escribe nada.
 *
 * La vista previa la calcula el servidor con el mismo código que después
 * guarda; acá no se adivina nada.
 */

type Detalle = {
  fila: number
  nombre: string
  internacion: boolean
  accion: "crear" | "actualizar" | "sin cambios"
  campos: string[]
  avisos: string[]
}

type Resumen = {
  vista_previa: boolean
  creadas: number
  actualizadas: number
  sin_cambios: number
  obras_sociales: number
  detalle: Detalle[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const ETIQUETAS: Record<string, string> = {
  ub_value: "valor UB",
  nbu: "nomenclador",
  billing_entity: "facturación",
  chooses_billing_entity: "elige entidad al ingresar",
  charges_coseguro: "coseguro",
  charges_material_descartable: "material descartable",
  charges_derivacion: "derivación",
  requires_preauthorization: "preautorización",
  description: "descripción",
  is_active: "reactivación",
}

export function ImportarObrasSocialesDialog({ open, onOpenChange, onSuccess }: Props) {
  const { apiRequest } = useApi()
  const { success, error } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Resumen | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const [trabajando, setTrabajando] = useState(false)

  const limpiar = () => {
    setArchivo(null)
    setPrevia(null)
    setErrores([])
    if (inputRef.current) inputRef.current.value = ""
  }

  const cerrar = (abierto: boolean) => {
    if (!abierto) limpiar()
    onOpenChange(abierto)
  }

  const enviar = async (confirmar: boolean) => {
    if (!archivo) return
    setTrabajando(true)
    setErrores([])
    try {
      const body = new FormData()
      body.append("file", archivo)
      if (confirmar) body.append("confirmar", "true")

      const respuesta = await apiRequest(MEDICAL_ENDPOINTS.INSURANCES_IMPORT, {
        method: "POST",
        body,
      })
      const datos = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        // El servidor puede devolver una lista de problemas de la planilla,
        // fila por fila. Se muestran todos: corregir de a uno y volver a subir
        // el archivo cinco veces no es una manera de trabajar.
        if (Array.isArray(datos.errores) && datos.errores.length > 0) {
          setErrores(datos.errores)
          setPrevia(null)
          return
        }
        throw new Error(
          datos.detail || (await readApiError(respuesta, "No se pudo importar")),
        )
      }

      if (confirmar) {
        success("Obras sociales importadas", {
          description:
            `${datos.creadas} nuevas, ${datos.actualizadas} actualizadas, ` +
            `${datos.sin_cambios} sin cambios.`,
        })
        onSuccess()
        cerrar(false)
        return
      }

      setPrevia(datos as Resumen)
    } catch (e) {
      error("No se pudo leer la planilla", { description: getErrorMessage(e) })
    } finally {
      setTrabajando(false)
    }
  }

  const pendientes = useMemo(
    () => (previa?.detalle ?? []).filter((d) => d.avisos.length > 0),
    [previa],
  )
  const cambios = useMemo(
    () => (previa?.detalle ?? []).filter((d) => d.accion !== "sin cambios"),
    [previa],
  )

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar obras sociales</DialogTitle>
          <DialogDescription>
            Por cada fila de la planilla se cargan dos: la común y la de internación,
            cada una con sus propias columnas.
          </DialogDescription>
        </DialogHeader>

        {!previa && (
          <div className="space-y-3">
            <label
              htmlFor="planilla-ooss"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed
                         border-gray-300 p-8 text-center transition hover:border-[#204983] hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-8 w-8 text-[#204983]" />
              <span className="text-sm font-medium text-gray-900">
                {archivo ? archivo.name : "Elegí la planilla (.xlsx)"}
              </span>
              <span className="text-xs text-gray-500">
                Se lee la hoja «Obras Sociales»
              </span>
            </label>
            <input
              id="planilla-ooss"
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null)
                setErrores([])
              }}
            />

            <p className="text-xs text-gray-500">
              Subir el archivo no guarda nada todavía: primero se muestra qué va a
              pasar. Un campo vacío en la planilla nunca borra lo que ya está cargado.
            </p>
          </div>
        )}

        {errores.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-red-900">
              <AlertTriangle className="h-4 w-4" />
              Hay que corregir la planilla
            </p>
            <ul className="space-y-1 text-xs text-red-800">
              {errores.map((mensaje) => (
                <li key={mensaje}>· {mensaje}</li>
              ))}
            </ul>
          </div>
        )}

        {previa && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xl font-semibold text-green-700">{previa.creadas}</p>
                <p className="text-xs text-green-800">se crean</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xl font-semibold text-blue-700">{previa.actualizadas}</p>
                <p className="text-xs text-blue-800">se actualizan</p>
              </div>
              <div className="rounded-lg bg-gray-100 p-3">
                <p className="text-xl font-semibold text-gray-600">{previa.sin_cambios}</p>
                <p className="text-xs text-gray-600">quedan igual</p>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {previa.obras_sociales} filas en la planilla.
            </p>

            {pendientes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Para revisar: {pendientes.length}
                </p>
                <p className="mb-2 text-xs text-amber-800">
                  Se importan igual. Las que dicen «se elige en cada ingreso» no
                  son un dato que falte: esas obras sociales facturan por Centro o
                  por Clínica según cómo se preautorizó al paciente, y se decide
                  al cargar el protocolo.
                </p>
                <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-amber-900">
                  {pendientes.map((d) => (
                    <li key={`${d.fila}-${d.nombre}`}>
                      <span className="font-medium">{d.nombre}</span>: {d.avisos.join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cambios.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <tbody>
                    {cambios.map((d) => (
                      <tr key={`${d.fila}-${d.nombre}`} className="border-b last:border-0">
                        <td className="p-2">
                          <span className="font-medium text-gray-900">{d.nombre}</span>
                        </td>
                        <td className="p-2 text-gray-500">
                          {d.accion === "crear"
                            ? "nueva"
                            : d.campos.map((c) => ETIQUETAS[c] ?? c).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {previa ? (
            <>
              <Button variant="outline" onClick={limpiar} disabled={trabajando}>
                Elegir otro archivo
              </Button>
              <Button
                className="bg-[#204983] hover:bg-[#1a3d6f]"
                onClick={() => enviar(true)}
                disabled={trabajando || previa.creadas + previa.actualizadas === 0}
              >
                {trabajando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => cerrar(false)} disabled={trabajando}>
                Cancelar
              </Button>
              <Button
                className="bg-[#204983] hover:bg-[#1a3d6f]"
                onClick={() => enviar(false)}
                disabled={!archivo || trabajando}
              >
                {trabajando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Ver qué va a pasar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
