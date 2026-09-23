"use client"

import { useCallback, useSyncExternalStore } from "react"
import useAuth from "@/contexts/auth-context"
import { hayBorrador, suscribirseAlBorrador } from "@/lib/borrador-de-ingreso"

/** ¿Este usuario dejó un ingreso a medias en esta PC? Reactivo: se entera del
 *  evento propio y del `storage` de otras pestañas. */
export function useHayBorradorDeIngreso(): boolean {
  const { user } = useAuth()

  const getSnapshot = useCallback(() => hayBorrador(user?.id ?? null), [user?.id])

  return useSyncExternalStore(suscribirseAlBorrador, getSnapshot, () => false)
}
