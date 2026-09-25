import type {
  BioUnitValue,
  NamedReferenceRange,
  ReferenceRange,
  ReferenceRangeEvaluation,
  ReferenceValues,
} from "@/types"

const referenceGroupLabels: Record<string, string> = {
  hombre_mayor: "Hombre adulto",
  mujer_mayor: "Mujer adulta",
  nino: "Niño",
  nina: "Niña",
  neonato: "Neonato",
}

export const formatReferenceGroup = (group: string): string => referenceGroupLabels[group] || group

const analysisCategoryLabels: Record<string, string> = {
  pmo: "PMO",
  pe: "PE",
  gestion: "Gestión",
}

/** Etiqueta legible de la categoría NBU del análisis ("" o desconocida → ""). */
export const formatAnalysisCategory = (category?: string): string =>
  category ? analysisCategoryLabels[category] || category : ""

/**
 * Los límites de un rango, como se leen.
 *
 * El rango puede ser abierto: con un solo límite es `≥ 4,5` o `≤ 5,9`, y con
 * el límite destildado, `> 4,5` o `< 5,9`. Mostrarlo como `4,5 - -` decía otra
 * cosa que el papel que se lleva el paciente.
 *
 * Los signos tienen que ser los mismos que usa el backend para EVALUAR: la
 * regla vive en `laboratory/catalog/rangos.py` y esta es su copia. Antes acá
 * decía `>` para un rango que allá se evaluaba como `≥`.
 */
export interface LimitesDelRango {
  /** El mínimo entra en el rango: `≥` si es true, `>` si es false. */
  min_inclusive?: boolean
  /** El máximo entra en el rango: `≤` si es true, `<` si es false. */
  max_inclusive?: boolean
}

/**
 * Un límite contra el que se pueda comparar.
 *
 * En el catálogo hay 1294 «límites» que no son números: «No reactivo»,
 * «Negativo», «Normal». No son un umbral sino el valor de referencia entero, y
 * ponerles un signo adelante no dice nada — el informe llegó a imprimir
 * "≤ No reactivo". Misma regla que `es_un_numero` en el backend.
 */
const esUnNumero = (valor: string): boolean =>
  valor !== "" && !Number.isNaN(Number(valor.replace(",", ".")))

export const formatReferenceBounds = (
  minValue?: string,
  maxValue?: string,
  limites?: LimitesDelRango,
): string => {
  const min = (minValue || "").trim()
  const max = (maxValue || "").trim()
  // Por defecto el límite entra, que es como el sistema evaluó siempre: un
  // rango viejo, sin las banderas, se escribe igual que como se evalúa.
  const minEntra = limites?.min_inclusive ?? true
  const maxEntra = limites?.max_inclusive ?? true
  const signoMin = minEntra ? "≥" : ">"
  const signoMax = maxEntra ? "≤" : "<"

  if (min && max) {
    if (min === max) return min
    if (minEntra && maxEntra) return `${min} - ${max}`
    // Con una punta afuera se escriben las DOS: `40 - 200` con el 200 excluido
    // sería mentira, y el signo en una sola punta deja dudando de la otra.
    return `${signoMin} ${min} - ${signoMax} ${max}`
  }
  // Un límite solo que no es número va tal cual, sin signo.
  if (min) return esUnNumero(min) ? `${signoMin} ${min}` : min
  if (max) return esUnNumero(max) ? `${signoMax} ${max}` : max
  return ""
}

const sexoLabels: Record<string, string> = { male: "Hombre", female: "Mujer", any: "Ambos sexos" }
const edadLabels: Record<string, string> = { adult: "adulto", child: "niño/a", neonate: "neonato" }

/**
 * Cómo se llama el grupo de un rango.
 *
 * Los cuatro de la grilla tienen nombre fijo. El resto (sexo indistinto, un
 * tramo de edad) viene de las importaciones NBU y antes se mostraba con la
 * clave cruda, `any_adult`, o sin decir el tramo.
 */
const formatReferenceRangeGroup = (range: ReferenceRange): string => {
  const desde = range.age_min_years
  const hasta = range.age_max_years
  const tieneTramo = desde != null || hasta != null
  let nombre = referenceGroupLabels[range.group]
  if (!nombre || (tieneTramo && range.group !== "neonato")) {
    const sexo = sexoLabels[range.sex] || range.sex
    const edad = edadLabels[range.age_group] || range.age_group
    nombre = range.age_group === "neonate" ? "Neonato" : `${sexo} ${edad}`.trim()
  }
  if (!tieneTramo) return nombre
  const tramo =
    desde != null && hasta != null
      ? `${desde} a ${hasta} años`
      : desde != null
        ? `desde ${desde} años`
        : `hasta ${hasta} años`
  return `${nombre} (${tramo})`
}

export const formatReferenceRange = (range: ReferenceRange): string =>
  `${formatReferenceRangeGroup(range)}: ${formatReferenceBounds(range.min_value, range.max_value, range) || "-"}`

/** Un rango con nombre: el nombre lo puso el laboratorio y va tal cual. */
export const formatNamedReferenceRange = (range: NamedReferenceRange): string =>
  `${range.label}: ${formatReferenceBounds(range.min_value, range.max_value, range) || "-"}`

/** Los rangos con nombre que tengan algún límite, en orden. */
export const formatNamedReferenceRanges = (ranges?: NamedReferenceRange[]): string[] =>
  (ranges || [])
    .filter((range) => range.label && formatReferenceBounds(range.min_value, range.max_value, range))
    .map(formatNamedReferenceRange)

export const formatReferenceValues = (values?: ReferenceValues): string[] => {
  if (!values) return []

  return Object.entries(values)
    .filter(([, bounds]) => bounds && (bounds.min || bounds.max))
    .map(([group, bounds]) => `${formatReferenceGroup(group)}: ${formatReferenceBounds(bounds?.min, bounds?.max) || "-"}`)
}

export const formatBioUnitValues = (values?: BioUnitValue[]): string[] => {
  if (!values?.length) return []

  return [...values]
    .sort((a, b) => a.year - b.year)
    .map((item) => `${item.year}: ${item.value || "N/A"}`)
}

export const getReferenceEvaluationLabel = (evaluation?: ReferenceRangeEvaluation | null): string => {
  switch (evaluation?.status) {
    case "in_range":
      return "Dentro de rango"
    case "out_of_range":
      return "Fuera de rango"
    case "no_applicable_reference":
      return "Sin referencia aplicable"
    case "no_reference":
      return "Sin referencia"
    case "uncheckable":
      return "No evaluable"
    default:
      return "No evaluado"
  }
}

export const formatEvaluatedReference = (evaluation?: ReferenceRangeEvaluation | null): string | null => {
  if (!evaluation?.reference) return null
  return formatReferenceRange(evaluation.reference)
}
