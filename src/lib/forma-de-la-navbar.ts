/**
 * La forma de la barra blanca de la navbar, compartida entre la app y el login.
 *
 * PARA QUÉ
 * ========
 * Al iniciar sesión, el panel del login se encoge hasta quedar exactamente del
 * tamaño de la barra de la navbar, que es lo primero que se ve adentro. Para
 * que el aterrizaje caiga justo, el login tiene que saber a qué forma va, y
 * cuando la animación corre la navbar todavía no existe: no hay a quién
 * medirle en ese momento.
 *
 * El cierre de sesión NO es esta animación al revés. Ahí la navbar se va para
 * arriba, el contenido de la pantalla se va para los costados y, con la
 * pantalla limpia, el panel del login baja desde arriba como siempre. La
 * coreografía de esa salida también se dispara desde acá.
 *
 * POR QUÉ MEDIDA Y NO ESCRITA
 * ===========================
 * La primera versión copiaba las medidas de `navbar.tsx` en constantes. En
 * escritorio pegaba, pero en el teléfono no: la barra de mobile va full-bleed,
 * tiene otro alto y otro radio, y el panel aterrizaba en una forma que no era
 * la de ninguna barra. Ahora la navbar publica su tamaño real —el que tiene en
 * esa pantalla, con esa tipografía y ese avatar— y el login lee eso.
 *
 * Las constantes siguen existiendo como estimación, para la única vez en que
 * nadie midió nada todavía: el primer ingreso después de abrir el navegador.
 * Ahí el aterrizaje puede quedar unos píxeles corrido; del segundo en adelante
 * es exacto.
 *
 * DÓNDE VIVE
 * ==========
 * En `sessionStorage`, porque entrar y salir son recargas de pantalla dentro
 * de la misma pestaña. No es un dato: es una medida de la pantalla, y no tiene
 * ningún sentido que sobreviva a la pestaña ni que viaje a ningún lado.
 */

export type FormaDeLaNavbar = {
  /** Ancho de la barra blanca, sin los márgenes que la despegan del borde. */
  ancho: number
  alto: number
  /** El radio de las esquinas de abajo, que es donde la barra se redondea. */
  radio: number
}

const CLAVE_DE_LA_FORMA = "labsalud:forma-de-la-navbar"

/**
 * Desde dónde la barra deja de ser la del celular, con la letra de siempre.
 * Es sólo la estimación para cuando nadie la midió todavía: la barra elige su
 * forma midiéndose (ver `navbar.tsx`) y publica la medida real.
 */
const ANCHO_DE_ESCRITORIO = 791

/** Cuánto tarda el menú de usuario en cerrarse. Es su propia transición. */
export const MS_DEL_MENU = 200
/** Cuánto tardan la navbar y el contenido en irse de la pantalla. */
export const MS_DE_LA_SALIDA = 500

/**
 * El ancho de la ventana sin la barra de scroll. `innerWidth` la incluye, así
 * que el panel terminaba unos píxeles más ancho que la navbar en escritorio.
 */
export function anchoDeLaVentana(): number {
  return document.documentElement.clientWidth || window.innerWidth
}

/**
 * Lo que mediría la barra si nadie la midió todavía. Sale de `navbar.tsx`:
 * fuera del celular deja 32px a cada lado —16 del `px-4` de su wrapper más 16
 * del `mx-4` de la barra—, mide 72 de alto en una fila (40 del botón de
 * usuario más 16+16 del `py-4`) y redondea 25px; en el celular va de borde a
 * borde, mide 64 (40 del botón más 12+12 del `py-3`) y redondea 8px.
 */
export function formaEstimadaDeLaNavbar(): FormaDeLaNavbar {
  const ventana = anchoDeLaVentana()
  return ventana >= ANCHO_DE_ESCRITORIO
    ? { ancho: ventana - 64, alto: 72, radio: 25 }
    : { ancho: ventana, alto: 64, radio: 8 }
}

/** La navbar publica su tamaño real cada vez que cambia. */
export function recordarFormaDeLaNavbar(forma: FormaDeLaNavbar): void {
  try {
    sessionStorage.setItem(CLAVE_DE_LA_FORMA, JSON.stringify(forma))
  } catch {
    // Modo privado o storage lleno: se sigue con la estimación.
  }
}

/** A qué forma tiene que aterrizar el panel del login. */
export function formaDeLaNavbar(): FormaDeLaNavbar {
  const estimada = formaEstimadaDeLaNavbar()
  try {
    const guardado = sessionStorage.getItem(CLAVE_DE_LA_FORMA)
    if (!guardado) return estimada
    const forma = JSON.parse(guardado) as Partial<FormaDeLaNavbar>
    // Una medida vieja de cuando la ventana era otra no sirve: si la pantalla
    // se achicó, el panel se iría más ancho que la barra. El alto y el radio sí
    // valen, que es justo lo que no se puede deducir del ancho de la ventana.
    const ancho = Math.min(forma.ancho ?? estimada.ancho, estimada.ancho)
    return {
      ancho: ancho > 0 ? ancho : estimada.ancho,
      alto: forma.alto && forma.alto > 0 ? forma.alto : estimada.alto,
      radio: typeof forma.radio === "number" ? forma.radio : estimada.radio,
    }
  } catch {
    return estimada
  }
}

/** El aviso de que empezó un cierre de sesión con animación. */
export const EVENTO_DE_CIERRE = "labsalud:cerrando-sesion"

/**
 * Cierra la sesión, pero recién cuando la pantalla quedó limpia: primero se
 * pliega el menú de usuario —para arriba, con su propia transición—, después
 * la navbar se va para arriba y el contenido para los costados, y con eso
 * afuera se cierra la sesión de verdad. El login llega a una pantalla vacía y
 * baja desde arriba como siempre.
 *
 * La sesión sigue abierta mientras dura: es lo que mantiene la navbar y la
 * pantalla montadas para poder animarlas.
 */
export function cerrarSesionConAnimacion(cerrar: () => void): void {
  window.dispatchEvent(new Event(EVENTO_DE_CIERRE))
  window.setTimeout(cerrar, MS_DEL_MENU + MS_DE_LA_SALIDA)
}
