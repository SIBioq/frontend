"use client"

import type React from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface IdleWarningModalProps {
  isOpen: boolean
  timeLeft: number
  onExtend: () => void
  onLogout: () => void
  notificationsAvailable?: boolean
  notificationsEnabled?: boolean
  onEnableNotifications?: () => void
}

export const IdleWarningModal: React.FC<IdleWarningModalProps> = ({
  isOpen,
  timeLeft,
  onExtend,
  onLogout,
  notificationsAvailable = false,
  notificationsEnabled = false,
  onEnableNotifications,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }
    return `${secs}`
  }

  const handleLogout = () => {
    onLogout()
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      {/* El telón entra y sale más lento que el diálogo: primero oscurece,
          después llega el aviso; al revés al cerrarse. Va por
          `overlayClassName` porque `DialogContent` ya trae su portal y su
          telón: envolverlo en otro portal dibujaba dos fondos, uno encima
          del otro. */}
      <DialogContent
        overlayClassName="backdrop-blur-sm data-[state=open]:duration-300 data-[state=closed]:duration-200"
        className="max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-8 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-4 data-[state=closed]:duration-200"
        onPointerDownOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Sesión por expirar
          </DialogTitle>
          <DialogDescription className="text-center py-4">Tu sesión expirará por inactividad en:</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {/* Sobre el final el número late: el aviso está para que alguien
              que no está mirando la pantalla lo note de reojo. */}
          <div
            className={`flex items-center gap-2 text-3xl font-bold text-red-600 mb-2 ${
              timeLeft <= 10 ? "motion-safe:animate-pulse" : ""
            }`}
          >
            <Clock className="h-8 w-8" />
            <span>{formatTime(timeLeft)}</span>
          </div>
          <p className="text-sm text-gray-600 text-center">
            {timeLeft <= 10 ? "La sesión se cierra en cualquier momento." : "¿Seguís ahí? Podés continuarla."}
          </p>
          {notificationsAvailable && !notificationsEnabled && onEnableNotifications && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEnableNotifications}
              className="mt-4 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              Activar notificaciones
            </Button>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleLogout} className="flex-1 bg-transparent">
            Cerrar sesión
          </Button>
          <Button onClick={onExtend} className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]">
            Continuar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default IdleWarningModal
