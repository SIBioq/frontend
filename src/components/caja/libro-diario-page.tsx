import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import {
  ArrowDownWideNarrow, Banknote, BookOpen, CalendarOff, ChevronDown, Landmark, Plus, Search,
  Trash2, X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { ANALYTICS_ENDPOINTS, PROTOCOL_ENDPOINTS } from "@/config/api"
import { useApiQuery } from "@/hooks/use-api-query"
import { useDebounce } from "@/hooks/use-debounce"
import { BILLING_ENDPOINTS } from "@/config/api"
import useAuth from "@/contexts/auth-context"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { PERMISSIONS } from "@/config/permissions"
import { formatApiError } from "@/lib/api-error"
import { FormaDePagoDialog } from "@/components/protocolos/components/dialogs/forma-de-pago-dialog"
import { CorreccionDelCobro } from "./correccion-del-cobro"
import { MovimientoDeCajaDialog } from "./movimiento-de-caja-dialog"

/**
 * El libro diario: cada movimiento de plata del sistema, en orden.
 *
 * Se arma del ledger de auditoría, no de una tabla propia. Por eso el libro
 * nace con TODO lo que ya pasó en vez de empezar vacío el día que se escribió
 * esta pantalla, y por eso no hace falta que nadie se acuerde de registrar un
 * movimiento: si tocó plata, el ledger ya lo tiene.
 */

/**
 * Una fila del libro: un PROTOCOLO con todos sus cobros, o un gasto suelto.
 *
 * Antes era una fila por movimiento: un protocolo cobrado en tres veces dejaba
 * tres líneas, cada una con un pedazo y ninguna con la foto entera. Para saber
 * si el paciente quedó debiendo había que sumarlas a mano.
 */
type FilaAgrupada = {
  id: string
  protocolo?: number
  paciente?: string
  estado?: string
  /** La del último pago: es cuando se tocó por última vez. */
  momento: string
  total: string
  pagado?: string
  debe_el_paciente?: string
  debe_el_laboratorio?: string
  pagos?: PagoEnLibro[]
  /** Solo en los gastos e ingresos cargados a mano. */
  tipo_de_movimiento?: string
  forma_de_pago?: string
  cuenta_de_cobro?: string
  cuenta_alias?: string
  fuera_de_rango?: boolean
  movimiento_de_caja_id?: number
  detalle?: string
  usuario?: string
  registrado_por?: string
}

/** Un pago del protocolo, tal como lo manda el libro. */
type PagoEnLibro = {
  id: number
  tipo: "pago" | "devolucion"
  monto: string
  momento?: string
  forma_de_pago: string
  cuenta_de_cobro_id: number | null
  cuenta_de_cobro: string
  cuenta_alias: string
  registrado_por?: string
}

type Respuesta = {
  movimientos: FilaAgrupada[]
  hay_mas: boolean
  desde: string | null
  hasta: string | null
  /** Lo que se buscó, tal como lo aplicó el backend. `null` si no se buscó. */
  buscar: string | null
  /** Con cuál de los dos órdenes respondió el backend. */
  orden: Orden
}

/** Cómo se ordenan las filas. Los mismos dos valores que acepta el endpoint. */
type Orden = "fecha" | "protocolo"

const plata = (valor: string | undefined) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number.parseFloat(valor || "0"))

const cuando = (iso: string) => {
  const fecha = new Date(iso)
  return {
    dia: fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    hora: fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  }
}

const hoyISO = () => {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, "0")
  const dia = String(ahora.getDate()).padStart(2, "0")
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

const haceDias = (dias: number) => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

const montoNumerico = (valor?: string) => {
  const numero = Number.parseFloat(valor ?? "")
  return Number.isFinite(numero) ? numero : 0
}

const autorInformado = (autor?: string) => autor?.trim() || "No informado"

const textoMedioDePago = (
  forma: string | undefined,
  cuenta?: string,
  alias?: string,
) => {
  if (forma === "transferencia") {
    const detalle = [cuenta, alias].filter(Boolean).join(" · ")
    return detalle ? `Transferencia · ${detalle}` : "Transferencia · cuenta no informada"
  }
  if (forma === "efectivo") return "Efectivo"
  return "Medio sin especificar"
}

/** Desglosa movimientos reales, sin netear una devolución contra un cobro. */
function resumirFlujos(movimientos: FilaAgrupada[]) {
  const flujos = movimientos.flatMap((fila) =>
    fila.protocolo && fila.pagos?.length
      ? fila.pagos.map((pago) => ({
          monto: (pago.tipo === "devolucion" ? -1 : 1) * montoNumerico(pago.monto),
          forma: pago.forma_de_pago,
          cuenta: pago.cuenta_de_cobro,
          alias: pago.cuenta_alias,
        }))
      : [{
          monto: montoNumerico(fila.total),
          forma: fila.forma_de_pago ?? "",
          cuenta: fila.cuenta_de_cobro,
          alias: fila.cuenta_alias,
        }],
  )

  const totales = flujos.reduce(
    (totales, flujo) => {
      const detalle = textoMedioDePago(flujo.forma, flujo.cuenta, flujo.alias)
      const importe = Math.abs(flujo.monto)
      if (flujo.monto > 0) {
        totales.entradas += flujo.monto
        if (flujo.forma === "efectivo") totales.efectivo += flujo.monto
        else if (flujo.forma === "transferencia") totales.transferencia += flujo.monto
        else totales.sinEspecificar += flujo.monto
        totales.entradasPorOrigen.set(detalle, (totales.entradasPorOrigen.get(detalle) ?? 0) + importe)
      } else {
        totales.salidas += flujo.monto
        totales.salidasPorOrigen.set(detalle, (totales.salidasPorOrigen.get(detalle) ?? 0) + importe)
      }
      return totales
    },
    {
      entradas: 0, efectivo: 0, transferencia: 0, sinEspecificar: 0, salidas: 0,
      entradasPorOrigen: new Map<string, number>(),
      salidasPorOrigen: new Map<string, number>(),
    },
  )
  const listar = (origenes: Map<string, number>) =>
    Array.from(origenes, ([titulo, valor]) => ({ titulo, valor: plata(String(valor)) }))
  return {
    ...totales,
    entradasDetalle: listar(totales.entradasPorOrigen),
    salidasDetalle: listar(totales.salidasPorOrigen),
  }
}

export default function LibroDiarioPage() {
  const { hasPermission } = useAuth()
  const { apiRequest } = useApi()
  const toastActions = useToast()
  // `?protocolo=` llega desde "Ver en libro diario" del detalle. NO filtra: el
  // libro sigue siendo el libro, con su rango de fechas y todo lo demás. Lo que
  // hace es señalar esa fila —resaltada y desplegada— y garantizar que esté
  // aunque el protocolo sea de hace meses y el rango no lo alcance.
  const [searchParams, setSearchParams] = useSearchParams()
  const protocoloCrudo = searchParams.get("protocolo")
  const protocoloSenalado = protocoloCrudo ? Number(protocoloCrudo) : null

  const [desde, setDesde] = useState(haceDias(7))
  const [hasta, setHasta] = useState(hoyISO())
  const [fechasActivas, setFechasActivas] = useState(true)
  // LA BÚSQUEDA VA AL BACKEND, NO SE FILTRA ACÁ
  //
  // El rango de fechas puede tener más movimientos que los que entran en la
  // pantalla (el backend corta en un tope y lo avisa). Filtrando lo que ya
  // llegó, buscar un apellido de hace tres semanas no lo encontraría aunque
  // esté dentro del rango — y el vacío se leería como "no hay", que es la
  // respuesta equivocada.
  //
  // Con debounce porque cada tecla sería una consulta al libro entero.
  const [buscado, setBuscado] = useState("")
  const buscar = useDebounce(buscado.trim(), 300)
  // POR FECHA DE ARRANQUE
  //
  // El libro es un registro cronológico: lo primero que se hace con él es
  // mirar qué pasó hoy, y conciliar la caja pide recorrer los movimientos en
  // el orden en que ocurrieron. Por protocolo sirve para otra cosa —revisar
  // una tanda, con los de una jornada juntos y en orden— y por eso se elige.
  //
  // Reordena en el backend, no acá: las filas que llegan son las del rango con
  // el tope de la pantalla, así que ordenarlas en el navegador daría el orden
  // correcto de un recorte elegido por fecha.
  const [orden, setOrden] = useState<Orden>("fecha")
  const [agregando, setAgregando] = useState(false)
  // Qué pago se está corrigiendo, y de qué protocolo. `null` = cerrado.
  const [corrigiendo, setCorrigiendo] = useState<
    { protocolo: number; pago: PagoEnLibro } | null
  >(null)

  // Corregir la forma de pago es arreglar un dato de algo que ya pasó, y va
  // con el permiso del libro: quien tiene la pantalla abierta ya vio ese
  // movimiento y es quien nota que está mal.
  //
  // Cargar un gasto es otra cosa —mete plata nueva en la caja— y sigue
  // pidiendo el permiso de facturación, que es lo que exige el backend. Sin
  // él, el botón tampoco aparece.
  const puedeCorregir = hasPermission(PERMISSIONS.MANAGE_LEDGER.codename)
  const puedeCargarMovimientos = hasPermission(PERMISSIONS.MANAGE_BILLING.codename)

  const consulta = useApiQuery<Respuesta>({
    queryKey: ["analytics", "libro-diario", desde, hasta, fechasActivas, protocoloSenalado, buscar, orden],
    // Siempre agrupado: una fila por protocolo con la fecha de su último pago.
    // El detalle de cada cobro se abre en la fila.
    url:
      `${ANALYTICS_ENDPOINTS.LIBRO_DIARIO}?agrupado=protocolo` +
      (fechasActivas && !buscar ? `&desde=${desde}&hasta=${hasta}` : "") +
      (protocoloSenalado ? `&protocolo=${protocoloSenalado}` : "") +
      (buscar ? `&buscar=${encodeURIComponent(buscar)}` : "") +
      `&orden=${orden}`,
    staleTime: 30 * 1000,
  })

  const movimientos = consulta.data?.movimientos || []

  const anular = async (id: number) => {
    const respuesta = await apiRequest(BILLING_ENDPOINTS.MOVIMIENTO_DE_CAJA(id), {
      method: "DELETE",
    })
    if (respuesta.ok) {
      toastActions.success("Movimiento anulado")
      consulta.refetch()
      return
    }
    toastActions.error("No se pudo anular el movimiento")
  }

  /**
   * Corregir cómo entró UN cobro, sin salir del libro.
   *
   * Se corrige acá porque el error aparece acá: quien concilia ve una
   * transferencia que el extracto no tiene, y antes tenía que anotarse el
   * protocolo, buscarlo en otra pantalla y volver.
   *
   * Y se corrige el PAGO, no el protocolo: el paciente pudo dejar una parte en
   * efectivo y transferir el resto, y arreglar la transferencia no puede tocar
   * el efectivo que estaba bien.
   *
   * TAMBIÉN SE CORRIGE EL MONTO
   * ===========================
   * Si al ingreso se tipeó 5000 en vez de 500, arreglarlo con una devolución
   * de 4500 deja en el libro una devolución que nunca pasó — y al conciliar
   * aparece plata saliendo del cajón que nadie sacó. Acá se corrige el número
   * que se cargó mal, y el backend recalcula solo el total del protocolo, su
   * saldo y su estado de pago.
   *
   * La corrección deja su propia línea en el libro, porque cambia `value_paid`
   * y eso genera un evento: no se pisa el pasado en silencio.
   *
   * Ojo con lo que sigue siendo cierto: el libro muestra la forma de HOY, no
   * la del momento del movimiento. Corregirla cambia también lo que se ve en
   * las líneas viejas de ese mismo protocolo.
   */
  const corregirFormaDePago = async (
    forma: string, cuentaId: string, monto?: string,
  ) => {
    if (!corrigiendo) return false

    const respuesta = await apiRequest(
      PROTOCOL_ENDPOINTS.PROTOCOL_PAGO(corrigiendo.protocolo, corrigiendo.pago.id),
      {
        method: "PATCH",
        body: {
          payment_method: forma,
          // Un efectivo con cuenta lo rechaza el backend, y mandar la vieja
          // guardaría algo que contradice lo que se ve en pantalla.
          payment_account: forma === "transferencia" && cuentaId ? Number(cuentaId) : null,
          ...(monto !== undefined ? { amount: monto } : {}),
        },
      },
    )
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}))
      toastActions.error("No se pudo corregir el cobro", {
        description: formatApiError(datos, "Revisá el monto y la forma de pago."),
      })
      return false
    }

    toastActions.success("Cobro corregido", {
      description: "El total del protocolo y su saldo se recalcularon.",
    })
    setCorrigiendo(null)
    consulta.refetch()
    return true
  }

  // `?protocolo=` puede añadir una fila fuera del rango sólo para señalarla.
  // No debe inflar los totales del período, incluso si su último pago coincide
  // con el rango pero quedó fuera del recorte de la lista.
  const movimientosDelResumen = movimientos.filter((fila) => !fila.fuera_de_rango)
  const { entradas, salidas, entradasDetalle, salidasDetalle } =
    resumirFlujos(movimientosDelResumen)

  // UNA FILA POR PROTOCOLO, QUE SE ABRE
  //
  // Se dejó la tabla por una lista: la fila tiene que poder desplegar el
  // detalle completo abajo, y una tabla con una celda que ocupa todo el ancho
  // y cambia de alto es una tabla peleando contra lo que se le pide.
  const [abierta, setAbierta] = useState<string | null>(null)
  const [senalada, setSenalada] = useState<string | null>(null)

  // La fila señalada se abre sola: el clic de más es justo el que nadie
  // entiende que hay que dar cuando ya vino de un botón que decía a dónde iba.
  useEffect(() => {
    if (!protocoloSenalado) return
    const id = `protocolo-${protocoloSenalado}`
    setAbierta(id)
    setSenalada(id)
  }, [protocoloSenalado])

  /**
   * Abrir o cerrar una fila, y soltar el resaltado.
   *
   * El resaltado sirve para encontrar la fila al llegar desde el protocolo.
   * Una vez que alguien tocó una —la cerró o abrió otra— ya la encontró, y
   * dejarlo prendido convierte una ayuda momentánea en una marca que no se
   * apaga y que después confunde con la fila que sí se está mirando.
   *
   * Se saca también el `?protocolo=` de la URL para que recargar no lo traiga
   * de vuelta. `replace` para no llenar el historial con estados intermedios.
   */
  const alternar = (id: string) => {
    setAbierta((a) => (a === id ? null : id))
    setSenalada(null)
    if (protocoloSenalado) setSearchParams({}, { replace: true })
  }

  return (
    <div className="w-full py-4">
      <div className="rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-sm md:p-6">
        {/* Fila superior: título · rango de fechas · atajos.
            Misma caja blanca y mismo esqueleto que Pacientes, Protocolos y
            Facturación. Antes esta pantalla ponía sus cosas sueltas sobre el
            fondo y por eso se leía distinta del resto del sistema. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="lg:w-64 lg:shrink-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-800 md:text-2xl">
              <BookOpen className="h-5 w-5 text-[#204983]" />
              Libro diario
            </h1>
            <p className="text-sm text-gray-500">
              {movimientos.length === 0
                ? "Cada movimiento de plata, en orden"
                : buscar
                  // Con una búsqueda activa los totales de abajo son los de lo
                  // que coincide, no los del período: decirlo evita leer un
                  // "Entró" recortado como si fuera el del rango entero.
                  ? `${movimientos.length} movimientos coinciden con «${buscar}»`
                  : `${movimientos.length} movimientos`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Un solo control para el rango: los dos extremos se eligen sobre
                el mismo calendario, viendo el camino entre ellos, y no queda
                forma de dejar un "hasta" anterior al "desde". */}
            <DateRangePicker
              desde={desde}
              hasta={hasta}
              onChange={(nuevoDesde, nuevoHasta) => {
                setDesde(nuevoDesde)
                setHasta(nuevoHasta)
              }}
              max={hoyISO()}
              className={`w-full sm:w-[17rem] ${!fechasActivas || buscar ? "opacity-50" : ""}`}
              atajos={[
                { label: "Hoy", desde: hoyISO(), hasta: hoyISO() },
                { label: "Últimos 7 días", desde: haceDias(7), hasta: hoyISO() },
                { label: "Últimos 30 días", desde: haceDias(30), hasta: hoyISO() },
              ]}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFechasActivas((activa) => !activa)}
              title={fechasActivas ? "Desactivar filtro de fechas" : "Activar filtro de fechas"}
              className="h-9"
            >
              <CalendarOff className="mr-1 h-4 w-4" />
              {fechasActivas ? "Sin fechas" : "Usar fechas"}
            </Button>

            {/* La barra: número de protocolo o paciente, sin elegir cuál. En el
                mostrador llega cualquiera de los dos y pedirle a la persona que
                elija el modo es hacerle resolver a ella una ambigüedad que la
                base resuelve sola. */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={buscado}
                onChange={(evento) => setBuscado(evento.target.value)}
                placeholder="Protocolo, paciente o descripción…"
                aria-label="Buscar en el libro diario"
                autoComplete="off"
                spellCheck={false}
                className="h-9 pl-9 pr-9"
              />
              {buscado ? (
                <button
                  type="button"
                  onClick={() => setBuscado("")}
                  aria-label="Limpiar la búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <Select value={orden} onValueChange={(valor) => setOrden(valor as Orden)}>
              <SelectTrigger
                className="h-9 w-full sm:w-44"
                aria-label="Ordenar el libro"
              >
                <ArrowDownWideNarrow className="mr-1 h-4 w-4 shrink-0 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fecha">Por fecha</SelectItem>
                <SelectItem value="protocolo">Por protocolo</SelectItem>
              </SelectContent>
            </Select>

            {puedeCargarMovimientos ? (
              <Button
                size="sm"
                onClick={() => setAgregando(true)}
                className="bg-[#204983] hover:bg-[#1a3d6f]"
              >
                <Plus className="mr-1 h-4 w-4" />
                Gasto o ingreso
              </Button>
            ) : null}
          </div>
        </div>

        {senalada ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#204983]/30 bg-[#204983]/5 px-3 py-2 text-sm">
              <span className="text-[#204983]">
                Señalado el <strong>protocolo #{protocoloSenalado}</strong>. Si quedó
                fuera del rango de fechas, se muestra igual.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white"
                onClick={() => setSearchParams({})}
              >
                Quitar el resaltado
              </Button>
            </div>

          </div>
        ) : null}

        {!consulta.isLoading && movimientos.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Resumen
              titulo="Entró"
              valor={plata(String(entradas))}
              tono="entra"
              desglose={entradasDetalle}
            />
            <Resumen
              titulo="Salió"
              valor={plata(String(salidas))}
              tono="sale"
              desglose={salidasDetalle}
            />
            <Resumen titulo="Neto" valor={plata(String(entradas + salidas))} tono="neto" />
          </div>
        ) : null}

        {consulta.error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudo traer el libro diario. Probá de nuevo.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {consulta.isLoading && movimientos.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
            ) : movimientos.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                {buscar
                  ? `Ningún movimiento coincide con «${buscar}» en estas fechas. Probá con un rango más amplio, o con el apellido o el número de protocolo.`
                  : "No hubo movimientos de plata en estas fechas. Probá con un rango más amplio."}
              </p>
            ) : (
              movimientos.map((fila) => {
                const momento = cuando(fila.momento)
                const total = Number.parseFloat(fila.total)
                const debePaciente = Number.parseFloat(fila.debe_el_paciente || "0")
                const debeLab = Number.parseFloat(fila.debe_el_laboratorio || "0")
                const esProtocolo = Boolean(fila.protocolo)
                const estaAbierta = abierta === fila.id

                return (
                  <div
                    key={fila.id}
                    className={`rounded-lg border transition ${
                      fila.id === senalada
                        ? "border-[#204983] bg-[#204983]/5 ring-2 ring-[#204983]/30"
                        : estaAbierta
                          ? "border-[#204983] bg-[#204983]/5"
                          : "border-gray-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => (esProtocolo ? alternar(fila.id) : undefined)}
                      className={`flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-3 text-left ${
                        esProtocolo ? "cursor-pointer hover:bg-gray-50/60" : "cursor-default"
                      }`}
                    >
                      {esProtocolo ? (
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                            estaAbierta ? "" : "-rotate-90"
                          }`}
                        />
                      ) : (
                        <span className="w-4" />
                      )}

                      <div className="w-24 shrink-0 text-xs tabular-nums text-gray-500">
                        <div className="font-medium text-gray-700">{momento.dia}</div>
                        <div>{momento.hora}</div>
                      </div>

                      <div className="min-w-0 flex-1">
                        {esProtocolo ? (
                          <>
                            <span className="font-medium text-[#204983]">
                              Protocolo {fila.protocolo}
                            </span>
                            {fila.paciente ? (
                              <div className="truncate text-xs text-gray-600">{fila.paciente}</div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                                fila.tipo_de_movimiento === "ingreso"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-rose-200 bg-rose-50 text-rose-800"
                              }`}
                            >
                              {fila.tipo_de_movimiento === "ingreso" ? "Ingreso" : "Gasto"}
                            </span>
                            <div className="truncate text-xs text-gray-600">{fila.detalle}</div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                              {fila.forma_de_pago === "transferencia" ? (
                                <Landmark className="h-3 w-3 text-sky-600" />
                              ) : fila.forma_de_pago === "efectivo" ? (
                                <Banknote className="h-3 w-3 text-emerald-600" />
                              ) : null}
                              <span>
                                {textoMedioDePago(
                                  fila.forma_de_pago,
                                  fila.cuenta_de_cobro,
                                  fila.cuenta_alias,
                                )}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                              <span>
                                <span className="font-medium text-gray-600">Lo hizo:</span>{" "}
                                {autorInformado(fila.usuario)}
                              </span>
                              <span>
                                <span className="font-medium text-gray-600">Registrado por:</span>{" "}
                                {autorInformado(fila.registrado_por)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Cuántos cobros y por qué vía, sin abrir. */}
                      {esProtocolo && (fila.pagos?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {fila.pagos!.slice(-3).map((pago) => (
                            <span
                              key={pago.id}
                              title={`${pago.tipo === "devolucion" ? "Devolución" : "Cobro"} de ${plata(pago.monto)}`}
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                                pago.tipo === "devolucion"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : pago.forma_de_pago === "transferencia"
                                    ? "border-sky-200 bg-sky-50 text-sky-800"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {pago.forma_de_pago === "transferencia" ? (
                                <Landmark className="h-3 w-3" />
                              ) : (
                                <Banknote className="h-3 w-3" />
                              )}
                              {pago.tipo === "devolucion" ? "−" : ""}
                              {plata(pago.monto)}
                              <span>
                                {textoMedioDePago(
                                  pago.forma_de_pago,
                                  pago.cuenta_de_cobro,
                                  pago.cuenta_alias,
                                )}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Cómo quedó el saldo: es lo que se viene a mirar. */}
                      <div className="w-32 shrink-0 text-right">
                        <div
                          className={`text-sm font-semibold tabular-nums ${
                            total >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {total >= 0 ? "+" : ""}
                          {plata(fila.total)}
                        </div>
                        {debePaciente > 0 ? (
                          <div className="text-[11px] text-orange-700">
                            debe {plata(fila.debe_el_paciente)}
                          </div>
                        ) : debeLab > 0 ? (
                          <div className="text-[11px] text-amber-700">
                            a devolver {plata(fila.debe_el_laboratorio)}
                          </div>
                        ) : esProtocolo ? (
                          <div className="text-[11px] text-gray-400">saldado</div>
                        ) : null}
                      </div>

                      {puedeCargarMovimientos && fila.movimiento_de_caja_id ? (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Anular ${fila.detalle}`}
                          className="rounded p-1 text-gray-400 hover:text-rose-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            anular(fila.movimiento_de_caja_id as number)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") anular(fila.movimiento_de_caja_id as number)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </button>

                    {/* El detalle de lectura no depende del permiso para corregir. */}
                    {estaAbierta && esProtocolo ? (
                      <div className="space-y-3 border-t border-[#204983]/20 p-3">
                        <section aria-labelledby={`movimientos-${fila.id}`}>
                          <h3
                            id={`movimientos-${fila.id}`}
                            className="mb-2 text-sm font-semibold text-gray-800"
                          >
                            Pagos y devoluciones
                          </h3>
                          {fila.pagos?.length ? (
                            <ul className="space-y-2">
                              {fila.pagos.map((pago) => {
                                const momentoPago = pago.momento ? cuando(pago.momento) : null
                                const esDevolucion = pago.tipo === "devolucion"

                                return (
                                  <li
                                    key={pago.id}
                                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                                  >
                                    <div className="min-w-0 space-y-0.5 text-xs text-gray-600">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span
                                          className={`font-medium ${
                                            esDevolucion ? "text-amber-800" : "text-gray-800"
                                          }`}
                                        >
                                          {esDevolucion ? "Devolución" : "Pago"}
                                        </span>
                                        {momentoPago ? (
                                          <time dateTime={pago.momento} className="text-gray-500">
                                            {momentoPago.dia} · {momentoPago.hora}
                                          </time>
                                        ) : null}
                                      </div>
                                      <div>
                                        {textoMedioDePago(
                                          pago.forma_de_pago,
                                          pago.cuenta_de_cobro,
                                          pago.cuenta_alias,
                                        )}
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">
                                          Registrado por:
                                        </span>{" "}
                                        {autorInformado(pago.registrado_por)}
                                      </div>
                                    </div>
                                    <span
                                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                                        esDevolucion ? "text-amber-800" : "text-emerald-700"
                                      }`}
                                    >
                                      {esDevolucion ? "−" : "+"}
                                      {plata(pago.monto)}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500">No hay pagos ni devoluciones.</p>
                          )}
                        </section>

                        {puedeCorregir ? (
                          <CorreccionDelCobro
                            protocolId={fila.protocolo as number}
                            onCambio={() => consulta.refetch()}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        )}

        {consulta.data?.hay_mas ? (
          <p className="mt-4 text-center text-xs text-gray-500">
            Hay más movimientos de los que entran en esta pantalla. Acotá las fechas —o buscá por
            protocolo o paciente— para verlos todos.
          </p>
        ) : null}
      </div>

      <MovimientoDeCajaDialog
        open={agregando}
        onOpenChange={setAgregando}
        onGuardado={() => consulta.refetch()}
      />

      <FormaDePagoDialog
        open={corrigiendo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCorrigiendo(null)
        }}
        formaDePago={corrigiendo?.pago.forma_de_pago || ""}
        monto={corrigiendo?.pago.monto ?? ""}
        cuentaDeCobroId={
          corrigiendo?.pago.cuenta_de_cobro_id
            ? String(corrigiendo.pago.cuenta_de_cobro_id)
            : ""
        }
        onGuardar={corregirFormaDePago}
      />
    </div>
  )
}

function Resumen({
  titulo,
  valor,
  tono,
  desglose,
}: {
  titulo: string
  valor: string
  tono: "entra" | "sale" | "neto"
  desglose?: { titulo: string; valor: string }[]
}) {
  const color = {
    entra: "text-emerald-700",
    sale: "text-rose-700",
    neto: "text-gray-900",
  }[tono]

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{valor}</div>
      {desglose && (
        <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-2 text-xs text-gray-600">
          {desglose.map((linea) => (
            <div key={linea.titulo} className="flex items-center justify-between gap-2">
              <span>{linea.titulo}</span>
              <span className="font-medium tabular-nums text-gray-800">{linea.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
