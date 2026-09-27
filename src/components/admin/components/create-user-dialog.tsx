"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import type { User, Role } from "@/types"
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
import { Clock, Eye, EyeOff, UserPlus, Camera } from "lucide-react"

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Role[]
  setUsers: React.Dispatch<React.SetStateAction<User[]>>
  apiRequest: (url: string, options?: ApiRequestOptions) => Promise<Response>
  refreshData: () => Promise<void>
}

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData, "Error desconocido")

export function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  setUsers,
  apiRequest,
  refreshData,
}: CreateUserDialogProps) {
  const { success, error: showError } = useToast()
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    confirmPassword: "",
    inactivity_logout_minutes: "5",
    photo: null as File | null,
    selectedRoles: [] as number[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const savedData = localStorage.getItem("create-user-form")
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          setUserData((prev) => ({ ...prev, ...parsed, password: "", confirmPassword: "", photo: null }))
        } catch (e) {
          console.error("Error parsing saved user data:", e)
        }
      }
    } else {
      setUserData({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        confirmPassword: "",
        inactivity_logout_minutes: "5",
        photo: null,
        selectedRoles: [],
      })
      setIsSubmitting(false)
      setShowPassword(false)
      setShowConfirmPassword(false)
      setPasswordError("")
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      localStorage.removeItem("create-user-form")
    }
  }, [open])

  const saveUserData = useCallback((data: typeof userData) => {
    const dataToSave = {
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      inactivity_logout_minutes: data.inactivity_logout_minutes,
      selectedRoles: data.selectedRoles,
    }
    localStorage.setItem("create-user-form", JSON.stringify(dataToSave))
  }, [])

  useEffect(() => {
    if (userData.username || userData.email || userData.first_name || userData.last_name) {
      saveUserData(userData)
    }
  }, [userData, saveUserData])

  useEffect(() => {
    if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
      setPasswordError("Las contraseñas no coinciden")
    } else {
      setPasswordError("")
    }
  }, [userData.password, userData.confirmPassword])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setUserData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }, [])

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUserData((prev) => ({ ...prev, photo: file }))
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
    }
  }, [])

  const handleToggleRole = useCallback((roleId: number) => {
    setUserData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (userData.password !== userData.confirmPassword) {
      showError("Error de validación", {
        description: "Las contraseñas no coinciden.",
      })
      return
    }

    const inactivityMinutes = Number(userData.inactivity_logout_minutes)
    if (!Number.isInteger(inactivityMinutes) || inactivityMinutes < 1) {
      showError("Tiempo de inactividad inválido", {
        description: "Ingresá un valor de al menos 1 minuto.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("username", userData.username)
      formData.append("password", userData.password)
      formData.append("email", userData.email)
      formData.append("first_name", userData.first_name)
      formData.append("last_name", userData.last_name)
      formData.append("inactivity_logout_minutes", String(inactivityMinutes))
      if (userData.photo) {
        formData.append("photo", userData.photo)
      }

      const createResponse = await apiRequest(USER_ENDPOINTS.USERS, {
        method: "POST",
        body: formData,
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ detail: "Error desconocido" }))
        showError("Error al crear usuario", {
          description: extractErrorMessage(errorData),
        })
        setIsSubmitting(false)
        return
      }

      const newUser = await createResponse.json()

      let roleAssignmentSuccess = true
      let roleAssignmentMessage = ""

      if (userData.selectedRoles.length > 0) {
        try {
          const roleResponse = await apiRequest(AC_ENDPOINTS.ROLE_ASSIGN, {
            method: "POST",
            body: {
              user_id: newUser.id,
              role_ids: userData.selectedRoles,
            },
          })

          if (roleResponse.ok) {
            roleAssignmentMessage = "Usuario creado y roles asignados exitosamente."
          } else if (roleResponse.status === 401 || roleResponse.status === 403) {
            roleAssignmentSuccess = false
            roleAssignmentMessage = "Usuario creado exitosamente, pero no tiene permisos para asignar roles."
          } else {
            roleAssignmentSuccess = false
            roleAssignmentMessage = "Usuario creado exitosamente, pero hubo un error al asignar los roles."
          }
        } catch (roleError) {
          console.error("Error assigning roles:", roleError)
          roleAssignmentSuccess = false
          roleAssignmentMessage = "Usuario creado exitosamente, pero hubo un error al asignar los roles."
        }
      } else {
        roleAssignmentMessage = "Usuario creado exitosamente."
      }

      setUsers((prev) => [newUser, ...prev])
      await refreshData()

      if (roleAssignmentSuccess || userData.selectedRoles.length === 0) {
        success("Usuario creado", {
          description: roleAssignmentMessage,
        })
      } else {
        showError("Advertencia", {
          description: roleAssignmentMessage,
        })
      }

      onOpenChange(false)
    } catch (err) {
      console.error("Error creating user:", err)
      showError("Error", {
        description: "Ha ocurrido un error de red o inesperado.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90dvh] overflow-y-auto">
        <DialogHeading icon={UserPlus} title="Nuevo usuario" description="Creá una cuenta y asigná sus roles." />
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
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                name="first_name"
                value={userData.first_name}
                onChange={handleChange}
                required
                placeholder="Juan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido *</Label>
              <Input
                id="last_name"
                name="last_name"
                value={userData.last_name}
                onChange={handleChange}
                required
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={userData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={userData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`pr-10 ${passwordError ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Foto de perfil</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto seleccionada" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Input id="photo" name="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
                <p className="text-xs text-gray-500">
                  {userData.photo ? `Archivo seleccionado: ${userData.photo.name}` : "Opcional (PNG/JPG)."}
                </p>
              </div>
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

          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between">
              <Label>Roles</Label>
              <span className="text-xs text-gray-400">{userData.selectedRoles.length} seleccionado{userData.selectedRoles.length === 1 ? "" : "s"}</span>
            </div>
            <RoleChips roles={Array.isArray(roles) ? roles : []} selectedIds={userData.selectedRoles} onToggle={handleToggleRole} />
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
            <Button
              type="submit"
              disabled={isSubmitting || !!passwordError}
              className="w-full sm:w-auto bg-[#204983] hover:bg-[#1a3d6f]"
            >
              {isSubmitting ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
