"use client"

import { useEffect, useMemo, useState } from "react"
import { useApi } from "@/hooks/use-api"
import { useDebounce } from "@/hooks/use-debounce"
import { PROTOCOL_ENDPOINTS } from "@/config/api"
import type { QuoteResult } from "@/types"

export interface QuoteDetailInput {
  analysis_id: number
  is_authorized: boolean
}

/**
 * Cotiza los montos del protocolo en el backend (POST /quote/), reusando la
 * misma resolución de nomencladores que la creación. Así el preview del ingreso
 * coincide 1:1 con lo que se va a cobrar (en vez de calcularlo en el front con
 * un único `bio_unit`, que ignoraba el nomenclador del particular).
 *
 * Se llama con debounce ante cambios de OOSS / análisis / autorización.
 */
export function useProtocolQuote(
  insuranceId: number | null,
  details: QuoteDetailInput[],
  preauthStatus?: string,
) {
  const { apiRequest } = useApi()
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Clave estable para el debounce (evita recotizar por renders sin cambios).
  const key = useMemo(
    () => JSON.stringify({ insuranceId, preauthStatus, details }),
    [insuranceId, preauthStatus, details],
  )
  const debouncedKey = useDebounce(key, 300)

  useEffect(() => {
    const { insuranceId: insId, preauthStatus: preauth, details: dets } = JSON.parse(debouncedKey) as {
      insuranceId: number | null
      preauthStatus?: string
      details: QuoteDetailInput[]
    }

    if (!dets || dets.length === 0) {
      setQuote(null)
      setLoading(false)
      setError(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)
    apiRequest(PROTOCOL_ENDPOINTS.QUOTE, {
      method: "POST",
      body: {
        insurance_id: insId ?? null,
        ...(preauth ? { preauth_status: preauth } : {}),
        details: dets,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cotizar el protocolo")
        return (await res.json()) as QuoteResult
      })
      .then((data) => {
        if (!cancelled) setQuote(data)
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null)
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey])

  return { quote, loading, error }
}
