"use client"

import { useMemo, useState } from "react"
import { Pause, Play, RefreshCw, Search } from "lucide-react"

import { useApiQuery } from "@/hooks/use-api-query"
import { SUPERADMIN_ENDPOINTS } from "@/config/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { LAB_TIME_ZONE } from "@/lib/format-utils"
import type { RequestLogResponse } from "@/types"

const STATUS_FILTERS = [
  { label: "Todo", value: "" },
  { label: "2xx", value: "2xx" },
  { label: "4xx", value: "4xx" },
  { label: "5xx", value: "5xx" },
]

/** Igual que en consola: el código pinta según la familia. */
function statusClass(status: number): string {
  if (status >= 500) return "text-red-600"
  if (status >= 400) return "text-amber-600"
  if (status >= 300) return "text-sky-600"
  return "text-green-600"
}

/** Lo lento se destaca solo: no hay que ir a buscarlo. */
function durationClass(ms: number): string {
  if (ms >= 1000) return "text-red-600 font-semibold"
  if (ms >= 300) return "text-amber-600"
  return "text-gray-500"
}

function formatClock(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return "--:--:--"
  return parsed.toLocaleTimeString("es-AR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: LAB_TIME_ZONE,
  })
}

interface RequestLogPanelProps {
  /** Refresca toda la página y reinicia el presupuesto de refrescos automáticos. */
  onManualRefresh: () => Promise<unknown>
}

export function RequestLogPanel({ onManualRefresh }: RequestLogPanelProps) {
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  // Congelar la tabla mientras se lee una línea: con el log moviéndose es fácil
  // perder de vista la petición que estabas mirando.
  const [paused, setPaused] = useState(false)

  // El backend acepta `search` como subcadena de la ruta; se manda tal cual.
  const params = useMemo(() => {
    const next: Record<string, string> = { limit: "150" }
    if (status) next.status = status
    if (search.trim()) next.search = search.trim()
    return next
  }, [status, search])

  // Sin `refetchInterval` propio: el ciclo automático lo maneja la página, que
  // tiene un único presupuesto de refrescos para todos los paneles.
  //
  // En pausa se deshabilita la query. React Query conserva y sigue mostrando lo
  // último que trajo, y al quedar inactiva el ciclo de la página la saltea: la
  // tabla queda quieta y además deja de pedir. Congelar solo lo que se ve
  // hubiera seguido gastando peticiones para nada.
  const logQuery = useApiQuery<RequestLogResponse>({
    queryKey: ["superadmin", "requests", params],
    url: SUPERADMIN_ENDPOINTS.REQUESTS(params),
    enabled: !paused,
  })

  const entries = logQuery.data?.results ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-gray-500">
          Cada petición en orden cronológico, lo mismo que sale por consola. Se
          conservan las últimas 24 horas.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar por ruta…"
              className="h-9 w-48 pl-8"
            />
          </div>

          <div className="flex gap-1">
            {STATUS_FILTERS.map((option) => (
              <Button
                key={option.value || "all"}
                size="sm"
                variant={status === option.value ? "default" : "outline"}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <Button
            size="sm"
            variant={paused ? "default" : "outline"}
            onClick={() => setPaused((value) => !value)}
            title={paused ? "Reanudar el log" : "Congelar el log para poder leerlo"}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onManualRefresh}
            disabled={logQuery.isFetching || paused}
            title={
              paused
                ? "El log está en pausa"
                : "Actualizar y reanudar la actualización automática"
            }
          >
            <RefreshCw className={`h-4 w-4 ${logQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {logQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : logQuery.isError ? (
        <p className="py-6 text-center text-sm text-red-600">
          No se pudo cargar el log: {logQuery.error.message}
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-500">
          No hay peticiones que coincidan con el filtro.
        </p>
      ) : (
        <div className="max-h-[26rem] overflow-auto rounded-xl border border-gray-200">
          {/* Sube de 680 a 800 por la columna nueva: si no, la ruta se
              recorta antes de tiempo en pantallas medianas. */}
          <table className="w-full min-w-[800px] text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-left uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Hora</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2 font-medium">Ruta</th>
                <th className="px-3 py-2 text-right font-medium">Código</th>
                <th className="px-3 py-2 text-right font-medium">Tiempo</th>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                    {formatClock(entry.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-gray-700">
                    {entry.method}
                  </td>
                  <td className="max-w-0 truncate px-3 py-1.5 text-gray-900" title={entry.path}>
                    {entry.path}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${statusClass(entry.status_code)}`}>
                    {entry.status_code}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right ${durationClass(entry.duration_ms)}`}>
                    {entry.duration_ms.toFixed(1)} ms
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                    {entry.username || "—"}
                  </td>
                  {/* La IP la resuelve el backend respetando NUM_PROXIES, así
                      que con nginx delante es la del cliente real y no la del
                      proxy. Vacía cuando la petición no la trajo. */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-500" title={entry.ip}>
                    {entry.ip || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {entries.length} petición{entries.length === 1 ? "" : "es"}
        {(logQuery.data?.total ?? 0) > entries.length && ` de ${logQuery.data?.total}`}
        {paused && " · en pausa, no se está actualizando"}
      </p>
    </div>
  )
}
