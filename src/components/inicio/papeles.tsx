import { FileWarning } from "lucide-react"

import type { Inicio } from "./tipos"
import { numero } from "./formato"
import { Bloque, Dato, Diferencia, ItemDeLeyenda, RenglonConEnlace, TituloDeBloque } from "./piezas"

/** La flecha corta de este bloque: «▼ 2», contra hace una semana. */
const Contra = ({ valor, antes }: { valor: number; antes: number | null | undefined }) => (
  <Diferencia valor={valor} contra={antes} sentido="mas-es-peor" compacta />
)

export default function Papeles({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const p = datos.papeles
  if (!p) return null
  const antes = p.hace_una_semana
  const preauth = p.preauth_completa + p.preauth_incompleta + p.preauth_no_trajo
  const ancho = (n: number) => `${(n / Math.max(1, preauth)) * 100}%`

  return (
    <Bloque tema="papeles" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="papeles" icono={FileWarning}>
        Papeles que faltan
      </TituloDeBloque>
      <p className="-mt-0.5 mb-0 text-xs text-slate-500">
        Información faltante, de cualquier fecha; los papeles, de los últimos {p.dias} días. Las flechas comparan con
        hace una semana.
      </p>

      <RenglonConEnlace
        valor={p.informacion_faltante.valor}
        texto="en estado Información faltante"
        diferencia={<Contra valor={p.informacion_faltante.valor} antes={antes.informacion_faltante} />}
        enlace={p.informacion_faltante.estado_id ? `/protocolos?status=${p.informacion_faltante.estado_id}` : "/protocolos"}
      />

      <p className="mb-0 mt-1 text-xs text-slate-500">
        Papeles de obra social que faltan en protocolos de los últimos {p.dias} días, todavía sin facturar
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
        <Dato
          etiqueta="Orden no presentada"
          valor={p.orden_no_presentada}
          diferencia={<Contra valor={p.orden_no_presentada} antes={antes.orden_no_presentada} />}
        />
        <Dato
          etiqueta="Orden incompleta"
          valor={p.orden_incompleta}
          diferencia={<Contra valor={p.orden_incompleta} antes={antes.orden_incompleta} />}
        />
      </div>

      {preauth > 0 ? (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-slate-600">
            Preautorizaciones:{" "}
            <strong className="text-slate-900">
              {numero(p.preauth_pendientes)} {p.preauth_pendientes === 1 ? "pendiente" : "pendientes"}
            </strong>{" "}
            <Contra valor={p.preauth_pendientes} antes={antes.preauth_pendientes} />
          </span>
          <span className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className="inicio-crece-ancho bg-amber-100" style={{ width: ancho(p.preauth_completa) }} />
            <span className="inicio-crece-ancho bg-amber-400" style={{ width: ancho(p.preauth_incompleta) }} />
            <span className="inicio-crece-ancho bg-tema-papeles" style={{ width: ancho(p.preauth_no_trajo) }} />
          </span>
          <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
            <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-amber-100 outline outline-1 outline-amber-200" />}>
              Completas <strong>{numero(p.preauth_completa)}</strong>
            </ItemDeLeyenda>
            <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />}>
              Incompletas <strong>{numero(p.preauth_incompleta)}</strong>
            </ItemDeLeyenda>
            <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-tema-papeles" />}>
              No presentadas <strong>{numero(p.preauth_no_trajo)}</strong>
            </ItemDeLeyenda>
          </span>
        </div>
      ) : null}

      {p.con_papeles_pendientes > 0 ? (
        <RenglonConEnlace
          valor={p.con_papeles_pendientes}
          texto={p.con_papeles_pendientes === 1 ? "protocolo con algún papel pendiente" : "protocolos con algún papel pendiente"}
          diferencia={<Contra valor={p.con_papeles_pendientes} antes={antes.con_papeles_pendientes} />}
          enlace="/protocolos?falta_papel=1"
        />
      ) : null}

      {p.completados_sin_papel > 0 ? (
        <RenglonConEnlace
          aviso
          valor={p.completados_sin_papel}
          texto={
            p.completados_sin_papel === 1
              ? "ya está completado y no se puede facturar hasta tener el papel"
              : "ya están completados y no se pueden facturar hasta tener el papel"
          }
          enlace={
            p.completado_estado_id
              ? `/protocolos?falta_papel=1&status=${p.completado_estado_id}`
              : "/protocolos?falta_papel=1"
          }
        />
      ) : null}

      <p className="mb-0 mt-1 text-xs text-slate-500">{datos.es_mes_actual ? "De este mes" : "De ese mes"}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
        <Dato etiqueta="Pacientes anónimos" valor={p.anonimos_del_mes} />
      </div>
    </Bloque>
  )
}
