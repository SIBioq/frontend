"use client"

import { Copy, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeInput } from "@/components/ui/code-input"
import { QrCode } from "@/components/ui/qr-code"
import { useToast } from "@/hooks/use-toast"
import { copyToClipboard } from "@/lib/clipboard"
import type { TwoFactorSetupResponse } from "@/types"

interface TwoFactorEnrollStepProps {
  setup: TwoFactorSetupResponse
  code: string
  onCodeChange: (value: string) => void
  onComplete: (value: string) => void
  isConfirming: boolean
  errorMessage: string | null
}

/** El secreto en grupos de 4 se tipea mucho mejor a mano. */
const groupSecret = (secret: string): string => (secret.match(/.{1,4}/g) || [secret]).join(" ")

/**
 * Paso de alta del segundo factor: QR + secreto en texto + código de 6 dígitos.
 *
 * Está acá y no dentro del diálogo del perfil porque el mismo paso se muestra
 * en dos lugares muy distintos: el perfil (alta voluntaria, ya con sesión) y el
 * login (alta obligatoria, todavía sin sesión). Lo único que cambia entre los
 * dos es quién dispara las requests, así que el componente sólo pinta y avisa.
 */
export function TwoFactorEnrollStep({
  setup,
  code,
  onCodeChange,
  onComplete,
  isConfirming,
  errorMessage,
}: TwoFactorEnrollStepProps) {
  const { success, error: errorToast } = useToast()

  if (setup.method === "email") {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Enviamos un código de 6 dígitos a <strong>{setup.email || "tu correo electrónico"}</strong>. Es válido por unos minutos y se usa una sola vez.
        </div>
        <CodeInput
          value={code}
          onChange={onCodeChange}
          onComplete={onComplete}
          disabled={isConfirming}
          invalid={Boolean(errorMessage)}
          autoFocus
        />
        <div className="flex h-5 items-center justify-center text-xs text-gray-500">
          {isConfirming ? "Verificando..." : "Se envía solo al completar los 6 dígitos"}
        </div>
        {errorMessage && <p className="whitespace-pre-line text-center text-sm text-red-600">{errorMessage}</p>}
      </div>
    )
  }

  const handleCopySecret = async () => {
    const ok = await copyToClipboard(setup.secret)
    if (ok) success("Clave copiada")
    else errorToast("No se pudo copiar", { description: "Copiala a mano desde la pantalla." })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-col items-center gap-3">
        <QrCode value={setup.otpauth_uri} title="Código QR para la app de autenticación" />
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Smartphone className="h-3.5 w-3.5" />
          Google Authenticator, Authy, 1Password o similar
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">¿No podés escanear? Cargá esta clave a mano:</p>
        <div className="mt-2 flex items-center gap-2">
          {/* `break-words` y no `break-all`: corta entre grupos de 4 en vez de
              dejar una letra huérfana en la última línea. */}
          <code className="flex-1 break-words font-mono text-sm tracking-wider text-gray-800">
            {groupSecret(setup.secret)}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopySecret()}>
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-center text-sm text-gray-700">Escribí el código de 6 dígitos que muestra la app</p>
        <CodeInput
          value={code}
          onChange={onCodeChange}
          onComplete={onComplete}
          disabled={isConfirming}
          invalid={Boolean(errorMessage)}
          autoFocus
        />
        <div className="flex h-5 items-center justify-center text-xs text-gray-500">
          {isConfirming ? "Verificando..." : "Se envía solo al completar los 6 dígitos"}
        </div>
        {errorMessage && <p className="whitespace-pre-line text-center text-sm text-red-600">{errorMessage}</p>}
      </div>
    </div>
  )
}

export default TwoFactorEnrollStep
