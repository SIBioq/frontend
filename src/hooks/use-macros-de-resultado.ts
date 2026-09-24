"use client"

import { useMemo } from "react"

import { RESULTS_ENDPOINTS } from "@/config/api"
import { useApiQuery } from "@/hooks/use-api-query"
import type { MacroDeResultado } from "@/types"

/**
 * Los atajos `Alt + tecla` de la pantalla de carga de resultados.
 *
 * SE PIDEN UNA VEZ Y DURAN
 * ========================
 * Son configuración del laboratorio: cambian cuando alguien entra a
 * Configuración a tocarlas, no mientras se carga un protocolo. Pedirlas de
 * nuevo en cada protocolo que se abre sería una consulta por protocolo para
 * traer siempre las mismas tres filas.
 */
const MEDIA_HORA = 30 * 60 * 1000

/**
 * QUÉ TECLA APRETÓ, SIN DEPENDER DE QUÉ CARÁCTER ESCRIBE
 * =====================================================
 * `event.key` con Alt no es la letra: en macOS `Alt + n` da "˜" y `Alt + p`
 * da "π". `event.code` es la tecla FÍSICA (`KeyN`, `Digit3`) y no cambia con
 * el sistema ni con la distribución del teclado, así que es lo único con lo
 * que un atajo con Alt puede resolverse igual en todas las máquinas del
 * laboratorio.
 *
 * Devuelve `null` para cualquier otra tecla (F5, las flechas, Espacio): no
 * hay macro posible ahí, y es lo que hace que el resto del teclado siga
 * funcionando como siempre.
 *
 * Las flechas en particular quedan afuera a propósito: Alt + flechas está
 * reservado para moverse entre resultados (ver `onInputKeyDown` en
 * `protocol-results-loader.tsx`), y una macro ahí se pisaría con esa
 * navegación.
 */
export function teclaDelEvento(code: string): string | null {
  const letra = /^Key([A-Z])$/.exec(code)
  if (letra) return letra[1].toLowerCase()
  const digito = /^Digit([0-9])$/.exec(code)
  if (digito) return digito[1]
  return null
}

export function useMacrosDeResultado() {
  const query = useApiQuery<MacroDeResultado[]>({
    queryKey: ["results", "macros"],
    url: RESULTS_ENDPOINTS.MACROS,
    staleTime: MEDIA_HORA,
  })

  const macros = useMemo(() => query.data ?? [], [query.data])
  const porTecla = useMemo(
    () => new Map(macros.map((macro) => [macro.tecla, macro])),
    [macros],
  )

  return { macros, porTecla, isLoading: query.isLoading, refetch: query.refetch }
}
