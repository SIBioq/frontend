"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Laptop, Mail, ShieldCheck, ShieldOff, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TwoFactorDisableDialog } from "@/components/profile/components/two-factor-disable-dialog"
import { TwoFactorSetupDialog } from "@/components/profile/components/two-factor-setup-dialog"
import { AUTH_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { useToast } from "@/hooks/use-toast"
import { readApiError } from "@/lib/api-error"
import { formatUtcDateTime, parseUtcDate } from "@/lib/format-utils"
import type { TrustedDevice, TwoFactorStatus } from "@/types"

const TWO_FACTOR_STATUS_KEY = ["auth", "2fa", "status"]

/** "vence en 6 h 12 min" es más útil que una fecha absoluta para una ventana de 8 horas. */
const formatRemaining = (expiresAt: string): string => {
  const parsed = parseUtcDate(expiresAt)
  if (!parsed) return "sin datos"

  const diffMs = parsed.getTime() - Date.now()
  if (diffMs <= 0) return "vencida"

  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `vence en ${minutes} min`
  return `vence en ${hours} h ${minutes} min`
}

function TrustedDeviceRow({
  device,
  onRevoke,
  isRevoking,
}: {
  device: TrustedDevice
  onRevoke: (device: TrustedDevice) => void
  isRevoking: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Laptop className="h-4 w-4 shrink-0 text-gray-500" />
          <p className="truncate text-sm font-medium text-gray-900">{device.label}</p>
          {device.is_current && (
            <Badge variant="secondary" className="shrink-0">
              Este equipo
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-600">
          Último código: {formatUtcDateTime(device.last_2fa_at)} · {formatRemaining(device.expires_at)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRevoking}
        onClick={() => onRevoke(device)}
        className="shrink-0 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        {isRevoking ? "Revocando..." : "Revocar"}
      </Button>
    </div>
  )
}

export function TwoFactorSection() {
  const { apiRequest } = useApi()
  const queryClient = useQueryClient()
  const { success, error: errorToast } = useToast()

  const [setupOpen, setSetupOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [revokingId, setRevokingId] = useState<string | number | null>(null)

  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
  } = useApiQuery<TwoFactorStatus>({
    queryKey: TWO_FACTOR_STATUS_KEY,
    url: AUTH_ENDPOINTS.TWO_FACTOR_STATUS,
    // Los dispositivos vencen solos: no queremos mostrar una lista de hace 5
    // minutos como si fuera el estado actual.
    staleTime: 30 * 1000,
  })

  const invalidateStatus = () => {
    void queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_KEY })
  }

  const activeMethods = status?.methods?.length
    ? status.methods
    : status?.enabled && status.method
      ? [status.method]
      : []

  const handleRevoke = async (device: TrustedDevice) => {
    setRevokingId(device.id)
    try {
      const response = await apiRequest(AUTH_ENDPOINTS.TWO_FACTOR_DEVICE_REVOKE(device.id), { method: "POST" })
      if (!response.ok) {
        errorToast("No se pudo revocar el equipo", {
          description: await readApiError(response, "Intentá de nuevo en un momento."),
        })
        return
      }
      success("Equipo revocado", {
        description: device.is_current
          ? "En este equipo se te va a pedir el código en el próximo inicio de sesión."
          : "En ese equipo se va a pedir el código en el próximo inicio de sesión.",
      })
      invalidateStatus()
    } catch {
      errorToast("No se pudo revocar el equipo", { description: "Revisá la conexión." })
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
          <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
          <span>Verificación en dos pasos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-800">No se pudo cargar el estado</p>
                <p className="mt-1 text-sm text-red-700">
                  {error instanceof Error ? error.message : "Intentá de nuevo en un momento."}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {status?.enabled ? (
                    <Badge className="bg-green-600 hover:bg-green-600">Activada</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600">
                      Desactivada
                    </Badge>
                  )}
                  {status?.enabled && status.confirmed_at && (
                    <span className="text-xs text-gray-500">desde {formatUtcDateTime(status.confirmed_at)}</span>
                  )}
                  {activeMethods.includes("totp") && <Badge variant="outline" className="text-xs"><Smartphone className="mr-1 h-3 w-3" />App autenticadora</Badge>}
                  {activeMethods.includes("email") && <Badge variant="outline" className="text-xs"><Mail className="mr-1 h-3 w-3" />Código por correo</Badge>}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {status?.enabled
                    ? `${activeMethods.length > 1 ? "Al iniciar sesión podés elegir entre la app y el correo" : activeMethods[0] === "email" ? "Al iniciar sesión se te pide el código enviado por correo" : "Al iniciar sesión en un equipo nuevo se te pide el código de la app"}. En un equipo de confianza no se vuelve a pedir hasta que venza la ventana de 8 horas.`
                    : "Sumá un código de 6 dígitos desde tu celular al iniciar sesión."}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
              {activeMethods.length < 2 && (
                <Button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="bg-[#204983] hover:bg-[#1a3d6f]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {status?.enabled ? "Agregar método" : "Activar"}
                </Button>
              )}
              {status?.enabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDisableOpen(true)}
                  className="shrink-0 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <ShieldOff className="h-4 w-4" />
                  Desactivar
                </Button>
              )}
              </div>
            </div>

            {status?.enabled && (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm text-gray-700">
                    Códigos de recuperación disponibles:{" "}
                    <strong>{status.recovery_codes_left}</strong>
                  </p>
                  {status.recovery_codes_left <= 2 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Te quedan pocos. Desactivá y volvé a activar la verificación para generar códigos nuevos.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Equipos de confianza</p>
                  {status.trusted_devices.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Ningún equipo tiene la ventana abierta: en el próximo inicio de sesión se va a pedir el código.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {status.trusted_devices.map((device) => (
                        <TrustedDeviceRow
                          key={String(device.id)}
                          device={device}
                          onRevoke={(target) => void handleRevoke(target)}
                          isRevoking={revokingId === device.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>

      <TwoFactorSetupDialog open={setupOpen} onOpenChange={setSetupOpen} onConfirmed={invalidateStatus} activeMethods={activeMethods} />
      <TwoFactorDisableDialog open={disableOpen} onOpenChange={setDisableOpen} onDisabled={invalidateStatus} />
    </Card>
  )
}

export default TwoFactorSection
