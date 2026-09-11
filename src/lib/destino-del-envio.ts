/** A dónde sale un informe por mail o por WhatsApp. Ver `EnviarInformeDialog`. */
export type EleccionDeDestino = "principal" | "alternativo" | "otro"

/** Lo que se eligió: el dato principal, el alternativo, u otro destino (`valor`). */
export type DestinoElegido = { eleccion: EleccionDeDestino; valor?: string }

/**
 * Lo que va en el cuerpo del pedido, igual para el envío de un protocolo, el
 * lote y el unificado: nada es «a los datos del paciente», `destino:
 * "alternativo"` es su teléfono alternativo, y `email` / `phone_number` es otro
 * destino. El backend resuelve el alternativo de cada paciente.
 */
export function cuerpoDelDestino(metodo: "email" | "whatsapp", destino: DestinoElegido): Record<string, string> {
  if (destino.eleccion === "alternativo") return { destino: "alternativo" }
  if (destino.eleccion === "otro" && destino.valor) {
    return metodo === "email" ? { email: destino.valor } : { phone_number: destino.valor }
  }
  return {}
}
