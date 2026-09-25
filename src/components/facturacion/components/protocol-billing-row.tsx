import { ChevronDown, ExternalLink, FileCheck2, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PaperChecklist } from "./paper-status-chips"
import type { BillingEntity, PendingProtocolToBill } from "../types"

interface ProtocolBillingRowProps {
  protocol: PendingProtocolToBill
  onMarkBilled: (protocolId: number, overrideEntityId?: number) => void
  isMarking: boolean
  /** Entidades distintas a la que se está viendo, para "Facturar a otro lado". */
  otherEntities: BillingEntity[]
}

/**
 * Protocolo listo (o casi) para juntar papeles y facturar. El botón se
 * bloquea si falta algún papel — el backend igual lo bloquea con 400, esto
 * es solo para no hacer clic en vano.
 */
export function ProtocolBillingRow({ protocol, onMarkBilled, isMarking, otherEntities }: ProtocolBillingRowProps) {
  const complete = protocol.missing_paperwork.length === 0
  const patientName = protocol.patient ? `${protocol.patient.first_name} ${protocol.patient.last_name}` : "Sin paciente"

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={`/protocolos/${protocol.protocol_id}`}
            className="font-mono text-sm font-semibold text-[#204983] hover:underline"
            title="Ver protocolo"
          >
            #{protocol.protocol_id}
          </Link>
          <span className="font-medium text-gray-800">{patientName}</span>
          <span className="text-xs text-gray-500">{protocol.insurance?.name ?? "Sin obra social"}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <PaperChecklist
            trajoOrden={protocol.trajo_orden}
            preauthStatus={protocol.preauth_status}
            requierePreautorizacion={protocol.insurance?.requires_preauthorization}
            isSummaryPrinted={protocol.is_summary_printed}
          />
          <span className="text-xs text-gray-400">UB: {protocol.total_ub_authorized}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" asChild title="Ver protocolo">
          <Link to={`/protocolos/${protocol.protocol_id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          size="sm"
          className="bg-[#204983] hover:bg-[#1a3d6f]"
          disabled={isMarking || !complete}
          title={complete ? undefined : "Completá el checklist de papeles para habilitar esta acción"}
          onClick={() => onMarkBilled(protocol.protocol_id)}
        >
          {isMarking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-1.5 h-4 w-4" />}
          Marcar facturado
        </Button>
        {otherEntities.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isMarking || !complete}
                title="Facturar este protocolo puntual a otra entidad, sin cambiar la asignación habitual de la OOSS"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Facturar a otro lado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {otherEntities.map((entity) => (
                <DropdownMenuItem key={entity.id} onClick={() => onMarkBilled(protocol.protocol_id, entity.id)}>
                  {entity.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
