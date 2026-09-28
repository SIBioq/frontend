import { Component, type ErrorInfo, type ReactNode } from "react"

/**
 * La red de abajo: si algo revienta al renderizar, se ve un cartel y no un
 * vacío blanco.
 *
 * POR QUÉ HACE FALTA
 * ==================
 * React desmonta TODO el árbol cuando un error llega hasta arriba sin que
 * nadie lo agarre. La aplicación no tenía ningún `ErrorBoundary`, así que
 * cualquier error de render —un chunk que no se pudo bajar después de un
 * despliegue, una respuesta con una forma inesperada— dejaba la pantalla en
 * blanco, sin nada que leer y sin más salida que recargar a mano.
 *
 * Un cartel no arregla el error, pero convierte "se rompió y no sé qué pasó"
 * en "se rompió, esto dice, y hay un botón".
 */

type Props = { children: ReactNode }
type Estado = { error: Error | null }

export class LimiteDeError extends Component<Props, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Al log del navegador: es lo único que queda para reconstruir qué pasó
    // cuando alguien avisa "se puso en blanco" media hora después.
    console.error("Error de render no atrapado:", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-[60dvh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            No se pudo mostrar esta pantalla
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Casi siempre es porque el sistema se actualizó mientras la tenías
            abierta. Recargá y debería andar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 w-full rounded-md bg-[#204983] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a3d6f]"
          >
            Recargar
          </button>
          <p className="mt-3 break-words text-left text-[11px] text-gray-400">
            {this.state.error.message}
          </p>
        </div>
      </div>
    )
  }
}
