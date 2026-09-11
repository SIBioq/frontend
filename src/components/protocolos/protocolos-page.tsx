"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { pedirInforme } from "@/components/contingencia/enviar-informe"
import { seguirElWhatsApp } from "@/lib/seguimiento-de-whatsapp"
import { useQueryClient } from "@tanstack/react-query"
import {
  Search,
  Plus,
  Filter,
  Calendar,
  User,
  FileText,
  Loader2,
  AlertCircle,
  X,
  CheckCircle,
  Clock,
  Ban,
  AlertTriangle,
  Mail,
  PenLine,
} from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Skeleton } from "../ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { ProtocolsTable } from "./components/protocols-table"
import { BatchActionBar } from "./components/batch-action-bar"
import { EnviarInformeDialog } from "./components/dialogs/enviar-informe-dialog"
import { cuerpoDelDestino, type DestinoElegido } from "@/lib/destino-del-envio"
import { useProtocolQuickActions } from "./components/use-protocol-quick-actions"
import { useAuth } from "@/contexts/auth-context"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import type { SortState } from "@/components/common/data-table"
import { useApi } from "../../hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { useApiInfiniteQuery, flattenPages } from "@/hooks/use-api-infinite-query"
import { NavegadorDeDias } from "./components/navegador-de-dias"
import { comoFechaCorta } from "@/lib/dias"
import { guardarOrdenDeLaLista } from "@/hooks/use-protocol-list-nav"
import { useInfiniteScroll } from "../../hooks/use-infinite-scroll"
import { useDebounce } from "../../hooks/use-debounce"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { PROTOCOL_ENDPOINTS, ANALYTICS_ENDPOINTS, REPORTING_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import type { ProtocolListItem, ReportSignature } from "@/types"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { nombreDelLote, nombreDelPdf } from "@/lib/nombre-del-pdf"
import { abrirVistaPrevia, paginasDelPdf } from "@/lib/ventana-de-vista-previa"
import {
  getProtocolStatusStyleByName,
  normalizeProtocolStatusName,
} from "@/lib/status-styles"

interface ProtocolsByStatusResponse {
  total_protocols: number
  states: Array<{
    status_id: number
    status_name: string
    count: number
  }>
}

const STATUS_FILTER_KEY = "labsalud_protocol_status_filters"
const HIDDEN_PROTOCOL_STATUS_NAMES = new Set(["pendiente de facturacion", "facturado"])
type ReportAction = "download" | "email" | "whatsapp"
type MergeReportAction = "print" | ReportAction
type BatchReportAction = "print" | ReportAction

const getStatusIcon = (statusName: string) => {
  switch (normalizeProtocolStatusName(statusName)) {
    case "pendiente de validacion":
      return Filter
    case "pendiente de revision":
      return PenLine
    case "pago incompleto":
      return Calendar
    case "pendiente de retiro":
      return User
    case "completado":
      return CheckCircle
    case "cancelado":
      return Ban
    case "envio fallido":
      return AlertTriangle
    case "pendiente de envio":
      return Mail
    case "informacion faltante":
      return AlertCircle
    default:
      return Clock
  }
}

export default function ProtocolosPage() {
  const { apiRequest } = useApi()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Estados principales
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  type StatusFilterState = { include: number[]; exclude: number[] }
  const [statusFilter, setStatusFilter] = useState<StatusFilterState>(() => {
    try {
      const saved = localStorage.getItem(STATUS_FILTER_KEY)
      if (!saved) return { include: [], exclude: [] }
      const parsed = JSON.parse(saved)
      // Compat: previously stored as number[] (only includes)
      if (Array.isArray(parsed)) {
        return { include: parsed.filter((s) => Number.isInteger(s)), exclude: [] }
      }
      const include = Array.isArray(parsed.include) ? parsed.include.filter((s: unknown) => Number.isInteger(s)) : []
      const exclude = Array.isArray(parsed.exclude) ? parsed.exclude.filter((s: unknown) => Number.isInteger(s)) : []
      return { include, exclude }
    } catch {
      return { include: [], exclude: [] }
    }
  })
  const [isPrintedFilter, setIsPrintedFilter] = usePersistedState<string>("labsalud_protocols_printed_filter", "all")
  const [paymentStatusFilter, setPaymentStatusFilter] = usePersistedState<string>("labsalud_protocols_payment_filter", "all")
  const [sort, setSort] = useState<SortState>(null)

  // Selección batch (el checkbox está siempre visible; el modo se infiere de la selección)
  const [selectedProtocols, setSelectedProtocols] = useState<Set<number>>(new Set())
  const isSelectionMode = selectedProtocols.size > 0
  const [batchReportType, setBatchReportType] = useState<"full" | "summary">("full")
  const [batchSigned, setBatchSigned] = useState(true)
  const [batchDate, setBatchDate] = useState("")
  // El horario del informe, como en el de un protocolo: `HH:MM`, opcional.
  const [batchTime, setBatchTime] = useState("")
  const [batchSignatureId, setBatchSignatureId] = useState("default")
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)

  // Debounce para la búsqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Estadísticas por estado vía React Query — cache 30s, refetch en window focus.
  const stateStatsQuery = useApiQuery<ProtocolsByStatusResponse>({
    queryKey: ["analytics", "protocols-by-status"],
    url: ANALYTICS_ENDPOINTS.PROTOCOLS_BY_STATUS,
    staleTime: 30 * 1000,
  })
  const rawStatusItems = useMemo(
    () =>
      (stateStatsQuery.data?.states || [])
        .filter((state) => !HIDDEN_PROTOCOL_STATUS_NAMES.has(normalizeProtocolStatusName(state.status_name)))
        .map((state) => ({
          id: state.status_id,
          name: state.status_name,
          count: state.count,
          icon: getStatusIcon(state.status_name),
        })),
    [stateStatsQuery.data],
  )
  const cancelledStatusId = rawStatusItems.find((item) => normalizeProtocolStatusName(item.name) === "cancelado")?.id
  const cancelledCountQuery = useApiQuery<{ count: number }>({
    queryKey: ["protocols", "status-count", "cancelado", cancelledStatusId],
    url: `${PROTOCOL_ENDPOINTS.PROTOCOLS}?limit=1&status=${cancelledStatusId || ""}`,
    enabled: Boolean(cancelledStatusId),
    staleTime: 30 * 1000,
  })
  const statusItems = useMemo(
    () =>
      rawStatusItems.map((item) =>
        normalizeProtocolStatusName(item.name) === "cancelado"
          ? { ...item, count: cancelledCountQuery.data?.count ?? item.count }
          : item,
      ),
    [rawStatusItems, cancelledCountQuery.data],
  )
  const availableStatusIds = useMemo(() => statusItems.map((item) => item.id), [statusItems])
  const activeProtocolsCount = useMemo(() => {
    const total = stateStatsQuery.data?.total_protocols
    if (typeof total !== "number") return null
    const cancelledFromAnalytics =
      rawStatusItems.find((item) => normalizeProtocolStatusName(item.name) === "cancelado")?.count ?? 0
    return Math.max(0, total - cancelledFromAnalytics)
  }, [stateStatsQuery.data, rawStatusItems])

  const fetchStateStats = useCallback(() => {
    stateStatsQuery.refetch()
    if (cancelledStatusId) cancelledCountQuery.refetch()
  }, [stateStatsQuery, cancelledCountQuery, cancelledStatusId])

  const signaturesQuery = useApiQuery<{ results?: ReportSignature[] } | ReportSignature[]>({
    queryKey: ["reporting", "signatures"],
    url: REPORTING_ENDPOINTS.SIGNATURES,
    staleTime: 5 * 60 * 1000,
  })
  const reportSignatures: ReportSignature[] = Array.isArray(signaturesQuery.data)
    ? signaturesQuery.data
    : signaturesQuery.data?.results || []

  // El día que se está mirando, o null para el listado completo. Arranca en
  // null: entrar a Protocolos sigue mostrando todo, y ver un día es algo que
  // se pide, no algo que se hereda de la sesión anterior.
  const [dia, setDia] = useState<string | null>(null)

  // Los separadores de día solo tienen sentido con la lista en orden
  // cronológico. Ordenada por apellido, las fechas quedan salteadas y una
  // línea que dice "de acá para abajo son del 21" estaría mintiendo. `sort`
  // en null es el default del backend, que es `-created_at`.
  const ordenadoPorFecha = !sort || sort.field === "created_at" || sort.field === "id"

  const buildUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        limit: "20",
        offset: offset.toString(),
        // Vista tabla densa: serializer slim del backend (sin breakdown de pago,
        // sin auditoría, sin unplanned). Mucho más liviano por fila.
        view: "table",
      })

      if (debouncedSearchTerm.trim()) {
        params.append("search", debouncedSearchTerm.trim())
      }

      if (sort) {
        params.append("ordering", `${sort.dir === "desc" ? "-" : ""}${sort.field}`)
      }

      if (statusFilter.include.length > 0) {
        params.append("status", statusFilter.include.join(","))
      }
      if (statusFilter.exclude.length > 0) {
        params.append("exclude_status", statusFilter.exclude.join(","))
      }

      if (isPrintedFilter !== "all") {
        params.append("is_printed", isPrintedFilter)
      }

      if (paymentStatusFilter !== "all") {
        params.append("payment_status", paymentStatusFilter)
      }

      // El corte del día lo hace el backend en la zona del laboratorio. Traer
      // todo y filtrar acá sería pedir miles de filas para tirarlas.
      if (dia) {
        params.append("fecha", dia)
      }

      return `${PROTOCOL_ENDPOINTS.PROTOCOLS}?${params.toString()}`
    },
    [debouncedSearchTerm, statusFilter, isPrintedFilter, paymentStatusFilter, sort, dia],
  )

  // queryKey estable por combinación de filtros: cachea cada vista (ej. volver
  // de un detalle a la misma búsqueda/filtro) sin pedirle todo de nuevo al
  // backend. `keepPrevious` evita el blanco+skeleton al cambiar de filtro.
  const protocolsQueryKey = [
    "protocols",
    "list",
    debouncedSearchTerm.trim(),
    statusFilter.include.slice().sort((a, b) => a - b).join(","),
    statusFilter.exclude.slice().sort((a, b) => a - b).join(","),
    isPrintedFilter,
    paymentStatusFilter,
    sort ? `${sort.dir}:${sort.field}` : "",
    dia ?? "",
  ] as const

  const protocolsQuery = useApiInfiniteQuery<ProtocolListItem>({
    queryKey: protocolsQueryKey,
    buildUrl,
    keepPrevious: true,
  })

  const allProtocols = flattenPages<ProtocolListItem>(protocolsQuery.data?.pages)

  // EL ORDEN QUE SE ESTÁ VIENDO, GUARDADO PARA EL DETALLE
  // La píldora del detalle salta al protocolo de la fila de arriba o la de
  // abajo, y esa fila la definen la búsqueda y el orden de la tabla, que viven
  // acá y no sobreviven a la navegación. Por eso se anota desde esta pantalla.
  const idsALaVista = allProtocols.map((p) => p.id).join(",")
  const paginaSiguiente =
    protocolsQuery.data?.pages?.[protocolsQuery.data.pages.length - 1]?.next ?? null
  useEffect(() => {
    if (!idsALaVista) return
    guardarOrdenDeLaLista(idsALaVista.split(",").map(Number), paginaSiguiente)
  }, [idsALaVista, paginaSiguiente])
  const isInitialLoading = protocolsQuery.isLoading
  // Fetching pero ya con datos previos en pantalla (búsqueda/filtro cambiando
  // o refetch en background): spinner sutil sin vaciar la tabla.
  const isSearching = protocolsQuery.isFetching && !protocolsQuery.isLoading && !protocolsQuery.isFetchingNextPage
  const isLoadingMore = protocolsQuery.isFetchingNextPage
  const hasMore = Boolean(protocolsQuery.hasNextPage)
  const error = protocolsQuery.isError ? "Error al cargar los protocolos. Por favor, intenta nuevamente." : null

  // Aplica el estado nuevo (ya devuelto por la respuesta de la acción) a una o
  // varias filas de la lista, en cualquier combinación de filtros cacheada,
  // sin pedirle al backend toda la página de nuevo.
  const applyStatusUpdates = useCallback(
    (
      updates: Array<{
        id: number
        status: ProtocolListItem["status"] | null
        payment_status?: ProtocolListItem["payment_status"] | null
      }>,
    ) => {
      if (updates.length === 0) return
      const byId = new Map(updates.map((u) => [u.id, u]))
      queryClient.setQueriesData<{ pages: Array<{ results: ProtocolListItem[]; next: string | null }> }>(
        { queryKey: ["protocols", "list"] },
        (data) => {
          if (!data) return data
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              results: page.results.map((p) => {
                const u = byId.get(p.id)
                if (!u) return p
                // Aplicamos estado y —si vino— estado de pago, así registrar un
                // pago desde la lista refresca ambos badges sin recargar.
                return {
                  ...p,
                  status: u.status ?? p.status,
                  payment_status: u.payment_status ?? p.payment_status,
                }
              }),
            })),
          }
        },
      )
    },
    [queryClient],
  )

  // Acciones rápidas de fila (pago / imprimir / enviar). Si la respuesta trae
  // el estado nuevo lo aplicamos directo; si no, recargamos el listado.
  const quickActions = useProtocolQuickActions((statusUpdate) => {
    if (statusUpdate) {
      applyStatusUpdates([statusUpdate])
    } else {
      protocolsQuery.refetch()
    }
  })

  const { user, hasPermission } = useAuth()
  const canUncancel = Boolean(user?.is_superuser || hasPermission(PERMISSIONS.UNCANCEL_PROTOCOLS.codename))
  // Todas las acciones de la barra en lote (imprimir / descargar / email /
  // WhatsApp / unificado) pegan a endpoints de reporte: van todas detrás del
  // mismo permiso. El listado y el detalle siguen abiertos.
  const canPrintReports = quickActions.canPrintReports
  const batchDisabledReason = canPrintReports ? undefined : PERMISSION_MESSAGES.MANAGE_PRINTS

  // Cargar más protocolos (scroll infinito)
  const loadMore = useCallback(() => {
    if (!protocolsQuery.isFetchingNextPage && protocolsQuery.hasNextPage) {
      protocolsQuery.fetchNextPage()
    }
  }, [protocolsQuery])

  // Hook de scroll infinito
  const sentinelRef = useInfiniteScroll({
    loading: isLoadingMore || isSearching,
    hasMore: hasMore,
    onLoadMore: loadMore,
    dependencies: [hasMore],
  })

  // Estadísticas por estado: refetch explícito además del automático al
  // montar (usado también tras acciones batch para refrescar los conteos).
  useEffect(() => {
    fetchStateStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(STATUS_FILTER_KEY, JSON.stringify(statusFilter))
  }, [statusFilter])

  useEffect(() => {
    if (availableStatusIds.length === 0) return
    setStatusFilter((prev) => ({
      include: prev.include.filter((id) => availableStatusIds.includes(id)),
      exclude: prev.exclude.filter((id) => availableStatusIds.includes(id)),
    }))
  }, [availableStatusIds])

  const clearSearch = () => {
    setSearchTerm("")
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  const handleNewProtocol = () => {
    navigate("/ingreso")
  }

  const toggleStatus = (statusId: number) => {
    if (availableStatusIds.length > 0 && !availableStatusIds.includes(statusId)) return
    setStatusFilter((prev) => {
      const inInclude = prev.include.includes(statusId)
      const inExclude = prev.exclude.includes(statusId)
      // neutral → include → exclude → neutral
      if (!inInclude && !inExclude) {
        return { ...prev, include: [...prev.include, statusId] }
      }
      if (inInclude) {
        return {
          include: prev.include.filter((id) => id !== statusId),
          exclude: [...prev.exclude, statusId],
        }
      }
      // inExclude
      return { ...prev, exclude: prev.exclude.filter((id) => id !== statusId) }
    })
  }
  const getStatusFilterState = (statusId: number): "neutral" | "include" | "exclude" => {
    if (statusFilter.include.includes(statusId)) return "include"
    if (statusFilter.exclude.includes(statusId)) return "exclude"
    return "neutral"
  }
  const hasAnyStatusFilter = statusFilter.include.length > 0 || statusFilter.exclude.length > 0

  const toggleProtocolSelection = useCallback((id: number) => {
    setSelectedProtocols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = () => {
    setSelectedProtocols(new Set(allProtocols.map((p) => p.id)))
  }

  const deselectAll = () => {
    setSelectedProtocols(new Set())
  }

  const handleBatchReportTypeChange = (type: "full" | "summary") => {
    setBatchReportType(type)
    setBatchSigned(type === "full")
  }

  const getBatchSignaturePayload = () =>
    batchSigned && batchSignatureId !== "default" ? { signature_id: Number(batchSignatureId) } : {}

  // Lo que tiene que cumplirse para unificar. Se revisa antes de preguntar a
  // dónde mandarlo: no tiene sentido elegir destino para algo que no sale.
  const sePuedeUnificar = () => {
    if (!canPrintReports) {
      toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
      return false
    }
    if (selectedProtocols.size < 2) {
      toast.error("Seleccioná al menos 2 protocolos del mismo paciente.", { duration: TOAST_DURATION })
      return false
    }
    const ids = Array.from(selectedProtocols)
    const patientIds = new Set(
      allProtocols.filter((p) => ids.includes(p.id)).map((p) => p.patient?.id).filter((id): id is number => typeof id === "number"),
    )
    if (patientIds.size > 1) {
      toast.error("Todos los protocolos deben ser del mismo paciente para unificar el reporte.", { duration: TOAST_DURATION })
      return false
    }
    return true
  }

  const handleMergeReport = async (action: MergeReportAction, destino: Record<string, string> = {}) => {
    if (!sePuedeUnificar()) return
    const ids = Array.from(selectedProtocols)

    setIsBatchProcessing(true)
    try {
      const endpointAction: ReportAction = action === "print" ? "download" : action
      const { res: response, cancelado, quedoEnCola } = await pedirInforme(
        apiRequest, PROTOCOL_ENDPOINTS.MERGE_REPORT, {
          protocol_ids: ids,
          // A dónde: el paciente, su alternativo u otro destino. Ver `cuerpoDelDestino`.
          ...destino,
          action: endpointAction,
          type: batchReportType,
          signed: batchSigned,
          ...(batchDate ? { protocol_date: batchDate } : {}),
          ...(batchTime ? { protocol_time: batchTime } : {}),
          ...getBatchSignaturePayload(),
        })

      // Un lote también puede quedar en cola: son los mismos envíos, muchos de
      // una vez. Cancelar acá no deja nada esperando.
      if (cancelado) {
        toast.info("El envío se canceló.")
        return
      }
      if (quedoEnCola) {
        toast.success("Queda esperando: se manda solo cuando vuelva la conexión.")
        return
      }

      if (response.ok) {
        if (action === "print" || action === "download") {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)

          if (action === "print") {
            const previewLink = document.createElement("a")
            previewLink.href = url
            previewLink.target = "_blank"
            previewLink.rel = "noopener noreferrer"
            document.body.appendChild(previewLink)
            previewLink.click()
            previewLink.remove()
            setTimeout(() => {
              window.URL.revokeObjectURL(url)
            }, 30000)
            toast.success("Reporte unificado listo para imprimir", { duration: TOAST_DURATION })
          } else {
            const a = document.createElement("a")
            a.href = url
            // El unificado es de un solo paciente (se controló arriba): lleva
            // su nombre y los números de todos los protocolos.
            const paciente = allProtocols.find((p) => ids.includes(p.id))?.patient
            a.download = nombreDelPdf(paciente, ids, batchReportType)
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            toast.success("Reporte unificado descargado", { duration: TOAST_DURATION })
          }
        } else {
          const data = await response.json().catch(() => ({}))
          toast.success(data.detail || "Reporte unificado enviado", { duration: TOAST_DURATION })
          // El envío puede completar el protocolo (pasa a "Completado"): la
          // respuesta trae el estado nuevo de cada uno combinado.
          const statuses = (data.protocol_statuses || []) as Array<{ protocol_id: number; status: ProtocolListItem["status"] | null }>
          applyStatusUpdates(statuses.map((s) => ({ id: s.protocol_id, status: s.status })))

          // El unificado es UN mensaje con varios protocolos adentro: si falla,
          // fallan todos. Alcanza con seguirlo una vez.
          if (action === "whatsapp" && statuses.length > 0) {
            void seguirElWhatsApp(apiRequest, statuses[0].protocol_id, data.wamid, {
              alFallar: () => { void protocolsQuery.refetch() },
            })
          }
        }
        setSelectedProtocols(new Set())
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "No se pudo generar el reporte unificado"))
      }
    } catch (error) {
      console.error("Error merge report:", error)
      toast.error(getErrorMessage(error, "Error al generar el reporte unificado"), { duration: TOAST_DURATION })
    } finally {
      setIsBatchProcessing(false)
    }
  }

  /**
   * La vista previa del lote: el mismo PDF que se imprimiría, pero sin marcar
   * nada, igual que la del informe de un protocolo. No se lo manda por
   * `pedirInforme`: mirar no es un envío, no tiene sentido dejarlo en cola.
   * Tampoco limpia la selección: después de mirar, lo que sigue es sacarlo.
   */
  const handleBatchPreview = async () => {
    if (!canPrintReports) {
      toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
      return
    }
    if (selectedProtocols.size === 0) return

    setIsBatchProcessing(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.REPORT_BATCH, {
        method: "POST",
        body: {
          protocol_ids: Array.from(selectedProtocols),
          action: "preview",
          type: batchReportType,
          signed: batchSigned,
          ...(batchDate ? { protocol_date: batchDate } : {}),
          ...(batchTime ? { protocol_time: batchTime } : {}),
          ...getBatchSignaturePayload(),
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "No se pudo generar la vista previa"))
      }
      const abrio = abrirVistaPrevia(
        await response.blob(),
        `Vista previa · ${selectedProtocols.size} protocolos`,
        paginasDelPdf(response),
      )
      if (!abrio) {
        toast.error("El navegador bloqueó la ventana. Permití pop-ups para ver la vista previa.", {
          duration: TOAST_DURATION,
        })
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo generar la vista previa"), { duration: TOAST_DURATION })
    } finally {
      setIsBatchProcessing(false)
    }
  }

  const handleBatchAction = async (action: BatchReportAction, destino: Record<string, string> = {}) => {
    if (!canPrintReports) {
      toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
      return
    }
    if (selectedProtocols.size === 0) return

    setIsBatchProcessing(true)
    try {
      const endpointAction: ReportAction = action === "print" ? "download" : action
      const { res: response, cancelado, quedoEnCola } = await pedirInforme(
        apiRequest, PROTOCOL_ENDPOINTS.REPORT_BATCH, {
          protocol_ids: Array.from(selectedProtocols),
          // A dónde: cada paciente, el alternativo de cada uno, o todos a otro destino.
          ...destino,
          action: endpointAction,
          type: batchReportType,
          signed: batchSigned,
          ...(batchDate ? { protocol_date: batchDate } : {}),
          ...(batchTime ? { protocol_time: batchTime } : {}),
          ...getBatchSignaturePayload(),
        })

      // Un lote también puede quedar en cola: son los mismos envíos, muchos de
      // una vez. Cancelar acá no deja nada esperando.
      if (cancelado) {
        toast.info("El envío se canceló.")
        return
      }
      if (quedoEnCola) {
        toast.success("Queda esperando: se manda solo cuando vuelva la conexión.")
        return
      }

      if (response.ok) {
        if (action === "print" || action === "download") {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)

          if (action === "print") {
            const previewLink = document.createElement("a")
            previewLink.href = url
            previewLink.target = "_blank"
            previewLink.rel = "noopener noreferrer"
            document.body.appendChild(previewLink)
            previewLink.click()
            previewLink.remove()
            setTimeout(() => {
              window.URL.revokeObjectURL(url)
            }, 30000)
            toast.success("Reportes listos para imprimir", { duration: TOAST_DURATION })
          } else {
            const a = document.createElement("a")
            a.href = url
            // Los números de los seleccionados. Si el servidor salteó alguno,
            // lo avisa en una cabecera que el navegador no deja leer desde
            // otro origen; el nombre del backend (`nombre_del_lote`) sí lo excluye.
            a.download = nombreDelLote(Array.from(selectedProtocols), batchReportType)
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            toast.success("Reportes descargados exitosamente", { duration: TOAST_DURATION })
          }
        } else {
          const data = await response.json()
          const successCount = data.successes?.length || 0
          const errorCount = data.errors?.length || 0
          if (errorCount > 0) {
            toast.warning(
              `${successCount} enviados, ${errorCount} con error`,
              { duration: TOAST_DURATION },
            )
          } else if (action === "whatsapp") {
            // "Enviados" en un lote de WhatsApp es todavía menos cierto que en
            // un envío suelto: son N mensajes que Meta aceptó, y cualquiera de
            // ellos puede fallar después.
            toast.success(
              `${successCount} informes en camino por WhatsApp. Avisamos si alguno no llega.`,
              { duration: TOAST_DURATION },
            )
          } else {
            toast.success(
              `${successCount} reportes enviados por email`,
              { duration: TOAST_DURATION },
            )
          }
          // El envío puede completar el protocolo (pasa a "Completado"): cada
          // item exitoso trae el estado nuevo de ese protocolo.
          const successes = (data.successes || []) as Array<{ protocol_id: number; status?: ProtocolListItem["status"] | null; wamid?: string | null }>
          applyStatusUpdates(
            successes.filter((s) => s.status !== undefined).map((s) => ({ id: s.protocol_id, status: s.status ?? null })),
          )

          // Cada mensaje del lote se sigue por separado: el que falle vuelve
          // solo a "Pendiente de envío" y se avisa cuál fue.
          if (action === "whatsapp") {
            for (const enviado of successes) {
              void seguirElWhatsApp(apiRequest, enviado.protocol_id, enviado.wamid, {
                alFallar: () => { void protocolsQuery.refetch() },
              })
            }
          }
        }
        setSelectedProtocols(new Set())
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(formatApiError(errorData, "Error al procesar los reportes"))
      }
    } catch (error) {
      console.error("Error batch action:", error)
      const message = getErrorMessage(error, "Error al procesar los reportes")
      toast.error(message, { duration: TOAST_DURATION })
    } finally {
      setIsBatchProcessing(false)
    }
  }

  // MAIL Y WHATSAPP DEL LOTE: PRIMERO, A DÓNDE.
  // Igual que el envío de un protocolo, el lote y el unificado preguntan si va
  // a cada paciente, a su alternativo o todos a otro destino. Imprimir y
  // descargar no le mandan nada a nadie, así que no preguntan.
  const [envioDelLote, setEnvioDelLote] = useState<{ tipo: "lote" | "unificado"; metodo: "email" | "whatsapp" } | null>(null)

  const alElegirAccionDelLote = (action: BatchReportAction) => {
    if (action === "email" || action === "whatsapp") {
      if (!canPrintReports) {
        toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
        return
      }
      if (selectedProtocols.size > 0) setEnvioDelLote({ tipo: "lote", metodo: action })
      return
    }
    void handleBatchAction(action)
  }

  const alElegirUnificado = (action: MergeReportAction) => {
    if (action === "email" || action === "whatsapp") {
      if (sePuedeUnificar()) setEnvioDelLote({ tipo: "unificado", metodo: action })
      return
    }
    void handleMergeReport(action)
  }

  const alConfirmarElDestinoDelLote = (destino: DestinoElegido) => {
    const pedido = envioDelLote
    setEnvioDelLote(null)
    if (!pedido) return
    const cuerpo = cuerpoDelDestino(pedido.metodo, destino)
    if (pedido.tipo === "lote") void handleBatchAction(pedido.metodo, cuerpo)
    else void handleMergeReport(pedido.metodo, cuerpo)
  }

  // El unificado es de un solo paciente: su nombre va en las opciones.
  const pacienteDelUnificado = (() => {
    const primero = allProtocols.find((p) => selectedProtocols.has(p.id))
    return primero?.patient ? `${primero.patient.first_name ?? ""} ${primero.patient.last_name ?? ""}`.trim() : undefined
  })()

  if (error) {
    return (
      <div className="w-full py-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Gestión de Protocolos</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
            <Button onClick={() => protocolsQuery.refetch()} className="mt-3 bg-[#204983]" size="sm">
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-4 md:p-6">
        {/* Fila superior: título · búsqueda · día · filtros.
            El navegador de días entró acá, así que la búsqueda cede ancho
            (sigue con flex-1, pero con min-w-0 para poder achicarse de
            verdad) y Filtros pasó de w-52 a lo que ocupa su texto. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <div className="lg:w-44 lg:shrink-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Protocolos</h1>
            <p className="text-sm text-gray-500">
              {activeProtocolsCount != null ? `${activeProtocolsCount} activos` : `${allProtocols.length} protocolos`}
              {searchTerm && ` · ${allProtocols.length} resultados`}
            </p>
          </div>
          <div className="relative w-full min-w-0 lg:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar por ID, paciente o estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-11 pr-10"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-[#204983]" />
              </div>
            )}
          </div>
          <NavegadorDeDias dia={dia} onChange={setDia} className="w-full lg:w-auto lg:shrink-0" />

          <div className="lg:shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 w-full justify-center gap-2 lg:w-auto lg:px-3">
                  <Filter className="h-4 w-4" />
                  <span className="lg:sr-only xl:not-sr-only">Filtros</span>
                  {(isPrintedFilter !== "all" || paymentStatusFilter !== "all") && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-[#204983]" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Informe</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { value: "all", label: "Todos" },
                      { value: "true", label: "Enviado" },
                      { value: "false", label: "No env." },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIsPrintedFilter(opt.value)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          isPrintedFilter === opt.value
                            ? "border-[#204983] bg-[#204983] text-white"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pago</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { value: "all", label: "Todos" },
                      { value: "1", label: "Saldo en cero" },
                      { value: "2", label: "Paciente debe" },
                      { value: "3", label: "Lab. debe" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentStatusFilter(opt.value)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          paymentStatusFilter === opt.value
                            ? "border-[#204983] bg-[#204983] text-white"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(isPrintedFilter !== "all" || paymentStatusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintedFilter("all")
                      setPaymentStatusFilter("all")
                    }}
                    className="w-full rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filtros de estado, centrados */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
            {stateStatsQuery.isLoading ? (
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-32 rounded-full" />
                ))}
              </div>
            ) : (
              statusItems.map((item) => {
              const style = getProtocolStatusStyleByName(item.name)
              const filterState = getStatusFilterState(item.id)
              const Icon = item.icon
              const stateClass =
                filterState === "include"
                  ? `${style.solid} text-white`
                  : filterState === "exclude"
                    ? "bg-red-100 text-red-700 border-red-300 line-through"
                    : `${style.badgeOutline} hover:bg-white`
              const titleByState =
                filterState === "include"
                  ? "Incluido. Click para excluir."
                  : filterState === "exclude"
                    ? "Excluido. Click para quitar filtro."
                    : "Sin filtro. Click para incluir."

              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(item.id)}
                  title={titleByState}
                  className={`h-8 shrink-0 rounded-full border px-3 text-xs ${stateClass}`}
                >
                  {filterState === "exclude" ? (
                    <X className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 mr-1" />
                  )}
                  {style.shortLabel}
                  <span className="ml-1 rounded-full bg-white/70 px-1.5 text-[11px] text-gray-700">{item.count}</span>
                </Button>
              )
            })
            )}
            {hasAnyStatusFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter({ include: [], exclude: [] })}
                className="h-8 shrink-0 rounded-full text-gray-500"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
        </div>

        {/* Tabla */}
        <div className="mt-4 space-y-4">
        {allProtocols.length === 0 && !isInitialLoading && !isSearching ? (
          <div className="p-8 sm:p-12 text-center">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              {dia ? `Sin protocolos el ${comoFechaCorta(dia)}` : "No se encontraron protocolos"}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {dia
                ? "Probá con otro día usando las flechas, o cancelá el filtro para ver todos."
                : searchTerm || hasAnyStatusFilter || isPrintedFilter !== "all" || paymentStatusFilter !== "all"
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Aún no hay protocolos registrados en el sistema"}
            </p>
            <Button onClick={handleNewProtocol} className="bg-[#204983] hover:bg-[#1a3d6b] text-white">
              <Plus className="h-4 w-4 mr-2" />
              {dia ? "Nuevo protocolo" : "Crear Primer Protocolo"}
            </Button>
          </div>
        ) : (
          <ProtocolsTable
            protocols={allProtocols}
            selectedIds={selectedProtocols}
            onToggleSelect={toggleProtocolSelection}
            onRowClick={(id) => navigate(`/protocolos/${id}`)}
            sort={sort}
            onSortChange={setSort}
            isLoading={(isInitialLoading || isSearching) && allProtocols.length === 0}
            onQuickPayment={quickActions.openPayment}
            onReport={(p) => navigate(`/protocolos/${p.id}?report=1`)}
            onUncancel={quickActions.uncancel}
            canUncancel={canUncancel}
            canPrintReports={canPrintReports}
            busyId={quickActions.busyId}
            separarPorDia={ordenadoPorFecha}
          />
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && !isSearching && !isInitialLoading && allProtocols.length > 0 && (
          <div ref={sentinelRef} className="py-2">
            {isLoadingMore && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No more results */}
        {!hasMore && allProtocols.length > 0 && (
          <div className="text-center py-4 text-gray-500">
            <p>No hay más protocolos para mostrar</p>
          </div>
        )}
        </div>
      </div>

      {/* Barra flotante de acciones en lote */}
      {isSelectionMode && (
        <BatchActionBar
          selectedCount={selectedProtocols.size}
          reportType={batchReportType}
          onReportTypeChange={handleBatchReportTypeChange}
          signed={batchSigned}
          onSignedChange={setBatchSigned}
          signatureId={batchSignatureId}
          onSignatureIdChange={setBatchSignatureId}
          signatures={reportSignatures}
          date={batchDate}
          onDateChange={setBatchDate}
          time={batchTime}
          onTimeChange={setBatchTime}
          isProcessing={isBatchProcessing}
          disabledReason={batchDisabledReason}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onPreview={handleBatchPreview}
          onBatch={alElegirAccionDelLote}
          onMerge={alElegirUnificado}
        />
      )}


      <EnviarInformeDialog
        open={envioDelLote !== null}
        onOpenChange={(open) => {
          if (!open) setEnvioDelLote(null)
        }}
        metodo={envioDelLote?.metodo ?? null}
        titulo={
          envioDelLote?.tipo === "unificado"
            ? `Unificado · ${selectedProtocols.size} protocolos`
            : `${selectedProtocols.size} ${selectedProtocols.size === 1 ? "protocolo" : "protocolos"}`
        }
        paraCadaPaciente={envioDelLote?.tipo === "lote"}
        patientName={envioDelLote?.tipo === "unificado" ? pacienteDelUnificado : undefined}
        tipoDeInforme={batchReportType}
        onConfirm={alConfirmarElDestinoDelLote}
      />

      {quickActions.dialogs}
    </div>
  )
}
