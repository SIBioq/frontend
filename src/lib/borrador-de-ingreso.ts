/**
 * Persistencia del borrador de ingreso en `localStorage`.
 *
 * Por qué sólo ids: lo que queda en el disco del cliente es PHI por
 * asociación (paciente + análisis pedidos), así que se guarda el mínimo
 * posible — nada de nombre, DNI ni ningún dato legible del paciente. Al
 * restaurar el borrador, la pantalla vuelve a pedir esas entidades al
 * backend con los ids guardados acá.
 *
 * Nadie más que este archivo toca `localStorage` para el borrador de
 * ingreso: es la única Fabricación Pura que conoce la clave y el esquema.
 */

import type { PreauthStatus, UnplannedTransactionInput } from "@/types"
import { TRAJO_ORDEN_OPTIONS, type TrajoOrdenStatus } from "@/lib/protocol-order"

export const VERSION_DEL_BORRADOR = 1
export const EVENTO_BORRADOR_DE_INGRESO = "sibioq:borrador-de-ingreso"

const PREFIJO_DE_CLAVE = "sibioq:borrador-ingreso:v1"

const PREAUTH_STATUS_VALIDOS: PreauthStatus[] = ["not_required", "no_trajo", "incompleta", "completa"]

/** Sólo ids y montos: nada de nombre, DNI ni datos del paciente. Ver PHI en el plan. */
export type InstantaneaDeIngreso = {
  pacienteId: number | null
  medicoId: number | null
  obraSocialId: number | null
  metodoDeEnvioId: number | null
  analisis: Array<{ id: number; autorizado: boolean }>
  pagoEfectivo: string
  pagoTransferencia: string
  numeroDeAfiliado: string
  entidadFacturacionId: string
  cuentaDeCobroId: string
  trajoOrden: TrajoOrdenStatus | ""
  preauthStatus: PreauthStatus | ""
  materialDescartable: string
  derivacion: string
  coseguro: string
  transaccionesNoPlanificadas: UnplannedTransactionInput[]
}

export type BorradorDeIngreso = InstantaneaDeIngreso & {
  version: number
  /** ISO. Se usa para decirle al usuario cuándo lo dejó. */
  guardadoEn: string
}

export function claveDelBorrador(usuarioId: number): string {
  return `${PREFIJO_DE_CLAVE}:${usuarioId}`
}

function avisar(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(EVENTO_BORRADOR_DE_INGRESO))
}

function comoStringSano(valor: unknown): string {
  return typeof valor === "string" ? valor : ""
}

function comoIdSano(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null
}

function comoAnalisisSano(valor: unknown): Array<{ id: number; autorizado: boolean }> {
  if (!Array.isArray(valor)) return []

  return valor
    .filter((item): item is { id: unknown; autorizado?: unknown } => typeof item === "object" && item !== null)
    .filter((item) => typeof item.id === "number" && Number.isFinite(item.id))
    .map((item) => ({ id: item.id as number, autorizado: Boolean(item.autorizado) }))
}

function comoTransaccionesSanas(valor: unknown): UnplannedTransactionInput[] {
  return Array.isArray(valor) ? (valor as UnplannedTransactionInput[]) : []
}

function comoTrajoOrdenSano(valor: unknown): TrajoOrdenStatus | "" {
  const esValido = TRAJO_ORDEN_OPTIONS.some((opcion) => opcion.value === valor)
  return esValido ? (valor as TrajoOrdenStatus) : ""
}

function comoPreauthStatusSano(valor: unknown): PreauthStatus | "" {
  return PREAUTH_STATUS_VALIDOS.includes(valor as PreauthStatus) ? (valor as PreauthStatus) : ""
}

/** Sanea un valor leído de `localStorage`: cualquier campo con forma rara
 *  degrada a su valor vacío en vez de romper la restauración. */
function sanear(crudo: unknown): BorradorDeIngreso | null {
  if (typeof crudo !== "object" || crudo === null) return null

  const objeto = crudo as Record<string, unknown>

  if (objeto.version !== VERSION_DEL_BORRADOR) return null

  const instantanea: InstantaneaDeIngreso = {
    pacienteId: comoIdSano(objeto.pacienteId),
    medicoId: comoIdSano(objeto.medicoId),
    obraSocialId: comoIdSano(objeto.obraSocialId),
    metodoDeEnvioId: comoIdSano(objeto.metodoDeEnvioId),
    analisis: comoAnalisisSano(objeto.analisis),
    pagoEfectivo: comoStringSano(objeto.pagoEfectivo),
    pagoTransferencia: comoStringSano(objeto.pagoTransferencia),
    numeroDeAfiliado: comoStringSano(objeto.numeroDeAfiliado),
    entidadFacturacionId: comoStringSano(objeto.entidadFacturacionId),
    cuentaDeCobroId: comoStringSano(objeto.cuentaDeCobroId),
    trajoOrden: comoTrajoOrdenSano(objeto.trajoOrden),
    preauthStatus: comoPreauthStatusSano(objeto.preauthStatus),
    materialDescartable: comoStringSano(objeto.materialDescartable),
    derivacion: comoStringSano(objeto.derivacion),
    coseguro: comoStringSano(objeto.coseguro),
    transaccionesNoPlanificadas: comoTransaccionesSanas(objeto.transaccionesNoPlanificadas),
  }

  if (!tieneDatosSignificativos(instantanea)) return null

  return {
    ...instantanea,
    version: VERSION_DEL_BORRADOR,
    guardadoEn: comoStringSano(objeto.guardadoEn),
  }
}

export function leerBorrador(usuarioId: number | null): BorradorDeIngreso | null {
  if (usuarioId == null) return null

  try {
    const crudo = localStorage.getItem(claveDelBorrador(usuarioId))
    if (crudo == null) return null

    const saneado = sanear(JSON.parse(crudo))
    if (saneado == null) {
      localStorage.removeItem(claveDelBorrador(usuarioId))
      return null
    }

    return saneado
  } catch {
    // JSON corrupto o localStorage no disponible: no hay borrador que ofrecer.
    try {
      localStorage.removeItem(claveDelBorrador(usuarioId))
    } catch {
      /* nada más para hacer */
    }
    return null
  }
}

export function guardarBorrador(usuarioId: number | null, instantanea: InstantaneaDeIngreso): void {
  if (usuarioId == null) return

  if (!tieneDatosSignificativos(instantanea)) {
    borrarBorrador(usuarioId)
    return
  }

  try {
    const borrador: BorradorDeIngreso = {
      ...instantanea,
      version: VERSION_DEL_BORRADOR,
      guardadoEn: new Date().toISOString(),
    }
    localStorage.setItem(claveDelBorrador(usuarioId), JSON.stringify(borrador))
  } catch {
    /* cuota llena o localStorage no disponible: degradar en silencio */
  }

  avisar()
}

export function borrarBorrador(usuarioId: number | null): void {
  if (usuarioId == null) return

  try {
    localStorage.removeItem(claveDelBorrador(usuarioId))
  } catch {
    /* localStorage no disponible: nada que borrar */
  }

  avisar()
}

export function hayBorrador(usuarioId: number | null): boolean {
  return leerBorrador(usuarioId) != null
}

export function tieneDatosSignificativos(instantanea: InstantaneaDeIngreso | null): boolean {
  if (instantanea == null) return false
  return instantanea.pacienteId != null || instantanea.analisis.length > 0
}

/** Suscripción pensada para `useSyncExternalStore`: se entera de los cambios
 *  propios (evento custom) y de los que hace otra pestaña (`storage`). */
export function suscribirseAlBorrador(avisarCambio: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  window.addEventListener(EVENTO_BORRADOR_DE_INGRESO, avisarCambio)
  window.addEventListener("storage", avisarCambio)

  return () => {
    window.removeEventListener(EVENTO_BORRADOR_DE_INGRESO, avisarCambio)
    window.removeEventListener("storage", avisarCambio)
  }
}
