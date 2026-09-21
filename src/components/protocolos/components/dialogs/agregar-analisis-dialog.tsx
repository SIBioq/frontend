"use client"

import { useMemo, useState } from "react"
import { Loader2, Minus, Plus } from "lucide-react"

import { AnalysisSearch } from "@/components/ingreso/components/analysis-search"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"
import { useProtocolQuote } from "@/hooks/use-protocol-quote"
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
  insuranceId: number | null
  /**
   * Los que el protocolo ya tiene: id del ANÁLISIS y su código.
   *
   * El id del análisis y no el del detalle — son cosas distintas y el buscador
   * deduplica por análisis. El código lo usa el buscador para dejar los actos
   * bioquímicos arriba de la lista.
   */
  yaEstan: { id: number; code: string }[]
  /** Devuelve los ids que el servidor no pudo agregar para conservarlos en la revisión. */
  onAgregar: (analysisIds: number[]) => Promise<number[]>
}

const formatNumber = (value: string | null | undefined) =>
  Number.parseFloat(value ?? "0").toLocaleString("es-AR", { maximumFractionDigits: 2 })

const ubLabel = (value: string | null | undefined, source: string) => {
  const quantity = Number.parseFloat(value ?? "")
  return Number.isFinite(quantity) && quantity > 0
    ? `${formatNumber(value)} UB ${source}`
    : "UB no disponible"
}

const formatMoney = (value: string | null | undefined) =>
  `$${Number.parseFloat(value ?? "0").toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AgregarAnalisisDialog({ open, onOpenChange, insuranceId, yaEstan, onAgregar }: Props) {
  const [elegidos, setElegidos] = useState<SelectedAnalysis[]>([])
  const [guardando, setGuardando] = useState(false)
  const { habilitados: preciosFijosHabilitados } = usePreciosFijos()
  const quoteInput = useMemo(
    () => (open ? elegidos.map((a) => ({ analysis_id: a.id, is_authorized: false })) : []),
    [elegidos, open],
  )
  const { quote, loading: cotizando, error: errorDeCotizacion } = useProtocolQuote(insuranceId, quoteInput)
  const cotizacionPorId = new Map(quote?.details.map((item) => [item.analysis_id, item]))

  const cerrar = (abierto: boolean) => {
    if (!abierto) setElegidos([])
    onOpenChange(abierto)
  }

  const confirmar = async () => {
    if (elegidos.length === 0) return
    setGuardando(true)
    try {
      const noAgregados = await onAgregar(elegidos.map((a) => a.id))
      if (noAgregados.length === 0) {
        setElegidos([])
        onOpenChange(false)
      } else {
        setElegidos((actuales) => actuales.filter((a) => noAgregados.includes(a.id)))
      }
    } catch {
      // El contenedor informa el error; el diálogo conserva la selección.
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
            Se agregan al final como particulares. Podés cambiar la cobertura
            después; el importe y el saldo definitivos se actualizan al guardar.
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
          <section className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Para agregar</h3>
              <span className="text-xs tabular-nums text-slate-500">{elegidos.length} análisis</span>
            </div>
            {/* CADA UNO SE PUEDE SACAR DE ACÁ
                ==============================
                Agregar el análisis equivocado es de las cosas más fáciles de
                hacer en esta pantalla: se busca por código y un dígito de más
                trae otra práctica. Sin esto había que cancelar el diálogo
                entero y volver a cargar los que sí estaban bien. */}
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {elegidos.map((a) => {
                const precio = cotizacionPorId.get(a.id)
                const precioFijo = precio?.precio_fijo != null || (preciosFijosHabilitados && a.cobra_precio_fijo)
                return <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[13px] font-medium text-slate-600">{a.code}</span>
                      <span className="min-w-0 break-words text-sm font-semibold text-slate-800">{a.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                      {precioFijo && precio && !cotizando ? (
                        <span className="font-medium tabular-nums text-slate-800">
                          Precio fijo particular estimado {formatMoney(precio.patient_amount)}
                        </span>
                      ) : (
                        <>
                          <span>
                            {precioFijo
                              ? `Precio fijo de catálogo${a.precio_particular ? ` ${formatMoney(a.precio_particular)}` : ""}`
                              : precio?.private_ub ? ubLabel(precio.private_ub, "aplicadas") : ubLabel(a.bio_unit, "de catálogo")}
                          </span>
                          {cotizando ? (
                            <span className="text-slate-400">Calculando importe…</span>
                          ) : precio ? (
                            <span className="font-medium tabular-nums text-slate-800">Particular estimado {formatMoney(precio.patient_amount)}</span>
                          ) : errorDeCotizacion ? (
                            <span className="text-amber-700">No se pudo estimar</span>
                          ) : (
                            <span className="text-slate-400">Cotización pendiente</span>
                          )}
                        </>
                      )}
                      {precio && Number.parseFloat(precio.descuento ?? "0") > 0 && (
                        <span className="text-emerald-700">Descuento incluido</span>
                      )}
                    </div>
                    {(a.is_urgent || a.is_obsolete || a.requires_derivacion) && (
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-medium">
                        {a.is_urgent && <span className="text-rose-700">Urgente</span>}
                        {a.is_obsolete && <span className="text-amber-700">En desuso</span>}
                        {a.requires_derivacion && <span className="text-slate-600">Requiere derivación</span>}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setElegidos((previos) => previos.filter((e) => e.id !== a.id))}
                    disabled={guardando}
                    aria-label={`Quitar ${a.name} de la lista`}
                    title="Quitar de la lista"
                    className="h-7 w-7 shrink-0 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </li>
              })}
            </ul>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500">
              {errorDeCotizacion
                ? "No se pudo cotizar: el servidor podría omitir un análisis al guardar. Revisá el resultado del agregado."
                : "Los importes son estimaciones por análisis con precios actuales; no representan el nuevo total ni el saldo del protocolo."}
            </p>
          </section>
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
