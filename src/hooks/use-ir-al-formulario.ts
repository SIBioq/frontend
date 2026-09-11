import { useEffect, useRef } from "react"

/**
 * Lleva la vista y el cursor al primer campo de un formulario recién abierto.
 *
 * En el ingreso, "Crear nuevo médico" y "Crear nueva obra social" abren su
 * formulario en el panel de la derecha —o abajo de todo, en un teléfono—, lejos
 * del combo desde donde se pidió. Quien lo pidió tenía que ir a buscarlo, hacer
 * click en el primer campo y recién ahí escribir. Ahora la pantalla se corre
 * hasta el formulario y el cursor queda en su primer campo.
 *
 * Va en un timeout y no directo en el efecto: el formulario se monta en el
 * mismo render en el que se cierra el desplegable del combo, y el foco hay que
 * darlo cuando ese cierre ya terminó de acomodar la pantalla.
 */
export function useIrAlFormulario<T extends HTMLElement = HTMLInputElement>() {
  const primerCampo = useRef<T>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const campo = primerCampo.current
      if (!campo) return
      campo.scrollIntoView({ behavior: "smooth", block: "center" })
      // `preventScroll`: el scroll ya lo hace el de arriba, suave. Sin esto el
      // foco saltaría de golpe y el suave quedaría peleando con él.
      campo.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  return primerCampo
}
