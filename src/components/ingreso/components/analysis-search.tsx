"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search, TestTube, Package, Plus } from "lucide-react"
import { Input } from "../../ui/input"
import { Button } from "../../ui/button"
import { Badge } from "../../ui/badge"
import { useApi } from "../../../hooks/use-api"
import { useDebounce } from "../../../hooks/use-debounce"
import { useInfiniteScroll } from "../../../hooks/use-infinite-scroll"
import { toast } from "sonner"
import type { Analysis, SelectedAnalysis } from "../../../types"
import { CATALOG_ENDPOINTS } from "../../../config/api"
import {
  ACTO_BIOQUIMICO,
  compararCodigos,
  esActoDeIngreso,
  mismoCodigo,
  normalizarCodigo,
} from "../../../lib/codigos-analisis"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"


interface AnalysisSearchProps {
  selectedAnalyses: SelectedAnalysis[]
  onAnalysisChange: (analyses: SelectedAnalysis[]) => void
}

interface PaginatedResponse<T> {
  next: string | null
  results: T[]
}

export function AnalysisSearch({ selectedAnalyses, onAnalysisChange }: AnalysisSearchProps) {
  // Un análisis con precio cargado pero la función deshabilitada se cobra
  // por UB: anunciarle el precio a quien lo elige sería mentirle.
  const { habilitados: preciosFijosHabilitados } = usePreciosFijos()
  const { apiRequest } = useApi()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<Analysis[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [nextUrl, setNextUrl] = useState<string | null>(null)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const resultsRef = useRef<HTMLDivElement>(null)

  const loadMoreAnalyses = () => {
    if (nextUrl && !isLoadingMore) {
      searchAnalyses(debouncedSearchTerm, false)
    }
  }

  const setLastElementRef = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore,
    onLoadMore: loadMoreAnalyses,
  })

  /**
   * Trae el acto bioquímico común del catálogo.
   *
   * Se pide recién cuando hace falta —al agregar la primera práctica— y no al
   * montar: la mayoría de las veces la pantalla se abre y se cierra sin cargar
   * nada, y sería un viaje al servidor por cada protocolo que no se llegó a
   * empezar.
   */
  const traerActoBioquimico = async (): Promise<Analysis | null> => {
    try {
      const url = `${CATALOG_ENDPOINTS.ANALYSIS}?code=${ACTO_BIOQUIMICO}&is_active=true`
      const response = await apiRequest(url)
      if (response.ok) {
        const data: PaginatedResponse<Analysis> = await response.json()
        return data.results.find((a) => mismoCodigo(a.code, ACTO_BIOQUIMICO)) ?? null
      }
    } catch (error) {
      console.error("Error trayendo el acto bioquímico:", error)
    }
    return null
  }

  // Trae el análisis cuyo código es EXACTAMENTE `code`. Se usa al presionar Enter
  // con un código: garantiza que se agregue ese código y no un match parcial o un
  // resultado viejo del debounce (bug: a veces tomaba un código más corto).
  const fetchByExactCode = async (code: string): Promise<Analysis | null> => {
    try {
      const url = `${CATALOG_ENDPOINTS.ANALYSIS}?code=${code}&is_active=true`
      const response = await apiRequest(url)
      if (response.ok) {
        const data: PaginatedResponse<Analysis> = await response.json()
        return data.results.find((a) => mismoCodigo(a.code, code)) ?? null
      }
    } catch (error) {
      console.error(`Error fetching analysis by code ${code}:`, error)
    }
    return null
  }

  const searchAnalyses = async (term: string, isNewSearch = false) => {
    if (!term.trim()) {
      setSearchResults([])
      setShowResults(false)
      setHasMore(false)
      setNextUrl(null)
      return
    }

    try {
      if (isNewSearch) {
        setIsSearching(true)
        setSearchResults([])
      } else {
        setIsLoadingMore(true)
      }

      const url = isNewSearch
        ? `${CATALOG_ENDPOINTS.ANALYSIS}?search=${encodeURIComponent(term.trim())}&is_active=true&limit=20&offset=0`
        : nextUrl

      if (!url) return

      const response = await apiRequest(url)

      if (response.ok) {
        const data: PaginatedResponse<Analysis> = await response.json()
        const newResults = data.results || []

        if (isNewSearch) {
          setSearchResults(newResults)
        } else {
          setSearchResults((prev) => [...prev, ...newResults])
        }

        setHasMore(!!data.next)
        setNextUrl(data.next)
        setShowResults(newResults.length > 0 || searchResults.length > 0)
      } else {
        console.error("Search failed with status:", response.status)
      }
    } catch (error) {
      console.error("Error searching analyses:", error)
    } finally {
      setIsSearching(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    setHighlightedIndex(0)
    if (debouncedSearchTerm.trim()) {
      searchAnalyses(debouncedSearchTerm, true)
    } else {
      setSearchResults([])
      setShowResults(false)
      setHasMore(false)
      setNextUrl(null)
    }
  }, [debouncedSearchTerm])

  /**
   * Agrega el análisis elegido, actos bioquímicos incluidos.
   *
   * EL ACTO COMÚN VIENE CON LA PRIMERA PRÁCTICA
   * ===========================================
   * Todo protocolo lleva un acto, así que hacerlo tipear siempre es hacer
   * tipear siempre lo mismo. Se agrega junto con la primera práctica y UNA
   * SOLA VEZ: si quien atiende lo saca —porque este caso no lo lleva— no
   * vuelve al agregar la siguiente.
   *
   * Es la diferencia con cómo funcionaba antes, que lo reponía en cada
   * agregado: sacarlo era imposible, volvía solo y había que borrarlo al final
   * de todo, cuando ya nadie se acordaba.
   *
   * SI YA HAY UN ACTO, NO SE TOCA
   * =============================
   * Al paciente anónimo se le carga el ABI (661001) al elegirlo, porque casi
   * siempre es un internado. Ese protocolo YA tiene su acto: sumarle el común
   * sería cobrar dos veces por lo mismo. Lo mismo si alguien eligió uno a mano.
   *
   * Los actos se siguen pudiendo elegir del buscador como cualquier práctica:
   * cuál corresponde lo sabe quien atiende, no el código del análisis.
   */
  const handleAddAnalysis = async (analysis: Analysis) => {
    if (selectedAnalyses.find((a) => a.id === analysis.id)) {
      toast.info(`El análisis "${analysis.name}" ya está seleccionado`)
      setSearchTerm("")
      setShowResults(false)
      return
    }

    const selectedAnalysis: SelectedAnalysis = {
      ...analysis,
      is_authorized: false,
    }

    // La primera práctica del protocolo, sin ningún acto todavía: se suma el
    // común. Se mira que no haya NINGÚN acto y no solo el común, para no
    // pisarle el ABI al internado.
    const yaHayActo = selectedAnalyses.some((a) => esActoDeIngreso(a.code))
    const yaHayPractica = selectedAnalyses.some((a) => !esActoDeIngreso(a.code))
    const esLaPrimeraPractica =
      !esActoDeIngreso(analysis.code) && !yaHayActo && !yaHayPractica

    const actoAutomatico = esLaPrimeraPractica ? await traerActoBioquimico() : null

    // Los actos van arriba de todo y ordenados por código: son el ítem de
    // facturación del protocolo, no una práctica más en el medio de la lista.
    const conElNuevo = [...selectedAnalyses, selectedAnalysis]
    if (actoAutomatico) {
      conElNuevo.push({ ...actoAutomatico, is_authorized: false })
    }
    const actos = conElNuevo
      .filter((a) => esActoDeIngreso(a.code))
      .sort((a, b) => compararCodigos(a.code, b.code))
    const practicas = conElNuevo.filter((a) => !esActoDeIngreso(a.code))

    onAnalysisChange([...actos, ...practicas])

    if (actoAutomatico) {
      toast.success(`Acto bioquímico (${ACTO_BIOQUIMICO}) agregado`, {
        description: "Si este protocolo no lo lleva, se puede quitar.",
      })
    }

    if (analysis.is_obsolete) {
      toast.warning(`"${analysis.name}" está marcado como en desuso (sin UB vigente). Verificá antes de continuar.`)
    } else {
      toast.success(`Análisis "${analysis.name}" agregado`)
    }

    setSearchTerm("")
    setShowResults(false)
  }

  const filteredResults = searchResults.filter(
    (analysis) => !selectedAnalyses.find((selected) => selected.id === analysis.id),
  )

  // Si el término es un código numérico, el match EXACTO va primero (y queda
  // resaltado por defecto), para que Enter no agarre un código parcial/más corto.
  // Si el término parece un código, el match EXACTO va primero (y queda
  // resaltado por defecto), para que Enter no agarre un código parcial.
  const terminoComoCodigo = normalizarCodigo(searchTerm)
  const orderedResults = !terminoComoCodigo
    ? filteredResults
    : [...filteredResults].sort(
        (a, b) =>
          (mismoCodigo(a.code, terminoComoCodigo) ? 0 : 1) -
          (mismoCodigo(b.code, terminoComoCodigo) ? 0 : 1),
      )

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, orderedResults.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const term = searchTerm.trim()

      // Si hay un análisis con EXACTAMENTE ese código, gana siempre: el
      // término puede ser también parte del nombre de otro.
      const exact = orderedResults.find((a) => mismoCodigo(a.code, term))
      if (exact) {
        handleAddAnalysis(exact)
        return
      }
      // No está entre los resultados visibles (debounce o paginación): se
      // pregunta por el código exacto antes de resignarse al resaltado.
      //
      // Solo si el término puede ser un código. Un código no tiene espacios y
      // tiene al menos un dígito (`660001`, `A15`), así que buscar por nombre
      // no paga un viaje al servidor antes de agregar el resaltado.
      if (/^[\w.-]+$/.test(term) && /\d/.test(term)) {
        const fetched = await fetchByExactCode(term)
        if (fetched) {
          handleAddAnalysis(fetched)
          return
        }
      }

      // Texto: agregar el análisis resaltado.
      if (orderedResults.length > 0) {
        handleAddAnalysis(orderedResults[highlightedIndex] ?? orderedResults[0])
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Buscar por nombre o código... (↑↓ para elegir, Enter agrega)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 border-gray-300 focus:border-[#204983] focus:ring-[#204983]"
          onFocus={() => searchTerm && setShowResults(true)}
          // Cerrar al perder el foco, pero NO cuando el foco se va a la propia
          // lista: eso lo frena el `onMouseDown` del desplegable, que impide el
          // blur. Ver el comentario de ahí abajo.
          onBlur={() => setShowResults(false)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#204983]" />
          </div>
        )}
      </div>

      {showResults && orderedResults.length > 0 && (
        <div
          ref={resultsRef}
          // EL CLICK EN EL + NO TIENE QUE CERRAR LA LISTA ANTES DE LLEGAR
          // ==============================================================
          // Antes esto se resolvía con `onBlur` + `setTimeout(200)`: se cerraba
          // la lista 200 ms después de perder el foco, esperando que el click
          // llegara primero. Un click normal entra; uno en el que se aprieta y
          // se suelta con calma —o el de un touchpad con la mano apoyada— tarda
          // más que eso, y ahí el `+` se desmontaba entre el mousedown y el
          // mouseup: el click no ocurría nunca y el botón parecía roto.
          //
          // `preventDefault` en el mousedown evita que el input pierda el foco,
          // así no hay blur, no hay carrera y no hace falta adivinar cuánto
          // tarda una persona en soltar el botón.
          onMouseDown={(event) => event.preventDefault()}
          // Alto: entran ~5 resultados en vez de los ~3 de antes, sin pasarse
          // de la mitad de la pantalla en una notebook o un teléfono.
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[min(22rem,50vh)] overflow-y-auto"
        >
          {orderedResults.map((analysis, index) => (
            <div
              key={`analysis-${analysis.id}`}
              ref={index === orderedResults.length - 1 ? setLastElementRef : null}
              onMouseEnter={() => setHighlightedIndex(index)}
              // El nombre de un análisis puede ser largo ("Perfil tiroideo
              // (TSH, T3, T4 libre)"). Sin `min-w-0` el bloque de la izquierda
              // no achica, y en un teléfono el botón de agregar se iba afuera
              // del desplegable: el resultado se veía pero no se podía elegir.
              className={`flex items-center justify-between gap-2 p-3 border-b border-gray-100 last:border-b-0 ${
                index === highlightedIndex ? "bg-[#204983]/10" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <Package className="h-4 w-4 shrink-0 text-[#204983]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium break-words">{analysis.name}</div>
                  <div className="text-xs text-gray-500">
                    Código: {analysis.code || "N/A"} |{" "}
                    {preciosFijosHabilitados && analysis.cobra_precio_fijo
                      ? `Precio fijo: $${analysis.precio_particular ?? "0.00"}`
                      : `UB: ${analysis.bio_unit}`}
                  </div>
                </div>
                {analysis.is_urgent && (
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    Urgente
                  </Badge>
                )}
                {analysis.is_obsolete && (
                  <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-700 text-xs">
                    En desuso
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAnalysis(analysis)}
                aria-label={`Agregar ${analysis.name}`}
                className="shrink-0 border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {isLoadingMore && (
            <div className="flex items-center justify-center p-3 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#204983] mr-2" />
              Cargando más análisis...
            </div>
          )}

          {!hasMore && filteredResults.length > 0 && (
            <div className="text-center p-2 text-xs text-gray-400">No hay más resultados</div>
          )}
        </div>
      )}

      {showResults && searchTerm && filteredResults.length === 0 && !isSearching && (
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          <TestTube className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No se encontraron análisis para "{searchTerm}"</p>
        </div>
      )}
    </div>
  )
}
