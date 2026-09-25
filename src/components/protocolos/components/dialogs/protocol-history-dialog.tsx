"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HistoryList, CATEGORY_META } from "@/components/common/history-list"
import { History, Filter, RefreshCw, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useEffect, useState, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { PROTOCOL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import type { HistoryEntry, AuditCategory } from "@/types"
import { toast } from "sonner"

interface ProtocolHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  protocolNumber: number
  history?: HistoryEntry[]
  totalChanges?: number
  isLoading?: boolean
}

const CATEGORY_FILTERS: Array<{ value: AuditCategory; label: string }> = [
  { value: "protocol", label: CATEGORY_META.protocol.label },
  { value: "result", label: CATEGORY_META.result.label },
  { value: "validation", label: CATEGORY_META.validation.label },
  { value: "payment", label: CATEGORY_META.payment.label },
  { value: "state", label: CATEGORY_META.state.label },
]

export function ProtocolHistoryDialog({
  open,
  onOpenChange,
  protocolId,
  protocolNumber,
}: ProtocolHistoryDialogProps) {
  const { apiRequest } = useApi()
  const [events, setEvents] = useState<HistoryEntry[]>([])
  const [count, setCount] = useState(0)
  const [truncado, setTruncado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeCategories, setActiveCategories] = useState<Set<AuditCategory>>(new Set())

  const loadTimeline = useCallback(
    async (categories: Set<AuditCategory>) => {
      if (!protocolId) return

      setLoading(true)
      try {
        const url = new URL(PROTOCOL_ENDPOINTS.AUDIT_TIMELINE(protocolId))
        if (categories.size === 1) {
          // El endpoint acepta una categoría; si hay múltiples se filtra en cliente
          const [first] = Array.from(categories)
          url.searchParams.set("category", first)
        }
        url.searchParams.set("limit", "500")

        const response = await apiRequest(url.toString())
        if (response.ok) {
          const data = await response.json()
          const allEvents: HistoryEntry[] = data.events || []
          const filtered =
            categories.size > 1
              ? allEvents.filter((event) => event.category && categories.has(event.category as AuditCategory))
              : allEvents
          setEvents(filtered)
          // Con una categoría el backend ya filtró y `total` es el real. Con
          // varias se filtra acá: el total es lo filtrado, y si el backend
          // cortó en `limit` puede haber más que no llegaron.
          if (categories.size > 1) {
            setCount(filtered.length)
            setTruncado((data.total ?? 0) > (data.count ?? 0))
          } else {
            setCount(data.total ?? data.count ?? filtered.length)
            setTruncado(false)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          toast.error("No se pudo cargar el timeline", {
            description: errorData.detail || "Volvé a intentar.",
            duration: TOAST_DURATION,
          })
        }
      } catch (error) {
        console.error("Error al cargar audit-timeline:", error)
        toast.error("Error al cargar el historial", { duration: TOAST_DURATION })
      } finally {
        setLoading(false)
      }
    },
    [apiRequest, protocolId],
  )

  useEffect(() => {
    if (open && protocolId) {
      loadTimeline(activeCategories)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, protocolId])

  useEffect(() => {
    if (open && protocolId) {
      loadTimeline(activeCategories)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategories])

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
      <DialogContent className="w-[95vw] max-w-5xl max-h-[85vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <History className="h-5 w-5 text-[#204983] flex-shrink-0" />
            <span>Auditoría completa - Protocolo #{protocolNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
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
                  onClick={() => loadTimeline(activeCategories)}
                  disabled={loading}
                  className="text-xs h-7"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Recargar
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_FILTERS.map((filter) => {
                const isActive = activeCategories.has(filter.value)
                const meta = CATEGORY_META[filter.value]
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => toggleCategory(filter.value)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? `${meta.className} shadow-sm`
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    aria-pressed={isActive}
                  >
                    {isActive && <Check className="h-3 w-3" strokeWidth={3} />}
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {loading
                ? "Cargando eventos..."
                : `${events.length} evento${events.length === 1 ? "" : "s"}${
                    count > events.length ? ` de ${count}` : ""
                  }${activeCategories.size > 0 ? " (filtrados)" : ""}${
                    truncado ? " entre los últimos 500" : ""
                  }`}
            </span>
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
              history={events}
              emptyMessage={
                activeCategories.size > 0
                  ? "Sin eventos para las categorías seleccionadas"
                  : "No hay historial disponible para este protocolo"
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
