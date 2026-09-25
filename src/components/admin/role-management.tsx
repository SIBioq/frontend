"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import type { UIEvent } from "react"
import useAuth from "@/contexts/auth-context"
import { useApi } from "@/hooks/use-api"
import { AC_ENDPOINTS } from "@/config/api"
import { PERMISSIONS } from "@/config/permissions"
import { toast } from "sonner"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/common/data-table"
import { Pencil, Trash, Plus, Search, ShieldCheck } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { HistoryList } from "@/components/common/history-list"
import { formatDateTime } from "@/utils/date-utils"
import type { Role, Permission, HistoryEntry } from "@/types"
import { formatApiError } from "@/lib/api-error"

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData, "Error desconocido")

type RoleWithDetails = Role & {
  permission_details?: Permission[]
  permissions?: number[]
  history?: HistoryEntry[]
  total_changes?: number
}

interface RoleManagementProps {
  roles: RoleWithDetails[]
  setRoles: React.Dispatch<React.SetStateAction<RoleWithDetails[]>>
  refreshData: () => Promise<void>
}

export function RoleManagement({ roles, setRoles, refreshData }: RoleManagementProps) {
  const { hasPermission } = useAuth()
  const { apiRequest } = useApi()

  const canView = hasPermission(PERMISSIONS.MANAGE_ROLES.codename)
  const canCreate = hasPermission(PERMISSIONS.MANAGE_ROLES.codename)
  const canEdit = hasPermission(PERMISSIONS.MANAGE_ROLES.codename)
  const canDelete = hasPermission(PERMISSIONS.MANAGE_ROLES.codename)

  const [allPerms, setAllPerms] = useState<Permission[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMorePerms, setHasMorePerms] = useState(true)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const permsContainerRef = useRef<HTMLDivElement>(null)

  const fetchMorePermissions = async () => {
    if (loadingPerms || !hasMorePerms) return
    setLoadingPerms(true)
    try {
      const res = await apiRequest(`${AC_ENDPOINTS.PERMISSIONS}?limit=20&offset=${offset}`)
      if (!res.ok) {
        setHasMorePerms(false)
        return
      }
      const data = await res.json()
      const batch: Permission[] = data.results || []
      setAllPerms((prev) => {
        const existingIds = new Set(prev.map((p: Permission) => p.id))
        const newPerms = batch.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newPerms]
      })
      setOffset((prev) => prev + batch.length)
      if (!data.next || batch.length < 20) {
        setHasMorePerms(false)
      }
    } catch {
      setHasMorePerms(false)
    } finally {
      setLoadingPerms(false)
    }
  }

  useEffect(() => {
    if (allPerms.length === 0 && hasMorePerms) {
      fetchMorePermissions()
    }
  }, [])

  const onPermsScroll = (e: UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget
    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 20) {
      fetchMorePermissions()
    }
  }

  const [search, setSearch] = useState("")
  const query = search.trim().toLowerCase()
  const validRoles = roles
    .filter((r) => r.id)
    .filter((r) => (query ? r.name.toLowerCase().includes(query) : true))

  const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(null)
  const [isViewing, setIsViewing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [roleDetail, setRoleDetail] = useState<RoleWithDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [formData, setFormData] = useState<{ name: string; permissions: number[] }>({
    name: "",
    permissions: [],
  })

  const resetForm = () => {
    setFormData({ name: "", permissions: [] })
    setSelectedRole(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePermissionToggle = (permId: number, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked
        ? Array.from(new Set([...prev.permissions, permId]))
        : prev.permissions.filter((id) => id !== permId),
    }))
  }

  const handleSelectRole = (role: RoleWithDetails) => {
    setSelectedRole(role)
    const existing: number[] = Array.isArray(role.permission_details)
      ? role.permission_details.map((p: Permission) => p.id)
      : Array.isArray(role.permissions)
        ? role.permissions
        : []
    setFormData({ name: role.name, permissions: Array.from(new Set(existing)) })
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre del rol es requerido")
      return
    }
    const id = toast.loading("Creando rol...")
    try {
      const res = await apiRequest(AC_ENDPOINTS.ROLES, {
        method: "POST",
        body: { name: formData.name.trim(), permissions: formData.permissions },
      })
      toast.dismiss(id)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        toast.error("Error al crear rol", { description: extractErrorMessage(err) })
        return
      }
      const newRole = await res.json()
      setRoles((prev) => [...prev, newRole])
      await refreshData()
      toast.success("Rol creado")
      setIsCreating(false)
      resetForm()
    } catch {
      toast.dismiss(id)
      toast.error("Error inesperado al crear rol")
    }
  }

  const handleEdit = async () => {
    if (!selectedRole?.id) return
    if (!formData.name.trim()) {
      toast.error("El nombre del rol es requerido")
      return
    }
    const id = toast.loading("Actualizando rol...")
    try {
      const res = await apiRequest(AC_ENDPOINTS.ROLE_DETAIL(selectedRole.id), {
        method: "PATCH",
        body: { name: formData.name.trim(), permissions: formData.permissions },
      })
      toast.dismiss(id)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        toast.error("Error al actualizar rol", { description: extractErrorMessage(err) })
        return
      }
      await refreshData()
      toast.success("Rol actualizado")
      setIsEditing(false)
      resetForm()
    } catch {
      toast.dismiss(id)
      toast.error("Error inesperado al actualizar rol")
    }
  }

  const handleDelete = async () => {
    if (!selectedRole?.id) return
    const id = toast.loading("Eliminando rol...")
    try {
      const res = await apiRequest(AC_ENDPOINTS.ROLE_DETAIL(selectedRole.id), { method: "DELETE" })
      toast.dismiss(id)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        toast.error("Error al eliminar rol", { description: extractErrorMessage(err) })
        return
      }
      setRoles((prev) => prev.filter((r) => r.id !== selectedRole.id))
      toast.success("Rol eliminado")
      setIsDeleting(false)
      resetForm()
    } catch {
      toast.dismiss(id)
      toast.error("Error inesperado al eliminar rol")
    }
  }

  const fetchRoleDetail = async (roleId: number) => {
    setLoadingDetail(true)
    try {
      const res = await apiRequest(AC_ENDPOINTS.ROLE_DETAIL(roleId), {
        method: "GET",
      })
      if (res.ok) {
        const data = await res.json()
        setRoleDetail(data)
      } else {
        toast.error("No se pudo cargar el detalle del rol")
      }
    } catch {
      toast.error("Error al cargar el detalle del rol")
    } finally {
      setLoadingDetail(false)
    }
  }

  const openRoleView = (role: RoleWithDetails) => {
    handleSelectRole(role)
    setIsViewing(true)
    fetchRoleDetail(role.id)
  }

  const roleColumns: Column<RoleWithDetails>[] = [
    {
      id: "name",
      header: "Nombre",
      cell: (role) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#204983]/10 text-[#204983]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="font-medium text-gray-900">{role.name}</span>
        </div>
      ),
    },
    {
      id: "permissions",
      header: "Permisos",
      cell: (role) => {
        const perms = role.permission_details ?? []
        return (
          <div className="flex flex-wrap gap-1">
            {perms.length > 0 ? (
              perms.slice(0, 3).map((p) => (
                <Badge key={p.id} variant="secondary" className="text-[10px]">
                  {p.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-400">Sin permisos</span>
            )}
            {perms.length > 3 && <Badge variant="outline" className="text-[10px]">+{perms.length - 3}</Badge>}
          </div>
        )
      },
    },
    {
      id: "created",
      header: "Creado",
      responsive: "hidden lg:table-cell",
      cell: (role) => (
        <span className="text-sm text-gray-500">{role.creation ? formatDateTime(role.creation.date) : "—"}</span>
      ),
    },
    {
      id: "changed",
      header: "Último cambio",
      responsive: "hidden lg:table-cell",
      cell: (role) => (
        <span className="text-sm text-gray-500">{role.last_change ? formatDateTime(role.last_change.date) : "—"}</span>
      ),
    },
  ]

  if (!canView) return null

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreate && (
          <Dialog
            open={isCreating}
            onOpenChange={(open) => {
              setIsCreating(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#204983] text-white w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Crear Rol
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Crear Rol</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Nombre del Rol</Label>
                  <Input name="name" value={formData.name} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Permisos ({formData.permissions.length})</Label>
                  <div
                    ref={permsContainerRef}
                    onScroll={onPermsScroll}
                    className="max-h-60 overflow-y-auto border rounded-md p-3"
                  >
                    {allPerms.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`perm-create-${perm.id}`}
                          checked={formData.permissions.includes(perm.id)}
                          onCheckedChange={(ch) => handlePermissionToggle(perm.id, ch === true)}
                        />
                        <Label htmlFor={`perm-create-${perm.id}`} className="cursor-pointer text-sm">
                          {perm.name}
                        </Label>
                      </div>
                    ))}
                    {loadingPerms && <p className="text-center py-2 text-sm">Cargando más permisos…</p>}
                    {!hasMorePerms && allPerms.length === 0 && (
                      <p className="text-gray-500 text-sm">No hay permisos disponibles.</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button onClick={handleCreate} className="w-full sm:w-auto">
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={roleColumns}
        rows={validRoles}
        getRowId={(r) => r.id}
        onRowClick={openRoleView}
        emptyMessage="No hay roles que coincidan con la búsqueda."
      />

      {/* Dialog Ver Rol */}
      <Dialog
        open={isViewing}
        onOpenChange={(open) => {
          setIsViewing(open)
          if (!open) {
            resetForm()
            setRoleDetail(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl max-h-[90dvh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Detalles del Rol</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-8 text-center text-gray-500 text-sm sm:text-base">Cargando detalles del rol...</div>
          ) : roleDetail ? (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-sm sm:text-base">Nombre</Label>
                <p className="text-gray-700">{roleDetail.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Permisos</Label>
                <div className="flex flex-wrap gap-1">
                  {roleDetail.permission_details && roleDetail.permission_details.length > 0 ? (
                    roleDetail.permission_details.map((p: Permission) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">Sin permisos</span>
                  )}
                </div>
              </div>

              {roleDetail.history && roleDetail.history.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Historial de Cambios ({roleDetail.total_changes || roleDetail.history.length})
                    </h4>
                    <HistoryList history={roleDetail.history} />
                  </div>
                </>
              )}
            </div>
          ) : selectedRole ? (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-sm sm:text-base">Nombre</Label>
                <p className="text-gray-700">{selectedRole.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Permisos</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedRole.permission_details && selectedRole.permission_details.length > 0 ? (
                    selectedRole.permission_details.map((p: Permission) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">Sin permisos</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Cerrar Ver dispara resetForm (limpia selectedRole); reseleccionamos
                    // en el próximo tick para que Editar tenga los datos correctos.
                    const role = roleDetail ?? selectedRole
                    setIsViewing(false)
                    setTimeout(() => {
                      if (role) handleSelectRole(role)
                      setIsEditing(true)
                    }, 0)
                  }}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    const role = roleDetail ?? selectedRole
                    setIsViewing(false)
                    setTimeout(() => {
                      if (role) handleSelectRole(role)
                      setIsDeleting(true)
                    }, 0)
                  }}
                >
                  <Trash className="mr-1.5 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline" className="bg-transparent">
                Cerrar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Rol */}
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          setIsEditing(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Editar Rol</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Nombre del Rol</Label>
              <Input name="name" value={formData.name} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Permisos ({formData.permissions.length})</Label>
              <div onScroll={onPermsScroll} className="max-h-60 overflow-y-auto border rounded-md p-3">
                {allPerms.map((perm) => (
                  <div key={perm.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`perm-edit-${perm.id}`}
                      checked={formData.permissions.includes(perm.id)}
                      onCheckedChange={(ch) => handlePermissionToggle(perm.id, ch === true)}
                    />
                    <Label htmlFor={`perm-edit-${perm.id}`} className="cursor-pointer text-sm">
                      {perm.name}
                    </Label>
                  </div>
                ))}
                {loadingPerms && <p className="text-center py-2 text-sm">Cargando más permisos…</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleEdit} className="w-full sm:w-auto">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar Rol */}
      <Dialog
        open={isDeleting}
        onOpenChange={(open) => {
          setIsDeleting(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Eliminar Rol</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm sm:text-base">
              ¿Estás seguro de que deseas eliminar el rol <strong>{selectedRole?.name}</strong>? Esta acción no se puede
              deshacer.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                Cancelar
              </Button>
            </DialogClose>
            <Button className="bg-red-600 hover:bg-red-700 w-full sm:w-auto" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
