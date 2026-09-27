"use client"

import { useState } from "react"
import type { User, Role, Group } from "@/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Clock, KeyRound, Mail, MoreHorizontal, Pencil, Shield, ShieldX, Trash, X, Plus, Check, Loader2, History } from "lucide-react"
import { UserTwoFactorPanel } from "./user-two-factor-panel"

export type UserCardAction =
  | "edit"
  | "tempPermission"
  | "revokeTempPermission"
  | "delete"
  | "history"
  | "requirePasswordChange"
  | "cancelPasswordChange"

const formatFechaHora = (iso: string): string =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })

interface UserCardProps {
  user: User
  roles: Role[]
  canEdit: boolean
  canDelete: boolean
  canAssignRole: boolean
  canManageTempPermissions: boolean
  /** Sólo para superusuarios: para el resto la sección del 2FA ni se monta. */
  canManageTwoFactor: boolean
  onAction: (user: User, action: UserCardAction) => void
  onToggleRole: (user: User, roleId: number) => Promise<void>
}

const roleVariant = (name: string): "default" | "secondary" | "destructive" | "outline" => {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    Administradora: "destructive",
    Bioquimica: "default",
    Tecnica: "secondary",
    Secretaria: "outline",
  }
  return map[name] || "secondary"
}

const initials = (u: User) =>
  u.first_name && u.last_name
    ? `${u.first_name.charAt(0)}${u.last_name.charAt(0)}`.toUpperCase()
    : u.username.substring(0, 2).toUpperCase()

export function UserCard({
  user,
  roles,
  canEdit,
  canDelete,
  canAssignRole,
  canManageTempPermissions,
  canManageTwoFactor,
  onAction,
  onToggleRole,
}: UserCardProps) {
  const [pendingRoleId, setPendingRoleId] = useState<number | null>(null)
  const activeRoles: Group[] = user.groups || user.roles || []
  const activeRoleIds = new Set(activeRoles.map((r) => r.id))
  const hasTemp = user.permissions?.some((p) => p.temporary) || false
  // El que vence primero: es lo que hay que saber para renovarlo a tiempo.
  const venceTemp = (user.permissions || [])
    .filter((p) => p.temporary && p.expires_at)
    .map((p) => p.expires_at as string)
    .sort()[0]
  const debeCambiarContrasena = Boolean(user.must_change_password)
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username

  const toggle = async (roleId: number) => {
    setPendingRoleId(roleId)
    try {
      await onToggleRole(user, roleId)
    } finally {
      setPendingRoleId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.photo || undefined} alt={user.username} />
          <AvatarFallback className="bg-[#204983] text-sm text-white">{initials(user)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{fullName}</p>
          <p className="truncate text-xs text-gray-500">@{user.username}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="-mr-1 -mt-1 h-8 w-8 p-0 text-gray-400 hover:text-gray-700">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction(user, "history")}>
              <History className="h-4 w-4" />
              Ver historial
            </DropdownMenuItem>
            {(canEdit || canManageTempPermissions || canDelete) && <DropdownMenuSeparator />}
            {canEdit && (
                <DropdownMenuItem onClick={() => onAction(user, "edit")}>
                  <Pencil className="h-4 w-4" />
                  Editar datos
                </DropdownMenuItem>
              )}
              {canManageTempPermissions && (
                <DropdownMenuItem onClick={() => onAction(user, "tempPermission")}>
                  <Shield className="h-4 w-4" />
                  Permiso temporal
                </DropdownMenuItem>
              )}
              {canManageTempPermissions && hasTemp && (
                <DropdownMenuItem onClick={() => onAction(user, "revokeTempPermission")}>
                  <ShieldX className="h-4 w-4" />
                  Revocar temporal
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem
                  onClick={() =>
                    onAction(user, debeCambiarContrasena ? "cancelPasswordChange" : "requirePasswordChange")
                  }
                >
                  <KeyRound className="h-4 w-4" />
                  {debeCambiarContrasena ? "No exigir cambio de contraseña" : "Exigir cambio de contraseña"}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onAction(user, "delete")}>
                    <Trash className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Mail className="h-3.5 w-3.5 text-gray-400" />
        <span className="truncate">{user.email || "Sin email"}</span>
      </div>

      {(user.date_joined || user.last_login !== undefined) && (
        <p className="text-[11px] text-gray-400">
          {user.date_joined ? `Alta ${formatFechaHora(user.date_joined)}` : ""}
          {user.date_joined && user.last_login !== undefined ? " · " : ""}
          {user.last_login !== undefined
            ? user.last_login
              ? `Último ingreso ${formatFechaHora(user.last_login)}`
              : "Nunca ingresó"
            : ""}
        </p>
      )}

      {/* Se edita en el mismo diálogo que el nombre: si no se ve acá, sólo se
          lo conoce abriendo la edición. */}
      {user.inactivity_logout_minutes != null && (
        <p className="text-[11px] text-gray-400">
          Cierra la sesión tras {user.inactivity_logout_minutes} min sin actividad
        </p>
      )}

      {(user.is_superuser || hasTemp || debeCambiarContrasena || user.is_active === false) && (
        <div className="flex flex-wrap gap-1">
          {user.is_superuser && <Badge variant="destructive" className="text-[10px]">Superusuario</Badge>}
          {hasTemp && (
            <Badge variant="secondary" className="text-[10px]">
              <Clock className="mr-1 h-3 w-3" />
              Permiso temporal
              {venceTemp ? ` · vence ${formatFechaHora(venceTemp)}` : ""}
            </Badge>
          )}
          {debeCambiarContrasena && (
            // Con la marca puesta esta persona no puede hacer NADA hasta
            // cambiar la contraseña. Si se la pusieron por error, la salida no
            // puede estar escondida en el menú de tres puntos: va acá, al lado
            // del cartel que explica por qué está trabada.
            <span className="inline-flex items-center gap-1">
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                <KeyRound className="mr-1 h-3 w-3" />
                Debe cambiar la contraseña
              </Badge>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onAction(user, "cancelPasswordChange")}
                  className="text-[10px] font-medium text-gray-500 underline underline-offset-2 hover:text-[#204983]"
                >
                  Sacar
                </button>
              )}
            </span>
          )}
          {user.is_active === false && (
            <Badge variant="outline" className="border-red-200 text-[10px] text-red-600">
              Inactivo
            </Badge>
          )}
        </div>
      )}

      {/* Roles editables inline */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
        {activeRoles.map((role) => (
          <Badge key={role.id} variant={roleVariant(role.name)} className="gap-1 pr-1">
            {role.name}
            {canAssignRole &&
              (pendingRoleId === role.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(role.id)}
                  className="rounded-full p-0.5 hover:bg-black/10"
                  aria-label={`Quitar ${role.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              ))}
          </Badge>
        ))}
        {activeRoles.length === 0 && <span className="text-xs text-gray-400">Sin roles</span>}

        {canAssignRole && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#204983] hover:text-[#204983]"
              >
                <Plus className="h-3 w-3" />
                Rol
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <p className="px-2 py-1.5 text-xs font-semibold text-gray-500">Roles del usuario</p>
              <div className="max-h-60 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-gray-400">No hay roles disponibles.</p>
                ) : (
                  roles.map((role) => {
                    const active = activeRoleIds.has(role.id)
                    const pending = pendingRoleId === role.id
                    return (
                      <button
                        key={role.id}
                        type="button"
                        disabled={pending}
                        onClick={() => toggle(role.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <span>{role.name}</span>
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#204983]" />
                        ) : active ? (
                          <Check className="h-3.5 w-3.5 text-[#204983]" />
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {canManageTwoFactor && <UserTwoFactorPanel user={user} />}
    </div>
  )
}
