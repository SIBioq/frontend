import { useEffect, useRef, useState, type CSSProperties } from "react"

/** El retraso de cada bloque al entrar, con tope: el último no puede entrar un segundo tarde. */
export const retraso = (posicion: number): CSSProperties => ({
  animationDelay: `${Math.min(posicion, 8) * 70}ms`,
  animationFillMode: "both",
})

const quiereMenosMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * Un número que, la primera vez que aparece, cuenta desde cero (600 ms).
 *
 * Sólo al entrar: cuando los datos se actualizan (el inicio se refresca solo)
 * el número cambia en el lugar. Contar de nuevo desde cero cada minuto haría
 * que nadie pueda leerlo.
 */
export function useCuenta(valor: number, duracionMs = 600) {
  const [mostrado, setMostrado] = useState(() => (quiereMenosMovimiento() ? valor : 0))
  const yaConto = useRef(false)

  useEffect(() => {
    if (yaConto.current || quiereMenosMovimiento()) {
      setMostrado(valor)
      return
    }
    yaConto.current = true
    const inicio = performance.now()
    let cuadro = 0
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracionMs)
      const suave = 1 - (1 - t) ** 3
      setMostrado(valor * suave)
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [valor, duracionMs])

  return mostrado
}
