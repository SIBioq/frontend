"use client"

import { useEffect, useState } from "react"
import { ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import type { User } from "@/types"

interface UserTwoFactorResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  /** Ya confirmado: el que llama hace el POST y maneja el error. */
  onConfirm: () => Promise<void>
}

/**
 * Confirmación del reseteo del segundo factor de otra persona.
 *
 * Es el camino de rescate cuando alguien pierde el celular y los códigos, pero
 * también baja la protección de esa cuenta a una sola contraseña, así que el
 * diálogo dice exactamente qué queda pasando y pide un tilde explícito: no
 * alcanza con apretar un botón rojo de apuro.
 */
export function UserTwoFactorResetDialog({ open, onOpenChange, user, onConfirm }: UserTwoFactorResetDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setAcknowledged(false)
      setIsSubmitting(false)
    }
  }, [open])

  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username

  const handleConfirm = async () => {
    if (!acknowledged || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeading
          icon={ShieldOff}
          tone="danger"
          title="Desactivar y resetear el segundo factor"
          description={`Afecta la cuenta de ${fullName} (@${user.username}).`}
        />

        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-700">Se van a borrar, para esta persona:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>el enrolamiento del segundo factor (la app de autenticación deja de servir);</li>
            <li>los códigos de recuperación que le quedaban;</li>
            <li>la confianza de todos los equipos donde no se le pedía el código.</li>
          </ul>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Hasta que se vuelva a enrolar, <strong>{fullName} va a poder entrar sólo con su contraseña</strong>. Si
            además tiene el segundo factor exigido, se le va a pedir el alta en el próximo inicio de sesión.
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-0.5"
            />
            <span>Entiendo la consecuencia y quiero resetear el segundo factor de esta persona</span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full bg-transparent sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!acknowledged || isSubmitting}
            onClick={() => void handleConfirm()}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Reseteando..." : "Desactivar y resetear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UserTwoFactorResetDialog
