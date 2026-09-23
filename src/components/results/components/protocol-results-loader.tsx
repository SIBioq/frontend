"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlaskConical, AlertCircle, ChevronDown, Keyboard, Search, Sigma, X, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/contexts/auth-context"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import type { useProtocolResults } from "@/hooks/use-protocol-results"
import { teclaDelEvento, useMacrosDeResultado } from "@/hooks/use-macros-de-resultado"
import { calculateFormulaValue, describirFormula } from "@/lib/result-formulas"
import type { Result } from "@/types"
import { ResultDeterminationRow } from "./result-determination-row"
import { ExclusionConfirmDialog } from "./exclusion-confirm-dialog"
import { ResumenDeResultados } from "@/components/common/resumen-de-resultados"
import { cn } from "@/lib/utils"
import { ENTRADA_ABAJO } from "@/lib/entrada"

interface ProtocolResultsLoaderProps {
  controller: ReturnType<typeof useProtocolResults>
}

/**
 * Carga de resultados de un protocolo (presentacional): búsqueda de análisis,
 * agrupación y navegación por teclado (Enter guarda y baja; ↑↓ mueven; → notas;
 * Alt + tecla escribe una macro). Los datos llegan por `controller` (hook
 * useProtocolResults en la página).
 */
export function ProtocolResultsLoader({ controller }: ProtocolResultsLoaderProps) {
  const { loading, error, protocol, results, groups, submodulos, orderedIds, values, saving, onChange, onSave, alternarCargaManual, alternarExclusion, borrarValor, previousResults, loadingPrevious, loadPrevious } =
    controller
  const { hasPermission } = useAuth()
  // Sin `gestionar_resultados` la pantalla no desaparece: se sigue viendo todo
  // igual que antes, pero en solo lectura y con el aviso de por qué.
  const canEdit = hasPermission(PERMISSIONS.MANAGE_RESULTS.codename)
  const patientId = protocol?.patient?.id ?? 0
  // Protocolo cancelado: se muestra la info pero en SOLO LECTURA (hay que
  // descancelarlo para editar). El backend además bloquea la escritura.
  const isCancelled = (protocol?.status?.name || "").trim().toLowerCase() === "cancelado"

  // Los atajos `Alt + tecla` que escriben un cualitativo entero. Se configuran
  // en Configuración y son del laboratorio: lo que se busca es que el informe
  // diga siempre lo mismo, y para eso las tiene que tener todo el mundo.
  const { macros, porTecla } = useMacrosDeResultado()

  const [search, setSearch] = useState("")
  // Análisis colapsables: colapsados si ya tienen todos los resultados
  // cargados, expandidos si falta cargar alguno. Acá el criterio SÍ es tener
  // valor, porque el trabajo de esta pantalla es cargarlo. En validación el
  // criterio es otro (estar validado), que es el trabajo de aquella.
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())
  const [collapseInit, setCollapseInit] = useState(false)
  useEffect(() => {
    if (collapseInit || groups.length === 0) return
    const collapsed = new Set<number>()
    groups.forEach((g) => {
      // Una excluida no puede dejar el grupo abierto para siempre: no hay nada
      // que cargar ahí. El `length > 0` se mide sobre el grupo COMPLETO, así un
      // análisis con todas las determinaciones excluidas colapsa igual.
      const allLoaded =
        g.determinations.length > 0 && g.determinations.every((d) => d.excluido || !!d.value)
      if (allLoaded) collapsed.add(g.analysis.id)
    })
    setCollapsedIds(collapsed)
    setCollapseInit(true)
  }, [groups, collapseInit])
  const toggleCollapse = (id: number) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  // LA FILA QUE QUEDÓ ESPERANDO UN "SÍ".
  // Marcar una fila vacía no pregunta nada. Si ya tiene datos, el backend
  // contesta 409 sin tocar nada y recién entonces se pregunta: un solo diálogo
  // para toda la pantalla, con la fila que lo abrió.
  const [pendienteDeConfirmar, setPendienteDeConfirmar] = useState<Result | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const alternarExclusionDeFila = async (result: Result, excluido: boolean) => {
    const resultado = await alternarExclusion(result.id, excluido)
    if (!resultado.ok && resultado.requiereConfirmacion) setPendienteDeConfirmar(result)
  }

  const confirmarExclusion = async () => {
    if (!pendienteDeConfirmar) return
    setConfirmando(true)
    await alternarExclusion(pendienteDeConfirmar.id, true, true)
    setConfirmando(false)
    // Se cierra en los dos casos: si falló, el aviso ya lo dijo y dejar el
    // diálogo abierto invita a volver a apretar lo mismo.
    setPendienteDeConfirmar(null)
  }

  const focusInput = (id?: number) => {
    if (id == null) return
    const el = inputRefs.current[id]
    if (el && !el.disabled) {
      // preventScroll: hacemos el desplazamiento nosotros, centrando la fila
      // para que el siguiente resultado quede completamente visible.
      el.focus({ preventScroll: true })
      el.select()
      const row = (el.closest("[data-result-row]") as HTMLElement | null) ?? el
      row.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  const onInputKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>, resultId: number, bloqueada: boolean) => {
      const i = orderedIds.indexOf(resultId)

      // ALT + TECLA: LA MACRO ESCRIBE, NO GUARDA
      //
      // Escribe el texto y deja el cursor donde está. Guardar de una sería un
      // atajo que graba un resultado con una sola tecla, sin que se llegue a
      // leer lo que quedó escrito — y para eso ya está Enter, que además baja
      // a la siguiente. La macro reemplaza el tipeo, no la decisión.
      //
      // Se chequea antes que todo lo demás porque Alt + una flecha no tiene
      // por qué mover: quien apretó Alt está pidiendo una macro.
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const tecla = teclaDelEvento(e.code)
        const macro = tecla ? porTecla.get(tecla) : undefined
        if (macro) {
          // También en una fila bloqueada, donde no se escribe nada: en macOS
          // `Alt + n` mete un "˜" en el input, que es peor que no hacer nada.
          //
          // Y SOLO cuando hay macro: sin esto, Alt + flecha izquierda dejaría
          // de volver atrás en el navegador porque acá se lo tragó una tecla
          // que no hace nada.
          e.preventDefault()
          if (!bloqueada) onChange(resultId, "value", macro.texto)
        }
        return
      }

      if (e.key === "Enter") {
        e.preventDefault()
        // Sin permiso, Enter sigue sirviendo para recorrer la lista pero no
        // dispara el guardado (que igual rebotaría con 403).
        if (canEdit) await onSave(resultId)
        focusInput(orderedIds[i + 1])
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        focusInput(orderedIds[i + 1])
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        focusInput(orderedIds[i - 1])
      } else if (e.key === "ArrowRight") {
        const ta = textareaRefs.current[resultId]
        if (ta && !ta.disabled) {
          e.preventDefault()
          ta.focus()
        }
      }
    },
    [orderedIds, onSave, onChange, canEdit, porTecla],
  )

  const onTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, resultId: number) => {
    if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      focusInput(resultId)
    }
  }, [])

  // Filtro por nombre de análisis o de determinación.
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => {
        if (g.analysis.name.toLowerCase().includes(q)) return g
        const dets = g.determinations.filter((d) => d.determination.name.toLowerCase().includes(q))
        return dets.length ? { ...g, determinations: dets } : null
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [groups, search])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <AlertCircle className="h-5 w-5" />
        {error}
      </div>
    )
  }

  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Este protocolo no tiene determinaciones para cargar.</p>
  }

  // Entra cuando entran los resultados, no cuando se abre la pantalla:
  // hasta acá lo que había era el esqueleto.
  return (
    <div className={cn(ENTRADA_ABAJO, "space-y-4")}>
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <span>
            <span className="font-semibold">Solo lectura.</span> {PERMISSION_MESSAGES.MANAGE_RESULTS} Podés seguir
            consultando los resultados cargados.
          </span>
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Protocolo cancelado: se muestra en solo lectura. Descancelalo para poder editar los resultados.
        </div>
      )}
      {/* Búsqueda de análisis */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar análisis o determinación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10 pr-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* LAS MACROS SE MUESTRAN, NO SE ADIVINAN.
          Un atajo de teclado que no está escrito en ninguna parte lo usa quien
          lo configuró y nadie más. Va acá arriba, donde se lo lee una vez y se
          lo recuerda, y no en un tooltip que hay que salir a buscar. */}
      {canEdit && macros.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 font-medium text-gray-600">
            <Keyboard className="h-3.5 w-3.5" />
            Atajos
          </span>
          {macros.map((macro) => (
            <span key={macro.id} className="flex items-center gap-1">
              <kbd className="rounded border border-gray-300 bg-white px-1 font-sans text-[10px] font-medium text-gray-600">
                Alt+{macro.tecla}
              </kbd>
              <span className="truncate text-gray-500">{macro.texto}</span>
            </span>
          ))}
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Ningún análisis coincide con “{search}”.</p>
      ) : (
        filteredGroups.map((group) => {
          // El progreso cuenta lo que hay para cargar: las excluidas no son
          // trabajo pendiente ni trabajo hecho, así que salen del denominador y
          // se muestran aparte.
          const activas = group.determinations.filter((d) => !d.excluido)
          const loaded = activas.filter((d) => !!d.value).length
          const excluidas = group.determinations.length - activas.length
          return (
            <section key={group.analysis.id}>
              <button
                type="button"
                onClick={() => toggleCollapse(group.analysis.id)}
                className="mb-2 flex w-full items-center justify-between gap-2 text-left"
              >
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${collapsedIds.has(group.analysis.id) ? "-rotate-90" : ""}`}
                  />
                  <FlaskConical className="h-4 w-4 text-[#204983]" />
                  {group.analysis.name}
                </h3>
                <span className="flex min-w-0 items-center gap-3">
                  {collapsedIds.has(group.analysis.id) ? (
                    <ResumenDeResultados determinaciones={group.determinations} />
                  ) : null}
                  <Badge variant="outline" className="shrink-0 text-xs text-gray-500">
                    {loaded}/{activas.length} cargados
                  </Badge>
                  {excluidas > 0 && (
                    <span className="shrink-0 text-xs font-medium text-orange-600">
                      · {excluidas} fuera del protocolo
                    </span>
                  )}
                </span>
              </button>
              {!collapsedIds.has(group.analysis.id) && (
              <div className="space-y-2">
                {group.determinations.map((result) => {
                  const calc = calculateFormulaValue(result, results, values)
                  const isFormula = !!result.determination.formula?.trim()
                  const formulaExplicacion = isFormula ? describirFormula(result, results, values) : null
                  const formulaResolved = !!calc && calc.missingCodes.length === 0
                  const cargaManual = !!result.carga_manual
                  const excluido = !!result.excluido
                  // En modo manual el campo se escribe aunque la fórmula
                  // resuelva: es justo el caso en que resuelve mal.
                  const bloqueada = (formulaResolved && !cargaManual) || isCancelled || !canEdit || excluido
                  // Ya validado no se toca desde acá: se invalida primero.
                  const puedeCambiarModo =
                    !isCancelled && canEdit && !(result.is_valid && !result.is_wrong)
                  // Una fila ya excluida siempre se puede volver a incluir: si
                  // no, quedaría afuera para siempre sin forma de revertirlo.
                  const puedeExcluir = puedeCambiarModo || (!isCancelled && canEdit && excluido)
                  return (
                    <ResultDeterminationRow
                      key={result.id}
                      result={result}
                      value={values[result.id] || { value: "", notes: "" }}
                      saving={!!saving[result.id]}
                      readOnly={bloqueada}
                      lockedReason={!canEdit ? PERMISSION_MESSAGES.MANAGE_RESULTS : undefined}
                      isFormula={isFormula}
                      formulaResolved={formulaResolved}
                      cargaManual={cargaManual}
                      formulaExplicacion={formulaExplicacion}
                      onToggleCargaManual={
                        puedeCambiarModo ? () => void alternarCargaManual(result.id, !cargaManual) : undefined
                      }
                      onToggleExclusion={
                        puedeExcluir
                          ? (siguiente) => void alternarExclusionDeFila(result, siguiente)
                          : undefined
                      }
                      onBorrarValor={puedeCambiarModo ? () => void borrarValor(result.id) : undefined}
                      onChange={(field, val) => onChange(result.id, field, val)}
                      onSave={() => onSave(result.id)}
                      onLoadPrevious={() => loadPrevious(result.id, patientId, result.determination.id)}
                      registerInput={(el) => {
                        inputRefs.current[result.id] = el
                      }}
                      registerTextarea={(el) => {
                        textareaRefs.current[result.id] = el
                      }}
                      onInputKeyDown={(e) => onInputKeyDown(e, result.id, bloqueada)}
                      onTextareaKeyDown={(e) => onTextareaKeyDown(e, result.id)}
                      previous={previousResults[result.id] || []}
                      loadingPrevious={loadingPrevious.has(result.id)}
                    />
                  )
                })}

                {/* LA SUMA QUE TIENE QUE CERRAR.
                    Acá es un aviso, no un freno: a mitad de carga nunca da. El
                    que frena es el botón de validar, que es cuando alguien
                    firma que el resultado está bien. */}
                {submodulos
                  .filter((s) => s.analysis === group.analysis.id)
                  .map((s) => (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-sm ${
                        !s.completo
                          ? "border-gray-200 bg-gray-50 text-gray-500"
                          : s.cierra
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-rose-300 bg-rose-50 text-rose-800"
                      }`}
                    >
                      <Sigma className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{s.nombre}:</span>
                      <span className="tabular-nums">
                        {s.suma.toLocaleString("es-AR", { maximumFractionDigits: 4 })}
                      </span>
                      <span className="text-xs">
                        de {s.esperado.toLocaleString("es-AR", { maximumFractionDigits: 4 })}
                        {s.tolerancia > 0 ? ` ± ${s.tolerancia}` : ""}
                      </span>
                      {!s.completo ? (
                        <span className="text-xs">
                          — falta cargar {s.faltantes.filter(Boolean).join(", ")}
                        </span>
                      ) : s.cierra ? (
                        <span className="text-xs font-medium">— cierra</span>
                      ) : (
                        <span className="text-xs font-medium">
                          — {s.suma > s.esperado
                            ? `se pasa por ${(s.suma - s.esperado).toLocaleString("es-AR", { maximumFractionDigits: 4 })}`
                            : `faltan ${(s.esperado - s.suma).toLocaleString("es-AR", { maximumFractionDigits: 4 })}`}
                          . No se va a poder validar así.
                        </span>
                      )}
                    </div>
                  ))}
              </div>
              )}
            </section>
          )
        })
      )}

      {/* UNO PARA TODA LA PANTALLA. Es el mismo diálogo para cualquier fila: lo
          que cambia es el nombre. Uno por fila serían decenas de nodos
          montados para que se use, como mucho, uno. */}
      <ExclusionConfirmDialog
        open={pendienteDeConfirmar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPendienteDeConfirmar(null)
        }}
        nombreDeterminacion={pendienteDeConfirmar?.determination.name ?? ""}
        onConfirmar={confirmarExclusion}
        confirmando={confirmando}
      />
    </div>
  )
}
