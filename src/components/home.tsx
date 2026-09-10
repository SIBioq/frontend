"use client"

import { useEffect, useState } from "react"

import CajaDelDia from "@/components/caja-del-dia"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileWarning,
  FlaskConical,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import useAuth from "@/contexts/auth-context"
import { useApiQuery } from "@/hooks/use-api-query"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useToast } from "@/hooks/use-toast"
import { ANALYTICS_ENDPOINTS } from "@/config/api"
import { PERMISSIONS } from "@/config/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import PendienteDelSistema from "@/components/pendiente-del-sistema"
import { CarruselDeslizable } from "@/components/common/carrusel-deslizable"
import { ENTRADA_ABAJO, ENTRADA_ARRIBA } from "@/lib/entrada"

interface DashboardResponse {
  analysis_today?: number
  patients_today?: number
  protocols_completed_month?: number
  protocols_completed_growth_percent?: string
  avg_result_load_time_human?: string
  pending_results_load?: number
  pending_results_validation?: number
  printed_with_incomplete_payment?: number
  missing_info?: {
    protocols_blocked?: number
    orden_no_trajo?: number
    orden_incompleta?: number
    orden_completa?: number
    preauth_pending_details?: number
    anonymous_patients_month?: number
  }
  arca_month?: {
    billed?: number
    pending?: number
    failed?: number
  }
  insurance_mix_month?: Array<{
    insurance_id: number
    name: string
    protocols: number
  }>
  protocols_daily_last_7?: Array<{
    date: string
    count: number
    protocols?: number
    patients_served?: number
    analyses_loaded?: number
    results_loaded?: number
  }>
  preauth_breakdown?: {
    no_trajo?: number
    incompleta?: number
    completa?: number
  }
  today_cash_revenue?: {
    protocols_count?: number
    total_paid?: string
    total_due?: string
    pending_to_collect?: string
    breakdown?: {
      analyses_amount_due?: string
      coseguro?: string
      material_descartable?: string
      derivacion?: string
      unplanned_charges?: string
      unplanned_payments_today?: string
    }
  }
  // Dashboard rework
  patients_daily_last_42?: Array<{ date: string; patients_served: number }>
  cash_daily_last_42?: Array<{ date: string; collected: string }>
  /** Los nombres viejos de esas dos series. Ver `serieDelDashboard`. */
  patients_daily_last_35?: Array<{ date: string; patients_served: number }>
  cash_daily_last_35?: Array<{ date: string; collected: string }>
  cash_pending_total?: string
  top_urgent_analyses?: Array<{ code: string; name: string; protocols: number }>
  urgent_pending?: number
  avg_resolution_time_human?: string
  ready_to_bill?: number
  /** Los meses que ofrece el selector, del primer protocolo hasta hoy. */
  meses_disponibles?: MesDisponible[]
}

interface MesDisponible {
  anio: number
  mes: number
}

/**
 * Las estadísticas de UN mes.
 *
 * El inicio mira el día de hoy y el mes en curso, y el 1° arranca de cero. Eso
 * está bien para operar, pero deja el mes que cerró sin ningún lado donde
 * mirarse. Esto contesta esa otra pregunta.
 */
interface PromedioPorDia {
  /** `null` si el mes todavía no empezó. */
  promedio: number | null
  pacientes: number
  dias: number
}

interface EstadisticasDelMes {
  anio: number
  mes: number
  es_mes_actual: boolean
  desde: string
  hasta: string
  protocolos: number
  pacientes: number
  analisis: number
  completados: number
  completados_mes_anterior: number
  /** `null` cuando el mes anterior no tuvo nada: no se inventa un porcentaje. */
  crecimiento_porcentaje: string | null
  cobrado: string
  anonimos: number
  arca: { billed: number; pending: number; failed: number }
  obras_sociales: Array<{ insurance_id: number | null; name: string; protocols: number }>
  pacientes_por_dia: Array<{ date: string; patients_served: number }>
  /**
   * Pacientes por día, en promedio, de este mes y del anterior.
   *
   * `promedio` en `null` es «todavía no pasó ningún día», que NO es lo mismo
   * que cero —cero se lee como «no vino nadie»—. `dias` es el divisor y se
   * muestra: sin él, «3,2 por día» de un mes que va por el día 4 se lee como
   * si fuera el mes entero.
   */
  promedio_de_pacientes_por_dia: {
    mes: PromedioPorDia
    mes_anterior: PromedioPorDia
  }
  caja_por_dia: Array<{ date: string; collected: string }>
  meses_disponibles: MesDisponible[]
  /** Todo lo que la pantalla muestra como número, del mes. Ver
   *  `metricas_del_periodo` en el backend. */
  urgentes_pendientes: number
  resultados_por_cargar: number
  resultados_por_validar: number
  impresos_con_pago_incompleto: number
  nos_deben: string
  debemos_devolver: string
  neto_a_favor: string
  informacion_faltante: number
  preautorizacion_pendiente: number
  carga_promedio: string
  tiempo_de_resolucion: string
  listos_para_facturar: number
  top_urgentes: Array<{ code: string; name: string; protocols: number }>
}

/**
 * Lo mismo que `EstadisticasDelMes`, pero del tramo con el que se compara: es
 * el número chico de cada cosa. Sale de la misma función del backend, así que
 * los dos números de un mismo rótulo miden igual.
 */
interface Comparacion {
  alcance: string
  desde: string | null
  hasta: string
  protocolos: number
  pacientes: number
  analisis: number
  completados: number
  cobrado: string
  urgentes_pendientes: number
  resultados_por_cargar: number
  resultados_por_validar: number
  impresos_con_pago_incompleto: number
  nos_deben: string
  debemos_devolver: string
  neto_a_favor: string
  informacion_faltante: number
  preautorizacion_pendiente: number
  carga_promedio: string
  tiempo_de_resolucion: string
  listos_para_facturar: number
  arca: { billed: number; pending: number; failed: number }
}

/**
 * Los tramos contra los que se puede comparar. La lista es la misma que acepta
 * el backend. El default es el mes anterior porque la pregunta de todos los
 * días es si venimos mejor o peor que el mes pasado, y contra un total que
 * crece para siempre eso no se contesta.
 */
const ALCANCES = [
  { clave: "mes-anterior", etiqueta: "el mes anterior" },
  { clave: "3", etiqueta: "últimos 3 meses" },
  { clave: "6", etiqueta: "últimos 6 meses" },
  { clave: "12", etiqueta: "últimos 12 meses" },
  { clave: "siempre", etiqueta: "desde siempre" },
] as const

type TrendTone = "emerald" | "rose" | "slate"

const numberOrZero = (value?: number) => value ?? 0

const parsePercent = (value?: string) => {
  const parsed = Number.parseFloat((value || "0").replace("%", ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const getTrendTone = (value: number): TrendTone => {
  if (value > 0) return "emerald"
  if (value < 0) return "rose"
  return "slate"
}

const toneClasses: Record<TrendTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
}

/**
 * Un día de la grilla del mes.
 *
 * `delMes` false = un día de un mes vecino, de los que completan la primera y
 * la última fila. Trae su dato igual que cualquier otro: la fila es una semana
 * y una semana se mira entera. `dato` null = día que todavía no pasó.
 */
type CeldaDelMes<T> = { date: string; delMes: boolean; dato: T | null }

/**
 * El mes partido en semanas de calendario, de lunes a domingo.
 *
 * Arma la grilla del mes: la primera semana es la que contiene al día 1 y la
 * última la que contiene al último día. Cada columna cae siempre bajo el mismo
 * día de la semana, que es lo que permite comparar un lunes contra otro lunes
 * de un vistazo.
 *
 * LOS DÍAS DEL MES VECINO SE DIBUJAN
 * ==================================
 * Las dos filas de las puntas se completan con días del mes anterior y del
 * siguiente, y esos días traen sus números de verdad. Antes ocupaban la
 * columna vacíos, así que la semana que abre el mes se leía como una semana
 * flojísima cuando lo que pasaba era que la mitad estaba en el otro mes —y es
 * justo la semana que se está trabajando cuando arranca uno nuevo—. Van en un
 * gris más apagado: son parte de la semana, no del mes.
 *
 * Los días sin dato quedan en `null`, no en cero: los que todavía no pasaron
 * no atendieron a nadie, pero eso no es lo mismo que un día abierto sin
 * pacientes, y pintarlos igual sería mentir.
 */
function semanasDelMes<T extends { date: string }>(
  anio: number,
  mes: number,
  serie: T[],
): Array<Array<CeldaDelMes<T>>> {
  const porFecha = new Map(serie.map((d) => [d.date, d]))
  // Día 0 del mes siguiente = último día de este mes.
  const ultimoDia = new Date(anio, mes, 0).getDate()
  // getDay() devuelve 0 para domingo; lo corro a 0 = lunes ... 6 = domingo.
  const offsetLunes = (dia: number) => (new Date(anio, mes - 1, dia).getDay() + 6) % 7

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  // Del lunes de la semana del día 1 al domingo de la semana del último día.
  const cursor = new Date(anio, mes - 1, 1 - offsetLunes(1))
  const fin = new Date(anio, mes - 1, ultimoDia + (6 - offsetLunes(ultimoDia)))

  const semanas: Array<Array<CeldaDelMes<T>>> = []
  let actual: Array<CeldaDelMes<T>> = []
  while (cursor <= fin) {
    const fecha = iso(cursor)
    const delMes = cursor.getFullYear() === anio && cursor.getMonth() === mes - 1
    actual.push({ date: fecha, delMes, dato: porFecha.get(fecha) ?? null })
    if (actual.length === 7) {
      semanas.push(actual)
      actual = []
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (actual.length > 0) semanas.push(actual)
  return semanas
}

const NOMBRES_DE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const nombreDelMes = (m: MesDisponible) => `${NOMBRES_DE_MES[m.mes - 1]} ${m.anio}`

/**
 * Una línea de la tarjeta de promedios: el rótulo y el número.
 *
 * Muestra siempre el divisor («sobre 10 días»). Sin eso, «3,2 por día» de un
 * mes que va por el día 4 se lee como si fuera el mes entero, y ahí el número
 * miente más de lo que informa.
 *
 * `null` es «todavía no pasó ningún día», que no es cero: cero se lee como «no
 * vino nadie».
 */
function FilaDePromedio({
  etiqueta,
  dato,
  destacada = false,
}: {
  etiqueta: string
  dato: { promedio: number | null; pacientes?: number; dias: number } | null
  destacada?: boolean
}) {
  const promedio = dato?.promedio

  const texto = (() => {
    if (promedio === null || promedio === undefined) return "—"
    // Redondeado a un decimal, un mes con muy pocos pacientes da 0 — y 0 se
    // lee como «no vino nadie», que es otra cosa. Pasa sólo con volúmenes
    // mínimos (una base recién puesta en marcha), pero ahí es justo donde el
    // número equivocado se cree.
    if (promedio === 0 && (dato?.pacientes ?? 0) > 0) return "<0,1"
    return promedio.toLocaleString("es-AR", { maximumFractionDigits: 1 })
  })()

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`min-w-0 truncate text-xs ${destacada ? "font-medium text-slate-900" : "text-slate-600"}`}>
        {etiqueta}
      </dt>
      <dd className="shrink-0 text-right">
        <span className={`text-sm font-semibold ${destacada ? "text-[#204983]" : "text-slate-800"}`}>
          {texto}
        </span>
        {dato && dato.dias > 0 && (
          <span className="ml-1 text-[11px] text-slate-400">
            /día · {dato.dias}d
          </span>
        )}
      </dd>
    </div>
  )
}

const esMesActual = (anio: number, mes: number) => {
  const hoy = new Date()
  return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1
}

/** El retraso de cada bloque, con tope: el último no puede entrar un segundo tarde. */
const retraso = (posicion: number) => ({
  animationDelay: `${Math.min(posicion, 8) * 70}ms`,
  animationFillMode: "both" as const,
})


export default function Home() {
  const { user, hasPermission } = useAuth()
  const { error: showErrorToast } = useToast()
  const canAccessBilling = hasPermission(PERMISSIONS.MANAGE_BILLING.codename)

  const dashboardQuery = useApiQuery<DashboardResponse>({
    queryKey: ["analytics", "dashboard"],
    url: ANALYTICS_ENDPOINTS.DASHBOARD,
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (dashboardQuery.error) {
      showErrorToast("Error al cargar las estadísticas")
    }
  }, [dashboardQuery.error, showErrorToast])

  const dashboard = dashboardQuery.data

  // MIRAR UN MES PARA ATRÁS
  //
  // El inicio arranca siempre en HOY: es la pantalla con la que se abre el
  // laboratorio y lo que importa a las ocho de la mañana es lo que hay
  // pendiente ahora. `mesElegido` en `null` es exactamente eso, la pantalla de
  // siempre; recién cuando alguien aprieta la flecha se pide otro mes.
  const [mesElegido, setMesElegido] = useState<MesDisponible | null>(null)
  const viendoOtroMes = mesElegido !== null

  // El mes que se está mirando: el elegido, o el actual si nadie eligió.
  const mesVisible: MesDisponible = mesElegido ?? (() => {
    const hoy = new Date()
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
  })()

  // Se pide siempre, también para el mes en curso: los números de la pantalla
  // pasan a ser del mes, no totales de toda la base.
  const mesQuery = useApiQuery<EstadisticasDelMes>({
    queryKey: ["analytics", "mes", mesVisible.anio, mesVisible.mes],
    url: ANALYTICS_ENDPOINTS.MES(mesVisible.anio, mesVisible.mes),
    // Un mes cerrado no cambia; el en curso tampoco al segundo.
    staleTime: viendoOtroMes ? 5 * 60 * 1000 : 60 * 1000,
  })
  const mesData = mesQuery.data

  // CONTRA QUÉ SE COMPARA.
  //
  // Cada número de la pantalla lleva otro abajo, más chico: el mismo dato sobre
  // otro tramo. Un número solo no dice si está bien o mal —siete urgentes
  // pendientes es mucho o poco según cómo veníamos—, y esa referencia había que
  // armarla abriendo mes por mes. El tramo se elige una vez para toda la
  // pantalla y se recuerda entre sesiones.
  const [alcance, setAlcance] = usePersistedState<string>(
    "inicio:alcance-de-la-comparacion",
    "mes-anterior",
  )
  const comparacionQuery = useApiQuery<Comparacion>({
    queryKey: ["analytics", "historico", alcance],
    url: ANALYTICS_ENDPOINTS.HISTORICO(alcance),
    // Recorre protocolos y resultados de un tramo largo: no tiene sentido
    // volver a pedirlo cada vez que la pantalla se enfoca.
    staleTime: 5 * 60 * 1000,
  })
  const comparacion = comparacionQuery.data
  const alcanceElegido = ALCANCES.find((a) => a.clave === alcance) ?? ALCANCES[0]

  const loading = mesQuery.isLoading || (!viendoOtroMes && dashboardQuery.isLoading)

  // Los meses que ofrece el selector. Vienen del dashboard —así el selector
  // está armado desde el primer render— y si todavía no llegaron, al menos
  // está el actual: un selector vacío no se puede ni abrir.
  const mesesOfrecidos: MesDisponible[] = (() => {
    const hoy = new Date()
    const actual = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
    const lista = dashboard?.meses_disponibles?.length
      ? [...dashboard.meses_disponibles]
      : [actual]
    // Del más nuevo al más viejo: en un selector, "el mes pasado" tiene que
    // estar arriba y no al final de dos años de historia.
    return lista.reverse()
  })()

  const posicionActual = mesesOfrecidos.findIndex(
    (m) => m.anio === mesVisible.anio && m.mes === mesVisible.mes,
  )
  // La lista va del más nuevo al más viejo: "atrás" es avanzar en el índice.
  const hayMesAnterior = posicionActual >= 0 && posicionActual < mesesOfrecidos.length - 1
  const hayMesSiguiente = posicionActual > 0

  const moverMes = (direccion: -1 | 1) => {
    const destino = mesesOfrecidos[posicionActual + (direccion === -1 ? 1 : -1)]
    if (!destino) return
    setMesElegido(esMesActual(destino.anio, destino.mes) ? null : destino)
  }

  // El porcentaje del encabezado sigue al mes que se está mirando.
  const growthValue = parsePercent(
    viendoOtroMes
      ? mesData?.crecimiento_porcentaje ?? undefined
      : dashboard?.protocols_completed_growth_percent,
  )
  const growthTone = getTrendTone(growthValue)
  const todayKey = (() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  })()
  // Gráfico: PACIENTES ATENDIDOS. El mes en semanas de calendario (lunes a
  // domingo) con carrusel. weekIndex va en orden: 0 = la semana del día 1,
  // el último = la semana que cierra el mes.
  //
  // SE LEEN LOS DOS NOMBRES DE LA SERIE, EL NUEVO Y EL VIEJO.
  //
  // Las series pasaron de 35 a 42 días y con eso cambiaron de nombre. El
  // frontend y el backend son dos repositorios que se despliegan por separado,
  // así que hay una ventana —los minutos que tarda el deploy del backend— en la
  // que la pantalla nueva le pide `_42` a un servidor que todavía contesta
  // `_35`. En esa ventana el gráfico se quedó sin datos EN PRODUCCIÓN: no falló
  // nada, simplemente no venía la clave que se estaba leyendo.
  //
  // Aceptar los dos nombres saca el orden de despliegue del medio. Cuando la
  // versión vieja del backend ya no exista en ningún lado —droplet, PC de
  // contingencia—, el nombre viejo se puede borrar de acá.
  const patientsSeries = viendoOtroMes
    ? mesData?.pacientes_por_dia || []
    : dashboard?.patients_daily_last_42 || dashboard?.patients_daily_last_35 || []
  const weeks = semanasDelMes(mesVisible.anio, mesVisible.mes, patientsSeries)
  // Sólo cuenta si hoy cae en un día del mes que se está mirando: el relleno de
  // la primera semana puede traer días del mes anterior, y mirando septiembre
  // un 30 de agosto esa celda no es "la semana en curso" de septiembre.
  const semanaEnCurso = weeks.findIndex((w) => w.some((c) => c.delMes && c.date === todayKey))
  const [weekIndex, setWeekIndex] = useState(0)
  // AL ABRIR EL INICIO, LA SEMANA EN CURSO.
  //
  // El inicio se abre para ver cómo viene la semana, no cómo arrancó el mes.
  // El índice se reacomoda cuando cambia el mes que se mira, y en el mes en
  // curso cae en la semana de hoy; en un mes cerrado no hay "hoy", así que
  // muestra la última, que es donde terminó de pasar algo.
  useEffect(() => {
    if (weeks.length === 0) return
    setWeekIndex(semanaEnCurso >= 0 ? semanaEnCurso : weeks.length - 1)
    // Depende sólo del mes y de la forma de la grilla, no de `weekIndex`: si
    // dependiera del índice, cada flecha del usuario se desharía sola en el
    // render siguiente.
  }, [mesVisible.anio, mesVisible.mes, weeks.length, semanaEnCurso])
  const activeWeek = weeks[weekIndex] || []
  const goOlderWeek = () => setWeekIndex((prev) => Math.max(0, prev - 1))
  const goNewerWeek = () => setWeekIndex((prev) => Math.min(Math.max(weeks.length - 1, 0), prev + 1))
  // El gesto de deslizar ya no se detecta a mano: la pista scrollea de verdad
  // (`CarruselDeslizable`), así que el dedo, el trackpad y la rueda con Shift
  // hacen lo mismo sin que este componente se entere.
  const weekRangeLabel = (() => {
    // El rango es el de la FILA, de lunes a domingo, no el pedazo que cae
    // dentro del mes: la fila muestra la semana entera —con los días del mes
    // vecino incluidos— y el rótulo tiene que decir lo que se está viendo.
    if (activeWeek.length === 0) return ""
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
    return `${fmt(activeWeek[0].date)} – ${fmt(activeWeek[activeWeek.length - 1].date)}`
  })()
  /**
   * El promedio de la semana que se está mirando.
   *
   * Divide por los días que YA PASARON de esa fila, no por siete: la semana en
   * curso está a medio andar y dividirla por siete la dejaría siempre peor que
   * las cerradas. Es el mismo criterio con el que el backend calcula el del mes
   * —ver `_promedio_de_pacientes_por_dia`—, y por eso los tres números de la
   * tarjeta se pueden comparar entre sí.
   *
   * Se toma la fila entera, con los días del mes vecino incluidos: es lo que se
   * está viendo en pantalla y lo que dice el rótulo del rango.
   */
  const promedioDeLaSemana = (() => {
    const transcurridos = activeWeek.filter((c) => c.dato)
    if (transcurridos.length === 0) return null
    const pacientes = transcurridos.reduce(
      (acc, c) => acc + (c.dato?.patients_served ?? 0), 0,
    )
    return { promedio: pacientes / transcurridos.length, pacientes, dias: transcurridos.length }
  })()

  const promediosDelMes = mesData?.promedio_de_pacientes_por_dia
  const mesAnteriorVisible: MesDisponible =
    mesVisible.mes === 1
      ? { anio: mesVisible.anio - 1, mes: 12 }
      : { anio: mesVisible.anio, mes: mesVisible.mes - 1 }

  // El día abierto en el detalle de caja. null = ninguno.
  const [cajaDelDia, setCajaDelDia] = useState<string | null>(null)

  // LAS BARRAS CRECEN DESDE ABAJO.
  //
  // Se pintan en cero y en el frame siguiente pasan a su altura real; la
  // transición que ya tenían hace el resto. Además de quedar lindo, el
  // movimiento dice de un vistazo cuál es la barra más alta de la semana, que
  // es lo único que se mira en un gráfico de siete días.
  const [dibujado, setDibujado] = useState(false)
  useEffect(() => {
    if (loading) return
    const id = requestAnimationFrame(() => setDibujado(true))
    return () => cancelAnimationFrame(id)
  }, [loading])

  /** La altura de una barra: cero hasta el primer frame después de cargar. */
  const alto = (px: number) => (dibujado ? `${px}px` : "0px")

  // Estos dos SÍ son del mes, así que siguen al mes que se está mirando.
  const insuranceMix = viendoOtroMes
    ? mesData?.obras_sociales || []
    : dashboard?.insurance_mix_month || []
  // Del mes que se está mirando, no de toda la historia: antes, con un mes
  // cerrado elegido, se mostraba el top histórico con el rótulo de ese mes.
  const topUrgent = mesData?.top_urgentes || []
  const missingInfo = dashboard?.missing_info
  const preauth = dashboard?.preauth_breakdown
  const arca = viendoOtroMes ? mesData?.arca : dashboard?.arca_month
  const cash = dashboard?.today_cash_revenue
  const cashBreakdown = cash?.breakdown
  // Caja: cobrado por día, con las mismas semanas de calendario que pacientes.
  const cashSeries = viendoOtroMes
    ? mesData?.caja_por_dia || []
    : dashboard?.cash_daily_last_42 || dashboard?.cash_daily_last_35 || []
  // Mismo criterio que pacientes: las semanas del calendario del mes, no
  // ventanas de siete días. Los dos gráficos están uno al lado del otro y una
  // misma columna tiene que ser el mismo día en los dos.
  const cashWeeks = semanasDelMes(mesVisible.anio, mesVisible.mes, cashSeries)
  const semanaEnCursoCaja = cashWeeks.findIndex((w) => w.some((c) => c.delMes && c.date === todayKey))
  const [cashWeekIndex, setCashWeekIndex] = useState(0)
  useEffect(() => {
    if (cashWeeks.length === 0) return
    setCashWeekIndex(semanaEnCursoCaja >= 0 ? semanaEnCursoCaja : cashWeeks.length - 1)
  }, [mesVisible.anio, mesVisible.mes, cashWeeks.length, semanaEnCursoCaja])
  const goOlderCashWeek = () => setCashWeekIndex((p) => Math.max(0, p - 1))
  const goNewerCashWeek = () => setCashWeekIndex((p) => Math.min(Math.max(cashWeeks.length - 1, 0), p + 1))
  const cashWeekRangeLabel = (() => {
    const semana = cashWeeks[cashWeekIndex] || []
    if (semana.length === 0) return ""
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
    return `${fmt(semana[0].date)} – ${fmt(semana[semana.length - 1].date)}`
  })()
  const formatMoney = (v?: string) => {
    const n = Number.parseFloat(v || "0")
    return Number.isFinite(n) ? `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"
  }

  /** El número chico de cualquier cosa: lo mismo, sobre el tramo comparado. */
  const comparado = (valor: string | number | undefined) =>
    comparacion === undefined ? null : String(valor ?? "—")

  // LAS TARJETAS DE ARRIBA SON LAS DE SIEMPRE, PERO DEL MES.
  //
  // Eran totales de toda la base —"tiempo de resolución" era el promedio
  // histórico— y cambiaban de identidad al mirar un mes cerrado. Ahora las
  // cuatro dicen lo del mes que se está mirando, con el tramo comparado abajo.
  //
  // "Urgentes pendientes" es la única operativa de la fila y por eso no sale
  // con un mes viejo elegido: es una foto de ahora, no algo que haya pasado en
  // junio. Las otras tres son de historial y valen para cualquier mes.
  const mainKpis = [
    {
      label: "Carga promedio",
      value: mesData?.carga_promedio || "—",
      detail: "Del ingreso a que se carga el resultado",
      total: comparado(comparacion?.carga_promedio),
      icon: Clock3,
      className: "border-cyan-200 bg-cyan-50 text-cyan-800",
    },
    {
      label: "Tiempo de resolución",
      value: mesData?.tiempo_de_resolucion || "—",
      detail: "Del ingreso a que el protocolo se cierra",
      total: comparado(comparacion?.tiempo_de_resolucion),
      icon: Clock3,
      className: "border-violet-200 bg-violet-50 text-violet-800",
    },
    ...(viendoOtroMes
      ? []
      : [
          {
            label: "Urgentes pendientes",
            value: numberOrZero(mesData?.urgentes_pendientes).toLocaleString(),
            detail: "Protocolos urgentes sin cerrar",
            total: comparado(numberOrZero(comparacion?.urgentes_pendientes).toLocaleString()),
            icon: AlertTriangle,
            className: "border-rose-200 bg-rose-50 text-rose-800",
          },
        ]),
    ...(canAccessBilling
      ? [
          {
            label: "Listos para facturar",
            value: numberOrZero(mesData?.listos_para_facturar).toLocaleString(),
            detail: "Protocolos con papeles listos",
            total: comparado(numberOrZero(comparacion?.listos_para_facturar).toLocaleString()),
            icon: CheckCircle2,
            className: "border-teal-200 bg-teal-50 text-teal-800",
          },
        ]
      : []),
  ]

  const operationalItems = [
    {
      label: "Resultados por cargar",
      value: numberOrZero(mesData?.resultados_por_cargar),
      total: comparado(numberOrZero(comparacion?.resultados_por_cargar).toLocaleString()),
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "Resultados por validar",
      value: numberOrZero(mesData?.resultados_por_validar),
      total: comparado(numberOrZero(comparacion?.resultados_por_validar).toLocaleString()),
      className: "border-sky-200 bg-sky-50 text-sky-800",
    },
    {
      label: "Impresos con pago incompleto",
      value: numberOrZero(mesData?.impresos_con_pago_incompleto),
      total: comparado(numberOrZero(comparacion?.impresos_con_pago_incompleto).toLocaleString()),
      className: "border-rose-200 bg-rose-50 text-rose-800",
    },
  ]

  const missingItems = [
    {
      label: "En estado Información faltante",
      value: numberOrZero(mesData?.informacion_faltante),
      total: comparado(numberOrZero(comparacion?.informacion_faltante).toLocaleString()),
    },
    { label: "Orden no presentada", value: numberOrZero(missingInfo?.orden_no_trajo) },
    { label: "Orden incompleta", value: numberOrZero(missingInfo?.orden_incompleta) },
    {
      label: "Preautorización pendiente",
      value: numberOrZero(mesData?.preautorizacion_pendiente),
      total: comparado(numberOrZero(comparacion?.preautorizacion_pendiente).toLocaleString()),
    },
    { label: "Pacientes anónimos mes", value: numberOrZero(missingInfo?.anonymous_patients_month) },
  ]

  const preauthTotal =
    numberOrZero(preauth?.completa) + numberOrZero(preauth?.incompleta) + numberOrZero(preauth?.no_trajo)

  // ARCA del mes, con el tramo comparado en cada estado.
  const arcaItems = [
    {
      label: "Facturado",
      value: numberOrZero(arca?.billed),
      total: comparado(numberOrZero(comparacion?.arca?.billed).toLocaleString()),
      className: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pendiente",
      value: numberOrZero(arca?.pending),
      total: comparado(numberOrZero(comparacion?.arca?.pending).toLocaleString()),
      className: "bg-amber-50 text-amber-700",
    },
    {
      label: "Fallido",
      value: numberOrZero(arca?.failed),
      total: comparado(numberOrZero(comparacion?.arca?.failed).toLocaleString()),
      className: "bg-rose-50 text-rose-700",
    },
  ]

  return (
    <div className="w-full py-5">
      <section
        style={retraso(0)}
        className={`mb-5 rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ARRIBA}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[#204983] text-white">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {loading ? (
                <>
                  <Skeleton className="mb-2 h-6 w-56" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : (
                <>
                  <h1 className="truncate text-xl font-semibold text-slate-900">
                    Hola, {user?.first_name || user?.username || "equipo"}
                  </h1>
                  <p className="text-sm text-slate-500">Resumen operativo del laboratorio</p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* EL MES QUE SE ESTÁ MIRANDO.
                El 1° las estadísticas arrancan de cero, que es lo que se
                quiere para operar; la flecha es para que el mes que cerró no
                quede sin ningún lado donde mirarse. */}
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-1">
              <button
                type="button"
                onClick={() => moverMes(-1)}
                disabled={!hayMesAnterior}
                aria-label="Mes anterior"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-[#204983] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <select
                value={mesElegido ? `${mesElegido.anio}-${mesElegido.mes}` : "actual"}
                onChange={(e) => {
                  const valor = e.target.value
                  if (valor === "actual") return setMesElegido(null)
                  const [anio, mes] = valor.split("-").map(Number)
                  setMesElegido(esMesActual(anio, mes) ? null : { anio, mes })
                }}
                aria-label="Mes de las estadísticas"
                className="h-7 min-w-[9.5rem] cursor-pointer rounded bg-transparent px-1 text-sm font-medium text-slate-700 outline-none"
              >
                {mesesOfrecidos.map((m) => (
                  <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
                    {nombreDelMes(m)}
                    {esMesActual(m.anio, m.mes) ? " (en curso)" : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => moverMes(1)}
                disabled={!hayMesSiguiente}
                aria-label="Mes siguiente"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-[#204983] disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Contra qué se compara. Define el número chico de TODA la
                pantalla, no el de una tarjeta. */}
            <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
              Comparar con:
              <select
                value={alcance}
                onChange={(e) => setAlcance(e.target.value)}
                aria-label="Con qué se comparan los números de la pantalla"
                className="cursor-pointer bg-transparent text-xs font-medium text-slate-700 outline-none"
              >
                {ALCANCES.map((a) => (
                  <option key={a.clave} value={a.clave}>
                    {a.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <div className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm ${toneClasses[growthTone]}`}>
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold">
                {growthValue > 0 ? "+" : ""}
                {(viendoOtroMes
                  ? mesData?.crecimiento_porcentaje
                  : dashboard?.protocols_completed_growth_percent) || "0.0%"}
              </span>
              <span>vs. mes anterior</span>
            </div>
          </div>
        </div>
      </section>

      {viendoOtroMes && (
        <p
          style={retraso(1)}
          className={`mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${ENTRADA_ARRIBA}`}
        >
          Estás viendo <strong>{nombreDelMes(mesVisible)}</strong>, un mes que ya
          cerró. Lo que es de ahora —pendientes de carga, caja del día, urgentes
          sin cerrar— no se muestra: no sería de este mes.
        </p>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
          : mainKpis.map((item, indice) => {
              const Icon = item.icon
              return (
                <article
                  key={item.label}
                  style={retraso(indice + 1)}
                  className={`rounded-lg border p-4 shadow-sm ${item.className} ${ENTRADA_ABAJO}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium opacity-80">{item.label}</p>
                      <p className="mt-2 text-3xl font-bold leading-none">{item.value}</p>
                    </div>
                    <Icon className="h-5 w-5 flex-shrink-0 opacity-80" />
                  </div>
                  <p className="text-xs opacity-75">{item.detail}</p>
                  {/* El número chico: lo mismo, sobre el tramo comparado. El de
                      arriba solo no dice si está bien o mal. */}
                  <div className="mt-3 border-t border-current/15 pt-2">
                    {item.total === null ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <p className="text-xs opacity-80">
                        <span className="font-semibold">{item.total}</span> {alcanceElegido.etiqueta}
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section
          style={retraso(5)}
          className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-5 w-5 flex-shrink-0 text-[#204983]" />
              <h2 className="truncate text-base font-semibold text-slate-900">Pacientes atendidos</h2>
              <span className="whitespace-nowrap text-sm text-slate-500">
                <span className="font-semibold text-slate-900">
                  {numberOrZero(mesData?.pacientes).toLocaleString()}
                </span>
                {comparacion && (
                  <span className="ml-1.5 text-xs">
                    · {numberOrZero(comparacion.pacientes).toLocaleString()} {alcanceElegido.etiqueta}
                  </span>
                )}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:inline">
                {weekIndex === semanaEnCurso ? "Semana en curso" : `Semana ${weekIndex + 1} de ${weeks.length}`}
                {weekRangeLabel ? ` · ${weekRangeLabel}` : ""}
              </span>
              {/* PROMEDIOS POR DÍA
                  =================
                  El gráfico muestra una semana a la vez y una semana sola no
                  dice si viene bien o mal. Acá están los tres números que le
                  dan escala: la semana que se está mirando, el mes y el
                  anterior.

                  Va en hover y no fijo en la tarjeta porque no es lo que se
                  mira todos los días: el gráfico ya cuenta la historia, esto
                  contesta la pregunta que aparece después.

                  `group-focus-within` además del hover: con teclado se llega
                  con Tab y se abre igual. */}
              <div className="group relative">
                <button
                  type="button"
                  aria-describedby="promedios-por-dia"
                  className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-[#204983]/40 hover:bg-[#204983]/5 hover:text-[#204983] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204983]/40"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Promedios</span>
                </button>
                <div
                  id="promedios-por-dia"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <p className="mb-2 text-xs font-semibold text-slate-900">
                    Pacientes por día
                  </p>
                  <dl className="space-y-1.5">
                    <FilaDePromedio
                      etiqueta={weekRangeLabel ? `Semana ${weekRangeLabel}` : "Esta semana"}
                      dato={promedioDeLaSemana}
                      destacada
                    />
                    <FilaDePromedio
                      etiqueta={nombreDelMes(mesVisible)}
                      dato={promediosDelMes?.mes ?? null}
                    />
                    <FilaDePromedio
                      etiqueta={nombreDelMes(mesAnteriorVisible)}
                      dato={promediosDelMes?.mes_anterior ?? null}
                    />
                  </dl>
                  <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-500">
                    Sobre los días transcurridos, contando los de cero.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3 flex items-center justify-center gap-1.5">
            {/* Los puntitos van en el orden del mes: el primero es la semana
                del día 1 y el último la que lo cierra. */}
            {weeks.map((_, pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setWeekIndex(pos)}
                aria-label={pos === semanaEnCurso ? "Semana en curso" : `Semana ${pos + 1} del mes`}
                className={`h-1.5 rounded-full transition-all ${
                  pos === weekIndex ? "w-5 bg-[#204983]" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full rounded-md" />
          ) : (
            <div className="flex items-stretch gap-1 sm:gap-2">
              <button
                type="button"
                onClick={goOlderWeek}
                disabled={weekIndex === 0}
                aria-label="Semana anterior"
                className="flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#204983] disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {/* La pista va en el orden del mes, igual que `weekIndex`: la
                  primera semana a la izquierda, la que lo cierra a la derecha. */}
              <CarruselDeslizable
                ariaLabel="Semanas de pacientes atendidos"
                activo={weekIndex}
                onActivo={(pos) => setWeekIndex(pos)}
              >
                <>
                  {weeks.map((week, wIdx) => {
                    // El máximo sale sólo de los días que ya pasaron: si contara
                    // los futuros como cero no cambiaría nada, pero deja claro
                    // que la escala es de lo medido.
                    const maxForWeek = Math.max(1, ...week.map((c) => c.dato?.patients_served ?? 0))
                    return (
                      // MEDIO HUECO DE PADDING A CADA LADO.
                      //
                      // Los paneles van pegados: sin esto la última barra de una
                      // semana toca la primera de la siguiente, y como el ancho de
                      // la pista sale de restar las flechas —casi nunca da entero—
                      // el redondeo subpíxel deja asomar una tajada de la barra
                      // vecina en el borde. Con medio hueco de cada lado, la
                      // separación entre semanas es la misma que entre dos barras.
                      <div key={wIdx} className="flex h-64 w-full shrink-0 snap-center flex-col px-[3px] sm:px-1.5">
                        <div className="flex flex-1 items-end gap-1.5 sm:gap-3">
                          {week.map((celda) => {
                            const isToday = celda.date === todayKey
                            const value = celda.dato?.patients_served ?? null
                            // Día de un mes vecino: se dibuja, porque la fila
                            // es una semana y la semana se mira entera, pero en
                            // gris para que se vea que no es del mes.
                            const deOtroMes = !celda.delMes
                            // Día que todavía no pasó: la columna queda marcada
                            // pero vacía, para que la semana se lea completa de
                            // lunes a domingo sin inventar un cero.
                            if (value === null) {
                              return (
                                <div key={celda.date} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                                  <span className="mb-1 text-xs font-semibold text-slate-300">–</span>
                                  <div
                                    className="flex w-full items-end rounded-md border border-dashed border-slate-200 px-1 sm:px-1.5"
                                    style={{ height: "176px" }}
                                    title="Todavía no pasó"
                                  />
                                </div>
                              )
                            }
                            return (
                              <div key={celda.date} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                                <span
                                  className={`mb-1 text-xs font-semibold ${
                                    isToday ? "text-[#204983]" : deOtroMes ? "text-slate-400" : "text-slate-700"
                                  }`}
                                >
                                  {value}
                                </span>
                                <div
                                  className={`flex w-full items-end rounded-md px-1 sm:px-1.5 ${
                                    isToday ? "bg-amber-100/70 ring-1 ring-amber-300" : "bg-slate-100/80"
                                  }`}
                                  style={{ height: "176px" }}
                                >
                                  <div
                                    className={`w-full rounded-t-md motion-safe:transition-all motion-safe:duration-500 ${
                                      isToday ? "bg-amber-500" : deOtroMes ? "bg-slate-300" : "bg-[#204983]"
                                    }`}
                                    style={{ height: alto(Math.max(6, (value / maxForWeek) * 168)) }}
                                    title={`${value} paciente${value === 1 ? "" : "s"}${
                                      isToday ? " (hoy)" : deOtroMes ? " (del mes vecino)" : ""
                                    }`}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex gap-1.5 sm:gap-3">
                          {week.map((celda) => {
                            const dateObj = new Date(`${celda.date}T00:00:00`)
                            const weekday = dateObj.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")
                            const day = dateObj.toLocaleDateString("es-AR", { day: "2-digit" })
                            const isToday = celda.date === todayKey
                            const futuro = celda.dato === null
                            return (
                              <div
                                key={celda.date}
                                className={`flex min-w-0 flex-1 flex-col items-center leading-tight ${
                                  isToday
                                    ? "font-semibold text-[#204983]"
                                    : futuro || !celda.delMes
                                      ? "text-slate-300"
                                      : "text-slate-500"
                                }`}
                              >
                                <span className="text-[10px] capitalize sm:text-[11px]">{isToday ? "Hoy" : weekday}</span>
                                <span className="text-[10px] sm:text-[11px]">{day}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              </CarruselDeslizable>
              <button
                type="button"
                onClick={goNewerWeek}
                disabled={weekIndex >= weeks.length - 1}
                aria-label="Semana siguiente"
                className="flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#204983] disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </section>

        {/* LO QUE ES DE AHORA NO SE MUESTRA DE UN MES CERRADO.
            "Pendientes de carga" es una foto del momento, no algo que haya
            pasado en junio: mostrarlo con un mes viejo elegido haría creer que
            son los pendientes de ese mes. */}
        {!viendoOtroMes && (
        <section
          style={retraso(6)}
          className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">Pendientes operativos</h2>
          </div>
          <div className="grid gap-3">
            {loading
              ? Array.from({ length: canAccessBilling ? 4 : 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-md" />
                ))
              : operationalItems.map((item) => (
                  <div key={item.label} className={`rounded-md border px-4 py-3 ${item.className}`}>
                    <p className="text-2xl font-bold leading-none">{item.value.toLocaleString()}</p>
                    <p className="mt-1 text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs opacity-75">
                      {item.total === null ? "…" : `${item.total} ${alcanceElegido.etiqueta}`}
                    </p>
                  </div>
                ))}
          </div>
        </section>
        )}
      </div>

      {/* Lo que quedó sin cerrar de TODAS las fechas: nos deben y tenemos que
          devolver. Va arriba de la caja del día, que cuenta solo lo de hoy. */}
      {canAccessBilling && !viendoOtroMes ? (
        <div className="mt-5">
          <PendienteDelSistema comparacion={comparacion} alcance={alcanceElegido.etiqueta} />
        </div>
      ) : null}

      <section
        style={retraso(7)}
        className={`mt-5 rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">Caja (pacientes)</h2>
          </div>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {cashWeekIndex === semanaEnCursoCaja
              ? "Semana en curso"
              : `Semana ${cashWeekIndex + 1} de ${cashWeeks.length}`}
            {cashWeekRangeLabel ? ` · ${cashWeekRangeLabel}` : ""}
          </span>
        </div>
        {/* Lo cobrado en el mes, con su comparación. Las dos tarjetas de abajo
            cuentan lo de HOY, que es otra pregunta: esta línea es la del mes
            que se está mirando. */}
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">Cobrado en el mes: </span>
          <span className="font-semibold text-slate-900">{formatMoney(mesData?.cobrado)}</span>
          {comparacion && (
            <span className="ml-2 text-xs text-slate-500">
              {formatMoney(comparacion.cobrado)} {alcanceElegido.etiqueta}
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-md" />
        ) : (
          <>
            {/* Cobrado por día, una semana de calendario por pantalla */}
            <div className="mb-4 flex items-stretch gap-1 sm:gap-2">
              <button
                type="button"
                onClick={goOlderCashWeek}
                disabled={cashWeekIndex === 0}
                aria-label="Semana anterior"
                className="flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <CarruselDeslizable
                ariaLabel="Semanas de caja"
                activo={cashWeekIndex}
                onActivo={(pos) => setCashWeekIndex(pos)}
              >
                <>
                  {cashWeeks.map((week, wIdx) => {
                    const maxCash = Math.max(
                      1,
                      ...week.map((c) => Number.parseFloat(c.dato?.collected || "0")),
                    )
                    return (
                      // Medio hueco a cada lado, igual que en pacientes: los
                      // paneles van pegados y sin esto la barra del borde se
                      // mezcla con la de la semana vecina.
                      <div key={wIdx} className="flex h-40 w-full shrink-0 snap-center flex-col px-[3px] sm:px-1.5">
                        <div className="flex flex-1 items-end gap-1.5 sm:gap-3">
                          {week.map((celda) => {
                            // Igual que en pacientes: los días del mes vecino
                            // que completan la semana se dibujan, apagados.
                            const deOtroMes = !celda.delMes
                            const isToday = celda.date === todayKey
                            // Día que todavía no pasó: no hay caja que abrir, así
                            // que no es un botón. Queda la columna marcada.
                            if (celda.dato === null) {
                              return (
                                <div key={celda.date} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                                  <div
                                    className="w-full rounded-md border border-dashed border-slate-200"
                                    style={{ height: "104px" }}
                                    title="Todavía no pasó"
                                  />
                                </div>
                              )
                            }
                            const value = Number.parseFloat(celda.dato.collected || "0")
                            return (
                              <button
                                key={celda.date}
                                type="button"
                                onClick={() => setCajaDelDia(celda.date)}
                                aria-label={`Ver el detalle de la caja del ${celda.date}`}
                                className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                              >
                                <div
                                  className={`flex w-full items-end rounded-md transition-colors ${isToday ? "bg-amber-100/70 ring-1 ring-amber-300" : "bg-slate-100/80"} group-hover:bg-slate-200/90`}
                                  style={{ height: "104px" }}
                                  title={`${formatMoney(celda.dato.collected)}${
                                    isToday ? " (hoy)" : deOtroMes ? " (del mes vecino)" : ""
                                  } — tocá para ver el detalle`}
                                >
                                  <div
                                    className={`w-full rounded-t-md motion-safe:transition-all motion-safe:duration-500 ${
                                      isToday ? "bg-amber-500" : deOtroMes ? "bg-emerald-200" : "bg-emerald-500"
                                    } group-hover:brightness-110`}
                                    style={{ height: alto(Math.max(4, (value / maxCash) * 100)) }}
                                  />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex gap-1.5 sm:gap-3">
                          {week.map((celda) => {
                            const dateObj = new Date(`${celda.date}T00:00:00`)
                            const weekday = dateObj.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")
                            const day = dateObj.toLocaleDateString("es-AR", { day: "2-digit" })
                            const isToday = celda.date === todayKey
                            const futuro = celda.dato === null
                            return (
                              <div
                                key={celda.date}
                                className={`flex min-w-0 flex-1 flex-col items-center leading-tight ${
                                  isToday
                                    ? "font-semibold text-emerald-700"
                                    : futuro || !celda.delMes
                                      ? "text-slate-300"
                                      : "text-slate-500"
                                }`}
                              >
                                <span className="text-[10px] capitalize sm:text-[11px]">{isToday ? "Hoy" : weekday}</span>
                                <span className="text-[10px] sm:text-[11px]">{day}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              </CarruselDeslizable>
              <button
                type="button"
                onClick={goNewerCashWeek}
                disabled={cashWeekIndex >= cashWeeks.length - 1}
                aria-label="Semana siguiente"
                className="flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {/* Dos tarjetas y no tres: acá se cuenta lo de HOY.
                El total pendiente de todas las fechas estaba metido en el medio
                de la caja del día, mezclando dos cosas distintas en la misma
                fila. Ese número vive arriba, en su propia sección. */}
            {!viendoOtroMes && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-medium text-emerald-700">Cobrado hoy</p>
                <p className="mt-1 text-2xl font-bold text-emerald-800 sm:text-lg md:text-xl lg:text-2xl">{formatMoney(cash?.total_paid)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-600">A cobrar hoy</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 sm:text-lg md:text-xl lg:text-2xl">{formatMoney(cash?.total_due)}</p>
              </div>
              {cashBreakdown && (
                <div className="sm:col-span-2 grid grid-cols-1 gap-1.5 rounded-md bg-slate-50 px-3 py-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                  <CashBreakdownItem label="Particulares" amount={formatMoney(cashBreakdown.analyses_amount_due)} />
                  <CashBreakdownItem label="Coseguro" amount={formatMoney(cashBreakdown.coseguro)} />
                  <CashBreakdownItem label="Material" amount={formatMoney(cashBreakdown.material_descartable)} />
                  <CashBreakdownItem label="Derivación" amount={formatMoney(cashBreakdown.derivacion)} />
                  <CashBreakdownItem label="Cobros extra" amount={formatMoney(cashBreakdown.unplanned_charges)} />
                  <CashBreakdownItem label="Pagos extra" amount={formatMoney(cashBreakdown.unplanned_payments_today)} />
                </div>
              )}
            </div>
            )}
          </>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {!viendoOtroMes && (
        <section
          style={retraso(8)}
          className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">Información faltante</h2>
          </div>
          <MetricList items={missingItems} loading={loading} alcance={alcanceElegido.etiqueta} />
        </section>
        )}

        {!viendoOtroMes && (
        <section
          style={retraso(9)}
          className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Preautorizaciones</h2>
          </div>
          {loading ? (
            <Skeleton className="h-32 w-full rounded-md" />
          ) : (
            <div className="space-y-3">
              <PreauthBar label="Completas" value={numberOrZero(preauth?.completa)} total={preauthTotal} className="bg-emerald-500" />
              <PreauthBar label="Incompletas" value={numberOrZero(preauth?.incompleta)} total={preauthTotal} className="bg-amber-500" />
              <PreauthBar label="No presentadas" value={numberOrZero(preauth?.no_trajo)} total={preauthTotal} className="bg-rose-500" />
            </div>
          )}
        </section>
        )}

        {/* ARCA es operativa: lo que falta facturar es de ahora, así que no
            sale con un mes viejo elegido. */}
        {!viendoOtroMes && (
        <section
          style={retraso(10)}
          className={`rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-sky-600" />
            <h2 className="text-base font-semibold text-slate-900">ARCA del mes</h2>
          </div>
          <div className="grid gap-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-md" />)
              : arcaItems.map((item) => (
                  <div key={item.label} className={`flex items-center justify-between rounded-md px-3 py-2 ${item.className}`}>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-right">
                      <span className="text-xl font-bold">{item.value.toLocaleString()}</span>
                      <span className="ml-2 text-xs opacity-70">
                        {item.total === null ? "…" : `${item.total} ${alcanceElegido.etiqueta}`}
                      </span>
                    </span>
                  </div>
                ))}
          </div>
        </section>
        )}
      </div>

      <section
        style={retraso(11)}
        className={`mt-5 rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
      >
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-semibold text-slate-900">Obras sociales del mes</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : insuranceMix.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {insuranceMix.map((insurance) => (
              <div key={insurance.insurance_id} className="rounded-md border border-teal-100 bg-teal-50 px-3 py-3 text-teal-800">
                <p className="truncate text-sm font-semibold" title={insurance.name}>
                  {insurance.name}
                </p>
                <p className="mt-2 text-2xl font-bold leading-none">{insurance.protocols.toLocaleString()}</p>
                <p className="mt-1 text-xs text-teal-700">protocolos</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Sin protocolos de obras sociales este mes
          </p>
        )}
      </section>

      {/* Los urgentes que más se repitieron: es de historial, así que vale para
          cualquier mes y se muestra también con uno cerrado elegido. */}
      <section
        style={retraso(12)}
        className={`mt-5 rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO}`}
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <h2 className="text-base font-semibold text-slate-900">Top 3 análisis urgentes</h2>
          <span className="text-xs text-slate-500">en más protocolos</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : topUrgent.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topUrgent.map((a, idx) => (
              <div key={a.code} className="flex items-center gap-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-3 text-rose-900">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-200 text-sm font-bold text-rose-800">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" title={a.name}>{a.name}</p>
                  <p className="text-xs text-rose-700">{a.protocols.toLocaleString()} protocolos · cód. {a.code}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No hay análisis urgentes con protocolos.
          </p>
        )}
      </section>


      {/* El detalle de un día, al tocar su barra en el gráfico de caja. */}
      <CajaDelDia fecha={cajaDelDia} onClose={() => setCajaDelDia(null)} />
    </div>
  )
}

// El importe no tiene espacios, así que nunca puede cortarse en dos líneas:
// se lleva shrink-0 y el que cede espacio es el label.
function CashBreakdownItem({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <span className="truncate text-slate-500" title={label}>{label}</span>
      <span className="shrink-0 font-semibold">{amount}</span>
    </div>
  )
}

function MetricSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-3 w-40" />
    </div>
  )
}

function MetricList({
  items,
  loading,
  alcance,
}: {
  /** `total` es el mismo dato sobre el tramo comparado; sin él, la fila va sola. */
  items: Array<{ label: string; value: number; total?: string | null }>
  loading: boolean
  alcance?: string
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-600">{item.label}</span>
          <span className="text-right">
            <span className="text-sm font-bold text-slate-900">{item.value.toLocaleString()}</span>
            {item.total !== undefined && (
              <span className="ml-2 text-xs text-slate-500">
                {item.total === null ? "…" : `${item.total} ${alcance ?? ""}`}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function PreauthBar({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const width = total > 0 ? Math.max(4, (value / total) * 100) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>

  )
}
