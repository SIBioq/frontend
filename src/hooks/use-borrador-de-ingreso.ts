"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  type BorradorDeIngreso,
  type InstantaneaDeIngreso,
} from "@/lib/borrador-de-ingreso"

const RETARDO_DE_GUARDADO_MS = 600

export type ResultadoDelBorrador = {
  /** El borrador que había al entrar, hasta que el usuario decida. null = no hay nada que ofrecer. */
  borradorPendiente: BorradorDeIngreso | null
  /** El usuario dijo «Descartar»: se borra del storage y se baja el cartel. */
  descartar: () => void
  /** El usuario dijo «Continuar»: baja el cartel y habilita el guardado, SIN borrar. */
  olvidar: () => void
  /** Para cuando el protocolo se creó o se limpió el formulario a mano. */
  borrar: () => void
}

export function useBorradorDeIngreso(params: {
  usuarioId: number | null
  /** Foto del formulario ahora. La arma la pantalla en cada render (useMemo). */
  instantanea: InstantaneaDeIngreso
  /** false mientras la pantalla carga, se restaura o se está creando el protocolo; el cartel pendiente lo maneja el hook por su cuenta. */
  guardadoHabilitado: boolean
}): ResultadoDelBorrador {
  const { usuarioId, instantanea, guardadoHabilitado } = params

  const [borradorPendiente, setBorradorPendiente] = useState<BorradorDeIngreso | null>(null)

  // El id del usuario puede llegar null en el primer render (el contexto de
  // auth todavía no resolvió). Este ref recuerda para qué usuario ya se leyó
  // el borrador pendiente, así no se vuelve a leer en cada render ni se
  // pierde la primera lectura real cuando el id aparece.
  const usuarioYaLeidoRef = useRef<number | null>(null)

  useEffect(() => {
    if (usuarioId == null) return
    if (usuarioYaLeidoRef.current === usuarioId) return

    usuarioYaLeidoRef.current = usuarioId
    setBorradorPendiente(leerBorrador(usuarioId))
  }, [usuarioId])

  // Lo que el debounce todavía no escribió. Si el usuario se va de Ingreso
  // dentro del retardo, el cleanup cancela el temporizador: sin esto, el
  // último cambio se perdería.
  const sinGuardarRef = useRef<{ usuarioId: number | null; instantanea: InstantaneaDeIngreso } | null>(null)

  // Debounce: el formulario cambia con cada tecla y no tiene sentido escribir
  // en localStorage tan seguido.
  useEffect(() => {
    // No se guarda mientras hay un borrador pendiente de decisión: el usuario
    // todavía no dijo si lo quiere, y guardar acá pisaría justo el que se le
    // está ofreciendo. La regla vive acá y no en la pantalla porque el dato
    // —si hay borrador pendiente— es de este hook.
    if (!guardadoHabilitado || borradorPendiente !== null) {
      sinGuardarRef.current = null
      return
    }

    sinGuardarRef.current = { usuarioId, instantanea }
    const temporizador = setTimeout(() => {
      guardarBorrador(usuarioId, instantanea)
      sinGuardarRef.current = null
    }, RETARDO_DE_GUARDADO_MS)

    return () => clearTimeout(temporizador)
  }, [usuarioId, instantanea, guardadoHabilitado, borradorPendiente])

  // Al salir de la pantalla se escribe ya lo que quedaba en el debounce.
  useEffect(() => {
    return () => {
      const sinGuardar = sinGuardarRef.current
      if (sinGuardar) guardarBorrador(sinGuardar.usuarioId, sinGuardar.instantanea)
      sinGuardarRef.current = null
    }
  }, [])

  const descartar = useCallback(() => {
    sinGuardarRef.current = null
    borrarBorrador(usuarioId)
    setBorradorPendiente(null)
  }, [usuarioId])

  const olvidar = useCallback(() => {
    setBorradorPendiente(null)
  }, [])

  const borrar = useCallback(() => {
    sinGuardarRef.current = null
    borrarBorrador(usuarioId)
    setBorradorPendiente(null)
  }, [usuarioId])

  return { borradorPendiente, descartar, olvidar, borrar }
}
