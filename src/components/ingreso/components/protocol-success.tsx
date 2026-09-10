"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, X, User, FileText, Stethoscope, Building, Send, DollarSign, TestTube, ClipboardCheck, Undo2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { menosMovimiento } from "@/lib/menos-movimiento"
import { Button } from "../../ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../ui/card"
import { Badge } from "../../ui/badge"
import { Separator } from "../../ui/separator"
import type { Patient, Doctor, Insurance, SendMethod, Protocol } from "../../../types"
import { getPaymentStatusInfo } from "@/lib/status-styles"
import { getTrajoOrdenInfo } from "@/lib/protocol-order"

interface ProtocolSuccessProps {
  protocol: Protocol
  patient: Patient
  doctor: Doctor
  insurance: Insurance | null
  sendMethod: SendMethod
  onClose: () => void
  /** Deshace (rollback) el protocolo recién creado y devuelve los datos al form. */
  onRollback?: () => void
  isRollingBack?: boolean
  /**
   * Desde dónde crece el verde, en coordenadas de la ventana.
   *
   * Es el centro del botón «Crear Protocolo», que un instante antes terminó de
   * llenarse y se puso verde. El verde de acá es la continuación de ESE verde:
   * si creciera desde el medio de la pantalla se leería como otra cosa que
   * aparece encima, y no como el botón que se sigue expandiendo.
   *
   * Sin origen crece desde el centro, que es como salía antes.
   */
  origen?: { x: number; y: number } | null
}

export function ProtocolSuccess({ protocol, patient, doctor, insurance, sendMethod, onClose, onRollback, isRollingBack, origen }: ProtocolSuccessProps) {
  const sinMovimiento = useMemo(() => menosMovimiento(), [])
  const [animationPhase, setAnimationPhase] = useState<"initial" | "expand" | "moveUp" | "showSummary">(
    sinMovimiento ? "showSummary" : "initial",
  )

  /**
   * El círculo verde y desde dónde se abre.
   *
   * El diámetro es dos veces la distancia del origen a la esquina más lejana:
   * es lo mínimo que garantiza que, apretando el botón donde sea, el verde
   * termine tapando la pantalla entera. Un valor fijo dejaría una esquina sin
   * pintar en las pantallas anchas del laboratorio.
   */
  const revelado = useMemo(() => {
    const ancho = typeof window === "undefined" ? 0 : window.innerWidth
    const alto = typeof window === "undefined" ? 0 : window.innerHeight
    const centro = origen ?? { x: ancho / 2, y: alto / 2 }
    const esquinas = [
      Math.hypot(centro.x, centro.y),
      Math.hypot(ancho - centro.x, centro.y),
      Math.hypot(centro.x, alto - centro.y),
      Math.hypot(ancho - centro.x, alto - centro.y),
    ]
    return { centro, diametro: Math.max(...esquinas) * 2 }
  }, [origen])
  const trajoOrdenInfo = getTrajoOrdenInfo(protocol.trajo_orden)

  const toNumber = (...values: Array<string | number | undefined | null>) => {
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue
      const parsed = typeof value === "number" ? value : Number.parseFloat(value)
      if (!Number.isNaN(parsed)) return parsed
    }
    return 0
  }

  const totalUbAuthorized = toNumber(
    protocol.details?.filter((detail) => detail.is_authorized).reduce((acc, detail) => acc + toNumber(detail.ub), 0),
  )

  const totalUbPrivate = toNumber(
    protocol.details?.filter((detail) => !detail.is_authorized).reduce((acc, detail) => acc + toNumber(detail.ub), 0),
  )

  const patientPaid = toNumber(protocol.patient_paid, protocol.value_paid)
  const paymentStatusInfo = getPaymentStatusInfo(protocol.payment_status)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    // Bloquear el scroll del body mientras el overlay está a pantalla completa,
    // así no aparece barra vertical ni horizontal detrás.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Con menos movimiento el resumen ya arrancó puesto: no hay nada que animar.
    const timer1 = sinMovimiento ? undefined : setTimeout(() => setAnimationPhase("expand"), 30)
    const timer2 = sinMovimiento ? undefined : setTimeout(() => setAnimationPhase("moveUp"), 560)
    const timer3 = sinMovimiento ? undefined : setTimeout(() => setAnimationPhase("showSummary"), 780)
    // Si se puede deshacer, NO autocerramos: el usuario tiene que tener tiempo
    // de decidir si deshace el protocolo. Sin rollback, se mantiene el cierre
    // automático de siempre.
    const closeTimer = onRollback ? undefined : setTimeout(() => onClose(), 10000)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = prevOverflow
      if (timer1) clearTimeout(timer1)
      if (timer2) clearTimeout(timer2)
      if (timer3) clearTimeout(timer3)
      if (closeTimer) clearTimeout(closeTimer)
    }
  }, [onClose, handleKeyDown, onRollback, sinMovimiento])

  const overlay = (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* El verde sale del botón y se come la pantalla.
          Se anima `transform` y no `width`/`height`: escalar lo resuelve la
          GPU, redimensionar obliga a recalcular layout en cada cuadro y la
          animación se entrecorta justo en las máquinas del mostrador. */}
      <div
        className={cn(
          "absolute rounded-full bg-green-500",
          !sinMovimiento && "transition-transform duration-700 ease-out",
        )}
        style={{
          left: revelado.centro.x,
          top: revelado.centro.y,
          width: revelado.diametro,
          height: revelado.diametro,
          marginLeft: -revelado.diametro / 2,
          marginTop: -revelado.diametro / 2,
          transform: animationPhase === "initial" ? "scale(0)" : "scale(1)",
        }}
      />

      {/* Botón cerrar */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className={cn(
          "absolute right-4 top-4 z-20 h-10 w-10 text-white transition-opacity duration-500 hover:bg-white/20",
          animationPhase === "initial" ? "opacity-0" : "opacity-100",
        )}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Columna centrada, SIN scroll propio (así no hay barra en la parte verde) */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-4">
          {/* Tick: centrado al inicio; sube cuando el resumen crece */}
          <div
            className={cn(
              "shrink-0 transition-all duration-300 ease-out",
              animationPhase === "initial" ? "scale-0 opacity-0" : "scale-100 opacity-100",
            )}
          >
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 shadow-2xl backdrop-blur-sm">
                <CheckIcon className="text-white" size={48} strokeWidth={3} />
              </div>
              {animationPhase === "expand" && (
                <div className="absolute inset-0 h-24 w-24 rounded-full bg-white/30 animate-ping" />
              )}
            </div>
          </div>

          <div
            className={cn(
              "w-full max-w-2xl overflow-hidden transition-all duration-500 ease-out",
              animationPhase === "showSummary" ? "max-h-[calc(100dvh-8rem)] opacity-100" : "pointer-events-none max-h-0 opacity-0",
            )}
          >
            {/* Card redondeada + overflow-hidden: el scroll vive en el contenido,
                asi el borde no queda cuadrado al aparecer la barra. */}
            <Card className="flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border-0 bg-white shadow-2xl">
            <CardHeader className="shrink-0 pb-4">
              <CardTitle className="text-center text-green-600 text-2xl flex items-center justify-center gap-2">
                <FileText className="h-6 w-6" />
                Protocolo Creado Exitosamente
              </CardTitle>
            </CardHeader>
            {/* `min-h-0` NO es decorativo: sin él esto no scrollea.
                En una columna flex, un hijo arranca con `min-height: auto` y no
                se encoge por debajo de su contenido. El `overflow-y-auto` queda
                de adorno, la Card recorta con su `overflow-hidden`, y todo lo
                que caiga abajo del corte deja de existir para el usuario. Fue
                exactamente lo que le pasó al botón de deshacer con protocolos
                de varios análisis. */}
            <CardContent className="min-h-0 space-y-4 overflow-y-auto">
              {/* Protocol ID */}
              <div className="text-center pb-2">
                <Badge
                  variant="outline"
                  className="text-lg px-4 py-2 font-mono bg-green-50 border-green-200 text-green-700"
                >
                  Protocolo N° {protocol.id}
                </Badge>
              </div>

              <Separator />

              {/* Patient info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="font-semibold">Paciente:</span>
                </div>
                <div className="pl-6 text-gray-800">
                  <div className="font-medium text-lg">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-sm text-gray-600">DNI: {patient.dni}</div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Building className="h-4 w-4" />
                    <span>Obra Social:</span>
                  </div>
                  <div className="pl-6 font-medium text-gray-800">{insurance?.name || protocol.insurance?.name || "Particular"}</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Stethoscope className="h-4 w-4" />
                    <span>Médico:</span>
                  </div>
                  <div className="pl-6 font-medium text-gray-800">
                    {doctor.first_name} {doctor.last_name}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Send className="h-4 w-4" />
                    <span>Método de envío:</span>
                  </div>
                  <div className="pl-6 font-medium text-gray-800">{sendMethod.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <ClipboardCheck className={`h-4 w-4 ${trajoOrdenInfo.iconClassName}`} />
                <span className="text-gray-600">Orden médica:</span>
                <Badge
                  variant="outline"
                  className={trajoOrdenInfo.badgeClassName}
                >
                  {trajoOrdenInfo.label}
                </Badge>
              </div>

              <Separator />

              {/* Payment summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-semibold">Resumen de Pago:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-6">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Total UB Autorizado</div>
                    <div className="font-medium text-gray-800">{totalUbAuthorized.toFixed(2)} UB</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Total UB Particular</div>
                    <div className="font-medium text-gray-800">{totalUbPrivate.toFixed(2)} UB</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Monto Pagado</div>
                    <div className="font-medium text-emerald-600">${patientPaid.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Estado de Pago</div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${paymentStatusInfo.badge}`}
                    >
                      {paymentStatusInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Analyses */}
              {protocol.details && protocol.details.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <TestTube className="h-4 w-4" />
                    <span className="font-semibold">Análisis Solicitados ({protocol.details.length}):</span>
                  </div>
                  <div className="pl-6 flex flex-wrap gap-2">
                    {protocol.details.slice(0, 8).map((detail) => (
                      <Badge 
                        key={detail.id} 
                        variant="outline" 
                        className={`text-xs ${
                          detail.is_authorized 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        {detail.name}
                      </Badge>
                    ))}
                    {protocol.details.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{protocol.details.length - 8} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

            </CardContent>

            {/* FUERA del área que scrollea, y `shrink-0`.
                Deshacer es una decisión con tiempo contado —el protocolo ya
                existe— así que el botón no puede depender de que alguien
                descubra que hay que scrollear una lista de análisis. */}
            <CardFooter className="shrink-0 flex-col items-stretch gap-2 border-t bg-white pt-4">
              {onRollback ? (
                <>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onRollback}
                      disabled={isRollingBack}
                      className="border-red-200 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {isRollingBack ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Undo2 className="mr-2 h-4 w-4" />
                      )}
                      Deshacer y modificar
                    </Button>
                    <Button
                      type="button"
                      onClick={onClose}
                      disabled={isRollingBack}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      <CheckIcon className="mr-2 h-4 w-4" />
                      Listo
                    </Button>
                  </div>
                  <p className="text-center text-xs text-gray-500">
                    "Deshacer" borra este protocolo y te devuelve los datos para corregirlos.
                  </p>
                </>
              ) : (
                <p className="text-center text-sm text-gray-500">
                  Presione <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">ESC</kbd> o la X para cerrar
                </p>
              )}
            </CardFooter>
          </Card>
          </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
