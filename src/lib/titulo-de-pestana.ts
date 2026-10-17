/**
 * El nombre de la pestaña del navegador.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ===========================
 * En el lab se trabaja con varias pestañas abiertas a la vez: la cola de
 * resultados en una, la validación de un paciente en otra, el protocolo en una
 * tercera. Con el título fijo de `index.html` todas decían "Gestion de
 * Labsalud" y no había forma de saber cuál era cuál sin entrar a mirarlas.
 *
 * El formato es `Sección - Detalle`, y el detalle es el paciente cuando la
 * pantalla habla de uno solo:
 *
 *     Resultados | Juan Pérez
 *     Validación | Juan Pérez
 *     Protocolo | Juan Pérez
 *     Resultados | Labsalud      (la cola, que no es de nadie en particular)
 *
 * Cuando no hay detalle va el nombre del sistema, para que una pestaña sola
 * siga diciendo de qué app es.
 */

/** Lo que se muestra cuando la pantalla no habla de un paciente concreto. */
export const NOMBRE_DEL_SISTEMA = "Labsalud"

/** `("Resultados", "Juan Pérez")` → `"Resultados - Juan Pérez"`. */
export function tituloDePestana(seccion: string, detalle?: string | null): string {
  const limpio = detalle?.trim()
  return `${seccion} | ${limpio || NOMBRE_DEL_SISTEMA}`
}

/** Nombre de cada pantalla sin parámetros, por ruta exacta. */
const SECCIONES_FIJAS: Record<string, string> = {
  "/": "Inicio",
  "/login": "Iniciar sesión",
  "/forgot-password": "Recuperar contraseña",
  "/profile": "Mi perfil",
  "/management": "Gestión de usuarios",
  "/pacientes": "Pacientes",
  "/configuracion": "Configuración",
  "/superconfiguracion": "Superconfiguración",
  "/ingreso": "Ingreso",
  "/protocolos": "Protocolos",
  "/resultados": "Resultado",
  "/validacion": "Validación",
  "/facturacion": "Facturación",
  "/libro-diario": "Libro diario",
  "/buscar": "Búsqueda",
}

/**
 * Nombre de las pantallas de detalle (`/resultados/123`). Es un título
 * provisorio: apenas carga el protocolo o el paciente, la propia pantalla lo
 * reemplaza por el nombre con `useTituloDePestana`. Está para que la pestaña
 * no quede con el título de la pantalla anterior mientras baja el dato.
 */
const SECCIONES_DE_DETALLE: Record<string, string> = {
  "/pacientes": "Paciente",
  "/protocolos": "Protocolo",
  "/resultados": "Resultado",
  "/validacion": "Validación",
}

/** El título que le corresponde a una ruta, sin saber nada del contenido. */
export function tituloDeRuta(pathname: string): string {
  // Sin la barra final, así `/resultados/` y `/resultados` son la misma ruta.
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

  const fija = SECCIONES_FIJAS[ruta]
  if (fija) return tituloDePestana(fija)

  const [, base, param] = ruta.split("/")
  const detalle = SECCIONES_DE_DETALLE[`/${base}`]
  if (detalle && param) return tituloDePestana(detalle, `#${param}`)

  return NOMBRE_DEL_SISTEMA
}

/**
 * El nombre del paciente como va en la pestaña. Los anónimos no tienen nombre
 * y el protocolo puede no haber cargado todavía; en los dos casos devuelve
 * `null` y el título se queda con el nombre del sistema.
 */
export function nombreParaLaPestana(
  paciente:
    | { is_anonymous?: boolean; full_name?: string | null; first_name?: string | null; last_name?: string | null }
    | null
    | undefined,
): string | null {
  if (!paciente) return null
  if (paciente.is_anonymous) return "Paciente anónimo"
  const nombre = paciente.full_name?.trim() || `${paciente.first_name ?? ""} ${paciente.last_name ?? ""}`.trim()
  return nombre || null
}

/**
 * El título de una pantalla de detalle, o `null` si el paciente todavía no
 * cargó. El `null` es a propósito: hace que la pestaña se quede con el
 * `Resultados - #123` provisorio en vez de parpadear a `Resultados - Labsalud`
 * mientras baja el dato.
 */
export function tituloDeDetalle(
  seccion: string,
  paciente: Parameters<typeof nombreParaLaPestana>[0],
): string | null {
  const nombre = nombreParaLaPestana(paciente)
  return nombre ? tituloDePestana(seccion, nombre) : null
}
