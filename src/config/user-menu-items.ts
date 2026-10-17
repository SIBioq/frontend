// ============================================================================
// USER MENU ITEMS - Fuente única de los items del menú de usuario
// ============================================================================
// El menú de usuario (user-dropdown.tsx) se dibuja igual en los tres estados
// de la barra; sólo cambia el alto de los ítems en el celular. Antes había dos
// copias del listado, y agregar un item en una sola (pasó con
// "Superconfiguración") lo dejaba invisible en la otra.
//
// Acá vive el QUÉ (ruta, etiqueta, ícono, cuándo se muestra); el CÓMO se ve lo
// decide el menú.

import type { LucideIcon } from "lucide-react"
import { Receipt, Settings, Shield, ShieldAlert, UserCircle } from "lucide-react"
import { PERMISSIONS } from "@/config/permissions"
import type { User } from "@/types"

// Lo que necesita un item para decidir si se muestra. Sale tal cual de
// useAuth(), así que los menús no tienen que preparar nada.
export interface UserMenuContext {
  user: User | null
  hasPermission: (permission: number | string) => boolean
}

export interface UserMenuItem {
  // Estable e independiente de la ruta: sirve de key en el render.
  id: string
  to: string
  label: string
  icon: LucideIcon
  // Sin isVisible el item se muestra siempre.
  isVisible?: (context: UserMenuContext) => boolean
}

// En el orden del menú: lo de cada uno (perfil, configuración) primero, y
// después lo que depende del rol. Libro diario no está: pasó a la barra.
export const USER_MENU_ITEMS: readonly UserMenuItem[] = [
  {
    id: "profile",
    to: "/profile",
    label: "Mi perfil",
    icon: UserCircle,
  },
  {
    id: "configuracion",
    to: "/configuracion",
    label: "Configuración",
    icon: Settings,
  },
  {
    id: "management",
    to: "/management",
    label: "Gestión de usuarios",
    icon: Shield,
    isVisible: ({ hasPermission }) => hasPermission(PERMISSIONS.MANAGE_USERS.codename),
  },
  {
    id: "facturacion",
    to: "/facturacion",
    label: "Facturación",
    icon: Receipt,
    isVisible: ({ hasPermission }) => hasPermission(PERMISSIONS.MANAGE_BILLING.codename),
  },

  {
    id: "superconfiguracion",
    to: "/superconfiguracion",
    label: "Superconfiguración",
    icon: ShieldAlert,
    // Superconfiguración es exclusiva de superusuarios: no se resuelve con un
    // permiso para que no se pueda habilitar por accidente desde un rol.
    isVisible: ({ user }) => Boolean(user?.is_superuser),
  },
]

export const getVisibleUserMenuItems = (context: UserMenuContext): UserMenuItem[] =>
  USER_MENU_ITEMS.filter((item) => item.isVisible?.(context) ?? true)
