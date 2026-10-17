import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Wallet } from "lucide-react"

import type { Inicio } from "./tipos"
import {
  DIAS,
  aNumero,
  contraQue,
  diaDeLaSemana,
  fecha,
  iso,
  nombreDeSemana,
  plata,
  sumarDias,
} from "./formato"
import { Bloque, Cifra, Diferencia, Flecha, ItemDeLeyenda, Leyenda, TituloDeBloque } from "./piezas"

const SEMANAS_DE_LA_CAJA = 6
const INICIALES = ["l", "m", "m", "j", "v", "s", "d"]

const plataRedonda = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

const ETIQUETAS_DEL_DESGLOSE: Record<string, string> = {
  analyses_amount_due: "Particulares",
  coseguro: "Coseguro",
  material_descartable: "Material",
  derivacion: "Derivación",
  unplanned_charges: "Cobros extra",
  unplanned_payments_today: "Pagos extra",
}

function Columna({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="m-0 text-xs font-semibold text-slate-600">
        {titulo}
        {nota ? <span className="font-normal text-slate-500"> · {nota}</span> : null}
      </p>
      {children}
    </div>
  )
}

function Fila({ etiqueta, monto }: { etiqueta: string; monto: string }) {
  return (
    <span className="flex justify-between gap-2 text-xs text-slate-600">
      <span className="min-w-0">{etiqueta}</span>
      <span className="whitespace-nowrap tabular-nums">{monto}</span>
    </span>
  )
}

function Recuadro({ children, gris = false }: { children: ReactNode; gris?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-md border border-slate-200 px-3.5 py-2.5 ${gris ? "bg-slate-50" : "bg-white"}`}>
      {children}
    </div>
  )
}

function Monto({ valor, className = "text-[22px]" }: { valor: string; className?: string }) {
  return <Cifra valor={aNumero(valor)} formato={(n) => plata(n)} className={`leading-tight text-slate-900 ${className}`} />
}

function SemanaDeCaja({
  datos,
  onAbrirDia,
}: {
  datos: Inicio
  onAbrirDia: (fecha: string) => void
}) {
  const referencia = fecha(datos.referencia)
  const porDia = new Map(datos.caja.por_dia.map((d) => [d.fecha, d]))
  const primerLunes = fecha(datos.caja.por_dia[0]?.fecha ?? datos.referencia)
  const [semana, setSemana] = useState(SEMANAS_DE_LA_CAJA - 1)
  useEffect(() => setSemana(SEMANAS_DE_LA_CAJA - 1), [datos.referencia])

  const lunes = sumarDias(primerLunes, semana * 7)
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = sumarDias(lunes, i)
    const dato = porDia.get(iso(d))
    const efectivo = aNumero(dato?.efectivo)
    const transferencia = aNumero(dato?.transferencia)
    const sinForma = aNumero(dato?.sin_forma)
    return {
      d,
      dato,
      efectivo,
      transferencia,
      sinForma,
      total: efectivo + transferencia + sinForma,
      esHoy: datos.es_mes_actual && iso(d) === datos.referencia,
    }
  })
  const maximo = Math.max(1, ...dias.map((x) => x.total))
  const haySinForma = dias.some((x) => x.sinForma > 0)
  const enCurso = datos.es_mes_actual && semana === SEMANAS_DE_LA_CAJA - 1
  const ALTO = 72

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="m-0 text-[13px] font-semibold text-slate-900">{nombreDeSemana(lunes)}</h3>
        {enCurso ? <span className="text-xs text-slate-500">en curso</span> : null}
      </div>
      <Leyenda>
        <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-tema-efectivo" />}>efectivo</ItemDeLeyenda>
        <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-tema-transferencia" />}>transferencias</ItemDeLeyenda>
        {haySinForma ? (
          <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />}>sin forma registrada</ItemDeLeyenda>
        ) : null}
      </Leyenda>
      <div className="flex items-stretch gap-1">
        <Flecha direccion="anterior" etiqueta="Semana anterior" disabled={semana === 0} onClick={() => setSemana(semana - 1)} />
        <div className="flex min-w-0 flex-1 gap-1.5">
          {dias.map((x, i) => (
            <span key={iso(x.d)} className="flex min-w-0 flex-1 flex-col gap-1">
              {x.dato && x.d <= referencia ? (
                <span className="flex flex-col justify-end" style={{ height: ALTO }}>
                  <button
                    type="button"
                    onClick={() => onAbrirDia(iso(x.d))}
                    aria-label={x.esHoy ? "Caja de hoy, hasta ahora" : `Caja del ${DIAS[diaDeLaSemana(x.d)]} ${x.d.getDate()}`}
                    title={`${plata(x.total)} · efectivo ${plata(x.efectivo)} · transferencias ${plata(x.transferencia)}`}
                    className={`inicio-crece-alto flex min-h-[3px] flex-col overflow-hidden rounded-t-md border-0 bg-transparent p-0 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204983]/40 ${
                      x.esHoy ? "outline outline-2 outline-offset-2 outline-tema-plata" : ""
                    }`}
                    style={{ height: `${(x.total / maximo) * 100}%`, animationDelay: `${i * 15}ms` }}
                  >
                    <span className="bg-slate-300" style={{ flex: x.sinForma }} />
                    <span className="bg-tema-transferencia" style={{ flex: x.transferencia }} />
                    <span className="bg-tema-efectivo" style={{ flex: x.efectivo }} />
                  </button>
                </span>
              ) : (
                <span className="rounded-md border border-dashed border-slate-200" style={{ height: ALTO }} />
              )}
              <span
                className={`text-center text-[11px] ${
                  x.esHoy ? "font-semibold text-tema-plata" : x.d > referencia ? "text-slate-500" : "text-slate-600"
                }`}
              >
                {x.esHoy ? "hoy" : INICIALES[i]}
              </span>
            </span>
          ))}
        </div>
        <Flecha
          direccion="siguiente"
          etiqueta="Semana siguiente"
          disabled={semana === SEMANAS_DE_LA_CAJA - 1}
          onClick={() => setSemana(semana + 1)}
        />
      </div>
      <span className="text-xs text-slate-500">
        Cada barra es lo que entró ese día; tocá una para ver el día. Un día cerrado ya no cambia.
      </span>
    </>
  )
}

export default function Caja({
  datos,
  posicion,
  puedeVerElLibro,
  onAbrirDia,
}: {
  datos: Inicio
  posicion: number
  puedeVerElLibro: boolean
  onAbrirDia: (fecha: string) => void
}) {
  const { hoy, mes } = datos.caja
  const pendiente = datos.pendiente
  const desglose = Object.entries(hoy?.desglose ?? {})
    .filter(([, monto]) => aNumero(monto) !== 0)
    .map(([clave, monto]) => ({ etiqueta: ETIQUETAS_DEL_DESGLOSE[clave] ?? clave, monto }))
  const hasta = fecha(datos.referencia).getDate()
  const columnas = 1 + (hoy ? 1 : 0) + (pendiente ? 1 : 0)
  const grilla =
    columnas === 3
      ? "@min-[600px]:grid-cols-2 @min-[600px]:[&>*:last-child]:col-span-2 @min-[960px]:grid-cols-3 @min-[960px]:[&>*:last-child]:col-span-1"
      : columnas === 2
        ? "@min-[600px]:grid-cols-2"
        : ""

  return (
    <Bloque tema="plata" posicion={posicion} className="gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <TituloDeBloque tema="plata" icono={Wallet}>
          Caja
        </TituloDeBloque>
        <span className="flex-1" />
        {puedeVerElLibro ? (
          <Link to="/libro-diario" className="text-sm text-[#204983] hover:underline">
            Ver el libro diario
          </Link>
        ) : null}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${grilla}`}>
        {hoy ? (
          <Columna titulo="Hoy" nota="lo que entró hoy, según la hora de cada pago">
            <Recuadro>
              <span className="text-xs text-slate-600">Cobrado</span>
              <Monto valor={hoy.cobrado.total} />
              <Fila etiqueta="Efectivo" monto={plata(hoy.cobrado.efectivo)} />
              {hoy.cobrado.por_cuenta.map((c) => (
                <Fila key={c.cuenta} etiqueta={`Transferencia · ${c.cuenta}`} monto={plata(c.monto)} />
              ))}
              {aNumero(hoy.cobrado.sin_forma) > 0 ? (
                <Fila etiqueta="Sin forma registrada" monto={plata(hoy.cobrado.sin_forma)} />
              ) : null}
              {aNumero(hoy.de_otros_dias) > 0 ? (
                <span className="border-t border-slate-200 pt-1 text-xs text-slate-500">
                  {plata(hoy.de_otros_dias)} son saldos de protocolos de otros días
                </span>
              ) : null}
            </Recuadro>
            <Recuadro>
              <span className="text-xs text-slate-600">Efectivo neto del día</span>
              <Monto valor={hoy.efectivo_neto} />
              <Fila etiqueta="Cobrado en efectivo" monto={plata(hoy.cobrado.efectivo)} />
              <Fila etiqueta="Devuelto en efectivo" monto={`− ${plata(hoy.devuelto_efectivo)}`} />
              <Fila etiqueta="Gastos en efectivo" monto={`− ${plata(hoy.gastos_efectivo)}`} />
              {aNumero(hoy.ingresos_efectivo) > 0 ? (
                <Fila etiqueta="Otros ingresos en efectivo" monto={`+ ${plata(hoy.ingresos_efectivo)}`} />
              ) : null}
              <span className="border-t border-slate-200 pt-1 text-xs text-slate-500">
                Es lo que el cajón tiene que sumar, además del cambio con que abrió.
              </span>
            </Recuadro>
            <Recuadro gris>
              <span className="text-xs text-slate-600">Falta cobrar de los protocolos de hoy</span>
              <Monto valor={hoy.falta_cobrar} className="text-xl" />
              {aNumero(hoy.a_devolver) > 0 ? <Fila etiqueta="A devolver de los de hoy" monto={plata(hoy.a_devolver)} /> : null}
            </Recuadro>
            {desglose.length ? (
              <details className="rounded-md bg-slate-50 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-[#204983]">Desglose por concepto ({desglose.length})</summary>
                <div className="mt-2 flex flex-col gap-1">
                  {desglose.map((d) => (
                    <Fila key={d.etiqueta} etiqueta={d.etiqueta} monto={plata(d.monto)} />
                  ))}
                </div>
              </details>
            ) : null}
          </Columna>
        ) : null}

        <Columna titulo={datos.es_mes_actual ? "Este mes" : "El mes"} nota="la suma de los días">
          <Recuadro gris>
            <span className="text-xs text-slate-600">Cobrado del 1 al {hasta}</span>
            <Monto valor={mes.cobrado} />
            <Fila etiqueta="Efectivo" monto={plata(mes.efectivo)} />
            <Fila etiqueta="Transferencias" monto={plata(mes.transferencia)} />
            {aNumero(mes.sin_forma) > 0 ? <Fila etiqueta="Sin forma registrada" monto={plata(mes.sin_forma)} /> : null}
            <span className="border-t border-slate-200 pt-1">
              <Diferencia
                valor={aNumero(mes.cobrado)}
                contra={mes.comparacion === null ? null : aNumero(mes.comparacion)}
                sentido="mas-es-mejor"
                porcentual
                formato={plataRedonda}
                contraTexto={`que ${contraQue(datos.comparacion.meses)}`}
              />
            </span>
          </Recuadro>
          <SemanaDeCaja datos={datos} onAbrirDia={onAbrirDia} />
        </Columna>

        {pendiente ? (
          <Columna titulo="Pendiente de todas las fechas">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
              <Recuadro>
                <span className="text-xs text-slate-600">Nos deben</span>
                <Monto valor={pendiente.nos_deben} className="text-xl" />
              </Recuadro>
              <Recuadro>
                <span className="text-xs text-slate-600">A devolver</span>
                <Monto valor={pendiente.a_devolver} className="text-xl" />
              </Recuadro>
            </div>
            <Recuadro>
              <span className="text-xs text-slate-600">Neto a favor</span>
              <Monto valor={pendiente.neto} className="text-xl" />
            </Recuadro>
            <Link
              to="/protocolos?is_printed=true&payment_status=2"
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3.5 py-2.5 text-[13px] no-underline transition hover:border-[#204983] hover:shadow-[0_0_0_1px_#204983]"
            >
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <Cifra valor={pendiente.impresos_con_pago_incompleto} className="text-lg leading-tight text-slate-900" />
                <span className="text-slate-600">
                  {pendiente.impresos_con_pago_incompleto === 1 ? "impreso" : "impresos"} con pago incompleto
                </span>
                <Diferencia
                  valor={pendiente.impresos_con_pago_incompleto}
                  contra={pendiente.hace_una_semana?.impresos_con_pago_incompleto as number | null | undefined}
                  sentido="mas-es-peor"
                  contraTexto="que hace una semana"
                  mostrarContra={false}
                />
              </span>
              <span className="whitespace-nowrap font-semibold text-[#204983]">Ver →</span>
            </Link>
          </Columna>
        ) : null}
      </div>
    </Bloque>
  )
}
