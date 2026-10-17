import { useEffect, useMemo, useRef, useState } from "react"
import { Users } from "lucide-react"

import type { Inicio } from "./tipos"
import {
  DIAS,
  DIAS_CORTOS,
  MESES_CORTOS,
  contraQue,
  diaDeLaSemana,
  diasEntre,
  fecha,
  iso,
  lunesDe,
  nombreDeSemana,
  numero,
  porcentaje,
  sumarDias,
  tramo,
} from "./formato"
import { Bloque, Cifra, Diferencia, Flecha, ItemDeLeyenda, Leyenda, TituloDeBloque } from "./piezas"

const SEMANAS = 26
const SEMANAS_PARA_LO_NORMAL = 8

// "los jueves anteriores": lunes a viernes no cambian en plural.
const enPlural = (dia: string) => (dia.endsWith("s") ? dia : `${dia}s`)

const diaYMes = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

interface Semana {
  lunes: Date
  total: number
  anioAnterior: number
  feriado: { fecha: Date; nombre: string } | null
  parcial: boolean
}

/** Cómo leer la serie diaria: cuántos pacientes hubo un día, y sumas de tramos. */
function useSerie(datos: Inicio) {
  return useMemo(() => {
    const desde = fecha(datos.pacientes.por_dia.desde)
    const valores = datos.pacientes.por_dia.valores
    const referencia = fecha(datos.referencia)
    const feriados = new Map(datos.pacientes.feriados.map((f) => [f.fecha, f.nombre]))

    /** `null` = fuera de la serie (antes del primer día o todavía no pasó). */
    const delDia = (d: Date): number | null => {
      const i = diasEntre(desde, d)
      return i >= 0 && i < valores.length ? valores[i] : null
    }
    const suma = (d0: Date, d1: Date) => {
      let total = 0
      for (let d = d0; d <= d1; d = sumarDias(d, 1)) total += delDia(d) ?? 0
      return total
    }
    const feriadoEntre = (d0: Date, d1: Date) => {
      for (let d = d0; d <= d1; d = sumarDias(d, 1)) {
        const nombre = feriados.get(iso(d))
        if (nombre) return { fecha: d, nombre }
      }
      return null
    }
    return { referencia, delDia, suma, feriadoEntre, feriados }
  }, [datos])
}

function escala(minimo: number, maximo: number) {
  const rango = Math.max(1, maximo - minimo)
  const crudo = rango / 4
  const potencia = 10 ** Math.floor(Math.log10(crudo))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo) ?? potencia * 10
  const bajo = Math.max(0, Math.floor(minimo / paso) * paso)
  const alto = Math.ceil(maximo / paso) * paso || paso
  const marcas: number[] = []
  for (let v = bajo; v <= alto + paso / 2; v += paso) marcas.push(v)
  return { bajo, alto: Math.max(alto, bajo + paso), marcas }
}

function SemanaPorSemana({
  semanas,
  elegida,
  onElegir,
  esActual,
  referencia,
}: {
  semanas: Semana[]
  elegida: number
  onElegir: (indice: number) => void
  esActual: boolean
  referencia: Date
}) {
  const completas = semanas.slice(0, SEMANAS)
  const actual = semanas[SEMANAS]
  // La escala sale de todo lo que se dibuja. Las semanas de este año entran
  // aunque estén en cero (si no, una semana sin pacientes caía por debajo del
  // gráfico, encima de lo que sigue); las del año anterior en cero no se
  // dibujan, así que no cuentan.
  const valores = [...semanas.map((s) => s.total), ...completas.map((s) => s.anioAnterior).filter((v) => v > 0)]
  const { bajo, alto, marcas } = escala(Math.min(...valores), Math.max(...valores, 1))
  const ALTO = 180
  const y = (v: number) => 8 + (1 - (Math.min(alto, Math.max(bajo, v)) - bajo) / (alto - bajo)) * (ALTO - 16)
  const x = (i: number) => (i / SEMANAS) * 100
  const promedio = completas.reduce((a, s) => a + s.total, 0) / Math.max(1, completas.length)

  const mayor = completas.reduce((m, s, i) => (s.total > completas[m].total ? i : m), 0)
  const conFeriado = completas
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.feriado)
    .sort((a, b) => a.s.total - b.s.total)[0]
  const ultima = SEMANAS - 1
  const anioAnterior = referencia.getFullYear() - 1

  // Una semana del año anterior en cero es una semana sin datos (el sistema
  // todavía no se usaba), no una semana sin pacientes: la línea se corta ahí
  // en vez de caer al piso.
  const tramosDelAnioAnterior: Array<Array<{ i: number; v: number }>> = []
  completas.forEach((s, i) => {
    if (s.anioAnterior <= 0) return
    const ultimoTramo = tramosDelAnioAnterior[tramosDelAnioAnterior.length - 1]
    const punto = { i, v: s.anioAnterior }
    if (ultimoTramo && ultimoTramo[ultimoTramo.length - 1].i === i - 1) ultimoTramo.push(punto)
    else tramosDelAnioAnterior.push([punto])
  })

  const contenedor = useRef<HTMLDivElement>(null)
  const elegirPorPosicion = (clientX: number) => {
    const caja = contenedor.current?.getBoundingClientRect()
    if (!caja) return
    const proporcion = Math.min(1, Math.max(0, (clientX - caja.left) / caja.width))
    onElegir(Math.round(proporcion * SEMANAS))
  }

  // El rótulo de la semana en curso va del lado contrario al de la última
  // semana completa, que está pegada: si no, se pisan.
  const actualMasAlta = y(actual.total) < y(completas[ultima].total)
  const rotulos = [
    { i: mayor, texto: numero(completas[mayor].total), arriba: !(mayor === ultima && actualMasAlta), tono: "text-slate-900" },
    ...(conFeriado && conFeriado.i !== mayor
      ? [{
          i: conFeriado.i,
          texto: `${numero(conFeriado.s.total)} · feriado ${diaYMes(conFeriado.s.feriado!.fecha)}`,
          arriba: false,
          tono: "text-tema-papeles",
        }]
      : []),
    ...(ultima !== mayor && ultima !== conFeriado?.i
      ? [{ i: ultima, texto: numero(completas[ultima].total), arriba: !actualMasAlta, tono: "text-slate-900" }]
      : []),
  ]

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="m-0 text-sm font-semibold text-slate-900">Semana por semana</h3>
        <span className="text-xs text-slate-500">últimas {SEMANAS} semanas, de lunes a domingo</span>
      </div>
      <Leyenda>
        <ItemDeLeyenda muestra={<span className="w-[18px] border-t-[2.5px] border-tema-pacientes" />}>
          {referencia.getFullYear()}
        </ItemDeLeyenda>
        <ItemDeLeyenda muestra={<span className="w-[18px] border-t-2 border-dashed border-slate-300" />}>
          las mismas semanas de {anioAnterior}
        </ItemDeLeyenda>
        <ItemDeLeyenda muestra={<span className="w-[18px] border-t border-dotted border-slate-400" />}>
          promedio: {numero(Math.round(promedio))}
        </ItemDeLeyenda>
        <ItemDeLeyenda muestra={<span className="h-[9px] w-[9px] rounded-full bg-feriado" />}>
          semana con feriado
        </ItemDeLeyenda>
      </Leyenda>

      <div className="relative ml-8 mr-1.5 mt-2" style={{ height: ALTO + 22 }}>
        {/* Eje Y: las marcas, afuera a la izquierda. */}
        {marcas.map((m) => (
          <span
            key={m}
            className="absolute -left-8 w-7 -translate-y-1/2 text-right text-[11px] tabular-nums text-slate-500"
            style={{ top: y(m) }}
          >
            {numero(m)}
          </span>
        ))}
        <div
          ref={contenedor}
          role="slider"
          tabIndex={0}
          aria-label="Semana elegida"
          aria-valuemin={0}
          aria-valuemax={SEMANAS}
          aria-valuenow={elegida}
          aria-valuetext={nombreDeSemana(semanas[elegida].lunes)}
          onClick={(e) => elegirPorPosicion(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onElegir(Math.max(0, elegida - 1))
            if (e.key === "ArrowRight") onElegir(Math.min(SEMANAS, elegida + 1))
          }}
          className="absolute inset-x-0 top-0 cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-[#204983]/40"
          style={{ height: ALTO }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none" aria-hidden="true">
            {marcas.map((m) => (
              <line key={m} x1={0} x2={100} y1={y(m)} y2={y(m)} className="stroke-slate-200" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={100} y1={y(promedio)} y2={y(promedio)} className="stroke-slate-400" strokeWidth={1} strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
            {tramosDelAnioAnterior.map((tramo) => (
              <polyline
                key={tramo[0].i}
                points={tramo.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
                fill="none"
                className="stroke-slate-300"
                strokeWidth={2}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polyline
              points={completas.map((s, i) => `${x(i)},${y(s.total)}`).join(" ")}
              fill="none"
              className="inicio-se-dibuja stroke-tema-pacientes"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* La semana que se está mirando. */}
          <span
            aria-hidden="true"
            className="absolute -top-1.5 bottom-0 -ml-px border-l-2 border-[#a9bdd9] transition-[left] duration-300 motion-reduce:transition-none"
            style={{ left: `${x(elegida)}%` }}
          />
          {completas.map((s, i) => (
            <span
              key={iso(s.lunes)}
              title={`Semana del ${diaYMes(s.lunes)}: ${numero(s.total)} pacientes${s.feriado ? ` · feriado ${diaYMes(s.feriado.fecha)}` : ""}`}
              className={`absolute -ml-[4.5px] -mt-[4.5px] h-[9px] w-[9px] rounded-full border-2 border-white ${s.feriado ? "bg-feriado" : "bg-tema-pacientes"}`}
              style={{ left: `${x(i)}%`, top: y(s.total) }}
            />
          ))}
          <span
            title={`${esActual ? "Esta semana" : "La última semana"}, hasta el ${DIAS[diaDeLaSemana(referencia)]}: ${numero(actual.total)}`}
            className="absolute -ml-[5.5px] -mt-[5.5px] h-[11px] w-[11px] rounded-full border-2 border-tema-pacientes bg-white"
            style={{ left: "100%", top: y(actual.total) }}
          />
          {rotulos.map((r) => {
            const punto = y(completas[r.i].total)
            // Si abajo no entra (el punto está contra el piso), va arriba; y
            // si arriba no entra (contra el techo), abajo.
            const arriba = r.arriba ? punto - 22 >= -14 : punto + 22 > ALTO
            // Contra los bordes no se centra: se cortaría.
            const corrimiento = r.i < 3 ? "translate-x-0" : r.i > SEMANAS - 4 ? "-translate-x-full" : "-translate-x-1/2"
            return (
              <span
                key={r.i}
                className={`absolute whitespace-nowrap bg-white/85 px-0.5 text-[11px] font-semibold tabular-nums ${corrimiento} ${r.tono}`}
                style={{ left: `${x(r.i)}%`, top: arriba ? punto - 22 : punto + 8 }}
              >
                {r.texto}
              </span>
            )
          })}
          <span
            className="absolute -translate-x-full whitespace-nowrap bg-white/85 px-0.5 text-right text-[11px] font-semibold tabular-nums text-tema-pacientes"
            style={{ left: "100%", top: actualMasAlta ? Math.max(-14, y(actual.total) - 22) : Math.min(ALTO - 14, y(actual.total) + 8) }}
          >
            {numero(actual.total)} {esActual ? "a la fecha" : `hasta el ${referencia.getDate()}`}
          </span>
        </div>
        {/* Eje X: una fecha cada cuatro semanas. */}
        {semanas.map((s, i) =>
          i % 4 === 0 || i === SEMANAS ? (
            <span
              key={iso(s.lunes)}
              className={`absolute ${i === SEMANAS ? "-translate-x-full" : "-translate-x-1/2"} whitespace-nowrap text-[11px] text-slate-500 ${i % 8 === 4 || i === SEMANAS - 2 ? "@max-[600px]:hidden" : ""}`}
              style={{ left: `${x(i)}%`, top: ALTO + 4 }}
            >
              {i === SEMANAS && esActual ? "esta" : diaYMes(s.lunes)}
            </span>
          ) : null,
        )}
      </div>
      <p className="m-0 text-xs text-slate-500">
        Tocá el gráfico en cualquier lugar: se elige la semana más cercana y se ve día por día al lado.
        La línea vertical marca la que estás mirando.
      </p>
    </div>
  )
}

function SemanaElegida({
  semana,
  indice,
  onMover,
  serie,
  esActual,
}: {
  semana: Semana
  indice: number
  onMover: (indice: number) => void
  serie: ReturnType<typeof useSerie>
  esActual: boolean
}) {
  const { referencia, delDia, feriados } = serie
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = sumarDias(semana.lunes, i)
    const paso = d <= referencia
    const anteriores = Array.from({ length: SEMANAS_PARA_LO_NORMAL }, (_, w) => delDia(sumarDias(d, -7 * (w + 1))))
      .filter((v): v is number => v !== null)
    return {
      d,
      valor: paso ? delDia(d) ?? 0 : null,
      normal: anteriores.length ? anteriores.reduce((a, v) => a + v, 0) / anteriores.length : null,
      esHoy: esActual && iso(d) === iso(referencia),
      feriado: feriados.get(iso(d)) ?? null,
    }
  })
  const maximo = Math.max(1, ...dias.map((x) => Math.max(x.valor ?? 0, x.normal ?? 0)))
  const ALTO = 140
  const enCurso = esActual && semana.parcial

  // Lo que se ve en el gráfico, dicho en una línea: los días que se salieron
  // de lo normal (un 15 % o más) y, si es la semana en curso, cómo va hoy.
  const notas: string[] = []
  const salidos = dias
    .filter((x) => x.valor !== null && x.normal !== null && x.normal >= 3 && !x.esHoy)
    .map((x) => ({ ...x, desvio: (x.valor! - x.normal!) / x.normal! }))
    .filter((x) => Math.abs(x.desvio) >= 0.15)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
    .slice(0, 2)
  for (const x of salidos) {
    const nombre = `El ${DIAS[diaDeLaSemana(x.d)]}`
    const cifras = `(${numero(x.valor!)} contra ${numero(Math.round(x.normal!))})`
    if (x.feriado && x.desvio < 0) notas.push(`${nombre} fue feriado, ${x.feriado} ${cifras}.`)
    else notas.push(`${nombre} vino por ${x.desvio > 0 ? "encima" : "debajo"} de lo normal ${cifras}.`)
  }
  const hoy = dias.find((x) => x.esHoy)
  if (hoy) notas.push(`Hoy va ${numero(hoy.valor ?? 0)} y el día no terminó.`)
  if (notas.length === 0) notas.push("Todos los días vinieron dentro de lo normal.")

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="m-0 text-sm font-semibold text-slate-900">{nombreDeSemana(semana.lunes)}</h3>
        {enCurso ? <span className="text-xs text-slate-500">en curso</span> : null}
      </div>
      <Leyenda>
        <ItemDeLeyenda muestra={<span className="w-3.5 border-t-2 border-slate-900" />}>
          un día normal: promedio de ese día en las últimas {SEMANAS_PARA_LO_NORMAL} semanas
        </ItemDeLeyenda>
      </Leyenda>
      <div className="mt-2 flex items-stretch gap-1">
        <Flecha direccion="anterior" etiqueta="Semana anterior" disabled={indice === 0} onClick={() => onMover(indice - 1)} />
        <div className="flex min-w-0 flex-1 items-end gap-[3%]">
          {dias.map((x, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className={`text-xs font-semibold tabular-nums ${x.valor === null ? "font-normal text-slate-400" : x.esHoy ? "text-tema-pacientes" : "text-slate-900"}`}>
                {x.valor === null ? "–" : numero(x.valor)}
              </span>
              <span
                title={x.feriado ? `Feriado: ${x.feriado}` : undefined}
                className={`relative flex w-full items-end rounded-md ${
                  x.valor === null
                    ? "border border-dashed border-slate-200"
                    : x.esHoy
                      ? "bg-[#eef2f7] outline outline-1 outline-[#a9bdd9]"
                      : "bg-slate-100"
                }`}
                style={{ height: ALTO }}
              >
                {x.valor !== null ? (
                  <span
                    className={`inicio-crece-alto block w-full rounded-t-md transition-[height] duration-300 motion-reduce:transition-none ${x.feriado ? "bg-feriado" : "bg-tema-pacientes"}`}
                    style={{
                      height: (x.valor / maximo) * ALTO,
                      animationDelay: `${i * 15}ms`,
                      ...(x.esHoy
                        ? { background: "repeating-linear-gradient(135deg, var(--color-tema-pacientes) 0 6px, var(--color-tema-pacientes-claro) 6px 9px)" }
                        : {}),
                    }}
                  />
                ) : null}
                {x.normal !== null ? (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-x-0.5 border-t-2 border-slate-900 transition-[bottom] duration-300 motion-reduce:transition-none"
                    style={{ bottom: (x.normal / maximo) * ALTO - 1 }}
                  />
                ) : null}
              </span>
              <span
                className={`text-center text-[11px] leading-tight ${
                  x.esHoy ? "font-semibold text-tema-pacientes" : x.feriado ? "text-tema-papeles" : x.valor === null ? "text-slate-500" : "text-slate-600"
                }`}
              >
                {x.esHoy ? "Hoy" : DIAS_CORTOS[i]}
                <br />
                {x.d.getDate()}
              </span>
            </div>
          ))}
        </div>
        <Flecha direccion="siguiente" etiqueta="Semana siguiente" disabled={indice === SEMANAS} onClick={() => onMover(indice + 1)} />
      </div>
      <p className="m-0 text-xs text-slate-500">{notas.join(" ")}</p>
    </div>
  )
}

function MesPorMes({ serie, esActual }: { serie: ReturnType<typeof useSerie>; esActual: boolean }) {
  const { referencia, suma } = serie
  const meses = Array.from({ length: 12 }, (_, k) => {
    const primero = new Date(referencia.getFullYear(), referencia.getMonth() - (11 - k), 1, 12)
    const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0, 12)
    const enCurso = k === 11
    const hasta = enCurso ? referencia : ultimo
    const primeroAntes = new Date(primero.getFullYear() - 1, primero.getMonth(), 1, 12)
    const ultimoAntes = new Date(primeroAntes.getFullYear(), primeroAntes.getMonth() + 1, 0, 12)
    const hastaAntes = enCurso
      ? new Date(primeroAntes.getFullYear(), primeroAntes.getMonth(), Math.min(referencia.getDate(), ultimoAntes.getDate()), 12)
      : ultimoAntes
    return {
      primero,
      enCurso: enCurso && (esActual || referencia.getDate() !== ultimo.getDate()),
      dia: referencia.getDate(),
      valor: suma(primero, hasta),
      anterior: suma(primeroAntes, hastaAntes),
    }
  })
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.valor, m.anterior]))
  const corto = (m: (typeof meses)[number]) => `${MESES_CORTOS[m.primero.getMonth()]} ’${String(m.primero.getFullYear()).slice(2)}`
  const rayado = "repeating-linear-gradient(135deg, var(--color-tema-pacientes) 0 3px, var(--color-tema-pacientes-claro) 3px 5px)"
  const ALTO = 150

  return (
    <div className="flex min-w-0 flex-col gap-2.5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="m-0 text-sm font-semibold text-slate-900">Mes por mes</h3>
        <span className="text-xs text-slate-500">cada mes contra el mismo mes del año anterior</span>
      </div>
      <Leyenda>
        <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-tema-pacientes" />}>este año</ItemDeLeyenda>
        <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />}>el año anterior</ItemDeLeyenda>
        {meses[11].enCurso ? (
          <ItemDeLeyenda muestra={<span className="h-2.5 w-2.5 rounded-sm" style={{ background: rayado }} />}>
            mes en curso, hasta hoy
          </ItemDeLeyenda>
        ) : null}
      </Leyenda>

      {/* En la computadora, barras de a pares con su número siempre. */}
      <div className="mt-1 hidden items-end gap-[2%] @min-[600px]:flex">
        {meses.map((m, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-slate-900">{numero(m.valor)}</span>
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height: ALTO }}>
              <span
                title={`${MESES_CORTOS[m.primero.getMonth()]} ${m.primero.getFullYear() - 1}: ${numero(m.anterior)}`}
                className="inicio-crece-alto w-[38%] rounded-t-[3px] bg-slate-300"
                style={{ height: (m.anterior / maximo) * ALTO, animationDelay: `${i * 30}ms` }}
              />
              <span
                title={`${MESES_CORTOS[m.primero.getMonth()]} ${m.primero.getFullYear()}: ${numero(m.valor)}`}
                className="inicio-crece-alto w-[38%] rounded-t-[3px] bg-tema-pacientes"
                style={{ height: (m.valor / maximo) * ALTO, animationDelay: `${i * 30 + 15}ms`, ...(m.enCurso ? { background: rayado } : {}) }}
              />
            </div>
            <span className={`text-center text-[11px] leading-tight ${m.enCurso ? "font-semibold text-tema-pacientes" : "text-slate-500"}`}>
              {MESES_CORTOS[m.primero.getMonth()]}
              <br />
              {m.enCurso ? `al ${m.dia}` : `’${String(m.primero.getFullYear()).slice(2)}`}
            </span>
          </div>
        ))}
      </div>

      {/* En el celular, una lista: el mes más nuevo arriba, los dos números y la diferencia. */}
      <div className="mt-1 flex flex-col gap-2 @min-[600px]:hidden">
        {[...meses].reverse().map((m, i) => (
          <div key={i} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1">
            <span className={`text-xs leading-tight ${m.enCurso ? "font-semibold text-tema-pacientes" : "text-slate-600"}`}>
              {corto(m)}
              {m.enCurso ? (
                <>
                  <br />
                  <span className="font-normal">al {m.dia}</span>
                </>
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span
                className="inicio-crece-ancho block h-2 rounded-r-[3px] bg-tema-pacientes"
                style={{ width: `${(m.valor / maximo) * 100}%`, ...(m.enCurso ? { background: rayado } : {}) }}
              />
              <span className="inicio-crece-ancho block h-2 rounded-r-[3px] bg-slate-300" style={{ width: `${(m.anterior / maximo) * 100}%` }} />
            </span>
            <span className="text-right text-xs leading-snug tabular-nums">
              <strong className="text-slate-900">{numero(m.valor)}</strong>{" "}
              {/* Un mes del año anterior en cero es un mes sin datos: no hay
                  contra qué comparar. */}
              <Diferencia valor={m.valor} contra={m.anterior || null} sentido="mas-es-mejor" porcentual compacta />
              <br />
              <span className="text-slate-500">{m.anterior ? numero(m.anterior) : "sin datos"}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PacientesAtendidos({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const serie = useSerie(datos)
  const { referencia, suma, feriadoEntre } = serie
  const p = datos.pacientes
  const esActual = datos.es_mes_actual

  const semanas: Semana[] = useMemo(() => {
    const lunesActual = lunesDe(referencia)
    return Array.from({ length: SEMANAS + 1 }, (_, i) => {
      const lunes = sumarDias(lunesActual, -7 * (SEMANAS - i))
      const parcial = i === SEMANAS
      const fin = parcial ? referencia : sumarDias(lunes, 6)
      return {
        lunes,
        total: suma(lunes, fin),
        anioAnterior: suma(sumarDias(lunes, -364), sumarDias(lunes, -358)),
        feriado: feriadoEntre(lunes, sumarDias(lunes, 6)),
        parcial,
      }
    })
  }, [referencia, suma, feriadoEntre])

  // Al abrir, la semana en curso (o la última del mes cerrado).
  const [elegida, setElegida] = useState(SEMANAS)
  useEffect(() => setElegida(SEMANAS), [datos.referencia])

  const diaDeHoy = diaDeLaSemana(referencia)
  const primero = new Date(referencia.getFullYear(), referencia.getMonth(), 1, 12)
  const deLunesA = diaDeHoy === 0 ? "el lunes" : `de lunes a ${DIAS[diaDeHoy]}`
  const crecimiento = p.crecimiento

  const cifras = [
    p.hoy && {
      titulo: `Hoy, ${DIAS[diaDeHoy]} ${referencia.getDate()}`,
      valor: p.hoy.valor,
      grande: true,
      nota: "el día no terminó",
      diferencia: (
        <Diferencia
          valor={p.hoy.valor}
          contra={p.hoy.a_esta_hora === null ? null : Math.round(p.hoy.a_esta_hora)}
          sentido="mas-es-mejor"
          contraTexto={`que los ${enPlural(DIAS[diaDeHoy])} anteriores a esta hora`}
        />
      ),
    },
    p.semana && {
      titulo: "Esta semana",
      valor: p.semana.valor,
      nota: deLunesA,
      diferencia: (
        <Diferencia valor={p.semana.valor} contra={p.semana.semana_pasada} sentido="mas-es-mejor" contraTexto={`que ${deLunesA} de la semana pasada`} />
      ),
    },
    {
      titulo: esActual ? "Este mes" : "El mes",
      valor: p.mes.valor,
      nota: tramo(iso(primero), datos.referencia),
      diferencia: (
        <Diferencia
          valor={p.mes.valor}
          contra={p.mes.comparacion === null ? null : Math.round(p.mes.comparacion)}
          sentido="mas-es-mejor"
          contraTexto={`que ${contraQue(datos.comparacion.meses)}`}
        />
      ),
    },
    {
      titulo: "Crecimiento",
      texto: crecimiento.porcentaje === null ? "—" : porcentaje(crecimiento.porcentaje),
      nota: `últimas ${crecimiento.semanas} semanas`,
      diferencia: (
        <span
          className={`text-xs font-semibold ${
            crecimiento.porcentaje === null || crecimiento.porcentaje === 0
              ? "text-diferencia-neutra"
              : crecimiento.porcentaje > 0
                ? "text-diferencia-mejor"
                : "text-diferencia-peor"
          }`}
        >
          {crecimiento.anio_anterior
            ? `${numero(crecimiento.valor)} contra ${numero(crecimiento.anio_anterior)} en las mismas semanas de ${referencia.getFullYear() - 1}`
            : `Sin datos de las mismas semanas de ${referencia.getFullYear() - 1}`}
        </span>
      ),
    },
  ].filter(Boolean) as Array<{
    titulo: string
    valor?: number
    texto?: string
    grande?: boolean
    nota: string
    diferencia: React.ReactNode
  }>

  return (
    <Bloque tema="pacientes" posicion={posicion} className="gap-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <TituloDeBloque tema="pacientes" icono={Users}>
          Pacientes atendidos
        </TituloDeBloque>
        <span className="text-xs text-slate-500">cada paciente cuenta una vez por día</span>
      </div>

      <div
        className={`grid grid-cols-1 gap-x-6 gap-y-4 border-b border-slate-100 pb-4 @min-[450px]:grid-cols-2 ${
          cifras.length === 4 ? "@min-[960px]:grid-cols-4" : ""
        }`}
      >
        {cifras.map((c) => (
          <div key={c.titulo} className="flex min-w-0 flex-col gap-1">
            <span className="text-[13px] text-slate-600">{c.titulo}</span>
            {c.valor !== undefined ? (
              <Cifra valor={c.valor} className={`leading-none text-slate-900 ${c.grande ? "text-[40px]" : "text-[26px]"}`} />
            ) : (
              <strong className="whitespace-nowrap text-[26px] leading-none tabular-nums text-slate-900">{c.texto}</strong>
            )}
            <span className="text-xs text-slate-500">{c.nota}</span>
            {c.diferencia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 @min-[960px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SemanaPorSemana semanas={semanas} elegida={elegida} onElegir={setElegida} esActual={esActual} referencia={referencia} />
        <SemanaElegida semana={semanas[elegida]} indice={elegida} onMover={setElegida} serie={serie} esActual={esActual} />
      </div>

      <MesPorMes serie={serie} esActual={esActual} />
    </Bloque>
  )
}
