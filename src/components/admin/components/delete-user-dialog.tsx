"use client"

import type React from "react"
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/types"
import type { ApiRequestOptions } from "@/hooks/use-api"
import { USER_ENDPOINTS } from "@/config/api"
import { formatApiError } from "@/lib/api-error"

const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData, "Error desconocido")

interface DeleteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  setUsers: React.Dispatch<React.SetStateAction<User[]>>
  apiRequest: (url: string, options?: ApiRequestOptions) => Promise<Response>
  refreshData: () => Promise<void>
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  setUsers,
  apiRequest,
  refreshData,
}: DeleteUserDialogProps) {
  const { success, error } = useToast()

  const handleDeleteUser = async () => {
    if (!user) return

    try {
      const response = await apiRequest(USER_ENDPOINTS.USER_DETAIL(user.id), {
        method: "DELETE",
      })

      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
        await refreshData()
        success("Usuario eliminado", {
          description: "El usuario ha sido eliminado exitosamente.",
        })
        onOpenChange(false)
      } else {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }))
        error("Error al eliminar usuario", {
          description: extractErrorMessage(errorData),
        })
      }
    } catch (err) {
      console.error("Error al eliminar usuario:", err)
      error("Error", {
        description: "Ha ocurrido un error de red o inesperado.",
      })
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeading icon={Trash} tone="danger" title="Eliminar usuario" description="Esta acción no se puede deshacer." />
        <div className="py-4">
          <p className="text-sm sm:text-base">
            ¿Estás seguro de que deseas eliminar al usuario <strong className="break-all">{user.username}</strong>? Esta acción no se puede
            deshacer.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full sm:w-auto bg-transparent">
              Cancelar
            </Button>
          </DialogClose>
          <Button className="bg-red-600 hover:bg-red-700 w-full sm:w-auto" onClick={handleDeleteUser}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
