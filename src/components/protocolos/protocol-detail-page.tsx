"use client"

import { useMemo } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, ChevronRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProtocolCard } from "./components/protocol-card"
import { ProtocolDetailSkeleton } from "./components/protocol-detail-skeleton"
import { useApiQuery } from "@/hooks/use-api-query"
import { useProtocolListNav } from "@/hooks/use-protocol-list-nav"
import { useTituloDePestana } from "@/hooks/use-titulo-de-pestana"
import { tituloDeDetalle } from "@/lib/titulo-de-pestana"
import { NextInQueuePill } from "@/components/common/next-in-queue-pill"
import { ENTRADA_ABAJO } from "@/lib/entrada"
import { useQueryClient } from "@tanstack/react-query"
import { PROTOCOL_ENDPOINTS, REPORTING_ENDPOINTS } from "@/config/api"
import type { Protocol, ProtocolListItem, ReportSignature, SendMethod } from "@/types"
import { formatUtcDateTime } from "@/lib/format-utils"

// El detalle completo no expone `balance` directo (sí amount_pending /
// amount_to_return). Lo reconstruimos para la cabecera del card.
function deriveBalance(detail: { amount_pending?: string; amount_to_return?: string }): string {
  const pending = Number.parseFloat(detail.amount_pending || "0")
  if (pending > 0) return String(pending)
  const toReturn = Number.parseFloat(detail.amount_to_return || "0")
  if (toReturn > 0) return String(-toReturn)
  return "0"
}

export default function ProtocolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const autoOpenReport = searchParams.get("report") === "1"
  const queryClient = useQueryClient()
  const { prevId, nextId } = useProtocolListNav(Number(id))

  const detailQuery = useApiQuery<Protocol>({
    queryKey: ["protocols", "detail", id],
    url: PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(Number(id)),
    enabled: Boolean(id),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })

  const sendMethodsQuery = useApiQuery<{ results?: SendMethod[] } | SendMethod[]>({
    queryKey: ["protocols", "send-methods"],
    url: PROTOCOL_ENDPOINTS.SEND_METHODS,
    staleTime: 30 * 60 * 1000,
  })
  const sendMethods: SendMethod[] = Array.isArray(sendMethodsQuery.data)
    ? sendMethodsQuery.data
    : sendMethodsQuery.data?.results || []

  const signaturesQuery = useApiQuery<{ results?: ReportSignature[] } | ReportSignature[]>({
    queryKey: ["reporting", "signatures"],
    url: REPORTING_ENDPOINTS.SIGNATURES,
    staleTime: 5 * 60 * 1000,
  })
  const reportSignatures: ReportSignature[] = Array.isArray(signaturesQuery.data)
    ? signaturesQuery.data
    : signaturesQuery.data?.results || []

  const detail = detailQuery.data
  const fechaCreacion = detail?.creation?.date ?? detail?.created_at

  useTituloDePestana(tituloDeDetalle("Protocolo", detail?.patient))

  const protocol = useMemo<ProtocolListItem | null>(() => {
    if (!detail) return null
    return {
      id: detail.id,
      patient: detail.patient,
      status: detail.status,
      balance: deriveBalance(detail),
      payment_status: detail.payment_status,
      billing_status: detail.billing_status,
      is_printed: detail.is_printed,
      trajo_orden: detail.trajo_orden,
      preauth_status: detail.preauth_status,
      missing_info: detail.missing_info,
      created_at: detail.created_at,
      is_arca_billed: detail.is_arca_billed,
      arca_billing_status: detail.arca_billing_status,
      creation: detail.creation,
      last_change: detail.last_change,
    } as ProtocolListItem
  }, [detail])

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["protocols", "detail", id] })
    queryClient.invalidateQueries({ queryKey: ["protocols", "list"] })
  }

  const Breadcrumb = (
    <nav className="mb-4 flex items-center gap-1.5 text-sm">
      <Link to="/protocolos" className="flex items-center gap-1 text-gray-500 transition-colors hover:text-[#204983]">
        <ArrowLeft className="h-4 w-4" />
        Protocolos
      </Link>
      <ChevronRight className="h-4 w-4 text-gray-400" />
      <span className="font-medium text-gray-700">
        #{id}
        {fechaCreacion ? ` · ${formatUtcDateTime(fechaCreacion)}` : ""}
      </span>
    </nav>
  )

  if (detailQuery.isLoading) {
    return (
      <div className="w-full py-4">
        {Breadcrumb}
        <ProtocolDetailSkeleton />
      </div>
    )
  }

  if (detailQuery.error || !protocol) {
    return (
      <div className="w-full py-4">
        {Breadcrumb}
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p>No se pudo cargar el protocolo #{id}.</p>
          <Button size="sm" className="ml-auto bg-[#204983]" onClick={() => detailQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4 pb-28">
      {Breadcrumb}
      {/* `key` POR PROTOCOLO: LA CARD SE MONTA DE CERO EN CADA SALTO.
          La card guarda el detalle en su propio estado (`protocolDetail`,
          inicializado con `initialDetail`) y carga historial una sola vez, al
          montarse. Saltando con la píldora el componente NO se desmonta cuando
          el detalle del vecino ya está en el cache de React Query —no hay
          skeleton de por medio—, así que cambiaba el número de la cabecera
          pero el cuerpo seguía mostrando el protocolo anterior hasta recargar
          la página. Con la key, cada id es una card distinta.

          El mismo div se lleva la animación de entrada: la card se monta
          recién cuando llegó el detalle, así que animarla acá es animar lo que
          se estaba esperando y no el esqueleto. */}
      <div key={id} className={ENTRADA_ABAJO}>
        <ProtocolCard
          protocol={protocol}
          onUpdate={handleUpdate}
          sendMethods={sendMethods}
          reportSignatures={reportSignatures}
          pageMode
          autoOpenReport={autoOpenReport}
          initialDetail={detail as never}
        />
      </div>

      {/* La misma píldora de resultados y validación: ir y volver entre
          protocolos sin pasar por la lista cada vez. */}
      <NextInQueuePill prevId={prevId} nextId={nextId} basePath="/protocolos" maxWidthClass="max-w-7xl" />
    </div>
  )
}
