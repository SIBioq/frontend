"use client"

import { useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { copyToClipboard, downloadTextFile } from "@/lib/clipboard"

interface TwoFactorRecoveryCodesProps {
  codes: string[]
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
}

/**
 * Los códigos de recuperación, con copiar/descargar y la confirmación de que se
 * guardaron. Quien lo usa es el que bloquea el cierre mientras `acknowledged`
 * sea false: acá sólo se informa el estado del tilde.
 *
 * Compartido entre el alta del perfil y el enrolamiento obligatorio del login,
 * porque el riesgo es idéntico en los dos: los códigos se muestran UNA vez y
 * cerrar de más los pierde para siempre.
 */
export function TwoFactorRecoveryCodes({ codes, acknowledged, onAcknowledgedChange }: TwoFactorRecoveryCodesProps) {
  const { success, error: errorToast } = useToast()
  const [copied, setCopied] = useState(false)

  const codesAsText = codes.join("\n")

  const handleCopy = async () => {
    const ok = await copyToClipboard(codesAsText)
    setCopied(ok)
    if (ok) success("Códigos copiados")
    else errorToast("No se pudo copiar", { description: "Descargalos o anotalos a mano." })
  }

  const handleDownload = () => {
    const header = [
      "Labsalud - Códigos de recuperación del segundo factor",
      `Generados: ${new Date().toLocaleString("es-AR")}`,
      "Cada código se usa una sola vez. Guardalos en un lugar seguro.",
      "",
    ].join("\n")
    downloadTextFile("labsalud-codigos-recuperacion.txt", `${header}${codesAsText}\n`)
    setCopied(true)
  }

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Si perdés el celular, estos códigos son la única forma de entrar. Cada uno sirve una sola vez y{" "}
        <strong>no se van a volver a mostrar</strong>.
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg min-[360px]:grid-cols-2 border border-gray-200 bg-gray-50 p-3">
        {codes.map((recoveryCode) => (
          <code key={recoveryCode} className="break-all font-mono text-sm tracking-wider text-gray-800">
            {recoveryCode}
          </code>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => void handleCopy()} className="flex-1">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copiar
        </Button>
        <Button type="button" variant="outline" onClick={handleDownload} className="flex-1">
          <Download className="h-4 w-4" />
          Descargar .txt
        </Button>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgedChange(checked === true)}
          className="mt-0.5"
        />
        <span>Ya guardé mis códigos en un lugar seguro</span>
      </label>
    </div>
  )
}

export default TwoFactorRecoveryCodes
