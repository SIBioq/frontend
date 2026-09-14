"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Mail, ShieldCheck, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { TwoFactorEnrollStep } from "@/components/common/two-factor-enroll-step"
import { TwoFactorRecoveryCodes } from "@/components/common/two-factor-recovery-codes"
import { AUTH_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { readApiError } from "@/lib/api-error"
import type { TwoFactorConfirmResponse, TwoFactorMethod, TwoFactorSetupResponse } from "@/types"

interface TwoFactorSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama cuando el alta quedó confirmada, para refrescar el estado. */
  onConfirmed: () => void
}

type Step = "choose" | "loading" | "scan" | "codes" | "failed"

export function TwoFactorSetupDialog({ open, onOpenChange, onConfirmed }: TwoFactorSetupDialogProps) {
  const { apiRequest } = useApi()

  const [step, setStep] = useState<Step>("choose")
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [code, setCode] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codesAcknowledged, setCodesAcknowledged] = useState(false)

  const startSetup = useCallback(async (method: TwoFactorMethod) => {
    setStep("loading")
    setErrorMessage(null)
    setCode("")
    try {
      const response = await apiRequest(AUTH_ENDPOINTS.TWO_FACTOR_SETUP, { method: "POST", body: { method } })
      if (!response.ok) {
        setErrorMessage(await readApiError(response, "No se pudo iniciar la configuración."))
        setStep("failed")
        return
      }
      const data: TwoFactorSetupResponse = await response.json()
      setSetupData(data)
      setStep("scan")
    } catch {
      setErrorMessage("No se pudo conectar con el servidor.")
      setStep("failed")
    }
  }, [apiRequest])

  useEffect(() => {
    if (!open) return
    setSetupData(null)
    setRecoveryCodes([])
    setCodesAcknowledged(false)
    setStep("choose")
  }, [open])

  const confirmCode = useCallback(
    async (value: string) => {
      if (isConfirming) return
      setIsConfirming(true)
      setErrorMessage(null)
      try {
        const response = await apiRequest(AUTH_ENDPOINTS.TWO_FACTOR_CONFIRM, {
          method: "POST",
          body: { code: value },
        })

        if (response.status === 429) {
          setErrorMessage("Demasiados intentos. Esperá un momento antes de volver a probar.")
          setCode("")
          return
        }

        if (!response.ok) {
          setErrorMessage(await readApiError(response, "El código no coincide. Revisá la hora del celular y probá con el siguiente."))
          setCode("")
          return
        }

        const data: TwoFactorConfirmResponse = await response.json()
        setRecoveryCodes(Array.isArray(data.recovery_codes) ? data.recovery_codes : [])
        setStep("codes")
        onConfirmed()
      } catch {
        setErrorMessage("No se pudo conectar con el servidor.")
        setCode("")
      } finally {
        setIsConfirming(false)
      }
    },
    [apiRequest, isConfirming, onConfirmed],
  )

  // En el paso de los códigos el cierre accidental es destructivo: no se
  // vuelven a mostrar nunca más. Por eso se bloquea hasta que el usuario
  // confirme que los guardó.
  const canDismiss = step !== "codes" || codesAcknowledged

  const handleOpenChange = (next: boolean) => {
    if (!next && !canDismiss) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[95vw] sm:max-w-[520px]"
        showCloseButton={canDismiss}
        onPointerDownOutside={(event) => {
          if (!canDismiss) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (!canDismiss) event.preventDefault()
        }}
      >
        {step === "codes" ? (
          <DialogHeading
            icon={AlertTriangle}
            tone="danger"
            title="Guardá tus códigos de recuperación"
            description="Es la única vez que se muestran."
          />
        ) : (
          <DialogHeading
            icon={ShieldCheck}
            title="Activar verificación en dos pasos"
            description={step === "scan" && setupData?.method === "email" ? "Confirmá el código que enviamos a tu correo." : "Elegí un método y confirmá el código para activarlo."}
          />
        )}

        {step === "loading" && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#204983] border-t-transparent" />
            Preparando la configuración...
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-4 py-6">
            <p className="whitespace-pre-line text-sm text-red-700">{errorMessage}</p>
            <Button onClick={() => setStep("choose")} className="bg-[#204983] hover:bg-[#1a3d6f]">Elegir método</Button>
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-gray-600">Elegí cómo querés recibir el código al iniciar sesión.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void startSetup("totp")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5">
                <Smartphone className="h-5 w-5 text-[#204983]" />
                <span><strong className="block text-sm text-gray-800">Aplicación autenticadora</strong><small className="text-xs text-gray-500">QR y código de la app</small></span>
              </button>
              <button type="button" onClick={() => void startSetup("email")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5">
                <Mail className="h-5 w-5 text-[#204983]" />
                <span><strong className="block text-sm text-gray-800">Correo electrónico</strong><small className="text-xs text-gray-500">Código temporal al correo de la cuenta</small></span>
              </button>
            </div>
          </div>
        )}

        {step === "scan" && setupData && (
          <TwoFactorEnrollStep
            setup={setupData}
            code={code}
            onCodeChange={(next) => {
              setCode(next)
              if (errorMessage) setErrorMessage(null)
            }}
            onComplete={(value) => void confirmCode(value)}
            isConfirming={isConfirming}
            errorMessage={errorMessage}
          />
        )}

        {step === "codes" && (
          <TwoFactorRecoveryCodes
            codes={recoveryCodes}
            acknowledged={codesAcknowledged}
            onAcknowledgedChange={setCodesAcknowledged}
          />
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "codes" ? (
            <Button
              type="button"
              disabled={!codesAcknowledged}
              onClick={() => onOpenChange(false)}
              className="w-full bg-[#204983] hover:bg-[#1a3d6f] sm:w-auto"
            >
              Listo
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full bg-transparent sm:w-auto"
            >
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TwoFactorSetupDialog
