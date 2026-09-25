"use client"

import type React from "react"
import { useState } from "react"
import { Lock, ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AUTH_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { readApiError } from "@/lib/api-error"

interface TwoFactorDisableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDisabled: () => void
}

export function TwoFactorDisableDialog({ open, onOpenChange, onDisabled }: TwoFactorDisableDialogProps) {
  const { apiRequest } = useApi()
  const { success } = useToast()
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassword("")
      setErrorMessage(null)
    }
    onOpenChange(next)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password.trim() || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const response = await apiRequest(AUTH_ENDPOINTS.TWO_FACTOR, {
        method: "DELETE",
        body: { password },
      })

      if (!response.ok) {
        setErrorMessage(await readApiError(response, "No se pudo desactivar. Revisá la contraseña."))
        return
      }

      success("Verificación en dos pasos desactivada", {
        description: "A partir de ahora sólo se te va a pedir usuario y contraseña.",
      })
      onDisabled()
      handleOpenChange(false)
    } catch {
      setErrorMessage("No se pudo conectar con el servidor.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeading
          icon={ShieldOff}
          tone="danger"
          title="Desactivar verificación en dos pasos"
          description="Tu cuenta va a quedar protegida sólo con la contraseña."
        />
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <p className="text-sm text-gray-700">
            Se van a borrar tus códigos de recuperación y la confianza de todos los equipos. Confirmá con tu contraseña.
          </p>
          <div>
            <Label htmlFor="two-factor-disable-password" className="text-sm">
              Contraseña
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                id="two-factor-disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                className={`pl-10 ${errorMessage ? "border-red-300 focus:ring-red-500" : ""}`}
                placeholder="Tu contraseña actual"
              />
            </div>
            {errorMessage && <p className="mt-1 whitespace-pre-line text-sm text-red-600">{errorMessage}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="w-full bg-transparent sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting || !password.trim()} className="w-full sm:w-auto">
              {isSubmitting ? "Desactivando..." : "Desactivar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TwoFactorDisableDialog
