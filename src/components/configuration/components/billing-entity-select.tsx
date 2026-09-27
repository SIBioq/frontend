"use client"

import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApi } from "@/hooks/use-api"
import { BILLING_ENDPOINTS } from "@/config/api"
import type { BillingEntity } from "@/components/facturacion/types"

const NONE_VALUE = "__sin_entidad__"

interface BillingEntitySelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  /**
   * Si se puede dejar sin elegir. En el ingreso NO: hay obras sociales que
   * facturan por Centro o por Clínica según la preautorización del paciente, y
   * un protocolo sin entidad no aparece en los pendientes de ninguna de las
   * dos — no se factura nunca y nadie se entera.
   */
  allowNone?: boolean
  placeholder?: string
}

/** Selector de entidad de facturación (a qué entidad se le presenta esta OOSS). */
export function BillingEntitySelect({
  id = "billing_entity",
  value,
  onValueChange,
  disabled,
  allowNone = true,
  placeholder,
}: BillingEntitySelectProps) {
  const { apiRequest } = useApi()
  const [entities, setEntities] = useState<BillingEntity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    apiRequest(`${BILLING_ENDPOINTS.ENTITIES}?is_active=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        setEntities(Array.isArray(data) ? data : data.results || [])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Select
      value={allowNone ? value || NONE_VALUE : value}
      onValueChange={(next) => onValueChange(next === NONE_VALUE ? "" : next)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className="w-full min-w-0">
        <SelectValue
          placeholder={
            isLoading ? "Cargando entidades..." : placeholder || "Seleccionar entidad"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE_VALUE}>Sin asignar</SelectItem>}
        {entities.map((entity) => (
          <SelectItem key={entity.id} value={String(entity.id)}>
            {entity.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
