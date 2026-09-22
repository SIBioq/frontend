"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AuditAvatars } from "@/components/common/audit-avatars"
import { History, Pencil, Trash, TestTube } from "lucide-react"
import { AnalysisList } from "./analysis-list"
import { CopiarDeterminaciones } from "./copiar-determinaciones"
import { formatBioUnitValues, formatAnalysisCategory } from "@/lib/catalog-format"
import type { Analysis } from "@/types"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"

interface AnalysisDetailDialogProps {
  analysis: Analysis | null
  open: boolean
  onOpenChange: (open: boolean) => void
  refreshKey: number
  onEdit: (analysis: Analysis) => void
  onDelete: (analysis: Analysis) => void
  onShowHistory: (analysis: Analysis) => void
  /** Se llama después de copiar determinaciones de otro análisis: la lista de
   *  abajo tiene que volver a pedirlas. */
  onDeterminacionesCopiadas?: () => void
}

export function AnalysisDetailDialog({
  analysis,
  open,
  onOpenChange,
  refreshKey,
  onEdit,
  onDelete,
  onShowHistory,
  onDeterminacionesCopiadas,
}: AnalysisDetailDialogProps) {
  // Antes del early return: los hooks se llaman siempre, en el mismo orden.
  // Sin la función habilitada el precio cargado no cotiza nada, y la ficha no
  // puede anunciar un cobro que no va a pasar.
  const { habilitados: preciosFijosHabilitados } = usePreciosFijos()

  if (!analysis) return null
  const bioUnitItems = formatBioUnitValues(analysis.bio_unit_values)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-0 border-b border-gray-100 p-5 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TestTube className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                <span className="truncate">{analysis.name || "Sin nombre"}</span>
                {analysis.is_urgent && <Badge variant="destructive">Urgente</Badge>}
                {analysis.category && formatAnalysisCategory(analysis.category) && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700">
                    {formatAnalysisCategory(analysis.category)}
                  </Badge>
                )}
                {analysis.is_ref_normalized && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700" title="Normalizado (N) en el NBU">
                    N
                  </Badge>
                )}
                {analysis.is_obsolete && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    En desuso
                  </Badge>
                )}
                {preciosFijosHabilitados && analysis.cobra_precio_fijo && (
                  <Badge
                    variant="outline"
                    className="bg-sky-50 text-sky-700"
                    title="Al paciente se le cobra un precio cargado, no la cuenta por UB"
                  >
                    ${analysis.precio_particular ?? "0.00"} fijo
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Código <span className="font-mono font-semibold text-blue-800">{analysis.code || "N/A"}</span> · UB{" "}
                {analysis.bio_unit || "N/A"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="text-sm font-medium text-gray-600">Lleva resultado</span>
            <Badge
              variant="outline"
              className={analysis.lleva_resultado ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}
            >
              {analysis.lleva_resultado ? "Sí" : "No"}
            </Badge>
          </div>

          {bioUnitItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unidades bioquímicas históricas</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bioUnitItems.map((item) => (
                  <Badge key={item} variant="outline" className="bg-blue-50 text-[10px] text-blue-700">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.nbu_info && (analysis.nbu_info.work_minimum || analysis.nbu_info.interpretation || analysis.nbu_info.patient_instructions || analysis.nbu_info.report_note) && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ficha NBU</p>
              {analysis.nbu_info.work_minimum && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Norma mínima de trabajo: </span>
                  {analysis.nbu_info.work_minimum}
                </p>
              )}
              {analysis.nbu_info.interpretation && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Interpretación (alcance/facturación): </span>
                  {analysis.nbu_info.interpretation}
                </p>
              )}
              {analysis.nbu_info.patient_instructions && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Instrucciones al paciente: </span>
                  {analysis.nbu_info.patient_instructions}
                </p>
              )}
              {analysis.nbu_info.report_note && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Nota de informe: </span>
                  {analysis.nbu_info.report_note}
                </p>
              )}
            </div>
          )}

          {(analysis.creation || analysis.last_change) && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auditoría</span>
              <AuditAvatars creation={analysis.creation} lastChange={analysis.last_change} size="sm" />
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Determinaciones</p>
              <CopiarDeterminaciones analysis={analysis} onCopiadas={onDeterminacionesCopiadas} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50">
              <AnalysisList analysis={analysis} showInactive={false} refreshKey={refreshKey} />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 bg-gray-50/60 p-4">
          <Button variant="outline" size="sm" className="w-full" onClick={() => onShowHistory(analysis)}>
            <History className="mr-1.5 h-4 w-4 text-[#204983]" />
            Ver historial completo
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="bg-[#204983] hover:bg-[#1a3d6f]" onClick={() => onEdit(analysis)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(analysis)}
            >
              <Trash className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
