"use client"

import type React from "react"

import { useState } from "react"
import { Building, Save, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Switch } from "../../ui/switch"
import { Textarea } from "../../ui/textarea"
import { useApi } from "../../../hooks/use-api"
import { toast } from "sonner"
import type { Insurance } from "../../../types"
import { MEDICAL_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { NbuSelect } from "@/components/configuration/components/nbu-select"
import { BillingEntitySelect } from "@/components/configuration/components/billing-entity-select"
import { useIrAlFormulario } from "@/hooks/use-ir-al-formulario"

interface CreateObraSocialFormProps {
  onObraSocialCreated: (obraSocial: Insurance) => void
  onCancel: () => void
}

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData)

export function CreateObraSocialForm({ onObraSocialCreated, onCancel }: CreateObraSocialFormProps) {
  const { apiRequest } = useApi()
  const [formData, setFormData] = useState({
    name: "",
    ub_value: "",
    nbu_id: "",
    billing_entity_id: "",
    description: "",
    charges_coseguro: false,
    charges_material_descartable: false,
    charges_derivacion: false,
    requires_preauthorization: false,
  })
  const [isCreating, setIsCreating] = useState(false)
  const primerCampo = useIrAlFormulario()

  // El NBU ya NO se pre-selecciona por defecto: lo elige el usuario o queda vacío.

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCreateObraSocial = async () => {
    if (!formData.name) {
      toast.error("Completá el nombre de la obra social")
      return
    }

    if (!formData.ub_value || Number.parseFloat(formData.ub_value) <= 0) {
      toast.error("Ingresá un valor de UB válido")
      return
    }

    try {
      setIsCreating(true)

      const dataToSend = {
        name: formData.name,
        ub_value: formData.ub_value,
        ...(formData.nbu_id && { nbu: Number.parseInt(formData.nbu_id, 10) }),
        ...(formData.billing_entity_id && { billing_entity_id: Number.parseInt(formData.billing_entity_id, 10) }),
        charges_coseguro: formData.charges_coseguro,
        charges_material_descartable: formData.charges_material_descartable,
        charges_derivacion: formData.charges_derivacion,
        requires_preauthorization: formData.requires_preauthorization,
        ...(formData.description && { description: formData.description }),
      }

      console.log("Creating obra social with data:", dataToSend)

      const response = await apiRequest(MEDICAL_ENDPOINTS.INSURANCES, {
        method: "POST",
        body: dataToSend,
      })

      if (response.ok) {
        const newObraSocial = await response.json()
        console.log("Obra social created:", newObraSocial)
        onObraSocialCreated(newObraSocial)
        toast.success("Obra social creada exitosamente")
      } else {
        const errorData = await response.json()
        console.error("Obra social creation error:", errorData)
        toast.error("Error al crear obra social", {
          description: extractErrorMessage(errorData),
        })
      }
    } catch (error) {
      console.error("Error creating obra social:", error)
      toast.error("No se pudo crear la obra social", { description: getErrorMessage(error) })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#204983]">
          <Building className="h-5 w-5 text-[#204983]" />
          Crear Nueva Obra Social
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            ref={primerCampo}
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Nombre de la obra social"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ub_value">Valor UB *</Label>
          <Input
            id="ub_value"
            name="ub_value"
            type="number"
            step="0.01"
            min="0"
            value={formData.ub_value}
            onChange={handleInputChange}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick_nbu_id">Nomenclador (NBU)</Label>
          <NbuSelect
            id="quick_nbu_id"
            value={formData.nbu_id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, nbu_id: value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick_billing_entity_id">Entidad a facturar</Label>
          <BillingEntitySelect
            id="quick_billing_entity_id"
            value={formData.billing_entity_id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, billing_entity_id: value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Descripción de la obra social..."
            rows={3}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-sm font-medium text-slate-700">Cobros y requisitos</p>
          {[
            ["charges_coseguro", "Coseguro"],
            ["charges_material_descartable", "Material descartable"],
            ["charges_derivacion", "Derivación"],
            ["requires_preauthorization", "Requiere preautorización"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`quick-${key}`} className="cursor-pointer text-sm">
                {label}
              </Label>
              <Switch
                id={`quick-${key}`}
                checked={Boolean(formData[key as keyof typeof formData])}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, [key]: checked }))}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button
            onClick={handleCreateObraSocial}
            disabled={isCreating}
            className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {isCreating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isCreating ? "Creando..." : "Crear Obra Social"}
          </Button>
          <Button variant="outline" onClick={onCancel} className="sm:w-auto bg-transparent">
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
