import { toast } from "sonner"

import { REPORTING_ENDPOINTS, TOAST_DURATION } from "@/config/api"

/**
 * Seguir un WhatsApp después de mandarlo, hasta saber si llegó.
 *
 * POR QUÉ NO ALCANZA CON EL 200 DEL ENVÍO
 * =======================================
 * Cuando el servidor contesta 200, lo único que pasó es que Meta aceptó el
 * mensaje. Si se entregó o si falló —número que no tiene WhatsApp, paciente
 * que bloqueó al laboratorio, template rechazado— lo avisa Meta después, por
 * webhook, unos segundos más tarde.
 *
 * El cartel verde de "enviado exitosamente" cerraba el tema ahí: quien atiende
 * el mostrador daba el informe por entregado y no volvía a mirar. Los envíos
 * que fallaban quedaban invisibles.
 *
 * QUÉ HACE ESTO
 * =============
 * Pregunta por el mensaje cada tantos segundos hasta que Meta se define, y
 * recién ahí avisa: verde si el paciente lo recibió, rojo con el motivo si no.
 * Si Meta no contesta a tiempo no dice nada — el estado real queda igual en la
 * ficha del protocolo, y un cartel de "no sé" no le sirve a nadie.
 *
 * Corre en segundo plano a propósito: `void seguirElWhatsApp(...)`. Quien manda
 * no puede quedarse esperando medio minuto con el botón trabado.
 */

type Peticion = (url: string, opciones?: Record<string, unknown>) => Promise<Response>

type MensajeDelProtocolo = {
  wamid?: string
  status?: string
  error_code?: string
  error_message?: string
}

/** Cuánto esperar antes de cada consulta. La suma es el tiempo que se sigue
 *  un mensaje: arranca corto porque casi todas las fallas son inmediatas
 *  (número inválido), y se va espaciando para no golpear el servidor. */
const ESPERAS_MS = [3000, 4000, 6000, 9000, 12000]

/** Un mismo mensaje no se sigue dos veces: la tarjeta y la lista pueden pedir
 *  el seguimiento del mismo envío y serían dos carteles iguales. */
const enSeguimiento = new Set<string>()

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms))

function motivoDeLaFalla(mensaje: MensajeDelProtocolo): string {
  const motivo = (mensaje.error_message || "").trim()
  const codigo = (mensaje.error_code || "").trim()
  if (motivo && codigo) return `${motivo} (código ${codigo})`
  if (motivo) return motivo
  if (codigo) return `Meta devolvió el código ${codigo}`
  return "Meta no informó el motivo"
}

export type SeguimientoDeWhatsApp = {
  /** Se llama cuando el mensaje falló, para refrescar lo que muestre la
   *  pantalla: el protocolo vuelve a "Pendiente de envío" del lado del
   *  servidor y la fila tiene que dejar de decir "Completado". */
  alFallar?: () => void
  /** Se llama cuando el paciente lo recibió. */
  alEntregar?: () => void
}

export async function seguirElWhatsApp(
  apiRequest: Peticion,
  protocolId: number,
  wamid: string | null | undefined,
  opciones: SeguimientoDeWhatsApp = {},
): Promise<void> {
  // Sin wamid no hay nada que seguir: Meta no confirmó el envío.
  if (!wamid || enSeguimiento.has(wamid)) return
  enSeguimiento.add(wamid)

  try {
    for (const espera of ESPERAS_MS) {
      await esperar(espera)

      let mensajes: MensajeDelProtocolo[] = []
      try {
        const respuesta = await apiRequest(REPORTING_ENDPOINTS.WHATSAPP_DEL_PROTOCOLO(protocolId))
        if (!respuesta.ok) continue
        const datos = await respuesta.json()
        mensajes = (datos?.messages ?? []) as MensajeDelProtocolo[]
      } catch {
        // Se cayó la red o el servidor: se reintenta en la próxima vuelta. Un
        // error de consulta no es un error de envío y no se muestra.
        continue
      }

      const mensaje = mensajes.find((m) => m.wamid === wamid)
      if (!mensaje) continue

      if (mensaje.status === "fallado") {
        toast.error(
          `El WhatsApp no le llegó al paciente: ${motivoDeLaFalla(mensaje)}. ` +
          "El protocolo volvió a quedar pendiente de envío.",
          { duration: TOAST_DURATION * 3 },
        )
        opciones.alFallar?.()
        return
      }

      if (mensaje.status === "entregado" || mensaje.status === "leido") {
        toast.success("El paciente recibió el informe por WhatsApp.",
                      { duration: TOAST_DURATION })
        opciones.alEntregar?.()
        return
      }
    }
  } finally {
    enSeguimiento.delete(wamid)
  }
}
