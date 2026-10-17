import { useState } from "react"
import { AlertTriangle, Building2, Clock3, MapPin } from "lucide-react"

import type { FilaDeObraSocial, Inicio } from "./tipos"
import { contraQueCerrados, duracion, fecha, numero, tramo, contraQue, iso } from "./formato"
import { Bloque, Diferencia, TituloDeBloque } from "./piezas"

// ─── Tiempos ────────────────────────────────────────────────────────────────

export function Tiempos({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const t = datos.tiempos
  const cerrados = `${numero(t.protocolos)} ${t.protocolos === 1 ? "protocolo cerrado" : "protocolos cerrados"} ${
    datos.es_mes_actual ? "este mes" : "ese mes"
  }`
  const tarjetas = [
    {
      titulo: "Carga promedio",
      valor: t.carga,
      contra: t.comparacion.carga,
      nota: `Del ingreso a que se carga el resultado, en los ${cerrados}`,
    },
    {
      titulo: "Tiempo de resolución",
      valor: t.resolucion,
      contra: t.comparacion.resolucion,
      nota: `Del ingreso al cierre, en los ${cerrados}`,
    },
  ]
  return (
    <Bloque tema="tiempos" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="tiempos" icono={Clock3}>
        Tiempos
      </TituloDeBloque>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2.5">
        {tarjetas.map((c) => (
          <div key={c.titulo} className="rounded-md border border-slate-200 px-3.5 py-3">
            <p className="m-0 text-sm font-medium text-slate-600">{c.titulo}</p>
            <p className="my-1.5 text-[26px] font-bold leading-none text-tema-tiempos">{duracion(c.valor)}</p>
            <p className="m-0 text-xs text-slate-500">{t.protocolos ? c.nota : "Todavía no se cerró ningún protocolo."}</p>
            <p className="mb-0 mt-2 border-t border-slate-200 pt-1.5">
              <Diferencia
                valor={c.valor}
                contra={c.contra}
                sentido="mas-es-peor"
                formato={duracion}
                palabras={{ mas: "más lento", menos: "más rápido" }}
                contraTexto={`que ${contraQueCerrados(datos.comparacion.meses)}`}
              />
            </p>
          </div>
        ))}
      </div>
    </Bloque>
  )
}

// ─── Obras sociales ─────────────────────────────────────────────────────────

const A_LA_VISTA = 4
/** Una obra social que bajó más que esto pide una explicación. */
const CAIDA_QUE_SE_AVISA = -20

type Medida = "protocolos" | "ub"

const variacion = (valor: number, contra: number | null) =>
  contra === null || contra === 0 ? null : ((valor - contra) / contra) * 100

function FilaDeObra({
  nombre,
  valor,
  contra,
  porcentaje,
  ancho,
  otras = false,
}: {
  nombre: React.ReactNode
  valor: number
  contra: number | null
  porcentaje: number
  ancho: number
  otras?: boolean
}) {
  const cambio = variacion(valor, contra)
  const bajoMucho = cambio !== null && cambio <= CAIDA_QUE_SE_AVISA
  return (
    <div className="text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0">{nombre}</span>
        <span className="whitespace-nowrap tabular-nums">
          <strong>{numero(Math.round(valor))}</strong>
          <span className="text-slate-500"> · {numero(porcentaje)} %</span>{" "}
          {bajoMucho ? (
            <span className="text-xs font-semibold text-tema-papeles">▼ {numero(Math.abs(cambio!))} %</span>
          ) : (
            <Diferencia valor={valor} contra={contra} sentido="neutro" porcentual compacta className="!font-normal" />
          )}
        </span>
      </span>
      <span className="mt-1 block h-2 rounded-full bg-tema-obras-suave">
        <span
          className={`inicio-crece-ancho block h-2 rounded-full ${otras ? "bg-tema-obras-otras" : "bg-tema-obras-barra"}`}
          style={{ width: `${Math.max(ancho, valor > 0 ? 1 : 0)}%` }}
        />
      </span>
      {bajoMucho ? (
        <span className="mt-1 block text-xs text-tema-papeles">
          Bajó más de un 20 %: conviene ver si cambió algo con esta obra social.
        </span>
      ) : null}
    </div>
  )
}

export function ObrasSociales({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const [medida, setMedida] = useState<Medida>("protocolos")
  const [verTodas, setVerTodas] = useState(false)
  const o = datos.obras_sociales
  const de = (f: FilaDeObraSocial) => f[medida]
  const contraDe = (f: FilaDeObraSocial) => f.comparacion[medida]

  const filas = [...o.filas].sort((a, b) => de(b) - de(a) || a.nombre.localeCompare(b.nombre))
  const totalObras = filas.reduce((s, f) => s + de(f), 0)
  const total = medida === "protocolos" ? o.total_protocolos : o.total_ub
  const vista = verTodas ? filas : filas.slice(0, A_LA_VISTA)
  const resto = verTodas ? [] : filas.slice(A_LA_VISTA)
  const sumaDelResto = resto.reduce((s, f) => s + de(f), 0)
  const contraDelResto = resto.some((f) => contraDe(f) !== null)
    ? resto.reduce((s, f) => s + (contraDe(f) ?? 0), 0)
    : null
  const mayor = Math.max(1, de(filas[0] ?? { protocolos: 0, ub: 0 } as FilaDeObraSocial), sumaDelResto)
  const pct = (n: number, sobre: number) => (sobre ? Math.round((n / sobre) * 100) : 0)

  const primero = new Date(fecha(datos.referencia).getFullYear(), fecha(datos.referencia).getMonth(), 1, 12)
  const queTramo = tramo(iso(primero), datos.referencia)

  return (
    <Bloque tema="obras" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="obras" icono={Building2}>
        Obras sociales del mes
      </TituloDeBloque>
      <p className="-mt-1 mb-0 text-xs text-slate-500">
        {queTramo.charAt(0).toUpperCase() + queTramo.slice(1)}. La diferencia es contra {contraQue(datos.comparacion.meses)}.
      </p>
      <div role="group" aria-label="Medir por" className="inline-flex self-start rounded-md border border-slate-200 p-0.5 text-xs">
        {(["protocolos", "ub"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={medida === m}
            onClick={() => setMedida(m)}
            className={`rounded px-2.5 py-1 transition ${medida === m ? "bg-[#204983] font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            {m === "protocolos" ? "Por protocolos" : "Por UB"}
          </button>
        ))}
      </div>

      {o.particulares ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-[13px]">
          <span className="text-slate-600">Particulares, aparte</span>
          <span className="whitespace-nowrap tabular-nums">
            <strong>{numero(Math.round(de(o.particulares)))}</strong>
            <span className="text-slate-500"> · {numero(pct(de(o.particulares), total))} % de todos</span>{" "}
            <Diferencia
              valor={de(o.particulares)}
              contra={contraDe(o.particulares)}
              sentido="neutro"
              porcentual
              compacta
              className="!font-normal"
            />
          </span>
        </div>
      ) : null}

      {filas.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">Todavía no hay protocolos de obras sociales este mes.</p>
      ) : null}

      {vista.map((f) => (
        <FilaDeObra
          key={f.insurance_id ?? f.nombre}
          nombre={f.nombre}
          valor={de(f)}
          contra={contraDe(f)}
          porcentaje={pct(de(f), totalObras)}
          ancho={(de(f) / mayor) * 100}
        />
      ))}
      {resto.length ? (
        <FilaDeObra
          otras
          nombre={
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className="cursor-pointer font-medium text-[#204983] hover:underline"
            >
              {resto.length === 1 ? "Otra obra social" : `Otras ${resto.length} obras sociales`} ▸
            </button>
          }
          valor={sumaDelResto}
          contra={contraDelResto}
          porcentaje={pct(sumaDelResto, totalObras)}
          ancho={(sumaDelResto / mayor) * 100}
        />
      ) : null}
      {verTodas && filas.length > A_LA_VISTA ? (
        <button
          type="button"
          onClick={() => setVerTodas(false)}
          className="self-start text-sm font-medium text-[#204983] hover:underline"
        >
          Ver menos
        </button>
      ) : null}
    </Bloque>
  )
}

// ─── Top 3 urgentes ─────────────────────────────────────────────────────────

export function TopUrgentes({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const top = datos.top_urgentes.slice(0, 3)
  return (
    <Bloque tema="urgente" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="urgente" icono={AlertTriangle}>
        Top 3 análisis urgentes
      </TituloDeBloque>
      {top.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">Ningún análisis urgente {datos.es_mes_actual ? "este mes" : "ese mes"}.</p>
      ) : (
        top.map((a, i) => (
          <div
            key={a.code}
            className="flex items-center gap-2.5 rounded-md border border-rose-100 bg-tema-urgente-suave p-2.5 text-rose-900"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-200 font-bold">{i + 1}</span>
            <span className="min-w-0">
              <strong className="text-sm">{a.name}</strong>
              <br />
              <span className="text-xs">
                {numero(a.protocols)} {a.protocols === 1 ? "protocolo" : "protocolos"} · cód. {a.code}
              </span>
            </span>
          </div>
        ))
      )}
    </Bloque>
  )
}

// ─── Pacientes por lugar ────────────────────────────────────────────────────

const LUGARES_A_LA_VISTA = 3

export function PacientesPorLugar({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const [verTodos, setVerTodos] = useState(false)
  const lugares = datos.pacientes_por_lugar
  const vista = verTodos ? lugares : lugares.slice(0, LUGARES_A_LA_VISTA)
  const mayor = Math.max(1, ...lugares.map((l) => l.pacientes))
  const restantes = lugares.length - LUGARES_A_LA_VISTA

  return (
    <Bloque tema="pacientes" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="pacientes" icono={MapPin}>
        Pacientes por lugar
      </TituloDeBloque>
      {lugares.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">Todavía no hay pacientes {datos.es_mes_actual ? "este mes" : "ese mes"}.</p>
      ) : null}
      {vista.map((l) => (
        <div key={l.lugar ?? ""} className="text-sm">
          <span className="flex justify-between gap-2">
            <span className="min-w-0">{l.lugar ?? "Sin ciudad cargada"}</span>
            <strong className="tabular-nums">{numero(l.pacientes)}</strong>
          </span>
          <span className="mt-1 block h-2 rounded-full bg-slate-100">
            <span
              className={`inicio-crece-ancho block h-2 rounded-full ${l.lugar ? "bg-tema-pacientes" : "bg-slate-300"}`}
              style={{ width: `${(l.pacientes / mayor) * 100}%` }}
            />
          </span>
        </div>
      ))}
      {restantes > 0 ? (
        <button
          type="button"
          onClick={() => setVerTodos(!verTodos)}
          className="self-start text-sm font-medium text-[#204983] hover:underline"
        >
          {verTodos ? "Ver menos" : restantes === 1 ? "Ver el lugar restante" : `Ver los ${restantes} lugares restantes`}
        </button>
      ) : null}
    </Bloque>
  )
}
