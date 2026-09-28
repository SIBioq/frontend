import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, ArrowRight } from "lucide-react"
import type { HistoryEntry } from "@/types"
import { MensajeDeAuditoria } from "@/components/common/mensaje-de-auditoria"
import { formatUtcDateTime } from "@/lib/format-utils"
import { getProtocolStatusBadgeClassByName } from "@/lib/status-styles"

interface HistoryListProps {
  history: HistoryEntry[]
  emptyMessage?: string
}

const getActionBorderColor = (action: string): string => {
  const lowerAction = action.toLowerCase()

  if (lowerAction.includes("crear") || lowerAction.includes("create") || lowerAction.includes("creacion")) {
    return "border-l-green-500 dark:border-l-green-600"
  }

  if (
    lowerAction.includes("actualizacion") ||
    lowerAction.includes("modificar") ||
    lowerAction.includes("update") ||
    lowerAction.includes("edit")
  ) {
    return "border-l-yellow-500 dark:border-l-yellow-600"
  }

  if (lowerAction.includes("eliminacion") || lowerAction.includes("delete") || lowerAction.includes("borrar")) {
    return "border-l-red-500 dark:border-l-red-600"
  }

  if (lowerAction.includes("negocio") || lowerAction.includes("business")) {
    return "border-l-blue-500 dark:border-l-blue-600"
  }

  if (lowerAction.includes("autenticacion") || lowerAction.includes("auth")) {
    return "border-l-indigo-500 dark:border-l-indigo-600"
  }

  if (lowerAction.includes("sistema") || lowerAction.includes("system")) {
    return "border-l-slate-500 dark:border-l-slate-600"
  }

  return "border-l-gray-400 dark:border-l-gray-600"
}

const getActionBadgeVariant = (action: string): string => {
  const lowerAction = action.toLowerCase()

  if (lowerAction.includes("crear") || lowerAction.includes("create") || lowerAction.includes("creacion")) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  }

  if (
    lowerAction.includes("actualizacion") ||
    lowerAction.includes("modificar") ||
    lowerAction.includes("update") ||
    lowerAction.includes("edit")
  ) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  }

  if (lowerAction.includes("eliminacion") || lowerAction.includes("delete") || lowerAction.includes("borrar")) {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  if (lowerAction.includes("negocio") || lowerAction.includes("business")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }

  if (lowerAction.includes("autenticacion") || lowerAction.includes("auth")) {
    return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
  }

  if (lowerAction.includes("sistema") || lowerAction.includes("system")) {
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
  }

  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
}

export const CATEGORY_META: Record<string, { label: string; className: string; borderClassName: string }> = {
  protocol: {
    label: "Protocolo",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    borderClassName: "border-l-sky-500 dark:border-l-sky-600",
  },
  result: {
    label: "Resultado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    borderClassName: "border-l-emerald-500 dark:border-l-emerald-600",
  },
  validation: {
    label: "Validación",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
    borderClassName: "border-l-violet-500 dark:border-l-violet-600",
  },
  payment: {
    label: "Pago",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200",
    borderClassName: "border-l-amber-500 dark:border-l-amber-600",
  },
  billing: {
    label: "Facturación",
    className: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200",
    borderClassName: "border-l-yellow-500 dark:border-l-yellow-600",
  },
  report: {
    label: "Informes",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    borderClassName: "border-l-blue-500 dark:border-l-blue-600",
  },
  security: {
    label: "Accesos",
    className: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
    borderClassName: "border-l-stone-500 dark:border-l-stone-600",
  },
  state: {
    label: "Estado",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    borderClassName: "border-l-rose-500 dark:border-l-rose-600",
  },
  doctor: {
    label: "Médico",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    borderClassName: "border-l-cyan-500 dark:border-l-cyan-600",
  },
  insurance: {
    label: "Obra Social",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    borderClassName: "border-l-teal-500 dark:border-l-teal-600",
  },
  analysis: {
    label: "Análisis",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    borderClassName: "border-l-indigo-500 dark:border-l-indigo-600",
  },
  user: {
    label: "Usuario",
    className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
    borderClassName: "border-l-fuchsia-500 dark:border-l-fuchsia-600",
  },
  patient: {
    label: "Paciente",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    borderClassName: "border-l-orange-500 dark:border-l-orange-600",
  },
  system: {
    label: "Sistema",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    borderClassName: "border-l-slate-500 dark:border-l-slate-600",
  },
}

const formatActionName = (name?: string): string => {
  if (!name) return ""
  const last = name.split(".").pop() || name
  return last.replace(/_/g, " ")
}

export function HistoryList({ history, emptyMessage = "No hay historial disponible" }: HistoryListProps) {
  if (!history || history.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="space-y-1.5 sm:space-y-2 w-full min-w-0">
      {history.map((entry, index) => {
        const user = entry.user || { username: "Sistema", photo: null }
        const timestamp = entry.date || entry.created_at || null
        const categoryMeta = entry.category ? CATEGORY_META[entry.category] : undefined
        const hasStateTransition = entry.state_from && entry.state_to
        const borderClassName = categoryMeta?.borderClassName || getActionBorderColor(entry.action || "")

        return (
          <Card
            key={entry.event_id || `${entry.version}-${index}`}
            className={`border-l-4 w-full min-w-0 overflow-hidden ${borderClassName}`}
          >
            <CardContent className="p-2 sm:p-3 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 min-w-0">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                  <AvatarImage src={user.photo || undefined} alt={user.username} />
                  <AvatarFallback>
                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 text-sm min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap">
                      <span className="font-medium text-xs sm:text-sm break-all">{user.username}</span>
                      {entry.version && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0">
                          v{entry.version}
                        </Badge>
                      )}
                      {entry.action && (
                        <Badge
                          className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 ${getActionBadgeVariant(entry.action)}`}
                        >
                          {entry.action}
                        </Badge>
                      )}
                      {categoryMeta && (
                        <Badge className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 ${categoryMeta.className}`}>
                          {categoryMeta.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                      {formatUtcDateTime(timestamp)}
                    </div>
                  </div>

                  {(entry.model || entry.action_name) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-xs text-muted-foreground min-w-0">
                      {entry.model && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
                          {entry.model.display}
                        </Badge>
                      )}
                      {entry.object_repr && (
                        <span className="text-slate-500 break-all min-w-0">{entry.object_repr}</span>
                      )}
                      {entry.action_name && (
                        <span className="font-mono text-slate-400 break-all min-w-0">· {formatActionName(entry.action_name)}</span>
                      )}
                    </div>
                  )}

                  {hasStateTransition && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <Badge
                        variant="outline"
                        className={`text-[10px] sm:text-xs px-1.5 py-0 ${getProtocolStatusBadgeClassByName(
                          entry.state_from,
                          true,
                        )}`}
                      >
                        {entry.state_from}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      <Badge className={`text-[10px] sm:text-xs px-1.5 py-0 ${getProtocolStatusBadgeClassByName(entry.state_to)}`}>
                        {entry.state_to}
                      </Badge>
                    </div>
                  )}

                  <MensajeDeAuditoria
                    message={entry.message}
                    encabezado={entry.encabezado}
                    detalle={entry.detalle}
                    className="text-xs sm:text-sm"
                  />

                  {!entry.detalle?.length && entry.changes && entry.changes.length > 0 && (
                    <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5 min-w-0">
                      {entry.changes.map((change, idx) => (
                        <div key={idx} className="leading-snug break-words whitespace-pre-wrap">
                          • {change}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
