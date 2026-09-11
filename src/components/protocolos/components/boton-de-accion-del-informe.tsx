"use client"

import type React from "react"
import { Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface ActionButtonProps {
  onClick: () => void
  disabled: boolean
  isLoading: boolean
  loadingLabel: string
  icon: React.ReactNode
  label: string
  description: string
  colorClass: string
  disabledReason?: string
  isPatientMethod?: boolean
  /**
   * Un nombre corto debajo del ícono. Es para el celular: ahí no hay mouse, así
   * que el tooltip que en el escritorio dice qué hace cada botón no aparece.
   */
  etiqueta?: string
}

/**
 * Una acción del informe: un botón chico, solo el ícono.
 *
 * Eran tarjetas anchas con título y descripción, dos por fila. Con cinco
 * acciones —mirar, imprimir, descargar, mail, WhatsApp— eso se comía media
 * pantalla del diálogo y empujaba el resto abajo del scroll, justo donde está
 * lo que hay que revisar antes de mandar: la fecha, la firma y los análisis
 * elegidos.
 *
 * El texto no se pierde, cambia de lugar: va al tooltip y al `aria-label`, así
 * que sigue estando para el mouse y para un lector de pantalla. Un ícono solo
 * es reconocible cuando son pocos y distintos entre sí, que es el caso.
 *
 * Lo usan el informe de un protocolo y la barra del lote: son las mismas
 * acciones, y verse distinto en cada lado era aprenderlas dos veces.
 */
export function ActionButton({
  onClick,
  disabled,
  isLoading,
  loadingLabel,
  icon,
  label,
  description,
  colorClass,
  disabledReason,
  isPatientMethod,
  etiqueta,
}: ActionButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // El nombre va acá porque en pantalla ya no está escrito: sin esto, un
      // lector de pantalla lee "botón" cinco veces.
      aria-label={isLoading ? loadingLabel : label}
      className={`
        relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${isPatientMethod ? "ring-2 ring-[#204983] ring-offset-2" : ""}
        ${colorClass}
      `}
    >
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {/* El método que eligió el paciente se marca con un punto y no con una
          etiqueta: en un botón de este tamaño no entra una palabra. */}
      {isPatientMethod && !isLoading && (
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#204983]" />
      )}
    </button>
  )

  // El tooltip explica qué hace, y por qué no se puede cuando está apagado.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {etiqueta ? (
          <span className="flex flex-col items-center gap-1">
            {button}
            <span className="text-center text-[11px] leading-tight text-slate-600">{etiqueta}</span>
          </span>
        ) : (
          <span className="inline-block">{button}</span>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] bg-slate-900 text-white">
        <p className="font-semibold">
          {label}
          {isPatientMethod ? " · método del paciente" : ""}
        </p>
        <p className="opacity-80">{disabledReason || description}</p>
      </TooltipContent>
    </Tooltip>
  )
}
