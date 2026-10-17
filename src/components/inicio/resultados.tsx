import { Link } from "react-router-dom"
import { AlertTriangle, ClipboardCheck, FlaskConical, ListChecks } from "lucide-react"

import { getProtocolStatusStyle } from "@/lib/status-styles"
import { ENTRADA_ABAJO } from "@/lib/entrada"
import type { Inicio, Pila } from "./tipos"
import { numero } from "./formato"
import { Cifra, Diferencia } from "./piezas"
import { retraso } from "./movimiento"

const llevan = (n: number) => (n === 1 ? "1 lleva" : `${numero(n)} llevan`)

const verLos = (n: number, que: string) => (n === 1 ? `Ver el ${que} →` : `Ver los ${numero(n)} ${que}s →`)

/**
 * Una pila: toda la tarjeta es el enlace a la lista ya filtrada.
 *
 * Las de carga y validación llevan el borde izquierdo del color de su estado,
 * el mismo que las filas de Protocolos: se aprende una vez y sirve en las dos
 * pantallas. Urgentes va en rosa, su tema.
 */
function Tarjeta({
  titulo,
  pila,
  viejos,
  enlace,
  textoDelEnlace,
  estadoId,
  urgente = false,
  grande = false,
}: {
  titulo: string
  pila: Pila
  viejos: string
  enlace: string
  textoDelEnlace: string
  estadoId?: number | null
  urgente?: boolean
  grande?: boolean
}) {
  const estilo = getProtocolStatusStyle(estadoId)
  const Icono = urgente ? AlertTriangle : estadoId === 1 ? FlaskConical : ClipboardCheck
  return (
    <Link
      to={enlace}
      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-lg border border-l-4 px-4 py-3.5 no-underline shadow-sm transition hover:border-[#204983] hover:shadow-[0_0_0_1px_#204983] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204983]/40 ${
        urgente
          ? "border-rose-200 border-l-rose-500 bg-tema-urgente-suave text-rose-800"
          : `border-slate-200 bg-white text-slate-900 ${estilo.border}`
      }`}
    >
      <span className={`text-sm font-medium ${urgente ? "" : "text-slate-600"}`}>{titulo}</span>
      <span
        className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg ${
          urgente ? "text-tema-urgente" : estilo.badge
        }`}
      >
        <Icono className="h-4 w-4" aria-hidden="true" />
      </span>
      <Cifra valor={pila.valor} className={`font-bold leading-tight ${grande ? "text-[36px]" : "text-[26px]"}`} />
      <span className={`text-right text-[13px] font-semibold ${urgente ? "" : "text-[#204983]"}`}>{textoDelEnlace}</span>
      <span className={`col-span-2 text-xs ${urgente ? "opacity-80" : "text-slate-500"}`}>{viejos}</span>
      <span className={`col-span-2 mt-1 border-t pt-1.5 ${urgente ? "border-rose-900/15" : "border-slate-200"}`}>
        <Diferencia valor={pila.valor} contra={pila.hace_una_semana} sentido="mas-es-peor" contraTexto="que hace una semana" />
      </span>
    </Link>
  )
}

export default function Resultados({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const r = datos.resultados
  if (!r) return null
  const { por_cargar: cargar, por_validar: validar, urgentes } = r

  return (
    <section
      style={retraso(posicion)}
      className={`grid items-start gap-2.5 @min-[660px]:grid-cols-3 ${ENTRADA_ABAJO}`}
    >
      <h2 className="col-span-full m-0 flex items-center gap-2 text-base font-semibold text-slate-900">
        <span className="inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-tema-pacientes-suave text-tema-pacientes">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
        </span>
        Resultados
      </h2>
      <p className="col-span-full -mt-1 mb-0 text-xs text-slate-800">
        Todo lo pendiente ahora, de cualquier fecha. La flecha compara con hace una semana a esta hora.
      </p>
      <Tarjeta
        titulo="Por cargar"
        pila={cargar}
        grande
        estadoId={cargar.estado_id}
        enlace={cargar.estado_id ? `/resultados?status=${cargar.estado_id}` : "/resultados"}
        textoDelEnlace={verLos(cargar.protocolos ?? 0, "protocolo")}
        viejos={`${llevan(cargar.viejos)} más de ${cargar.dias_para_viejo} días`}
      />
      <Tarjeta
        titulo="Por validar"
        pila={validar}
        estadoId={validar.estado_id}
        enlace={validar.estado_id ? `/resultados?status=${validar.estado_id}` : "/resultados"}
        textoDelEnlace={verLos(validar.protocolos ?? 0, "protocolo")}
        viejos={`${llevan(validar.viejos)} más de ${validar.dias_para_viejo} días`}
      />
      <Tarjeta
        titulo="Urgentes sin cerrar"
        pila={urgentes}
        urgente
        enlace="/protocolos?urgente=1"
        textoDelEnlace={verLos(urgentes.valor, "urgente")}
        viejos={`${llevan(urgentes.viejos)} más de ${urgentes.horas_para_viejo} h`}
      />
    </section>
  )
}
