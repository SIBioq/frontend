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
  /** false mientras se muestra el cartel, se restaura, carga la pantalla o se está creando el protocolo. */
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

  // Debounce: el formulario cambia con cada tecla y no tiene sentido escribir
  // en localStorage tan seguido. Mientras el cartel sigue arriba (guardado
  // deshabilitado) no se guarda nada: el usuario todavía no decidió, y
  // guardar acá pisaría el borrador que se le está ofreciendo.
  useEffect(() => {
    if (!guardadoHabilitado) return

    const temporizador = setTimeout(() => {
      guardarBorrador(usuarioId, instantanea)
    }, RETARDO_DE_GUARDADO_MS)

    return () => clearTimeout(temporizador)
  }, [usuarioId, instantanea, guardadoHabilitado])

  const descartar = useCallback(() => {
    borrarBorrador(usuarioId)
    setBorradorPendiente(null)
  }, [usuarioId])

  const olvidar = useCallback(() => {
    setBorradorPendiente(null)
  }, [])

  const borrar = useCallback(() => {
    borrarBorrador(usuarioId)
    setBorradorPendiente(null)
  }, [usuarioId])

  return { borradorPendiente, descartar, olvidar, borrar }
}
