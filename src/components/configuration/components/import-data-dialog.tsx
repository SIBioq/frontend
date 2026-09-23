"use client"

import type React from "react"
import { useState } from "react"
import { useApi } from "@/hooks/use-api"
import { toast } from "sonner"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Info } from "lucide-react"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { useEndpointProgress } from "@/hooks/use-endpoint-progress"

/** Lo que devuelve el backend cuando el Excel es la lista de derivación. */
type PlanDeDerivacion = {
  aplicado: boolean
  detail: string
  en_la_planilla: number
  reconocidos: number
  sin_resolver: string[]
  dejan_de_derivarse: string[]
  pasan_a_derivarse: string[]
  sin_cambios: number
  total_del_catalogo: number
}

interface ImportDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportDataDialog({ open, onOpenChange, onSuccess }: ImportDataDialogProps) {
  const { apiRequest } = useApi()

  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La planilla de derivación cambia `requires_derivacion` en TODO el
  // catálogo de una vez, y la derivación se cobra. El backend no escribe hasta
  // que se confirma; acá se muestra qué haría antes de dejar apretar de nuevo.
  const [plan, setPlan] = useState<PlanDeDerivacion | null>(null)
  const progress = useEndpointProgress()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setPlan(null)
    }
  }

  const handleImport = async (confirmar = false) => {
    if (!file) {
      setError("Por favor selecciona un archivo")
      return
    }

    setIsLoading(true)
    setError(null)
    progress.start()

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (confirmar) formData.append("confirmar", "true")

      const response = await apiRequest(CATALOG_ENDPOINTS.ANALYSIS_IMPORT, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()

        // La planilla de derivación: si todavía no se aplicó, se muestra el
        // resumen y se espera la confirmación.
        if (typeof data.aplicado === "boolean") {
          if (!data.aplicado) {
            setPlan(data as PlanDeDerivacion)
            progress.finish()
            return
          }
          toast.success(data.detail || "Lista de derivación aplicada.")
          progress.finish()
          onOpenChange(false)
          onSuccess()
          return
        }

        const analysesCreated = data.analyses?.created ?? 0
        const analysesSkipped = data.analyses?.skipped ?? 0
        const determinationsCreated = data.determinations?.created ?? 0
        const determinationsSkipped = data.determinations?.skipped ?? 0
        const submodulosCreated = data.submodulos?.created ?? 0
        const submodulosSkipped = data.submodulos?.skipped ?? 0
        const submodulosErrors: unknown[] = data.submodulos?.errors ?? []
        const resumenDeSubmodulos = data.submodulos
          ? `; ${submodulosCreated} submódulos creados, ${submodulosSkipped} omitidos`
          : ""
        const importSummary =
          data.analyses && data.determinations
            ? `${analysesCreated} análisis creados, ${analysesSkipped} omitidos; ${determinationsCreated} determinaciones creadas, ${determinationsSkipped} omitidas${resumenDeSubmodulos}.`
            : data.message || "Los datos se importaron correctamente"
        toast.success(importSummary)
        if (submodulosErrors.length > 0) {
          toast.warning(
            `${submodulosErrors.length} submódulo(s) no se pudieron importar. Revisá la planilla.`
          )
        }
        progress.finish()
        onOpenChange(false)
        onSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = formatApiError(errorData, "Error al importar el catálogo")
        setError(errorMessage)
        toast.error(errorMessage)
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err, "No se pudo importar el catálogo.")
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      progress.finish()
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFile(null)
      setError(null)
      setPlan(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeading
          icon={FileSpreadsheet}
          title="Importar catálogo"
          description="Seleccioná un Excel (.xls o .xlsx) con el formato correcto para importar análisis y determinaciones."
        />

        <div className="space-y-4 py-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <AlertDescription className="text-xs md:text-sm text-blue-900">
              <strong className="block mb-2">Formato requerido del archivo Excel:</strong>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold">Tabla 1: "Analisis"</p>
                  <p className="text-[10px] md:text-xs mt-1">Formato anterior:</p>
                  <ul className="list-disc list-inside text-[10px] md:text-xs mt-1 ml-2 space-y-0.5">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">id</code> - Identificador único del análisis
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">codigo</code> - Código del análisis
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">nombre</code> - Nombre del análisis
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">urgencia</code> - Indica si es urgente (true/false)
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">ub</code> - Unidad bioquímica
                    </li>
                  </ul>
                  <p className="text-[10px] md:text-xs mt-2">Formato nuevo:</p>
                  <ul className="list-disc list-inside text-[10px] md:text-xs mt-1 ml-2 space-y-0.5">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">ub 2016</code>,{" "}
                      <code className="bg-blue-100 px-1 rounded">ub 2023</code>,{" "}
                      <code className="bg-blue-100 px-1 rounded">ub 2024</code> - UB por año
                    </li>
                    <li>También se aceptan otras columnas con formato ub + año.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Tabla 2: "Determinaciones"</p>
                  <p className="text-[10px] md:text-xs mt-1">Formato anterior:</p>
                  <ul className="list-disc list-inside text-[10px] md:text-xs mt-1 ml-2 space-y-0.5">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">id</code> - Identificador único de la determinación
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">nombre</code> - Nombre de la determinación
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">unidad_medida</code> - Unidad de medida
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">analisis_id</code> - ID del análisis al que pertenece
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">formula</code> - Fórmula de cálculo (opcional)
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">valores_referencia</code> - Valores de referencia
                      (JSON)
                    </li>
                  </ul>
                  <p className="text-[10px] md:text-xs mt-2">Formato nuevo:</p>
                  <ul className="list-disc list-inside text-[10px] md:text-xs mt-1 ml-2 space-y-0.5">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">codigo</code> - Código de determinación
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">hombre_mayor_min/max</code>,{" "}
                      <code className="bg-blue-100 px-1 rounded">mujer_mayor_min/max</code>,{" "}
                      <code className="bg-blue-100 px-1 rounded">niño_min/max</code>,{" "}
                      <code className="bg-blue-100 px-1 rounded">niña_min/max</code> - Rangos de referencia
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Tabla 3: "Submodulos" (opcional)</p>
                  <p className="text-[10px] md:text-xs mt-1">
                    Una planilla vieja que no trae esta hoja se sigue importando igual.
                  </p>
                  <ul className="list-disc list-inside text-[10px] md:text-xs mt-1 ml-2 space-y-0.5">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">analisis_id</code> o{" "}
                      <code className="bg-blue-100 px-1 rounded">analisis_codigo</code> - Análisis al
                      que pertenece
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">nombre</code> - Nombre del submódulo
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">total_esperado</code> - Suma esperada
                      de las determinaciones
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">tolerancia</code> - Margen admitido
                      (vacío se toma como 0)
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">determinaciones</code> - Códigos de
                      las determinaciones separados por coma
                    </li>
                  </ul>
                  <p className="text-[10px] md:text-xs mt-1">
                    Si el análisis ya tiene un submódulo con ese mismo nombre, la fila se omite.
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="file" className="text-sm">
              Archivo
            </Label>
            <Input id="file" type="file" onChange={handleFileChange} disabled={isLoading} className="text-sm" />
            {file && (
              <p className="text-xs md:text-sm text-gray-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
              </p>
            )}
          </div>

          {plan && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <AlertDescription className="text-xs text-amber-900 md:text-sm">
                <strong className="mb-1 block">
                  Esto cambia la derivación de todo el catálogo. Revisalo antes de aplicar.
                </strong>
                <ul className="mt-2 space-y-0.5">
                  <li>
                    <strong>{plan.pasan_a_derivarse.length}</strong> análisis pasan a
                    cobrar derivación.
                  </li>
                  <li>
                    <strong>{plan.dejan_de_derivarse.length}</strong> dejan de cobrarla.
                  </li>
                  <li>
                    {plan.sin_cambios} quedan como están, sobre{" "}
                    {plan.total_del_catalogo} del catálogo.
                  </li>
                </ul>
                {plan.sin_resolver.length > 0 && (
                  <p className="mt-2">
                    No se encontraron {plan.sin_resolver.length} de los{" "}
                    {plan.en_la_planilla} de la planilla, así que van a quedar
                    cobrando derivación: {plan.sin_resolver.join(", ")}.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs md:text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => handleImport(Boolean(plan))}
            disabled={!file || isLoading}
            className="relative overflow-hidden bg-[#204983] hover:bg-[#1a3d6f] w-full sm:w-auto"
          >
            <span
              className="absolute inset-y-0 left-0 bg-[#1a3d6f] transition-[width] duration-150"
              style={{ width: `${progress.progress}%` }}
            />
            <span className="relative z-10 flex items-center">
            {isLoading ? (
              <>
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {plan ? "Confirmar y aplicar" : "Importar"}
              </>
            )}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
