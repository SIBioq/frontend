"use client"

import { Ban, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ExclusionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre de la determinación que se va a marcar, para que el texto lo diga. */
  nombreDeterminacion: string
  onConfirmar: () => Promise<void>
  /** La request está en camino: el botón no se puede volver a apretar. */
  confirmando?: boolean
}

/**
 * Confirma marcar una determinación como "no corresponde" cuando la fila YA
 * tiene datos cargados.
 *
 * POR QUÉ PREGUNTA
 * ================
 * Marcar una fila vacía no tiene consecuencias. Marcar una que ya tiene un
 * valor —o una validación firmada— sí: ese dato deja de contar para el estado
 * del protocolo, el informe y el envío. No se borra, pero quien lo hace tiene
 * que saber qué está sacando de la cuenta.
 *
 * SIN ROJO
 * ========
 * No es una eliminación y es reversible, así que el botón va con el estilo
 * normal: el rojo está reservado para lo que no se puede deshacer.
 */
export function ExclusionConfirmDialog({
  open,
  onOpenChange,
  nombreDeterminacion,
  onConfirmar,
  confirmando = false,
}: ExclusionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 shrink-0 text-slate-500" />
            ¿Marcar “{nombreDeterminacion}” como no corresponde?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Esta determinación ya tiene datos cargados en el protocolo. Si la marcás como no
                corresponde, <span className="font-medium text-slate-700">el dato se conserva</span>:
                el valor, las notas y la validación quedan como están.
              </p>
              <p>
                Lo único que cambia es que deja de contar para el estado del protocolo, para el
                informe y para el envío de resultados.
              </p>
              <p>Podés volver a incluirla cuando quieras, sin perder nada.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={confirmando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            // `onSelect` del primitivo cierra el diálogo solo; acá lo cierra el
            // padre cuando la request terminó, así el spinner alcanza a verse.
            onClick={(e) => {
              e.preventDefault()
              void onConfirmar()
            }}
            disabled={confirmando}
          >
            {confirmando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Marcar como no corresponde
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
