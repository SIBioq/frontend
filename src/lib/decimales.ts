/**
 * Validación de `decimales`: la cantidad fija de decimales para el resultado
 * de una determinación calculada (VCM, HCM, CHCM...). Ver el comentario de
 * `formatFormulaNumber` en `result-formulas.ts` para el porqué existe.
 */

export const DECIMALES_MINIMO = 0
export const DECIMALES_MAXIMO = 6

export function esDecimalesValido(valor: number | null): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= DECIMALES_MINIMO &&
    valor <= DECIMALES_MAXIMO
  )
}
