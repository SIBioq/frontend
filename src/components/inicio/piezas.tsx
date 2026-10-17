import type { CSSProperties, ReactNode } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

import { ENTRADA_ABAJO } from "@/lib/entrada"
import { numero } from "./formato"
import { retraso, useCuenta } from "./movimiento"

export function Cifra({
  valor,
  formato = (n) => numero(Math.round(n)),
  className = "",
  style,
}: {
  valor: number
  formato?: (n: number) => string
  className?: string
  style?: CSSProperties
}) {
  const mostrado = useCuenta(valor)
  return (
    <strong className={`whitespace-nowrap tabular-nums ${className}`} style={style}>
      {formato(mostrado)}
    </strong>
  )
}

export type Sentido = "mas-es-mejor" | "mas-es-peor" | "neutro"

const COLOR_DE_DIFERENCIA = {
  mejor: "text-diferencia-mejor",
  peor: "text-diferencia-peor",
  neutra: "text-diferencia-neutra",
} as const

/**
 * La diferencia contra algo comparable, dicha entera: cuánto, para qué lado y
 * contra qué. «▲ 6 más que hace una semana (77)».
 *
 * El color sigue al significado y no al signo: más resultados por cargar es
 * rojo, más pacientes es verde, lo que no es bueno ni malo (facturado, listos
 * para facturar) va en gris. Siempre con flecha y texto, así no depende sólo
 * del color.
 */
export function Diferencia({
  valor,
  contra,
  sentido,
  contraTexto,
  formato = (n) => numero(n),
  mostrarContra = true,
  porcentual = false,
  palabras = { mas: "más", menos: "menos" },
  compacta = false,
  className = "",
}: {
  valor: number | null | undefined
  contra: number | null | undefined
  sentido: Sentido
  contraTexto?: string
  formato?: (n: number) => string
  mostrarContra?: boolean
  porcentual?: boolean
  palabras?: { mas: string; menos: string }
  compacta?: boolean
  className?: string
}) {
  if (valor === null || valor === undefined || contra === null || contra === undefined) {
    if (compacta) return null
    return (
      <span className={`text-xs text-slate-500 ${className}`}>
        {contraTexto ? `Todavía sin dato de ${contraTexto.replace(/^que /, "")}` : "Sin dato para comparar"}
      </span>
    )
  }

  const diferencia = valor - contra
  const relativa = contra !== 0 ? (diferencia / contra) * 100 : null
  const cantidad = porcentual ? relativa : diferencia
  const redondeada = cantidad === null ? null : Math.round(cantidad * 10) / 10
  const igual = redondeada !== null ? Math.abs(redondeada) < 0.5 : diferencia === 0

  if (igual) {
    return (
      <span className={`text-xs font-normal text-diferencia-neutra ${className}`}>
        = igual{!compacta && contraTexto ? ` ${contraTexto}` : ""}
      </span>
    )
  }

  const sube = diferencia > 0
  const tono =
    sentido === "neutro"
      ? "neutra"
      : (sube && sentido === "mas-es-mejor") || (!sube && sentido === "mas-es-peor")
        ? "mejor"
        : "peor"
  const monto =
    porcentual && relativa !== null
      ? `${numero(Math.abs(relativa), Math.abs(relativa) < 10 ? 1 : 0)} %`
      : formato(Math.abs(diferencia))

  return (
    <span className={`text-xs font-semibold ${COLOR_DE_DIFERENCIA[tono]} ${className}`}>
      {sube ? "▲" : "▼"} {monto}
      {!compacta && (
        <>
          {" "}
          {sube ? palabras.mas : palabras.menos}
          {contraTexto ? ` ${contraTexto}` : ""}
          {mostrarContra ? ` (${formato(contra)})` : ""}
        </>
      )}
    </span>
  )
}

export type Tema = "pacientes" | "plata" | "papeles" | "obras" | "tiempos" | "urgente"

// Clases enteras, no armadas con template: Tailwind sólo genera las que lee.
const FRANJA: Record<Tema, string> = {
  pacientes: "border-t-tema-pacientes",
  plata: "border-t-tema-plata",
  papeles: "border-t-tema-papeles",
  obras: "border-t-tema-obras",
  tiempos: "border-t-tema-tiempos",
  urgente: "border-t-tema-urgente",
}

const ICONO: Record<Tema, string> = {
  pacientes: "bg-tema-pacientes-suave text-tema-pacientes",
  plata: "bg-tema-plata-suave text-tema-plata",
  papeles: "bg-tema-papeles-suave text-tema-papeles",
  obras: "bg-tema-obras-suave text-tema-obras",
  tiempos: "bg-tema-tiempos-suave text-tema-tiempos",
  urgente: "bg-tema-urgente-suave text-tema-urgente",
}

export function TituloDeBloque({
  tema,
  icono: Icono,
  children,
  nota,
}: {
  tema: Tema
  icono: LucideIcon
  children: ReactNode
  nota?: ReactNode
}) {
  return (
    <h2 className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-slate-900">
      <span className={`inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg ${ICONO[tema]}`}>
        <Icono className="h-4 w-4" aria-hidden="true" />
      </span>
      {children}
      {nota ? <span className="text-xs font-normal text-slate-500">{nota}</span> : null}
    </h2>
  )
}

/** Una tarjeta del inicio: la franja de su tema arriba, del mismo vidrio que el resto de la app. */
export function Bloque({
  tema,
  posicion,
  children,
  className = "",
}: {
  tema: Tema
  posicion: number
  children: ReactNode
  className?: string
}) {
  return (
    <section
      style={retraso(posicion)}
      className={`flex min-w-0 flex-col gap-3 rounded-lg border border-t-[3px] border-slate-200 ${FRANJA[tema]} bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${ENTRADA_ABAJO} ${className}`}
    >
      {children}
    </section>
  )
}

/** "LO QUE SE MIRA TODO EL DÍA": el rótulo de cada grupo de bloques. */
export function Grupo({ children, posicion }: { children: ReactNode; posicion: number }) {
  return (
    <p
      style={retraso(posicion)}
      className={`-mb-2 mt-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-600 ${ENTRADA_ABAJO}`}
    >
      {children}
    </p>
  )
}

export function Leyenda({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{children}</div>
}

export function ItemDeLeyenda({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {muestra}
      {children}
    </span>
  )
}

/** Las flechas ‹ › de moverse de a una semana. */
export function Flecha({
  direccion,
  onClick,
  disabled,
  etiqueta,
}: {
  direccion: "anterior" | "siguiente"
  onClick: () => void
  disabled?: boolean
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className="w-6 flex-shrink-0 rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-[#204983] hover:text-[#204983] disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500"
    >
      {direccion === "anterior" ? "‹" : "›"}
    </button>
  )
}

/**
 * Un número que lleva a su lista: «11 en estado Información faltante ▼ 2  Ver →».
 * Toda la fila es el enlace; al pasar el mouse se marca el borde.
 */
export function RenglonConEnlace({
  valor,
  texto,
  diferencia,
  enlace,
  textoDelEnlace = "Ver →",
  aviso = false,
}: {
  valor: number
  texto: ReactNode
  diferencia?: ReactNode
  enlace: string
  textoDelEnlace?: string
  aviso?: boolean
}) {
  return (
    <Link
      to={enlace}
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm no-underline transition hover:border-[#204983] hover:shadow-[0_0_0_1px_#204983] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204983]/40 ${
        aviso ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-900"
      }`}
    >
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <Cifra valor={valor} className="text-xl leading-tight" />
        <span className={aviso ? "" : "text-slate-600"}>{texto}</span>
        {diferencia}
      </span>
      <span className={`whitespace-nowrap text-[13px] font-semibold ${aviso ? "" : "text-[#204983]"}`}>{textoDelEnlace}</span>
    </Link>
  )
}

/** Un dato suelto sobre gris: «Orden no presentada   7 ▼ 1». */
export function Dato({
  etiqueta,
  valor,
  diferencia,
  aviso = false,
  grande = false,
}: {
  etiqueta: ReactNode
  valor: number
  diferencia?: ReactNode
  aviso?: boolean
  grande?: boolean
}) {
  return (
    <span
      className={`flex items-center justify-between gap-2 rounded-md px-3 text-sm ${grande ? "py-1.5" : "py-2"} ${
        aviso ? "bg-amber-50 text-tema-papeles" : "bg-slate-50 text-slate-700"
      }`}
    >
      <span className={grande ? "font-medium" : aviso ? "" : "text-slate-600"}>{etiqueta}</span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <Cifra valor={valor} className={grande ? "text-lg" : ""} />
        {diferencia}
      </span>
    </span>
  )
}
