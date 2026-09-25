/**
 * Formas reales del API de facturación — ver backend/docs/API_BILLING.md.
 * Reemplaza mock-data.ts.
 */

export interface BillingEntity {
  id: number
  name: string
  /** true = informa el cobro discriminado por OOSS (ej. la Clínica). false = deposita un monto único (ej. el Centro). */
  reports_breakdown_by_ooss: boolean
  /** Recordatorio de cierre POR ENTIDAD (el cron ya no usa la config global). */
  reminder_enabled: boolean
  reminder_days_before: number
  /** Días del mes (1-31) sugeridos para el próximo cierre. Solo sugerencia; la fecha la calcula el front. */
  default_close_days: number[]
  is_active: boolean
}

export interface PendingProtocolToBill {
  protocol_id: number
  status: string
  billing_status: string
  patient: { id: number; first_name: string; last_name: string } | null
  insurance: {
    id: number
    name: string
    ub_value_at_protocol_creation: string
    requires_preauthorization?: boolean
  } | null
  total_ub_authorized: string
  expected_amount: string
  trajo_orden?: string
  preauth_status?: string
  is_printed?: boolean
  /** Lista de faltantes; vacía = puede facturar. El backend igual bloquea con 400 si falta algo. */
  missing_paperwork: string[]
}

export interface CurrentTotalOssRow {
  insurance_id: number
  insurance_name: string
  protocols_count: number
  total_ub_authorized: string
  expected_amount: string
}

/** Presentación abierta embebida en current-total (pedido #1 al backend — puede no estar todavía). */
export interface OpenPresentation {
  id: number
  entity_id: number
  entity_name: string
  reference: string
  name: string
  period_start: string
  period_end: string
  target_close_date: string | null
  status: "abierta"
}

export interface CurrentTotal {
  protocols_count: number
  total_ub_authorized: string
  expected_by_ooss: CurrentTotalOssRow[]
  /** undefined mientras el backend no lo agregue (ver doc/facturacion-conexion-real-backend-prompt.md #1). */
  presentation?: OpenPresentation | null
}

export interface ClosedOssBreakdown {
  insurance_id: number
  insurance_name: string
  protocol_count: number
  total_ub?: string
  expected_amount: string
  /** null hasta que se cargue un cobro — no confundir con $0 real. */
  collected_amount: string | null
  difference_amount: string | null
  difference_reason?: string
}

export interface ClosedPresentationProtocol {
  protocol_id: number
  invoice_id: number
  invoice_number: string
  insurance: { id: number; name: string } | null
  expected_amount: string
  paid_amount?: string
  difference_amount?: string
}

export interface ClosedPresentation {
  id: number
  entity_id?: number
  entity_name?: string
  reference: string
  name: string
  period_start: string
  period_end: string
  target_close_date?: string | null
  invoice_count: number
  expected_amount: string
  collected_amount: string | null
  collected_at: string | null
  difference_amount: string | null
  difference_reason: string
  balance_state: "equilibrada" | "sobrecobro" | "subcobro" | null
  expected_by_ooss: ClosedOssBreakdown[]
  protocols: ClosedPresentationProtocol[]
  status: "cerrada" | "cobrada"
  notes: string
  is_active: boolean
  created_by_id: number | null
  created_at: string
}

export interface PresentationSummaryOssRow {
  insurance_id: number
  insurance_name: string
  protocol_count: number
  total_ub: string
  expected_amount: string | null
  collected_amount: string | null
}

export interface PresentationSummaryItem {
  id: number
  label: string
  period_start: string | null
  period_end: string | null
  expected_amount: string
  collected_amount: string | null
  difference_amount: string | null
  balance_state: "equilibrada" | "sobrecobro" | "subcobro" | null
  /** Cobrado a particulares en el período — no se factura a ninguna entidad. */
  particular_amount: string
  expected_by_ooss: PresentationSummaryOssRow[]
}

export interface ReminderPhone {
  id: number
  label: string
  phone: string
  is_active: boolean
}

/** Item de GET /billing/invoices/facturados/ — un protocolo ya facturado. */
export interface BilledInvoice {
  id: number
  protocol_id: number
  presentation_id: number | null
  insurance_name: string
  ub_value_at_billing: string
  total_ub_billed: string
  total_amount: string
  amount_paid: string
  difference_amount: string
  invoice_number: string
  is_paid: boolean
  paid_date: string | null
  notes: string
  is_active: boolean
  created_at: string
}
