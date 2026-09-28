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
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, TestTube } from "lucide-react"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"

interface Analysis {
  id: number
  name: string
  code: string
  bio_unit: string
  is_urgent: boolean
}

interface DeleteAnalysisCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  analysis: Analysis
}

export const DeleteAnalysisCatalogDialog: React.FC<DeleteAnalysisCatalogDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  analysis,
}) => {
  const { apiRequest } = useApi()
  const toastActions = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await apiRequest(CATALOG_ENDPOINTS.ANALYSIS_DETAIL(analysis.id), {
        method: "DELETE",
      })

      if (response.ok) {
        toastActions.success("Éxito", {
          description: "Análisis eliminado correctamente.",
        })
        onSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        toastActions.error("Error", {
          description: formatApiError(errorData, "No se pudo eliminar el análisis."),
        })
      }
    } catch (error) {
      console.error("Error deleting analysis:", error)
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
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">Eliminar Análisis</AlertDialogTitle>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TestTube className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="min-w-0 break-words font-medium text-red-900">{analysis.name || "Sin nombre"}</h4>
                    {analysis.is_urgent && (
                      <Badge variant="destructive" className="text-xs">
                        Urgente
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-red-700">
                    <p>
                      <span className="font-medium">Código:</span> {analysis.code || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Unidad Bioquímica:</span> {analysis.bio_unit || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-2">⚠️ Esta acción no se puede deshacer</p>
              <p>Al eliminar este análisis, se eliminarán también todas las determinaciones asociadas.</p>
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
                "Eliminar Análisis"
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
