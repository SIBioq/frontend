"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AuditAvatars } from "@/components/common/audit-avatars"
import { History, Pencil, Trash, TestTube } from "lucide-react"
import { AnalysisList } from "./analysis-list"
import { CopiarDeterminaciones } from "./copiar-determinaciones"
import { formatAnalysisCategory } from "@/lib/catalog-format"
import type { Analysis, SubmoduloDeCorroboracion } from "@/types"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"
import { useApiQuery } from "@/hooks/use-api-query"
import { CATALOG_ENDPOINTS } from "@/config/api"

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
  // Los submódulos se editan en su propio diálogo; acá sólo se listan para que
  // la ficha diga qué sumas controla el análisis sin tener que abrirlo.
  const submodulosQuery = useApiQuery<SubmoduloDeCorroboracion[] | { results: SubmoduloDeCorroboracion[] }>({
    queryKey: ["catalog", "submodulos", analysis?.id, refreshKey],
    url: `${CATALOG_ENDPOINTS.SUBMODULOS_CORROBORACION}?analysis=${analysis?.id}`,
    enabled: open && Boolean(analysis?.id),
  })
  const datosSubmodulos = submodulosQuery.data
  const submodulos: SubmoduloDeCorroboracion[] = (Array.isArray(datosSubmodulos) ? datosSubmodulos : datosSubmodulos?.results ?? []).filter(
    (s) => s.analysis === analysis?.id && s.is_active !== false,
  )

  // La ficha pide el análisis a su endpoint en vez de confiar en la fila del
  // listado, que queda vieja después de editar hasta que se recarga la página.
  const detalleQuery = useApiQuery<Analysis>({
    queryKey: ["catalog", "analysis", analysis?.id, refreshKey],
    url: analysis ? CATALOG_ENDPOINTS.ANALYSIS_DETAIL(analysis.id) : "",
    enabled: open && Boolean(analysis?.id),
  })

  if (!analysis) return null
  const data = detalleQuery.data?.id === analysis.id ? detalleQuery.data : analysis
  // Los mismos renglones que se cargan en la edición: un UB por nomenclador.
  const ubPorNomenclador = [...(data.bio_unit_values ?? [])].sort(
    (a, b) => a.year - b.year || (a.nbu_name ?? "").localeCompare(b.nbu_name ?? ""),
  )
  const siNo = (valor: boolean | undefined) => (valor ? "Sí" : "No")
  const camposDeLaFicha = [
    { etiqueta: "Código", valor: data.code || "—" },
    { etiqueta: "UB vigente", valor: data.bio_unit || "—" },
    { etiqueta: "Categoría NBU", valor: (data.category && formatAnalysisCategory(data.category)) || "—" },
    { etiqueta: "Urgente", valor: siNo(data.is_urgent) },
    { etiqueta: "Lleva resultado", valor: siNo(data.lleva_resultado) },
    { etiqueta: "Requiere derivación", valor: siNo(data.requires_derivacion) },
    { etiqueta: "Normalizado (N)", valor: siNo(data.is_ref_normalized) },
    { etiqueta: "En desuso", valor: siNo(data.is_obsolete) },
    ...(preciosFijosHabilitados
      ? [
          { etiqueta: "Cobra precio fijo", valor: siNo(data.cobra_precio_fijo) },
          // El precio va aunque no se cobre fijo: si no, lo cargado sólo se ve
          // al abrir la edición.
          { etiqueta: "Precio particular", valor: `$${data.precio_particular ?? "0.00"}` },
        ]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-0 border-b border-gray-100 p-5 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TestTube className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                <span className="truncate">{data.name || "Sin nombre"}</span>
                {data.is_urgent && <Badge variant="destructive">Urgente</Badge>}
                {data.category && formatAnalysisCategory(data.category) && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700">
                    {formatAnalysisCategory(data.category)}
                  </Badge>
                )}
                {data.is_ref_normalized && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700" title="Normalizado (N) en el NBU">
                    N
                  </Badge>
                )}
                {data.is_obsolete && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    En desuso
                  </Badge>
                )}
                {preciosFijosHabilitados && data.cobra_precio_fijo && (
                  <Badge
                    variant="outline"
                    className="bg-sky-50 text-sky-700"
                    title="Al paciente se le cobra un precio cargado, no la cuenta por UB"
                  >
                    ${data.precio_particular ?? "0.00"} fijo
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Código <span className="font-mono font-semibold text-blue-800">{data.code || "N/A"}</span> · UB{" "}
                {data.bio_unit || "N/A"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* Todos los campos del formulario, también los que están en "No":
              la ficha tiene que alcanzar para saber cómo está cargado el
              análisis sin abrir la edición. */}
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {camposDeLaFicha.map((campo) => (
              <div
                key={campo.etiqueta}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <dt className="text-sm font-medium text-gray-600">{campo.etiqueta}</dt>
                <dd className="text-right text-sm font-semibold text-gray-800">{campo.valor}</dd>
              </div>
            ))}
          </dl>

          {submodulos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submódulos de corroboración</p>
              <ul className="mt-2 space-y-1.5">
                {submodulos.map((sub) => (
                  <li key={sub.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">{sub.nombre}</span>
                    <span className="text-gray-500">
                      {" "}
                      · suma {Number(sub.total_esperado)}
                      {Number(sub.tolerancia) > 0 && ` ± ${Number(sub.tolerancia)}`}
                    </span>
                    {sub.determinaciones_detalle && sub.determinaciones_detalle.length > 0 && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {sub.determinaciones_detalle.map((d) => d.name).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">UB por nomenclador</p>
            {ubPorNomenclador.length > 0 ? (
              <dl className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {ubPorNomenclador.map((item) => (
                  <div
                    key={`${item.nbu_id ?? "sin-nbu"}-${item.year}`}
                    className="flex items-center justify-between gap-2 px-3 py-1.5"
                  >
                    <dt className="text-sm text-gray-700">
                      {item.nbu_name || "Sin nomenclador"}
                      <span className="text-gray-400"> · {item.year}</span>
                    </dt>
                    <dd className="text-sm font-semibold text-gray-800">{item.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Sin UB cargado en ningún nomenclador</p>
            )}
          </div>

          {data.nbu_info && (data.nbu_info.work_minimum || data.nbu_info.interpretation || data.nbu_info.patient_instructions || data.nbu_info.report_note) && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ficha NBU</p>
              {data.nbu_info.work_minimum && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Norma mínima de trabajo: </span>
                  {data.nbu_info.work_minimum}
                </p>
              )}
              {data.nbu_info.interpretation && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Interpretación (alcance/facturación): </span>
                  {data.nbu_info.interpretation}
                </p>
              )}
              {data.nbu_info.patient_instructions && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Instrucciones al paciente: </span>
                  {data.nbu_info.patient_instructions}
                </p>
              )}
              {data.nbu_info.report_note && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Nota de informe: </span>
                  {data.nbu_info.report_note}
                </p>
              )}
            </div>
          )}

          {(data.creation || data.last_change) && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auditoría</span>
              <AuditAvatars creation={data.creation} lastChange={data.last_change} size="sm" />
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
            <Button size="sm" className="bg-[#204983] hover:bg-[#1a3d6f]" onClick={() => onEdit(data)}>
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
