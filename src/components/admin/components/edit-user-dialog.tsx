"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import type { User, Role, Group } from "@/types"
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleChips } from "./role-chips"
import { useToast } from "@/hooks/use-toast"
import type { ApiRequestOptions } from "@/hooks/use-api"
import { USER_ENDPOINTS, AC_ENDPOINTS } from "@/config/api"
import { formatApiError } from "@/lib/api-error"
import { Camera, Clock, Pencil } from "lucide-react"

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData, "Error desconocido")

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  roles: Role[]
  setUsers: React.Dispatch<React.SetStateAction<User[]>>
  apiRequest: (url: string, options?: ApiRequestOptions) => Promise<Response>
  refreshData: () => Promise<void>
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  roles,
  setUsers,
  apiRequest,
  refreshData,
}: EditUserDialogProps) {
  const { success, error: showError } = useToast()
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    inactivity_logout_minutes: "30",
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && user) {
      const userGroups = user.groups || user.roles || []
      setUserData({
        username: user.username,
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        inactivity_logout_minutes: String(user.inactivity_logout_minutes ?? 30),
      })
      setPhoto(null)
      setSelectedRoles(userGroups.map((group: Group) => group.id))
    } else if (!open) {
      setUserData({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        inactivity_logout_minutes: "30",
      })
      setPhoto(null)
      setSelectedRoles([])
      setIsSubmitting(false)
    }
  }, [open, user])

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(photo)
    setPhotoPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [photo])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setUserData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }, [])

  const handleToggleRole = useCallback((roleId: number) => {
    setSelectedRoles((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]))
  }, [])

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoto(e.target.files?.[0] ?? null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSubmitting(true)

    try {
      const inactivityMinutes = Number(userData.inactivity_logout_minutes)
      if (!Number.isInteger(inactivityMinutes) || inactivityMinutes < 1) {
        showError("Tiempo de inactividad inválido", {
          description: "Ingresá un valor de al menos 1 minuto.",
        })
        setIsSubmitting(false)
        return
      }

      const formData = new FormData()
      formData.append("username", userData.username)
      formData.append("email", userData.email)
      formData.append("first_name", userData.first_name)
      formData.append("last_name", userData.last_name)
      formData.append("inactivity_logout_minutes", String(inactivityMinutes))
      if (photo) {
        formData.append("photo", photo)
      }

      const response = await apiRequest(USER_ENDPOINTS.USER_DETAIL(user.id), {
        method: "PATCH",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }))
        showError("Error al actualizar usuario", {
          description: extractErrorMessage(errorData),
        })
        setIsSubmitting(false)
        return
      }

      const updatedUser = await response.json()

      const currentRoles = (user.groups || user.roles || []).map((r: Group) => r.id)
      const rolesChanged =
        selectedRoles.length !== currentRoles.length || selectedRoles.some((id) => !currentRoles.includes(id))

      if (rolesChanged) {
        const roleResponse = await apiRequest(AC_ENDPOINTS.ROLE_ASSIGN, {
          method: "POST",
          body: {
            user_id: user.id,
            role_ids: selectedRoles,
          },
        })

        if (!roleResponse.ok) {
          showError("Roles no actualizados", {
            description: "El usuario fue actualizado pero los roles no pudieron ser modificados debido a permisos.",
          })
        }
      }

      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...updatedUser, groups: selectedRoles } : u)))
      await refreshData()
      success("Usuario actualizado", {
        description: "Los datos del usuario han sido actualizados exitosamente.",
      })
      onOpenChange(false)
    } catch (err) {
      console.error("Error al actualizar usuario:", err)
      showError("Error", {
        description: "Ha ocurrido un error de red o inesperado.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90dvh] overflow-y-auto">
        <DialogHeading icon={Pencil} title="Editar usuario" description={user ? `@${user.username}` : undefined} />
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario *</Label>
              <Input
                id="username"
                name="username"
                value={userData.username}
                onChange={handleChange}
                required
                placeholder="usuario123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={userData.email}
                onChange={handleChange}
                required
                placeholder="usuario@ejemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre</Label>
              <Input
                id="first_name"
                name="first_name"
                value={userData.first_name}
                onChange={handleChange}
                placeholder="Juan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                name="last_name"
                value={userData.last_name}
                onChange={handleChange}
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inactivity_logout_minutes">Tiempo de inactividad *</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="inactivity_logout_minutes"
                name="inactivity_logout_minutes"
                type="number"
                min={1}
                step={1}
                value={userData.inactivity_logout_minutes}
                onChange={handleChange}
                required
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">Minutos sin actividad antes de cerrar sesión.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Foto de perfil</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Nueva foto seleccionada"
                    className="h-full w-full object-cover"
                  />
                ) : user.photo ? (
                  <img src={user.photo} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Input id="photo" name="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
                <p className="text-xs text-gray-500">
                  {photo ? `Archivo seleccionado: ${photo.name}` : "Dejá vacío para conservar la foto actual."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between">
              <Label>Roles</Label>
              <span className="text-xs text-gray-400">{selectedRoles.length} seleccionado{selectedRoles.length === 1 ? "" : "s"}</span>
            </div>
            <RoleChips roles={Array.isArray(roles) ? roles : []} selectedIds={selectedRoles} onToggle={handleToggleRole} />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-transparent"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="w-full bg-[#204983] hover:bg-[#1a3d6f] sm:w-auto">
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
