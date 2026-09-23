"use client"

import type React from "react"

import { useState } from "react"
import { AlertCircle, CheckCircle, User, Save, X, UserCog } from "lucide-react"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { Switch } from "../../ui/switch"
import { Textarea } from "../../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { useApi } from "../../../hooks/use-api"
import { toast } from "sonner"
import type { Patient } from "../../../types"
import { PATIENT_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { formatDniForDisplay, getDniValidationMessage, isValidDni, normalizeDni } from "@/lib/dni"

interface CreatePatientFormProps {
  initialDni: string
  initialSex?: "M" | "F" | ""
  onPatientCreated: (patient: Patient) => void
  onCancel: () => void
  defaultAnonymous?: boolean
}

type ValidationResult = { isValid: boolean; message: string }
type ValidatedField = "dni" | "first_name" | "last_name" | "birth_date" | "email"

export function CreatePatientForm({
  initialDni,
  initialSex = "",
  onPatientCreated,
  onCancel,
  defaultAnonymous = false,
}: CreatePatientFormProps) {
  const { apiRequest } = useApi()
  const [isAnonymous, setIsAnonymous] = useState(defaultAnonymous)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    dni: normalizeDni(initialDni),
    birth_date: "",
    sex: initialSex,
    phone_mobile: "",
    phone_landline: "",
    email: "",
    country: "Argentina",
    province: "Córdoba",
    city: "",
    address: "",
    observations: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({
    dni: Boolean(normalizeDni(initialDni)),
  })

  const validateField = (name: ValidatedField, value: string): ValidationResult => {
    if (name === "dni") {
      const message = getDniValidationMessage(value)
      return { isValid: isValidDni(value), message }
    }
    if (name === "first_name") {
      if (!value.trim()) return { isValid: false, message: "El nombre es obligatorio" }
      if (value.trim().length < 2) return { isValid: false, message: "Mínimo 2 caracteres" }
      return { isValid: true, message: "Nombre válido" }
    }
    if (name === "last_name") {
      if (!value.trim()) return { isValid: false, message: "El apellido es obligatorio" }
      if (value.trim().length < 2) return { isValid: false, message: "Mínimo 2 caracteres" }
      return { isValid: true, message: "Apellido válido" }
    }
    if (name === "birth_date") {
      return value ? { isValid: true, message: "Fecha válida" } : { isValid: false, message: "La fecha de nacimiento es obligatoria" }
    }
    if (name === "email") {
      if (!value.trim()) return { isValid: true, message: "" }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? { isValid: true, message: "Email válido" }
        : { isValid: false, message: "Formato de email inválido" }
    }
    return { isValid: true, message: "" }
  }

  const getFieldValidation = (name: ValidatedField) => validateField(name, String(formData[name] || ""))

  const getFieldStyle = (name: ValidatedField) => {
    if (!touched[name]) return ""
    return getFieldValidation(name).isValid ? "border-green-500 focus:ring-green-500" : "border-red-500 focus:ring-red-500"
  }

  const renderFieldMessage = (name: ValidatedField) => {
    if (!touched[name]) return null
    const field = getFieldValidation(name)
    if (!field.message) return null

    return (
      <div className={`flex items-center gap-1 text-xs mt-1 ${field.isValid ? "text-green-600" : "text-red-600"}`}>
        {field.isValid ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
        <span>{field.message}</span>
      </div>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    if (name === "dni") {
      const cleaned = normalizeDni(value)
      setFormData((prev) => ({
        ...prev,
        [name]: cleaned,
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreatePatient = async () => {
    if (isAnonymous) {
      const firstName = formData.first_name.trim()
      const lastName = formData.last_name.trim()
      const observations = formData.observations.trim()
      if (!firstName && !lastName) {
        setTouched((prev) => ({ ...prev, first_name: true, last_name: true }))
        toast.error("Formulario inválido", {
          description: "Ingresá al menos nombre o apellido.",
          duration: TOAST_DURATION,
        })
        return
      }
      if ((!firstName || !lastName) && !observations) {
        setTouched((prev) => ({ ...prev, observations: true }))
        toast.error("Falta observación", {
          description: "Si no tenés nombre y apellido, agregá una observación que identifique al paciente.",
          duration: TOAST_DURATION,
        })
        return
      }
    } else {
      const fieldsToValidate: ValidatedField[] = ["dni", "first_name", "last_name", "birth_date", "email"]
      setTouched((prev) => ({ ...prev, ...Object.fromEntries(fieldsToValidate.map((field) => [field, true])) }))
      const fieldsAreValid = fieldsToValidate.every((field) => getFieldValidation(field).isValid)

      if (!fieldsAreValid || !formData.sex) {
        toast.error("Formulario inválido", {
          description: !formData.sex ? "Elegí el sexo del paciente." : "Corregí los errores marcados antes de continuar.",
          duration: TOAST_DURATION,
        })
        return
      }
    }

    try {
      setIsCreating(true)

      const buildAnonymousPayload = () => {
        const result: Record<string, unknown> = {
          is_anonymous: true,
        }
        if (formData.first_name.trim()) result.first_name = formData.first_name.trim()
        const dniDigits = normalizeDni(formData.dni)
        if (dniDigits) result.dni = dniDigits
        if (formData.last_name.trim()) result.last_name = formData.last_name.trim()
        if (formData.birth_date) result.birth_date = formData.birth_date
        if (formData.sex) result.sex = formData.sex
        if (formData.phone_mobile.trim()) result.phone_mobile = formData.phone_mobile.trim()
        if (formData.phone_landline.trim()) result.alt_phone = formData.phone_landline.trim()
        if (formData.email.trim()) result.email = formData.email.trim()
        if (formData.country.trim()) result.country = formData.country.trim()
        if (formData.province.trim()) result.province = formData.province.trim()
        if (formData.city.trim()) result.city = formData.city.trim()
        if (formData.address.trim()) result.address = formData.address.trim()
        if (formData.observations.trim()) result.observations = formData.observations.trim()
        return result
      }

      const payload = isAnonymous
        ? buildAnonymousPayload()
        : {
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            dni: normalizeDni(formData.dni),
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
          }

      const response = await apiRequest(PATIENT_ENDPOINTS.PATIENTS, {
        method: "POST",
        body: payload,
      })

      if (response.ok) {
        const newPatient = await response.json()
        onPatientCreated(newPatient)
        toast.success(isAnonymous ? "Paciente anónimo creado" : "Paciente creado exitosamente", {
          duration: TOAST_DURATION,
        })
      } else {
        const errorData = await response.json()
        console.error("Patient creation error:", errorData)
        toast.error("Error al crear paciente", {
          description: formatApiError(errorData, "Ha ocurrido un error al crear el paciente."),
          duration: TOAST_DURATION,
        })
      }
    } catch (error) {
      console.error("Error creating patient:", error)
      toast.error("Error al crear el paciente", {
        description: getErrorMessage(error, "No se pudo completar la operación."),
        duration: TOAST_DURATION,
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#204983]">
          <User className="h-5 w-5 text-[#204983]" />
          Crear Nuevo Paciente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <UserCog className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <Label htmlFor="ingreso_is_anonymous" className="cursor-pointer text-sm font-semibold text-amber-900">
                Paciente anónimo
              </Label>
              <p className="text-xs text-amber-800">
                Para pacientes sin datos completos. Requiere al menos nombre o apellido. Si falta alguno, agregá una observación.
              </p>
            </div>
          </div>
          <Switch
            id="ingreso_is_anonymous"
            checked={isAnonymous}
            onCheckedChange={(checked) => setIsAnonymous(checked)}
          />
        </div>

        {isAnonymous ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm font-semibold">
                  Nombre <span className="text-gray-400 font-normal">(o apellido)</span>
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name_anon_ingreso" className="text-sm font-semibold">
                  Apellido <span className="text-gray-400 font-normal">(o nombre)</span>
                </Label>
                <Input
                  id="last_name_anon_ingreso"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Pérez"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Al menos uno (nombre o apellido). Si falta alguno, la observación abajo es obligatoria.
            </p>

            <div className="space-y-2">
              <Label htmlFor="dni_anon_ingreso">
                DNI <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="dni_anon_ingreso"
                name="dni"
                value={formatDniForDisplay(formData.dni)}
                onChange={handleInputChange}
                placeholder="12.345.678"
                maxLength={10}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth_date_anon_ingreso">
                  Fecha de nacimiento <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="birth_date_anon_ingreso"
                  name="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex_anon_ingreso">
                  Sexo <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Select value={formData.sex} onValueChange={(value) => handleSelectChange("sex", value)}>
                  <SelectTrigger id="sex_anon_ingreso">
                    <SelectValue placeholder="Seleccionar" />
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
                <Label htmlFor="phone_mobile_anon_ingreso">
                  Teléfono móvil <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="phone_mobile_anon_ingreso"
                  name="phone_mobile"
                  value={formData.phone_mobile}
                  onChange={handleInputChange}
                  placeholder="Teléfono móvil"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_landline_anon_ingreso">
                  Teléfono alternativo <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="phone_landline_anon_ingreso"
                  name="phone_landline"
                  value={formData.phone_landline}
                  onChange={handleInputChange}
                  placeholder="Teléfono alternativo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_anon_ingreso">
                Email <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="email_anon_ingreso"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="country_anon_ingreso">País</Label>
                <Input
                  id="country_anon_ingreso"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province_anon_ingreso">Provincia</Label>
                <Input
                  id="province_anon_ingreso"
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city_anon_ingreso">Ciudad</Label>
                <Input
                  id="city_anon_ingreso"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_anon_ingreso">
                Dirección <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="address_anon_ingreso"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Dirección completa"
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Juan"
                  className={getFieldStyle("first_name")}
                  autoFocus
                  required
                />
                {renderFieldMessage("first_name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Pérez"
                  className={getFieldStyle("last_name")}
                  required
                />
                {renderFieldMessage("last_name")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dni">DNI *</Label>
              <Input
                id="dni"
                name="dni"
                value={formatDniForDisplay(formData.dni)}
                onChange={handleInputChange}
                placeholder="12.345.678"
                maxLength={10}
                className={`font-mono text-lg ${getFieldStyle("dni")}`}
                required
              />
              {renderFieldMessage("dni")}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Fecha de nacimiento *</Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  className={getFieldStyle("birth_date")}
                  required
                />
                {renderFieldMessage("birth_date")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Sexo *</Label>
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
                className={getFieldStyle("email")}
              />
              {renderFieldMessage("email")}
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
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="observations">
            Observaciones{" "}
            {isAnonymous && (!formData.first_name.trim() || !formData.last_name.trim()) ? (
              <span className="text-red-600 font-normal">*</span>
            ) : (
              <span className="text-gray-400 font-normal">(opcional)</span>
            )}
          </Label>
          <Textarea
            id="observations"
            name="observations"
            value={formData.observations}
            onChange={handleInputChange}
            placeholder="Cama 5, internado UTI, hijo de paciente X, etc."
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleCreatePatient}
            disabled={isCreating}
            className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {isCreating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isCreating ? "Creando..." : isAnonymous ? "Crear Paciente Anónimo" : "Crear Paciente"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
