"use client"

import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useQueryClient } from "@tanstack/react-query"
import useAuth from "@/contexts/auth-context"
import { useApiQuery } from "@/hooks/use-api-query"
import { USER_ENDPOINTS, AC_ENDPOINTS } from "@/config/api"
import { PERMISSIONS } from "@/config/permissions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { UserManagement } from "./user-management"
import { RoleManagement } from "./role-management"
import { PermissionManagement } from "./permission-management"
import { AlertCircle } from "lucide-react"
import type { User, Role, Permission } from "@/types"

// Tabs tipo pestaña redondeada: pill con color de marca en la activa.
const TAB_LIST = "mb-6 flex h-auto w-full flex-wrap justify-start gap-2 rounded-none border-0 bg-transparent p-0"
const TAB_TRIGGER =
  "rounded-full border border-transparent bg-transparent px-4 py-1.5 text-sm font-medium text-gray-600 shadow-none transition-colors hover:bg-gray-100 data-[state=active]:border-[#204983] data-[state=active]:bg-[#204983] data-[state=active]:text-white data-[state=active]:shadow-sm"

interface PaginatedResponse<T> {
  results: T[]
}

export default function ManagementPage() {
  const { hasPermission, user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  const canManageUsers = hasPermission(PERMISSIONS.MANAGE_USERS.codename)
  const canManageRoles = hasPermission(PERMISSIONS.MANAGE_ROLES.codename)
  const canManageTempPermissions = hasPermission(PERMISSIONS.MANAGE_TEMP_PERMISSIONS.codename)

  const canAccessManagement = canManageUsers || canManageRoles || canManageTempPermissions

  const usersUrl = currentUser?.is_superuser
    ? USER_ENDPOINTS.USERS
    : `${USER_ENDPOINTS.USERS}?is_superuser=false&is_active=True`
  const usersQueryKey = ["admin", "users", currentUser?.is_superuser ?? false] as const
  const rolesQueryKey = ["admin", "roles"] as const
  const permissionsQueryKey = ["admin", "permissions"] as const

  // Cacheado: volver a esta pantalla no recarga usuarios/roles/permisos desde
  // cero si los datos siguen frescos (staleTime del QueryClient).
  const usersQuery = useApiQuery<PaginatedResponse<User>>({
    queryKey: usersQueryKey,
    url: usersUrl,
    enabled: canManageUsers,
  })
  const rolesQuery = useApiQuery<PaginatedResponse<Role>>({
    queryKey: rolesQueryKey,
    url: `${AC_ENDPOINTS.ROLES}?limit=100`,
    enabled: canManageRoles,
  })
  const permissionsQuery = useApiQuery<PaginatedResponse<Permission>>({
    queryKey: permissionsQueryKey,
    url: `${AC_ENDPOINTS.PERMISSIONS}?limit=100`,
    enabled: canManageRoles,
  })

  const users = usersQuery.data?.results ?? []
  const roles = rolesQuery.data?.results ?? []
  const permissions = permissionsQuery.data?.results ?? []

  // Los hijos esperan setters estilo useState para actualizar las listas tras
  // sus CRUD; acá los respaldamos con la cache de React Query.
  const setUsers: Dispatch<SetStateAction<User[]>> = useCallback(
    (update) => {
      queryClient.setQueryData<PaginatedResponse<User>>(usersQueryKey, (prev) => {
        const prevList = prev?.results ?? []
        const nextList = typeof update === "function" ? (update as (p: User[]) => User[])(prevList) : update
        return { ...prev, results: nextList }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, currentUser?.is_superuser],
  )

  const setRoles: Dispatch<SetStateAction<Role[]>> = useCallback(
    (update) => {
      queryClient.setQueryData<PaginatedResponse<Role>>(rolesQueryKey, (prev) => {
        const prevList = prev?.results ?? []
        const nextList = typeof update === "function" ? (update as (p: Role[]) => Role[])(prevList) : update
        return { ...prev, results: nextList }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient],
  )

  const refreshData = useCallback(async () => {
    await Promise.all([
      canManageUsers ? usersQuery.refetch() : Promise.resolve(),
      canManageRoles ? rolesQuery.refetch() : Promise.resolve(),
      canManageRoles ? permissionsQuery.refetch() : Promise.resolve(),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers, canManageRoles])

  // v5: `isLoading` (= isPending && isFetching) es false para queries
  // deshabilitadas, así que con !canAccessManagement esto ya da false solo.
  const isLoading = usersQuery.isLoading || rolesQuery.isLoading || permissionsQuery.isLoading
  const error = usersQuery.isError || rolesQuery.isError || permissionsQuery.isError
    ? "Error al cargar los datos. Por favor, intenta nuevamente."
    : null

  if (isLoading) {
    return (
      <div className="w-full py-4 sm:py-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-4 sm:p-6">
          {/* Header skeleton */}
          <Skeleton className="h-8 w-80 rounded mb-6" />

          {/* Tabs skeleton */}
          <Skeleton className="h-10 w-64 rounded mb-6" />

          {/* Toolbar skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-10 w-full sm:w-36 rounded" />
          </div>

          {/* Table skeleton */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 border-b border-gray-100 last:border-b-0">
                <div className="flex gap-4 items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full py-4 sm:py-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Gestión de Usuarios y Permisos</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm sm:text-base">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!canAccessManagement) {
    return (
      <div className="w-full py-4 sm:py-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Gestión de Usuarios y Permisos</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm sm:text-base">No tienes permisos para acceder a esta sección.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <div className="rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-sm md:p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Usuarios y permisos</h1>
          <p className="text-sm text-gray-500">Gestioná el equipo, sus roles y permisos temporales.</p>
        </div>

        <Tabs defaultValue={canManageUsers ? "users" : "roles"} className="w-full">
          <TabsList className={TAB_LIST}>
            {canManageUsers && (
              <TabsTrigger value="users" className={TAB_TRIGGER}>
                Usuarios {users.length > 0 && <span className="ml-1 text-xs text-gray-400">{users.length}</span>}
              </TabsTrigger>
            )}
            {canManageRoles && (
              <TabsTrigger value="roles" className={TAB_TRIGGER}>
                Roles {roles.length > 0 && <span className="ml-1 text-xs text-gray-400">{roles.length}</span>}
              </TabsTrigger>
            )}
            {canManageRoles && (
              <TabsTrigger value="permissions" className={TAB_TRIGGER}>
                Permisos
              </TabsTrigger>
            )}
          </TabsList>

          {canManageUsers && (
            <TabsContent value="users">
              <UserManagement
                users={users}
                roles={roles}
                permissions={permissions}
                setUsers={setUsers}
                refreshData={refreshData}
              />
            </TabsContent>
          )}

          {canManageRoles && (
            <TabsContent value="roles">
              <RoleManagement roles={roles} setRoles={setRoles} refreshData={refreshData} />
            </TabsContent>
          )}

          {canManageRoles && (
            <TabsContent value="permissions">
              <PermissionManagement permission={permissions} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
