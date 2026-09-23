"use client"

import { Calculator, CircleMinus, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DependienteAVaciar } from "@/hooks/use-protocol-results"

interface ExclusionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre de la determinación que se va a dejar fuera, para que el texto lo diga. */
  nombreDeterminacion: string
  /**
   * La fila que se deja fuera tiene valor, notas o validación. Lo calcula quien
   * abre el diálogo, que es el único que tiene el `Result` entero: acá alcanza
   * con un booleano para elegir el texto.
   */
  filaConDatos?: boolean
  /** Los cálculos que el backend va a vaciar, tal como vinieron en el 409. */
  dependientes?: DependienteAVaciar[]
  onConfirmar: () => Promise<void>
  /** La request está en camino: el botón no se puede volver a apretar. */
  confirmando?: boolean
}

/**
 * Confirma dejar una determinación fuera del protocolo cuando hay algo que
 * perder.
 *
 * POR QUÉ PREGUNTA
 * ================
 * Dejar fuera una fila vacía y sin consecuencias no pregunta nada. Se pregunta
 * en dos casos, los dos informados por el 409 del backend:
 *
 * - la fila YA tiene un valor —o una validación firmada—: ese dato deja de
 *   contar para el estado del protocolo, el informe y el envío. No se borra,
 *   pero quien lo hace tiene que saber qué saca de la cuenta;
 * - hay resultados calculados por fórmula que la usan como componente. Esos SÍ
 *   se vacían, y si estaban validados pierden la firma: un número hecho con
 *   algo que ya no está en el protocolo no vale. Por eso van listados por
 *   nombre antes de confirmar.
 *
 * SIN ROJO
 * ========
 * No es una eliminación y es reversible, así que va con el azul de la página,
 * igual que los otros diálogos del protocolo: el rojo está reservado para lo
 * que no se puede deshacer. El ámbar del aviso de cálculos es la excepción: eso
 * sí se vacía.
 */
export function ExclusionConfirmDialog({
  open,
  onOpenChange,
  nombreDeterminacion,
  filaConDatos = false,
  dependientes = [],
  onConfirmar,
  confirmando = false,
}: ExclusionConfirmDialogProps) {
  const validados = dependientes.filter((d) => d.validado)
  return (
    <Dialog open={open} onOpenChange={(o) => !confirmando && onOpenChange(o)}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="border-b border-[#cbd8ea] bg-[#f4f7fb] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-gray-900">
              <CircleMinus className="h-5 w-5 shrink-0 text-[#204983]" />
              Dejar fuera del protocolo
            </DialogTitle>
            <DialogDescription className="pt-1 text-gray-600">
              <span className="font-medium text-gray-800">{nombreDeterminacion}</span>{" "}
              {filaConDatos
                ? "ya tiene datos cargados en este protocolo."
                : "está vacía, pero hay cálculos de este protocolo que la usan."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm text-gray-600">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              <span className="font-medium text-gray-900">El dato se conserva.</span> El valor, las
              notas y la validación <span className="font-medium">de esta determinación</span>{" "}
              quedan como están.
            </p>
          </div>

          {dependientes.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium text-gray-900">
                  También se van a vaciar estos cálculos:
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {dependientes.map((dependiente) => (
                    <li key={dependiente.id}>{dependiente.nombre}</li>
                  ))}
                </ul>
                {validados.length > 0 && (
                  <p>
                    {validados.length === 1
                      ? "Alguno ya estaba validado: se le va a quitar la validación y habrá que firmarlo de nuevo."
                      : "Algunos ya estaban validados: se les va a quitar la validación y habrá que firmarlos de nuevo."}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Con cálculos por vaciar, el "sin perder nada" dejaría de ser
              cierto: el valor se recalcula al reincluir, pero la firma no
              vuelve. */}
          <p>
            Deja de contar para el estado del protocolo, el informe y el envío de resultados. Podés
            volver a incluirla cuando quieras
            {dependientes.length > 0
              ? ": los cálculos se vuelven a hacer solos, pero la validación se firma de nuevo."
              : ", sin perder nada."}
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onConfirmar()}
            disabled={confirmando}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {confirmando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CircleMinus className="mr-2 h-4 w-4" />
            )}
            Dejar fuera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
