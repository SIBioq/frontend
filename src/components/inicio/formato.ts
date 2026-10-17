/**
 * Cómo se escriben los números y las fechas del inicio.
 *
 * Todo en castellano y con el formato de acá: coma decimal, punto de miles,
 * "del 1 al 15 de octubre". Las fechas llegan como "AAAA-MM-DD" y se leen como
 * fecha local: `new Date("2026-10-15")` sería medianoche UTC, que en Córdoba
 * es el 14 a las 21.
 */

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]

/** "AAAA-MM-DD" a Date local, a mediodía (así sumar días no cruza un cambio de hora). */
export const fecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(a, m - 1, d, 12)
}

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const sumarDias = (d: Date, dias: number) => {
  const otra = new Date(d)
  otra.setDate(otra.getDate() + dias)
  return otra
}

/** 0 = lunes … 6 = domingo. */
export const diaDeLaSemana = (d: Date) => (d.getDay() + 6) % 7

export const lunesDe = (d: Date) => sumarDias(d, -diaDeLaSemana(d))

export const diasEntre = (desde: Date, hasta: Date) =>
  Math.round((hasta.getTime() - desde.getTime()) / 86_400_000)

export const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

export const numero = (n: number, decimales = 0) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: decimales, minimumFractionDigits: 0 })

const FORMATO_DE_PLATA = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
})

export const plata = (valor: string | number | null | undefined) =>
  FORMATO_DE_PLATA.format(typeof valor === "number" ? valor : Number.parseFloat(valor || "0"))

export const aNumero = (valor: string | number | null | undefined) =>
  typeof valor === "number" ? valor : Number.parseFloat(valor || "0")

/** "+14 %", "−3,5 %", "0 %". */
export const porcentaje = (n: number, conSigno = true) => {
  const texto = numero(Math.abs(n), Math.abs(n) < 10 ? 1 : 0)
  if (!conSigno || n === 0) return `${texto} %`
  return `${n > 0 ? "+" : "−"}${texto} %`
}

/** Una duración en segundos como la lee una persona: "1 d 4 h", "3 h", "45 min". */
export const duracion = (segundos: number | null | undefined) => {
  if (segundos === null || segundos === undefined) return "—"
  const minutos = Math.round(Math.abs(segundos) / 60)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `${horas} h`
  const dias = Math.floor(horas / 24)
  const resto = horas % 24
  return resto ? `${dias} d ${resto} h` : `${dias} d`
}

/** "del 1 al 15 de octubre"; si el tramo cruza de mes, "del 28 de septiembre al 4 de octubre". */
export const tramo = (desde: string, hasta: string) => {
  const d = fecha(desde)
  const h = fecha(hasta)
  if (d.getMonth() === h.getMonth()) {
    return `del ${d.getDate()} al ${h.getDate()} de ${MESES[h.getMonth()]}`
  }
  return `del ${d.getDate()} de ${MESES[d.getMonth()]} al ${h.getDate()} de ${MESES[h.getMonth()]}`
}

/** "Semana del 12 al 18 de octubre". */
export const nombreDeSemana = (lunes: Date) => `Semana ${tramo(iso(lunes), iso(sumarDias(lunes, 6)))}`

export const nombreDelMes = (anio: number, mes: number) => `${capitalizar(MESES[mes - 1])} ${anio}`

/**
 * Contra qué se compara lo que se acumula, en palabras.
 *
 * Con un mes: "del 1 al 15 de septiembre". Con varios: "el promedio de los
 * últimos 3 meses, del 1 al 15". Sin tramos (no debería pasar): "antes".
 */
export const contraQue = (meses: Array<{ desde: string; hasta: string }>) => {
  if (meses.length === 0) return "antes"
  if (meses.length === 1) return tramo(meses[0].desde, meses[0].hasta)
  const hasta = fecha(meses[0].hasta).getDate()
  return `el promedio de los últimos ${meses.length} meses, del 1 al ${hasta}`
}

/** Con qué se comparan los tiempos: "los cerrados en septiembre" o el promedio. */
export const contraQueCerrados = (meses: Array<{ desde: string; hasta: string }>) => {
  if (meses.length === 1) return `los cerrados en ${MESES[fecha(meses[0].desde).getMonth()]}`
  return `el promedio de los cerrados en los últimos ${meses.length} meses`
}
