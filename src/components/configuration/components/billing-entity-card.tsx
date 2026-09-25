"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { BillingEntity } from "@/components/facturacion/types"

/** Parsea "15, 30, 45" → [15, 30] (enteros 1-31, únicos y ordenados). */
function parseCloseDays(raw: string): number[] {
  const parsed = raw
    .split(",")
    .map((chunk) => Number.parseInt(chunk.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
  return Array.from(new Set(parsed)).sort((a, b) => a - b)
}

const formatCloseDays = (days: number[]): string => (days ?? []).join(", ")

type EntityPatch = Partial<Omit<BillingEntity, "id" | "name">>

interface BillingEntityCardProps {
  entity: BillingEntity
  saving: boolean
  onPatch: (id: number, body: EntityPatch) => Promise<void>
}

/**
 * Ficha de una entidad de facturación (Centro / Clínica / futuras). Cada
 * entidad tiene su propio ciclo de presentaciones y su propio recordatorio de
 * cierre — el cron `send_billing_reminders` lee estos campos por entidad.
 */
export function BillingEntityCard({ entity, saving, onPatch }: BillingEntityCardProps) {
  const [daysDraft, setDaysDraft] = useState(String(entity.reminder_days_before))
  const [closeDaysDraft, setCloseDaysDraft] = useState(formatCloseDays(entity.default_close_days))

  const saveDaysBefore = () => {
    const parsed = Number.parseInt(daysDraft, 10)
    if (Number.isNaN(parsed) || parsed < 1) {
      setDaysDraft(String(entity.reminder_days_before))
      return
    }
    if (parsed !== entity.reminder_days_before) void onPatch(entity.id, { reminder_days_before: parsed })
  }

  const saveCloseDays = () => {
    const parsed = parseCloseDays(closeDaysDraft)
    setCloseDaysDraft(formatCloseDays(parsed))
    if (JSON.stringify(parsed) !== JSON.stringify(entity.default_close_days ?? [])) {
      void onPatch(entity.id, { default_close_days: parsed })
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-medium text-gray-800">{entity.name}</p>
          <p className="text-xs text-gray-500">
            {entity.reports_breakdown_by_ooss ? "Informa el cobro discriminado por OOSS" : "Deposita un monto único"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={entity.reports_breakdown_by_ooss}
              disabled={saving}
              onCheckedChange={(v) => onPatch(entity.id, { reports_breakdown_by_ooss: v })}
            />
            <span className="text-xs text-gray-600">Desglosa por OOSS</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={entity.is_active}
              disabled={saving}
              onCheckedChange={(v) => onPatch(entity.id, { is_active: v })}
              className="data-[state=checked]:bg-emerald-600"
            />
            <span className="text-xs text-gray-600">Activa</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#204983]" />
          <span className="text-sm font-medium text-gray-700">Recordatorio de cierre</span>
          <Switch
            checked={entity.reminder_enabled}
            disabled={saving}
            onCheckedChange={(v) => onPatch(entity.id, { reminder_enabled: v })}
            className="ml-auto data-[state=checked]:bg-[#204983]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`days-before-${entity.id}`} className="text-xs text-gray-600">
              Avisar (días antes)
            </Label>
            <Input
              id={`days-before-${entity.id}`}
              type="number"
              min="1"
              className="h-8 text-sm"
              value={daysDraft}
              disabled={!entity.reminder_enabled || saving}
              onChange={(e) => setDaysDraft(e.target.value)}
              onBlur={saveDaysBefore}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`close-days-${entity.id}`} className="text-xs text-gray-600">
              Días de cierre sugeridos (1-31)
            </Label>
            <Input
              id={`close-days-${entity.id}`}
              className="h-8 text-sm"
              placeholder="Ej: 15, 30"
              value={closeDaysDraft}
              disabled={saving}
              onChange={(e) => setCloseDaysDraft(e.target.value)}
              onBlur={saveCloseDays}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
