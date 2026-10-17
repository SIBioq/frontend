"use client"

import type React from "react"
import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"
import { useSessionNotifications } from "@/hooks/use-session-notifications"

interface SessionNotificationToggleProps {
  onDone?: () => void
  className?: string
  style?: React.CSSProperties
  /** Dentro del menú de usuario: es un ítem más y las flechas pasan por él. */
  itemDeMenu?: boolean
}

export const SessionNotificationToggle: React.FC<SessionNotificationToggleProps> = ({
  onDone,
  className = "",
  style,
  itemDeMenu = false,
}) => {
  const { permission, enabled, isSupported, requestPermission, disableNotifications } = useSessionNotifications()

  if (!isSupported) {
    return null
  }

  const isActive = enabled && permission === "granted"
  const isBlocked = permission === "denied"

  const handleClick = async () => {
    if (isActive) {
      disableNotifications()
      toast.info("Notificaciones desactivadas")
      onDone?.()
      return
    }

    const result = await requestPermission()

    if (result === "granted") {
      toast.success("Notificaciones activadas", {
        description: "Te vamos a avisar cuando tu sesión esté por expirar.",
      })
    } else if (result === "denied") {
      toast.error("Notificaciones bloqueadas", {
        description: "Para activarlas, habilitalas desde los permisos del navegador.",
      })
    }

    onDone?.()
  }

  return (
    <button
      type="button"
      role={itemDeMenu ? "menuitem" : undefined}
      data-item={itemDeMenu ? "" : undefined}
      style={style}
      onClick={handleClick}
      disabled={isBlocked}
      className={`w-full text-left px-4 py-3 text-sm flex items-center space-x-2 transition-colors duration-150 ${
        isBlocked
          ? "cursor-not-allowed text-gray-400"
          : isActive
            ? "text-emerald-700 hover:bg-emerald-50"
            : "text-gray-700 hover:bg-gray-100"
      } ${className}`}
      title={isBlocked ? "Las notificaciones están bloqueadas en el navegador" : undefined}
    >
      {isActive ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      <span>{isActive ? "Notificaciones activas" : isBlocked ? "Notificaciones bloqueadas" : "Activar notificaciones"}</span>
    </button>
  )
}
