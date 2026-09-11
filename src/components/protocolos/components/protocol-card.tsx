"use client"

import type React from "react"
import { pedirInforme } from "@/components/contingencia/enviar-informe"
import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "../../ui/card"
import { Skeleton } from "../../ui/skeleton"
import { useApi } from "../../../hooks/use-api"
import { toast } from "sonner"
import { abrirVistaPrevia } from "@/lib/ventana-de-vista-previa"
import { PROTOCOL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import { ACTO_BIOQUIMICO_CODES } from "@/lib/codigos-analisis"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog"
import type {
  PagoDelProtocolo,
  ProtocolListItem,
  ProtocolDetail as ProtocolDetailType,
  SendMethod,
  HistoryEntry,
  PaymentStatus,
  BillingStatus,
  ProtocolStatus,
  PreauthStatus,
  ReportSignature,
  ProtocolAuditEvent,
} from "@/types"

// Componentes modulares
import { useNavigate } from "react-router-dom"
import { ProtocolHeader } from "./protocol-header"
import { ProtocolDetailView } from "./protocol-detail-view"
import { ProtocolDetailsSection } from "./protocol-details-section"
import { ProtocolActions } from "./protocol-actions"
import {
  PaymentDialog,
  AnalysisDialog,
  AuditDialog,
  EditDialog,
  ReportDialog,
  CoseguroDialog,
  EntidadDeFacturacionDialog,
  MedicoDialog,
  ObraSocialDialog,
  PreauthorizationDialog,
  OrderStatusDialog,
  ArcaBillingDialog,
  UnplannedTransactionsDialog,
} from "./dialogs"
import type { ArcaPayload } from "./dialogs"
import { ProtocolHistoryDialog } from "./dialogs/protocol-history-dialog"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { useAuth } from "@/contexts/auth-context"
import { getProtocolStatusStyleByName } from "@/lib/status-styles"
import { seguirElWhatsApp } from "@/lib/seguimiento-de-whatsapp"
import { TRAJO_ORDEN, normalizeTrajoOrden, type TrajoOrdenStatus } from "@/lib/protocol-order"
import { AgregarAnalisisDialog } from "./dialogs/agregar-analisis-dialog"
import { FormaDePagoDialog } from "./dialogs/forma-de-pago-dialog"
import { EnviarInformeDialog } from "./dialogs/enviar-informe-dialog"
import { nombreDelPdf } from "@/lib/nombre-del-pdf"

interface ProtocolDetailResponse {
  id: number
  patient: {
    id: number
    dni: string
    first_name: string
    last_name: string
    email?: string
    phone_mobile?: string
    alt_phone?: string
    is_anonymous?: boolean
  }
  doctor: {
    id: number
    first_name: string
    last_name: string
    license: string
  }
  insurance: {
    id: number
    name: string
    charges_coseguro?: boolean
    charges_material_descartable?: boolean
    charges_derivacion?: boolean
    requires_preauthorization?: boolean
    /** Factura por Centro o por Clínica según la preautorización del paciente:
     *  la entidad se elige por protocolo. */
    chooses_billing_entity?: boolean
  }
  /** A qué entidad se le presenta ESTE protocolo. */
  billing_entity?: { id: number; name: string } | null
  affiliate_number?: string
  status: ProtocolStatus
  send_method: {
    id: number
    name: string
  }
  insurance_ub_value: string
  private_ub_value: string
  // Payment fields (new API format)
  amount_due: string
  amount_pending: string
  patient_paid: string
  amount_to_return: string
  /** Lo que el paciente dejó de más y se tomó como redondeo. */
  redondeo?: string
  // Pricing breakdown (new fields)
  analyses_amount_due?: string
  coseguro_amount?: string
  material_descartable_amount?: string
  derivacion_amount?: string
  extras_total?: string
  unplanned_transactions?: import("@/types").UnplannedTransaction[]
  unplanned_charges_total?: string
  unplanned_payments_total?: string
  private_amount_due?: string
  nbu?: { id: number; name: string } | null
  payment_status: PaymentStatus
  billing_status?: BillingStatus
  is_printed: boolean
  trajo_orden: TrajoOrdenStatus
  preauth_status?: PreauthStatus
  preauth_reference?: string
  preauth_notes?: string
  is_in_patient?: boolean
  is_active: boolean
  created_at?: string
  completed_at?: string | null
  previous_status?: ProtocolStatus | null
  // ARCA
  is_arca_billed?: boolean
  arca_invoice_pdf_url?: string | null
  arca_cae?: string
  arca_cbte_number?: number | null
  details: ProtocolDetailType[]
  history?: HistoryEntry[]
  total_changes?: number
  /** Cada cobro con su forma. Un protocolo puede tener más de una: el paciente
   *  deja una parte en efectivo y transfiere el resto. */
  pagos?: PagoDelProtocolo[]
}

type ReportProtocolDetail = ProtocolDetailType

type ReportAction = "download" | "email" | "whatsapp" | "preview"

const EXCLUDED_REPORT_ANALYSIS_CODES = ACTO_BIOQUIMICO_CODES

// Incluible en el reporte: alcanza con tener resultados cargados (el backend
// imprime sólo los validados). Permite impresión parcial de análisis a medio validar.
const isSelectableForReport = (analysis: ReportProtocolDetail) => {
  return !EXCLUDED_REPORT_ANALYSIS_CODES.has(analysis.code) && analysis.is_loaded !== false
}

// Preselección por defecto: sólo los análisis totalmente validados.
const isDefaultReportSelected = (analysis: ReportProtocolDetail) => {
  return isSelectableForReport(analysis) && analysis.is_valid !== false
}

const isReportableAnalysis = (analysis: ReportProtocolDetail) => {
  return !EXCLUDED_REPORT_ANALYSIS_CODES.has(analysis.code)
}

interface ProtocolCardProps {
  protocol: ProtocolListItem
  onUpdate: () => void
  sendMethods?: SendMethod[]
  reportSignatures?: ReportSignature[]
  isSelected?: boolean
  onToggleSelection?: (id: number) => void
  /**
   * Render como contenido de página (`/protocolos/:id`) en vez de card de
   * listado: arranca expandido, sin chrome de card (cursor/hover/checkbox) ni
   * toggle de colapso. La lógica de acciones/diálogos se reutiliza tal cual.
   */
  pageMode?: boolean
  /** Detalle ya cargado por la página, para evitar un segundo fetch. */
  initialDetail?: ProtocolDetailResponse | null
  /** Abre el modal de reporte al montar (ej: venís del botón Reporte de la lista). */
  autoOpenReport?: boolean
}

export function ProtocolCard({
  protocol,
  onUpdate,
  sendMethods = [],
  reportSignatures = [],
  isSelected = false,
  onToggleSelection,
  pageMode = false,
  initialDetail = null,
  autoOpenReport = false,
}: ProtocolCardProps) {
  const { apiRequest } = useApi()
  const { hasPermission, user } = useAuth()
  // Imprimir / previsualizar / descargar / enviar informes pide permiso.
  // Consultar el protocolo NO: el resto de la card queda igual que siempre.
  const canPrintReports = hasPermission(PERMISSIONS.MANAGE_PRINTS.codename)
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(pageMode)
  const [protocolDetail, setProtocolDetail] = useState<ProtocolDetailResponse | null>(initialDetail)
  // Estado más fresco que la prop `protocol.status`: algunas acciones (autorizar
  // análisis, transacciones no planificadas) refrescan el detalle en segundo
  // plano sin pedirle al padre que recargue toda la lista. Mientras eso no pasa,
  // `liveStatus` es lo que se muestra; se descarta apenas la prop trae uno nuevo.
  const [liveStatus, setLiveStatus] = useState<ProtocolStatus | null>(null)
  useEffect(() => {
    setLiveStatus(null)
  }, [protocol.id, protocol.status?.id, protocol.status?.name])
  const [auditEvents, setAuditEvents] = useState<ProtocolAuditEvent[]>([])
  const [protocolDetails, setProtocolDetails] = useState<ReportProtocolDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isUncancelling, setIsUncancelling] = useState(false)
  const [isArcaBilling, setIsArcaBilling] = useState(false)
  // El PDF de la factura ARCA ya no viene en el detalle del protocolo: se pide
  // bajo demanda a arca-detail/ (el detalle solo trae is_arca_billed/cae/cbte).
  const [arcaInvoicePdfUrl, setArcaInvoicePdfUrl] = useState<string | null>(null)
  const [coseguroDialogOpen, setCoseguroDialogOpen] = useState(false)
  const [isProcessingCoseguro, setIsProcessingCoseguro] = useState(false)
  const [entidadDialogOpen, setEntidadDialogOpen] = useState(false)
  const [guardandoEntidad, setGuardandoEntidad] = useState(false)
  const [medicoDialogOpen, setMedicoDialogOpen] = useState(false)
  const [guardandoMedico, setGuardandoMedico] = useState(false)
  const [obraSocialDialogOpen, setObraSocialDialogOpen] = useState(false)
  const [guardandoObraSocial, setGuardandoObraSocial] = useState(false)
  const [guardandoEnvio, setGuardandoEnvio] = useState(false)
  const [unplannedDialogOpen, setUnplannedDialogOpen] = useState(false)
  const [preauthDialogOpen, setPreauthDialogOpen] = useState(false)
  const [isProcessingPreauth, setIsProcessingPreauth] = useState(false)
  const [orderStatusDialogOpen, setOrderStatusDialogOpen] = useState(false)
  const [isProcessingOrderStatus, setIsProcessingOrderStatus] = useState(false)
  const [arcaDialogOpen, setArcaDialogOpen] = useState(false)

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false)
  const [updatingDetailId, setUpdatingDetailId] = useState<number | null>(null)

  const [auditDialogOpen, setAuditDialogOpen] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<{
    send_method: string
    affiliate_number: string
    trajo_orden: TrajoOrdenStatus
    is_in_patient: boolean
  }>({
    send_method: "",
    affiliate_number: "",
    trajo_orden: TRAJO_ORDEN.COMPLETA,
    is_in_patient: false,
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportType, setReportType] = useState<"full" | "summary">("full")
  const [reportSigned, setReportSigned] = useState(true)
  const [reportSignatureId, setReportSignatureId] = useState("default")
  const [reportDate, setReportDate] = useState("")
  const [reportTime, setReportTime] = useState("")
  const [reportCustomizationOpen, setReportCustomizationOpen] = useState(false)
  const [selectedReportAnalysisIds, setSelectedReportAnalysisIds] = useState<number[]>([])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isDownloadingReport, setIsDownloadingReport] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false)
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false)
  const [pendingSendMethod, setPendingSendMethod] = useState<"email" | "whatsapp" | null>(null)
  // Confirmación al editar un protocolo COMPLETADO (antes de cada cambio).
  const [completedEditConfirmOpen, setCompletedEditConfirmOpen] = useState(false)
  const pendingCompletedEditRef = useRef<null | (() => void)>(null)
  const bypassCompletedGuardRef = useRef(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  const handleReportDateChange = (newDate: string) => {
    setReportDate(newDate)
  }

  const handleClearReportDateTime = () => {
    setReportDate("")
    setReportTime("")
  }

  const handleReportTypeChange = (type: "full" | "summary") => {
    setReportType(type)
    setReportSigned(type === "full")
  }

  const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
    return formatApiError(error, defaultMessage)
  }

  const getReportRequestOptions = () => {
    const date = reportDate.trim()
    const time = reportTime.trim()
    const reportableAnalyses = protocolDetails.filter(isReportableAnalysis)
    // `selectedReportAnalysisIds` guarda IDs de DETALLE (ProtocolDetail.id). Al
    // backend hay que mandarle el analysis_id REAL (`detail.analysis`): si se
    // manda el id del detalle, puede colisionar con el analysis_id de OTRO
    // análisis (ej: detalle #4 = Hemograma vs análisis #4 = otra práctica) y el
    // backend lo resuelve mal, dejando análisis sin marcar como enviados/impresos
    // — por eso el protocolo no pasaba a "Completado" ni habilitaba facturación.
    const includedDetailIds = selectedReportAnalysisIds.filter((detailId) =>
      reportableAnalyses.some((detail) => detail.id === detailId),
    )
    const includedAnalysisIds = reportableAnalyses
      .filter((detail) => includedDetailIds.includes(detail.id))
      .map((detail) => detail.analysis)
    const excludedAnalysisIds = reportableAnalyses
      .filter((detail) => !includedDetailIds.includes(detail.id))
      .map((detail) => detail.analysis)

    const body: Record<string, unknown> = {
      signed: reportSigned,
      analysis_ids: includedAnalysisIds,
      exclude_analysis_ids: excludedAnalysisIds,
    }
    if (reportSigned && reportSignatureId !== "default") {
      body.signature_id = Number(reportSignatureId)
    }
    if (date) body.protocol_date = date
    if (time) body.protocol_time = time

    return {
      method: "POST" as const,
      body,
    }
  }

  // Corta cualquier camino que termine pegándole a /report/ (imprimir,
  // descargar, previsualizar, email, WhatsApp) cuando falta el permiso.
  const ensureCanPrintReports = () => {
    if (canPrintReports) return true
    toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
    return false
  }

  const executeSingleReportRequest = async (action: ReportAction) => {
    const { res } = await pedirEnvio(action)
    return res
  }

  /**
   * Igual que arriba, pero contando si la persona canceló.
   *
   * Un envío que no puede salir porque el servidor está caído se le pregunta a
   * quien apretó el botón, que es quien sabe si lo quiere mandar. Cancelar no
   * deja nada esperando.
   */
  const pedirEnvio = async (action: ReportAction, destino: Record<string, string> = {}) => {
    const reportRequest = getReportRequestOptions()
    const reportPayload = (reportRequest.body ?? {}) as Record<string, unknown>

    // `mark_as_sent` no se manda nunca: el servidor entrega por defecto, que es
    // lo que hace bajar o imprimir el informe. Mirarlo sin entregarlo es la
    // vista previa (`action: "preview"`), que no marca nada.
    return pedirInforme(apiRequest, PROTOCOL_ENDPOINTS.REPORT(protocol.id), {
      action,
      type: reportType,
      ...reportPayload,
      // El email o el número elegido al mandar, si no es el del paciente.
      ...destino,
    })
  }

  const loadProtocolAnalyses = useCallback(async (): Promise<ReportProtocolDetail[] | null> => {
    if (protocolDetails.length > 0) {
      return protocolDetails
    }

    setLoadingAnalyses(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAILS(protocol.id))

      if (response.ok) {
        const data: ReportProtocolDetail[] = await response.json()
        setProtocolDetails(data)
        return data
      }

      const errorData = await response.json().catch(() => ({}))
      throw new Error(extractErrorMessage(errorData, "Error al cargar los análisis del protocolo"))
    } catch (error) {
      console.error("Error fetching protocol details:", error)
      const message = getErrorMessage(error, "Error al cargar los análisis del protocolo")
      toast.error(message, { duration: TOAST_DURATION })
      return null
    } finally {
      setLoadingAnalyses(false)
    }
  }, [apiRequest, protocol.id, protocolDetails])

  const refreshProtocolDetail = useCallback(async (): Promise<ProtocolDetailResponse | null> => {
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id))
      if (response.ok) {
        const data: ProtocolDetailResponse = await response.json()
        setProtocolDetail(data)
        setLiveStatus(data.status)
        return data
      }
    } catch (error) {
      console.error("Error refreshing protocol detail:", error)
    }
    return null
  }, [apiRequest, protocol.id])

  const fetchProtocolDetail = async (): Promise<ProtocolDetailResponse | null> => {
    if (protocolDetail) return protocolDetail

    setLoadingDetail(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id))

      if (response.ok) {
        const data: ProtocolDetailResponse = await response.json()
        setProtocolDetail(data)
        return data
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al cargar el detalle del protocolo"))
      }
    } catch (error) {
      console.error("Error fetching protocol detail:", error)
      const message = getErrorMessage(error, "Error al cargar los detalles del protocolo")
      toast.error(message, { duration: TOAST_DURATION })
      return null
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleExpand = async () => {
    if (!isExpanded) {
      await fetchProtocolDetail()
    }
    setIsExpanded(!isExpanded)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (pageMode) return
    if ((e.target as HTMLElement).closest("[data-no-expand]")) {
      return
    }
    handleExpand()
  }

  // En modo página: asegurar el detalle cargado y traer los últimos eventos
  // legibles del historial (audit-timeline) para la sección Historial.
  useEffect(() => {
    if (!pageMode) return
    if (!protocolDetail) void fetchProtocolDetail()
    if (autoOpenReport) void handleOpenReportDialog()
    let cancelled = false
    apiRequest(`${PROTOCOL_ENDPOINTS.AUDIT_TIMELINE(protocol.id)}?limit=5`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAuditEvents(data.events || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode])

  const handleAnalysisDialog = async () => {
    const analyses = await loadProtocolAnalyses()
    if (!analyses) {
      return
    }
    setAnalysisDialogOpen(true)
  }

  const handleOpenReportDialog = async () => {
    // También cubre la apertura automática por `?report=1`, que no pasa por
    // ningún botón de la UI.
    if (!ensureCanPrintReports()) return
    const analyses = await loadProtocolAnalyses()
    if (!analyses) {
      return
    }

    setSelectedReportAnalysisIds(analyses.filter(isDefaultReportSelected).map((analysis) => analysis.id))
    setReportType("full")
    setReportSigned(true)
    setReportCustomizationOpen(false)
    setReportDialogOpen(true)
  }

  const handleToggleReportAnalysis = (analysisId: number) => {
    const analysis = protocolDetails.find((item) => item.id === analysisId)
    if (!analysis || !isSelectableForReport(analysis)) {
      return
    }

    setSelectedReportAnalysisIds((prev) =>
      prev.includes(analysisId) ? prev.filter((id) => id !== analysisId) : [...prev, analysisId],
    )
  }

  const handleSelectAllReportAnalyses = () => {
    setSelectedReportAnalysisIds(protocolDetails.filter(isSelectableForReport).map((analysis) => analysis.id))
  }

  const handleDeselectAllReportAnalyses = () => {
    setSelectedReportAnalysisIds([])
  }

  const handleReportDialogOpenChange = (open: boolean) => {
    setReportDialogOpen(open)
    if (!open) {
      setReportCustomizationOpen(false)
    }
  }

  const handleCancelProtocol = async () => {
    setIsCancelling(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "DELETE",
      })

      if (response.status === 204 || response.ok) {
        toast.success("Protocolo cancelado exitosamente", { duration: TOAST_DURATION })
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error cancelling protocol"))
      }
    } catch (error) {
      console.error("Error cancelling protocol:", error)
      const message = getErrorMessage(error, "Error al cancelar el protocolo")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsCancelling(false)
    }
  }

  // El detalle del protocolo ya no embebe la URL del PDF: se pide aparte al
  // bloque arca-detail/ (solo tiene sentido si el protocolo ya está facturado).
  const fetchArcaInvoicePdfUrl = useCallback(async () => {
    try {
      const res = await apiRequest(PROTOCOL_ENDPOINTS.ARCA_DETAIL(protocol.id))
      if (res.ok) {
        const data = await res.json()
        setArcaInvoicePdfUrl(data.arca_invoice_pdf_url ?? null)
      }
    } catch (error) {
      console.error("Error fetching ARCA detail:", error)
    }
  }, [apiRequest, protocol.id])

  const handleOpenArcaDialog = async () => {
    const detail = protocolDetail ?? (await fetchProtocolDetail())
    if (detail?.is_arca_billed) {
      await fetchArcaInvoicePdfUrl()
    }
    setArcaDialogOpen(true)
  }

  const handleArcaBilling = async (payload: ArcaPayload): Promise<boolean> => {
    setIsArcaBilling(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.ARCA_BILLING(protocol.id), {
        method: "POST",
        body: payload,
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.success(data.detail || "Facturación ARCA generada exitosamente", { duration: TOAST_DURATION })
        // El POST de ARCA devuelve la URL del PDF recién generado.
        if (data.invoice_pdf_url) setArcaInvoicePdfUrl(data.invoice_pdf_url)
        await refreshProtocolDetail()
        onUpdate()
        return true
      }
      const errorData = await response.json().catch(() => ({}))
      throw new Error(extractErrorMessage(errorData, "No se pudo facturar a ARCA"))
    } catch (error) {
      console.error("Error ARCA billing:", error)
      const message = getErrorMessage(error, "Error al emitir facturación ARCA")
      toast.error(message, { duration: TOAST_DURATION })
      return false
    } finally {
      setIsArcaBilling(false)
    }
  }

  const handleOpenPaymentDialog = async () => {
    if (needsCompletedConfirm(handleOpenPaymentDialog)) return
    if (!protocolDetail) {
      await fetchProtocolDetail()
    }
    setPaymentDialogOpen(true)
  }

  const handleRegularizeBalance = async (
    amount: number,
    operation: "patient_paid" | "refunded_to_patient",
    forma: string,
    cuentaId: string,
  ): Promise<boolean> => {
    setIsProcessingPayment(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.REGULARIZE_BALANCE(protocol.id), {
        method: "POST",
        body: {
          operation,
          amount: amount.toFixed(2),
          // El saldo que se paga después suele entrar por otra vía que el
          // cobro del mostrador, y esa transferencia hay que poder cruzarla.
          payment_method: forma,
          payment_account: forma === "transferencia" && cuentaId ? Number(cuentaId) : null,
        },
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        const label = operation === "patient_paid" ? "Pago" : "Devolución"
        toast.success(`${label} de $${amount.toFixed(2)} registrado exitosamente`, { duration: TOAST_DURATION })
        // Registrar un pago suele cambiar el estado (ej. "Pago incompleto" ->
        // "Pendiente de envío"): la respuesta ya lo trae, no hace falta esperar
        // el refresh de fondo para reflejarlo.
        if (data.status !== undefined) setLiveStatus(data.status)
        await refreshProtocolDetail()
        onUpdate()
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, `Error al registrar ${operation === "patient_paid" ? "pago" : "devolución"}`))
      }
    } catch (error) {
      console.error("Error regularize balance:", error)
      const message = getErrorMessage(error, "Error al procesar la operacion")
      toast.error(message, { duration: TOAST_DURATION })
      return false
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleOpenEditDialog = async () => {
    if (needsCompletedConfirm(handleOpenEditDialog)) return
    const detail = protocolDetail || (await fetchProtocolDetail())
    if (detail) {
      setEditFormData({
        send_method: detail.send_method.id.toString(),
        affiliate_number: detail.affiliate_number || "",
        trajo_orden: normalizeTrajoOrden(detail.trajo_orden),
        is_in_patient: detail.is_in_patient ?? false,
      })
    }
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    setIsSavingEdit(true)
    try {
      const updateData: Record<string, unknown> = {}

      if (editFormData.send_method !== protocolDetail?.send_method.id.toString()) {
        updateData.send_method = Number.parseInt(editFormData.send_method)
      }
      if (editFormData.affiliate_number !== (protocolDetail?.affiliate_number || "")) {
        updateData.affiliate_number = editFormData.affiliate_number.trim()
      }
      if (editFormData.trajo_orden !== normalizeTrajoOrden(protocolDetail?.trajo_orden)) {
        updateData.trajo_orden = editFormData.trajo_orden
      }
      if (editFormData.is_in_patient !== (protocolDetail?.is_in_patient ?? false)) {
        updateData.is_in_patient = editFormData.is_in_patient
      }

      if (Object.keys(updateData).length === 0) {
        toast.info("No hay cambios para guardar", { duration: TOAST_DURATION })
        setEditDialogOpen(false)
        return
      }

      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "PATCH",
        body: updateData,
      })

      if (response.ok) {
        toast.success("Protocolo actualizado exitosamente", { duration: TOAST_DURATION })
        setEditDialogOpen(false)
        await refreshProtocolDetail()
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al actualizar el protocolo"))
      }
    } catch (error) {
      console.error("Error updating protocol:", error)
      const message = getErrorMessage(error, "Error al actualizar el protocolo")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const [isPreviewingReport, setIsPreviewingReport] = useState(false)

  /**
   * Ver el informe sin sacarlo.
   *
   * Usa la acción `preview` del backend, que arma EL MISMO PDF que se
   * entregaría pero no marca nada: ni los análisis como enviados, ni el
   * protocolo como impreso, ni queda un evento de entrega en la auditoría. Por
   * eso tampoco pregunta si el paciente lo recibe —no lo recibió— y no refresca
   * el detalle: no hay nada que haya cambiado.
   */
  const handlePreviewReport = async () => {
    if (!ensureCanPrintReports()) return
    setIsPreviewingReport(true)

    try {
      const response = await executeSingleReportRequest("preview")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo generar la vista previa"))
      }

      const abrio = abrirVistaPrevia(
        await response.blob(),
        `Vista previa · Protocolo #${protocol.id}`,
      )
      if (!abrio) {
        toast.error("El navegador bloqueó la ventana. Permití pop-ups para ver la vista previa.", {
          duration: TOAST_DURATION,
        })
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo generar la vista previa"), {
        duration: TOAST_DURATION,
      })
    } finally {
      setIsPreviewingReport(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!ensureCanPrintReports()) return
    setIsGeneratingReport(true)

    try {
      const response = await executeSingleReportRequest("download")

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)

        const previewLink = document.createElement("a")
        previewLink.href = url
        previewLink.target = "_blank"
        previewLink.rel = "noopener noreferrer"
        document.body.appendChild(previewLink)
        previewLink.click()
        previewLink.remove()

        // Liberar el blob URL después de darle tiempo a que cargue la vista previa.
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 30000)

        toast.success("Reporte listo para imprimir", { duration: TOAST_DURATION })
        setReportDialogOpen(false)
        // Entregar puede completar el protocolo. Sin refrescar, la pantalla
        // sigue diciendo "Pendiente de envío" sobre algo que ya salió de la cola.
        await refreshProtocolDetail()
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al generar el reporte"))
      }
    } catch (error) {
      console.error("Error generating report:", error)
      const message = getErrorMessage(error, "Error al generar el reporte")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!ensureCanPrintReports()) return
    setIsDownloadingReport(true)

    try {
      const response = await executeSingleReportRequest("download")

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const fileName = nombreDelPdf(protocol.patient, [protocol.id], reportType)

        // Crear link de descarga
        const link = document.createElement("a")
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)

        toast.success("Reporte descargado exitosamente", { duration: TOAST_DURATION })
        setReportDialogOpen(false)
        await refreshProtocolDetail()
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al descargar el reporte"))
      }
    } catch (error) {
      console.error("Error downloading report:", error)
      const message = getErrorMessage(error, "Error al descargar el reporte")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsDownloadingReport(false)
    }
  }

  const executeSendEmail = async (otroEmail: string | null = null) => {
    if (!ensureCanPrintReports()) return
    setIsSendingEmail(true)
    try {
      const { res: response, cancelado, quedoEnCola } = await pedirEnvio("email", otroEmail ? { email: otroEmail } : {})

      // Canceló: no pasó nada y eso no es una falla. Se cierra y listo.
      if (cancelado) {
        setReportDialogOpen(false)
        return
      }

      if (quedoEnCola) {
        toast.success("Queda esperando: se manda solo cuando vuelva la conexión.",
                      { duration: TOAST_DURATION })
        setReportDialogOpen(false)
        return
      }

      if (response.ok) {
        const data = await response.json()
        toast.success(data.otro_destino ? `Email enviado a ${data.email}` : data.detail || "Email enviado exitosamente", {
          duration: TOAST_DURATION,
        })
        if (data.protocol_status !== undefined) setLiveStatus(data.protocol_status)
        setReportDialogOpen(false)
        await refreshProtocolDetail()
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al enviar el email"))
      }
    } catch (error) {
      console.error("Error sending email:", error)
      const message = getErrorMessage(error, "Error al enviar el email")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const executeSendWhatsApp = async (otroNumero: string | null = null) => {
    if (!ensureCanPrintReports()) return
    setIsSendingWhatsApp(true)
    try {
      const { res: response, cancelado, quedoEnCola } = await pedirEnvio("whatsapp", otroNumero ? { phone_number: otroNumero } : {})

      // Canceló: no pasó nada y eso no es una falla. Se cierra y listo.
      if (cancelado) {
        setReportDialogOpen(false)
        return
      }

      if (quedoEnCola) {
        toast.success("Queda esperando: se manda solo cuando vuelva la conexión.",
                      { duration: TOAST_DURATION })
        setReportDialogOpen(false)
        return
      }

      if (response.ok) {
        const data = await response.json()
        toast.success(
          data.otro_destino
            ? `WhatsApp en camino a ${data.phone}. Confirmamos la entrega en unos segundos.`
            : data.detail || "WhatsApp en camino",
          { duration: TOAST_DURATION },
        )
        if (data.protocol_status !== undefined) setLiveStatus(data.protocol_status)
        setReportDialogOpen(false)
        await refreshProtocolDetail()
        onUpdate()

        // El 200 solo dice que Meta lo aceptó. El desenlace llega por webhook
        // unos segundos después; hasta entonces no se sabe si llegó.
        void seguirElWhatsApp(apiRequest, protocol.id, data.wamid, {
          alFallar: () => {
            void refreshProtocolDetail()
            onUpdate()
          },
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al enviar el WhatsApp"))
      }
    } catch (error) {
      console.error("Error sending WhatsApp:", error)
      const message = getErrorMessage(error, "Error al enviar el WhatsApp")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsSendingWhatsApp(false)
    }
  }

  const openSendConfirmation = (method: "email" | "whatsapp") => {
    if (!ensureCanPrintReports()) return
    setPendingSendMethod(method)
    setSendConfirmationOpen(true)
  }

  const handleSendEmail = () => openSendConfirmation("email")
  const handleSendWhatsApp = () => openSendConfirmation("whatsapp")

  const handleConfirmSend = async (otroDestino: string | null) => {
    setSendConfirmationOpen(false)
    const method = pendingSendMethod
    setPendingSendMethod(null)

    if (method === "email") {
      await executeSendEmail(otroDestino)
    }

    if (method === "whatsapp") {
      await executeSendWhatsApp(otroDestino)
    }
  }

  // ---------------------------------------------------------------------
  // Alta, baja y orden de los análisis de un protocolo ya creado
  // ---------------------------------------------------------------------
  //
  // Los tres refrescan el protocolo entero después de tocar: cambiar los
  // análisis cambia lo que paga el paciente, el estado y la facturación. Poner
  // al día solo la lista dejaría los totales de la pantalla mintiendo hasta
  // que alguien recargue.
  const [agregarAnalisisAbierto, setAgregarAnalisisAbierto] = useState(false)
  // Cuál pago se está corrigiendo. `null` = el diálogo está cerrado.
  const [pagoACorregir, setPagoACorregir] = useState<PagoDelProtocolo | null>(null)
  const [quitandoDetalle, setQuitandoDetalle] = useState<number | null>(null)

  /**
   * Corregir la forma de UN pago.
   *
   * Antes era un PATCH al protocolo porque la forma vivía ahí. Ahora vive en
   * cada pago, y por eso hay que decir cuál: corregir el efectivo no puede
   * tocar la transferencia que entró el mismo día.
   */
  const handleGuardarFormaDePago = async (forma: string, cuentaId: string) => {
    if (!pagoACorregir) return false
    try {
      const body: Record<string, unknown> = { payment_method: forma }
      // Efectivo y sin forma van sin cuenta: el backend rechaza un efectivo
      // con cuenta, y mandar la vieja guardaría algo que contradice la
      // pantalla.
      body.payment_account = forma === "transferencia" && cuentaId ? Number(cuentaId) : null

      const response = await apiRequest(
        PROTOCOL_ENDPOINTS.PROTOCOL_PAGO(protocol.id, pagoACorregir.id),
        { method: "PATCH", body },
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo guardar la forma de pago"))
      }
      await refreshProtocolDetail()
      onUpdate?.()
      setPagoACorregir(null)
      toast.success("Forma de pago guardada", { duration: TOAST_DURATION })
      return true
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar la forma de pago"),
        { duration: TOAST_DURATION })
      return false
    }
  }

  const handleQuitarAnalisis = async (detail: ProtocolDetailType) => {
    if (needsCompletedConfirm(() => handleQuitarAnalisis(detail))) return
    setQuitandoDetalle(detail.id)
    try {
      const response = await apiRequest(
        PROTOCOL_ENDPOINTS.DETAIL_REMOVE(protocol.id, detail.id),
        { method: "DELETE" },
      )
      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo quitar el análisis"))
      }
      await refreshProtocolDetail()
      onUpdate?.()
      toast.success("Análisis quitado", { duration: TOAST_DURATION })
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo quitar el análisis"),
        { duration: TOAST_DURATION })
    } finally {
      setQuitandoDetalle(null)
    }
  }

  const handleAgregarAnalisis = async (analysisIds: number[]) => {
    if (analysisIds.length === 0) return
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.DETAILS_ADD(protocol.id), {
        method: "POST",
        body: { items: analysisIds.map((id) => ({ analysis: id })) },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo agregar el análisis"))
      }
      await refreshProtocolDetail()
      onUpdate?.()
      toast.success(
        analysisIds.length === 1 ? "Análisis agregado" : `${analysisIds.length} análisis agregados`,
        { duration: TOAST_DURATION },
      )
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo agregar el análisis"),
        { duration: TOAST_DURATION })
    }
  }

  const handleReordenarAnalisis = async (ordenados: ProtocolDetailType[]) => {
    // Se pinta el orden nuevo enseguida y se manda después: arrastrar y ver
    // que la fila vuelve a su lugar mientras espera la red se siente roto.
    // Si el servidor lo rechaza, se recarga y queda lo que el servidor diga.
    setProtocolDetail((previo) =>
      previo ? { ...previo, details: ordenados } : previo)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.DETAILS_REORDER(protocol.id), {
        method: "POST",
        body: { detalles: ordenados.map((d) => d.id) },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo guardar el orden"))
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el orden"),
        { duration: TOAST_DURATION })
      await refreshProtocolDetail()
    }
  }

  const handleToggleAuthorization = async (detail: ProtocolDetailType) => {
    if (needsCompletedConfirm(() => handleToggleAuthorization(detail))) return
    setUpdatingDetailId(detail.id)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL_UPDATE(protocol.id, detail.id), {
        method: "PATCH",
        body: { is_authorized: !detail.is_authorized },
      })

      if (response.ok) {
        // La respuesta es el protocolo completo (detalle + status actualizado),
        // no solo la fila del análisis: hay que sacar la fila puntual de
        // `.details` en vez de mezclar el objeto entero sobre `d` (pisaría
        // `d.id` con el id del protocolo).
        const updatedProtocol: ProtocolDetailResponse | null = await response.json().catch(() => null)
        const updatedRow = updatedProtocol?.details.find((d) => d.id === detail.id)
        setProtocolDetails((prev) =>
          prev.map((d) => (d.id === detail.id ? { ...d, ...(updatedRow || { is_authorized: !detail.is_authorized }) } : d)),
        )
        if (updatedProtocol) {
          setProtocolDetail(updatedProtocol)
          setLiveStatus(updatedProtocol.status)
        }
        toast.success(`Análisis ${!detail.is_authorized ? "autorizado" : "desautorizado"} exitosamente`, {
          duration: TOAST_DURATION,
        })
        // La respuesta ya trae el protocolo completo actualizado: no hace falta
        // un refreshProtocolDetail() aparte, ni recargar toda la lista con onUpdate().
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "Error al actualizar la autorización"))
      }
    } catch (error) {
      console.error("Error updating authorization:", error)
      const message = getErrorMessage(error, "Error al actualizar la autorización")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setUpdatingDetailId(null)
    }
  }

  const handleAnalysisDialogClose = async (open: boolean) => {
    setAnalysisDialogOpen(open)
    if (!open) {
      // Refresh protocol detail when dialog closes
      await refreshProtocolDetail()
    }
  }

  const handleUncancelProtocol = async () => {
    setIsUncancelling(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.UNCANCEL(protocol.id), {
        method: "POST",
      })
      if (response.ok) {
        toast.success("Protocolo descancelado correctamente", { duration: TOAST_DURATION })
        await refreshProtocolDetail()
        onUpdate()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(extractErrorMessage(errorData, "No se pudo descancelar el protocolo"))
      }
    } catch (error) {
      console.error("Error uncancelling protocol:", error)
      const message = getErrorMessage(error, "Error al descancelar el protocolo")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsUncancelling(false)
    }
  }

  const handleOpenCoseguroDialog = async () => {
    if (needsCompletedConfirm(handleOpenCoseguroDialog)) return
    if (!protocolDetail) {
      await fetchProtocolDetail()
    }
    setCoseguroDialogOpen(true)
  }

  // Un solo camino para los tres: son todos un PATCH al protocolo y todos
  // terminan igual —refrescar el detalle y avisar—. Tres copias del mismo
  // try/catch era la otra opción.
  const parchearProtocolo = async (
    cuerpo: Record<string, unknown>,
    exito: string,
    fallo: string,
  ): Promise<boolean> => {
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "PATCH",
        body: cuerpo,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(formatApiError(data, fallo))
      }
      toast.success(exito, { duration: TOAST_DURATION })
      await fetchProtocolDetail()
      onUpdate?.()
      return true
    } catch (error) {
      toast.error(getErrorMessage(error, fallo), { duration: TOAST_DURATION })
      return false
    }
  }

  const handleAbrirMedico = async () => {
    if (!protocolDetail) await fetchProtocolDetail()
    setMedicoDialogOpen(true)
  }

  const handleCambiarMedico = async (medicoId: number) => {
    setGuardandoMedico(true)
    try {
      return await parchearProtocolo(
        { doctor: medicoId },
        "Médico actualizado",
        "No se pudo cambiar el médico.",
      )
    } finally {
      setGuardandoMedico(false)
    }
  }

  const handleAbrirObraSocial = async () => {
    if (!protocolDetail) await fetchProtocolDetail()
    setObraSocialDialogOpen(true)
  }

  const handleCambiarObraSocial = async (
    insuranceId: number | null,
    billingEntityId: number | null,
    numeroDeAfiliado: string,
  ) => {
    setGuardandoObraSocial(true)
    try {
      // `insurance` va SOLO si de verdad cambió: mandarla igual haría que el
      // backend rehiciera los precios del protocolo para corregir un dígito
      // del número de afiliado.
      const cambiaObraSocial = insuranceId !== null
      const numeroCambio = numeroDeAfiliado !== (protocolDetail?.affiliate_number || "")
      return await parchearProtocolo(
        {
          ...(cambiaObraSocial ? { insurance: insuranceId } : {}),
          ...(billingEntityId ? { billing_entity: billingEntityId } : {}),
          ...(numeroCambio ? { affiliate_number: numeroDeAfiliado } : {}),
        },
        cambiaObraSocial ? "Obra social actualizada" : "N° de afiliado actualizado",
        cambiaObraSocial
          ? "No se pudo cambiar la obra social."
          : "No se pudo cambiar el N° de afiliado.",
      )
    } finally {
      setGuardandoObraSocial(false)
    }
  }

  const handleCambiarEnvio = async (sendMethodId: string) => {
    setGuardandoEnvio(true)
    try {
      await parchearProtocolo(
        { send_method: Number(sendMethodId) },
        "Método de envío actualizado",
        "No se pudo cambiar el método de envío.",
      )
    } finally {
      setGuardandoEnvio(false)
    }
  }

  const handleAbrirEntidad = async () => {
    if (!protocolDetail) await fetchProtocolDetail()
    setEntidadDialogOpen(true)
  }

  const handleCambiarEntidad = async (entidadId: number): Promise<boolean> => {
    setGuardandoEntidad(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "PATCH",
        body: { billing_entity: entidadId },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(formatApiError(data, "No se pudo cambiar la entidad."))
      }
      toast.success("Entidad actualizada", {
        description: "El protocolo se va a presentar en la entidad elegida.",
        duration: TOAST_DURATION,
      })
      await fetchProtocolDetail()
      onUpdate?.()
      return true
    } catch (error) {
      toast.error(getErrorMessage(error), { duration: TOAST_DURATION })
      return false
    } finally {
      setGuardandoEntidad(false)
    }
  }

  const handleSetCoseguro = async (amount: number): Promise<boolean> => {
    setIsProcessingCoseguro(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.SET_COSEGURO(protocol.id), {
        method: "POST",
        body: { amount: amount.toFixed(2) },
      })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.success(data.detail || "Coseguro actualizado correctamente", { duration: TOAST_DURATION })
        await refreshProtocolDetail()
        onUpdate()
        return true
      }
      const errorData = await response.json().catch(() => ({}))
      throw new Error(extractErrorMessage(errorData, "No se pudo cargar el coseguro"))
    } catch (error) {
      console.error("Error setting coseguro:", error)
      toast.error(getErrorMessage(error, "Error al cargar el coseguro"), { duration: TOAST_DURATION })
      return false
    } finally {
      setIsProcessingCoseguro(false)
    }
  }

  const handleOpenOrderStatusDialog = async () => {
    if (needsCompletedConfirm(handleOpenOrderStatusDialog)) return
    const detail = protocolDetail || (await fetchProtocolDetail())
    if (!detail) return

    if (detail.insurance?.name?.toLowerCase() === "particular") {
      toast.info("Los protocolos particulares no requieren estado de orden médica.", { duration: TOAST_DURATION })
      return
    }

    setOrderStatusDialogOpen(true)
  }

  const handleUpdateOrderStatus = async (status: TrajoOrdenStatus): Promise<boolean> => {
    const currentStatus = normalizeTrajoOrden(protocolDetail?.trajo_orden ?? protocol.trajo_orden)
    if (status === currentStatus) {
      toast.info("La orden ya tiene ese estado", { duration: TOAST_DURATION })
      return true
    }

    setIsProcessingOrderStatus(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "PATCH",
        body: { trajo_orden: status },
      })

      if (response.ok) {
        toast.success("Estado de orden actualizado correctamente", { duration: TOAST_DURATION })
        await refreshProtocolDetail()
        onUpdate()
        return true
      }

      const errorData = await response.json().catch(() => ({}))
      throw new Error(extractErrorMessage(errorData, "No se pudo actualizar la orden"))
    } catch (error) {
      console.error("Error updating order status:", error)
      toast.error(getErrorMessage(error, "Error al actualizar la orden"), { duration: TOAST_DURATION })
      return false
    } finally {
      setIsProcessingOrderStatus(false)
    }
  }

  const handleOpenPreauthDialog = async () => {
    if (needsCompletedConfirm(handleOpenPreauthDialog)) return
    if (!protocolDetail) {
      const detail = await fetchProtocolDetail()
      if (!detail) return
    }
    setPreauthDialogOpen(true)
  }

  const handleApplyPreauthorization = async (payload: {
    preauth_status: Exclude<PreauthStatus, "not_required">
    preauth_reference?: string
    preauth_notes?: string
  }): Promise<boolean> => {
    setIsProcessingPreauth(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocol.id), {
        method: "PATCH",
        body: payload,
      })
      if (response.ok) {
        toast.success("Preautorización actualizada correctamente", { duration: TOAST_DURATION })
        await refreshProtocolDetail()
        onUpdate()
        return true
      }
      const errorData = await response.json().catch(() => ({}))
      throw new Error(extractErrorMessage(errorData, "No se pudo actualizar la preautorización"))
    } catch (error) {
      console.error("Error updating preauthorization:", error)
      toast.error(getErrorMessage(error, "Error al actualizar la preautorización"), { duration: TOAST_DURATION })
      return false
    } finally {
      setIsProcessingPreauth(false)
    }
  }

  const getPatientName = () => {
    if (protocol.patient && typeof protocol.patient === "object") {
      return `${protocol.patient.first_name || ""} ${protocol.patient.last_name || ""}`.trim() || "Sin nombre"
    }
    return "Sin nombre"
  }

  const getDoctorName = () => {
    if (protocolDetail?.doctor) {
      return `Dr. ${protocolDetail.doctor.first_name} ${protocolDetail.doctor.last_name}`.trim()
    }
    return "Cargando..."
  }

  const getInsuranceName = () => {
    if (protocolDetail?.insurance) {
      return protocolDetail.insurance.name
    }
    return "Cargando..."
  }

  const getSendMethodName = () => {
    if (protocolDetail?.send_method) {
      return protocolDetail.send_method.name
    }
    return "Cargando..."
  }

  const effectiveStatus = liveStatus ?? protocol.status
  const statusId = effectiveStatus?.id ?? 0
  const statusName = effectiveStatus?.name || "este estado"
  const isCancelled = statusId === 4
  const isCompleted = statusId === 5
  // Un protocolo COMPLETADO ahora se puede editar (el backend ya lo permite):
  // solo Cancelado bloquea de verdad. Cada cambio sobre un completado pide
  // confirmación antes (needsCompletedConfirm).
  const isLockedForChanges = isCancelled
  const isEditable = !isLockedForChanges
  // Un protocolo Completado ahora SÍ se puede cancelar (solo se excluye el que
  // ya está cancelado).
  const canBeCancelled = !isCancelled

  // Guarda de edición sobre completados: frena la acción y pide confirmar; al
  // confirmar se re-ejecuta la misma acción (con un flag de bypass puntual).
  const needsCompletedConfirm = (rerun: () => void) => {
    if (bypassCompletedGuardRef.current) {
      bypassCompletedGuardRef.current = false
      return false
    }
    if (isCompleted) {
      pendingCompletedEditRef.current = rerun
      setCompletedEditConfirmOpen(true)
      return true
    }
    return false
  }
  const handleConfirmCompletedEdit = () => {
    setCompletedEditConfirmOpen(false)
    const rerun = pendingCompletedEditRef.current
    pendingCompletedEditRef.current = null
    if (rerun) {
      bypassCompletedGuardRef.current = true
      rerun()
    }
  }
  const handleOpenUnplanned = () => {
    if (needsCompletedConfirm(handleOpenUnplanned)) return
    setUnplannedDialogOpen(true)
  }

  const showReports = !isCancelled
  const editDisabledReason = !isEditable ? `No se puede editar un protocolo en estado "${statusName}".` : undefined
  const cancelDisabledReason = !canBeCancelled ? `No se puede cancelar un protocolo en estado "${statusName}".` : undefined
  const reportsDisabledReason = !showReports
    ? "No se pueden generar ni enviar reportes de un protocolo cancelado."
    : !canPrintReports
      ? PERMISSION_MESSAGES.MANAGE_PRINTS
      : undefined
  const arcaDisabledReason = isCancelled ? "No se puede facturar ARCA para un protocolo cancelado." : undefined
  const canUncancel =
    isCancelled &&
    (user?.is_superuser ||
      hasPermission(PERMISSIONS.UNCANCEL_PROTOCOLS.codename) ||
      hasPermission("laboratory_protocols.descancelar_protocolos"))
  const isPrivateProtocol = protocolDetail?.insurance?.name?.toLowerCase() === "particular"
  const insuranceChargesCoseguro = Boolean(protocolDetail?.insurance?.charges_coseguro)
  const insuranceRequiresPreauth = Boolean(protocolDetail?.insurance?.requires_preauthorization)
  const showOrderAction = !isCancelled && !isPrivateProtocol
  const orderDisabledReason = isCancelled
    ? `No se puede modificar la orden en estado "${statusName}".`
    : undefined
  const showCoseguroAction = !isCancelled && insuranceChargesCoseguro
  const coseguroDisabledReason = isCancelled
    ? `No se puede cargar coseguro en estado "${statusName}".`
    : undefined
  const hasPreauthStatus = Boolean(protocol.preauth_status && protocol.preauth_status !== "not_required")
  const showPreauthAction = !isCancelled && (insuranceRequiresPreauth || hasPreauthStatus)
  const preauthDisabledReason = isCancelled
    ? `No se puede aplicar preautorización en estado "${statusName}".`
    : undefined

  const amountPending = protocolDetail ? Number.parseFloat(protocolDetail.amount_pending || "0") : 0
  const amountToReturn = protocolDetail ? Number.parseFloat(protocolDetail.amount_to_return || "0") : 0
  const balance = Number.parseFloat(protocol.balance || "0")
  const hasPatientDebt = amountPending > 0
  const labOwesPatient = amountToReturn > 0
  const hasBalanceToRegularize = hasPatientDebt || labOwesPatient
  const paymentDisabledReason =
    hasBalanceToRegularize && !isEditable
      ? `No se pueden registrar pagos o devoluciones en estado "${statusName}".`
      : undefined
  // El contacto del paciente para el diálogo de envío. `undefined` = el detalle
  // no trajo el dato y no se sabe; `""` = el paciente no lo tiene cargado.
  const contactoDelPaciente = protocolDetail?.patient
  const datoDeContacto = (campo: "email" | "phone_mobile" | "alt_phone") =>
    contactoDelPaciente && campo in contactoDelPaciente ? (contactoDelPaciente[campo] ?? "").trim() : undefined
  // Sin email o teléfono cargado igual se puede mandar: el diálogo de envío
  // ofrece otro destino. Por eso esos botones ya no se deshabilitan.

  const getBorderColor = (statusName: string): string => {
    return getProtocolStatusStyleByName(statusName).border
  }

  return (
    <>
      {pageMode ? (
        <ProtocolDetailView
          detail={protocolDetail ?? { id: protocol.id, status: effectiveStatus }}
          patientName={getPatientName()}
          patientAge={protocol.patient?.age}
          doctorName={getDoctorName()}
          insuranceName={getInsuranceName()}
          statusId={statusId}
          statusName={statusName}
          onReport={handleOpenReportDialog}
          onPayment={handleOpenPaymentDialog}
          onCancel={handleCancelProtocol}
          onUncancel={handleUncancelProtocol}
          onArca={handleOpenArcaDialog}
          onOrderStatus={handleOpenOrderStatusDialog}
          onPreauth={handleOpenPreauthDialog}
          onCoseguro={handleOpenCoseguroDialog}
          onEntidadDeFacturacion={handleAbrirEntidad}
          onMedico={handleAbrirMedico}
          onObraSocial={handleAbrirObraSocial}
          onHistory={() => setHistoryDialogOpen(true)}
          onUnplanned={handleOpenUnplanned}
          onToggleAuthorization={handleToggleAuthorization}
          updatingDetailId={updatingDetailId}
          onQuitarAnalisis={handleQuitarAnalisis}
          onAgregarAnalisis={() => setAgregarAnalisisAbierto(true)}
          onReordenarAnalisis={handleReordenarAnalisis}
          quitandoDetalle={quitandoDetalle}
          auditEvents={auditEvents}
          onGoResults={() => navigate(`/resultados/${protocol.id}`)}
          onGoValidation={() => navigate(`/validacion/${protocol.id}`)}
          onGoPatient={() => (protocol.patient?.id ? navigate(`/pacientes/${protocol.patient.id}`) : navigate("/pacientes"))}
          isEditable={isEditable}
          showReports={showReports}
          reportsDisabledReason={reportsDisabledReason}
          canBeCancelled={canBeCancelled}
          isCancelled={isCancelled}
          isCancelling={isCancelling}
          isUncancelling={isUncancelling}
          canUncancel={Boolean(canUncancel)}
          showOrderAction={showOrderAction}
          showPreauthAction={showPreauthAction}
          showCoseguroAction={showCoseguroAction}
        />
      ) : (
      <Card
        className={`bg-white border-l-4 ${getBorderColor(statusName)} ${
          pageMode
            ? "shadow-sm"
            : `transition-all duration-300 shadow-sm hover:shadow-lg cursor-pointer ${
                isExpanded ? "ring-2 ring-[#204983] ring-opacity-20" : ""
              } ${isSelected ? "ring-2 ring-[#204983]" : ""}`
        }`}
        onClick={handleCardClick}
      >
        <CardContent className="px-4 py-2.5 sm:py-3">
          <div className="flex items-start gap-3">
            {!pageMode && (
            <button
              type="button"
              data-no-expand
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelection?.(protocol.id)
              }}
              className="mt-1 shrink-0"
              aria-label={isSelected ? "Quitar selección" : "Seleccionar protocolo"}
              title={isSelected ? "Quitar selección" : "Seleccionar para acciones en lote"}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-[#204983] border-[#204983]"
                    : "border-gray-300 hover:border-[#204983]"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
            )}
            <div className="flex-1 min-w-0">
              <ProtocolHeader
                protocolId={protocol.id}
                status={effectiveStatus}
                patientName={getPatientName()}
                isAnonymousPatient={Boolean(protocol.patient?.is_anonymous)}
                paymentStatus={protocol.payment_status}
                balance={balance}
                isPrinted={protocol.is_printed}
                canRegisterPayment={hasPatientDebt && isEditable}
                labOwesPatient={labOwesPatient && isEditable}
                paymentDisabledReason={paymentDisabledReason}
                isExpanded={isExpanded}
                creation={protocol.creation}
                lastChange={protocol.last_change}
                onRegisterPayment={handleOpenPaymentDialog}
              />
            </div>
          </div>
        </CardContent>

        {isExpanded && (
          <CardContent className="px-4 pb-4 pt-0 border-t border-gray-100">
            {loadingDetail ? (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-20 rounded" />
                      <Skeleton className="h-5 w-full rounded" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-px w-full" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <ProtocolDetailsSection
                  patientName={getPatientName()}
                  doctorName={getDoctorName()}
                  insuranceName={getInsuranceName()}
                  affiliateNumber={protocolDetail?.affiliate_number}
                  sendMethodName={getSendMethodName()}
                  paymentStatus={protocol.payment_status}
                  balance={balance}
                  amountDue={protocolDetail?.amount_due || "0"}
                  amountPending={protocolDetail?.amount_pending || "0"}
                  patientPaid={protocolDetail?.patient_paid || "0"}
                  amountToReturn={protocolDetail?.amount_to_return || "0"}
                  insuranceUbValue={protocolDetail?.insurance_ub_value}
                  privateUbValue={protocolDetail?.private_ub_value}
                  isPrinted={protocolDetail?.is_printed}
                  trajoOrden={protocolDetail?.trajo_orden}
                  preauthStatus={protocolDetail?.preauth_status}
                  isInPatient={protocolDetail?.is_in_patient}
                  redondeo={protocolDetail?.redondeo}
                  analysesAmountDue={protocolDetail?.analyses_amount_due}
                  coseguroAmount={protocolDetail?.coseguro_amount}
                  materialDescartableAmount={protocolDetail?.material_descartable_amount}
                  derivacionAmount={protocolDetail?.derivacion_amount}
                  extrasTotal={protocolDetail?.extras_total}
                  nbu={protocolDetail?.nbu}
                  showOrderButton={showOrderAction}
                  orderDisabledReason={orderDisabledReason}
                  showPreauthButton={showPreauthAction}
                  preauthDisabledReason={preauthDisabledReason}
                  showCoseguroButton={showCoseguroAction}
                  coseguroDisabledReason={coseguroDisabledReason}
                  unplannedTransactions={protocolDetail?.unplanned_transactions}
                  unplannedChargesTotal={protocolDetail?.unplanned_charges_total}
                  unplannedPaymentsTotal={protocolDetail?.unplanned_payments_total}
                  onOpenUnplanned={handleOpenUnplanned}
                  onOpenHistoryDialog={() => setHistoryDialogOpen(true)}
                  onSetOrder={handleOpenOrderStatusDialog}
                  onApplyPreauthorization={handleOpenPreauthDialog}
                  onSetCoseguro={handleOpenCoseguroDialog}
                  pagos={protocolDetail?.pagos ?? []}
                  onCorregirPago={isEditable ? setPagoACorregir : undefined}
                />
                <ProtocolActions
                  protocolId={protocol.id}
                  canBeCancelled={canBeCancelled}
                  isCancelled={isCancelled}
                  canUncancel={Boolean(canUncancel)}
                  isEditable={isEditable}
                  // ProtocolActions ya deshabilita + muestra el tooltip cuando
                  // `showReports` es false, así que el permiso entra por acá.
                  showReports={showReports && canPrintReports}
                  showCoseguro={showCoseguroAction}
                  editDisabledReason={editDisabledReason}
                  reportsDisabledReason={reportsDisabledReason}
                  cancelDisabledReason={cancelDisabledReason}
                  arcaDisabledReason={arcaDisabledReason}
                  coseguroDisabledReason={coseguroDisabledReason}
                  isCancelling={isCancelling}
                  isUncancelling={isUncancelling}
                  isArcaBilling={isArcaBilling}
                  onViewAnalysis={handleAnalysisDialog}
                  onEdit={handleOpenEditDialog}
                  onReports={handleOpenReportDialog}
                  onCancel={handleCancelProtocol}
                  onUncancel={handleUncancelProtocol}
                  onArcaBilling={handleOpenArcaDialog}
                  onSetCoseguro={handleOpenCoseguroDialog}
                />
              </>
            )}
          </CardContent>
        )}
      </Card>
      )}

      {/* Dialogs */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        protocolId={protocol.id}
        amountDue={protocolDetail?.amount_due || "0"}
        amountPending={protocolDetail?.amount_pending || "0"}
        patientPaid={protocolDetail?.patient_paid || "0"}
        amountToReturn={protocolDetail?.amount_to_return || "0"}
        paymentStatusName={protocolDetail?.payment_status?.name || protocol.payment_status?.name || ""}
        onRegularize={handleRegularizeBalance}
        isProcessing={isProcessingPayment}
      />

      <AnalysisDialog
        open={analysisDialogOpen}
        onOpenChange={handleAnalysisDialogClose}
        protocolId={protocol.id}
        protocolNumber={protocol.id}
        details={protocolDetails}
        isLoading={loadingAnalyses}
        updatingDetailId={updatingDetailId}
        onToggleAuthorization={handleToggleAuthorization}
        isEditable={isEditable}
        readOnlyReason={editDisabledReason}
        isPrivateProtocol={isPrivateProtocol}
      />

      <FormaDePagoDialog
        open={pagoACorregir !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPagoACorregir(null)
        }}
        formaDePago={pagoACorregir?.payment_method || ""}
        cuentaDeCobroId={
          pagoACorregir?.payment_account ? String(pagoACorregir.payment_account) : ""
        }
        onGuardar={handleGuardarFormaDePago}
      />

      <AgregarAnalisisDialog
        open={agregarAnalisisAbierto}
        onOpenChange={setAgregarAnalisisAbierto}
        yaEstan={(protocolDetail?.details ?? []).map((d) => ({
          id: d.analysis,
          code: d.code,
        }))}
        onAgregar={handleAgregarAnalisis}
      />

      <AuditDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        protocolId={protocol.id}
        protocolNumber={protocol.id}
        history={protocolDetail?.history}
        totalChanges={protocolDetail?.total_changes}
        isLoading={loadingDetail}
      />

      <EditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        protocolId={protocol.id}
        formData={editFormData}
        onFormDataChange={setEditFormData}
        sendMethods={sendMethods}
        onSave={handleSaveEdit}
        isSaving={isSavingEdit}
      />

      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={handleReportDialogOpenChange}
        protocolId={protocol.id}
        reportType={reportType}
        onReportTypeChange={handleReportTypeChange}
        signed={reportSigned}
        onSignedChange={setReportSigned}
        signatureId={reportSignatureId}
        onSignatureIdChange={setReportSignatureId}
        signatures={reportSignatures}
        reportDate={reportDate}
        onReportDateChange={handleReportDateChange}
        reportTime={reportTime}
        onReportTimeChange={setReportTime}
        onClearDateTime={handleClearReportDateTime}
        analyses={protocolDetails}
        selectedAnalysisIds={selectedReportAnalysisIds}
        onToggleAnalysis={handleToggleReportAnalysis}
        onSelectAllAnalyses={handleSelectAllReportAnalyses}
        onDeselectAllAnalyses={handleDeselectAllReportAnalyses}
        customizationOpen={reportCustomizationOpen}
        onToggleCustomizationOpen={setReportCustomizationOpen}
        onPreviewReport={() => handlePreviewReport()}
        onGenerateReport={() => handleGenerateReport()}
        onDownloadReport={() => handleDownloadReport()}
        onSendEmail={handleSendEmail}
        onSendWhatsApp={handleSendWhatsApp}
        sendMethodName={protocolDetail?.send_method?.name || ""}
        sendMethods={sendMethods}
        sendMethodId={protocolDetail?.send_method?.id ? String(protocolDetail.send_method.id) : ""}
        onSendMethodChange={handleCambiarEnvio}
        savingSendMethod={guardandoEnvio}
        isPreviewing={isPreviewingReport}
        isGenerating={isGeneratingReport}
        isDownloading={isDownloadingReport}
        isSending={isSendingEmail}
        isSendingWhatsApp={isSendingWhatsApp}
      />

      <EnviarInformeDialog
        open={sendConfirmationOpen}
        onOpenChange={(open) => {
          setSendConfirmationOpen(open)
          if (!open) setPendingSendMethod(null)
        }}
        metodo={pendingSendMethod}
        protocolId={protocol.id}
        patientName={getPatientName()}
        email={datoDeContacto("email")}
        telefono={datoDeContacto("phone_mobile")}
        telefonoAlternativo={datoDeContacto("alt_phone")}
        tipoDeInforme={reportType}
        onConfirm={handleConfirmSend}
      />

      <AlertDialog
        open={completedEditConfirmOpen}
        onOpenChange={(open) => {
          setCompletedEditConfirmOpen(open)
          if (!open) pendingCompletedEditRef.current = null
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Protocolo completado</AlertDialogTitle>
            <AlertDialogDescription>
              Este protocolo ya está <strong>completado</strong>. Igual podés modificarlo
              (cargar pagos, cambiar la orden, coseguro, análisis, etc.), pero tené en
              cuenta que el cambio puede recalcular su estado. ¿Querés continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { pendingCompletedEditRef.current = null }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCompletedEdit}
              className="bg-[#204983] text-white hover:bg-[#1a3d6f]"
            >
              Sí, modificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProtocolHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        protocolId={protocol.id}
        protocolNumber={protocol.id}
        history={protocolDetail?.history}
        totalChanges={protocolDetail?.total_changes}
        isLoading={loadingDetail}
      />

      <CoseguroDialog
        open={coseguroDialogOpen}
        onOpenChange={setCoseguroDialogOpen}
        protocolId={protocol.id}
        currentCoseguro={protocolDetail?.coseguro_amount || "0"}
        insuranceChargesCoseguro={insuranceChargesCoseguro}
        onConfirm={handleSetCoseguro}
        isProcessing={isProcessingCoseguro}
      />

      <MedicoDialog
        open={medicoDialogOpen}
        onOpenChange={setMedicoDialogOpen}
        medicoActual={protocolDetail?.doctor ?? null}
        onGuardar={handleCambiarMedico}
        procesando={guardandoMedico}
      />

      <ObraSocialDialog
        open={obraSocialDialogOpen}
        onOpenChange={setObraSocialDialogOpen}
        obraSocialActual={protocolDetail?.insurance ?? null}
        entidadActualId={protocolDetail?.billing_entity?.id ?? null}
        numeroDeAfiliadoActual={protocolDetail?.affiliate_number || ""}
        pacienteId={protocol.patient?.id ?? null}
        onGuardar={handleCambiarObraSocial}
        procesando={guardandoObraSocial}
      />

      <EntidadDeFacturacionDialog
        open={entidadDialogOpen}
        onOpenChange={setEntidadDialogOpen}
        entidadActualId={protocolDetail?.billing_entity?.id ?? null}
        nombreDeLaObraSocial={protocolDetail?.insurance?.name}
        onGuardar={handleCambiarEntidad}
        procesando={guardandoEntidad}
      />

      <UnplannedTransactionsDialog
        open={unplannedDialogOpen}
        onOpenChange={setUnplannedDialogOpen}
        protocolId={protocol.id}
        isEditable={isEditable}
        onChanged={() => {
          void refreshProtocolDetail()
        }}
        onStatusChange={(status) => setLiveStatus(status)}
      />

      <OrderStatusDialog
        open={orderStatusDialogOpen}
        onOpenChange={setOrderStatusDialogOpen}
        protocolId={protocol.id}
        currentStatus={protocolDetail?.trajo_orden ?? protocol.trajo_orden}
        onConfirm={handleUpdateOrderStatus}
        isProcessing={isProcessingOrderStatus}
      />

      <PreauthorizationDialog
        open={preauthDialogOpen}
        onOpenChange={setPreauthDialogOpen}
        protocolId={protocol.id}
        currentStatus={protocolDetail?.preauth_status}
        currentReference={protocolDetail?.preauth_reference}
        currentNotes={protocolDetail?.preauth_notes}
        onConfirm={handleApplyPreauthorization}
        isProcessing={isProcessingPreauth}
      />

      <ArcaBillingDialog
        open={arcaDialogOpen}
        onOpenChange={setArcaDialogOpen}
        protocolId={protocol.id}
        patientName={getPatientName()}
        patientDni={protocol.patient?.dni}
        invoicePdfUrl={arcaInvoicePdfUrl ?? protocolDetail?.arca_invoice_pdf_url ?? null}
        arcaCae={protocolDetail?.arca_cae}
        arcaCbteNumber={protocolDetail?.arca_cbte_number ?? null}
        isAlreadyBilled={Boolean(protocolDetail?.is_arca_billed)}
        onConfirm={handleArcaBilling}
        isProcessing={isArcaBilling}
      />
    </>
  )
}
