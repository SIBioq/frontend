"use client"

import { useEffect, useMemo, useState } from "react"
import { FlaskConical, AlertCircle, ChevronDown, Search, X, CheckCheck, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { useProtocolResults } from "@/hooks/use-protocol-results"
import { toast } from "sonner"
import { ValidationResultRow } from "./validation-result-row"
import { ResumenDeResultados } from "@/components/common/resumen-de-resultados"
import { cn } from "@/lib/utils"
import { ENTRADA_ABAJO } from "@/lib/entrada"

interface ProtocolValidationLoaderProps {
  controller: ReturnType<typeof useProtocolResults>
}

/** Validación de un protocolo (presentacional): agrupa por análisis, con
 * "Validar todos" y búsqueda. Los datos vienen por `controller`. */
export function ProtocolValidationLoader({ controller }: ProtocolValidationLoaderProps) {
  const { loading, error, protocol, results, groups, saving, onValidate, onValidateMany, previousResults, loadingPrevious, loadPrevious } = controller
  const patientId = protocol?.patient?.id ?? 0
  // Protocolo cancelado: solo lectura (hay que descancelarlo para validar).
  const isCancelled = (protocol?.status?.name || "").trim().toLowerCase() === "cancelado"
  const [search, setSearch] = useState("")
  const [validatingAll, setValidatingAll] = useState(false)
  // Análisis colapsables. Acá se colapsa lo que ya está VALIDADO, no lo que
  // tiene valor cargado: en esta pantalla el trabajo es validar, y un análisis
  // con resultado sin validar es justamente el que hay que mirar. Colapsarlo
  // escondía la fila que se vino a atender.
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())
  const [collapseInit, setCollapseInit] = useState(false)
  useEffect(() => {
    if (collapseInit || groups.length === 0) return
    const collapsed = new Set<number>()
    groups.forEach((g) => {
      // Una excluida no se valida nunca, así que cuenta como atendida: si no,
      // dejaría el análisis abierto para siempre. El `length > 0` se mide sobre
      // el grupo completo, así uno con todas excluidas colapsa igual.
      const todoValidado =
        g.determinations.length > 0 && g.determinations.every((d) => d.excluido || d.is_valid)
      if (todoValidado) collapsed.add(g.analysis.id)
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

  // Las excluidas no entran: el backend rechaza validar una fila que no
  // corresponde, así que "Validar todos" se comería un error por cada una.
  const pendingWithValue = results.filter((r) => !!r.value && !r.is_valid && !r.excluido)

  /**
   * Manda los pendientes en UNA request.
   *
   * Antes iba de a uno y esperando la respuesta de cada uno: treinta
   * determinaciones eran treinta idas y vueltas y treinta avisos apilados.
   *
   * El backend firma todos los que puede y devuelve los que no —una fórmula
   * que no cierra, un valor vacío—, así que un error no frena a los demás. El
   * aviso dice cuántos entraron y cuántos quedaron, con el motivo del primero:
   * la fila queda marcada en pantalla para ir a mirarla.
   */
  const validateAll = async () => {
    setValidatingAll(true)
    const total = pendingWithValue.length
    const errores = await onValidateMany(pendingWithValue.map((r) => r.id), true)
    setValidatingAll(false)

    const firmados = total - errores.length
    if (errores.length === 0) {
      toast.success(firmados === 1 ? "1 resultado validado" : `${firmados} resultados validados`)
    } else if (firmados === 0) {
      toast.error(`No se validó ninguno: ${errores[0].detail}`)
    } else {
      toast.warning(
        `${firmados} de ${total} validados. ${errores.length} quedaron sin validar: ${errores[0].detail}`,
      )
    }
  }

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
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
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
    return <p className="py-8 text-center text-sm text-gray-400">Este protocolo no tiene resultados para validar.</p>
  }

  // Entra cuando entran los resultados, no cuando se abre la pantalla:
  // hasta acá lo que había era el esqueleto.
  return (
    <div className={cn(ENTRADA_ABAJO, "space-y-4")}>
      {isCancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Protocolo cancelado: se muestra en solo lectura. Descancelalo para poder validar.
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Buscar análisis o determinación..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-10 pr-9" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={validateAll}
          disabled={validatingAll || pendingWithValue.length === 0 || isCancelled}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {validatingAll ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
          Validar todos ({pendingWithValue.length})
        </Button>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Ningún análisis coincide con “{search}”.</p>
      ) : (
        filteredGroups.map((group) => {
          // Mismo criterio que en la carga: las excluidas no son trabajo, así
          // que salen del total.
          const activas = group.determinations.filter((d) => !d.excluido)
          const validated = activas.filter((d) => d.is_valid).length
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
                    {validated}/{activas.length} validados
                  </Badge>
                  {excluidas > 0 && (
                    <span className="shrink-0 text-xs text-gray-400">
                      · {excluidas} {excluidas === 1 ? "no corresponde" : "no corresponden"}
                    </span>
                  )}
                </span>
              </button>
              {!collapsedIds.has(group.analysis.id) && (
              <div className="space-y-2">
                {group.determinations.map((result) => (
                  <ValidationResultRow
                    key={result.id}
                    result={result}
                    saving={!!saving[result.id]}
                    disabled={isCancelled}
                    onValidate={(isValid) => onValidate(result.id, isValid)}
                    onLoadPrevious={() => loadPrevious(result.id, patientId, result.determination.id)}
                    previous={previousResults[result.id] || []}
                    loadingPrevious={loadingPrevious.has(result.id)}
                  />
                ))}
              </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
