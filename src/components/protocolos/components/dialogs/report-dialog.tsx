"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, FileText, Printer, Mail, MessageCircle, Download, ChevronRight, ArrowRightLeft, X, PenLine, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../ui/dialog"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Checkbox } from "../../../ui/checkbox"
import { Badge } from "../../../ui/badge"
import { Label } from "../../../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import { Separator } from "../../../ui/separator"
import { ACTO_BIOQUIMICO_CODES } from "@/lib/codigos-analisis"
import { getActionColor, getSendMethodAction } from "@/lib/status-styles"
import { ActionButton } from "../boton-de-accion-del-informe"
import type { ProtocolDetail, ReportSignature, SendMethod } from "@/types"

type ReportProtocolAnalysis = ProtocolDetail & {
  is_sent?: boolean
  is_sent_summary?: boolean
  is_valid?: boolean
}

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  reportType: "full" | "summary"
  onReportTypeChange: (type: "full" | "summary") => void
  signed: boolean
  onSignedChange: (signed: boolean) => void
  signatureId: string
  onSignatureIdChange: (signatureId: string) => void
  signatures: ReportSignature[]
  reportDate: string
  onReportDateChange: (date: string) => void
  reportTime: string
  onReportTimeChange: (time: string) => void
  onClearDateTime: () => void
  analyses: ReportProtocolAnalysis[]
  selectedAnalysisIds: number[]
  onToggleAnalysis: (analysisId: number) => void
  onSelectAllAnalyses: () => void
  onDeselectAllAnalyses: () => void
  customizationOpen: boolean
  onToggleCustomizationOpen: (open: boolean) => void
  /** Mirar el informe sin sacarlo: no marca nada. */
  onPreviewReport: () => void
  onGenerateReport: () => void
  onDownloadReport: () => void
  onSendEmail: () => void
  onSendWhatsApp: () => void
  sendMethodName?: string
  /** Los métodos de envío disponibles, para poder corregirlo desde acá. */
  sendMethods?: SendMethod[]
  sendMethodId?: string
  onSendMethodChange?: (sendMethodId: string) => void
  savingSendMethod?: boolean
  emailDisabledReason?: string
  whatsappDisabledReason?: string
  isPreviewing: boolean
  isGenerating: boolean
  isDownloading: boolean
  isSending: boolean
  isSendingWhatsApp: boolean
}

interface ReportCustomizationDrawerProps {
  open: boolean
  reportType: "full" | "summary"
  analyses: ReportProtocolAnalysis[]
  selectedAnalysisIds: number[]
  onToggleAnalysis: (analysisId: number) => void
  onSelectAllAnalyses: () => void
  onDeselectAllAnalyses: () => void
  onToggleOpen: (open: boolean) => void
}

const EXCLUDED_ANALYSIS_CODES = ACTO_BIOQUIMICO_CODES

// Se puede incluir cualquier análisis con resultados cargados, aunque no esté
// validado por completo: el backend imprime sólo los resultados validados
// (is_sent) del análisis, así que la impresión parcial es válida.
function isSelectableAnalysis(analysis: ReportProtocolAnalysis, reportType: "full" | "summary") {
  return !EXCLUDED_ANALYSIS_CODES.has(analysis.code)
    && (reportType === "summary" || analysis.lleva_resultado !== false)
    && analysis.is_loaded !== false
}

function isVisibleAnalysis(analysis: ReportProtocolAnalysis, reportType: "full" | "summary") {
  return !EXCLUDED_ANALYSIS_CODES.has(analysis.code)
    && (reportType === "summary" || analysis.lleva_resultado !== false)
}

function ReportCustomizationDrawer({
  open,
  reportType,
  analyses,
  selectedAnalysisIds,
  onToggleAnalysis,
  onSelectAllAnalyses,
  onDeselectAllAnalyses,
  onToggleOpen,
}: ReportCustomizationDrawerProps) {
  const visibleAnalyses = analyses.filter((analysis) => isVisibleAnalysis(analysis, reportType))
  const selectedCount = selectedAnalysisIds.filter((id) => visibleAnalyses.some((analysis) => analysis.id === id)).length
  const selectableCount = visibleAnalyses.filter((analysis) => isSelectableAnalysis(analysis, reportType)).length

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 h-full w-[calc(var(--ancho-tarjeta)+var(--ancho-panel)+80px)] overflow-visible">
      <div
        className={`pointer-events-auto absolute inset-y-0 left-[80px] z-10 flex h-full w-[var(--ancho-panel)] flex-col overflow-hidden rounded-r-xl border border-l-0 border-slate-200 bg-white shadow-[18px_0_35px_rgba(15,23,42,0.16)] transition-transform duration-300 ease-out ${
          open ? "translate-x-[calc(var(--corrimiento-panel)-80px)]" : "translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col pl-6 pr-12">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Personalizar reporte</p>
              <p className="text-xs text-slate-500">
                {selectedCount} de {selectableCount} análisis seleccionados
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onSelectAllAnalyses}>
                Seleccionar todos
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDeselectAllAnalyses}>
                Deseleccionar todos
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
            {visibleAnalyses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                No hay análisis disponibles para personalizar.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleAnalyses.map((analysis) => {
                  const checked = selectedAnalysisIds.includes(analysis.id)
                  const isDisabled = !isSelectableAnalysis(analysis, reportType)
                  // Cargado pero aún no validado por completo: se puede incluir, pero parcial.
                  const isPartial = !isDisabled && analysis.is_valid === false
                  return (
                    <button
                      key={analysis.id}
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          onToggleAnalysis(analysis.id)
                        }
                      }}
                      disabled={isDisabled}
                      className={`w-full rounded-lg border p-3 text-left transition-all duration-200 ${
                        checked ? "border-[#204983] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                      } ${analysis.is_sent ? "ring-1 ring-emerald-200" : ""} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          disabled={isDisabled}
                          onCheckedChange={() => {
                            if (!isDisabled) {
                              onToggleAnalysis(analysis.id)
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-snug text-slate-800">{analysis.name}</p>
                              <p className="text-xs text-slate-500">Código {analysis.code} · UB {analysis.ub}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {analysis.is_urgent && (
                                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                                  Urgente
                                </Badge>
                              )}
                              <Badge
                                variant={analysis.is_sent ? "default" : "secondary"}
                                className={analysis.is_sent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}
                              >
                                {analysis.is_sent ? "Enviado al paciente" : "Sin enviar"}
                              </Badge>
                              {analysis.is_sent_summary && (
                                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                                  Resumen generado
                                </Badge>
                              )}
                              {isPartial && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                  Parcial
                                </Badge>
                              )}
                              {isDisabled && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                                  Sin resultados
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">
                            {isDisabled
                              ? "No se puede incluir: todavía no tiene resultados cargados."
                              : isPartial && checked
                                ? "Se incluirán sólo los resultados ya validados de este análisis."
                                : checked
                                  ? "Se incluirá en el reporte."
                                  : "No se enviará en este reporte."}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggleOpen(!open)}
        // La pestaña arranca pegada al borde derecho de la tarjeta y, al
        // abrirse, viaja hasta el borde derecho del panel. Las dos posiciones
        // salen de las mismas variables que el panel, así que achicar la
        // ventana la mueve con él en vez de dejarla flotando en el medio.
        className={`pointer-events-auto absolute left-[var(--corrimiento-panel)] top-0 z-10 h-full w-16 rounded-r-xl border border-l-0 border-slate-200 bg-white shadow-[12px_0_24px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out transition-colors hover:bg-slate-50 ${
          open ? "translate-x-[calc(var(--ancho-panel)-12px)]" : "translate-x-0"
        }`}
      >
        <div className="ml-3 flex h-full flex-col items-center justify-center gap-2 px-1 py-3">
          <span className="text-[11px] font-semibold leading-none text-[#204983] [writing-mode:vertical-rl] rotate-180">
            Personalizar reporte
          </span>
          <Badge variant="outline" className="border-[#204983] text-[#204983] px-1 py-0 text-[10px]">
            {selectedCount}
          </Badge>
          <ChevronRight className={`h-4 w-4 text-[#204983] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
    </div>
  )
}

function SignatureSelector({
  signed,
  signatureId,
  onSignatureIdChange,
  signatures,
}: {
  signed: boolean
  signatureId: string
  onSignatureIdChange: (signatureId: string) => void
  signatures: ReportSignature[]
}) {
  if (!signed) return null

  const defaultSignature = signatures.find((s) => s.is_default)

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Firma a utilizar</Label>
      <Select value={signatureId} onValueChange={onSignatureIdChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* La opción "default" muestra el nombre de la firma predeterminada. */}
          <SelectItem value="default">
            {defaultSignature ? `${defaultSignature.name} (predeterminada)` : "Predeterminada del sistema"}
          </SelectItem>
          {signatures
            .filter((signature) => !signature.is_default)
            .map((signature) => (
              <SelectItem key={signature.id} value={signature.id.toString()}>
                {signature.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Si no elegís una firma específica, se usa la predeterminada del catálogo.
      </p>
    </div>
  )
}

export function ReportDialog({
  open,
  onOpenChange,
  protocolId,
  reportType,
  onReportTypeChange,
  signed,
  onSignedChange,
  signatureId,
  onSignatureIdChange,
  signatures,
  reportDate,
  onReportDateChange,
  reportTime,
  onReportTimeChange,
  onClearDateTime,
  analyses,
  selectedAnalysisIds,
  onToggleAnalysis,
  onSelectAllAnalyses,
  onDeselectAllAnalyses,
  customizationOpen,
  onToggleCustomizationOpen,
  onPreviewReport,
  onGenerateReport,
  onDownloadReport,
  onSendEmail,
  onSendWhatsApp,
  sendMethodName,
  sendMethods = [],
  sendMethodId = "",
  onSendMethodChange,
  savingSendMethod = false,
  emailDisabledReason,
  whatsappDisabledReason,
  isPreviewing,
  isGenerating,
  isDownloading,
  isSending,
  isSendingWhatsApp,
}: ReportDialogProps) {
  const [mobileDragY, setMobileDragY] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  // Si no hay firmas cargadas en el sistema, no se puede firmar digitalmente.
  const hasSignatures = signatures.length > 0
  useEffect(() => {
    if (!hasSignatures && signed) onSignedChange(false)
  }, [hasSignatures, signed, onSignedChange])
  const touchStartYRef = useRef<number | null>(null)
  const canDragToCloseRef = useRef(false)
  const startScrollTopRef = useRef(0)
  const frontScrollRef = useRef<HTMLDivElement | null>(null)
  const backScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const apply = () => setIsMobileViewport(media.matches)

    apply()

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply)
      return () => media.removeEventListener("change", apply)
    }

    media.addListener(apply)
    return () => media.removeListener(apply)
  }, [])

  const handleMobileTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touchY = e.touches[0]?.clientY ?? 0
    const activeScroll = customizationOpen ? backScrollRef.current : frontScrollRef.current

    touchStartYRef.current = touchY
    startScrollTopRef.current = activeScroll?.scrollTop ?? 0
    canDragToCloseRef.current = (activeScroll?.scrollTop ?? 0) <= 0
  }

  const handleMobileTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canDragToCloseRef.current || touchStartYRef.current === null) {
      return
    }

    const touchY = e.touches[0]?.clientY ?? 0
    const delta = touchY - touchStartYRef.current

    // Only drag-close when pulling down from top; otherwise keep native scrolling.
    if (startScrollTopRef.current <= 0 && delta > 0) {
      setMobileDragY(Math.max(0, Math.min(220, delta)))
      e.preventDefault()
    }
  }

  const handleMobileTouchEnd = () => {
    if (!canDragToCloseRef.current) {
      touchStartYRef.current = null
      return
    }

    if (mobileDragY > 120) {
      onOpenChange(false)
    }

    setMobileDragY(0)
    touchStartYRef.current = null
    canDragToCloseRef.current = false
    startScrollTopRef.current = 0
  }

  const visibleAnalyses = analyses.filter((analysis) => isVisibleAnalysis(analysis, reportType))
  const selectedCount = selectedAnalysisIds.filter((id) => visibleAnalyses.some((analysis) => analysis.id === id)).length
  const selectableCount = visibleAnalyses.filter((analysis) => isSelectableAnalysis(analysis, reportType)).length
  const activeSendAction = getSendMethodAction(sendMethodName)

  // EL MÉTODO DE ENVÍO VIVE ACÁ, NO EN FACTURACIÓN.
  // No es plata: es cómo se le hace llegar el informe al paciente, y es lo que
  // decide cuál de estos botones queda resaltado. Tenerlo en otra pantalla
  // obligaba a salir, cambiarlo y volver — justo cuando ya se está por mandar.
  const envioDeResultados = onSendMethodChange ? (
    <div className="mb-1 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2">
      <span className="text-xs text-gray-600">Envío de resultados</span>
      <Select
        value={sendMethodId}
        onValueChange={onSendMethodChange}
        disabled={savingSendMethod || sendMethods.length === 0}
      >
        <SelectTrigger className="h-7 w-auto min-w-[9rem] bg-white text-xs">
          <SelectValue placeholder={sendMethodName || "Sin método"} />
        </SelectTrigger>
        <SelectContent>
          {sendMethods.map((metodo) => (
            <SelectItem key={metodo.id} value={String(metodo.id)}>
              {metodo.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {savingSendMethod && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
    </div>
  ) : null
  const isBusy = isGenerating || isDownloading || isSending || isSendingWhatsApp
  const noSelectedAnalysisReason =
    selectedCount === 0 ? "No hay análisis seleccionados para incluir en el reporte." : undefined
  const commonDisabledReason = noSelectedAnalysisReason || (isBusy ? "Hay otra acción de reporte en proceso." : undefined)
  const printDisabledReason = commonDisabledReason
  const downloadDisabledReason = commonDisabledReason
  const emailActionDisabledReason = emailDisabledReason || commonDisabledReason
  const whatsappActionDisabledReason = whatsappDisabledReason || commonDisabledReason
  const signatureDescription = signed
    ? "Se incluirá firma digital del bioquímico"
    : "Se incluirá línea para firma física"
  // LAS ACCIONES, UNA SOLA VEZ.
  // El escritorio y el celular son dos maquetas distintas y cada una tenía su
  // propia lista de botones. Así fue como al celular le faltó la vista previa:
  // se agregó en una y no en la otra. Ahora las dos usan esta.
  //
  // En el celular van con el nombre abajo (`conEtiqueta`): ahí no hay mouse, y
  // el tooltip que en el escritorio dice qué hace cada ícono no aparece nunca.
  const botonesDeAccion = (conEtiqueta: boolean) => (
    <>
      {/* Primero mirar, después sacar. Esta no marca nada: ni los análisis
          como enviados ni el protocolo como impreso, así que se puede abrir
          las veces que haga falta. */}
      <ActionButton
        onClick={onPreviewReport}
        disabled={Boolean(printDisabledReason)}
        disabledReason={printDisabledReason}
        isLoading={isPreviewing}
        loadingLabel="Abriendo..."
        icon={<Eye className="h-5 w-5" />}
        label="Ver vista previa"
        description="Solo para mirarlo: no lo marca como enviado"
        colorClass="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        etiqueta={conEtiqueta ? "Vista previa" : undefined}
      />
      <ActionButton
        onClick={onGenerateReport}
        disabled={Boolean(printDisabledReason)}
        disabledReason={printDisabledReason}
        isLoading={isGenerating}
        loadingLabel="Imprimiendo..."
        icon={<Printer className="h-5 w-5" />}
        label="Imprimir"
        description="Dialogo de impresion del navegador"
        colorClass={getActionColor("print", activeSendAction)}
        isPatientMethod={activeSendAction === "print"}
        etiqueta={conEtiqueta ? "Imprimir" : undefined}
      />
      <ActionButton
        onClick={onDownloadReport}
        disabled={Boolean(downloadDisabledReason)}
        disabledReason={downloadDisabledReason}
        isLoading={isDownloading}
        loadingLabel="Descargando..."
        icon={<Download className="h-5 w-5" />}
        label="Descargar PDF"
        description="Guardar archivo en el dispositivo"
        colorClass={getActionColor("download", activeSendAction)}
        etiqueta={conEtiqueta ? "PDF" : undefined}
      />
      <ActionButton
        onClick={onSendEmail}
        disabled={Boolean(emailActionDisabledReason)}
        disabledReason={emailActionDisabledReason}
        isLoading={isSending}
        loadingLabel="Enviando email..."
        icon={<Mail className="h-5 w-5" />}
        label="Enviar por email"
        description="Envia el reporte al paciente"
        colorClass={getActionColor("email", activeSendAction)}
        isPatientMethod={activeSendAction === "email"}
        etiqueta={conEtiqueta ? "Email" : undefined}
      />
      <ActionButton
        onClick={onSendWhatsApp}
        disabled={Boolean(whatsappActionDisabledReason)}
        disabledReason={whatsappActionDisabledReason}
        isLoading={isSendingWhatsApp}
        loadingLabel="Enviando..."
        icon={<MessageCircle className="h-5 w-5" />}
        label="Enviar por WhatsApp"
        description="Comparte el reporte por WhatsApp"
        colorClass={getActionColor("whatsapp", activeSendAction)}
        isPatientMethod={activeSendAction === "whatsapp"}
        etiqueta={conEtiqueta ? "WhatsApp" : undefined}
      />
    </>
  )

  // La geometría del escritorio en un solo lugar. Antes eran cuatro números
  // sueltos —620 de tarjeta, 540 de panel, 528 de corrimiento del panel y 264
  // de corrimiento del diálogo— que solo cerraban en una pantalla grande. En
  // un notebook de 1280 el panel se salía de la pantalla y, con 768 de alto,
  // la tarjeta medía más que la ventana y no había forma de llegar a los
  // botones.
  //
  // Ahora los cuatro salen de `--ancho-tarjeta`, así que achicar la ventana
  // los mueve juntos y la proporción se mantiene. Los `min()` son topes: en
  // una pantalla grande dan exactamente los valores de antes.
  const geometria = {
    "--ancho-tarjeta": "min(620px, 94vw)",
    "--ancho-panel": "min(540px, 46vw)",
    // El panel arranca 12px antes del borde derecho de la tarjeta, para que se
    // vea pegado y no flotando al lado.
    "--corrimiento-panel": "calc(var(--ancho-tarjeta) - 12px)",
    // El diálogo se corre la mitad de lo que ocupa el panel, así el conjunto
    // queda centrado en vez de irse para un costado.
    "--corrimiento-dialogo": "calc(var(--ancho-panel) / 2)",
  } as React.CSSProperties

  const dialogContentClass = isMobileViewport
    ? "w-[95vw] max-w-[380px] sm:max-w-[380px] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none rounded-none translate-x-[-50%]"
    : `w-[var(--ancho-tarjeta)] max-w-[var(--ancho-tarjeta)] sm:max-w-[var(--ancho-tarjeta)] gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none transition-transform duration-300 ease-out ${
        customizationOpen
          ? "translate-x-[calc(-50%-var(--corrimiento-dialogo))]"
          : "translate-x-[-50%]"
      }`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={dialogContentClass} style={geometria}>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-[70] hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700 pointer-events-auto lg:inline-flex"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* `max-h` con `min-h` chico: en una pantalla alta se ve igual que antes y
            en una baja la tarjeta se achica en vez de pasarse de la ventana. El
            que scrollea es el cuerpo, no el diálogo, así que los botones de
            abajo quedan siempre a la vista. */}
        <div className="relative hidden max-h-[88vh] min-h-[min(640px,86vh)] w-full flex-col overflow-visible lg:flex">
          <div
            className={`relative z-20 flex flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-2xl transition-colors duration-300 ease-out ${
              customizationOpen ? "border-slate-200 border-r-0" : "border-slate-200"
            }`}
          >
            <div className="px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-[#204983]" />
                  Reportes — Protocolo #{protocolId}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Selecciona el tipo de reporte, la fecha y personaliza los análisis incluidos.
                </DialogDescription>
              </DialogHeader>
            </div>

            <Separator />

            {/* El que scrollea es este bloque, no la tarjeta: los botones de
                abajo tienen que estar siempre a la vista. `min-h-0` porque un
                hijo de flex no achica por debajo de su contenido sin eso, y
                sin achicar no hay scroll. */}
            <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Tipo de reporte</Label>
                <Select value={reportType} onValueChange={onReportTypeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Completo — destinado a PACIENTES</SelectItem>
                    <SelectItem value="summary">Resumen — destinado a FACTURACIÓN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                onClick={() => hasSignatures && onSignedChange(!signed)}
                disabled={!hasSignatures}
                className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  signed
                    ? "border-[#204983] bg-blue-50 text-[#204983]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <PenLine className="h-4 w-4 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium leading-tight">Firma digital</span>
                  <span className="text-xs opacity-70 leading-tight mt-0.5">
                    {hasSignatures ? signatureDescription : "No hay firmas cargadas en el sistema"}
                  </span>
                </div>
                <Checkbox
                  checked={signed && hasSignatures}
                  disabled={!hasSignatures}
                  onCheckedChange={(checked) => onSignedChange(checked === true)}
                  className="ml-auto shrink-0"
                />
              </button>
              {!hasSignatures && (
                <p className="text-xs text-amber-600">
                  Cargá una firma en Configuración para poder enviar con firma digital.
                </p>
              )}

              <SignatureSelector
                signed={signed}
                signatureId={signatureId}
                onSignatureIdChange={onSignatureIdChange}
                signatures={signatures}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="report_date" className="text-sm font-medium">Fecha del reporte (opcional, por defecto la de creación del protocolo)</Label>
                <Input
                  id="report_date"
                  name="report_date"
                  type="date"
                  value={reportDate}
                  onChange={(e) => onReportDateChange(e.target.value)}
                />

                <Label htmlFor="report_time" className="text-sm font-medium mt-2">Horario del reporte (opcional, no se imprime si se deja vacío)</Label>
                <Input
                  id="report_time"
                  name="report_time"
                  type="time"
                  value={reportTime}
                  onChange={(e) => onReportTimeChange(e.target.value)}
                  step={60}
                />
                <div className="flex justify-start pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={onClearDateTime}>
                    Limpiar fecha y hora
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si no completás la fecha, el informe usa la fecha de creación del protocolo. El horario sólo aparece impreso si lo completás acá.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex shrink-0 flex-col gap-2 px-6 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Acciones</p>
              {envioDeResultados}

              <div className="flex flex-wrap items-center gap-2">{botonesDeAccion(false)}</div>
            </div>

            <Separator />
          </div>

          <ReportCustomizationDrawer
            open={customizationOpen}
            reportType={reportType}
            analyses={analyses}
            selectedAnalysisIds={selectedAnalysisIds}
            onToggleAnalysis={onToggleAnalysis}
            onSelectAllAnalyses={onSelectAllAnalyses}
            onDeselectAllAnalyses={onDeselectAllAnalyses}
            onToggleOpen={onToggleCustomizationOpen}
          />
        </div>

        <div className="lg:hidden">
          <div
            className="mx-auto w-full max-w-[360px] [perspective:1400px]"
            onTouchStart={handleMobileTouchStart}
            onTouchMove={handleMobileTouchMove}
            onTouchEnd={handleMobileTouchEnd}
            onTouchCancel={handleMobileTouchEnd}
          >
            <div
              className="relative h-[86dvh] max-h-[700px] w-full transition-[transform,opacity] duration-300 ease-out"
              style={{
                transform: `translateY(${mobileDragY}px)`,
                opacity: Math.max(0.7, 1 - mobileDragY / 420),
              }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute right-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="absolute left-1/2 top-2 z-40 -translate-x-1/2 rounded-full px-2 py-2 touch-none">
                <div className="h-1.5 w-14 rounded-full bg-slate-300" />
              </div>

              <div
                className={`relative h-full w-full [transform-origin:center_center] [transform-style:preserve-3d] transition-transform duration-500 ${
                  customizationOpen ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                <div
                  className={`absolute inset-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl [backface-visibility:hidden] [transform-origin:center_center] transition-opacity duration-200 ${
                    customizationOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
                  }`}
                >
                  <div className="flex h-full flex-col">
                    <div className="px-5 pb-4 pt-5">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-5 w-5 text-[#204983]" />
                          Reportes — Protocolo #{protocolId}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                          Selecciona tipo de reporte y fecha. Luego podés personalizar análisis.
                        </DialogDescription>
                      </DialogHeader>
                    </div>

                    <Separator />

                    <div ref={frontScrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium">Tipo de reporte</Label>
                          <Select value={reportType} onValueChange={onReportTypeChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Completo — destinado a PACIENTES</SelectItem>
                              <SelectItem value="summary">Resumen — destinado a FACTURACIÓN</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <button
                          type="button"
                          onClick={() => hasSignatures && onSignedChange(!signed)}
                          disabled={!hasSignatures}
                          className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            signed
                              ? "border-[#204983] bg-blue-50 text-[#204983]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <PenLine className="h-4 w-4 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium leading-tight">Firma digital</span>
                            <span className="text-xs opacity-70 leading-tight mt-0.5">
                              {hasSignatures ? signatureDescription : "No hay firmas cargadas en el sistema"}
                            </span>
                          </div>
                          <Checkbox
                            checked={signed && hasSignatures}
                            disabled={!hasSignatures}
                            onCheckedChange={(checked) => onSignedChange(checked === true)}
                            className="ml-auto shrink-0"
                          />
                        </button>
                        {!hasSignatures && (
                          <p className="text-xs text-amber-600">
                            Cargá una firma en Configuración para poder enviar con firma digital.
                          </p>
                        )}

                        <SignatureSelector
                          signed={signed}
                          signatureId={signatureId}
                          onSignatureIdChange={onSignatureIdChange}
                          signatures={signatures}
                        />

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="report_date_mobile" className="text-sm font-medium">Fecha del reporte (opcional, por defecto la de creación del protocolo)</Label>
                          <Input
                            id="report_date_mobile"
                            name="report_date"
                            type="date"
                            value={reportDate}
                            onChange={(e) => onReportDateChange(e.target.value)}
                          />

                          <Label htmlFor="report_time_mobile" className="mt-2 text-sm font-medium">Horario del reporte (opcional, no se imprime si se deja vacío)</Label>
                          <Input
                            id="report_time_mobile"
                            name="report_time"
                            type="time"
                            value={reportTime}
                            onChange={(e) => onReportTimeChange(e.target.value)}
                            step={60}
                          />

                          <div className="flex justify-start pt-1">
                            <Button type="button" variant="outline" size="sm" onClick={onClearDateTime}>
                              Limpiar fecha y hora
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Si no completás la fecha, el informe usa la fecha de creación del protocolo. El horario sólo aparece impreso si lo completás acá.
                          </p>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</p>
                          {envioDeResultados}
                          {/* Las cinco en una fila, como en el escritorio: una por
                              renglón se comían la pantalla del celular. */}
                          <div className="grid grid-cols-5 justify-items-center gap-1">{botonesDeAccion(true)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Abajo de todo y no flotando encima: flotando tapaba la
                        fila de acciones, justo lo que hay que tocar. */}
                    <div className="flex shrink-0 justify-center border-t border-slate-200 bg-white px-5 py-3">
                      <Button
                        type="button"
                        onClick={() => onToggleCustomizationOpen(true)}
                        className="rounded-full bg-[#204983] px-5 text-white hover:bg-[#1a3d6f]"
                      >
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Personalizar ({selectedCount})
                      </Button>
                    </div>
                  </div>
                </div>

                <div
                  className={`absolute inset-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)] [transform-origin:center_center] transition-opacity duration-200 ${
                    customizationOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="flex h-full flex-col">
                    <div className="border-b border-slate-200 bg-white/95 px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">Personalizar reporte</p>
                      <p className="text-xs text-slate-500">
                        {selectedCount} de {selectableCount} análisis seleccionados
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onSelectAllAnalyses}>
                          Seleccionar todos
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={onDeselectAllAnalyses}>
                          Deseleccionar todos
                        </Button>
                      </div>
                    </div>

                    <div ref={backScrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                      {visibleAnalyses.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          No hay análisis disponibles para personalizar.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {visibleAnalyses.map((analysis) => {
                            const checked = selectedAnalysisIds.includes(analysis.id)
                            const isDisabled = !isSelectableAnalysis(analysis, reportType)
                            return (
                              <button
                                key={analysis.id}
                                type="button"
                                onClick={() => {
                                  if (!isDisabled) {
                                    onToggleAnalysis(analysis.id)
                                  }
                                }}
                                disabled={isDisabled}
                                className={`w-full rounded-lg border p-3 text-left transition-all duration-200 ${
                                  checked ? "border-[#204983] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                                } ${analysis.is_sent ? "ring-1 ring-emerald-200" : ""} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={checked}
                                    disabled={isDisabled}
                                    onCheckedChange={() => {
                                      if (!isDisabled) {
                                        onToggleAnalysis(analysis.id)
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold leading-snug text-slate-800">{analysis.name}</p>
                                        <p className="text-xs text-slate-500">Código {analysis.code} · UB {analysis.ub}</p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        {analysis.is_urgent && (
                                          <Badge variant="destructive" className="px-2 py-0 text-[10px]">
                                            Urgente
                                          </Badge>
                                        )}
                                        <Badge
                                          variant={analysis.is_sent ? "default" : "secondary"}
                                          className={analysis.is_sent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}
                                        >
                                          {analysis.is_sent ? "Ya enviado" : "Pendiente"}
                                        </Badge>
                                        {isDisabled && (
                                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                            No validado
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 justify-center border-t border-slate-200 bg-white px-5 py-3">
                      <Button
                        type="button"
                        onClick={() => onToggleCustomizationOpen(false)}
                        className="rounded-full bg-[#204983] px-5 text-white hover:bg-[#1a3d6f]"
                      >
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Volver al reporte
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
