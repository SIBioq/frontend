"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { useAuth } from "@/contexts/auth-context"
import { RESULTS_ENDPOINTS } from "@/config/api"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import { applyFormulaCalculations, formulasParaGuardar } from "@/lib/result-formulas"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type { PreviousResult, Result, SubmoduloEvaluado } from "@/types"

export interface ResultValue {
  value: string
  notes: string
}

export interface ResultGroup {
  analysis: Result["analysis"]
  determinations: Result[]
}

/**
 * Lo que devuelve `alternarExclusion`.
 *
 * `requiereConfirmacion` es el 409 del backend: la fila ya tiene datos y hay
 * que preguntar antes. No es un error —nada cambió en el servidor—, así que la
 * pantalla lo usa para abrir el diálogo y no para mostrar una falla.
 */
export type ResultadoExclusion =
  | { ok: true }
  | { ok: false; requiereConfirmacion: true }
  | { ok: false; requiereConfirmacion?: false }

export interface ResultsProtocolHeader {
  id: number
  patient: { id: number; dni?: string; first_name: string; last_name: string; age?: number | null; is_anonymous?: boolean } | null
  status: { id: number; name: string } | null
}

/** Agrupa los resultados por análisis, preservando el orden de llegada. */
function groupByAnalysis(results: Result[]): ResultGroup[] {
  const groups: Record<number, ResultGroup> = {}
  const order: number[] = []
  for (const r of results) {
    const aid = r.analysis.id
    if (!groups[aid]) {
      groups[aid] = { analysis: r.analysis, determinations: [] }
      order.push(aid)
    }
    groups[aid].determinations.push(r)
  }
  return order.map((aid) => groups[aid])
}

/**
 * Carga y guardado de los resultados de UN protocolo. Encapsula fetch, valores,
 * recálculo de fórmulas (debounced), guardado por determinación y resultados
 * anteriores del paciente. La navegación por teclado vive en el componente
 * (necesita refs del DOM); acá se expone `orderedIds` y `onSave`.
 */
/** Un protocolo cancelado se ve pero no se escribe. El backend además lo bloquea. */
const esCancelado = (protocolo: ResultsProtocolHeader | null | undefined): boolean =>
  (protocolo?.status?.name || "").trim().toLowerCase() === "cancelado"

/** Mismo criterio que el aviso de la pantalla: cancelado se ve, no se escribe. */
const AVISO_PROTOCOLO_CANCELADO =
  "El protocolo está cancelado: descancelalo para editar los resultados."


export function useProtocolResults(protocolId: number) {
  const { apiRequest } = useApi()
  const { hasPermission } = useAuth()
  // La LECTURA sigue abierta a cualquier usuario autenticado; solo el guardado
  // pide permiso. Se chequea también acá (no solo en la UI) porque el atajo de
  // teclado Enter llega a `onSave` sin pasar por ningún botón.
  const canEditResults = hasPermission(PERMISSIONS.MANAGE_RESULTS.codename)
  const [results, setResults] = useState<Result[]>([])
  const [submodulos, setSubmodulos] = useState<SubmoduloEvaluado[]>([])
  const [protocol, setProtocol] = useState<ResultsProtocolHeader | null>(null)
  const [values, setValues] = useState<Record<number, ResultValue>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previousResults, setPreviousResults] = useState<Record<number, PreviousResult[]>>({})
  const [loadingPrevious, setLoadingPrevious] = useState<Set<number>>(new Set())

  // Un protocolo cancelado se ve pero no se escribe —el backend además lo
  // bloquea—. Se calcula acá porque el guardado automático de las fórmulas
  // tiene que respetarlo sin que la pantalla se lo tenga que recordar.
  const cancelado = esCancelado(protocol)
  // En una ref y no en las dependencias del guardado automático: si entrara
  // como dependencia, abrir un protocolo cancelado cambiaría la identidad de
  // `fetchResults` en el medio de la carga y dispararía un segundo fetch.
  const canceladoRef = useRef(cancelado)
  canceladoRef.current = cancelado

  // `onSave`, `alternarCargaManual` y `alternarExclusion` leen `results` y
  // `values` DESPUÉS de un `await`. Si dos de estas acciones se disparan casi
  // juntas (guardar una fila y excluir otra, por ejemplo), la segunda que
  // termina pisa el estado con lo que tenía en su clausura ANTES de que la
  // primera terminara — la actualización de la primera desaparece de la
  // pantalla aunque el backend la haya guardado bien. Leer de la ref en vez
  // de la clausura evita eso: siempre parte de lo último, no de una foto
  // vieja tomada al invocar la función.
  const resultsRef = useRef<Result[]>(results)
  useEffect(() => {
    resultsRef.current = results
  }, [results])

  const valuesRef = useRef<Record<number, ResultValue>>(values)
  useEffect(() => {
    valuesRef.current = values
  }, [values])

  /**
   * Guarda las fórmulas que ya se calcularon solas.
   *
   * POR QUÉ
   * =======
   * Una determinación con fórmula muestra el valor apenas están sus
   * componentes, pero hasta acá ese valor vivía solo en la pantalla: alguien
   * tenía que ir a la fila y apretar Enter para que se guardara. Son dos o
   * tres por hemograma, todas con el mismo valor que ya estaba a la vista, y
   * si nadie las apretaba el resultado quedaba sin cargar de verdad — no se
   * podía validar ni salía en el informe, aunque en la pantalla se viera.
   *
   * `soloVacias` es para el momento de abrir el protocolo: ahí se completa lo
   * que nunca se guardó, pero no se pisa nada que ya tenga un valor. Abrir una
   * pantalla no puede cambiar un número que alguien decidió.
   *
   * Qué filas entran lo decide `formulasParaGuardar`, que está aparte porque
   * son seis condiciones y conviene poder leerlas —y probarlas— sin el resto
   * del hook alrededor. Acá se agregan las dos que dependen de la pantalla: no
   * se escribe un protocolo cancelado ni sin permiso.
   */
  const guardarFormulasCalculadas = useCallback(
    async (
      resultados: Result[],
      valores: Record<number, ResultValue>,
      {
        soloVacias = false,
        protocoloCancelado,
      }: { soloVacias?: boolean; protocoloCancelado?: boolean } = {},
    ) => {
      if (!canEditResults || (protocoloCancelado ?? canceladoRef.current)) return

      const pendientes = formulasParaGuardar(resultados, valores, { soloVacias })
      if (pendientes.length === 0) return

      setSaving((prev) => {
        const siguiente = { ...prev }
        pendientes.forEach((r) => {
          siguiente[r.id] = true
        })
        return siguiente
      })

      const guardados = await Promise.all(
        pendientes.map(async (r) => {
          try {
            const res = await apiRequest(RESULTS_ENDPOINTS.RESULT_DETAIL(r.id), {
              method: "PATCH",
              body: { value: valores[r.id].value, notes: valores[r.id].notes ?? "" },
            })
            if (!res.ok) return null
            return (await res.json()) as Result
          } catch {
            return null
          }
        }),
      )

      const ok = guardados.filter((r): r is Result => r !== null)

      setSaving((prev) => {
        const siguiente = { ...prev }
        pendientes.forEach((r) => {
          siguiente[r.id] = false
        })
        return siguiente
      })

      if (ok.length > 0) {
        const porId = new Map(ok.map((r) => [r.id, r]))
        setResults((prev) => prev.map((r) => porId.get(r.id) ?? r))
        setValues((prev) => {
          const siguiente = { ...prev }
          ok.forEach((r) => {
            siguiente[r.id] = { value: r.value, notes: r.notes }
          })
          return siguiente
        })
        const ultimo = ok[ok.length - 1]
        if (ultimo.protocol_status !== undefined) {
          setProtocol((prev) => (prev ? { ...prev, status: ultimo.protocol_status ?? null } : prev))
        }
      }

      // Callado cuando sale bien —es justamente lo que se pidió: que no haya
      // que hacer nada—, pero si falló hay que decirlo: si no, la pantalla
      // muestra un valor que el servidor no tiene.
      if (ok.length < pendientes.length) {
        toast.error("No se pudo guardar solo un resultado calculado. Guardalo a mano.")
      }
    },
    [apiRequest, canEditResults],
  )

  const fetchResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // ?include=protocol trae cabecera (paciente + estado) + resultados en una
      // sola llamada, evitando un fetch aparte del detalle del protocolo.
      const res = await apiRequest(`${RESULTS_ENDPOINTS.BY_PROTOCOL(protocolId)}?include=protocol`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "Error al cargar los resultados"))
      }
      const body = await res.json()
      const data: Result[] = Array.isArray(body) ? body : body.results || []
      if (!Array.isArray(body) && body.protocol) setProtocol(body.protocol as ResultsProtocolHeader)
      setSubmodulos(!Array.isArray(body) ? (body.submodulos as SubmoduloEvaluado[]) || [] : [])
      setResults(data)
      const initial: Record<number, ResultValue> = {}
      data.forEach((r) => {
        initial[r.id] = { value: r.value || "", notes: r.notes || "" }
      })
      const calculados = applyFormulaCalculations(data, initial)
      setValues(calculados)

      // Lo que la fórmula resolvió y nunca se guardó, se guarda ahora. Con
      // `soloVacias`: abrir una pantalla completa lo que falta, pero no pisa
      // un número que alguien decidió. El estado del protocolo se toma del
      // encabezado que acaba de llegar y no del estado de React, que en este
      // punto todavía es el anterior.
      void guardarFormulasCalculadas(data, calculados, {
        soloVacias: true,
        protocoloCancelado: esCancelado(
          !Array.isArray(body) ? (body.protocol as ResultsProtocolHeader) : null,
        ),
      })
    } catch (e) {
      setError(getErrorMessage(e, "No se pudieron cargar los resultados"))
    } finally {
      setLoading(false)
    }
  }, [apiRequest, protocolId, guardarFormulasCalculadas])

  useEffect(() => {
    void fetchResults()
  }, [fetchResults])

  const groups = useMemo(() => groupByAnalysis(results), [results])
  // Las excluidas quedan afuera del recorrido: Enter y las flechas las saltean,
  // porque no hay nada que cargar ahí.
  const orderedIds = useMemo(
    () => groups.flatMap((g) => g.determinations.filter((d) => !d.excluido).map((d) => d.id)),
    [groups],
  )

  // Recálculo de fórmulas diferido: la tecla hace solo el set puntual.
  const formulaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChange = useCallback(
    (resultId: number, field: "value" | "notes", value: string) => {
      setValues((prev) => ({ ...prev, [resultId]: { ...prev[resultId], [field]: value } }))
      if (field !== "value") return
      if (formulaTimer.current) clearTimeout(formulaTimer.current)
      formulaTimer.current = setTimeout(() => {
        setValues((prev) => applyFormulaCalculations(results, prev))
      }, 250)
    },
    [results],
  )

  const onSave = useCallback(
    async (resultId: number): Promise<boolean> => {
      if (!canEditResults) {
        toast.error(PERMISSION_MESSAGES.MANAGE_RESULTS)
        return false
      }
      const v = values[resultId]
      if (!v) return false
      setSaving((prev) => ({ ...prev, [resultId]: true }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.RESULT_DETAIL(resultId), {
          method: "PATCH",
          body: { value: v.value, notes: v.notes },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(formatApiError(err, "Error al guardar el resultado"))
        }
        const updated: Result = await res.json()
        const siguientes = resultsRef.current.map((r) => (r.id === resultId ? updated : r))
        resultsRef.current = siguientes
        setResults(siguientes)
        const valores = applyFormulaCalculations(siguientes, {
          ...valuesRef.current,
          [resultId]: { value: updated.value, notes: updated.notes },
        })
        valuesRef.current = valores
        setValues(valores)
        if (updated.protocol_status !== undefined) {
          setProtocol((prev) => (prev ? { ...prev, status: updated.protocol_status ?? null } : prev))
        }

        // GUARDAR UN COMPONENTE GUARDA LO QUE ESE COMPONENTE CALCULA.
        //
        // Es el momento en que la fórmula "se hace": se cargó el último valor
        // que le faltaba y el resultado apareció solo en la pantalla. Antes
        // había que ir hasta esa fila y apretar Enter para que existiera de
        // verdad; ahora sale con el mismo Enter que guardó el componente.
        void guardarFormulasCalculadas(siguientes, valores)
        return true
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo guardar el resultado"))
        return false
      } finally {
        setSaving((prev) => ({ ...prev, [resultId]: false }))
      }
    },
    [apiRequest, values, canEditResults, guardarFormulasCalculadas],
  )

  /**
   * Enciende o apaga la carga a mano de una determinación con fórmula.
   *
   * Encendida, el cálculo deja de pisar el valor y la fila se escribe como
   * cualquier otra: es la salida cuando la fórmula está mal cargada y traba el
   * protocolo. Al apagarla se recalcula en el acto, así se ve enseguida qué
   * decía la fórmula.
   *
   * El valor cargado a mano NO se borra al volver al cálculo: si la fórmula no
   * resuelve —le falta un componente— la fila quedaría vacía y habría que
   * escribirlo de nuevo.
   */
  const alternarCargaManual = useCallback(
    async (resultId: number, manual: boolean): Promise<boolean> => {
      if (!canEditResults) {
        toast.error(PERMISSION_MESSAGES.MANAGE_RESULTS)
        return false
      }
      setSaving((prev) => ({ ...prev, [resultId]: true }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.RESULT_DETAIL(resultId), {
          method: "PATCH",
          body: { carga_manual: manual },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(formatApiError(err, "No se pudo cambiar el modo de carga"))
        }
        const updated: Result = await res.json()
        const siguientes = resultsRef.current.map((r) => (r.id === resultId ? updated : r))
        resultsRef.current = siguientes
        setResults(siguientes)
        // Con la lista ya actualizada: si se apagó, el cálculo vuelve a correr
        // sobre esta fila; si se encendió, la saltea.
        setValues((prev) => {
          const siguientesValores = applyFormulaCalculations(siguientes, prev)
          valuesRef.current = siguientesValores
          return siguientesValores
        })
        return true
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo cambiar el modo de carga"))
        return false
      } finally {
        setSaving((prev) => ({ ...prev, [resultId]: false }))
      }
    },
    [apiRequest, canEditResults],
  )

  /**
   * Deja una determinación fuera de ESTE protocolo, o la vuelve
   * a incluir.
   *
   * NO SE BORRA NADA
   * ================
   * Valor, notas, evaluación y firma de validación quedan tal cual: la fila
   * simplemente deja de intervenir en el estado del protocolo, el informe y el
   * envío. Al volver a incluirla reaparece completa.
   *
   * EL 409 NO ES UNA FALLA
   * ======================
   * Si la fila ya tiene datos, el backend no cambia nada y pide confirmación.
   * Eso se devuelve como `requiereConfirmacion` —sin aviso de error— para que
   * la pantalla abra el diálogo y reintente con `confirmarConDatos`.
   */
  const alternarExclusion = useCallback(
    async (
      resultId: number,
      excluido: boolean,
      confirmarConDatos?: boolean,
    ): Promise<ResultadoExclusion> => {
      if (!canEditResults) {
        toast.error(PERMISSION_MESSAGES.MANAGE_RESULTS)
        return { ok: false }
      }
      if (canceladoRef.current) {
        toast.error(AVISO_PROTOCOLO_CANCELADO)
        return { ok: false }
      }
      setSaving((prev) => ({ ...prev, [resultId]: true }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.EXCLUSION(resultId), {
          method: "POST",
          body: { excluido, ...(confirmarConDatos ? { confirmar_con_datos: true } : {}) },
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            detail?: string
            requires_confirmation?: boolean
          }
          if (res.status === 409 && err.requires_confirmation) {
            return { ok: false, requiereConfirmacion: true }
          }
          throw new Error(formatApiError(err, "No se pudo cambiar la exclusión"))
        }
        const updated: Result = await res.json()
        const siguientes = resultsRef.current.map((r) => (r.id === resultId ? updated : r))
        resultsRef.current = siguientes
        setResults(siguientes)
        // Con la lista ya actualizada: las fórmulas que usaban esta fila como
        // componente dejan de resolver (o vuelven a hacerlo al reincluirla).
        setValues((prev) => {
          const siguientesValores = applyFormulaCalculations(siguientes, prev)
          valuesRef.current = siguientesValores
          return siguientesValores
        })
        if (updated.protocol_status !== undefined) {
          setProtocol((prev) => (prev ? { ...prev, status: updated.protocol_status ?? null } : prev))
        }
        toast.success(
          excluido ? "Determinación dejada fuera del protocolo" : "Determinación vuelta a incluir",
        )
        return { ok: true }
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo cambiar la exclusión"))
        return { ok: false }
      } finally {
        setSaving((prev) => ({ ...prev, [resultId]: false }))
      }
    },
    [apiRequest, canEditResults],
  )

  /**
   * Borra el valor cargado: lo vacía en pantalla y en la base.
   *
   * Va aparte de `onSave` porque no puede depender de que el estado ya se haya
   * actualizado —`onSave` lee `values` de su clausura— y porque borrar es una
   * acción con su propio botón, no el efecto de dejar un campo vacío.
   */
  const borrarValor = useCallback(
    async (resultId: number): Promise<boolean> => {
      if (!canEditResults) {
        toast.error(PERMISSION_MESSAGES.MANAGE_RESULTS)
        return false
      }
      setSaving((prev) => ({ ...prev, [resultId]: true }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.RESULT_DETAIL(resultId), {
          method: "PATCH",
          body: { value: "" },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(formatApiError(err, "No se pudo borrar el valor"))
        }
        const updated: Result = await res.json()
        setResults((prev) => prev.map((r) => (r.id === resultId ? updated : r)))
        setValues((prev) => ({
          ...prev,
          [resultId]: { value: updated.value || "", notes: updated.notes || "" },
        }))
        if (updated.protocol_status !== undefined) {
          setProtocol((prev) => (prev ? { ...prev, status: updated.protocol_status ?? null } : prev))
        }
        return true
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo borrar el valor"))
        return false
      } finally {
        setSaving((prev) => ({ ...prev, [resultId]: false }))
      }
    },
    [apiRequest, canEditResults],
  )

  // Validar / rechazar un resultado (validación, mouse-first).
  const onValidate = useCallback(
    async (resultId: number, isValid: boolean, notes?: string): Promise<boolean> => {
      setSaving((prev) => ({ ...prev, [resultId]: true }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.VALIDATE(resultId), {
          method: "POST",
          body: { is_valid: isValid, tipo: "bioquimica", ...(notes ? { notes } : {}) },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(formatApiError(err, "Error al validar el resultado"))
        }
        const updated: Result = await res.json()
        setResults((prev) => prev.map((r) => (r.id === resultId ? updated : r)))
        if (updated.protocol_status !== undefined) {
          setProtocol((prev) => (prev ? { ...prev, status: updated.protocol_status ?? null } : prev))
        }
        toast.success(isValid ? "Resultado validado" : "Resultado rechazado")
        return true
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo validar el resultado"))
        return false
      } finally {
        setSaving((prev) => ({ ...prev, [resultId]: false }))
      }
    },
    [apiRequest],
  )

  /**
   * Valida varios resultados en UNA request.
   *
   * "Validar todos" iba de a uno y esperando: treinta determinaciones eran
   * treinta idas y vueltas, treinta recálculos del estado del protocolo y
   * treinta avisos apilados en pantalla.
   *
   * Devuelve los que NO se pudieron validar, con el motivo. El backend firma
   * todos los que puede y rebota los otros —una fórmula que no cierra, un
   * valor vacío— porque el botón dice "todos" pero significa "todos los que
   * se puedan": un solo error no puede dejar al bioquímico sin avanzar.
   */
  const onValidateMany = useCallback(
    async (resultIds: number[], isValid: boolean): Promise<{ id: number; detail: string }[]> => {
      if (resultIds.length === 0) return []
      setSaving((prev) => ({ ...prev, ...Object.fromEntries(resultIds.map((id) => [id, true])) }))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.VALIDATE_BATCH, {
          method: "POST",
          body: { result_ids: resultIds, is_valid: isValid, tipo: "bioquimica" },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(formatApiError(err, "Error al validar los resultados"))
        }
        const data: {
          results: Result[]
          errors: { id: number; detail: string }[]
          affected_protocols: { id: number; status: ResultsProtocolHeader["status"] }[]
        } = await res.json()

        const porId = new Map(data.results.map((r) => [r.id, r]))
        setResults((prev) => prev.map((r) => porId.get(r.id) ?? r))
        // Por id y no por posición: todos los resultados son de este
        // protocolo, pero el endpoint acepta varios y no conviene depender
        // de que venga uno solo.
        const propio = data.affected_protocols.find((p) => p.id === protocolId)
        if (propio) setProtocol((prev) => (prev ? { ...prev, status: propio.status } : prev))

        return data.errors ?? []
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudieron validar los resultados"))
        // La tanda entera falló: ninguno se firmó.
        return resultIds.map((id) => ({ id, detail: "No se pudo validar" }))
      } finally {
        setSaving((prev) => ({ ...prev, ...Object.fromEntries(resultIds.map((id) => [id, false])) }))
      }
    },
    [apiRequest, protocolId],
  )

  const loadPrevious = useCallback(
    async (resultId: number, patientId: number, determinationId: number) => {
      if (previousResults[resultId] || loadingPrevious.has(resultId)) return
      setLoadingPrevious((prev) => new Set(prev).add(resultId))
      try {
        const res = await apiRequest(RESULTS_ENDPOINTS.PREVIOUS_RESULTS(patientId, determinationId))
        if (res.ok) {
          const data: PreviousResult[] = await res.json()
          setPreviousResults((prev) => ({ ...prev, [resultId]: data }))
        }
      } catch {
        /* silencioso: los anteriores son auxiliares */
      } finally {
        setLoadingPrevious((prev) => {
          const next = new Set(prev)
          next.delete(resultId)
          return next
        })
      }
    },
    [apiRequest, previousResults, loadingPrevious],
  )

  /**
   * El estado de cada submódulo con lo que hay tipeado AHORA.
   *
   * La suma se calcula acá y no en el backend a propósito: el backend solo
   * conoce lo guardado, y el aviso tiene que aparecer mientras se escribe, no
   * después de guardar. La definición —qué determinaciones y a cuánto tienen
   * que sumar— sí viene de allá, que es donde se configura.
   */
  const estadoSubmodulos = useMemo(() => {
    const resultadoPorDeterminacion = new Map<number, Result>()
    const determinacionesExcluidas = new Set<number>()
    results.forEach((r) => {
      if (r.excluido) {
        determinacionesExcluidas.add(r.determination.id)
        return
      }
      resultadoPorDeterminacion.set(r.determination.id, r)
    })

    return submodulos
      // Una determinación excluida sale del submódulo; la fórmula sigue
      // valiendo para las que quedan. Mismo criterio que `corroboracion.py`
      // en el backend.
      //
      // Se parte de `determinaciones_definidas` (el catálogo completo del
      // submódulo, sin filtrar) y no de `determinaciones`: esta última ya
      // viene filtrada por las exclusiones que había al pedir la pantalla, así
      // que una determinación que estaba excluida entonces no aparece ahí —y
      // si el usuario la reincluye ahora, no hay forma de volver a sumarla
      // porque su id ya no está en ninguna lista. Con el catálogo completo
      // como base, el filtro de acá siempre refleja el estado ACTUAL.
      .map(
        (s): SubmoduloEvaluado => ({
          ...s,
          determinaciones: (s.determinaciones_definidas ?? s.determinaciones).filter(
            (id) => !determinacionesExcluidas.has(id),
          ),
        }),
      )
      // Sin determinaciones no hay nada que corroborar.
      .filter((s) => s.determinaciones.length > 0)
      .map((s) => {
        let suma = 0
        const faltantes: string[] = []

        for (const determinacionId of s.determinaciones) {
          const resultado = resultadoPorDeterminacion.get(determinacionId)
          const crudo = resultado ? (values[resultado.id]?.value ?? resultado.value) : ""
          const numero = Number.parseFloat(String(crudo).replace(",", "."))
          if (!crudo || Number.isNaN(numero)) {
            faltantes.push(resultado?.determination.name || "")
            continue
          }
          suma += numero
        }

        const esperado = Number.parseFloat(s.total_esperado) || 0
        const tolerancia = Number.parseFloat(s.tolerancia) || 0
        const completo = faltantes.length === 0
        // Sin todo cargado no se opina: la suma no puede dar y marcar error sobre
        // algo que se está tipeando enseña a ignorar el error.
        const cierra =
          completo && suma >= esperado - tolerancia && suma <= esperado + tolerancia

        return { ...s, suma, esperado, tolerancia, completo, cierra, faltantes }
      })
  }, [submodulos, results, values])

  return {
    loading,
    error,
    protocol,
    results,
    submodulos: estadoSubmodulos,
    groups,
    orderedIds,
    values,
    saving,
    onChange,
    onSave,
    onValidate,
    onValidateMany,
    alternarCargaManual,
    alternarExclusion,
    borrarValor,
    previousResults,
    loadingPrevious,
    loadPrevious,
    refetch: fetchResults,
  }
}
