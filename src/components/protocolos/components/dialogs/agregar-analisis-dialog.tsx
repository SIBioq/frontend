"use client"

import { useState } from "react"
import { Loader2, Minus, Plus } from "lucide-react"

import { AnalysisSearch } from "@/components/ingreso/components/analysis-search"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SelectedAnalysis } from "@/types"

/**
 * Agregar análisis a un protocolo que ya existe.
 *
 * USA EL MISMO BUSCADOR QUE EL INGRESO
 * ====================================
 * No es sólo por no repetir código: el buscador ya sabe filtrar obsoletos,
 * mostrar los módulos y no ofrecer dos veces lo mismo. Un segundo buscador
 * distinto acá terminaría con otras reglas, y agregar un análisis desde el
 * detalle no debería comportarse distinto que cargarlo al principio.
 *
 * QUÉ SE MANDA
 * ============
 * Solo los ids. Las UB, los precios y la autorización los resuelve el backend
 * con el nomenclador de la obra social del protocolo — que es el mismo cálculo
 * de siempre, y no algo que la pantalla pueda adivinar.
 *
 * EL ACTO BIOQUÍMICO TAMBIÉN SE PUEDE AGREGAR
 * ===========================================
 * En el ingreso se pone solo con la primera práctica, pero se puede quitar —y
 * el protocolo que se quedó sin acto hay que poder arreglarlo desde acá.
 * Cobrarlo dos veces no es un riesgo: el buscador no ofrece los análisis que el
 * protocolo ya tiene, y el backend rebota el duplicado igual.
 *
 * Acá el acto NO se agrega solo: eso pasa cuando el protocolo arranca vacío, y
 * uno que ya existe nunca lo está.
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Los que el protocolo ya tiene: id del ANÁLISIS y su código.
   *
   * El id del análisis y no el del detalle — son cosas distintas y el buscador
   * deduplica por análisis. El código lo usa el buscador para dejar los actos
   * bioquímicos arriba de la lista.
   */
  yaEstan: { id: number; code: string }[]
  onAgregar: (analysisIds: number[]) => Promise<void>
}

export function AgregarAnalisisDialog({ open, onOpenChange, yaEstan, onAgregar }: Props) {
  const [elegidos, setElegidos] = useState<SelectedAnalysis[]>([])
  const [guardando, setGuardando] = useState(false)

  const cerrar = (abierto: boolean) => {
    if (!abierto) setElegidos([])
    onOpenChange(abierto)
  }

  const confirmar = async () => {
    if (elegidos.length === 0) return
    setGuardando(true)
    try {
      await onAgregar(elegidos.map((a) => a.id))
      setElegidos([])
      onOpenChange(false)
    } finally {
      setGuardando(false)
    }
  }

  // El buscador recibe los ya elegidos MÁS los que el protocolo ya tiene, así
  // no ofrece un análisis que va a rebotar del backend por duplicado.
  const idsQueYaEstan = yaEstan.map((a) => a.id)
  const paraElBuscador: SelectedAnalysis[] = [
    ...elegidos,
    ...yaEstan
      .filter((a) => !elegidos.some((e) => e.id === a.id))
      .map((a) => ({ id: a.id, code: a.code }) as SelectedAnalysis),
  ]

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      {/* `overflow-visible` a propósito: el desplegable del buscador se posiciona
          absoluto y con el `overflow-y-auto` que trae el diálogo por defecto
          quedaba recortado abajo — se veían dos resultados y había que
          scrollear el diálogo entero para ver el resto. La altura igual está
          acotada: el desplegable tiene su tope y la lista de elegidos también. */}
      <DialogContent className="max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle>Agregar análisis</DialogTitle>
          <DialogDescription>
            Se agregan al final de la lista. El precio y la autorización se
            recalculan con la obra social del protocolo.
          </DialogDescription>
        </DialogHeader>

        <AnalysisSearch
          selectedAnalyses={paraElBuscador}
          onAnalysisChange={(todos) =>
            // El buscador devuelve la lista entera; acá interesan solo los que
            // no estaban en el protocolo.
            setElegidos(todos.filter((a) => !idsQueYaEstan.includes(a.id)))
          }
        />

        {elegidos.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">
              Se van a agregar {elegidos.length}:
            </p>
            {/* CADA UNO SE PUEDE SACAR DE ACÁ
                ==============================
                Agregar el análisis equivocado es de las cosas más fáciles de
                hacer en esta pantalla: se busca por código y un dígito de más
                trae otra práctica. Sin esto había que cancelar el diálogo
                entero y volver a cargar los que sí estaban bien. */}
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {elegidos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm text-gray-800 hover:bg-white"
                >
                  <span className="min-w-0 break-words">· {a.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setElegidos((previos) => previos.filter((e) => e.id !== a.id))}
                    disabled={guardando}
                    aria-label={`Quitar ${a.name} de la lista`}
                    title="Quitar de la lista"
                    className="h-7 w-7 shrink-0 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={elegidos.length === 0 || guardando}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {guardando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
