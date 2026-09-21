"use client"

import type React from "react"
import {
  Loader2,
  TestTube,
  Edit,
  X,
  AlertTriangle,
  FileText,
  RefreshCw,
  Wallet,
} from "lucide-react"
import { Button } from "../../ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../ui/alert-dialog"

interface ProtocolActionsProps {
  protocolId: number
  canBeCancelled: boolean
  isCancelled?: boolean
  canUncancel?: boolean
  isEditable?: boolean
  showReports?: boolean
  showCoseguro?: boolean
  editDisabledReason?: string
  reportsDisabledReason?: string
  cancelDisabledReason?: string
  coseguroDisabledReason?: string
  isCancelling: boolean
  isUncancelling?: boolean
  onViewAnalysis: () => void
  onEdit: () => void
  onReports: () => void
  onCancel: () => void
  onUncancel?: () => void
  onSetCoseguro?: () => void
}

export function ProtocolActions({
  protocolId,
  canBeCancelled,
  isCancelled = false,
  canUncancel = false,
  isEditable = true,
  showReports = true,
  showCoseguro = false,
  editDisabledReason,
  reportsDisabledReason,
  cancelDisabledReason,
  coseguroDisabledReason,
  isCancelling,
  isUncancelling = false,
  onViewAnalysis,
  onEdit,
  onReports,
  onCancel,
  onUncancel,
  onSetCoseguro,
}: ProtocolActionsProps) {
  const renderDisabledTooltip = (reason: string | undefined, children: React.ReactNode) => {
    if (!reason) return children

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-full sm:w-auto">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] bg-slate-900 text-white">
          <p>{reason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="pt-4 border-t border-gray-100" data-no-expand>
      {/* // Improved responsive button layout */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-[#204983] border-[#204983] hover:bg-[#204983] hover:text-white bg-transparent"
          onClick={(e) => {
            e.stopPropagation()
            onViewAnalysis()
          }}
        >
          <TestTube className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline">Ver </span>Análisis
        </Button>
        {renderDisabledTooltip(
          !isEditable ? editDisabledReason || "Este protocolo no puede editarse en su estado actual." : undefined,
          <Button
            size="sm"
            variant="outline"
            className="bg-transparent"
            disabled={!isEditable}
            onClick={(e) => {
              e.stopPropagation()
              if (!isEditable) return
              onEdit()
            }}
          >
            <Edit className="h-4 w-4 mr-1" />
            Editar
          </Button>,
        )}
        {renderDisabledTooltip(
          !showReports ? reportsDisabledReason || "No se pueden generar reportes en el estado actual." : undefined,
          <Button
            size="sm"
            variant="outline"
            className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white bg-transparent"
            disabled={!showReports}
            onClick={(e) => {
              e.stopPropagation()
              if (!showReports) return
              onReports()
            }}
          >
            <FileText className="h-4 w-4 mr-1" />
            Reportes
          </Button>,
        )}
        {showCoseguro && renderDisabledTooltip(
          coseguroDisabledReason,
          <Button
            size="sm"
            variant="outline"
            className="text-teal-700 border-teal-600 hover:bg-teal-600 hover:text-white bg-transparent"
            disabled={Boolean(coseguroDisabledReason)}
            onClick={(e) => {
              e.stopPropagation()
              if (coseguroDisabledReason) return
              onSetCoseguro?.()
            }}
          >
            <Wallet className="h-4 w-4 mr-1" />
            Coseguro
          </Button>,
        )}
        {isCancelled && canUncancel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-600 hover:bg-green-600 hover:text-white bg-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Descancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[95vw] max-w-md" onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-green-600" />
                  Descancelar Protocolo
                </AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Confirmás descancelar el protocolo #{protocolId}? Se restaurará al estado previo a la cancelación.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Volver</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onUncancel}
                  disabled={isUncancelling}
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                >
                  {isUncancelling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Descancelando...
                    </>
                  ) : (
                    "Confirmar descancelación"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : canBeCancelled ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white bg-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[95vw] max-w-md" onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Cancelar Protocolo
                </AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que deseas cancelar el protocolo #{protocolId}? El protocolo pasará al estado "Cancelado"
                  y podrá ser restaurado más adelante.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCancel}
                  disabled={isCancelling}
                  className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    "Confirmar Cancelación"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          renderDisabledTooltip(
            cancelDisabledReason || "Este protocolo no puede cancelarse en su estado actual.",
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white bg-transparent"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>,
          )
        )}
      </div>
    </div>
  )
}
