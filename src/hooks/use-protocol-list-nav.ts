"use client"

import { useEffect } from "react"

import { API_CONFIG } from "@/config/api"
import { useApiQuery } from "@/hooks/use-api-query"
import type { PaginatedPage } from "@/hooks/use-api-infinite-query"
import { vecinosPorNumeroDeProtocolo } from "@/lib/vecinos-del-protocolo"

const CLAVE = "labsalud_orden_de_la_lista_de_protocolos"

type Orden = { ids: number[]; next: string | null }

/**
 * El orden en que se vieron los protocolos, para poder saltar de un detalle al
 * de al lado.
 *
 * POR QUÉ SE GUARDA EN VEZ DE VOLVER A PEDIRLO
 * ============================================
 * La lista se ordena y se filtra con cosas que no sobreviven a la navegación:
 * el texto de la búsqueda y la columna por la que se ordenó viven en el estado
 * de esa página. Pedir la lista de nuevo desde el detalle devuelve OTRO orden,
 * y "Siguiente" llevaría a un protocolo que no es el de la fila de abajo — que
 * es lo único que la píldora promete.
 *
 * Va en `sessionStorage` y no en el cache de React Query porque el cache tira
 * lo que nadie mira a los cinco minutos: quedarse un rato largo en un detalle
 * hacía desaparecer la píldora. Y así también sobrevive a un F5.
 */
export function guardarOrdenDeLaLista(ids: number[], next: string | null) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ids, next } satisfies Orden))
  } catch {
    // Sin sessionStorage (modo privado viejo, cuota llena) simplemente no hay
    // píldora. No es motivo para romper la lista.
  }
}

function leerOrden(): Orden {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return { ids: [], next: null }
    const dato = JSON.parse(crudo) as Partial<Orden>
    return {
      ids: Array.isArray(dato.ids) ? dato.ids.filter((n) => Number.isInteger(n)) : [],
      next: typeof dato.next === "string" ? dato.next : null,
    }
  } catch {
    return { ids: [], next: null }
  }
}

/**
 * Anterior y siguiente al protocolo abierto, según la lista que se estaba
 * mirando. Si no se pasó por la lista —link directo, o se entró desde otra
 * pantalla— no hay vecinos y la píldora no aparece; es preferible a inventar
 * un orden.
 */
export function useProtocolListNav(currentId: number): { prevId: number | null; nextId: number | null } {
  const { ids, next } = leerOrden()
  const idx = ids.indexOf(currentId)
  const enElBorde = idx >= 0 && idx === ids.length - 1

  // NO SE FRENA EN EL FONDO DE LO CARGADO
  // La lista trae de a 20 y el resto llega con el scroll. Sin esto, el que
  // abriera el último de la tanda se quedaba sin "Siguiente" aunque haya
  // cientos más: un final falso, puesto por cuánto se scrolleó y no por dónde
  // termina la lista.
  const urlDeLaContinuacion = mismaApi(next)
  const extra = useApiQuery<PaginatedPage<{ id: number }>>({
    queryKey: ["protocols", "list", "continuacion", urlDeLaContinuacion ?? ""],
    url: urlDeLaContinuacion ?? "",
    enabled: enElBorde && Boolean(urlDeLaContinuacion),
    staleTime: 60 * 1000,
  })

  // Lo que llegó de más se suma al orden guardado: si desde acá se sigue
  // avanzando, el próximo detalle ya lo encuentra sin volver a pedirlo.
  const traidos = extra.data?.results
  useEffect(() => {
    if (!enElBorde || !traidos?.length) return
    const guardado = leerOrden()
    if (guardado.ids[guardado.ids.length - 1] !== currentId) return
    guardarOrdenDeLaLista(
      [...guardado.ids, ...traidos.map((r) => r.id)],
      extra.data?.next ?? null,
    )
  }, [enElBorde, traidos, currentId, extra.data?.next])

  const completa = enElBorde && traidos?.length ? [...ids, ...traidos.map((r) => r.id)] : ids

  // Anterior y siguiente son por NÚMERO de protocolo, no por posición: la lista
  // viene del más nuevo al más viejo. Ver `vecinosPorNumeroDeProtocolo`.
  return vecinosPorNumeroDeProtocolo(completa, currentId)
}

/**
 * La URL de la página siguiente, pero apuntando a la API con la que se está
 * hablando ahora.
 *
 * El `next` que manda DRF viene con el host con el que el servidor se ve a sí
 * mismo, que detrás de un proxy no tiene por qué ser el que usa la app. De esa
 * URL sirve el camino y los parámetros; el host lo pone la app.
 */
function mismaApi(next: string | null): string | null {
  if (!next) return null
  try {
    const url = new URL(next)
    return `${API_CONFIG.BASE_URL.replace(/\/$/, "")}${url.pathname}${url.search}`
  } catch {
    return null
  }
}
