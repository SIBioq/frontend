import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, ArrowRight, FileText } from "lucide-react"
import type { AuditEntry, AuditUser } from "@/types"
import { CATEGORY_META } from "@/components/common/history-list"
import { MensajeDeAuditoria } from "@/components/common/mensaje-de-auditoria"
import { formatUtcDateTime } from "@/lib/format-utils"
import { getProtocolStatusBadgeClassByName } from "@/lib/status-styles"

interface AuditCardProps {
  entry: AuditEntry
}

const getActionBorderColor = (action: string): string => {
  const lowerAction = action.toLowerCase()

  if (lowerAction.includes("creacion")) return "border-l-green-500 dark:border-l-green-600"
  if (lowerAction.includes("actualizacion")) return "border-l-yellow-500 dark:border-l-yellow-600"
  if (lowerAction.includes("eliminacion")) return "border-l-red-500 dark:border-l-red-600"
  if (lowerAction.includes("negocio") || lowerAction.includes("business")) return "border-l-blue-500 dark:border-l-blue-600"
  if (lowerAction.includes("autenticacion") || lowerAction.includes("auth")) return "border-l-indigo-500 dark:border-l-indigo-600"
  if (lowerAction.includes("sistema") || lowerAction.includes("system")) return "border-l-slate-500 dark:border-l-slate-600"
  return "border-l-gray-400 dark:border-l-gray-600"
}

const getActionBadgeVariant = (action: string): string => {
  const lowerAction = action.toLowerCase()

  if (lowerAction.includes("creacion")) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  if (lowerAction.includes("actualizacion")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  if (lowerAction.includes("eliminacion")) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  if (lowerAction.includes("negocio") || lowerAction.includes("business")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  if (lowerAction.includes("autenticacion") || lowerAction.includes("auth")) return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
  if (lowerAction.includes("sistema") || lowerAction.includes("system")) return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
}

// El valor que manda la API ("creacion", "negocio") sirve para comparar y para
// elegir el color; escrito así, sin tilde y en minúscula, no sirve para leer.
const ACTION_LABEL: Record<string, string> = {
  creacion: "Creación",
  actualizacion: "Modificación",
  eliminacion: "Eliminación",
  negocio: "Acción",
  autenticacion: "Acceso",
  sistema: "Sistema",
}

export function AuditCard({ entry }: AuditCardProps) {
  const user: AuditUser = entry.user || { id: null, username: "Sistema", display_name: "Sistema", photo: null }
  const timestamp = entry.date || null
  const categoryMeta = entry.category ? CATEGORY_META[entry.category] : undefined
  const hasStateTransition = entry.state_from && entry.state_to
  const borderClassName = categoryMeta?.borderClassName || getActionBorderColor(entry.action || "")

  return (
    <Card className={`border-l-4 w-full min-w-0 overflow-hidden ${borderClassName}`}>
      <CardContent className="p-3 sm:p-4 min-w-0">
        <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:items-start">
          <Avatar className="h-8 w-8 shrink-0 sm:h-10 sm:w-10">
            <AvatarImage src={user.photo || undefined} alt={user.username} />
            <AvatarFallback>
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-medium break-all text-sm sm:text-base">{user.display_name || user.username}</span>
                {entry.action && (
                  <Badge className={`text-[10px] sm:text-xs px-2 py-0.5 ${getActionBadgeVariant(entry.action)}`}>
                    {ACTION_LABEL[entry.action] || entry.action}
                  </Badge>
                )}
                {categoryMeta ? (
                  <Badge className={`text-[10px] sm:text-xs px-2 py-0.5 ${categoryMeta.className}`}>
                    {categoryMeta.label}
                  </Badge>
                ) : entry.category_label ? (
                  <Badge variant="outline" className="text-[10px] sm:text-xs px-2 py-0.5">
                    {entry.category_label}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap shrink-0">
                <Clock className="h-3 w-3 shrink-0" />
                {formatUtcDateTime(timestamp)}
              </div>
            </div>

            {entry.related_protocol_id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-sky-700 border-sky-300">
                <FileText className="h-2.5 w-2.5 mr-1" />
                Protocolo #{entry.related_protocol_id}
              </Badge>
            )}

            {hasStateTransition && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 ${getProtocolStatusBadgeClassByName(entry.state_from, true)}`}
                >
                  {entry.state_from}
                </Badge>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <Badge className={`text-xs px-2 py-0.5 ${getProtocolStatusBadgeClassByName(entry.state_to)}`}>
                  {entry.state_to}
                </Badge>
              </div>
            )}

            <MensajeDeAuditoria
              message={entry.message}
              encabezado={entry.encabezado}
              detalle={entry.detalle}
              className="text-sm"
            />

          </div>
        </div>
      </CardContent>
    </Card>
  )
}
