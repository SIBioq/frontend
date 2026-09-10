"use client"

import type React from "react"
import { useCallback, useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { menosMovimiento } from "@/lib/menos-movimiento"

/**
 * Una pista de paneles que se recorre deslizando.
 *
 * POR QUÉ SCROLL DE VERDAD Y NO `translateX`
 * ==========================================
 * Los carruseles de esta app movían el contenido con `transform: translateX`
 * y detectaban el gesto con `onTouchStart`/`onTouchEnd`. Eso anda con el dedo
 * y con nada más: en una notebook —que es donde se mira el inicio la mayor
 * parte del tiempo— el trackpad no hacía nada, porque un desplazamiento
 * horizontal de trackpad es un evento de scroll y ahí no había nada que
 * scrollear. Quedaban solo las flechas.
 *
 * Con un contenedor que scrollea de verdad, el mismo gesto funciona con dedo,
 * trackpad, rueda con Shift y teclado, y `scroll-snap` deja cada panel
 * encuadrado solo al soltar. La barra se esconde (`sin-barra-de-scroll`): para
 * saber dónde se está están los puntitos y las flechas.
 *
 * ES CONTROLADO
 * =============
 * `activo` manda: si cambia desde afuera (una flecha, un puntito), la pista se
 * desplaza sola. Y si el desplazamiento lo hizo la persona, avisa por
 * `onActivo` para que el estado de afuera —el rótulo "Hace 2 sem.", por
 * ejemplo— quede en el panel que se está viendo.
 */
export function CarruselDeslizable({
  activo,
  onActivo,
  children,
  className,
  ariaLabel,
}: {
  /** Índice del panel visible, en el orden en que se pasan los children. */
  activo: number
  onActivo: (indice: number) => void
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  const pista = useRef<HTMLDivElement>(null)

  // A DÓNDE SE ESTÁ YENDO LA PISTA POR SU CUENTA.
  //
  // El desplazamiento que dispara el propio componente no tiene que volver
  // como si lo hubiera hecho la persona: si volviera, `onActivo` se llamaría
  // con cada índice INTERMEDIO de la animación y el de afuera creería que el
  // usuario se paró ahí.
  //
  // Se guarda el índice objetivo y no un simple "sí/estoy moviéndome": la
  // versión anterior liberaba el bloqueo por tiempo (400 ms) y una animación
  // de cinco semanas tarda más que eso, así que el último tramo del viaje
  // llegaba como si fuera del usuario, avisaba el índice de esa altura y la
  // pista terminaba parándose una semana antes de la que le habían pedido.
  // Ese era el "se queda en el penúltimo".
  const objetivo = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const indiceVisible = (el: HTMLDivElement) =>
    el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0

  const irA = useCallback((indice: number, animado: boolean) => {
    const el = pista.current
    if (!el || el.clientWidth === 0) return false

    // Sin paneles todavía, `activo` puede llegar en -1: pedir un scroll
    // negativo no rompe nada pero deja el objetivo apuntando a un lugar al que
    // nunca se va a llegar, y con él el bloqueo puesto.
    const destino = Math.max(0, indice) * el.clientWidth
    // YA ESTÁ AHÍ: NO SE PIDE UN VIAJE QUE NO VA A PASAR.
    //
    // Después de que la persona desliza, el índice de afuera se actualiza y
    // este efecto vuelve a pedir el MISMO panel. Un `scrollTo` al lugar donde
    // ya se está no dispara ningún evento de scroll, así que el bloqueo se
    // quedaría puesto hasta que venciera el temporizador y en esos segundos
    // los deslizamientos de la persona no se registrarían.
    if (Math.abs(el.scrollLeft - destino) < 4) {
      objetivo.current = null
      if (timer.current) clearTimeout(timer.current)
      return true
    }

    objetivo.current = indice
    el.scrollTo({
      left: destino,
      // `auto` NO es "sin animación": es "lo que diga el CSS", y el CSS de
      // esta pista dice `scroll-smooth`. Para posicionar de entrada hace falta
      // `instant`, o el inicio abre viajando desde la primera semana.
      behavior: animado ? "smooth" : "instant",
    })

    if (timer.current) clearTimeout(timer.current)
    // Red por si el scroll nunca llega exactamente al objetivo (un redondeo,
    // un resize en el medio): sin esto la pista quedaría sorda para siempre.
    timer.current = setTimeout(() => {
      objetivo.current = null
    }, 1500)
    return true
  }, [])

  /**
   * Al montar, la pista VIAJA hasta donde diga `activo`.
   *
   * Arranca en el primer panel —el más viejo— y se desplaza hasta el actual.
   * No es decoración: muestra de un saque que hay semanas para atrás, que es
   * lo que nadie descubre si la pista aparece ya puesta en la última.
   *
   * El viaje tiene que TERMINAR donde le pidieron. Antes se frenaba una antes
   * porque el bloqueo del movimiento propio se soltaba por tiempo y el último
   * tramo llegaba como si lo hubiera hecho la persona; ahora el bloqueo espera
   * al índice objetivo.
   *
   * Con reintento por frame: el efecto puede correr antes de que el navegador
   * le haya dado ancho a la pista, y `indice * 0` es siempre el principio.
   */
  useEffect(() => {
    let cancelado = false
    const intentar = (restantes: number) => {
      if (cancelado) return
      // Quien pidió menos movimiento en el sistema no ve el viaje: aparece
      // puesta en la semana actual.
      const animar = !menosMovimiento()
      if (irA(activo, animar)) return
      if (restantes > 0) requestAnimationFrame(() => intentar(restantes - 1))
    }
    intentar(10)
    return () => {
      cancelado = true
    }
  }, [activo, irA])

  const alScrollear = useCallback(() => {
    const el = pista.current
    if (!el || el.clientWidth === 0) return
    const indice = indiceVisible(el)

    // Viaje propio: se ignora hasta llegar, y ahí se suelta.
    if (objetivo.current !== null) {
      if (indice === Math.max(0, objetivo.current)) {
        objetivo.current = null
        if (timer.current) clearTimeout(timer.current)
      }
      return
    }

    if (indice !== activo) onActivo(indice)
  }, [activo, onActivo])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div
      ref={pista}
      onScroll={alScrollear}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "sin-barra-de-scroll flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth",
        className,
      )}
    >
      {children}
    </div>
  )
}
