"use client"

import { useEffect, useState } from "react"
import { Mail, MessageCircle, Send, User } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Label } from "../../../ui/label"

export type MetodoDeEnvio = "email" | "whatsapp"
type Destino = "paciente" | "otro"

interface EnviarInformeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metodo: MetodoDeEnvio | null
  protocolId: number
  patientName: string
  /** El email o el teléfono que el paciente tiene cargado, según el método. */
  datoDelPaciente?: string
  tipoDeInforme: "full" | "summary"
  /** `null` si va a los datos del paciente; si no, el email o el número elegido. */
  onConfirm: (otroDestino: string | null) => void
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Lo mismo que pide el backend: un email con forma de email, o un número de 8 a 15 dígitos. */
function esUnDestinoValido(metodo: MetodoDeEnvio, valor: string) {
  if (metodo === "email") return EMAIL_VALIDO.test(valor)
  const digitos = valor.replace(/\D/g, "").length
  return digitos >= 8 && digitos <= 15
}

/**
 * Adónde sale el informe por mail o por WhatsApp.
 *
 * Antes este paso mostraba el PDF embebido y mandaba siempre a los datos del
 * paciente. Ahora pregunta lo que de verdad cambia de un envío a otro: si va al
 * paciente o a otro destino —el médico, un familiar—, igual que la facturación
 * a ARCA pregunta si se le factura al paciente o a un tercero. El PDF se sigue
 * pudiendo mirar con la vista previa del diálogo de reporte.
 *
 * Un destino distinto al del paciente queda registrado: el backend lo anota en
 * la auditoría y, si es WhatsApp, en el chat del protocolo.
 */
export function EnviarInformeDialog({
  open,
  onOpenChange,
  metodo,
  protocolId,
  patientName,
  datoDelPaciente,
  tipoDeInforme,
  onConfirm,
}: EnviarInformeDialogProps) {
  const [destino, setDestino] = useState<Destino>("paciente")
  const [otroDestino, setOtroDestino] = useState("")
  const tieneDato = Boolean(datoDelPaciente)

  useEffect(() => {
    if (open) {
      // Sin email o teléfono cargado, lo único que se puede es otro destino.
      setDestino(datoDelPaciente ? "paciente" : "otro")
      setOtroDestino("")
    }
  }, [open, datoDelPaciente])

  if (!metodo) return null

  const esEmail = metodo === "email"
  const Icono = esEmail ? Mail : MessageCircle
  const colorDelIcono = esEmail ? "text-[#204983]" : "text-emerald-600"
  const elegido = esEmail ? "border-[#204983] bg-sky-50" : "border-emerald-500 bg-emerald-50"
  const valor = otroDestino.trim()
  const valido = destino === "paciente" ? tieneDato : esUnDestinoValido(metodo, valor)
  const mostrarError = destino === "otro" && valor.length > 0 && !valido

  const confirmar = () => {
    if (!valido) return
    onConfirm(destino === "otro" ? valor : null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[560px] max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icono className={`h-5 w-5 ${colorDelIcono}`} />
            Enviar por {esEmail ? "email" : "WhatsApp"} — Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Se envía el {tipoDeInforme === "summary" ? "resumen" : "informe completo"}. Elegí a dónde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>¿A dónde lo enviás?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!tieneDato}
                onClick={() => setDestino("paciente")}
                className={`rounded-md border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  destino === "paciente" ? elegido : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <User className={`h-4 w-4 ${colorDelIcono}`} />
                  <span className="text-sm font-semibold">A los datos del paciente</span>
                </div>
                <p className="truncate text-xs text-gray-600">
                  {tieneDato
                    ? `${patientName} · ${datoDelPaciente}`
                    : `El paciente no tiene ${esEmail ? "email" : "teléfono"} cargado`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDestino("otro")}
                className={`rounded-md border p-3 text-left transition ${
                  destino === "otro" ? elegido : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Send className={`h-4 w-4 ${colorDelIcono}`} />
                  <span className="text-sm font-semibold">{esEmail ? "A otro email" : "A otro número"}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {esEmail ? "Queda registrado en la auditoría" : "Queda en la auditoría y en el chat"}
                </p>
              </button>
            </div>
          </div>

          {destino === "otro" && (
            <div className="space-y-1">
              <Label htmlFor="otro-destino">{esEmail ? "Email" : "Número de WhatsApp"}</Label>
              <Input
                id="otro-destino"
                type={esEmail ? "email" : "tel"}
                inputMode={esEmail ? "email" : "tel"}
                autoFocus
                value={otroDestino}
                onChange={(e) => setOtroDestino(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    confirmar()
                  }
                }}
                placeholder={esEmail ? "medico@ejemplo.com" : "3472 645229"}
                aria-invalid={mostrarError}
              />
              {mostrarError && (
                <p className="text-xs text-red-600">
                  {esEmail
                    ? "Revisá el email: no tiene forma de email."
                    : "Revisá el número: tiene que tener entre 8 y 15 dígitos."}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!valido}
            className={esEmail ? "bg-[#204983] hover:bg-[#1a3d6f]" : "bg-emerald-600 hover:bg-emerald-700"}
          >
            <Icono className="mr-2 h-4 w-4" /> Enviar por {esEmail ? "email" : "WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
