"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { User, Save, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { Textarea } from "../../ui/textarea"
import { useApi } from "../../../hooks/use-api"
import { toast } from "sonner"
import type { Patient } from "../../../types"
import { PATIENT_ENDPOINTS } from "../../../config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"

interface EditPatientDialogProps {
  isOpen: boolean
  onClose: () => void
  patient: Patient | null
  onPatientUpdated: (patient: Patient) => void
}

export function EditPatientDialog({ isOpen, onClose, patient, onPatientUpdated }: EditPatientDialogProps) {
  const { apiRequest } = useApi()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    dni: "",
    birth_date: "",
    sex: "",
    phone_mobile: "",
    phone_landline: "",
    email: "",
    country: "",
    province: "",
    city: "",
    address: "",
    observations: "",
  })
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (patient) {
      setFormData({
        first_name: patient.first_name || "",
        last_name: patient.last_name || "",
        dni: patient.dni || "",
        birth_date: patient.birth_date ? patient.birth_date.split("T")[0] : "",
        sex: patient.sex || "",
        phone_mobile: patient.phone_mobile || "",
        phone_landline: patient.alt_phone || "",
        email: patient.email || "",
        country: patient.country || "",
        province: patient.province || "",
        city: patient.city || "",
        address: patient.address || "",
        observations: patient.observations || "",
      })
    }
  }, [patient])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === "dni") {
      const cleaned = value.replace(/\D/g, "").slice(0, 8)
      setFormData((prev) => ({ ...prev, [name]: cleaned }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleUpdatePatient = async () => {
    if (!patient) return

    const isAnonymous = Boolean(patient.is_anonymous)
    const dniDigits = formData.dni.replace(/\D/g, "")

    if (!formData.first_name.trim()) {
      toast.error(isAnonymous ? "Completá el identificador" : "Completá el nombre")
      return
    }

    if (!isAnonymous && (!formData.last_name || !dniDigits || !formData.birth_date || !formData.sex)) {
      toast.error("Completá los campos obligatorios")
      return
    }

    try {
      setIsUpdating(true)
      console.log("Updating patient with data:", formData)

      const response = await apiRequest(PATIENT_ENDPOINTS.PATIENT_DETAIL(patient.id), {
        method: "PATCH",
        body: {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          dni: formData.dni.replace(/\D/g, ""),
          birth_date: formData.birth_date,
          sex: formData.sex,
          phone_mobile: formData.phone_mobile.trim(),
          alt_phone: formData.phone_landline.trim(),
          email: formData.email.trim(),
          country: formData.country.trim(),
          province: formData.province.trim(),
          city: formData.city.trim(),
          address: formData.address.trim(),
          observations: formData.observations.trim(),
        },
      })

      if (response.ok) {
        const updatedPatient = await response.json()
        console.log("Patient updated:", updatedPatient)
        onPatientUpdated(updatedPatient)
        toast.success("Paciente actualizado exitosamente")
        onClose()
      } else {
        const errorData = await response.json()
        console.error("Patient update error:", errorData)
        toast.error("Error al actualizar paciente", {
          description: formatApiError(errorData, "Ha ocurrido un error al actualizar el paciente."),
        })
      }
    } catch (error) {
      console.error("Error updating patient:", error)
      toast.error("Error al actualizar el paciente", {
        description: getErrorMessage(error, "No se pudo completar la operación."),
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#204983]">
            <User className="h-5 w-5" />
            Editar Paciente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido {patient?.is_anonymous ? "" : "*"}</Label>
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
            <Label htmlFor="dni">DNI {patient?.is_anonymous ? "" : "*"}</Label>
            <Input
              id="dni"
              name="dni"
              value={formData.dni}
              onChange={handleInputChange}
              placeholder="12345678"
              maxLength={8}
              className="font-mono text-lg"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Fecha de nacimiento {patient?.is_anonymous ? "" : "*"}</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sexo {patient?.is_anonymous ? "" : "*"}</Label>
              <Select value={formData.sex} onValueChange={(value) => handleSelectChange("sex", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Teléfono móvil</Label>
              <Input
                id="phone_mobile"
                name="phone_mobile"
                value={formData.phone_mobile}
                onChange={handleInputChange}
                placeholder="Teléfono móvil"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_landline">Teléfono alternativo</Label>
              <Input
                id="phone_landline"
                name="phone_landline"
                value={formData.phone_landline}
                onChange={handleInputChange}
                placeholder="Teléfono alternativo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="País"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                name="province"
                value={formData.province}
                onChange={handleInputChange}
                placeholder="Provincia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleInputChange} placeholder="Ciudad" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Dirección completa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones</Label>
            <Textarea
              id="observations"
              name="observations"
              value={formData.observations}
              onChange={handleInputChange}
              placeholder="Notas internas, cama, institución, aclaraciones de contacto"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleUpdatePatient}
              disabled={isUpdating}
              className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isUpdating ? "Actualizando..." : "Actualizar Paciente"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
