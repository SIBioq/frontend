"use client"

import type React from "react"
import { useState } from "react"
import { Loader2, Save, AlertTriangle, ShieldCheck, History, CheckCircle2, Circle, PencilLine, Sigma, Trash2, CircleMinus, RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  formatEvaluatedReference,
  formatNamedReferenceRanges,
  formatReferenceRange,
  formatReferenceValues,
  getReferenceEvaluationLabel,
} from "@/lib/catalog-format"
import { LAB_TIME_ZONE } from "@/lib/format-utils"
import { cn } from "@/lib/utils"
import { expandirNumero, unidadCompleta } from "@/lib/notacion"
import type { PreviousResult, Result } from "@/types"
import type { ResultValue } from "@/hooks/use-protocol-results"

interface ResultDeterminationRowProps {
  result: Result
  value: ResultValue
  saving: boolean
  readOnly: boolean
  /** Motivo por el que la fila no se puede editar (falta de permiso). Se muestra como tooltip. */
  lockedReason?: string
  isFormula: boolean
  formulaResolved: boolean
  /** La fórmula quedó de lado: el valor se carga a mano. */
  cargaManual: boolean
  /** Enciende/apaga la carga a mano. `undefined` = no se puede (sin permiso,
   *  protocolo cancelado o resultado ya validado). */
  onToggleCargaManual?: () => void
  /**
   * Deja la determinación fuera de este protocolo, o la vuelve
   * a incluir. `undefined` = no se puede (sin permiso, protocolo cancelado o
   * resultado ya validado).
   */
  onToggleExclusion?: (excluido: boolean) => void
  /** Borra el valor cargado, en pantalla y en la base. */
  onBorrarValor?: () => void
  onChange: (field: "value" | "notes", value: string) => void
  onSave: () => void
  onLoadPrevious: () => void
  registerInput: (el: HTMLInputElement | null) => void
  registerTextarea: (el: HTMLTextAreaElement | null) => void
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onTextareaKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  previous: PreviousResult[]
  loadingPrevious: boolean
}

function fmtDateTime(v?: string | null) {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-AR", { timeZone: LAB_TIME_ZONE, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}
function fmtDate(v?: string | null) {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ResultDeterminationRow({
  result,
  value,
  saving,
  readOnly,
  lockedReason,
  isFormula,
  formulaResolved,
  cargaManual,
  onToggleCargaManual,
  onToggleExclusion,
  onBorrarValor,
  onChange,
  onSave,
  onLoadPrevious,
  registerInput,
  registerTextarea,
  onInputKeyDown,
  onTextareaKeyDown,
  previous,
  loadingPrevious,
}: ResultDeterminationRowProps) {
  const [focused, setFocused] = useState(false)
  const det = result.determination
  // La unidad CON la notación: el input recibe el número corto (`4,5`), así
  // que si acá dijera solo `/µL` la bioquímica no sabría en qué escala
  // está escribiendo. El informe es el que muestra el número completo.
  const unit = unidadCompleta(det.measure_unit, det.scientific_exponent)
  const hasValue = !!result.value
  const isValidated = result.is_valid
  const isWrong = result.is_wrong
  // Fuera del protocolo: la fila se sigue viendo con su valor,
  // pero no se escribe y no interviene en nada. No se borró nada.
  const excluido = !!result.excluido
  const locked = isValidated && !isWrong
  // Sin permiso el input queda readOnly (no disabled) a propósito: así se puede
  // enfocar y seguir consultando los valores anteriores del paciente.
  const noWritePermission = Boolean(lockedReason)
  const cannotSave = locked || noWritePermission

  // Lo que va a decir el informe. El valor se guarda como se escribe: quien
  // multiplica es el backend, al armar el informe. Esto está acá porque el
  // número que se carga y el que lee el paciente son distintos, y eso conviene
  // verlo antes de guardar y no en el papel.
  const enElInforme = expandirNumero(value.value, det.scientific_exponent)

  // Primero los rangos del paciente —los que se evalúan— y después los
  // rangos con nombre, que sólo informan. Ver `NamedReferenceRange`.
  const referenceItems = [
    ...(det.reference_ranges?.length
      ? det.reference_ranges.map(formatReferenceRange)
      : formatReferenceValues(det.reference_values)),
    ...formatNamedReferenceRanges(det.named_ranges),
  ]
  const evaluation = result.reference_range_evaluation
  const isOutOfRange = result.is_out_of_reference_range || evaluation?.is_out_of_reference_range
  const evaluatedReference = formatEvaluatedReference(evaluation)

  return (
    <div
      data-result-row
      className={cn(
        "rounded-lg border p-3 transition-colors",
        // La exclusión manda sobre el resto de los estados: lo que importa de
        // esta fila es que no cuenta, no si el valor está cargado o validado.
        // Naranja y con borde izquierdo grueso para que no pase desapercibida
        // al recorrer el protocolo; no es rojo porque no es un error.
        excluido ? "border-orange-300 border-l-4 border-l-orange-500 bg-orange-50" : isWrong ? "border-red-300 bg-red-50" : isValidated ? "border-emerald-200 bg-emerald-50/40" : hasValue ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white",
      )}
    >
      {/* Línea superior: nombre + estado (con fecha de validación) */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold text-gray-900">{det.name}</span>
          {unit && <span className="ml-1 text-xs text-gray-500">({unit})</span>}
          {excluido && (
            <Badge className="ml-2 gap-1 border-transparent bg-orange-500 align-middle text-[10px] text-white hover:bg-orange-500">
              <CircleMinus className="h-3 w-3" />
              Fuera del protocolo
            </Badge>
          )}
          {isFormula && (
            <Badge
              variant="outline"
              className={cn(
                "ml-2 text-[10px]",
                cargaManual
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : formulaResolved
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              {cargaManual ? "A mano" : formulaResolved ? "Auto" : "Fórmula pendiente"}
            </Badge>
          )}
          {result.is_sent && (
            <Badge variant="outline" className="ml-2 border-sky-200 bg-sky-50 text-[10px] text-sky-700">
              Enviado
            </Badge>
          )}
        </div>
        {isValidated ? (
          <div className="flex shrink-0 flex-col items-end text-right">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Validado
            </span>
            {result.validated_at && (
              <span className="text-[10px] text-emerald-600">
                {fmtDateTime(result.validated_at)}
                {result.validated_by && ` · ${result.validated_by.first_name} ${result.validated_by.last_name}`}
              </span>
            )}
          </div>
        ) : hasValue ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Cargado
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <Circle className="h-3.5 w-3.5" />
            Sin cargar
          </span>
        )}
      </div>

      {/* Cuerpo: valor + referencia + historial + notas + guardar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        <div className="lg:w-48">
          <Input
            ref={registerInput}
            placeholder="Valor"
            value={value.value}
            onChange={(e) => onChange("value", e.target.value)}
            onKeyDown={onInputKeyDown}
            onFocus={() => {
              setFocused(true)
              onLoadPrevious()
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            readOnly={readOnly}
            // Excluida no se escribe, pero el valor sigue a la vista: es el dato
            // que se conserva, y esconderlo diría lo contrario.
            disabled={locked || excluido}
            className={cn("h-11 text-base font-semibold", hasValue && !isValidated && "border-blue-300", isValidated && "border-emerald-300 bg-emerald-100", excluido && "border-orange-200 bg-orange-100/60 text-orange-900/70")}
          />
          {enElInforme && (
            <p className="mt-1 text-[11px] tabular-nums text-gray-500">
              En el informe: <span className="font-medium text-gray-700">{enElInforme}</span>{" "}
              {det.measure_unit}
            </p>
          )}
          {/* Al enfocar el input se despliega el historial del paciente */}
          {focused && (
            <div className="mt-1.5 rounded-md border border-gray-100 bg-gray-50/70 p-1.5">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                <History className="h-3 w-3" /> Valores anteriores
              </p>
              {loadingPrevious ? (
                <p className="text-[11px] text-gray-400">Buscando…</p>
              ) : previous.length === 0 ? (
                <p className="text-[11px] text-gray-400">Sin resultados anteriores</p>
              ) : (
                <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                  {previous.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-gray-800">{p.value || "—"}</span>
                      <span className="text-[10px] text-gray-400">{fmtDate(p.validated_at || p.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* LA SALIDA CUANDO LA FÓRMULA ESTÁ MAL.
              Una determinación calculada trae el valor sola y con el campo
              bloqueado. Si la fórmula quedó mal cargada, eso trababa la fila
              entera: no se podía escribir ni borrar, y el protocolo no cerraba.
              El botón deja de lado el cálculo para ESTE protocolo; arreglar la
              fórmula para todos es en Configuración. Va debajo del valor,
              separado, para que no se confunda con el resto de los badges. */}
          {isFormula && onToggleCargaManual && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onToggleCargaManual}
                aria-pressed={cargaManual}
                aria-label={
                  cargaManual
                    ? `Volver a calcular ${det.name} con la fórmula`
                    : `Cargar ${det.name} a mano`
                }
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                title={
                  cargaManual
                    ? "Vuelve a calcular el valor con la fórmula"
                    : "Deja de lado la fórmula y permite escribir el valor a mano"
                }
              >
                {cargaManual ? <Sigma className="h-3 w-3" /> : <PencilLine className="h-3 w-3" />}
                {cargaManual ? "Volver a la fórmula" : "Cargar a mano"}
              </button>
            </div>
          )}
        </div>

        <div className="lg:w-52">
          {referenceItems.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {referenceItems.map((item) => (
                <Badge key={item} variant="outline" className="bg-slate-50 text-[10px] text-slate-600">
                  {item}
                </Badge>
              ))}
            </div>
          )}
          {evaluation && evaluation.status !== "not_evaluated" && (
            <div className="mt-1">
              <Badge variant="outline" className={cn("text-[10px]", isOutOfRange ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                {isOutOfRange && <AlertTriangle className="mr-1 h-3 w-3" />}
                {getReferenceEvaluationLabel(evaluation)}
              </Badge>
              {evaluatedReference && <p className="mt-0.5 text-[10px] text-gray-500">{evaluatedReference}</p>}
            </div>
          )}
        </div>

        <Textarea
          ref={registerTextarea}
          placeholder="Notas (opcional)"
          value={value.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          onKeyDown={onTextareaKeyDown}
          disabled={cannotSave || excluido}
          rows={2}
          title={lockedReason}
          className="min-h-0 flex-1 resize-none text-sm"
        />
        {/* Borrar el valor. Solo en las de fórmula y solo cuando el campo se
            puede escribir: en una fila en modo automático no tiene sentido,
            porque el cálculo lo vuelve a poner enseguida. */}
        {isFormula && onBorrarValor && !readOnly && !cannotSave && !excluido && !!value.value && (
          <Button
            size="sm"
            variant="outline"
            onClick={onBorrarValor}
            disabled={saving}
            title="Borrar el valor cargado"
            className="h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {/* El title va en el span: un botón deshabilitado no dispara eventos de
            mouse, así que su propio tooltip nativo no se muestra. */}
        {!excluido && (
          <span title={lockedReason} className="inline-flex">
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || cannotSave}
              className="h-11 bg-[#204983] hover:bg-[#1a3d6f]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </span>
        )}
      </div>

      {/* DEJAR FUERA DEL PROTOCOLO: LA DETERMINACIÓN NO APLICA ACÁ.
          Sale del estado, del informe y del envío, pero no se borra nada y se
          puede volver a incluir. Va abajo a la derecha, lejos del valor: es una
          decisión sobre la fila entera, no una edición del dato, y no conviene
          que quede al alcance de un click apurado mientras se carga. */}
      {(excluido || onToggleExclusion) && (
        <div className="mt-2 flex items-end justify-between gap-3">
          {/* Qué significa la fila naranja, dicho donde se la está mirando. */}
          <p className="min-w-0 text-[11px] text-orange-800">
            {excluido &&
              "Fuera del protocolo: no cuenta para el estado del protocolo, el informe ni el envío. El dato cargado se conserva y podés volver a incluirla cuando quieras."}
          </p>
          {onToggleExclusion && (
            <button
              type="button"
              onClick={() => onToggleExclusion(!excluido)}
              aria-pressed={excluido}
              aria-label={
                excluido
                  ? `Volver a incluir ${det.name} en este protocolo`
                  : `Dejar ${det.name} fuera de este protocolo`
              }
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                excluido
                  ? "border-orange-300 bg-white text-orange-700 hover:border-orange-500 hover:bg-orange-100"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
              )}
              title={
                excluido
                  ? "Vuelve a contar para el estado del protocolo y el informe"
                  : "La determinación no aplica en este protocolo: el dato se conserva pero deja de contar"
              }
            >
              {excluido ? <RotateCcw className="h-3.5 w-3.5" /> : <CircleMinus className="h-3.5 w-3.5" />}
              {excluido ? "Volver a incluir" : "Dejar fuera del protocolo"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
