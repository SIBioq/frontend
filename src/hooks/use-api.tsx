"use client"

import { useCallback } from "react"
import { useLoading } from "@/hooks/use-loading"
import { API_CONFIG } from "@/config/api"
import { clearSession, getAccessToken } from "@/lib/auth-storage"
import { refrescarSesion } from "@/lib/refresh-de-sesion"
import { dispatchSessionExpiredEvent } from "@/lib/session-events"

/**
 * Latencia artificial, sólo para el dev server.
 *
 * En local el backend contesta en milisegundos y todo se siente instantáneo:
 * los skeletons no se llegan a ver y no hay forma de saber si el scroll
 * infinito realmente adelanta el lote siguiente o si simplemente el backend
 * es rápido. Con `VITE_API_DELAY_MS=400` en el `.env` cada request espera eso
 * (con un jitter de ±30%, porque una red real no es constante) antes de salir.
 *
 * NO LLEGA A PRODUCCIÓN: `import.meta.env.DEV` es el literal `false` en
 * cualquier `vite build`, así que el `if` de abajo queda en `if (false)` y
 * rollup borra tanto la llamada como esta función del bundle. No hay nada que
 * acordarse de sacar antes de compilar; si querés comprobarlo,
 * `npm run build && grep -r VITE_API_DELAY_MS dist/` no encuentra nada.
 */
const DELAY_API_DEV = import.meta.env.DEV ? Number(import.meta.env.VITE_API_DELAY_MS) || 0 : 0

const demorarComoEnProduccion = async () => {
  if (DELAY_API_DEV <= 0) return
  const conJitter = DELAY_API_DEV * (0.7 + Math.random() * 0.6)
  await new Promise((resolve) => setTimeout(resolve, conJitter))
}

// Evita que doble clics o dos efectos simultáneos repitan una escritura
// idéntica mientras la primera todavía está en vuelo.
const escriturasEnCurso = new Map<string, Promise<Response>>()

// JSDoc documentation for ApiRequestOptions and useApi hook
/**
 * Options for API requests, including HTTP method, request body, headers, and timeout.
 */
export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  // Request body payload
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
  /** Optional key to trigger loading indicator via useLoading */
  loadingKey?: string
  /** Skip automatic token refresh on 401 (for refresh token requests) */
  skipTokenRefresh?: boolean
}

/**
 * Custom hook to perform API requests with automatic token handling, refresh,
 * error logging, and timeout support. Returns an apiRequest function.
 */
export const useApi = () => {
  const { setLoading } = useLoading()

  // La renovación vive en `@/lib/refresh-de-sesion` y no acá.
  //
  // Antes este hook tenía su propia copia, y `auth-context` otra. Dos copias
  // significa que una pantalla que dispara requests por los dos caminos podía
  // mandar dos renovaciones con el mismo refresh token. Mientras el backend no
  // invalide el token viejo eso pasa desapercibido; en cuanto lo invalide,
  // expulsa a la persona. El módulo compartido garantiza una sola renovación
  // en curso.
  const refreshToken = useCallback((): Promise<boolean> => refrescarSesion(), [])

  const apiRequest = useCallback(
    async (url: string, options: ApiRequestOptions = {}) => {
      const { loadingKey, skipTokenRefresh = false, ...apiOptions } = options
      if (loadingKey) setLoading(loadingKey, true)

      const { method = "GET", body, headers = {}, timeout = API_CONFIG.TIMEOUT } = apiOptions

      const makeRequest = async (): Promise<Response> => {
        // Se demora antes de armar el AbortController para que la espera
        // simulada no se coma el timeout real del request.
        if (import.meta.env.DEV) await demorarComoEnProduccion()

        const requestHeaders: Record<string, string> = {
          ...headers,
        }

        const isFormData = body instanceof FormData
        if (!isFormData && body) {
          requestHeaders["Content-Type"] = "application/json"
        }

        const token = getAccessToken()
        if (token) {
          requestHeaders.Authorization = `Bearer ${token}`
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        let finalUrl: string
        if (url.startsWith("http://") || url.startsWith("https://")) {
          finalUrl = url
        } else {
          const baseUrl = API_CONFIG.BASE_URL
          const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
          const cleanUrl = url.startsWith("/") ? url.slice(1) : url
          finalUrl = `${cleanBaseUrl}${cleanUrl}`
        }

        try {
          let requestBody: string | FormData | undefined
          if (isFormData) {
            requestBody = body
          } else if (body) {
            requestBody = JSON.stringify(body)
          } else {
            requestBody = undefined
          }

          const response = await fetch(finalUrl, {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal: controller.signal,
            mode: "cors",
          })

          clearTimeout(timeoutId)

          return response
        } catch (error) {
          clearTimeout(timeoutId)
          if (error instanceof Error && error.name === "AbortError") {
            console.error(`[v0] Request timed out for ${finalUrl} after ${timeout}ms`)
            throw new Error(`Tiempo de espera agotado después de ${timeout}ms`)
          }
          console.error(`[v0] Network or unexpected error for ${finalUrl}:`, error)
          throw error
        }
      }

      try {
        const esEscritura = method !== "GET" && !(body instanceof FormData)
        let clave: string | null = null
        if (esEscritura) {
          try {
            const sesion = getAccessToken() || "anon"
            clave = `${sesion}:${method}:${url}:${JSON.stringify(body ?? null)}`
          } catch {
            // Un body no serializable no se puede deduplicar de forma segura.
          }
        }

        const ejecutar = async () => {
          let response = await makeRequest()

          if (response.status === 401 && !skipTokenRefresh) {
            console.warn("[v0] 401 Unauthorized. Attempting token refresh...")

            const refreshSuccess = await refreshToken()

            if (refreshSuccess) {
              console.log("[v0] Token refreshed successfully. Retrying request...")
              response = await makeRequest()
            } else {
              console.error("[v0] Token refresh failed. Session expired.")
              clearSession()
              dispatchSessionExpiredEvent({
                reason: "refresh_failed",
                message: "Tu sesión expiró. Volvé a iniciar sesión para continuar.",
              })
              throw new Error("Sesión expirada")
            }
          }

          return response
        }

        if (!clave) return await ejecutar()

        const existente = escriturasEnCurso.get(clave)
        if (existente) return (await existente).clone()

        const promesa = ejecutar()
        escriturasEnCurso.set(clave, promesa)
        try {
          // Todos reciben una copia: la respuesta original queda disponible
          // para los demás consumidores que esperen la misma operación.
          return (await promesa).clone()
        } finally {
          if (escriturasEnCurso.get(clave) === promesa) escriturasEnCurso.delete(clave)
        }
      } catch (error) {
        console.error(`[v0] Final error:`, error)
        throw error
      } finally {
        if (loadingKey) setLoading(loadingKey, false)
      }
    },
    [setLoading, refreshToken],
  )

  return { apiRequest }
}
