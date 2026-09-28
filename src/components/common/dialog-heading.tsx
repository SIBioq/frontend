import type { LucideIcon } from "lucide-react"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface DialogHeadingProps {
  icon?: LucideIcon
  title: string
  description?: string
  tone?: "brand" | "danger"
}

/**
 * Encabezado de modal unificado (ícono + título + descripción) para mantener una
 * estética consistente en todos los diálogos de crear/editar/eliminar. Un único
 * punto para ajustar el look de los headers de modales de toda la app.
 */
export function DialogHeading({ icon: Icon, title, description, tone = "brand" }: DialogHeadingProps) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tone === "danger" ? "bg-red-50 text-red-600" : "bg-[#204983]/10 text-[#204983]",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 text-left">
          <DialogTitle className="break-words text-lg">{title}</DialogTitle>
          {description && <DialogDescription className="mt-0.5 break-words">{description}</DialogDescription>}
        </div>
      </div>
    </DialogHeader>
  )
}
