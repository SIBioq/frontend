"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { User, Permission } from "@/types"
import { AC_ENDPOINTS } from "@/config/api"
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { ApiRequestOptions } from "@/hooks/use-api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { Shield, ShieldX } from "lucide-react"

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData, "Error desconocido")

interface TempPermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  setUsers: React.Dispatch<React.SetStateAction<User[]>>
  apiRequest: (url: string, options?: ApiRequestOptions) => Promise<Response>
  permissions?: Permission[]
  mode?: "assign" | "revoke"
  refreshData?: () => Promise<void>
}

interface TempPermissionItem {
  id: number
  permission_details: {
    id: number
    name: string
    codename: string
  }
  expires_at: string
  is_expired: boolean
}

export function TempPermissionDialog({
  open,
  onOpenChange,
  user,
  apiRequest,
  mode = "assign",
  refreshData,
}: TempPermissionDialogProps) {
  const { success, error: showError } = useToast()

  const [missingPerms, setMissingPerms] = useState<Permission[]>([])
  const [activeTempPerms, setActiveTempPerms] = useState<TempPermissionItem[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)

  const [permissionId, setPermissionId] = useState<string>("")
  const [selectedTempPermId, setSelectedTempPermId] = useState<string>("")
  const [expiresAt, setExpiresAt] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !user) return

    let cancelled = false

    async function fetchData() {
      setLoadingPerms(true)
      try {
        if (!user) return

        if (mode === "assign") {
          const res = await apiRequest(`${AC_ENDPOINTS.PERMISSIONS}?limit=100`)
          if (!cancelled && res.ok) {
            const data = await res.json()
            const allPermissions = data.results || []

            const userPermissionIds = (user.permissions || []).filter((p) => !p.temporary).map((p) => p.id)
            const missing = allPermissions.filter((p: Permission) => !userPermissionIds.includes(p.id))

            setMissingPerms(missing)
            if (missing.length > 0) {
              setPermissionId(missing[0].id.toString())
            } else {
              setPermissionId("")
            }
          }
        } else {
          const res = await apiRequest(`${AC_ENDPOINTS.TEMP_PERMISSIONS}?user=${user.id}`)
          if (!cancelled && res.ok) {
            const data = await res.json()
            const tempPerms = data.results || []
            const active = tempPerms.filter((tp: TempPermissionItem) => !tp.is_expired)
            setActiveTempPerms(active)
            if (active.length > 0) {
              setSelectedTempPermId(active[0].id.toString())
            } else {
              setSelectedTempPermId("")
            }
          }
        }
      } catch (err) {
        console.error("Error cargando permisos:", err)
        if (!cancelled) {
          setMissingPerms([])
          setActiveTempPerms([])
        }
      } finally {
        if (!cancelled) setLoadingPerms(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
      setMissingPerms([])
      setActiveTempPerms([])
      setPermissionId("")
      setSelectedTempPermId("")
      setExpiresAt("")
      setReason("")
      setLoadingPerms(false)
    }
  }, [open, user, apiRequest, mode])

  useEffect(() => {
    if (open && mode === "assign" && !expiresAt) {
      const now = new Date()
      now.setHours(now.getHours() + 1)
      setExpiresAt(now.toISOString().slice(0, 16))
    }
  }, [open, mode, expiresAt])

  const handleAssign = async () => {
    if (!user || !permissionId || !expiresAt || !reason) {
      showError("Por favor completa todos los campos")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiRequest(AC_ENDPOINTS.TEMP_PERMISSIONS, {
        method: "POST",
        body: {
          user_id: user.id,
          permission_id: Number(permissionId),
          expires_at: new Date(expiresAt).toISOString(),
          reason: reason,
        },
      })

      if (res.ok) {
        success("Permiso temporal asignado correctamente")
        await refreshData?.()
        onOpenChange(false)
      } else {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        showError("No se pudo asignar el permiso", { description: extractErrorMessage(err) })
      }
    } catch (err) {
      console.error("Error asignando permiso temporal:", err)
      showError("No se pudo asignar el permiso", { description: getErrorMessage(err) })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async () => {
    if (!selectedTempPermId) {
      showError("Elegí un permiso temporal")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiRequest(AC_ENDPOINTS.TEMP_PERMISSION_REVOKE(Number(selectedTempPermId)), {
        method: "POST",
      })

      if (res.ok) {
        success("Permiso temporal revocado correctamente")
        await refreshData?.()
        onOpenChange(false)
      } else {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        showError("No se pudo revocar el permiso", { description: extractErrorMessage(err) })
      }
    } catch (err) {
      console.error("Error revocando permiso temporal:", err)
      showError("No se pudo revocar el permiso", { description: getErrorMessage(err) })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px]">
        <DialogHeading
          icon={mode === "assign" ? Shield : ShieldX}
          tone={mode === "assign" ? "brand" : "danger"}
          title={mode === "assign" ? "Asignar permiso temporal" : "Revocar permiso temporal"}
        />
        <div className="space-y-4 py-4">
          {loadingPerms ? (
            <p className="text-center text-sm sm:text-base">Cargando permisos…</p>
          ) : mode === "assign" ? (
            missingPerms.length === 0 ? (
              <p className="text-center text-gray-500 text-sm sm:text-base">
                El usuario ya tiene todos los permisos disponibles.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="permission" className="text-sm sm:text-base">
                    Permiso *
                  </Label>
                  <Select value={permissionId} onValueChange={setPermissionId}>
                    <SelectTrigger id="permission" className="w-full">
                      <SelectValue placeholder="Selecciona un permiso" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      {missingPerms.map((perm) => (
                        <SelectItem key={perm.id} value={perm.id.toString()}>
                          {perm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires" className="text-sm sm:text-base">
                    Fecha de expiración *
                  </Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-sm sm:text-base">
                    Razón *
                  </Label>
                  <Input
                    id="reason"
                    type="text"
                    placeholder="Motivo de asignación"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </>
            )
          ) : activeTempPerms.length === 0 ? (
            <p className="text-center text-gray-500 text-sm sm:text-base">
              El usuario no tiene permisos temporales activos.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="temp-perm" className="text-sm sm:text-base">
                Permiso Temporal
              </Label>
              <Select value={selectedTempPermId} onValueChange={setSelectedTempPermId}>
                <SelectTrigger id="temp-perm" className="w-full">
                  <SelectValue placeholder="Selecciona un permiso" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {activeTempPerms.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id.toString()}>
                      {tp.permission_details.name} - Expira: {new Date(tp.expires_at).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting} className="w-full sm:w-auto bg-transparent">
              Cancelar
            </Button>
          </DialogClose>
          {mode === "assign" ? (
            <Button
              onClick={handleAssign}
              disabled={isSubmitting || missingPerms.length === 0}
              className="w-full bg-[#204983] hover:bg-[#1a3d6f] sm:w-auto"
            >
              {isSubmitting ? "Asignando…" : "Asignar"}
            </Button>
          ) : (
            <Button
              onClick={handleRevoke}
              disabled={isSubmitting || activeTempPerms.length === 0}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Revocando…" : "Revocar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
