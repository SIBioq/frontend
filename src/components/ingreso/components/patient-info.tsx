"use client"

import { User, Calendar, Phone, Mail, MapPin, Edit, UserCog, StickyNote } from "lucide-react"
import { Button } from "../../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Badge } from "../../ui/badge"
import type { Patient } from "../../../types"
import { formatDniForDisplay } from "@/lib/dni"

interface PatientInfoProps {
  patient: Patient
  onEdit: () => void
}

const formatDate = (dateString: string): string => {
  if (!dateString) return "No disponible"

  try {
    // Si la fecha viene en formato dd/mm/yyyy o yyyy/mm/dd
    if (dateString.includes("/")) {
      const parts = dateString.split("/")
      // Si el primer elemento tiene 4 dígitos, es yyyy/mm/dd
      if (parts[0].length === 4) {
        const [year, month, day] = parts
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
      } else {
        // Si no, ya está en dd/mm/yyyy
        return dateString
      }
    }

    // Si viene en formato ISO o yyyy-mm-dd, usar parsing directo para evitar problemas de zona horaria
    if (dateString.includes("-")) {
      const [year, month, day] = dateString.split("-")
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
    }

    return dateString
  } catch {
    return "Fecha inválida"
  }
}

const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0

  try {
    let year, month, day

    if (birthDate.includes("/")) {
      const parts = birthDate.split("/")
      if (parts[0].length === 4) {
        // yyyy/mm/dd
        ;[year, month, day] = parts.map(Number)
      } else {
        // dd/mm/yyyy
        ;[day, month, year] = parts.map(Number)
      }
    } else if (birthDate.includes("-")) {
      // yyyy-mm-dd
      ;[year, month, day] = birthDate.split("-").map(Number)
    } else {
      return 0
    }

    // Crear fecha sin problemas de zona horaria
    const birthDateObj = new Date(year, month - 1, day) // month - 1 porque los meses en JS van de 0-11
    const today = new Date()

    let age = today.getFullYear() - birthDateObj.getFullYear()
    const monthDiff = today.getMonth() - birthDateObj.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--
    }

    return age
  } catch {
    return 0
  }
}

export function PatientInfo({ patient, onEdit }: PatientInfoProps) {
  const isAnonymous = Boolean(patient.is_anonymous)
  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[#204983]">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <span className="text-base sm:text-lg">Información del Paciente</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white bg-transparent text-xs sm:text-sm w-full sm:w-auto"
          >
            <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Editar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="text-center pb-3 sm:pb-4 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            {patient.first_name} {patient.last_name || ""}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {isAnonymous ? (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-1">
                <UserCog className="h-3 w-3 mr-1" /> Paciente anónimo
              </Badge>
            ) : (
              <Badge variant="outline" className="font-mono text-sm sm:text-lg px-2 sm:px-3 py-1">
                DNI: {formatDniForDisplay(patient.dni)}
              </Badge>
            )}
          </div>
          {isAnonymous && (
            <p className="text-xs text-amber-700 mt-2">
              La obra social es opcional. Si no la elegís, se asigna Particular automáticamente.
            </p>
          )}
          {patient.observations && (
            <div className="mt-3 flex items-start justify-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-left text-xs text-slate-700">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              <span>{patient.observations}</span>
            </div>
          )}
        </div>

        {!isAnonymous && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Fecha de nacimiento</p>
                  <p className="text-gray-600">{formatDate(patient.birth_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Edad</p>
                  <p className="text-gray-600">{calculateAge(patient.birth_date)} años</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Sexo</p>
                  <p className="text-gray-600">{patient.sex === "M" ? "Masculino" : "Femenino"}</p>
                </div>
              </div>
            </div>

          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 sm:space-y-3">
            <div className="border-b border-amber-200 pb-2">
              <p className="text-xs font-semibold text-amber-900">Confirmá los datos de contacto</p>
              <p className="mt-1 text-[11px] text-amber-800">Preguntale al paciente si son correctos antes de continuar.</p>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Phone className="h-3 w-3 text-amber-700 sm:h-4 sm:w-4" />
              <div>
                <p className="font-medium">Teléfono móvil</p>
                <p className="break-all text-gray-600">{patient.phone_mobile || "Sin cargar"}</p>
              </div>
            </div>

            {patient.alt_phone && (
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Teléfono alternativo</p>
                  <p className="text-gray-600 break-all">{patient.alt_phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Mail className="h-3 w-3 text-amber-700 sm:h-4 sm:w-4" />
              <div>
                <p className="font-medium">Email</p>
                <p className="break-all text-gray-600">{patient.email || "Sin cargar"}</p>
              </div>
            </div>

          </div>
        </div>
        )}

        {!isAnonymous && (patient.address || patient.city || patient.province || patient.country) && (
          <div className="pt-3 sm:pt-4 border-t">
            <div className="flex items-start gap-2 text-xs sm:text-sm">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Dirección</p>
                <div className="text-gray-600">
                  {patient.address && <p className="break-words">{patient.address}</p>}
                  <p className="break-words">
                    {[patient.city, patient.province, patient.country].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
