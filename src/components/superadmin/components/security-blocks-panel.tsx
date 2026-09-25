"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { LockOpen, RefreshCw, ShieldCheck } from "lucide-react"

import { useApi } from "@/hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { SUPERADMIN_ENDPOINTS } from "@/config/api"
import { getErrorMessage, readApiError } from "@/lib/api-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatUtcDateTime } from "@/lib/format-utils"
import type { SecurityBlock } from "@/types"

const BLOCKS_KEY = (all: boolean) => ["superadmin", "blocks", all] as const

/** "12 min 30 s" a partir de los segundos que quedan de cooldown. */
function formatCooldown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "vencido"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours} h ${minutes} min`
  if (minutes > 0) return `${minutes} min ${seconds} s`
  return `${seconds} s`
}

interface SecurityBlocksPanelProps {
  /** Refresca toda la página y reinicia el presupuesto de refrescos automáticos. */
  onManualRefresh: () => Promise<unknown>
}

export function SecurityBlocksPanel({ onManualRefresh }: SecurityBlocksPanelProps) {
  const { apiRequest } = useApi()
  const queryClient = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const [pendingRelease, setPendingRelease] = useState<SecurityBlock | null>(null)
  const [releasingId, setReleasingId] = useState<number | null>(null)
  // El cooldown baja en vivo sin pedirle nada al backend: el servidor manda
  // los segundos restantes y acá se descuenta el tiempo transcurrido desde
  // que llegó la respuesta.
  const [now, setNow] = useState(() => Date.now())

  // Sin `refetchInterval` propio: el ciclo automático lo maneja la página, que
  // tiene un único presupuesto de refrescos para todos los paneles.
  const blocksQuery = useApiQuery<SecurityBlock[]>({
    queryKey: BLOCKS_KEY(showHistory),
    url: SUPERADMIN_ENDPOINTS.BLOCKS(showHistory),
  })

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const blocks = blocksQuery.data ?? []
  const fetchedAt = blocksQuery.dataUpdatedAt

  const remainingFor = useCallback(
    (block: SecurityBlock) => {
      if (!block.is_active) return 0
      const elapsed = Math.floor((now - fetchedAt) / 1000)
      return Math.max(0, block.seconds_remaining - elapsed)
    },
    [fetchedAt, now],
  )

  const handleRelease = async (block: SecurityBlock) => {
    setReleasingId(block.id)
    try {
      const response = await apiRequest(SUPERADMIN_ENDPOINTS.RELEASE_BLOCK(block.id), {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "No se pudo desbloquear"))
      }
      toast.success(`Se desbloqueó ${block.identifier}`, {
        description:
          block.kind === "ip"
            ? "Esa dirección ya puede volver a intentar iniciar sesión."
            : "Esa cuenta ya puede volver a intentar iniciar sesión.",
      })
      await queryClient.invalidateQueries({ queryKey: ["superadmin"] })
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo desbloquear"))
    } finally {
      setReleasingId(null)
      setPendingRelease(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          IPs y cuentas que el sistema bloqueó por intentos de login fallidos. Se
          liberan solas al terminar el cooldown.
        </p>
        <div className="flex shrink-0 items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Switch checked={showHistory} onCheckedChange={setShowHistory} />
            Ver historial
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={onManualRefresh}
            disabled={blocksQuery.isFetching}
            title="Actualizar y reanudar la actualización automática"
          >
            <RefreshCw className={`h-4 w-4 ${blocksQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {blocksQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : blocksQuery.isError ? (
        <p className="py-6 text-center text-sm text-red-600">
          No se pudieron cargar los bloqueos: {blocksQuery.error.message}
        </p>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 py-10 text-center">
          <ShieldCheck className="h-10 w-10 text-green-600" />
          <p className="font-medium text-gray-900">
            {showHistory ? "No hay bloqueos registrados" : "No hay bloqueos activos"}
          </p>
          <p className="text-sm text-gray-500">Nadie está bloqueado en este momento.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Bloqueado</th>
                <th className="px-3 py-2 font-medium">Motivo</th>
                <th className="px-3 py-2 font-medium">Desde</th>
                <th className="px-3 py-2 font-medium">Cooldown</th>
                <th className="px-3 py-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blocks.map((block) => {
                const remaining = remainingFor(block)
                return (
                  <tr key={block.id} className="align-middle">
                    <td className="px-3 py-3">
                      <Badge variant={block.kind === "ip" ? "destructive" : "secondary"}>
                        {block.kind === "ip" ? "IP" : "Cuenta"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-900">
                      {block.identifier}
                      {block.kind === "account" && block.last_ip && (
                        <span className="ml-2 text-gray-400">desde {block.last_ip}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{block.reason}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                      {formatUtcDateTime(block.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {block.is_active && remaining > 0 ? (
                        <span className="font-medium text-amber-700">
                          {formatCooldown(remaining)}
                        </span>
                      ) : block.released_at ? (
                        <span className="text-gray-500">
                          liberado
                          {block.released_by_username ? ` por ${block.released_by_username}` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-500">vencido</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {block.is_active && remaining > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingRelease(block)}
                          disabled={releasingId === block.id}
                        >
                          <LockOpen className="mr-1 h-4 w-4" />
                          Desbloquear
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={pendingRelease !== null}
        onOpenChange={(open) => !open && setPendingRelease(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">¿Desbloquear {pendingRelease?.identifier}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRelease?.kind === "ip"
                ? "Esa dirección va a poder volver a intentar iniciar sesión inmediatamente. Hacelo solo si estás seguro de que el bloqueo fue un falso positivo."
                : "Esa cuenta va a poder volver a intentar iniciar sesión inmediatamente. Hacelo solo si estás seguro de que el bloqueo fue un falso positivo."}
              {pendingRelease && (
                <span className="mt-2 block break-words text-xs text-gray-500">
                  Motivo del bloqueo: {pendingRelease.reason} · Queda registrado en la
                  auditoría a tu nombre.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRelease && handleRelease(pendingRelease)}
              disabled={releasingId !== null}
            >
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
