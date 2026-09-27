"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, KeyRound, Laptop, Lock, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { USER_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { useToast } from "@/hooks/use-toast"
import { readApiError } from "@/lib/api-error"
import { formatUtcDateTime } from "@/lib/format-utils"
import type { User, UserTwoFactorStatus } from "@/types"
import { UserTwoFactorResetDialog } from "./user-two-factor-reset-dialog"

interface UserTwoFactorPanelProps {
  user: User
}

const NOMBRE_METODO: Record<string, string> = {
  totp: "app de autenticación",
  email: "correo",
}

const twoFactorQueryKey = (userId: number) => ["admin", "users", userId, "2fa"] as const

/**
 * Panel del segundo factor de un usuario, dentro de su tarjeta en "Usuarios y
 * permisos". Sólo lo monta `UserCard` cuando el que está mirando es
 * superusuario: para el resto la sección no existe (los endpoints de abajo
 * contestan 403 y, además, no es asunto suyo).
 */
export function UserTwoFactorPanel({ user }: UserTwoFactorPanelProps) {
  const { apiRequest } = useApi()
  const queryClient = useQueryClient()
  const { success, error: errorToast } = useToast()

  const [isSaving, setIsSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const queryKey = twoFactorQueryKey(user.id)
  const { data, isLoading, isError, error, refetch } = useApiQuery<UserTwoFactorStatus>({
    queryKey,
    url: USER_ENDPOINTS.USER_TWO_FACTOR(user.id),
    // Los dispositivos de confianza vencen solos y los códigos se consumen: una
    // foto de hace un rato desinforma más de lo que ayuda.
    staleTime: 30 * 1000,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey })
  }

  // El backend obliga a los superusuarios a tener segundo factor, así que su
  // interruptor va trabado en "sí": mostrar uno apagable sería mentirle al que
  // administra y el POST volvería 400.
  const isSuperuserRow = Boolean(user.is_superuser)

  const handleRequireChange = async (next: boolean) => {
    if (isSuperuserRow || isSaving) return

    setIsSaving(true)
    try {
      const response = await apiRequest(USER_ENDPOINTS.USER_TWO_FACTOR_REQUIRE(user.id), {
        method: "POST",
        body: { required: next },
      })

      if (!response.ok) {
        errorToast("No se pudo cambiar la exigencia", {
          // En un 403 el backend explica por qué (no sos superusuario, la cuenta
          // está protegida, etc.): ese mensaje sirve más que uno enlatado.
          description: await readApiError(response, "Intentá de nuevo en un momento."),
        })
        return
      }

      success(next ? "Segundo factor exigido" : "Segundo factor ya no es obligatorio", {
        description: next
          ? "Si todavía no se enroló, se le va a pedir el alta en el próximo inicio de sesión."
          : "Puede seguir usándolo, pero ya no está obligado.",
      })
      refresh()
    } catch {
      errorToast("No se pudo cambiar la exigencia", { description: "Revisá la conexión." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      const response = await apiRequest(USER_ENDPOINTS.USER_TWO_FACTOR_RESET(user.id), { method: "POST" })

      if (!response.ok) {
        errorToast("No se pudo resetear el segundo factor", {
          description: await readApiError(response, "Intentá de nuevo en un momento."),
        })
        return
      }

      success("Segundo factor reseteado", {
        description: `${user.username} va a poder entrar sólo con su contraseña hasta que se enrole de nuevo.`,
      })
      setResetOpen(false)
      refresh()
    } catch {
      errorToast("No se pudo resetear el segundo factor", { description: "Revisá la conexión." })
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Segundo factor
        </span>
        {data &&
          (data.enabled ? (
            <Badge className="bg-green-600 text-[10px] hover:bg-green-600">Configurado</Badge>
          ) : (
            <Badge variant="outline" className="border-gray-300 text-[10px] text-gray-600">
              Sin configurar
            </Badge>
          ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-7 w-full rounded" />
        </div>
      ) : isError ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            <p className="whitespace-pre-line">
              {error instanceof Error ? error.message : "No se pudo cargar el estado del segundo factor."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} className="bg-transparent">
            Reintentar
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`require-2fa-${user.id}`}
              className="text-sm text-gray-700"
            >
              Exigir el segundo factor
            </label>
            <Switch
              id={`require-2fa-${user.id}`}
              checked={isSuperuserRow ? true : data.required}
              disabled={isSuperuserRow || isSaving}
              onCheckedChange={(next) => void handleRequireChange(next)}
              // El trabado de superusuario va a opacidad plena: atenuado se
              // confundía con "a medio prender", y lo que tiene que quedar
              // claro es que está SÍ y no se puede tocar (lo explica el candado).
              className={`data-[state=checked]:bg-[#204983] ${isSuperuserRow ? "disabled:opacity-100" : ""}`}
              aria-label={`Exigir el segundo factor a ${user.username}`}
            />
          </div>

          {isSuperuserRow && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-500">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              Los superusuarios están obligados siempre por regla del backend: no se les puede quitar.
            </p>
          )}

          {data.enabled ? (
            <div className="space-y-1 text-xs text-gray-600">
              <p>
                Método: {(data.methods?.length ? data.methods : data.method ? [data.method] : [])
                  .map((m) => NOMBRE_METODO[m] ?? m)
                  .join(" y ") || "—"}
                {data.confirmed_at && (
                  <span className="text-gray-500"> · desde {formatUtcDateTime(data.confirmed_at)}</span>
                )}
              </p>
              <p className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-gray-400" />
                {data.recovery_codes_left} código{data.recovery_codes_left === 1 ? "" : "s"} de recuperación
                {data.recovery_codes_left <= 2 && (
                  <span className="text-amber-700">· le quedan pocos</span>
                )}
              </p>
              <p className="flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-gray-400" />
                {data.trusted_devices} equipo{data.trusted_devices === 1 ? "" : "s"} de confianza
                {data.trusted_devices > 0 ? " con la ventana abierta" : ""}
              </p>
              {data.last_2fa_at && <p className="text-gray-500">Último código: {formatUtcDateTime(data.last_2fa_at)}</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              Todavía no se enroló: entra sólo con su contraseña.
              {data.required && " Se le va a pedir el alta en el próximo inicio de sesión."}
            </p>
          )}

          {data.enabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetOpen(true)}
              className="w-full bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Desactivar y resetear
            </Button>
          )}
        </>
      ) : null}

      <UserTwoFactorResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={user}
        onConfirm={handleReset}
      />
    </div>
  )
}

export default UserTwoFactorPanel
