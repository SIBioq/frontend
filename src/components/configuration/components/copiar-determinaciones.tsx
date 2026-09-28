"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Loader2, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/hooks/use-toast"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type { Analysis } from "@/types"

/**
 * Traer a este análisis las determinaciones de otro.
 *
 * ES UNA COPIA, NO UN VÍNCULO
 * ===========================
 * Muchos análisis arrancan siendo casi otro: las mismas determinaciones, las
 * mismas unidades y los mismos valores de referencia, y después dos o tres
 * cambios propios. Cargarlas de nuevo a mano es volver a tipear lo mismo
 * —incluidos los rangos, que son un dato clínico— y ahí es donde se cuela el
 * error.
 *
 * Una vez copiadas dejan de tener relación con el original: son filas nuevas y
 * cada análisis es dueño de las suyas. Se le cambia la unidad a una y la del
 * otro no se entera; se da de baja acá y allá sigue estando.
 *
 * Lo que ya existe con el mismo nombre no se pisa y se avisa cuáles fueron:
 * copiar dos veces no duplica y no borra lo que alguien ya ajustó a mano.
 */

interface Props {
  /** El análisis que RECIBE las determinaciones. */
  analysis: Analysis
  /** Para recargar la lista de determinaciones de abajo. */
  onCopiadas?: () => void
}

type Resultado = { copiadas: number; omitidas: string[] }

export function CopiarDeterminaciones({ analysis, onCopiadas }: Props) {
  const { apiRequest } = useApi()
  const toastActions = useToast()

  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<Analysis[]>([])
  const [buscando, setBuscando] = useState(false)
  const [copiandoId, setCopiandoId] = useState<number | null>(null)
  const busquedaDebounced = useDebounce(busqueda, 300)

  const buscar = useCallback(
    async (texto: string) => {
      if (!texto.trim()) {
        setResultados([])
        return
      }
      setBuscando(true)
      try {
        const respuesta = await apiRequest(
          `${CATALOG_ENDPOINTS.ANALYSIS}?search=${encodeURIComponent(texto)}&limit=10&is_active=true`,
        )
        if (!respuesta.ok) return
        const datos = await respuesta.json()
        const lista: Analysis[] = Array.isArray(datos) ? datos : datos.results || []
        // El mismo análisis no se ofrece: no puede copiarse a sí mismo.
        setResultados(lista.filter((a) => a.id !== analysis.id))
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    },
    [apiRequest, analysis.id],
  )

  useEffect(() => {
    if (!abierto) return
    void buscar(busquedaDebounced)
  }, [busquedaDebounced, abierto, buscar])

  const copiarDe = async (origen: Analysis) => {
    setCopiandoId(origen.id)
    try {
      const respuesta = await apiRequest(CATALOG_ENDPOINTS.ANALYSIS_COPIAR_DETERMINACIONES(analysis.id), {
        method: "POST",
        body: { origen: origen.id },
      })
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) {
        throw new Error(formatApiError(datos, "No se pudieron copiar las determinaciones."))
      }

      const { copiadas, omitidas } = datos as Resultado
      if (copiadas === 0) {
        toastActions.info("No había nada para copiar", {
          description:
            omitidas.length > 0
              ? `${analysis.name} ya tiene todas las determinaciones de ${origen.name}.`
              : `${origen.name} no tiene determinaciones cargadas.`,
        })
      } else {
        toastActions.success(
          `${copiadas} ${copiadas === 1 ? "determinación copiada" : "determinaciones copiadas"}`,
          {
            description:
              omitidas.length > 0
                ? `De ${origen.name}. Ya estaban y no se tocaron: ${omitidas.join(", ")}.`
                : `De ${origen.name}. Editalas acá sin que cambie el original.`,
          },
        )
      }

      setAbierto(false)
      setBusqueda("")
      setResultados([])
      onCopiadas?.()
    } catch (error) {
      toastActions.error("Error", {
        description: getErrorMessage(error, "No se pudieron copiar las determinaciones."),
      })
    } finally {
      setCopiandoId(null)
    }
  }

  return (
    // En un Popover de Radix y no en un div absoluto: se monta fuera del modal,
    // así que el modal ya no lo recorta ni hay que cerrarlo a mano al clickear
    // afuera.
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copiar de otro análisis
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="max-h-(--radix-popover-content-available-height) w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-2"
      >
        <p className="px-1 pb-2 text-xs text-gray-500">
          Se copian las determinaciones con sus valores de referencia. Quedan como propias de{" "}
          <span className="font-medium text-gray-700">{analysis.name}</span>: editarlas o darlas de
          baja acá no toca las del otro análisis.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            autoFocus
            className="h-9 pl-8"
            placeholder="Buscar análisis por código o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="mt-1 max-h-56 overflow-y-auto">
          {buscando && <p className="px-3 py-2 text-sm text-gray-400">Buscando…</p>}
          {!buscando && busqueda.trim() && resultados.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No se encontró ningún análisis.</p>
          )}
          {!buscando &&
            resultados.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={copiandoId != null}
                onClick={() => copiarDe(a)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {copiandoId === a.id ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#204983]" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0 text-[#204983]" />
                )}
                <span className="font-mono text-[10px] text-gray-500">{a.code}</span>
                <span className="truncate">{a.name}</span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
