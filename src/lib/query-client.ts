import { QueryClient } from "@tanstack/react-query"

// React Query client compartido. Cache de 1 min para listados pesados (protocolos, pacientes).
// Reintentos en mutaciones desactivados (errores 4xx no son
// retryables — el helper de api-error se encarga del manejo de 401 con refresh).
//
// Vive en un módulo y no adentro de App porque lo usan también quienes no son
// componentes: `apiRequest` lo marca viejo después de cada escritura y el
// cierre de sesión lo vacía.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * Marca TODO lo cacheado como viejo, sin pedir nada todavía.
 *
 * Se llama después de cada escritura que salió bien. Cada pantalla sabe
 * refrescar lo que tiene a la vista, pero no lo que muestran las otras: borrar
 * un paciente desde su ficha y volver al listado mostraba al paciente borrado
 * hasta recargar, porque el listado tenía menos de un minuto y se servía del
 * cache sin preguntar.
 *
 * `refetchType: "none"` es a propósito: no se recarga nada de lo que está en
 * pantalla —eso lo sigue decidiendo cada pantalla, que sabe si hay un
 * formulario a medio llenar—. Lo que cambia es que la próxima vez que se monte
 * cualquier consulta, se muestra lo cacheado y se pide de nuevo por detrás.
 */
export function marcarTodoComoViejo() {
  void queryClient.invalidateQueries({ refetchType: "none" })
}
