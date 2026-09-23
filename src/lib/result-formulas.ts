/**
 * Fórmulas de determinaciones calculadas.
 *
 * EL CÓDIGO VIENE DE LA BASE, NO DE LA POSICIÓN
 * =============================================
 * Una fórmula referencia a sus componentes por código: `([660475_003] * 10) /
 * [660475_001]`. Ese código lo genera el backend al crear la determinación y no
 * cambia nunca — ni al arrastrarla a otro lugar, ni al dar de baja a una
 * hermana.
 *
 * Hasta ahora el endpoint de resultados no mandaba `determination.code`, así
 * que acá se deducía de la POSICIÓN en la lista. Mientras nadie tocara el
 * análisis coincidía; apenas se reordenaba o se daba de baja una determinación,
 * las de abajo se corrían un lugar y pasaban a responder por el código de la
 * vecina. La fórmula seguía calculando —sin error, sin aviso— con el valor
 * equivocado.
 *
 * `inferredCodeForIndex` quedó SOLO como red para un backend viejo (las PC de
 * contingencia corren el suyo y pueden estar atrasadas). Si el código viene,
 * manda el código.
 */

type FormulaDetermination = {
  id: number
  code?: string
  name: string
  formula?: string
}

type FormulaAnalysis = {
  code: string
}

export type FormulaResult = {
  id: number
  determination: FormulaDetermination
  analysis: FormulaAnalysis
  /** Con esto encendido la fórmula no vuelve a pisar el valor. */
  carga_manual?: boolean
  /**
   * "No corresponde" en ESTE protocolo: la fila conserva su valor pero sale de
   * la cuenta. Ni se le calcula la fórmula ni sirve como componente de otra.
   */
  excluido?: boolean
}

export type FormulaValue = {
  value: string
  notes: string
}

export type FormulaCalculation = {
  value: string
  missingCodes: string[]
  /** Los faltantes que faltan porque su fila salió del protocolo —excluida, o
   *  vaciada en cascada por una exclusión—, no porque todavía no se cargaron. */
  codigosNoDisponibles: string[]
}

/** El número que hay adentro de lo que se escribió, tal cual se escribió. */
const extraerNumero = (value?: string): string | null => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim().replace(",", ".")
  if (!normalized) return null
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  return match ? match[0] : null
}

const toFormulaNumber = (value?: string): number | null => {
  const crudo = extraerNumero(value)
  if (crudo === null) return null
  const parsed = Number(crudo)
  return Number.isFinite(parsed) ? parsed : null
}

const decimalesDe = (crudo: string): number => {
  const punto = crudo.indexOf(".")
  return punto === -1 ? 0 : crudo.length - punto - 1
}

/**
 * LOS DECIMALES LOS PONEN LOS COMPONENTES, NO LA FÓRMULA
 * ======================================================
 * Antes toda fórmula salía con cuatro decimales fijos. Un índice calculado
 * sobre dos valores de dos decimales terminaba informado como `0.8571`, que
 * dice más precisión de la que se midió: los dos últimos dígitos los inventó la
 * división.
 *
 * Ahora se toma el componente con más decimales de los que entraron en la
 * cuenta —tres y dos dan tres— con un piso de dos, que es lo que se acostumbra
 * leer en el informe cuando los componentes son enteros. El techo está para que
 * un valor cargado con diez decimales no arrastre a la fórmula.
 */
const DECIMALES_MINIMOS = 2
const DECIMALES_MAXIMOS = 6

/** `"1.10"` -> `"1.1"`, `"3.00"` -> `"3"`. Un cero al final no es un dato. */
const recortarCerosDeLaDerecha = (texto: string): string => {
  if (!texto.includes(".")) return texto
  const recortado = texto.replace(/0+$/, "").replace(/\.$/, "")
  return recortado === "-0" ? "0" : recortado
}

const formatFormulaNumber = (value: number, decimalesDeLosComponentes: number[]): string => {
  if (!Number.isFinite(value)) return ""
  const pedidos = decimalesDeLosComponentes.length ? Math.max(...decimalesDeLosComponentes) : 0
  const decimales = Math.min(Math.max(pedidos, DECIMALES_MINIMOS), DECIMALES_MAXIMOS)
  return recortarCerosDeLaDerecha(value.toFixed(decimales))
}

const normalizeExpression = (formula: string): string => {
  const expression = formula.includes("=") ? formula.slice(formula.indexOf("=") + 1) : formula

  return expression
    .replace(/[×·]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/\^/g, "**")
}

const inferredCodeForIndex = (analysisCode: string, index: number): string =>
  `${analysisCode}_${String(index + 1).padStart(3, "0")}`

const buildResultCodeMap = (results: FormulaResult[]): Map<number, string> => {
  const byAnalysis = new Map<string, FormulaResult[]>()

  results.forEach((result) => {
    const list = byAnalysis.get(result.analysis.code) || []
    list.push(result)
    byAnalysis.set(result.analysis.code, list)
  })

  const resultCodes = new Map<number, string>()
  byAnalysis.forEach((analysisResults, analysisCode) => {
    analysisResults.forEach((result, index) => {
      // El código real primero. La posición solo si no vino ninguno.
      resultCodes.set(result.id, result.determination.code || inferredCodeForIndex(analysisCode, index))
    })
  })

  return resultCodes
}

/**
 * Los códigos del análisis indexados por su número: `1 → "660475_001"`.
 *
 * Es lo que hace que `[cod_1]` encuentre a su determinación sin depender de
 * cómo esté escrito el código. Los 1519 que ya están cargados usan tres
 * dígitos, pero las que se crearon desde la app quedaron con dos
 * (`660475_07`), y rellenar a mano hasta tres no las encontraba nunca.
 */
const buildCodesByNumber = (
  results: FormulaResult[],
  analysisCode: string,
): Map<number, string> => {
  const porNumero = new Map<number, string>()

  results.forEach((result) => {
    if (result.analysis.code !== analysisCode) return
    const code = result.determination.code
    if (!code) return
    const sufijo = code.split("_").pop()
    if (!sufijo || !/^\d+$/.test(sufijo)) return
    porNumero.set(Number(sufijo), code)
  })

  return porNumero
}

const resolveRelativeCode = (
  code: string,
  currentAnalysisCode: string,
  codesByNumber: Map<number, string>,
): string => {
  const relativeMatch = code.match(/^cod_(\d+)$/i)
  if (!relativeMatch) return code

  const real = codesByNumber.get(Number(relativeMatch[1]))
  if (real) return real

  // Sin código real a la vista (backend viejo): se arma como se armaba antes.
  return `${currentAnalysisCode}_${relativeMatch[1].padStart(3, "0")}`
}

const evaluateExpression = (expression: string): number | null => {
  if (!/^[\d+\-*/().\s*]+$/.test(expression)) return null

  try {
    const result = Function(`"use strict"; return (${expression})`)()
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

/**
 * UN FALTANTE NO ES IGUAL A OTRO
 * ==============================
 * "Todavía no se cargó" y "salió del protocolo" llegaban los dos como un código
 * en `missingCodes`, y quien llamaba no podía distinguirlos: el primero tiene
 * que dejar el valor que haya en pantalla (se está tipeando), el segundo tiene
 * que vaciarlo. Por eso los indisponibles van también en `codigosNoDisponibles`.
 *
 * `idsNoDisponibles` son las filas que, sin estar `excluido`, dejaron de tener
 * valor por una exclusión: las fórmulas vaciadas en cascada. Quien recorre las
 * pasadas las va juntando y las vuelve a pasar acá.
 */
export const calculateFormulaValue = (
  result: FormulaResult,
  allResults: FormulaResult[],
  values: Record<number, FormulaValue>,
  opciones: { idsNoDisponibles?: ReadonlySet<number> } = {},
): FormulaCalculation | null => {
  const formula = result.determination.formula?.trim()
  if (!formula) return null

  const codeByResult = buildResultCodeMap(allResults)
  const resultIdByCode = new Map<string, number>()
  codeByResult.forEach((code, resultId) => {
    resultIdByCode.set(code, resultId)
  })

  const missingCodes: string[] = []
  const codigosNoDisponibles: string[] = []
  const decimalesDeLosComponentes: number[] = []
  const codesByNumber = buildCodesByNumber(allResults, result.analysis.code)
  // Un componente excluido es un componente que no está: la fórmula no aplica
  // en este protocolo, igual que para el backend cuando descarta el submódulo.
  // A los excluidos se suman los que quien llama ya sabe fuera de juego.
  const noDisponibles = new Set(allResults.filter((r) => r.excluido).map((r) => r.id))
  opciones.idsNoDisponibles?.forEach((id) => noDisponibles.add(id))
  let expression = normalizeExpression(formula)

  expression = expression.replace(/\[([^\]]+)\]/g, (_match, rawCode: string) => {
    const code = resolveRelativeCode(rawCode.trim(), result.analysis.code, codesByNumber)
    const dependencyId = resultIdByCode.get(code)
    const fueraDelProtocolo = dependencyId !== undefined && noDisponibles.has(dependencyId)
    const crudo = dependencyId !== undefined && !fueraDelProtocolo
      ? extraerNumero(values[dependencyId]?.value)
      : null
    const dependencyValue = crudo === null ? null : toFormulaNumber(crudo)

    if (crudo === null || dependencyValue === null) {
      missingCodes.push(code)
      if (fueraDelProtocolo) codigosNoDisponibles.push(code)
      return "NaN"
    }

    // Los decimales salen del texto que se cargó y no del número parseado:
    // `Number("1.250")` ya perdió el tercero.
    decimalesDeLosComponentes.push(decimalesDe(crudo))
    return String(dependencyValue)
  })

  if (missingCodes.length > 0) {
    return { value: "", missingCodes, codigosNoDisponibles }
  }

  const calculated = evaluateExpression(expression)
  if (calculated === null) return null

  return {
    value: formatFormulaNumber(calculated, decimalesDeLosComponentes),
    missingCodes: [],
    codigosNoDisponibles: [],
  }
}

/**
 * Recalcula en pantalla todas las fórmulas, tantas pasadas como haga falta para
 * que una fórmula de fórmula quede resuelta.
 *
 * POR QUÉ LA CASCADA NECESITA UN `Set`
 * ====================================
 * Cuando un componente sale del protocolo, su fórmula queda vacía. Pero un
 * valor vacío en `nextValues` es indistinguible de "todavía no se cargó", y ese
 * caso a propósito deja el número viejo en pantalla (no se vacía un cálculo a
 * mitad de tipeo). Así, el dependiente del dependiente se quedaba con su número
 * viejo calculado sobre algo que ya no existe.
 *
 * `vaciadosPorExclusion` guarda qué filas quedaron sin valor POR la exclusión y
 * se pasa como `idsNoDisponibles`: la pasada siguiente las trata igual que a una
 * excluida y la cascada llega hasta el final. El `Set` sólo crece, así que el
 * `for` de pasadas termina igual que antes.
 */
export const applyFormulaCalculations = <T extends FormulaResult>(
  results: T[],
  values: Record<number, FormulaValue>,
): Record<number, FormulaValue> => {
  let nextValues = values
  const vaciadosPorExclusion = new Set<number>()

  for (let pass = 0; pass < results.length; pass += 1) {
    let changed = false

    results.forEach((result) => {
      // Puesta a mano: el valor es de quien lo escribió, no del cálculo. Sigue
      // sirviendo como componente de OTRAS fórmulas —está en `nextValues`—,
      // que es lo que se quiere cuando una fórmula quedó mal y el resto no.
      if (result.carga_manual) return
      // "No corresponde": la determinación no aplica en este protocolo, así que
      // no se le calcula nada. Lo que tenga cargado queda tal cual.
      if (result.excluido) return

      const calculation = calculateFormulaValue(result, results, nextValues, {
        idsNoDisponibles: vaciadosPorExclusion,
      })
      if (!calculation) return

      if (calculation.missingCodes.length > 0) {
        // Todavía no cargado: se deja lo que haya en pantalla.
        if (calculation.codigosNoDisponibles.length === 0) return
        // Un componente que salió del protocolo: la fórmula no tiene valor, y su
        // propio valor tampoco está disponible para las fórmulas que la usan.
        if (!vaciadosPorExclusion.has(result.id)) {
          vaciadosPorExclusion.add(result.id)
          changed = true
        }
        const actual = nextValues[result.id] || { value: "", notes: "" }
        if (actual.value === "") return
        nextValues = { ...nextValues, [result.id]: { ...actual, value: "" } }
        changed = true
        return
      }

      const current = nextValues[result.id] || { value: "", notes: "" }
      if (current.value === calculation.value) return

      nextValues = {
        ...nextValues,
        [result.id]: {
          ...current,
          value: calculation.value,
        },
      }
      changed = true
    })

    if (!changed) break
  }

  return nextValues
}


export type FormulaGuardable = FormulaResult & {
  /** Lo que hay guardado en el servidor. */
  value?: string
  is_valid?: boolean
  is_wrong?: boolean
}

/**
 * Cuáles de las fórmulas ya calculadas hay que mandar al servidor.
 *
 * QUÉ RESUELVE
 * ============
 * Una determinación con fórmula muestra su valor apenas están los
 * componentes, pero ese valor vivía solo en la pantalla: alguien tenía que ir
 * a la fila y apretar Enter. Son dos o tres por hemograma, todas con el número
 * ya a la vista, y si nadie las apretaba el resultado quedaba sin cargar de
 * verdad — no se podía validar ni salía en el informe.
 *
 * QUÉ NO SE MANDA
 * ===============
 * - Lo que está en carga a mano: la fórmula quedó de lado a propósito.
 * - Lo excluido ("no corresponde"): el backend rechaza escribir esa fila.
 * - Lo ya validado: se invalida primero y recién ahí se toca.
 * - Lo que todavía no calculó nada.
 * - Con `soloVacias`, lo que ya tiene un valor guardado. Es el modo de cuando
 *   se abre el protocolo: completa lo que falta y no pisa lo que alguien
 *   decidió.
 */
export function formulasParaGuardar<T extends FormulaGuardable>(
  resultados: T[],
  valores: Record<number, FormulaValue>,
  { soloVacias = false }: { soloVacias?: boolean } = {},
): T[] {
  return resultados.filter((resultado) => {
    if (!resultado.determination.formula?.trim()) return false
    if (resultado.carga_manual) return false
    if (resultado.excluido) return false
    if (resultado.is_valid && !resultado.is_wrong) return false

    const calculado = valores[resultado.id]?.value ?? ""
    if (!calculado) return false

    const guardado = resultado.value ?? ""
    if (soloVacias && guardado !== "") return false
    return calculado !== guardado
  })
}

export type TokenFormula =
  | { tipo: "operador"; texto: string }
  | { tipo: "numero"; texto: string }
  | { tipo: "componente"; codigo: string; nombre: string; valor: string | null }

export type ComponenteFaltante = { codigo: string; nombre: string }

export type ExplicacionFormula = {
  /** La fórmula original, tal cual vino de la base. */
  formula: string
  tokens: TokenFormula[]
  faltantes: ComponenteFaltante[]
  /** Valor calculado; `null` si falta un componente o la expresión no evalúa. */
  resultado: string | null
}

const SIGNOS_TIPOGRAFICOS: Record<string, string> = {
  "*": "×",
  "/": "÷",
  "-": "−",
  "+": "+",
}

// Referencia primero (puede contener cualquier cosa entre corchetes), después
// número, después la potencia de dos caracteres (tiene que ganarle al `*`
// suelto) y por último un operador o paréntesis de un carácter. Lo que no
// entra en ninguno de los cuatro grupos —espacios, algo raro que se coló—
// simplemente no genera match y `matchAll` lo salta solo.
const TOKEN_PATTERN = /\[([^\]]+)\]|(\d+(?:\.\d+)?)|(\*\*)|([+\-*/()])/g

/**
 * Arma la fórmula "explicada": cada token con el nombre de la determinación y
 * el valor cargado en vez del código crudo, más la lista de lo que falta.
 *
 * POR QUÉ ES UNA FUNCIÓN PURA APARTE
 * ===================================
 * `calculateFormulaValue` ya sabe resolver códigos y evaluar la expresión,
 * pero sólo devuelve el resultado final: para mostrarle al usuario "esto no
 * calculó porque falta [Hematocrito]" hace falta el detalle de CADA término,
 * no sólo si al final faltó algo. Separarla del render deja esa traducción
 * —código a nombre, referencia a valor cargado— testeable y reutilizable sin
 * arrastrar JSX ni estado de componente; la pantalla sólo la recorre y pinta.
 *
 * POR QUÉ EL VALOR ES TEXTO Y NO NÚMERO
 * ======================================
 * Mismo motivo que en `calculateFormulaValue`: lo que se muestra es lo que la
 * persona cargó, con sus decimales tal cual los escribió. `Number("1.250")`
 * da `1.25` y se comió un decimal que en un resultado de laboratorio puede
 * importar.
 */
export const describirFormula = (
  result: FormulaResult,
  allResults: FormulaResult[],
  values: Record<number, FormulaValue>,
): ExplicacionFormula | null => {
  const formula = result.determination.formula?.trim()
  if (!formula) return null

  const codeByResult = buildResultCodeMap(allResults)
  const resultIdByCode = new Map<string, number>()
  codeByResult.forEach((code, resultId) => {
    resultIdByCode.set(code, resultId)
  })
  const resultsById = new Map(allResults.map((r) => [r.id, r]))

  const codesByNumber = buildCodesByNumber(allResults, result.analysis.code)
  // Mismo criterio que `calculateFormulaValue`: un componente excluido es un
  // componente que no está.
  const excluidos = new Set(allResults.filter((r) => r.excluido).map((r) => r.id))

  const expression = normalizeExpression(formula)

  const tokens: TokenFormula[] = []
  const faltantes: ComponenteFaltante[] = []
  const codigosFaltantesVistos = new Set<string>()

  for (const match of expression.matchAll(TOKEN_PATTERN)) {
    const [, referencia, numero, potencia, operador] = match

    if (referencia !== undefined) {
      const codigo = resolveRelativeCode(referencia.trim(), result.analysis.code, codesByNumber)
      const dependencyId = resultIdByCode.get(codigo)
      const componente = dependencyId !== undefined ? resultsById.get(dependencyId) : undefined
      const disponible = dependencyId !== undefined && !excluidos.has(dependencyId)
      const textoCargado = disponible ? values[dependencyId as number]?.value : undefined
      const valor = textoCargado !== undefined && extraerNumero(textoCargado) !== null ? textoCargado : null
      const nombre = componente?.determination.name ?? codigo

      tokens.push({ tipo: "componente", codigo, nombre, valor })

      if (valor === null && !codigosFaltantesVistos.has(codigo)) {
        codigosFaltantesVistos.add(codigo)
        faltantes.push({ codigo, nombre })
      }
      continue
    }

    if (numero !== undefined) {
      tokens.push({ tipo: "numero", texto: numero })
      continue
    }

    if (potencia !== undefined) {
      tokens.push({ tipo: "operador", texto: "^" })
      continue
    }

    if (operador !== undefined) {
      const texto = operador === "(" || operador === ")" ? operador : SIGNOS_TIPOGRAFICOS[operador]
      tokens.push({ tipo: "operador", texto })
    }
  }

  const calculation = calculateFormulaValue(result, allResults, values)
  const resultado = calculation && calculation.missingCodes.length === 0 ? calculation.value : null

  return { formula, tokens, faltantes, resultado }
}
