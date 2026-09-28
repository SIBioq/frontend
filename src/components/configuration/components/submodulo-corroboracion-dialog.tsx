"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Sigma, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { unidadCompleta } from "@/lib/notacion"
import type { Determination, SubmoduloDeCorroboracion } from "@/types"

/**
 * Submódulos de corroboración de un análisis.
 *
 * QUÉ ES
 * ======
 * Un grupo de determinaciones cuya suma tiene que dar un número conocido. El
 * caso que lo pide es la fórmula leucocitaria: neutrófilos, linfocitos,
 * monocitos, eosinófilos y basófilos son porcentajes y suman 100. Si suman 95,
 * alguien contó mal — y eso no lo ve ningún rango de referencia, porque cada
 * valor por separado puede ser perfectamente normal.
 *
 * SOLO SE OFRECEN LAS DE LA MISMA UNIDAD
 * ======================================
 * Sumar un porcentaje con un mEq/L da un número que no significa nada. En vez
 * de dejar elegir cualquiera y rebotar al guardar, apenas se marca la primera
 * se apagan las que no comparten unidad: el error no llega a existir.
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  analysisId: number
  /** `AnalysisCatalog.name` puede venir nulo del catálogo importado. */
  analysisName: string | null
}

const VACIO = { nombre: "", total: "", tolerancia: "0", elegidas: [] as number[] }

/** La unidad como se compara: el texto más la notación científica. */
const claveDeUnidad = (d: Determination) =>
  `${(d.measure_unit || "").trim()}|${d.scientific_exponent ?? ""}`

export function SubmoduloCorroboracionDialog({
  open,
  onOpenChange,
  analysisId,
  analysisName,
}: Props) {
  const { apiRequest } = useApi()
  const toastActions = useToast()

  const [submodulos, setSubmodulos] = useState<SubmoduloDeCorroboracion[]>([])
  const [determinaciones, setDeterminaciones] = useState<Determination[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<number | null>(null)
  const [form, setForm] = useState(VACIO)

  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const [resSub, resDet] = await Promise.all([
        apiRequest(`${CATALOG_ENDPOINTS.SUBMODULOS_CORROBORACION}?analysis=${analysisId}`),
        apiRequest(`${CATALOG_ENDPOINTS.DETERMINATIONS}?analysis=${analysisId}&is_active=true&limit=200`),
      ])
      if (resSub.ok) {
        const datos = await resSub.json()
        setSubmodulos(Array.isArray(datos) ? datos : datos.results || [])
      }
      if (resDet.ok) {
        const datos = await resDet.json()
        const filas: Determination[] = Array.isArray(datos) ? datos : datos.results || []
        setDeterminaciones(filas.filter((d) => d.analysis === analysisId))
      }
    } catch (err) {
      toastActions.error("No se pudo cargar", {
        description: getErrorMessage(err, "Probá de nuevo."),
      })
    } finally {
      setCargando(false)
    }
  }, [apiRequest, analysisId, toastActions])

  useEffect(() => {
    if (!open) return
    setForm(VACIO)
    void traer()
  }, [open, traer])

  // Apenas hay una marcada, el resto de las unidades se apaga: sumar peras con
  // manzanas da un número que no significa nada.
  const unidadElegida = form.elegidas.length
    ? claveDeUnidad(determinaciones.find((d) => d.id === form.elegidas[0]) as Determination)
    : null

  const alternar = (id: number) =>
    setForm((p) => ({
      ...p,
      elegidas: p.elegidas.includes(id)
        ? p.elegidas.filter((x) => x !== id)
        : [...p.elegidas, id],
    }))

  const totalValido = Number.parseFloat(form.total.replace(",", ".")) > 0
  const puedeGuardar =
    form.nombre.trim().length > 0 && totalValido && form.elegidas.length >= 2 && !guardando

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const respuesta = await apiRequest(CATALOG_ENDPOINTS.SUBMODULOS_CORROBORACION, {
        method: "POST",
        body: {
          analysis: analysisId,
          nombre: form.nombre.trim(),
          determinaciones: form.elegidas,
          total_esperado: form.total.replace(",", "."),
          tolerancia: (form.tolerancia || "0").replace(",", "."),
        },
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo crear el submódulo."))
      }
      toastActions.success("Submódulo creado", {
        description: "Se controla al cargar y frena al validar.",
      })
      setForm(VACIO)
      await traer()
    } catch (err) {
      toastActions.error("No se pudo crear", {
        description: getErrorMessage(err, "Revisá los datos."),
      })
    } finally {
      setGuardando(false)
    }
  }

  const darDeBaja = async (id: number) => {
    setBorrando(id)
    try {
      const respuesta = await apiRequest(
        CATALOG_ENDPOINTS.SUBMODULO_CORROBORACION(id), { method: "DELETE" },
      )
      if (!respuesta.ok && respuesta.status !== 204) {
        throw new Error("No se pudo dar de baja.")
      }
      toastActions.success("Submódulo dado de baja")
      await traer()
    } catch (err) {
      toastActions.error("No se pudo dar de baja", {
        description: getErrorMessage(err, "Probá de nuevo."),
      })
    } finally {
      setBorrando(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-violet-600" />
            Submódulos de corroboración{analysisName ? ` — ${analysisName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Un grupo de determinaciones cuya suma tiene que dar un número conocido.
            Al cargar resultados se ve el total corriendo; al validar, si no cierra,
            no deja firmar.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {submodulos.length > 0 && (
              <div className="space-y-2">
                {submodulos.map((s) => (
                  <div key={s.id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{s.nombre}</p>
                        <p className="text-xs text-gray-500">
                          Tiene que sumar {s.total_esperado}
                          {Number.parseFloat(s.tolerancia || "0") > 0
                            ? ` ± ${s.tolerancia}`
                            : " exacto"}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {(s.determinaciones_detalle || []).map((d) => d.name).join(" + ")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-rose-600"
                        aria-label={`Dar de baja ${s.nombre}`}
                        onClick={() => darDeBaja(s.id)}
                        disabled={borrando === s.id}
                      >
                        {borrando === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">Nuevo submódulo</p>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
                <div className="space-y-1.5">
                  <Label htmlFor="submodulo-nombre" className="text-xs">Nombre</Label>
                  <Input
                    id="submodulo-nombre"
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="ej: Fórmula leucocitaria"
                    className="bg-white"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="submodulo-total" className="text-xs">Tiene que sumar</Label>
                  <Input
                    id="submodulo-total"
                    inputMode="decimal"
                    value={form.total}
                    onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))}
                    placeholder="100"
                    className="bg-white tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="submodulo-tolerancia" className="text-xs">Tolerancia</Label>
                  <Input
                    id="submodulo-tolerancia"
                    inputMode="decimal"
                    value={form.tolerancia}
                    onChange={(e) => setForm((p) => ({ ...p, tolerancia: e.target.value }))}
                    placeholder="0"
                    className="bg-white tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Determinaciones (al menos dos, con la misma unidad)
                </Label>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
                  {determinaciones.length === 0 && (
                    <p className="p-2 text-xs italic text-gray-400">
                      Este análisis todavía no tiene determinaciones.
                    </p>
                  )}
                  {determinaciones.map((d) => {
                    const marcada = form.elegidas.includes(d.id)
                    const otraUnidad =
                      unidadElegida !== null && claveDeUnidad(d) !== unidadElegida
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                          otraUnidad && !marcada
                            ? "cursor-not-allowed opacity-40"
                            : "cursor-pointer hover:bg-gray-50"
                        }`}
                      >
                        <Checkbox
                          checked={marcada}
                          disabled={otraUnidad && !marcada}
                          onCheckedChange={() => alternar(d.id)}
                        />
                        <span className="flex-1 truncate">{d.name}</span>
                        <span className="text-xs text-gray-400">
                          {unidadCompleta(d.measure_unit, d.scientific_exponent) || "sin unidad"}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {unidadElegida !== null && (
                  <p className="text-[11px] text-gray-400">
                    Se apagaron las de otra unidad: sumarlas daría un número sin
                    sentido.
                  </p>
                )}
              </div>

              <Button
                onClick={guardar}
                disabled={!puedeGuardar}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {guardando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Crear submódulo
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
