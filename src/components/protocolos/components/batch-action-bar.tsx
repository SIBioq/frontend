"use client"

import { useEffect, useRef, useState } from "react"
import { Printer, Download, Mail, MessageCircle, GitMerge, Loader2, PenLine, X, Lock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ENTRADA_ABAJO } from "@/lib/entrada"
import { getActionColor } from "@/lib/status-styles"
import type { ReportSignature } from "@/types"
import { ActionButton } from "./boton-de-accion-del-informe"

type BatchAction = "print" | "download" | "email" | "whatsapp"

/** Lo que la barra queda despegada del borde de abajo (`bottom-4`), en px. */
const SEPARACION_DEL_BORDE = 16

interface BatchActionBarProps {
  selectedCount: number
  reportType: "full" | "summary"
  onReportTypeChange: (type: "full" | "summary") => void
  signed: boolean
  onSignedChange: (signed: boolean) => void
  signatureId: string
  onSignatureIdChange: (id: string) => void
  signatures: ReportSignature[]
  date: string
  onDateChange: (date: string) => void
  /** El horario del informe, `HH:MM`. Vacío: el del protocolo. */
  time: string
  onTimeChange: (time: string) => void
  isProcessing: boolean
  /**
   * Motivo por el que TODAS las acciones de reporte están bloqueadas (falta el
   * permiso `gestionar_impresiones`). Si viene, la barra se sigue mostrando
   * pero con los botones deshabilitados y el aviso a la vista.
   */
  disabledReason?: string
  onSelectAll: () => void
  onDeselectAll: () => void
  /** Mirar el PDF del lote sin sacarlo: no marca nada. */
  onPreview: () => void
  onBatch: (action: BatchAction) => void
  onMerge: (action: "print" | BatchAction) => void
}

/**
 * Barra flotante centrada para acciones en lote sobre los protocolos
 * seleccionados (reportes / envío / unificación). Presentacional: recibe todo
 * por props desde la página.
 *
 * LAS MISMAS ACCIONES QUE EL INFORME DE UN PROTOCOLO
 * ==================================================
 * Los botones son los del diálogo de reportes —solo el ícono, el nombre en el
 * tooltip, el mismo color y el mismo hover— y en el mismo orden: primero mirar,
 * después sacar. También tiene el horario además de la fecha. Eran botones con
 * texto y otros colores: las mismas cinco cosas, aprendidas dos veces.
 *
 * LA BARRA SE HACE SU PROPIO LUGAR
 * ================================
 * Flota fija abajo, así que tapaba las últimas filas de la lista: se
 * seleccionaba un protocolo, aparecía la barra, y el de más abajo dejaba de
 * poder clickearse. El click iba a la barra, no a la fila — y desde la fila no
 * hay forma de saberlo.
 *
 * Por eso deja un hueco en el flujo con SU alto medido, y no con un número
 * puesto a mano: la barra envuelve en pantallas chicas y crece cuando se elige
 * firma, así que su alto cambia mientras se la usa.
 */
export function BatchActionBar({
  selectedCount,
  reportType,
  onReportTypeChange,
  signed,
  onSignedChange,
  signatureId,
  onSignatureIdChange,
  signatures,
  date,
  onDateChange,
  time,
  onTimeChange,
  isProcessing,
  disabledReason,
  onSelectAll,
  onDeselectAll,
  onPreview,
  onBatch,
  onMerge,
}: BatchActionBarProps) {
  const defaultSignature = signatures.find((s) => s.is_default)
  const blocked = Boolean(disabledReason)
  // Cuál se apretó: la ruedita va en ese botón y no en los cinco.
  const [accionEnCurso, setAccionEnCurso] = useState<BatchAction | "preview" | null>(null)

  const barraRef = useRef<HTMLDivElement>(null)
  const [altoDeLaBarra, setAltoDeLaBarra] = useState(0)
  // En el celular los botones llevan el nombre abajo: sin mouse, el tooltip
  // que dice qué hace cada ícono no aparece nunca.
  const [esCelular, setEsCelular] = useState(false)
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)")
    const aplicar = () => setEsCelular(consulta.matches)
    aplicar()
    consulta.addEventListener("change", aplicar)
    return () => consulta.removeEventListener("change", aplicar)
  }, [])

  useEffect(() => {
    const nodo = barraRef.current
    if (!nodo) return
    const medir = () => setAltoDeLaBarra(nodo.getBoundingClientRect().height)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    window.addEventListener("resize", medir)
    return () => {
      observador.disconnect()
      window.removeEventListener("resize", medir)
    }
  }, [])

  // Por qué no se puede, para el tooltip del botón apagado.
  const motivo =
    disabledReason ||
    (selectedCount === 0
      ? "Seleccioná al menos un protocolo."
      : isProcessing
        ? "Hay otra acción de reporte en proceso."
        : undefined)

  const ejecutar = (accion: BatchAction | "preview") => {
    setAccionEnCurso(accion)
    if (accion === "preview") onPreview()
    else onBatch(accion)
  }
  const cargando = (accion: BatchAction | "preview") => isProcessing && accionEnCurso === accion

  return (
    <>
      {/* El hueco: el alto de la barra, más lo que la despega del borde. */}
      <div aria-hidden style={{ height: altoDeLaBarra + SEPARACION_DEL_BORDE * 2 }} />
      {/* El contenedor ocupa el ancho entero para centrar la barra, pero no
          recibe clicks: a los costados de una barra de 3xl hay pantalla libre,
          y ahí abajo hay filas de la lista. */}
      <div className={cn(ENTRADA_ABAJO, "pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3")}>
        <div
          ref={barraRef}
          className="pointer-events-auto max-h-[70vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm"
        >
          {/* Opciones (centradas) */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-[#204983] px-2.5 py-1 text-xs font-semibold text-white">{selectedCount} sel.</span>
            <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-8 text-xs">
              Todos
            </Button>
            <Button variant="ghost" size="sm" onClick={onDeselectAll} className="h-8 text-xs">
              Ninguno
            </Button>

            <Select value={reportType} onValueChange={(v) => onReportTypeChange(v as "full" | "summary")}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Reporte completo</SelectItem>
                <SelectItem value="summary">Resumen</SelectItem>
              </SelectContent>
            </Select>

            {/* Fecha y horario del informe, opcionales: los mismos dos campos
                que el informe de un protocolo. Se limpian juntos. */}
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-9 w-[150px]"
                title="Fecha del reporte (opcional)"
                aria-label="Fecha del reporte"
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => onTimeChange(e.target.value)}
                step={60}
                className="h-9 w-[110px]"
                title="Horario del reporte (opcional)"
                aria-label="Horario del reporte"
              />
              {(date || time) && (
                <button
                  type="button"
                  onClick={() => {
                    onDateChange("")
                    onTimeChange("")
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Limpiar fecha y hora"
                  aria-label="Limpiar fecha y hora"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSignedChange(!signed)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors sm:text-sm",
                signed ? "border-[#204983] bg-blue-50 text-[#204983]" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
              )}
            >
              <PenLine className="h-4 w-4 shrink-0" />
              {signed ? "Firma digital" : "Sin firma"}
            </button>

            {signed && (
              <Select value={signatureId} onValueChange={onSignatureIdChange}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Firma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {defaultSignature ? `${defaultSignature.name} (predeterminada)` : "Predeterminada del sistema"}
                  </SelectItem>
                  {signatures
                    .filter((s) => !s.is_default)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Acciones (centradas) */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 border-t border-gray-100 pt-2.5">
            {blocked && (
              <p className="flex w-full items-center justify-center gap-1.5 text-center text-xs font-medium text-slate-600">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {disabledReason}
              </p>
            )}
            {/* Primero mirar, después sacar. La vista previa no marca nada:
                ni los análisis como enviados ni los protocolos como impresos. */}
            <ActionButton
              onClick={() => ejecutar("preview")}
              disabled={Boolean(motivo)}
              disabledReason={motivo}
              isLoading={cargando("preview")}
              loadingLabel="Abriendo..."
              icon={<Eye className="h-5 w-5" />}
              label="Ver vista previa"
              etiqueta={esCelular ? "Vista previa" : undefined}
              description="Solo para mirarlo: no los marca como enviados ni impresos"
              colorClass="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            />
            <ActionButton
              onClick={() => ejecutar("print")}
              disabled={Boolean(motivo)}
              disabledReason={motivo}
              isLoading={cargando("print")}
              loadingLabel="Imprimiendo..."
              icon={<Printer className="h-5 w-5" />}
              label="Imprimir"
              etiqueta={esCelular ? "Imprimir" : undefined}
              description="Todos los seleccionados en un PDF, para imprimir"
              colorClass={getActionColor("print", null)}
            />
            <ActionButton
              onClick={() => ejecutar("download")}
              disabled={Boolean(motivo)}
              disabledReason={motivo}
              isLoading={cargando("download")}
              loadingLabel="Descargando..."
              icon={<Download className="h-5 w-5" />}
              label="Descargar PDF"
              etiqueta={esCelular ? "PDF" : undefined}
              description="Todos los seleccionados en un PDF, al dispositivo"
              colorClass={getActionColor("download", null)}
            />
            <ActionButton
              onClick={() => ejecutar("email")}
              disabled={Boolean(motivo)}
              disabledReason={motivo}
              isLoading={cargando("email")}
              loadingLabel="Enviando email..."
              icon={<Mail className="h-5 w-5" />}
              label="Enviar por email"
              etiqueta={esCelular ? "Email" : undefined}
              description="A cada paciente, su informe"
              colorClass={getActionColor("email", null)}
            />
            <ActionButton
              onClick={() => ejecutar("whatsapp")}
              disabled={Boolean(motivo)}
              disabledReason={motivo}
              isLoading={cargando("whatsapp")}
              loadingLabel="Enviando..."
              icon={<MessageCircle className="h-5 w-5" />}
              label="Enviar por WhatsApp"
              etiqueta={esCelular ? "WhatsApp" : undefined}
              description="A cada paciente, su informe"
              colorClass={getActionColor("whatsapp", null)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked || selectedCount < 2 || isProcessing}
                  className="h-11 border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white"
                  title={disabledReason || "Combinar varios protocolos del mismo paciente en un único reporte"}
                >
                  {isProcessing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <GitMerge className="mr-1 h-4 w-4" />}
                  Unificar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Reporte unificado</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMerge("print")}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMerge("download")}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMerge("email")}>
                  <Mail className="mr-2 h-4 w-4" /> Enviar por email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMerge("whatsapp")}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Enviar por WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  )
}
