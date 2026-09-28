"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApi } from "@/hooks/use-api"
import { AUDIT_ENDPOINTS } from "@/config/api"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Loader2, Search, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/hooks/use-debounce"
import type { AuditEntry, AuditCategory, AuditActionType } from "@/types"
import { AuditCard } from "./components/audit-card"
import { CATEGORY_META } from "@/components/common/history-list"

const CATEGORY_OPTIONS: Array<{ value: AuditCategory; label: string }> = [
  { value: "protocol", label: CATEGORY_META.protocol.label },
  { value: "result", label: CATEGORY_META.result.label },
  { value: "validation", label: CATEGORY_META.validation.label },
  { value: "payment", label: CATEGORY_META.payment.label },
  { value: "billing", label: CATEGORY_META.billing.label },
  { value: "state", label: CATEGORY_META.state.label },
  { value: "report", label: CATEGORY_META.report.label },
  { value: "doctor", label: CATEGORY_META.doctor.label },
  { value: "insurance", label: CATEGORY_META.insurance.label },
  { value: "analysis", label: CATEGORY_META.analysis.label },
  { value: "user", label: CATEGORY_META.user.label },
  { value: "security", label: CATEGORY_META.security.label },
  { value: "patient", label: CATEGORY_META.patient.label },
  { value: "system", label: CATEGORY_META.system.label },
]

const ACTION_TYPE_OPTIONS: Array<{ value: AuditActionType; label: string; className: string }> = [
  { value: "create", label: "Creación", className: "bg-green-100 text-green-800 border-green-200" },
  { value: "update", label: "Actualización", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "delete", label: "Eliminación", className: "bg-red-100 text-red-800 border-red-200" },
  { value: "business", label: "Negocio", className: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "auth", label: "Autenticación", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "system", label: "Sistema", className: "bg-slate-100 text-slate-800 border-slate-200" },
]

export function AuditManagement() {
  const { apiRequest } = useApi()
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextUrl, setNextUrl] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [category, setCategory] = useState<AuditCategory | "all">("all")
  const [actionType, setActionType] = useState<AuditActionType | "all">("all")
  const [actionName, setActionName] = useState("")
  const debouncedActionName = useDebounce(actionName, 500)
  const [relatedProtocolId, setRelatedProtocolId] = useState("")
  const debouncedRelatedProtocolId = useDebounce(relatedProtocolId, 500)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const debouncedDateFrom = useDebounce(dateFrom, 500)
  const debouncedDateTo = useDebounce(dateTo, 500)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearchTerm.trim()) params.set("search", debouncedSearchTerm.trim())
    if (category !== "all") params.set("category", category)
    if (actionType !== "all") params.set("action_type", actionType)
    if (debouncedActionName.trim()) params.set("action_name", debouncedActionName.trim())
    if (debouncedRelatedProtocolId.trim()) params.set("related_protocol_id", debouncedRelatedProtocolId.trim())
    if (debouncedDateFrom) params.set("created_at__gte", debouncedDateFrom)
    if (debouncedDateTo) params.set("created_at__lte", debouncedDateTo)
    const qs = params.toString()
    return qs ? `${AUDIT_ENDPOINTS.AUDIT}?${qs}` : AUDIT_ENDPOINTS.AUDIT
  }, [
    debouncedSearchTerm,
    category,
    actionType,
    debouncedActionName,
    debouncedRelatedProtocolId,
    debouncedDateFrom,
    debouncedDateTo,
  ])

  // EL FILTRO MOSTRABA EVENTOS DE OTRA CATEGORÍA
  // ============================================
  // La lista es scroll infinito: `loadMore` pide la página siguiente y APILA lo
  // que llega. Si en ese momento se cambia la categoría, pasaban dos cosas:
  //
  //   1. El pedido en vuelo seguía siendo el de la categoría anterior. Llegaba
  //      después del reset y se apilaba sobre la lista nueva — el filtro decía
  //      "Pago" y en la lista había validaciones.
  //   2. `nextUrl` no se limpiaba, así que el centinela del scroll podía pedir
  //      la página 2 DE LA CATEGORÍA VIEJA antes de que llegara la nueva.
  //
  // Este contador identifica a qué juego de filtros pertenece cada pedido: el
  // que vuelve con un número viejo se descarta en vez de mostrarse.
  const pedidoVigente = useRef(0)

  const fetchAuditEntries = useCallback(
    async (url?: string, reset = false) => {
      // Un reset abre una tanda nueva; un "traer más" pertenece a la vigente.
      const miPedido = reset ? ++pedidoVigente.current : pedidoVigente.current

      if (reset) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      try {
        const endpoint = url || buildUrl()
        const response = await apiRequest(endpoint)

        // Los filtros cambiaron mientras esto viajaba: lo que trae ya no es lo
        // que la pantalla está mostrando.
        if (miPedido !== pedidoVigente.current) return

        if (response.ok) {
          const data = await response.json()
          if (miPedido !== pedidoVigente.current) return
          if (reset) {
            setAuditEntries(data.results || [])
          } else {
            setAuditEntries((prev) => [...prev, ...(data.results || [])])
          }
          setNextUrl(data.next || null)
        }
      } catch (error) {
        console.error("Error al cargar auditoría:", error)
      } finally {
        if (miPedido === pedidoVigente.current) {
          setLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [apiRequest, buildUrl],
  )

  useEffect(() => {
    // Antes de pedir: el `next` que había apuntaba a la página 2 del filtro
    // anterior. Sin limpiarlo, el scroll infinito lo podía usar.
    setNextUrl(null)
    fetchAuditEntries(undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchTerm,
    category,
    actionType,
    debouncedActionName,
    debouncedRelatedProtocolId,
    debouncedDateFrom,
    debouncedDateTo,
  ])

  const loadMore = useCallback(() => {
    if (nextUrl && !isLoadingMore) {
      fetchAuditEntries(nextUrl, false)
    }
  }, [nextUrl, isLoadingMore, fetchAuditEntries])

  const hasMore = !!nextUrl
  const loadMoreSentinelRef = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore,
    onLoadMore: loadMore,
  })

  const activeFilters = [
    debouncedSearchTerm && { label: `Búsqueda: ${debouncedSearchTerm}`, clear: () => setSearchTerm("") },
    category !== "all" && { label: `Categoría: ${CATEGORY_META[category].label}`, clear: () => setCategory("all") },
    actionType !== "all" && {
      label: `Tipo: ${ACTION_TYPE_OPTIONS.find((o) => o.value === actionType)?.label}`,
      clear: () => setActionType("all"),
    },
    debouncedActionName && { label: `Acción: ${debouncedActionName}`, clear: () => setActionName("") },
    debouncedRelatedProtocolId && {
      label: `Protocolo #${debouncedRelatedProtocolId}`,
      clear: () => setRelatedProtocolId(""),
    },
    debouncedDateFrom && { label: `Desde: ${debouncedDateFrom}`, clear: () => setDateFrom("") },
    debouncedDateTo && { label: `Hasta: ${debouncedDateTo}`, clear: () => setDateTo("") },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>

  const clearAllFilters = () => {
    setSearchTerm("")
    setCategory("all")
    setActionType("all")
    setActionName("")
    setRelatedProtocolId("")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#204983]/10 text-[#204983]">
              <Filter className="h-4 w-4" />
            </span>
            Auditoría completa
          </div>
          {activeFilters.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 w-full text-xs sm:w-auto">
              Limpiar todos
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_minmax(230px,300px)]">
            <div className="space-y-1.5">
              <Label htmlFor="audit-search" className="text-xs font-medium text-slate-600">
                Buscar
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="audit-search"
                  type="text"
                  placeholder="Objeto, usuario o mensaje"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-protocol" className="text-xs font-medium text-slate-600">
                Protocolo
              </Label>
              <Input
                id="audit-protocol"
                type="number"
                placeholder="Número"
                value={relatedProtocolId}
                onChange={(e) => setRelatedProtocolId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Fechas</Label>
              {/* Un solo calendario para las dos puntas: acá el rango es
                  opcional, así que además tiene "Sin filtro de fecha". */}
              <DateRangePicker
                desde={dateFrom}
                hasta={dateTo}
                onChange={(desde, hasta) => {
                  setDateFrom(desde)
                  setDateTo(hasta)
                }}
                onLimpiar={() => {
                  setDateFrom("")
                  setDateTo("")
                }}
                placeholder="Cualquier fecha"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-600">Categoría</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === "all"
                    ? "border-[#204983] bg-[#204983] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                Todas
              </button>
              {CATEGORY_OPTIONS.map((opt) => {
                const meta = CATEGORY_META[opt.value]
                const isActive = category === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(isActive ? "all" : opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive ? `${meta.className} border-transparent` : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_minmax(240px,340px)]">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-600">Tipo de acción</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActionType("all")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    actionType === "all"
                      ? "border-[#204983] bg-[#204983] text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  Todos
                </button>
                {ACTION_TYPE_OPTIONS.map((opt) => {
                  const isActive = actionType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActionType(isActive ? "all" : opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive ? opt.className : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-action-name" className="text-xs font-medium text-slate-600">
                Acción técnica
              </Label>
              <Input
                id="audit-action-name"
                type="text"
                placeholder="Nombre interno"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
              />
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap border-t border-gray-100 pt-3">
              {activeFilters.map((filter, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="max-w-full gap-1 pl-2 pr-1 py-1 text-xs"
                >
                  <span className="truncate">{filter.label}</span>
                  <button
                    type="button"
                    onClick={filter.clear}
                    className="rounded p-0.5 hover:bg-slate-300"
                    aria-label={`Quitar filtro ${filter.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-md rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : auditEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No se encontraron registros de auditoría con los filtros aplicados
        </div>
      ) : (
        <div className="space-y-2">
          {auditEntries.map((entry) => (
            <AuditCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreSentinelRef} className="flex justify-center py-4">
          {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-gray-400" />}
        </div>
      )}
    </div>
  )
}
