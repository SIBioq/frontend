"use client"

import { FileClock } from "lucide-react"
import { Button } from "../../ui/button"

type Props = {
  cantidadDeAnalisis: number
  /** ISO */
  guardadoEn: string
  onContinuar: () => void
  onDescartar: () => void
  /** true mientras se están pidiendo al backend las entidades del borrador
   *  (auto al entrar, o a mano si «Continuar» todavía tiene que restaurar). */
  restaurando: boolean
}

/**
 * Cartel que avisa que se recuperó un protocolo que había quedado a medias.
 *
 * El formulario ya se restauró solo antes de que este cartel se pinte (salvo
 * que se haya entrado con un paciente preseteado, ver `ingreso-page.tsx`):
 * esto es sólo el aviso, no el disparador de la restauración.
 * - «Continuar» sólo baja el cartel: no hay nada más para rellenar.
 * - «Descartar» borra el borrador y reinicia el formulario a vacío.
 *
 * Presentacional puro: no toca `localStorage` ni sabe nada del esquema del
 * borrador. Sólo se le pasan los datos ya resueltos (`useBorradorDeIngreso`
 * en `ingreso-page.tsx` es quien conoce esa capa).
 *
 * No muestra ningún dato del paciente a propósito: el borrador sólo guarda
 * ids (ver `src/lib/borrador-de-ingreso.ts`), y este cartel respeta esa
 * misma frontera de PHI.
 */
export function AvisoDeBorrador({
  cantidadDeAnalisis,
  guardadoEn,
  onContinuar,
  onDescartar,
  restaurando,
}: Props) {
  const hora = new Date(guardadoEn).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const tramoDeAnalisis =
    cantidadDeAnalisis > 0
      ? ` con ${cantidadDeAnalisis} ${cantidadDeAnalisis === 1 ? "análisis cargado" : "análisis cargados"}`
      : ""

  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold text-gray-800">Recuperamos el protocolo que dejaste a medias</p>
            <p className="text-sm text-amber-800">
              Quedó a las {hora}
              {tramoDeAnalisis}. ¿Seguís con este o empezás de cero?
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="border-amber-300 text-amber-900 hover:bg-amber-100"
            onClick={onDescartar}
            disabled={restaurando}
          >
            Descartar
          </Button>
          <Button
            className="bg-[#204983] text-white hover:bg-[#2d5a9b]"
            onClick={onContinuar}
            disabled={restaurando}
          >
            {restaurando ? "Recuperando..." : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  )
}
