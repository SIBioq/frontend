import { Loader2, TestTube } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../ui/dialog"
import { Badge } from "../../../ui/badge"
import { Switch } from "../../../ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProtocolDetail } from "@/types"
import { AnalysisPriceSummary } from "../analysis-price-summary"

interface AnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  protocolNumber: number
  details: ProtocolDetail[]
  isLoading: boolean
  updatingDetailId: number | null
  onToggleAuthorization: (detail: ProtocolDetail) => void
  isEditable?: boolean
  readOnlyReason?: string
  isPrivateProtocol?: boolean
}

export function AnalysisDialog({
  open,
  onOpenChange,
  protocolNumber,
  details,
  isLoading,
  updatingDetailId,
  onToggleAuthorization,
  isEditable = true,
  readOnlyReason = "No se puede modificar la autorización en el estado actual del protocolo.",
  isPrivateProtocol = false,
}: AnalysisDialogProps) {
  const getAuthorizationDisabledReason = (detail: ProtocolDetail) => {
    if (!isEditable) return readOnlyReason
    if (!detail.is_active) return "No se puede modificar porque este análisis está inactivo."
    if (updatingDetailId === detail.id) return "Se está actualizando la autorización."
    return undefined
  }

  const renderAuthorizationSwitch = (detail: ProtocolDetail, className?: string) => {
    const disabledReason = getAuthorizationDisabledReason(detail)
    const control = (
      <Switch
        checked={detail.is_authorized}
        onCheckedChange={() => onToggleAuthorization(detail)}
        disabled={Boolean(disabledReason)}
        className={className}
      />
    )

    if (!disabledReason) return control

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{control}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] bg-slate-900 text-white">
          <p>{disabledReason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* // Mejor responsive sin scroll horizontal */}
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-[#204983]" />
            {/* // Usando protocolNumber en lugar de protocolId */}
            Análisis del Protocolo #{protocolNumber}
          </DialogTitle>
          <DialogDescription>
            {isPrivateProtocol
              ? "Protocolo particular: los análisis no requieren autorización; el paciente los paga directamente."
              : isEditable
                ? "Puede cambiar la autorización de cada análisis. Esto puede afectar el costo total del protocolo."
                : "Vista de solo lectura. El protocolo está completado o cancelado."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : details.length > 0 ? (
          <div className="space-y-4">
            {/* // Vista responsive: cards en mobile, tabla en desktop */}
            {/* Mobile view - cards */}
            <div className="block sm:hidden space-y-3">
              {details.map((detail) => (
                <div
                  key={detail.id}
                  className={`border rounded-lg p-3 ${!detail.is_active ? "bg-gray-100 opacity-60" : ""}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-sm text-gray-500">{detail.code}</span>
                      <p className="font-medium text-sm">{detail.name}</p>
                    </div>
                    {detail.is_urgent && (
                      <Badge variant="destructive" className="text-xs">
                        Urgente
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <div className="flex flex-col"><span className="text-gray-500">UB: {detail.ub}</span><AnalysisPriceSummary detail={detail} /></div>
                    {!isPrivateProtocol && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Autorizado:</span>
                        {renderAuthorizationSwitch(detail)}
                        {updatingDetailId === detail.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view - table */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 lg:px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-16 lg:w-20">Código</th>
                    <th className="px-2 lg:px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Análisis</th>
                    <th className="px-2 lg:px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-12 lg:w-14">UB</th>
                    {!isPrivateProtocol && (
                      <th className="px-2 lg:px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-20 lg:w-24">Autoriz.</th>
                    )}
                    <th className="px-2 lg:px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-16 lg:w-20">Urg.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {details.map((detail) => (
                    <tr key={detail.id} className={!detail.is_active ? "bg-gray-100 opacity-60" : ""}>
                      <td className="px-2 lg:px-3 py-2.5 text-xs lg:text-sm font-mono truncate">{detail.code}</td>
                      <td className="px-2 lg:px-3 py-2.5 text-xs lg:text-sm">
                        <div className="break-words leading-tight">{detail.name}</div>
                      </td>
                      <td className="px-2 lg:px-3 py-2.5 text-xs lg:text-sm"><div>{detail.ub}</div><AnalysisPriceSummary detail={detail} /></td>
                      {!isPrivateProtocol && (
                        <td className="px-2 lg:px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {renderAuthorizationSwitch(detail, "scale-90")}
                            {updatingDetailId === detail.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          </div>
                        </td>
                      )}
                      <td className="px-2 lg:px-3 py-2.5 text-center">
                        {detail.is_urgent && (
                          <Badge variant="destructive" className="text-[10px] lg:text-xs px-1.5">
                            Urg.
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-sm text-gray-500 text-right">Total: {details.length} análisis</div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">No hay análisis disponibles para este protocolo</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
