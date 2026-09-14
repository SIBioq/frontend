/** Montos escritos con la convención local: punto de miles y coma decimal. */
export function parseMonto(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0
  const texto = String(valor ?? "").trim().replace(/\s/g, "")
  if (!texto) return 0

  // El punto separa miles y la coma separa decimales. Sin coma distinguimos
  // `10.000` (formato visible argentino) de `10.50` (decimal de API).
  let normalizado = texto
  if (texto.includes(",")) {
    normalizado = texto.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.replace(/\./g, "")
  }
  const numero = Number.parseFloat(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export function formatMonto(valor: string | number | null | undefined): string {
  const numero = parseMonto(valor)
  if (!numero) return ""
  const tieneDecimales = Math.abs(numero % 1) > 0.000001
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: tieneDecimales ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numero)
}

export function montoParaApi(valor: string | number | null | undefined): string {
  return parseMonto(valor).toFixed(2)
}

export function sumarMonto(actual: string, incremento: number): string {
  return formatMonto(parseMonto(actual) + incremento)
}

export function sugerenciasDeMonto(total: number): number[] {
  return [1000, 5000, 10000, 20000, 50000].filter((monto) => monto < total)
}
