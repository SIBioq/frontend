"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Check, Filter, History, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { TOAST_DURATION } from "@/config/api"
import { CATEGORY_META, HistoryList } from "@/components/common/history-list"
import type { AuditCategory, HistoryEntry } from "@/types"

interface ObjectHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /**
   * URL del endpoint `audit-timeline` (preferido). Devuelve historial enriquecido
   * incluyendo eventos de objetos relacionados (ej: cambios en protocolos de un paciente).
   *
   * Si no se pasa, cae al `detailEndpoint` y usa el campo `history` simple.
   */
  timelineEndpoint?: string | null
  /**
   * Fallback: URL del endpoint detail del objeto. Se usa si `timelineEndpoint` no está disponible
   * o si la primera llamada falla con 404.
   */
  detailEndpoint?: string | null
  /**
   * Categorías a ofrecer como filtros. Si está vacío, no se muestra el bloque de filtros.
   */
  availableCategories?: AuditCategory[]
  /**
   * Mensaje cuando no hay historial.
   */
  emptyMessage?: string
}

interface TimelineResponse {
  count?: number
  events?: HistoryEntry[]
  // Algunos detail endpoints devuelven directamente history + total_changes
  history?: HistoryEntry[]
  total_changes?: number
}

export function ObjectHistoryDialog({
  open,
  onOpenChange,
  title,
  timelineEndpoint,
  detailEndpoint,
  availableCategories = [],
  emptyMessage = "Sin historial de cambios para este registro",
}: ObjectHistoryDialogProps) {
  const { apiRequest } = useApi()
  const [events, setEvents] = useState<HistoryEntry[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeCategories, setActiveCategories] = useState<Set<AuditCategory>>(new Set())
  /** Cuando el timeline no responde (404 u otro), recordamos para usar siempre el fallback. */
  const [timelineUnavailable, setTimelineUnavailable] = useState(false)

  const loadHistory = useCallback(
    async (categories: Set<AuditCategory>) => {
      const useTimeline = Boolean(timelineEndpoint) && !timelineUnavailable
      const baseEndpoint = useTimeline ? timelineEndpoint : detailEndpoint
      if (!baseEndpoint) return

      setLoading(true)
      try {
        // Si usamos timeline y hay 1 sola categoría seleccionada, mandamos el filtro server-side.
        let url = baseEndpoint
        if (useTimeline) {
          const params = new URLSearchParams()
          if (categories.size === 1) {
            params.set("category", Array.from(categories)[0])
          }
          params.set("limit", "500")
          url = `${baseEndpoint}?${params.toString()}`
        }

        const response = await apiRequest(url)

        if (response.status === 404 && useTimeline && detailEndpoint) {
          // Backend aún no implementa audit-timeline para esta entidad → fallback al detail.
          setTimelineUnavailable(true)
          const fallback = await apiRequest(detailEndpoint)
          if (fallback.ok) {
            const data: TimelineResponse = await fallback.json()
            const all = data.history || []
            const filtered =
              categories.size >= 1
                ? all.filter((event) => event.category && categories.has(event.category as AuditCategory))
                : all
            setEvents(filtered)
            setTotalCount(
              typeof data.total_changes === "number"
                ? data.total_changes
                : typeof data.count === "number"
                  ? data.count
                  : null,
            )
          }
          return
        }

        if (!response.ok) {
          toast.error("No se pudo cargar el historial", { duration: TOAST_DURATION })
          return
        }

        const data: TimelineResponse = await response.json()
        const allEvents = data.events || data.history || []
        // Si pedimos más de una categoría al timeline, filtramos en cliente.
        const needsClientFilter = useTimeline && categories.size > 1
        const filteredByCategory =
          !useTimeline && categories.size >= 1
            ? allEvents.filter((event) => event.category && categories.has(event.category as AuditCategory))
            : needsClientFilter
              ? allEvents.filter((event) => event.category && categories.has(event.category as AuditCategory))
              : allEvents

        setEvents(filteredByCategory)
        setTotalCount(
          typeof data.count === "number"
            ? data.count
            : typeof data.total_changes === "number"
              ? data.total_changes
              : null,
        )
      } catch (error) {
        console.error("Error al cargar historial:", error)
        toast.error("Error al cargar el historial", { duration: TOAST_DURATION })
      } finally {
        setLoading(false)
      }
    },
    [apiRequest, timelineEndpoint, detailEndpoint, timelineUnavailable],
  )

  useEffect(() => {
    if (open && (timelineEndpoint || detailEndpoint)) {
      loadHistory(activeCategories)
    } else if (!open) {
      setEvents([])
      setTotalCount(null)
      setActiveCategories(new Set())
      setTimelineUnavailable(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, timelineEndpoint, detailEndpoint])

  useEffect(() => {
    if (open && (timelineEndpoint || detailEndpoint)) {
      loadHistory(activeCategories)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategories])

  // Filtrado adicional en cliente (cubre fallback y multi-categoría)
  const filteredEvents = useMemo(() => {
    if (activeCategories.size === 0) return events
    return events.filter((event) => event.category && activeCategories.has(event.category as AuditCategory))
  }, [events, activeCategories])

  const toggleCategory = (category: AuditCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const clearFilters = () => setActiveCategories(new Set())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] max-h-[85dvh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 flex-wrap min-w-0">
            <History className="mt-0.5 h-5 w-5 text-[#204983] flex-shrink-0" />
            <span className="min-w-0 break-words">{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3 min-w-0">
          {availableCategories.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Filter className="h-4 w-4 text-[#204983]" />
                  <span className="font-medium">Filtrar por categoría</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeCategories.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                      Limpiar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadHistory(activeCategories)}
                    disabled={loading}
                    className="text-xs h-7"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Recargar
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableCategories.map((cat) => {
                  const isActive = activeCategories.has(cat)
                  const meta = CATEGORY_META[cat]
                  if (!meta) return null
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? `${meta.className} shadow-sm`
                          : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      aria-pressed={isActive}
                    >
                      {isActive && <Check className="h-3 w-3" strokeWidth={3} />}
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {loading
                ? "Cargando eventos..."
                : `${filteredEvents.length} evento${filteredEvents.length === 1 ? "" : "s"}${
                    activeCategories.size > 0
                      ? " (filtrados)"
                      : totalCount !== null && totalCount > events.length
                        ? ` (total: ${totalCount})`
                        : ""
                  }`}
            </span>
            {availableCategories.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadHistory(activeCategories)}
                disabled={loading}
                className="text-xs h-7"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Recargar
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48 rounded" />
                    <Skeleton className="h-3 w-32 rounded" />
                    <Skeleton className="h-3 w-full max-w-md rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <HistoryList
              history={filteredEvents}
              emptyMessage={
                activeCategories.size > 0
                  ? "Sin eventos para las categorías seleccionadas"
                  : emptyMessage
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
