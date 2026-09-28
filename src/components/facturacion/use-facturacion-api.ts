import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { BILLING_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type {
  BilledInvoice,
  BillingEntity,
  ClosedPresentation,
  CurrentTotal,
  PendingProtocolToBill,
  PresentationSummaryItem,
  ReminderPhone,
} from "./types"

interface PaginatedResponse<T> {
  results: T[]
  count?: number
  next?: string | null
}

/**
 * Datos + acciones de Facturación contra el API real de `billing`
 * (backend/docs/API_BILLING.md). Reemplaza use-facturacion-mock.ts.
 */
export function useFacturacionApi(entityId: number | null) {
  const { apiRequest } = useApi()
  const queryClient = useQueryClient()
  const [markingProtocolId, setMarkingProtocolId] = useState<number | null>(null)

  const entitiesQuery = useApiQuery<PaginatedResponse<BillingEntity> | BillingEntity[]>({
    queryKey: ["billing", "entities"],
    url: `${BILLING_ENDPOINTS.ENTITIES}?is_active=true`,
    staleTime: 60 * 1000,
  })
  const entities: BillingEntity[] = Array.isArray(entitiesQuery.data)
    ? entitiesQuery.data
    : entitiesQuery.data?.results ?? []

  const pendingQuery = useApiQuery<PaginatedResponse<PendingProtocolToBill> | PendingProtocolToBill[]>({
    queryKey: ["billing", "protocols-to-bill", entityId],
    url: `${BILLING_ENDPOINTS.PROTOCOLS_TO_BILL}?entity_id=${entityId}`,
    enabled: entityId != null,
  })
  const pendingProtocols: PendingProtocolToBill[] = Array.isArray(pendingQuery.data)
    ? pendingQuery.data
    : pendingQuery.data?.results ?? []

  const currentTotalQuery = useApiQuery<CurrentTotal>({
    queryKey: ["billing", "current-total", entityId],
    url: `${BILLING_ENDPOINTS.CURRENT_TOTAL}?entity_id=${entityId}`,
    enabled: entityId != null,
  })

  // Protocolos individuales ya facturados en la presentación abierta — para
  // poder verlos (no solo el total por OOSS) y desmarcar si hubo un error.
  const currentInvoicesQuery = useApiQuery<PaginatedResponse<BilledInvoice> | BilledInvoice[]>({
    queryKey: ["billing", "facturados-actual", entityId],
    url: `${BILLING_ENDPOINTS.FACTURADOS}?entity_id=${entityId}&current=true`,
    enabled: entityId != null,
  })
  const currentInvoices: BilledInvoice[] = Array.isArray(currentInvoicesQuery.data)
    ? currentInvoicesQuery.data
    : currentInvoicesQuery.data?.results ?? []

  const closedQuery = useApiQuery<PaginatedResponse<ClosedPresentation> | ClosedPresentation[]>({
    queryKey: ["billing", "presentations-closed", entityId],
    url: `${BILLING_ENDPOINTS.CLOSED_PRESENTATIONS}?entity_id=${entityId}`,
    enabled: entityId != null,
  })
  const closedPresentations: ClosedPresentation[] = Array.isArray(closedQuery.data)
    ? closedQuery.data
    : closedQuery.data?.results ?? []

  const summaryQuery = useApiQuery<{ results: PresentationSummaryItem[] }>({
    queryKey: ["billing", "presentations-summary", entityId],
    // limit=60 (máximo permitido): trae suficiente historial para que los
    // filtros de rango de fechas del gráfico (3 meses/30 días/7 días) tengan
    // de dónde recortar del lado del cliente.
    url: `${BILLING_ENDPOINTS.ANALYTICS_PRESENTATIONS_SUMMARY}?entity_id=${entityId}&limit=60`,
    enabled: entityId != null,
  })
  const presentationsSummary = summaryQuery.data?.results ?? []

  const phonesQuery = useApiQuery<PaginatedResponse<ReminderPhone> | ReminderPhone[]>({
    queryKey: ["billing", "reminder-phones"],
    url: BILLING_ENDPOINTS.REMINDER_PHONES,
  })
  const reminderPhones: ReminderPhone[] = Array.isArray(phonesQuery.data)
    ? phonesQuery.data
    : phonesQuery.data?.results ?? []

  const invalidateEntity = () => {
    queryClient.invalidateQueries({ queryKey: ["billing", "protocols-to-bill", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "current-total", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "facturados-actual", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-closed", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-summary", entityId] })
  }

  const [unbillingProtocolId, setUnbillingProtocolId] = useState<number | null>(null)

  /** Desmarcar un protocolo facturado por error, mientras su presentación siga abierta. */
  const unbillProtocol = async (protocolId: number) => {
    setUnbillingProtocolId(protocolId)
    try {
      const res = await apiRequest(BILLING_ENDPOINTS.UNBILL_PROTOCOL(protocolId), { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "No se pudo desmarcar el protocolo"))
      }
      toast.success(`Protocolo #${protocolId} desmarcado`)
      invalidateEntity()
      return true
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo desmarcar el protocolo"))
      return false
    } finally {
      setUnbillingProtocolId(null)
    }
  }

  /**
   * `overrideEntityId`: facturar este protocolo puntual a OTRA entidad que la
   * habitual de su OOSS, sin cambiar esa asignación. Requiere que el backend
   * acepte `entity_id` en el body (pedido #4 en
   * doc/facturacion-conexion-real-backend-prompt.md) — hasta que lo agregue,
   * lo ignora en silencio y factura igual a la entidad habitual.
   */
  const markProtocolBilled = async (protocolId: number, overrideEntityId?: number) => {
    setMarkingProtocolId(protocolId)
    try {
      const res = await apiRequest(BILLING_ENDPOINTS.CREATE_FOR_PROTOCOL(protocolId), {
        method: "POST",
        ...(overrideEntityId != null ? { body: { entity_id: overrideEntityId } } : {}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "No se pudo marcar el protocolo como facturado"))
      }
      toast.success(`Protocolo #${protocolId} marcado como facturado`)
      invalidateEntity()
      return true
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo marcar como facturado"))
      return false
    } finally {
      setMarkingProtocolId(null)
    }
  }

  const saveUbValue = async (presentationId: number, insuranceId: number, ubValue: number) => {
    const res = await apiRequest(BILLING_ENDPOINTS.SET_UB_VALUE_FOR_INSURANCE(presentationId), {
      method: "POST",
      body: { insurance_id: insuranceId, ub_value: ubValue.toFixed(2) },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "No se pudo cargar el valor UB"))
    }
    toast.success("Valor UB cargado, monto esperado recalculado")
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-closed", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-summary", entityId] })
    // El valor cascadea a Insurance.ub_value: refrescar la sugerencia pre-cargada.
    queryClient.invalidateQueries({ queryKey: ["insurances", "detail", insuranceId] })
  }

  const saveCollected = async (presentationId: number, insuranceId: number, amount: number, reason = "") => {
    const res = await apiRequest(BILLING_ENDPOINTS.SET_COLLECTED_FOR_INSURANCE(presentationId), {
      method: "POST",
      body: { insurance_id: insuranceId, collected_amount: amount.toFixed(2), difference_reason: reason },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "No se pudo cargar el monto cobrado"))
    }
    toast.success("Monto cobrado cargado")
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-closed", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-summary", entityId] })
  }

  const saveCollectedTotal = async (presentationId: number, amount: number, reason = "") => {
    const res = await apiRequest(BILLING_ENDPOINTS.SET_COLLECTED_TOTAL(presentationId), {
      method: "POST",
      body: { collected_amount: amount.toFixed(2), difference_reason: reason },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "No se pudo cargar el monto total cobrado"))
    }
    toast.success("Monto total cobrado cargado")
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-closed", entityId] })
    queryClient.invalidateQueries({ queryKey: ["billing", "presentations-summary", entityId] })
  }

  const closePresentation = async (nextCloseDate: string | null, name = "", notes = "") => {
    if (entityId == null) return false
    const res = await apiRequest(BILLING_ENDPOINTS.CLOSE_PRESENTATION, {
      method: "POST",
      body: { entity_id: entityId, next_close_date: nextCloseDate, name, notes },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(formatApiError(err, "No se pudo cerrar la presentación"))
      return false
    }
    toast.success(
      nextCloseDate ? `Presentación cerrada. Próximo cierre: ${nextCloseDate}` : "Presentación cerrada. Fecha de próximo cierre pendiente.",
    )
    invalidateEntity()
    return true
  }

  const setTargetCloseDate = async (presentationId: number, date: string) => {
    const res = await apiRequest(BILLING_ENDPOINTS.PRESENTATION_DETAIL(presentationId), {
      method: "PATCH",
      body: { target_close_date: date },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "No se pudo actualizar la fecha de cierre"))
    }
    toast.success(`Fecha de cierre actualizada: ${date}`)
    queryClient.invalidateQueries({ queryKey: ["billing", "current-total", entityId] })
  }

  const addReminderPhone = async (label: string, phone: string) => {
    const res = await apiRequest(BILLING_ENDPOINTS.REMINDER_PHONES, {
      method: "POST",
      body: { label, phone, is_active: true },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "No se pudo agregar el número"))
    }
    toast.success("Número agregado")
    queryClient.invalidateQueries({ queryKey: ["billing", "reminder-phones"] })
  }

  const togglePhone = async (id: number, active: boolean) => {
    const res = await apiRequest(BILLING_ENDPOINTS.REMINDER_PHONE_DETAIL(id), {
      method: "PATCH",
      body: { is_active: active },
    })
    if (!res.ok) return
    queryClient.invalidateQueries({ queryKey: ["billing", "reminder-phones"] })
  }

  const removePhone = async (id: number) => {
    const res = await apiRequest(BILLING_ENDPOINTS.REMINDER_PHONE_DETAIL(id), { method: "DELETE" })
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}))
      toast.error(formatApiError(err, "No se pudo eliminar el número"))
      return
    }
    toast.success("Número eliminado")
    queryClient.invalidateQueries({ queryKey: ["billing", "reminder-phones"] })
  }

  return {
    entities,
    entitiesLoading: entitiesQuery.isLoading,
    pendingProtocols,
    pendingLoading: pendingQuery.isLoading,
    currentTotal: currentTotalQuery.data ?? null,
    currentTotalLoading: currentTotalQuery.isLoading,
    currentInvoices,
    currentInvoicesLoading: currentInvoicesQuery.isLoading,
    closedPresentations,
    closedLoading: closedQuery.isLoading,
    presentationsSummary,
    summaryLoading: summaryQuery.isLoading,
    markingProtocolId,
    markProtocolBilled,
    unbillingProtocolId,
    unbillProtocol,
    saveUbValue,
    saveCollected,
    saveCollectedTotal,
    closePresentation,
    setTargetCloseDate,
    reminderPhones,
    addReminderPhone,
    togglePhone,
    removePhone,
  }
}
