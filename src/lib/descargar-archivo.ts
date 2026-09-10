/**
 * Bajar a disco lo que contestó el servidor.
 *
 * POR QUÉ NO ES UN `<a href>` Y LISTO
 * ===================================
 * Los endpoints que devuelven archivos piden `Authorization: Bearer`, y un link
 * suelto del navegador no manda esa cabecera: la descarga volvería 401. Así que
 * el archivo se pide con `apiRequest` como cualquier otro, y recién con la
 * respuesta en la mano se arma el link a un blob.
 */

/**
 * El nombre que puso el servidor en `Content-Disposition`, si llega.
 *
 * Puede no llegar: `Content-Disposition` no es una cabecera que CORS exponga
 * sola, así que desde otro origen `headers.get` devuelve `null` aunque el
 * servidor la haya mandado. Por eso siempre hay un nombre de reserva y esto no
 * es un error.
 */
const nombreQueMandoElServidor = (respuesta: Response): string | null => {
  const cabecera = respuesta.headers.get("Content-Disposition")
  if (!cabecera) return null

  const conComillas = cabecera.match(/filename="([^"]+)"/i)
  if (conComillas) return conComillas[1]

  const sinComillas = cabecera.match(/filename=([^;]+)/i)
  return sinComillas ? sinComillas[1].trim() : null
}

export const descargarRespuesta = async (
  respuesta: Response,
  nombreDeReserva: string,
): Promise<void> => {
  const blob = await respuesta.blob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = nombreQueMandoElServidor(respuesta) || nombreDeReserva
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/** `catalogo_analisis_2026-09-10.xlsx` */
export const conLaFechaDeHoy = (prefijo: string, extension = "xlsx"): string =>
  `${prefijo}_${new Date().toISOString().slice(0, 10)}.${extension}`
