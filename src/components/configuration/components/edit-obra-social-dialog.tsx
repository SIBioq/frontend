"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, CheckCircle, Building2 } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { toast } from "sonner"
import { MEDICAL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import type { ObraSocial } from "@/types"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { NbuSelect } from "./nbu-select"
import { BillingEntitySelect } from "./billing-entity-select"

interface EditObraSocialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  obraSocial: ObraSocial
  onSuccess: () => void
}

interface FormData {
  name: string
  description: string
  ub_value: string
  nbu_id: string
  billing_entity_id: string
  chooses_billing_entity: boolean
  charges_coseguro: boolean
  charges_material_descartable: boolean
  charges_derivacion: boolean
  requires_preauthorization: boolean
  a_reintegro: boolean
  descuento_desde_ub: string
  descuento_porcentaje_a_cobrar: string
}

const extractNbuId = (nbu: unknown): string => {
  if (!nbu) return ""
  if (typeof nbu === "number") return String(nbu)
  if (typeof nbu === "string") return nbu
  if (typeof nbu === "object" && nbu !== null) {
    const obj = nbu as { id?: number }
    return obj.id ? String(obj.id) : ""
  }
  return ""
}

interface ValidationState {
  name: { isValid: boolean; message: string }
  description: { isValid: boolean; message: string }
  ub_value: { isValid: boolean; message: string }
}

export function EditObraSocialDialog({ open, onOpenChange, obraSocial, onSuccess }: EditObraSocialDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    ub_value: "",
    nbu_id: "",
    billing_entity_id: "",
  chooses_billing_entity: false,
    charges_coseguro: false,
    charges_material_descartable: false,
    charges_derivacion: false,
    requires_preauthorization: false,
  a_reintegro: false,
    descuento_desde_ub: "",
    descuento_porcentaje_a_cobrar: "",
  })
  const [validation, setValidation] = useState<ValidationState>({
    name: { isValid: true, message: "Nombre válido" },
    description: { isValid: true, message: "" },
    ub_value: { isValid: true, message: "" },
  })
  const [loading, setLoading] = useState(false)

  const { apiRequest } = useApi()

  useEffect(() => {
    if (obraSocial) {
      setFormData({
        name: obraSocial.name,
        description: obraSocial.description || "",
        ub_value: obraSocial.ub_value || "",
        nbu_id: extractNbuId(obraSocial.nbu),
        billing_entity_id: obraSocial.billing_entity ? String(obraSocial.billing_entity.id) : "",
        charges_coseguro: obraSocial.charges_coseguro ?? false,
        charges_material_descartable: obraSocial.charges_material_descartable ?? false,
        charges_derivacion: obraSocial.charges_derivacion ?? false,
        requires_preauthorization: obraSocial.requires_preauthorization ?? false,
        chooses_billing_entity: obraSocial.chooses_billing_entity ?? false,
        a_reintegro: obraSocial.a_reintegro ?? false,
        descuento_desde_ub: obraSocial.descuento_desde_ub ?? "0.00",
        descuento_porcentaje_a_cobrar: obraSocial.descuento_porcentaje_a_cobrar ?? "100.00",
      })
      setValidation({
        name: { isValid: true, message: "Nombre válido" },
        description: { isValid: true, message: "" },
        ub_value: { isValid: true, message: "" },
      })
    }
  }, [obraSocial])

  const validateField = (name: keyof ValidationState, value: string) => {
    let isValid = false
    let message = ""

    switch (name) {
      case "name":
        isValid = value.trim().length >= 3
        message = isValid ? "Nombre válido" : "El nombre debe tener al menos 3 caracteres"
        break
      case "description":
        isValid = true
        message = ""
        break
      case "ub_value":
        if (value.trim() === "") {
          isValid = true
          message = ""
        } else {
          const numValue = Number.parseFloat(value)
          isValid = !isNaN(numValue) && numValue > 0
          message = isValid ? "Valor válido" : "Debe ser un número mayor a 0"
        }
        break
    }

    setValidation((prev) => ({
      ...prev,
      [name]: { isValid, message },
    }))
  }

  const handleStringChange = (name: keyof ValidationState, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    validateField(name, value)
  }

  const handleSwitchChange = (name: keyof FormData, value: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const isFormValid = () => {
    return Object.values(validation).every((field) => field.isValid)
  }

  const getChangedFields = () => {
    const changes: Record<string, unknown> = {}
    if (formData.name !== obraSocial.name) changes.name = formData.name
    if (formData.description !== (obraSocial.description || "")) changes.description = formData.description || undefined
    if (formData.ub_value !== (obraSocial.ub_value || "")) {
      changes.ub_value = formData.ub_value ? Number.parseFloat(formData.ub_value) : undefined
    }
    if (formData.charges_coseguro !== (obraSocial.charges_coseguro ?? false)) {
      changes.charges_coseguro = formData.charges_coseguro
    }
    if (formData.charges_material_descartable !== (obraSocial.charges_material_descartable ?? false)) {
      changes.charges_material_descartable = formData.charges_material_descartable
    }
    if (formData.charges_derivacion !== (obraSocial.charges_derivacion ?? false)) {
      changes.charges_derivacion = formData.charges_derivacion
    }
    if (formData.requires_preauthorization !== (obraSocial.requires_preauthorization ?? false)) {
      changes.requires_preauthorization = formData.requires_preauthorization
    }
    if (formData.chooses_billing_entity !== (obraSocial.chooses_billing_entity ?? false)) {
      changes.chooses_billing_entity = formData.chooses_billing_entity
    }
    if (formData.a_reintegro !== (obraSocial.a_reintegro ?? false)) {
      changes.a_reintegro = formData.a_reintegro
    }
    if (formData.descuento_desde_ub !== (obraSocial.descuento_desde_ub ?? "0.00")) {
      changes.descuento_desde_ub = formData.descuento_desde_ub || "0.00"
    }
    if (formData.descuento_porcentaje_a_cobrar !== (obraSocial.descuento_porcentaje_a_cobrar ?? "100.00")) {
      changes.descuento_porcentaje_a_cobrar = formData.descuento_porcentaje_a_cobrar || "100.00"
    }
    if (formData.nbu_id !== extractNbuId(obraSocial.nbu)) {
      changes.nbu = formData.nbu_id ? Number.parseInt(formData.nbu_id, 10) : null
    }
    const currentBillingEntityId = obraSocial.billing_entity ? String(obraSocial.billing_entity.id) : ""
    if (formData.billing_entity_id !== currentBillingEntityId) {
      changes.billing_entity_id = formData.billing_entity_id ? Number.parseInt(formData.billing_entity_id, 10) : null
    }
    return changes
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return

    const changes = getChangedFields()
    if (Object.keys(changes).length === 0) {
      toast.info("No hay cambios para guardar", { duration: TOAST_DURATION })
      return
    }

    try {
      setLoading(true)
      const response = await apiRequest(MEDICAL_ENDPOINTS.INSURANCE_DETAIL(obraSocial.id), {
        method: "PATCH",
        body: changes,
      })

      if (response.ok) {
        toast.success("Obra Social actualizada exitosamente", { duration: TOAST_DURATION })
        onSuccess()
      } else {
        const errorData = await response.json()
        console.error("Error updating obra social:", errorData)
        toast.error("Error al actualizar la obra social", {
          description: formatApiError(errorData, "Error al actualizar la obra social"),
          duration: TOAST_DURATION,
        })
      }
    } catch (error) {
      console.error("Error updating obra social:", error)
      toast.error("Error al actualizar la obra social", {
        description: getErrorMessage(error, "No se pudo completar la operación."),
        duration: TOAST_DURATION,
      })
    } finally {
      setLoading(false)
    }
  }

  const renderValidationIcon = (field: keyof ValidationState) => {
    const value = formData[field] as string
    if (!value) return null
    return validation[field].isValid ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <AlertCircle className="w-4 h-4 text-red-500" />
    )
  }

  const renderValidationMessage = (field: keyof ValidationState) => {
    const value = formData[field] as string
    if (!value || !validation[field].message) return null
    return (
      <p className={`text-xs mt-1 ${validation[field].isValid ? "text-green-600" : "text-red-600"}`}>
        {validation[field].message}
      </p>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeading icon={Building2} title="Editar obra social" description="Modificá los datos y los conceptos que cobra." />
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <div className="relative">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleStringChange("name", e.target.value)}
                  placeholder="Ingresa el nombre"
                  className={`pr-10 ${
                    formData.name
                      ? validation.name.isValid
                        ? "border-green-500 focus:border-green-500"
                        : "border-red-500 focus:border-red-500"
                      : ""
                  }`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">{renderValidationIcon("name")}</div>
              </div>
              {renderValidationMessage("name")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleStringChange("description", e.target.value)}
                placeholder="Ingresa una descripción (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ub_value">Valor UB</Label>
              <div className="relative">
                <Input
                  id="ub_value"
                  type="number"
                  step="0.01"
                  value={formData.ub_value}
                  onChange={(e) => handleStringChange("ub_value", e.target.value)}
                  placeholder="Ingresa el valor UB (opcional)"
                  className={`pr-10 ${
                    formData.ub_value && !validation.ub_value.isValid ? "border-red-500 focus:border-red-500" : ""
                  }`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  {renderValidationIcon("ub_value")}
                </div>
              </div>
              {renderValidationMessage("ub_value")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nbu_id">Nomenclador (NBU)</Label>
              <NbuSelect
                id="nbu_id"
                value={formData.nbu_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, nbu_id: value }))}
              />
              <p className="text-xs text-gray-500">
                Nomenclador que usa esta obra social para calcular la UB.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_entity_id">Entidad de facturación (por defecto)</Label>
              <BillingEntitySelect
                id="billing_entity_id"
                value={formData.billing_entity_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, billing_entity_id: value }))}
                disabled={formData.chooses_billing_entity}
              />
              <p className="text-xs text-gray-500">
                A qué entidad se presenta habitualmente esta obra social. El cambio rige solo hacia adelante. Para
                un protocolo puntual se puede facturar a la otra entidad desde Facturación, sin tocar esto.
              </p>

              <div className="mt-3 flex items-start justify-between gap-3 border-t border-gray-200 pt-3">
                <div>
                  <Label htmlFor="chooses_billing_entity" className="cursor-pointer">
                    Se elige en cada ingreso
                  </Label>
                  <p className="text-xs text-gray-500">
                    Factura por Centro o por Clínica según cómo se preautorizó al
                    paciente. Al cargar el protocolo hay que elegir por cuál va.
                  </p>
                </div>
                <Switch
                  id="chooses_billing_entity"
                  checked={formData.chooses_billing_entity}
                  onCheckedChange={(checked) => {
                    // No pueden convivir: si se elige por paciente, no hay una
                    // entidad fija. Dejar las dos cargadas haría que la vieja se
                    // use por lo bajo cada vez que alguien no eligiera.
                    setFormData((prev) => ({
                      ...prev,
                      chooses_billing_entity: checked,
                      billing_entity_id: checked ? "" : prev.billing_entity_id,
                    }))
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700">Conceptos que cobra</p>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="charges_coseguro" className="cursor-pointer">Coseguro</Label>
                  <p className="text-xs text-gray-500">Permite cargar coseguro al protocolo.</p>
                </div>
                <Switch
                  id="charges_coseguro"
                  checked={formData.charges_coseguro}
                  onCheckedChange={(checked) => handleSwitchChange("charges_coseguro", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="charges_material_descartable" className="cursor-pointer">Material descartable</Label>
                  <p className="text-xs text-gray-500">Suma el monto fijo por material descartable.</p>
                </div>
                <Switch
                  id="charges_material_descartable"
                  checked={formData.charges_material_descartable}
                  onCheckedChange={(checked) => handleSwitchChange("charges_material_descartable", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="charges_derivacion" className="cursor-pointer">Derivación</Label>
                  <p className="text-xs text-gray-500">Cobra derivación si hay análisis con esa marca.</p>
                </div>
                <Switch
                  id="charges_derivacion"
                  checked={formData.charges_derivacion}
                  onCheckedChange={(checked) => handleSwitchChange("charges_derivacion", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requires_preauthorization" className="cursor-pointer">Requiere preautorización</Label>
                  <p className="text-xs text-gray-500">Los análisis deben preautorizarse antes de procesar.</p>
                </div>
                <Switch
                  id="requires_preauthorization"
                  checked={formData.requires_preauthorization}
                  onCheckedChange={(checked) => handleSwitchChange("requires_preauthorization", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="a_reintegro" className="cursor-pointer">Es a reintegro</Label>
                  <p className="text-xs text-gray-500">
                    El paciente paga como particular y la obra social le reintegra
                    después. Se le cobra la cantidad de UB del nomenclador de esta
                    obra social, al precio por UB de Particular.
                  </p>
                </div>
                <Switch
                  id="a_reintegro"
                  checked={formData.a_reintegro}
                  onCheckedChange={(checked) => handleSwitchChange("a_reintegro", checked)}
                />
              </div>

              {/* DEL ANÁLISIS GRANDE NO SE COBRA EL 100%.
                  Una práctica de muchas UB no cuesta proporcionalmente más de
                  hacer. Se mide ANÁLISIS POR ANÁLISIS y no sobre la suma del
                  protocolo: lo que es grande es la práctica, no la lista. */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Descuento por análisis grande</p>
                  <p className="text-xs text-gray-500">
                    Del análisis que supera el tope se cobra el porcentaje, y no el
                    total. Se mide análisis por análisis, no sobre el protocolo.
                    Con el tope en 0 no se aplica nada.{" "}
                    <span className="font-medium">El que corre es el de Particular:</span>{" "}
                    todo lo que paga el paciente —incluido el análisis que una obra
                    social no autoriza— se cotiza con esa lista.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="descuento_desde_ub">Tope de UB por análisis</Label>
                    <Input
                      id="descuento_desde_ub"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.descuento_desde_ub}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, descuento_desde_ub: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="descuento_porcentaje_a_cobrar">Porcentaje a cobrar</Label>
                    <Input
                      id="descuento_porcentaje_a_cobrar"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.descuento_porcentaje_a_cobrar}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          descuento_porcentaje_a_cobrar: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#204983] hover:bg-[#1a3d6f]" disabled={!isFormValid() || loading}>
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
