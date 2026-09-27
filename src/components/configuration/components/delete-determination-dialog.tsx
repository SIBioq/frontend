"use client"

import type React from "react"
import { useState } from "react"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
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
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, TestTube2 } from "lucide-react"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"

interface DeterminationItem {
  id: number
  name: string
  code: string
  measure_unit: string
}

interface DeleteDeterminationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  determination: DeterminationItem
}

export const DeleteDeterminationDialog: React.FC<DeleteDeterminationDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  determination,
}) => {
  const { apiRequest } = useApi()
  const toastActions = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await apiRequest(CATALOG_ENDPOINTS.DETERMINATION_DETAIL(determination.id), {
        method: "DELETE",
      })

      if (response.ok) {
        toastActions.success("Éxito", {
          description: "Determinación eliminada correctamente.",
        })
        onSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        toastActions.error("Error", {
          description: formatApiError(errorData, "No se pudo eliminar la determinación."),
        })
      }
    } catch (error) {
      console.error("Error deleting determination:", error)
      toastActions.error("Error", {
        description: getErrorMessage(error, "No se pudo completar la operación."),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Eliminar Determinación
              </AlertDialogTitle>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TestTube2 className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="mb-1 break-words font-medium text-red-900">{determination.name}</h4>
                  <div className="space-y-1 text-sm text-red-700">
                    <p>
                      <span className="font-medium">Código:</span> {determination.code || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Unidad:</span> {determination.measure_unit}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-2">⚠️ Esta acción no se puede deshacer</p>
              <p>
                Al eliminar esta determinación, se perderán todos los datos asociados y no podrá ser utilizada en
                futuros análisis.
              </p>
            </div>
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar Determinación"
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
