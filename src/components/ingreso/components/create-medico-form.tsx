"use client"

import type React from "react"

import { useState } from "react"
import { User, Save, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { useApi } from "../../../hooks/use-api"
import { toast } from "sonner"
import type { Medico } from "../../../types"
import { MEDICAL_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { useIrAlFormulario } from "@/hooks/use-ir-al-formulario"

interface CreateMedicoFormProps {
  onMedicoCreated: (medico: Medico) => void
  onCancel: () => void
}

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData)

export function CreateMedicoForm({ onMedicoCreated, onCancel }: CreateMedicoFormProps) {
  const { apiRequest } = useApi()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    license: "",
    phone: "",
    email: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const primerCampo = useIrAlFormulario()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCreateMedico = async () => {
    if (!formData.first_name || !formData.last_name || !formData.license) {
      toast.error("Completá los campos obligatorios")
      return
    }

    try {
      setIsCreating(true)
      console.log("Creating medico with data:", formData)

      const response = await apiRequest(MEDICAL_ENDPOINTS.DOCTORS, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const newMedico = await response.json()
        console.log("Medico created:", newMedico)
        onMedicoCreated(newMedico)
        toast.success("Médico creado exitosamente")
      } else {
        const errorData = await response.json()
        console.error("Medico creation error:", errorData)
        toast.error("Error al crear médico", {
          description: extractErrorMessage(errorData),
        })
      }
    } catch (error) {
      console.error("Error creating medico:", error)
      toast.error("No se pudo crear el médico", { description: getErrorMessage(error) })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#204983]">
          <User className="h-5 w-5 text-[#204983]" />
          Crear Nuevo Médico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">Nombre *</Label>
            <Input
              ref={primerCampo}
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Juan"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Apellido *</Label>
            <Input
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              placeholder="Pérez"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="license">Matrícula *</Label>
          <Input
            id="license"
            name="license"
            value={formData.license}
            onChange={handleInputChange}
            placeholder="12345"
            required
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button onClick={handleCreateMedico} disabled={isCreating} className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]">
            {isCreating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isCreating ? "Creando..." : "Crear Médico"}
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
