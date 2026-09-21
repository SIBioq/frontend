"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
import { AlertCircle, ArrowLeft, Check, KeyRound, Mail, ShieldCheck, Smartphone, TimerReset } from "lucide-react"
import { CodeInput } from "@/components/ui/code-input"
import { formatCountdown, useExpiryCountdown } from "@/hooks/use-expiry-countdown"
import type { TwoFactorMethod } from "@/types"

export interface TwoFactorSubmitResult {
  ok: boolean
  message?: string
  /** El backend avisó que el `ephemeral_token` venció: hay que empezar de nuevo. */
  expired?: boolean
}

interface TwoFactorChallengeProps {
  username: string
  /** Segundos de vida que le quedaban al `ephemeral_token` cuando llegó. */
  expiresIn: number
  method?: TwoFactorMethod
  methods?: TwoFactorMethod[]
  onSubmit: (code: string, rememberDevice: boolean, method?: TwoFactorMethod) => Promise<TwoFactorSubmitResult>
  onSelectMethod: (method: TwoFactorMethod) => Promise<TwoFactorSubmitResult>
  /** Volver al formulario de usuario y contraseña. */
  onCancel: () => void
}

const CODE_LENGTH = 6

export function TwoFactorChallenge({ username, expiresIn, method = "totp", methods = [method], onSubmit, onSelectMethod, onCancel }: TwoFactorChallengeProps) {
  const availableMethods = Array.from(new Set(methods))
  const [selectedMethod, setSelectedMethod] = useState<TwoFactorMethod | null>(
    availableMethods.length === 1 ? availableMethods[0] : null,
  )
  const [code, setCode] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [useRecovery, setUseRecovery] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  // El código era el correcto. La pantalla se queda así —en verde y sin poder
  // tocar nada— mientras el panel se encoge hasta la navbar: la sesión ya está
  // abierta y volver a habilitar los campos sería ofrecer algo que ya no hace
  // falta. Ver `salirHaciaLaApp` en `login.tsx`.
  const [logrado, setLogrado] = useState(false)
  const { secondsLeft, expired, markExpired } = useExpiryCountdown(expiresIn)

  const isVerifyingRef = useRef(false)

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed || isVerifyingRef.current || expired) return

      isVerifyingRef.current = true
      setIsVerifying(true)
      setError(null)

      try {
        const result = await onSubmit(trimmed, rememberDevice, selectedMethod || undefined)
        if (result.ok) {
          setLogrado(true)
          return
        }

        if (result.expired) markExpired()
        setError(result.message || "No pudimos verificar el código.")
        // Limpiamos para que el próximo intento arranque de cero y el autoenvío
        // se pueda volver a disparar.
        setCode("")
        setRecoveryCode("")
      } finally {
        isVerifyingRef.current = false
        setIsVerifying(false)
      }
    },
    [expired, markExpired, onSubmit, rememberDevice, selectedMethod],
  )

  const selectMethod = async (nextMethod: TwoFactorMethod) => {
    if (isSelecting || expired) return
    setIsSelecting(true)
    setError(null)
    const result = await onSelectMethod(nextMethod)
    setIsSelecting(false)
    if (!result.ok) {
      if (result.expired) markExpired()
      setError(result.message || "No pudimos preparar ese método de verificación.")
      return
    }
    setSelectedMethod(nextMethod)
  }

  const handleRecoverySubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void submit(recoveryCode)
  }

  const switchMode = (toRecovery: boolean) => {
    setUseRecovery(toRecovery)
    setError(null)
    setCode("")
    setRecoveryCode("")
  }

  if (expired) {
    return (
      <div className="px-8 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <TimerReset className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Se venció la verificación</h1>
          <p className="text-sm text-gray-600">
            Por seguridad, el código de verificación sólo vale 5 minutos. Iniciá sesión de nuevo para pedir uno nuevo.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#204983] px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-[#1a3d6f] focus:outline-none focus:ring-2 focus:ring-[#204983] focus:ring-offset-2"
        >
          Volver a empezar
        </button>
      </div>
    )
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#204983]/10">
          <ShieldCheck className="h-6 w-6 text-[#204983]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">Verificación en dos pasos</h1>
        <p className="text-sm text-gray-600">
          {useRecovery ? (
            <>Ingresá uno de tus códigos de recuperación</>
          ) : (
            <>
              {selectedMethod === null
                ? <>Elegí cómo querés verificar la cuenta de <strong>{username}</strong></>
                : selectedMethod === "email"
                ? <>Escribí el código de 6 dígitos que enviamos al correo de <strong>{username}</strong></>
                : <>Abrí tu app de autenticación y escribí el código de 6 dígitos de <strong>{username}</strong></>}
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">No pudimos verificarte</p>
            <p className="mt-1 whitespace-pre-line text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!useRecovery && selectedMethod === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {availableMethods.includes("totp") && (
            <button type="button" disabled={isSelecting} onClick={() => void selectMethod("totp")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5 disabled:opacity-50">
              <Smartphone className="h-5 w-5 text-[#204983]" />
              <span><strong className="block text-sm text-gray-800">App autenticadora</strong><small className="text-xs text-gray-500">Usar el código del celular</small></span>
            </button>
          )}
          {availableMethods.includes("email") && (
            <button type="button" disabled={isSelecting} onClick={() => void selectMethod("email")} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-[#204983] hover:bg-[#204983]/5 disabled:opacity-50">
              <Mail className="h-5 w-5 text-[#204983]" />
              <span><strong className="block text-sm text-gray-800">Correo electrónico</strong><small className="text-xs text-gray-500">Enviar un código por email</small></span>
            </button>
          )}
          {isSelecting && <p className="col-span-full text-center text-sm text-gray-500">Preparando el método...</p>}
        </div>
      ) : useRecovery ? (
        <form onSubmit={handleRecoverySubmit} className="space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <KeyRound className="h-5 w-5 text-gray-600" />
            </div>
            <input
              type="text"
              value={recoveryCode}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setRecoveryCode(event.target.value)
                if (error) setError(null)
              }}
              placeholder="Código de recuperación"
              disabled={isVerifying || logrado}
              className={`w-full rounded-lg border bg-gray-100 py-3 pl-10 pr-4 font-mono tracking-wider text-gray-800 placeholder-gray-500 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 ${
                error ? "border-red-300 focus:ring-red-500" : "border-gray-300 focus:ring-[#204983]"
              }`}
            />
          </div>
          {/* El botón cuenta el resultado, igual que el de "Iniciar Sesión":
              verde con un tilde cuando el código era el correcto. */}
          <button
            type="submit"
            disabled={isVerifying || logrado || !recoveryCode.trim()}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
              logrado
                ? "bg-emerald-600 focus:ring-emerald-600"
                : "bg-[#204983] hover:bg-[#1a3d6f] focus:ring-[#204983] disabled:opacity-50"
            }`}
          >
            {logrado ? (
              <>
                <Check className="h-4 w-4" />
                <span>Listo</span>
              </>
            ) : isVerifying ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Verificar</span>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <CodeInput
            value={code}
            onChange={(next) => {
              setCode(next)
              if (error) setError(null)
            }}
            onComplete={(value) => void submit(value)}
            length={CODE_LENGTH}
            disabled={isVerifying || logrado}
            invalid={Boolean(error)}
            autoFocus
            aria-label="Código de verificación de 6 dígitos"
          />
          {/* El código de 6 dígitos no tiene botón —se manda solo al
              completarse—, así que el resultado lo cuenta este renglón. */}
          <div className="flex h-6 items-center justify-center text-sm text-gray-600">
            {logrado ? (
              <span className="flex items-center gap-2 font-medium text-emerald-600">
                <Check className="h-4 w-4" />
                Listo
              </span>
            ) : isVerifying ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#204983] border-t-transparent" />
                Verificando...
              </span>
            ) : (
              <span>Se envía solo al completar los 6 dígitos</span>
            )}
          </div>
        </div>
      )}

      <label className="mt-6 flex items-start gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={rememberDevice}
          onChange={(event) => setRememberDevice(event.target.checked)}
          disabled={isVerifying || logrado}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#204983] focus:ring-[#204983]"
        />
        <span>
          Confiar en este equipo por 8 horas.
          <span className="block text-xs text-gray-500">
            Vas a poder volver a entrar con usuario y contraseña sin el código hasta que venza. Desactivalo si la
            computadora no es de confianza.
          </span>
        </span>
      </label>

      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500">
          El código vence en <span className="font-medium text-gray-700">{formatCountdown(secondsLeft)}</span>
        </p>
        <button
          type="button"
          onClick={() => switchMode(!useRecovery)}
          disabled={isVerifying || logrado}
          className="text-sm text-[#204983] transition-colors duration-200 hover:underline disabled:opacity-50"
        >
          {useRecovery ? "Usar el código de la app" : "No tengo el celular: usar un código de recuperación"}
        </button>
        {!useRecovery && selectedMethod && availableMethods.length > 1 && (
          <button
            type="button"
            onClick={() => { setSelectedMethod(null); setCode(""); setError(null) }}
            disabled={isVerifying || logrado}
            className="text-sm text-[#204983] transition-colors hover:underline disabled:opacity-50"
          >
            Elegir otro método
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isVerifying || logrado}
          className="flex items-center gap-1 text-sm text-gray-600 transition-colors duration-200 hover:text-gray-800 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancelar y volver
        </button>
      </div>
    </div>
  )
}

export default TwoFactorChallenge
