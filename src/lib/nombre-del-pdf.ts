/**
 * El nombre del PDF de un informe: `Juan Pérez_1234_C.pdf`. Al final va el
 * tipo: `C` el completo, `R` el resumido.
 *
 * Es el mismo que arma el backend para el mail y el WhatsApp
 * (`reporting/services/nombre_del_pdf.py`). Se repite acá porque la descarga
 * no puede leer el nombre que manda el servidor: `Content-Disposition` no es
 * una cabecera que CORS deje ver desde otro origen. Si cambia el formato allá,
 * cambia acá.
 *
 * El unificado lleva todos los números, de menor a mayor: `Juan Pérez_1234-1240_R.pdf`.
 */

type PacienteDelPdf = { first_name?: string | null; last_name?: string | null } | number | null | undefined

/** Lo que ningún sistema de archivos acepta en un nombre. */
const NO_VAN = /[\\/:*?"<>|]+/g

export function nombreDelPdf(
  paciente: PacienteDelPdf,
  protocolos: number[],
  tipo: "full" | "summary",
): string {
  const crudo =
    paciente && typeof paciente === "object" ? `${paciente.first_name ?? ""} ${paciente.last_name ?? ""}` : ""
  const nombre = crudo.replace(NO_VAN, " ").replace(/\s+/g, " ").trim() || "Paciente"
  const numeros = [...protocolos].sort((a, b) => a - b).join("-")
  const letra = tipo === "summary" ? "R" : "C"
  return `${nombre}_${numeros}_${letra}.pdf`
}

/** Un nombre de archivo no puede pasar de 255 bytes; se corta antes. */
const LARGO_MAXIMO_DEL_LOTE = 200

/**
 * El PDF con varios protocolos de pacientes distintos: `resumido_1234-1235-1240.pdf`.
 * Igual que `nombre_del_lote` del backend: los números de menor a mayor, y si
 * no entran, los primeros y cuántos más hay (`resumido_1234-1235_y_40_mas.pdf`).
 */
export function nombreDelLote(protocolos: number[], tipo: "full" | "summary"): string {
  const prefijo = tipo === "summary" ? "resumido" : "completo"
  const numeros = [...new Set(protocolos)].sort((a, b) => a - b).map(String)
  const nombre = `${prefijo}_${numeros.join("-")}`
  if (nombre.length <= LARGO_MAXIMO_DEL_LOTE) return `${nombre}.pdf`

  // Lugar para el `_y_N_mas` del final.
  const entran: string[] = []
  for (const numero of numeros) {
    if (prefijo.length + 1 + [...entran, numero].join("-").length > LARGO_MAXIMO_DEL_LOTE - 16) break
    entran.push(numero)
  }
  return `${prefijo}_${entran.join("-")}_y_${numeros.length - entran.length}_mas.pdf`
}
