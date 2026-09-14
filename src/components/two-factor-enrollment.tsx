"use client"

import { useCallback, useState } from "react"
import { AlertCircle, AlertTriangle, ArrowLeft, Mail, ShieldAlert, Smartphone, TimerReset } from "lucide-react"
import { TwoFactorEnrollStep } from "@/components/common/two-factor-enroll-step"
import { TwoFactorRecoveryCodes } from "@/components/common/two-factor-recovery-codes"
import { formatCountdown, useExpiryCountdown } from "@/hooks/use-expiry-countdown"
import type { TwoFactorSetupResponse } from "@/types"
import type { TwoFactorMethod } from "@/types"

export interface TwoFactorEnrollmentStartResult {
  ok: boolean
  setup?: TwoFactorSetupResponse
  message?: string
  /** El backend avisó que el pase venció: hay que volver a empezar. */
  expired?: boolean
}

export interface TwoFactorEnrollmentConfirmResult {
  ok: boolean
  recoveryCodes?: string[]
  message?: string
  expired?: boolean
}

interface TwoFactorEnrollmentProps {
  username: string
  /** Segundos de vida que le quedaban al pase cuando llegó (el backend usa 900). */
  expiresIn: number
  onStart: (method: TwoFactorMethod) => Promise<TwoFactorEnrollmentStartResult>
  onConfirm: (code: string) => Promise<TwoFactorEnrollmentConfirmResult>
  /** La persona ya guardó los códigos: seguimos a la app. */
  onDone: () => void
  /** Volver al formulario de usuario y contraseña. */
  onCancel: () => void
}

type Step = "choose" | "loading" | "scan" | "codes" | "failed"

const PRIMARY_BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-[#204983] px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-[#1a3d6f] focus:outline-none focus:ring-2 focus:ring-[#204983] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Enrolamiento obligatorio dentro del login.
 *
 * Es la pantalla de alguien que NO puede entrar: la organización le exige
 * segundo factor y todavía no lo tiene. Por eso el alta se hace acá y no se lo
 * manda al perfil (al que no puede llegar sin sesión). Al confirmar, el backend
 * cierra el login: la sesión ya está abierta cuando aparecen los códigos, y esta
 * pantalla los retiene hasta que confirme que los guardó.
 */
export function TwoFactorEnrollment({
  username,
  expiresIn,
  onStart,
  onConfirm,
  onDone,
  onCancel,
}: TwoFactorEnrollmentProps) {
  const [step, setStep] = useState<Step>("choose")
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null)
  const [code, setCode] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codesAcknowledged, setCodesAcknowledged] = useState(false)
  const { secondsLeft, expired, markExpired } = useExpiryCountdown(expiresIn)

  const start = useCallback(async (method: TwoFactorMethod) => {
    setStep("loading")
    setErrorMessage(null)
    setCode("")

    const result = await onStart(method)
    if (result.ok && result.setup) {
      setSetup(result.setup)
      setStep("scan")
      return
    }

    if (result.expired) markExpired()
    setErrorMessage(result.message || "No se pudo preparar el enrolamiento.")
    setStep("failed")
  }, [markExpired, onStart])

  const confirm = useCallback(
    async (value: string) => {
      if (isConfirming) return
      setIsConfirming(true)
      setErrorMessage(null)

      try {
        const result = await onConfirm(value)
        if (result.ok) {
          setRecoveryCodes(result.recoveryCodes ?? [])
          setStep("codes")
          return
        }

        if (result.expired) markExpired()
        setErrorMessage(result.message || "No pudimos confirmar el código.")
        // Limpiamos para que el próximo intento arranque de cero y el autoenvío
        // se pueda volver a disparar.
        setCode("")
      } finally {
        setIsConfirming(false)
      }
    },
    [isConfirming, markExpired, onConfirm],
  )

  // Si venció DESPUÉS de confirmar ya no importa: el alta quedó hecha y la
  // sesión abierta. El vencimiento sólo corta los pasos previos.
  if (expired && step !== "codes") {
    return (
      <div className="px-8 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <TimerReset className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Se venció el pase</h1>
          <p className="text-sm text-gray-600">
            Por seguridad, el permiso para configurar el segundo factor sólo vale 15 minutos. Iniciá sesión de nuevo
            para pedir uno nuevo; no perdiste nada.
          </p>
        </div>

        <button type="button" onClick={onCancel} className={PRIMARY_BUTTON}>
          Volver a empezar
        </button>
      </div>
    )
  }

  if (step === "codes") {
    return (
      <div className="px-8 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Guardá tus códigos de recuperación</h1>
          <p className="text-sm text-gray-600">
            Ya quedaste dentro del sistema. Es la única vez que se muestran estos códigos.
          </p>
        </div>

        <TwoFactorRecoveryCodes
          codes={recoveryCodes}
          acknowledged={codesAcknowledged}
          onAcknowledgedChange={setCodesAcknowledged}
        />

        <button type="button" onClick={onDone} disabled={!codesAcknowledged} className={`mt-4 ${PRIMARY_BUTTON}`}>
          Entrar al sistema
        </button>
      </div>
    )
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">Configurá tu segundo factor</h1>
        <p className="text-sm text-gray-600">
          Tu cuenta <strong>{username}</strong> tiene la verificación en dos pasos obligatoria. Configurala ahora para
          poder entrar.
        </p>
      </div>

      {step === "choose" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Elegí cómo querés recibir el código al iniciar sesión.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void start("totp")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5">
              <Smartphone className="h-5 w-5 text-[#204983]" />
              <span><strong className="block text-sm text-gray-800">Aplicación autenticadora</strong><small className="text-xs text-gray-500">Google Authenticator, Authy o similar</small></span>
            </button>
            <button type="button" onClick={() => void start("email")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5">
              <Mail className="h-5 w-5 text-[#204983]" />
              <span><strong className="block text-sm text-gray-800">Correo electrónico</strong><small className="text-xs text-gray-500">Te enviamos un código temporal</small></span>
            </button>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#204983] border-t-transparent" />
          Preparando la configuración...
        </div>
      )}

      {step === "failed" && (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">No pudimos preparar el enrolamiento</p>
              <p className="mt-1 whitespace-pre-line text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
          <button type="button" onClick={() => setStep("choose")} className={PRIMARY_BUTTON}>
            Reintentar
          </button>
        </div>
      )}

      {step === "scan" && setup && (
        <TwoFactorEnrollStep
          setup={setup}
          code={code}
          onCodeChange={(next) => {
            setCode(next)
            if (errorMessage) setErrorMessage(null)
          }}
          onComplete={(value) => void confirm(value)}
          isConfirming={isConfirming}
          errorMessage={errorMessage}
        />
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500">
          Tenés <span className="font-medium text-gray-700">{formatCountdown(secondsLeft)}</span> para terminar
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="flex items-center gap-1 text-sm text-gray-600 transition-colors duration-200 hover:text-gray-800 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancelar y volver
        </button>
      </div>
    </div>
  )
}

export default TwoFactorEnrollment
