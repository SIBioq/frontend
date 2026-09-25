"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Loader2,
  Search,
  PackageX,
  Trash,
  Pencil,
  ChevronDown,
  ChevronRight,
  TestTube2,
  Plus,
  History,
  Sigma,
} from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { unidadCompleta } from "@/lib/notacion"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { ListaOrdenable } from "@/components/common/lista-ordenable"
import { SubmoduloCorroboracionDialog } from "./submodulo-corroboracion-dialog"
import { CreateDeterminationDialog } from "./create-determination-dialog"
import { EditDeterminationDialog } from "./edit-determination-dialog"
import { DeleteDeterminationDialog } from "./delete-determination-dialog"
import { DeterminationHistoryDialog } from "./determination-history-dialog"
import { AuditAvatars } from "@/components/common/audit-avatars"
import type { Determination } from "@/types"
import { CATALOG_ENDPOINTS } from "@/config/api"
import {
  formatNamedReferenceRanges,
  formatReferenceRange,
  formatReferenceValues,
} from "@/lib/catalog-format"
import { formatApiError, getErrorMessage } from "@/lib/api-error"

interface AnalysisCatalog {
  id: number
  name: string | null
  code: string | null
}

interface AnalysisListProps {
  analysis: AnalysisCatalog
  showInactive: boolean
  refreshKey: number
}

// Las determinaciones de UN análisis entran todas de una: son cinco o treinta,
// no mil. Paginarlas de a 10 tenía un costo escondido — hasta no cargar la
// última página, `next` no era null y el arrastre para reordenar quedaba
// apagado. O sea que la función solo aparecía después de scrollear, que es
// justo cuando nadie la está buscando.
//
// El scroll infinito queda igual, de red por si algún análisis se va de escala.
const PAGE_LIMIT = 200

export const AnalysisList: React.FC<AnalysisListProps> = ({ analysis, showInactive, refreshKey }) => {
  const { apiRequest } = useApi()
  const toastActions = useToast()

  const [analyses, setAnalyses] = useState<Determination[]>([])
  const [totalAnalyses, setTotalAnalyses] = useState(0)
  const [analysesNextUrl, setAnalysesNextUrl] = useState<string | null>(null)
  const [expandedDeterminations, setExpandedDeterminations] = useState<Set<number>>(new Set())

  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [err, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [submodulosAbierto, setSubmodulosAbierto] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Determination | null>(null)

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedHistoryAnalysis, setSelectedHistoryAnalysis] = useState<{ id: number; name: string } | null>(null)

  const buildAnalysesUrl = useCallback(
    (offset = 0, search = "") => {
      let url = `${CATALOG_ENDPOINTS.DETERMINATIONS}?analysis=${analysis.id}&limit=${PAGE_LIMIT}&offset=${offset}&is_active=true`
      if (search) url += `&search=${encodeURIComponent(search)}`
      return url
    },
    [analysis.id],
  )

  const fetchAnalyses = useCallback(
    async (isNewSearchOrFilter = false) => {
      let currentUrlToFetch: string

      if (isNewSearchOrFilter) {
        setAnalyses([])
        setAnalysesNextUrl(null)
        setTotalAnalyses(0)
        currentUrlToFetch = buildAnalysesUrl(0, debouncedSearchTerm)
      } else {
        if (!analysesNextUrl) {
          setIsLoadingMore(false)
          return
        }
        currentUrlToFetch = analysesNextUrl
      }

      setIsLoadingInitial(isNewSearchOrFilter)
      setIsLoadingMore(!isNewSearchOrFilter)
      setError(null)

      try {
        const response = await apiRequest(currentUrlToFetch)
        if (response.ok) {
          const data = await response.json()

          const results = Array.isArray(data.results) ? data.results : []

          const filteredResults = results.filter(
            (determination: Determination) => determination.analysis === analysis.id,
          )

          setAnalyses((prev) => (isNewSearchOrFilter ? filteredResults : [...prev, ...filteredResults]))
          setTotalAnalyses(data.count || 0)
          setAnalysesNextUrl(data.next || null)
        } else {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = formatApiError(errorData, "Error al cargar las determinaciones.")
          setError(errorMessage)
          toastActions.error("Error", { description: errorMessage })
        }
      } catch (fetchErr) {
        console.error("Error fetching analyses:", fetchErr)
        const errorMessage = getErrorMessage(fetchErr, "Ocurrió un error inesperado al cargar determinaciones.")
        setError(errorMessage)
        toastActions.error("Error", { description: errorMessage })
      } finally {
        setIsLoadingInitial(false)
        setIsLoadingMore(false)
      }
    },
    [apiRequest, toastActions, buildAnalysesUrl, analysesNextUrl, debouncedSearchTerm, analysis.id],
  )

  /**
   * Ordenar las determinaciones arrastrándolas.
   *
   * SOLO CON TODAS A LA VISTA
   * =========================
   * El backend exige la lista COMPLETA de las activas: con una parcial tendría
   * que inventar dónde va lo que no vino, y ese invento termina impreso en un
   * informe. Así que arrastrar se apaga mientras haya una búsqueda filtrando o
   * queden páginas sin cargar.
   *
   * SE PINTA PRIMERO Y SE GUARDA DESPUÉS
   * ====================================
   * Soltar una fila y verla volver a su lugar mientras espera la red se siente
   * roto. Si el servidor rechaza, se restaura el orden anterior y se avisa.
   */
  const puedeOrdenar =
    !debouncedSearchTerm && !analysesNextUrl && analyses.length > 1

  const reordenarDeterminaciones = async (nuevas: Determination[]) => {
    const previas = analyses
    setAnalyses(nuevas)
    try {
      const respuesta = await apiRequest(
        CATALOG_ENDPOINTS.DETERMINATIONS_REORDENAR(analysis.id),
        { method: "POST", body: { determinaciones: nuevas.map((d) => d.id) } },
      )
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo guardar el orden."))
      }
      toastActions.success("Orden guardado", {
        description: "Vale para la carga de resultados y para el informe.",
      })
    } catch (err) {
      setAnalyses(previas)
      toastActions.error("No se pudo guardar el orden", {
        description: getErrorMessage(err, "Probá de nuevo."),
      })
    }
  }

  const toggleDetermination = (determinationId: number) => {
    setExpandedDeterminations((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(determinationId)) {
        newSet.delete(determinationId)
      } else {
        newSet.add(determinationId)
      }
      return newSet
    })
  }

  const handleSuccess = () => {
    fetchAnalyses(true)
    setIsCreateModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setSelectedAnalysis(null)
  }

  useEffect(() => {
    fetchAnalyses(true)
  }, [analysis.id, debouncedSearchTerm, showInactive, refreshKey])

  const hasMoreAnalyses = !!analysesNextUrl && analyses.length < totalAnalyses

  const loadMoreSentinelRef = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore: hasMoreAnalyses,
    onLoadMore: () => {
      if (analysesNextUrl && !isLoadingMore) {
        fetchAnalyses(false)
      }
    },
    dependencies: [analysesNextUrl, isLoadingMore],
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-col gap-2 px-2 md:px-4 sm:flex-row sm:justify-between sm:items-center">
        <h4 className="text-xs md:text-sm font-semibold text-gray-700 flex-shrink-0">
          Determinaciones ({totalAnalyses})
        </h4>
        <div className="relative w-full sm:w-auto flex-grow sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar determinación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm h-8 w-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {/* Junta determinaciones de la misma unidad y le pone un total que
              tiene que dar. El caso: la fórmula leucocitaria suma 100. */}
          <Button
            variant="outline"
            className="border-violet-600 text-violet-600 hover:bg-violet-600 hover:text-white bg-transparent flex-1 sm:flex-none"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setSubmodulosAbierto(true)
            }}
          >
            <Sigma className="mr-1 h-4 w-4" /> Submódulos
          </Button>
          <Button
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white bg-transparent flex-1 sm:flex-none"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsCreateModalOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Nueva Determinación
          </Button>
        </div>
      </div>

      {isLoadingInitial && (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Cargando determinaciones...</span>
        </div>
      )}

      {!isLoadingInitial && err && <div className="text-center text-red-500 py-4 text-sm">{err}</div>}

      {!isLoadingInitial && !err && analyses.length === 0 && (
        <div className="text-center text-gray-400 py-4 text-sm">
          <PackageX className="mx-auto h-8 w-8 text-gray-300 mb-1" />
          Este panel no tiene determinaciones
          {searchTerm ? " que coincidan con la búsqueda." : "."}
        </div>
      )}

      {/* Por qué no se puede arrastrar, cuando no se puede. Un arrastre que no
          hace nada se lee como que la pantalla está rota. */}
      {analyses.length > 1 && !puedeOrdenar && (
        <p className="px-2 md:px-4 pb-2 text-[11px] text-gray-400">
          {debouncedSearchTerm
            ? "Limpiá la búsqueda para poder reordenar arrastrando."
            : "Cargá todas las determinaciones para poder reordenarlas."}
        </p>
      )}

      {analyses.length > 0 && (
        <div className="space-y-2 px-2 md:px-4">
          <ListaOrdenable
            items={analyses}
            getId={(d) => d.id}
            onReorder={reordenarDeterminaciones}
            disabled={!puedeOrdenar}
          >
            {(analysisItem, manija) => {
            const isExpanded = expandedDeterminations.has(analysisItem.id)
            const referenceItems = [
              ...(analysisItem.reference_ranges?.length
                ? analysisItem.reference_ranges.map(formatReferenceRange)
                : formatReferenceValues(analysisItem.reference_values)),
              ...formatNamedReferenceRanges(analysisItem.named_ranges),
            ]

            return (
              <div
                key={analysisItem.id}
                className={`border rounded-md transition-all duration-300 bg-white border-gray-100 ${
                  isExpanded ? "ring-2 ring-blue-200" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 gap-2">
                  {/* Fuera del área que expande: arrastrar y desplegar son dos
                      gestos distintos y no pueden compartir el mismo lugar. */}
                  {manija ? (
                    <div className="flex-shrink-0 self-start pt-1" onClick={(e) => e.stopPropagation()}>
                      {manija}
                    </div>
                  ) : null}
                  <div
                    className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-gray-50 transition-colors rounded-md p-1 -m-1 min-w-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDetermination(analysisItem.id)
                    }}
                  >
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-gray-500" />
                      )}
                      <TestTube2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-medium text-gray-800 truncate">{analysisItem.name}</p>
                      <p className="text-[10px] md:text-xs text-gray-500">Código: {analysisItem.code || "N/A"}</p>
                      <p className="text-[10px] md:text-xs text-gray-500">Unidad: {unidadCompleta(analysisItem.measure_unit, analysisItem.scientific_exponent)}</p>
                      <p className="text-[10px] md:text-xs text-gray-500">
                        Fórmula:{" "}
                        {analysisItem.formula ? (
                          <span className="font-mono break-all text-blue-600">{analysisItem.formula}</span>
                        ) : (
                          <span className="italic text-gray-400">Sin fórmula</span>
                        )}
                      </p>
                      <div className="mt-1">
                        {(analysisItem.creation || analysisItem.last_change) && (
                          <AuditAvatars
                            creation={analysisItem.creation}
                            lastChange={analysisItem.last_change}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              setSelectedAnalysis(analysisItem)
                              setIsEditModalOpen(true)
                            }}
                            className="h-7 w-7 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar Determinación</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              setSelectedAnalysis(analysisItem)
                              setIsDeleteModalOpen(true)
                            }}
                            className="h-7 w-7 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar Determinación</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 bg-gray-50" onClick={(e) => e.stopPropagation()}>
                    <div className="mb-3 rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold text-gray-700">Valores de referencia</p>
                      {referenceItems.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {referenceItems.map((item) => (
                            <Badge key={item} variant="outline" className="bg-slate-50 text-[10px] text-slate-700">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs italic text-gray-400">Sin valores de referencia cargados</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setSelectedHistoryAnalysis({ id: analysisItem.id, name: analysisItem.name })
                        setIsHistoryDialogOpen(true)
                      }}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <History className="h-4 w-4" />
                      Ver Historial Completo
                    </Button>
                  </div>
                )}
              </div>
            )
            }}
          </ListaOrdenable>
        </div>
      )}

      {hasMoreAnalyses && (
        <div ref={loadMoreSentinelRef} className="flex justify-center items-center py-4">
          {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        </div>
      )}
      {!hasMoreAnalyses && analyses.length > 0 && !isLoadingInitial && (
        <p className="text-center text-xs text-gray-400 mt-3">Fin de las determinaciones.</p>
      )}

      <SubmoduloCorroboracionDialog
        open={submodulosAbierto}
        onOpenChange={setSubmodulosAbierto}
        analysisId={analysis.id}
        analysisName={analysis.name}
      />

      <CreateDeterminationDialog
        analysisId={analysis.id}
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open)
        }}
        onSuccess={handleSuccess}
      />

      {selectedAnalysis && (
        <EditDeterminationDialog
          determination={selectedAnalysis}
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open)
            if (!open) setSelectedAnalysis(null)
          }}
          onSuccess={handleSuccess}
        />
      )}

      {isDeleteModalOpen && selectedAnalysis && (
        <DeleteDeterminationDialog
          determination={selectedAnalysis}
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open)
            if (!open) setSelectedAnalysis(null)
          }}
          onSuccess={handleSuccess}
        />
      )}

      {isHistoryDialogOpen && selectedHistoryAnalysis && (
        <DeterminationHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          determinationId={selectedHistoryAnalysis.id}
          determinationName={selectedHistoryAnalysis.name}
        />
      )}
    </div>
  )
}
