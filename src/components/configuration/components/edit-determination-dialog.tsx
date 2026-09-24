"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputUnidadDeMedida } from "./input-unidad-de-medida"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, FlaskConical } from "lucide-react"
import type { Determination } from "@/types"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { CampoNotacionCientifica } from "./campo-notacion-cientifica"
import { CampoDecimales } from "./campo-decimales"
import { esExponenteValido } from "@/lib/notacion"
import { esDecimalesValido } from "@/lib/decimales"
import {
  rangosConNombreDesde,
  rangosConNombreParaEnviar,
  rangosDesde,
  rangosParaEnviar,
  rangosVacios,
  ValoresDeReferencia,
  type NamedRange,
  type RangeMap,
  type RangoConNombre,
  type RefRange,
} from "./valores-de-referencia"

interface EditDeterminationDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  isOpen?: boolean
  onClose?: () => void
  onSuccess: (updatedDetermination: Determination) => void
  determination: Determination
  analysisId?: number
}

export const EditDeterminationDialog: React.FC<EditDeterminationDialogProps> = ({
  open,
  onOpenChange,
  isOpen,
  onClose,
  onSuccess,
  determination,
}) => {
  const { apiRequest } = useApi()
  const toastActions = useToast()
  const [name, setName] = useState("")
  const [measureUnit, setMeasureUnit] = useState("")
  const [exponente, setExponente] = useState("")
  const [formula, setFormula] = useState("")
  const [decimales, setDecimales] = useState("")
  const [ranges, setRanges] = useState<RangeMap>(rangosVacios)
  const [namedRanges, setNamedRanges] = useState<RangoConNombre[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isDialogOpen = open ?? isOpen ?? false
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else if (!newOpen && onClose) {
      onClose()
    }
  }

  useEffect(() => {
    if (determination && isDialogOpen) {
      setName(determination.name)
      setMeasureUnit(determination.measure_unit)
      setExponente(
        determination.scientific_exponent ? String(determination.scientific_exponent) : "",
      )
      setFormula(determination.formula || "")
      setDecimales(
        determination.decimales !== null && determination.decimales !== undefined
          ? String(determination.decimales)
          : "",
      )
      // Los valores de referencia estructurados (reference_ranges) en los 4
      // grupos. Antes se leía el JSON `reference_values`, por eso no aparecían.
      setRanges(rangosDesde((determination as { reference_ranges?: RefRange[] }).reference_ranges))
      setNamedRanges(
        rangosConNombreDesde((determination as { named_ranges?: NamedRange[] }).named_ranges),
      )
      setErrors({})
      setIsLoading(false)
    }
  }, [determination, isDialogOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "El nombre es requerido."
    if (!measureUnit.trim()) newErrors.measureUnit = "La unidad de medida es requerida."
    if (exponente.trim() !== "" && !esExponenteValido(Number(exponente))) {
      newErrors.exponente = "La notación científica tiene que ser un número entero entre 1 y 30."
    }
    if (decimales.trim() !== "" && !esDecimalesValido(Number(decimales))) {
      newErrors.decimales = "Los decimales tienen que ser un número entero entre 0 y 6."
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!determination || !validateForm()) return

    setIsLoading(true)
    try {
      const body: Record<string, unknown> = {}
      if (name !== determination.name) body.name = name
      if (measureUnit !== determination.measure_unit) body.measure_unit = measureUnit
      // Vacío = sin notación, y hay que mandarlo para poder sacarla.
      const exponenteActual = determination.scientific_exponent ?? null
      const exponenteNuevo = exponente.trim() === "" ? null : Number(exponente)
      if (exponenteNuevo !== exponenteActual) body.scientific_exponent = exponenteNuevo
      if (formula !== (determination.formula || "")) body.formula = formula.trim() || ""
      // Vacío = automático, y hay que mandarlo para poder volver a la regla.
      const decimalesActual = determination.decimales ?? null
      const decimalesNuevo = decimales.trim() === "" ? null : Number(decimales)
      if (decimalesNuevo !== decimalesActual) body.decimales = decimalesNuevo

      // Siempre mandamos los valores de referencia (por si se limpió un grupo).
      body.reference_ranges = rangosParaEnviar(ranges)
      // Ídem los rangos con nombre: la lista que se manda es la que queda.
      body.named_ranges = rangosConNombreParaEnviar(namedRanges)

      const response = await apiRequest(CATALOG_ENDPOINTS.DETERMINATION_DETAIL(determination.id), {
        method: "PATCH",
        body,
      })

      if (response.ok) {
        const updatedDetermination = await response.json()
        toastActions.success("Éxito", { description: "Determinación actualizada correctamente." })
        onSuccess(updatedDetermination)
        handleOpenChange(false)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = formatApiError(errorData, "No se pudo actualizar la determinación.")
        setErrors({ form: errorMessage })
        toastActions.error("Error", { description: errorMessage })
      }
    } catch (error) {
      console.error("Error updating determination:", error)
      const errorMessage = getErrorMessage(error, "Ocurrió un error de red o servidor.")
      setErrors({ form: errorMessage })
      toastActions.error("Error", { description: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  if (!determination) return null

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeading icon={FlaskConical} title="Editar determinación" description={determination.name} />
        <div className="space-y-4 md:space-y-6 py-4">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs md:text-sm">
              {errors.form}
            </div>
          )}

          {determination.code && (
            <div className="space-y-2">
              <Label className="text-sm text-gray-500">Código</Label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">
                {determination.code}
              </div>
              <p className="text-xs text-gray-500">El código se genera automáticamente y no puede modificarse.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-determination-name" className="text-sm">
              Nombre *
            </Label>
            <Input
              id="edit-determination-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingrese el nombre de la determinación"
              className="text-sm"
            />
            {errors.name && <p className="text-xs md:text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-determination-measureUnit" className="text-sm">
              Unidad de Medida *
            </Label>
            <InputUnidadDeMedida
              id="edit-determination-measureUnit"
              value={measureUnit}
              onChange={setMeasureUnit}
            />
            {errors.measureUnit && <p className="text-xs md:text-sm text-red-500">{errors.measureUnit}</p>}
          </div>

          <CampoNotacionCientifica
            id="edit-determination-exponente"
            unidad={measureUnit}
            exponente={exponente}
            onChange={setExponente}
            error={errors.exponente}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-determination-formula" className="text-sm">
              Fórmula (Opcional)
            </Label>
            <Textarea
              id="edit-determination-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ingrese la fórmula de cálculo si aplica"
              rows={3}
              className="text-sm"
            />
          </div>

          {formula.trim() !== "" && (
            <CampoDecimales
              id="edit-determination-decimales"
              decimales={decimales}
              onChange={setDecimales}
              error={errors.decimales}
            />
          )}

          <ValoresDeReferencia
            ranges={ranges}
            onChange={setRanges}
            namedRanges={namedRanges}
            onNamedRangesChange={setNamedRanges}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className="w-full sm:w-auto bg-transparent"
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto bg-[#204983] hover:bg-[#1a3d6f] text-white"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
