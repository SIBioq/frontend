"use client"

import { useEffect, useState } from "react"
import { keepPreviousData } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, FlaskConical, TrendingUp } from "lucide-react"

import CajaDelDia from "@/components/caja-del-dia"
import useAuth from "@/contexts/auth-context"
import { useApiQuery } from "@/hooks/use-api-query"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useToast } from "@/hooks/use-toast"
import { ANALYTICS_ENDPOINTS } from "@/config/api"
import { PERMISSIONS } from "@/config/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { ENTRADA_ARRIBA } from "@/lib/entrada"

import type { Inicio, MesDisponible } from "@/components/inicio/tipos"
import { contraQue, nombreDelMes, numero, porcentaje } from "@/components/inicio/formato"
import { Grupo } from "@/components/inicio/piezas"
import { retraso } from "@/components/inicio/movimiento"
import PacientesAtendidos from "@/components/inicio/pacientes-atendidos"
import Resultados from "@/components/inicio/resultados"
import Caja from "@/components/inicio/caja"
import Papeles from "@/components/inicio/papeles"
import Facturacion from "@/components/inicio/facturacion"
import { ObrasSociales, PacientesPorLugar, Tiempos, TopUrgentes } from "@/components/inicio/como-viene-el-mes"

/**
 * Contra qué se compara lo que se acumula en el mes y los tiempos. Siempre
 * hasta el mismo día: comparar el 1 al 15 contra un mes entero siempre da
 * «bajó». Lo pendiente no depende de esto: compara contra hace una semana.
 *
 * «Desde siempre» se fue: contra un total que crece para siempre no se
 * contesta si venimos mejor o peor. Quien lo tenía guardado vuelve al default.
 */
const ALCANCES = [
  { clave: "mes-anterior", etiqueta: "el mes anterior, hasta el mismo día" },
  { clave: "3", etiqueta: "los últimos 3 meses, hasta el mismo día" },
  { clave: "6", etiqueta: "los últimos 6 meses, hasta el mismo día" },
  { clave: "12", etiqueta: "los últimos 12 meses, hasta el mismo día" },
]

const esMesActual = (anio: number, mes: number) => {
  const hoy = new Date()
  return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1
}

const mesActual = (): MesDisponible => {
  const hoy = new Date()
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
}

/** «Completados 132 · +12,5 % vs. el 1 al 15 de septiembre». */
function Completados({ datos }: { datos: Inicio }) {
  const { completados, crecimiento } = datos.encabezado
  const tono =
    crecimiento === null || crecimiento === 0
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : crecimiento > 0
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-800"
  const contra = contraQue(datos.comparacion.meses).replace(/^del /, "el ")
  return (
    <div className={`inline-flex w-fit flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-3 py-2 text-sm ${tono}`}>
      <TrendingUp className="h-4 w-4" aria-hidden="true" />
      <span>
        Completados <strong className="tabular-nums">{numero(completados)}</strong>
      </span>
      <span aria-hidden="true">·</span>
      {crecimiento === null ? (
        <span>sin mes anterior para comparar</span>
      ) : (
        <span>
          <strong className="tabular-nums">{porcentaje(crecimiento)}</strong> vs. {contra}
        </span>
      )}
    </div>
  )
}

function Cargando() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-[520px] w-full rounded-lg" />
      <div className="grid gap-2.5 @min-[660px]:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  )
}

export default function Home() {
  const { user, hasPermission } = useAuth()
  const { error: mostrarError } = useToast()
  const puedeVerElLibro = hasPermission(PERMISSIONS.MANAGE_LEDGER.codename)

  // EL MES QUE SE ESTÁ MIRANDO.
  // El inicio arranca siempre en hoy: es la pantalla con la que se abre el
  // laboratorio. `null` es exactamente eso; recién cuando alguien aprieta la
  // flecha se pide otro mes.
  const [mesElegido, setMesElegido] = useState<MesDisponible | null>(null)
  const mesVisible = mesElegido ?? mesActual()
  const viendoOtroMes = mesElegido !== null

  const [alcanceGuardado, setAlcance] = usePersistedState<string>("inicio:alcance-de-la-comparacion", "mes-anterior")
  const alcance = ALCANCES.some((a) => a.clave === alcanceGuardado) ? alcanceGuardado : "mes-anterior"

  const consulta = useApiQuery<Inicio>({
    queryKey: ["analytics", "inicio", mesVisible.anio, mesVisible.mes, alcance],
    url: ANALYTICS_ENDPOINTS.INICIO(mesVisible.anio, mesVisible.mes, alcance),
    // Un mes cerrado no cambia; el en curso se refresca solo cada minuto
    // (el backend lo guarda en caché el mismo minuto).
    staleTime: viendoOtroMes ? 5 * 60 * 1000 : 60 * 1000,
    refetchInterval: viendoOtroMes ? false : 60 * 1000,
    // Al cambiar de mes o de comparación queda lo anterior hasta que llega lo
    // nuevo: la pantalla no se vacía ni salta.
    placeholderData: keepPreviousData,
  })
  const datos = consulta.data

  useEffect(() => {
    if (consulta.error) mostrarError("Error al cargar el inicio")
  }, [consulta.error, mostrarError])

  const [cajaDelDia, setCajaDelDia] = useState<string | null>(null)

  // Del más nuevo al más viejo: en un selector, «el mes pasado» va arriba.
  const meses: MesDisponible[] = (datos?.meses_disponibles?.length ? [...datos.meses_disponibles] : [mesActual()]).sort(
    (a, b) => b.anio - a.anio || b.mes - a.mes,
  )
  if (!meses.some((m) => esMesActual(m.anio, m.mes))) meses.unshift(mesActual())
  const posicionActual = meses.findIndex((m) => m.anio === mesVisible.anio && m.mes === mesVisible.mes)
  const hayMesAnterior = posicionActual >= 0 && posicionActual < meses.length - 1
  const hayMesSiguiente = posicionActual > 0
  const elegirMes = (m: MesDisponible | undefined) => {
    if (!m) return
    setMesElegido(esMesActual(m.anio, m.mes) ? null : m)
  }

  const hayLoQueFalta = Boolean(datos?.papeles || datos?.facturacion)

  return (
    <div className="flex w-full flex-col gap-5 py-5 @container">
      <section
        style={retraso(0)}
        className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ARRIBA}`}
      >
        <div className="flex flex-col gap-3 @min-[960px]:flex-row @min-[960px]:items-center @min-[960px]:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[#204983] text-white">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-900">
                Hola, {user?.first_name || user?.username || "equipo"}
              </h1>
              <p className="text-sm text-slate-500">Resumen operativo del laboratorio</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => elegirMes(meses[posicionActual + 1])}
                disabled={!hayMesAnterior}
                aria-label="Mes anterior"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-[#204983] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={`${mesVisible.anio}-${mesVisible.mes}`}
                onChange={(e) => {
                  const [anio, mes] = e.target.value.split("-").map(Number)
                  elegirMes({ anio, mes })
                }}
                aria-label="Mes del inicio"
                className="h-7 min-w-[9.5rem] cursor-pointer rounded bg-transparent px-1 text-sm font-medium text-slate-700 outline-none"
              >
                {meses.map((m) => (
                  <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
                    {nombreDelMes(m.anio, m.mes)}
                    {esMesActual(m.anio, m.mes) ? " (en curso)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => elegirMes(meses[posicionActual - 1])}
                disabled={!hayMesSiguiente}
                aria-label="Mes siguiente"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-[#204983] disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <label className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
              <span className="whitespace-nowrap">Comparar con:</span>
              <select
                value={alcance}
                onChange={(e) => setAlcance(e.target.value)}
                aria-label="Con qué se compara lo que se acumula en el mes"
                className="min-w-0 max-w-full cursor-pointer bg-transparent text-xs font-medium text-slate-700 outline-none"
              >
                {ALCANCES.map((a) => (
                  <option key={a.clave} value={a.clave}>
                    {a.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            {datos ? <Completados datos={datos} /> : <Skeleton className="h-9 w-64" />}
          </div>
        </div>
      </section>

      {viendoOtroMes ? (
        <p
          style={retraso(1)}
          className={`m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${ENTRADA_ARRIBA}`}
        >
          Estás viendo <strong>{nombreDelMes(mesVisible.anio, mesVisible.mes)}</strong>, un mes que ya cerró. Lo que es
          de ahora —los pendientes, la caja del día, los papeles que faltan— no se muestra: no sería de ese mes.
        </p>
      ) : null}

      {!datos ? (
        <Cargando />
      ) : (
        <>
          <Grupo posicion={1}>Lo que se mira todo el día</Grupo>
          <PacientesAtendidos datos={datos} posicion={2} />
          <Resultados datos={datos} posicion={3} />
          <Caja datos={datos} posicion={4} puedeVerElLibro={puedeVerElLibro} onAbrirDia={setCajaDelDia} />

          {hayLoQueFalta ? (
            <>
              <Grupo posicion={5}>Lo que falta resolver</Grupo>
              <div
                className={`grid items-start gap-5 ${datos.papeles && datos.facturacion ? "@min-[740px]:grid-cols-2" : ""}`}
              >
                <Papeles datos={datos} posicion={6} />
                <Facturacion datos={datos} posicion={7} />
              </div>
            </>
          ) : null}

          <Grupo posicion={8}>Cómo viene el mes</Grupo>
          <Tiempos datos={datos} posicion={8} />
          <div className="grid items-start gap-5 @min-[600px]:grid-cols-2 @min-[600px]:[&>*:last-child]:col-span-2 @min-[960px]:grid-cols-3 @min-[960px]:[&>*:last-child]:col-span-1">
            <ObrasSociales datos={datos} posicion={8} />
            <TopUrgentes datos={datos} posicion={8} />
            <PacientesPorLugar datos={datos} posicion={8} />
          </div>
        </>
      )}

      <CajaDelDia fecha={cajaDelDia} onClose={() => setCajaDelDia(null)} />
    </div>
  )
}

