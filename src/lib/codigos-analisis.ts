/**
 * Códigos de análisis: los que el sistema trata distinto, y cómo se comparan.
 *
 * El código dejó de ser un entero. La mayoría siguen siendo los 6 dígitos del
 * NBU, pero el laboratorio también carga prácticas propias con códigos como
 * `A15` o `INT-3`.
 *
 * Todo lo que antes hacía `Number(a.code) === 660001` está acá, porque esas
 * comparaciones no fallan cuando el código es alfanumérico: `Number("A15")` da
 * `NaN` y toda comparación con `NaN` es falsa. El acto bioquímico dejaría de
 * reconocerse como tal —se informaría al paciente, contaría como pendiente de
 * cargar— sin ningún error a la vista.
 *
 * Reemplaza a `acto-bioquimico.ts`: eran los mismos códigos escritos dos
 * veces, una como número y otra como texto.
 */

/** ACTO BIOQUÍMICO */
export const ACTO_BIOQUIMICO = "660001"
/** ACTO BIOQUÍMICO DE INTERNACIÓN (ABI) */
export const ACTO_BIOQUIMICO_INTERNACION = "661001"
/** ACTO BIOQUÍMICO COMPLEMENTARIO (ABC) */
export const ACTO_BIOQUIMICO_COMPLEMENTARIO = "662001"

/**
 * Ítems de facturación que no tienen un resultado real para cargar ni validar
 * (aunque el catálogo les arme una determinación de relleno). No cuentan como
 * "pendientes de cargar" en ninguna pantalla.
 */
export const ACTO_BIOQUIMICO_CODES = new Set([
  ACTO_BIOQUIMICO,
  ACTO_BIOQUIMICO_INTERNACION,
  ACTO_BIOQUIMICO_COMPLEMENTARIO,
])

/**
 * Los dos que se cargan en el ingreso: van primero en la lista de análisis. El
 * ABC se carga aparte.
 *
 * Cuál corresponde lo elige quien atiende. Hubo una regla que lo deducía del
 * código de la práctica y sumaba el acto común por su cuenta; se sacó porque
 * el acto es una decisión de facturación, no algo que el nomenclador conteste.
 */
export const ACTOS_DE_INGRESO = [ACTO_BIOQUIMICO, ACTO_BIOQUIMICO_INTERNACION]

export function normalizarCodigo(code: unknown): string {
  if (code === null || code === undefined) return ""
  return String(code).trim()
}

/**
 * Códigos a probar cuando quien ingresa el protocolo escribe sólo el sufijo
 * NBU: `5` representa `660005`, `412` representa `660412` y `1050`, `661050`.
 * El código literal va primero por si existe una práctica propia con ese valor.
 */
export function candidatosDeCodigo(code: unknown): string[] {
  const exacto = normalizarCodigo(code)
  if (!exacto) return []
  if (!/^\d{1,4}$/.test(exacto)) return [exacto]

  const codigoNbu = `66${exacto.padStart(4, "0")}`
  return codigoNbu === exacto ? [exacto] : [exacto, codigoNbu]
}

export function isActoBioquimico(code: unknown): boolean {
  return ACTO_BIOQUIMICO_CODES.has(normalizarCodigo(code))
}

export function esActoDeIngreso(code: unknown): boolean {
  return ACTOS_DE_INGRESO.includes(normalizarCodigo(code))
}

/** El número del código, o `null` si es alfanumérico. */
export function comoNumero(code: unknown): number | null {
  const texto = normalizarCodigo(code)
  if (!/^\d+$/.test(texto)) return null
  return Number(texto)
}

/**
 * Orden para mostrar: primero los numéricos por valor, después los
 * alfanuméricos alfabéticamente. Ordenar `A15` por su `Number` lo mandaría al
 * final de cualquier lista, en un lugar distinto cada vez.
 */
export function compararCodigos(a: unknown, b: unknown): number {
  const na = comoNumero(a)
  const nb = comoNumero(b)
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return normalizarCodigo(a).localeCompare(normalizarCodigo(b), "es")
}

export function mismoCodigo(a: unknown, b: unknown): boolean {
  return normalizarCodigo(a).toUpperCase() === normalizarCodigo(b).toUpperCase()
}
