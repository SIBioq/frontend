"use client"

import { useEffect, useState } from "react"
import { Mail, MessageCircle, Phone, PhoneForwarded, Send, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
type Eleccion = "principal" | "alternativo" | "otro"

interface EnviarInformeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metodo: MetodoDeEnvio | null
  protocolId: number
  patientName: string
  /**
   * Lo que el paciente tiene cargado. `""` es que no lo tiene; `undefined`, que
   * el detalle no lo trajo y no se sabe —y entonces el principal no se bloquea:
   * el backend manda a lo que el paciente tenga cargado—.
   */
  email?: string
  telefono?: string
  telefonoAlternativo?: string
  tipoDeInforme: "full" | "summary"
  /** `null` si va al dato principal del paciente; si no, el email o el número elegido. */
  onConfirm: (destino: string | null) => void
}

type OpcionDelPaciente = {
  eleccion: "principal" | "alternativo"
  titulo: string
  dato: string | undefined
  icono: LucideIcon
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Lo mismo que pide el backend: un email con forma de email, o un número de 8 a 15 dígitos. */
function esUnDestinoValido(metodo: MetodoDeEnvio, valor: string) {
  if (metodo === "email") return EMAIL_VALIDO.test(valor)
  const digitos = valor.replace(/\D/g, "").length
  return digitos >= 8 && digitos <= 15
}

/**
 * El principal se bloquea sólo si se sabe que está vacío: si no se sabe, el
 * backend manda a lo que haya. El alternativo necesita un número concreto,
 * porque es el que se le pasa al backend.
 */
function sePuede(opcion: OpcionDelPaciente) {
  return opcion.eleccion === "principal" ? opcion.dato !== "" : Boolean(opcion.dato)
}

/**
 * Adónde sale el informe por mail o por WhatsApp.
 *
 * Antes este paso mostraba el PDF embebido y mandaba siempre a los datos del
 * paciente. Ahora pregunta lo que de verdad cambia de un envío a otro, igual
 * que la facturación a ARCA pregunta si se le factura al paciente o a un
 * tercero: por mail, al email del paciente o a otro; por WhatsApp, a su
 * teléfono principal, a su alternativo o a otro número. El PDF se sigue
 * pudiendo mirar con la vista previa del diálogo de reporte.
 *
 * Un destino que no es del paciente queda registrado: el backend lo anota en
 * la auditoría y, si es WhatsApp, en el chat del protocolo. El alternativo es
 * del paciente, así que no cuenta como otro.
 */
export function EnviarInformeDialog({
  open,
  onOpenChange,
  metodo,
  protocolId,
  patientName,
  email,
  telefono,
  telefonoAlternativo,
  tipoDeInforme,
  onConfirm,
}: EnviarInformeDialogProps) {
  const [eleccion, setEleccion] = useState<Eleccion>("principal")
  const [otroDestino, setOtroDestino] = useState("")

  const esEmail = metodo === "email"
  const opciones: OpcionDelPaciente[] = esEmail
    ? [{ eleccion: "principal", titulo: "Email del paciente", dato: email, icono: User }]
    : [
        { eleccion: "principal", titulo: "Teléfono principal", dato: telefono, icono: Phone },
        { eleccion: "alternativo", titulo: "Teléfono alternativo", dato: telefonoAlternativo, icono: PhoneForwarded },
      ]
  // Sin nada del paciente para mandarle, arranca en otro destino.
  const primeraDisponible: Eleccion = opciones.find(sePuede)?.eleccion ?? "otro"

  useEffect(() => {
    if (open) {
      setEleccion(primeraDisponible)
      setOtroDestino("")
    }
  }, [open, primeraDisponible])

  if (!metodo) return null

  const Icono = esEmail ? Mail : MessageCircle
  const colorDelIcono = esEmail ? "text-[#204983]" : "text-emerald-600"
  const elegido = esEmail ? "border-[#204983] bg-sky-50" : "border-emerald-500 bg-emerald-50"
  const valor = otroDestino.trim()
  const opcionElegida = opciones.find((opcion) => opcion.eleccion === eleccion)
  const valido =
    eleccion === "otro" ? esUnDestinoValido(metodo, valor) : Boolean(opcionElegida && sePuede(opcionElegida))
  const mostrarError = eleccion === "otro" && valor.length > 0 && !valido

  const textoDelDato = (opcion: OpcionDelPaciente) => {
    if (opcion.dato) return opcion.dato
    if (opcion.dato === undefined && opcion.eleccion === "principal") {
      return esEmail ? "El email que tiene cargado" : "El teléfono que tiene cargado"
    }
    return esEmail ? "No tiene email cargado" : "No tiene este teléfono cargado"
  }

  const confirmar = () => {
    if (!valido) return
    if (eleccion === "otro") onConfirm(valor)
    else if (eleccion === "alternativo") onConfirm(telefonoAlternativo ?? null)
    else onConfirm(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[560px] max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icono className={`h-5 w-5 shrink-0 ${colorDelIcono}`} />
            Enviar por {esEmail ? "email" : "WhatsApp"} — Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Se envía el {tipoDeInforme === "summary" ? "resumen" : "informe completo"}. Elegí a dónde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>¿A dónde lo enviás?</Label>
            <div className="grid grid-cols-1 gap-2">
              {opciones.map((opcion) => {
                const IconoDeLaOpcion = opcion.icono
                return (
                  <button
                    key={opcion.eleccion}
                    type="button"
                    disabled={!sePuede(opcion)}
                    onClick={() => setEleccion(opcion.eleccion)}
                    className={`rounded-md border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      eleccion === opcion.eleccion ? elegido : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <IconoDeLaOpcion className={`h-4 w-4 shrink-0 ${colorDelIcono}`} />
                      <span className="text-sm font-semibold">{opcion.titulo}</span>
                    </div>
                    {/* Completo y sin cortar: si no entra en un renglón, baja
                        al siguiente. Un texto recortado se lee con el hover, y
                        en el celular no hay hover. */}
                    <p className="break-words text-xs text-gray-600">{patientName}</p>
                    <p className="break-all text-sm font-medium text-gray-800">{textoDelDato(opcion)}</p>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setEleccion("otro")}
                className={`rounded-md border p-3 text-left transition ${
                  eleccion === "otro" ? elegido : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Send className={`h-4 w-4 shrink-0 ${colorDelIcono}`} />
                  <span className="text-sm font-semibold">{esEmail ? "A otro email" : "A otro número"}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {esEmail ? "Queda registrado en la auditoría" : "Queda en la auditoría y en el chat"}
                </p>
              </button>
            </div>
          </div>

          {eleccion === "otro" && (
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
