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
  /**
   * El borrador que había al entrar. Se ofrece con el cartel `AvisoDeBorrador`
   * hasta que el usuario apriete «Continuar» (u ocurra un «Descartar», que lo
   * baja junto con borrar todo). `null` = no hay nada que ofrecer.
   *
   * OJO: que esto no sea `null` NO quiere decir que el formulario esté vacío.
   * La pantalla restaura el formulario solo, apenas entra (salvo que haya un
   * paciente preseteado); el cartel se queda arriba nada más como aviso, y
   * mientras tanto el formulario ya es editable y se sigue guardando (ver
   * `marcarComoRestaurado`).
   */
  borradorPendiente: BorradorDeIngreso | null
  /** El formulario ya quedó igual al borrador (la pantalla lo restauró, sola
   *  o porque el usuario apretó «Continuar»): a partir de acá los cambios que
   *  haga el usuario se vuelven a guardar, aunque el cartel siga arriba. */
  marcarComoRestaurado: () => void
  /** El usuario apretó «Continuar»: sólo baja el cartel. El formulario ya
   *  estaba relleno de antes, así que no hay nada más que hacer acá. */
  ocultarCartel: () => void
  /** Borra el borrador del storage y baja el cartel. La usan tanto el botón
   *  «Descartar» (vía el reset de la pantalla) como la creación exitosa de un
   *  protocolo y la limpieza manual del formulario. */
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

  // true desde que el formulario quedó igual al borrador (ver
  // `marcarComoRestaurado`). Mientras el cartel está arriba y esto sigue en
  // false, el guardado está frenado: es la ventana entre ofrecer el borrador
  // y terminar de traer sus entidades del backend, y ahí el formulario
  // todavía no es una copia fiel de lo guardado.
  const [yaRestaurado, setYaRestaurado] = useState(false)

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
    // No se guarda mientras hay un borrador pendiente y el formulario TODAVÍA
    // no es su copia: guardar acá pisaría, con lo que hay en pantalla (poco o
    // nada), justo el borrador que se está por restaurar. Una vez que
    // `marcarComoRestaurado` avisa que ya son lo mismo, el guardado sigue de
    // largo aunque el cartel se quede arriba esperando el «Continuar».
    if (!guardadoHabilitado || (borradorPendiente !== null && !yaRestaurado)) {
      sinGuardarRef.current = null
      return
    }

    sinGuardarRef.current = { usuarioId, instantanea }
    const temporizador = setTimeout(() => {
      guardarBorrador(usuarioId, instantanea)
      sinGuardarRef.current = null
    }, RETARDO_DE_GUARDADO_MS)

    return () => clearTimeout(temporizador)
  }, [usuarioId, instantanea, guardadoHabilitado, borradorPendiente, yaRestaurado])

  // Al salir de la pantalla se escribe ya lo que quedaba en el debounce.
  useEffect(() => {
    return () => {
      const sinGuardar = sinGuardarRef.current
      if (sinGuardar) guardarBorrador(sinGuardar.usuarioId, sinGuardar.instantanea)
      sinGuardarRef.current = null
    }
  }, [])

  const marcarComoRestaurado = useCallback(() => {
    setYaRestaurado(true)
  }, [])

  const ocultarCartel = useCallback(() => {
    setBorradorPendiente(null)
  }, [])

  const borrar = useCallback(() => {
    sinGuardarRef.current = null
    borrarBorrador(usuarioId)
    setBorradorPendiente(null)
    setYaRestaurado(false)
  }, [usuarioId])

  return { borradorPendiente, marcarComoRestaurado, ocultarCartel, borrar }
}
