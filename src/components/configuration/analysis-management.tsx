"use client"
import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useApi } from "@/hooks/use-api"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"
import { useToast } from "@/hooks/use-toast"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useDebounce } from "@/hooks/use-debounce"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AuditAvatars } from "@/components/common/audit-avatars"
import { DataTable, type Column } from "@/components/common/data-table"
import {
  Loader2,
  Search,
  TestTube,
  Plus,
  Download,
  FileSpreadsheet,
  Pencil,
} from "lucide-react"
import { AnalysisDetailDialog } from "./components/analysis-detail-dialog"
import { CreateAnalysisCatalogDialog } from "./components/create-analysis-catalog-dialog"
import { EditAnalysisCatalogDialog } from "./components/edit-analysis-catalog-dialog"
import { DeleteAnalysisCatalogDialog } from "./components/delete-analysis-catalog-dialog"
import { ImportDataDialog } from "./components/import-data-dialog"
import { AnalysisHistoryDialog } from "./components/analysis-history-dialog"
import type { Analysis } from "@/types"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { conLaFechaDeHoy, descargarRespuesta } from "@/lib/descargar-archivo"

export function AnalysisManagement() {
  const { apiRequest } = useApi()
  const toastActions = useToast()
  const { habilitados: preciosFijosHabilitados } = usePreciosFijos()

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [totalAnalyses, setTotalAnalyses] = useState(0)
  const [analysesNextUrl, setAnalysesNextUrl] = useState<string | null>(null)
  const [sheetAnalysis, setSheetAnalysis] = useState<Analysis | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La búsqueda global manda acá con el código del análisis en `?buscar=`
  // (`/configuracion?tab=analisis&buscar=660475`). Es lo más cerca que se
  // puede llevar sin una ruta por análisis: el catálogo abre con el buscador
  // ya cargado y la ficha a la vista.
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("buscar") ?? "")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  // El parámetro se consume una sola vez: si quedara en la URL, volver atrás
  // desde otra pantalla recargaría una búsqueda que el usuario ya cambió.
  useEffect(() => {
    if (!searchParams.get("buscar")) return
    const siguientes = new URLSearchParams(searchParams)
    siguientes.delete("buscar")
    setSearchParams(siguientes, { replace: true })
  }, [searchParams, setSearchParams])

  const [refreshKey, setRefreshKey] = useState(0)

  const [isCreateAnalysisModalOpen, setIsCreateAnalysisModalOpen] = useState(false)
  const [isEditAnalysisModalOpen, setIsEditAnalysisModalOpen] = useState(false)
  const [isDeleteAnalysisModalOpen, setIsDeleteAnalysisModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedAnalysisForHistory, setSelectedAnalysisForHistory] = useState<Analysis | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const fetchAnalyses = useCallback(
    async (search = "", reset = true, showSearching = false) => {
      if (reset && !showSearching && isLoadingInitial) return
      if (!reset && isLoadingMore) return
      if (reset && showSearching && isSearching) return

      if (reset && !showSearching) {
        setIsLoadingInitial(true)
        setError(null)
      } else if (reset && showSearching) {
        setIsSearching(true)
      } else {
        setIsLoadingMore(true)
      }

      try {
        let url: string
        if (reset) {
          const params = new URLSearchParams({
            limit: "20",
            is_active: "true",
          })
          if (search.trim()) {
            params.append("search", search.trim())
          }
          url = `${CATALOG_ENDPOINTS.ANALYSIS}?${params.toString()}`
        } else {
          url = analysesNextUrl!
        }

        if (!url) return

        const response = await apiRequest(url)
        if (response.ok) {
          const data = await response.json()

          if (reset) {
            setAnalyses(data.results)
            setTotalAnalyses(data.count)
          } else {
            setAnalyses((prev) => [...prev, ...data.results])
          }

          setAnalysesNextUrl(data.next)
        } else {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = formatApiError(errorData, "Error al cargar los análisis.")
          setError(errorMessage)
          toastActions.error("Error", { description: errorMessage })
        }
      } catch (err) {
        console.error("Error fetching analyses:", err)
        const errorMessage = getErrorMessage(err, "Ocurrió un error inesperado al cargar análisis.")
        setError(errorMessage)
        toastActions.error("Error", { description: errorMessage })
      } finally {
        setIsLoadingInitial(false)
        setIsLoadingMore(false)
        setIsSearching(false)
      }
    },
    [apiRequest, toastActions, analysesNextUrl, isLoadingInitial, isLoadingMore, isSearching],
  )

  const hasMore = !!analysesNextUrl

  const loadMore = useCallback(() => {
    if (!isLoadingMore && analysesNextUrl && !isSearching) {
      fetchAnalyses("", false)
    }
  }, [isLoadingMore, analysesNextUrl, isSearching, fetchAnalyses])

  const loadMoreSentinelRef = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore: hasMore && !isSearching,
    onLoadMore: loadMore,
  })

  useEffect(() => {
    fetchAnalyses()
  }, [])

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return
    fetchAnalyses(debouncedSearchTerm, true, true)
  }, [debouncedSearchTerm])

  const openSheet = (analysis: Analysis) => {
    setSheetAnalysis(analysis)
    setSheetOpen(true)
  }

  const handleEditFromSheet = (analysis: Analysis) => {
    setSheetOpen(false)
    setSelectedAnalysis(analysis)
    setIsEditAnalysisModalOpen(true)
  }

  const handleDeleteFromSheet = (analysis: Analysis) => {
    setSheetOpen(false)
    setSelectedAnalysis(analysis)
    setIsDeleteAnalysisModalOpen(true)
  }

  const handleShowHistoryFromSheet = (analysis: Analysis) => {
    setSelectedAnalysisForHistory(analysis)
    setIsHistoryDialogOpen(true)
  }

  const handleCreateAnalysisSuccess = () => {
    setIsCreateAnalysisModalOpen(false)
    setRefreshKey((prev) => prev + 1)
    fetchAnalyses(searchTerm, true, true)
    toastActions.success("Éxito", { description: "Análisis creado correctamente." })
  }

  /**
   * Baja el catálogo entero en el mismo Excel que come el botón de importar.
   *
   * Son las dos hojas —análisis y determinaciones— con una columna de UB por
   * nomenclador. Lo que sale de acá se vuelve a subir por «Importar Datos» sin
   * editar nada: es el camino para sacar una copia, para trabajar el catálogo
   * afuera y para llevarlo a otra base.
   *
   * El catálogo son ~1400 análisis: se le da aire al timeout, que por defecto
   * está pensado para un JSON y no para armar un Excel.
   */
  const exportarCatalogo = async () => {
    setIsExporting(true)
    try {
      const response = await apiRequest(CATALOG_ENDPOINTS.ANALYSIS_EXPORT, { timeout: 120000 })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toastActions.error("Error", {
          description: formatApiError(errorData, "No se pudo exportar el catálogo."),
        })
        return
      }

      await descargarRespuesta(response, conLaFechaDeHoy("catalogo_analisis"))
      toastActions.success("Listo", { description: "El catálogo se descargó en Excel." })
    } catch (err) {
      toastActions.error("Error", {
        description: getErrorMessage(err, "No se pudo exportar el catálogo."),
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportDataSuccess = () => {
    setIsImportModalOpen(false)
    setRefreshKey((prev) => prev + 1)
    fetchAnalyses(searchTerm, true, true)
  }

  const handleEditAnalysisSuccess = () => {
    setIsEditAnalysisModalOpen(false)
    setSelectedAnalysis(null)
    setRefreshKey((prev) => prev + 1)
    fetchAnalyses(searchTerm, true, true)
    toastActions.success("Éxito", { description: "Análisis actualizado correctamente." })
  }

  const handleDeleteAnalysisSuccess = () => {
    setIsDeleteAnalysisModalOpen(false)
    setSelectedAnalysis(null)
    setRefreshKey((prev) => prev + 1)
    fetchAnalyses(searchTerm, true, true)
    toastActions.success("Éxito", { description: "Análisis desactivado correctamente." })
  }

  const columns: Column<Analysis>[] = [
    {
      id: "name",
      header: "Análisis",
      cell: (a) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <TestTube className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-gray-900">{a.name || "Sin nombre"}</span>
              {a.is_urgent && <Badge variant="destructive" className="text-[10px]">U</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "code",
      header: "Código",
      responsive: "hidden sm:table-cell",
      cell: (a) => (
        <Badge variant="outline" className="border-blue-300 bg-blue-100 font-mono text-[10px] font-semibold text-blue-800">
          {a.code || "N/A"}
        </Badge>
      ),
    },
    {
      id: "ub",
      // El análisis que se cobra a precio fijo muestra el precio y no la UB:
      // es lo que se le va a cobrar al paciente, y la UB de esa fila —si la
      // tiene— no participa de ese número.
      header: preciosFijosHabilitados ? "UB / Precio" : "UB",
      responsive: "hidden md:table-cell",
      cell: (a) =>
        preciosFijosHabilitados && a.cobra_precio_fijo ? (
          <Badge variant="outline" className="border-sky-300 bg-sky-50 text-[10px] text-sky-800">
            ${a.precio_particular ?? "0.00"} fijo
          </Badge>
        ) : (
          <span className="text-sm text-gray-600">{a.bio_unit || "N/A"}</span>
        ),
    },
    {
      id: "audit",
      header: "Auditoría",
      responsive: "hidden lg:table-cell",
      cell: (a) =>
        a.creation || a.last_change ? (
          <AuditAvatars creation={a.creation} lastChange={a.last_change} size="sm" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      // EL LÁPIZ EN LA FILA
      // Cuando la lista pasó de acordeón a tabla+ficha, editar quedó a dos
      // clics y escondido: había que abrir la ficha del análisis para recién
      // ahí encontrar el botón, al fondo. Para corregir un nombre o un UB eso
      // es todo el trabajo. Vuelve donde estaba.
      id: "acciones",
      header: "",
      align: "right",
      className: "w-12",
      cell: (a) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-500 hover:bg-blue-50 hover:text-[#204983]"
          title="Editar análisis"
          aria-label={`Editar ${a.name || "análisis"}`}
          onClick={(event) => {
            // La fila abre la ficha; el lápiz va derecho a editar.
            event.stopPropagation()
            setSelectedAnalysis(a)
            setIsEditAnalysisModalOpen(true)
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h3 className="text-base font-semibold text-gray-800">Análisis ({totalAnalyses})</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar análisis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white bg-transparent w-full sm:w-auto"
            onClick={exportarCatalogo}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Exportar a Excel
          </Button>
          <Button
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white bg-transparent w-full sm:w-auto"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            Importar Datos
          </Button>
          <Button
            className="bg-[#204983] hover:bg-[#1a3d6f] w-full sm:w-auto"
            onClick={() => setIsCreateAnalysisModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Análisis
          </Button>
        </div>
      </div>

      {!isLoadingInitial && error && <div className="text-center text-red-500 py-8">{error}</div>}

      <DataTable
        columns={columns}
        rows={analyses}
        getRowId={(a) => a.id}
        onRowClick={openSheet}
        isLoading={isLoadingInitial || isSearching}
        emptyMessage={searchTerm ? "No se encontraron análisis que coincidan con la búsqueda." : "No se encontraron análisis."}
        footer={
          hasMore ? (
            <div ref={loadMoreSentinelRef} className="flex items-center justify-center py-4 text-xs text-gray-400">
              {isLoadingMore ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Scroll para cargar más…</span>}
            </div>
          ) : analyses.length > 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">No hay más análisis para mostrar.</p>
          ) : null
        }
      />

      <AnalysisDetailDialog
        analysis={sheetAnalysis}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        refreshKey={refreshKey}
        onEdit={handleEditFromSheet}
        onDelete={handleDeleteFromSheet}
        onShowHistory={handleShowHistoryFromSheet}
        onDeterminacionesCopiadas={() => setRefreshKey((prev) => prev + 1)}
      />

      <CreateAnalysisCatalogDialog
        open={isCreateAnalysisModalOpen}
        onOpenChange={setIsCreateAnalysisModalOpen}
        onSuccess={handleCreateAnalysisSuccess}
      />

      {selectedAnalysis && (
        <>
          <EditAnalysisCatalogDialog
            open={isEditAnalysisModalOpen}
            onOpenChange={setIsEditAnalysisModalOpen}
            onSuccess={handleEditAnalysisSuccess}
            analysis={selectedAnalysis}
          />
          <DeleteAnalysisCatalogDialog
            open={isDeleteAnalysisModalOpen}
            onOpenChange={setIsDeleteAnalysisModalOpen}
            onSuccess={handleDeleteAnalysisSuccess}
            analysis={selectedAnalysis}
          />
        </>
      )}

      {selectedAnalysisForHistory && (
        <AnalysisHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          analysisId={selectedAnalysisForHistory?.id || null}
          analysisName={selectedAnalysisForHistory?.name || ""}
        />
      )}

      <ImportDataDialog
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onSuccess={handleImportDataSuccess}
      />
    </div>
  )
}
