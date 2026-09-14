// ============================================================================
// TIPOS CENTRALIZADOS - SISTEMA DE LABORATORIO
// ============================================================================

// Tipos base del sistema
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
  created_by: UserReference
  updated_by: UserReference[]
}

// Referencia de usuario para auditoría
export interface UserReference {
  id: number
  username: string
  photo: string
}

// ============================================================================
// AUDITORÍA COMÚN
// ============================================================================

export interface AuditUser {
  id: number | null
  username: string
  /** Nombre y apellido de la persona. El historial lo lee gente del
   *  laboratorio: mostrar "jesica" es mostrar la credencial, no a quién fue. */
  display_name?: string
  photo: string | null
}

export interface CreationAudit {
  version: number
  action: string
  user: AuditUser | null
  date: string
  changes?: string[]
  message?: string
}

export interface LastChangeAudit {
  version: number
  action: string
  user: AuditUser | null
  date: string
  changes: string[]
  message?: string
}

export type AuditCategory =
  | "protocol"
  | "result"
  | "validation"
  | "payment"
  | "billing"
  | "state"
  | "report"
  | "doctor"
  | "insurance"
  | "analysis"
  | "user"
  | "security"
  | "patient"
  | "system"

export type AuditActionType = "create" | "update" | "delete" | "business" | "auth" | "system"

export interface HistoryEntry {
  event_id?: string
  version: number
  action: string // "creacion", "actualizacion", "eliminacion", "negocio", "autenticacion", "sistema"
  action_name?: string
  category?: AuditCategory | string
  state_from?: string | null
  state_to?: string | null
  related_protocol_id?: number | null
  user: AuditUser | null
  model?: {
    app: string
    model: string
    display: string
  } | null
  object_id?: string
  object_repr?: string
  changed_fields?: Record<string, { old: unknown; new: unknown }>
  changes: string[]
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  message?: string
  request?: {
    id: string
    path: string
    method: string
    ip: string
  }
  metadata?: Record<string, unknown>
  created_at?: string
  date: string // UTC string
}

export interface ProtocolAuditTimelineResponse {
  protocol_id: number
  count: number
  events: HistoryEntry[]
}

// Evento amigable del audit-timeline (HumanAuditEventSerializer): texto legible
// para usuarios del laboratorio, sin nombres técnicos de modelos.
export interface ProtocolAuditEvent {
  id?: number
  date: string
  user: AuditUser | null
  action_type?: string
  action?: string
  category?: string
  category_label?: string
  state_from?: string | null
  state_to?: string | null
  message?: string
}

export interface ProtocolAuditTimelineFilters {
  category?: AuditCategory | string
  actor?: number
  action_name?: string
  from?: string
  to?: string
  limit?: number
}

// ============================================================================
// USUARIOS Y AUTENTICACIÓN
// ============================================================================

export interface Permission {
  id: number
  codename: string
  name: string
  temporary?: boolean
  expires_at?: string | null
}

export interface ActiveTempPermission {
  permission: string
  name: string
  expires_at: string
  reason: string
}

export interface AuditEntry {
  id?: number
  event_id?: string
  version: number
  action: string
  action_name?: string
  category?: AuditCategory | string
  state_from?: string | null
  state_to?: string | null
  related_protocol_id?: number | null
  user: AuditUser | null
  date: string
  created_at?: string
  model: {
    app: string
    model: string
    display: string
  } | null
  object_id?: string
  object?: string
  object_repr?: string
  message?: string
  request?: {
    id: string
    path: string
    method: string
    ip: string
  }
  metadata?: Record<string, unknown>
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  changed_fields?: Record<string, { old: unknown; new: unknown }>
  changes: string[]
}

export interface Role {
  id: number
  name: string
  permission_details?: Permission[]
  permissions?: number[]
  creation?: HistoryEntry
  last_change?: HistoryEntry
}

export interface Group {
  id: number
  name: string
}

export interface User {
  id: number
  username: string
  email?: string
  first_name: string
  last_name: string
  photo?: string
  inactivity_logout_minutes?: number
  /**
   * Franjas del día con su propio tiempo de inactividad. Las horas que no cubre
   * ninguna caen en `inactivity_logout_minutes`: los tramos agregan
   * excepciones, no reemplazan la configuración.
   */
  tramos_de_inactividad?: Array<{ desde: string; hasta: string; minutos: number }> | null
  /**
   * La contraseña la puso otra persona (alta, reset por mail, o el botón de
   * gestión de usuarios). Hasta que la cambie, el servidor contesta 403 a todo
   * salvo su propio perfil.
   */
  must_change_password?: boolean
  roles?: Role[] | undefined
  groups?: Group[]
  permissions: Permission[]
  temporary_permissions?: number
  is_active?: boolean
  is_staff?: boolean
  is_superuser?: boolean
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

export interface TempPermission {
  id: number
  user_details: {
    id: number
    username: string
    email: string
    photo: string
  }
  permission_details: {
    id: number
    codename: string
    name: string
  }
  expires_at: string
  reason: string
  granted_by_details: {
    id: number
    username: string
    photo: string
  }
  granted_at: string
  is_expired: boolean
  time_remaining: string
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

// ============================================================================
// PACIENTES
// ============================================================================

export interface Patient {
  id: number
  first_name: string
  last_name: string
  dni: string
  full_name: string
  birth_date: string
  age: number
  sex: "M" | "F"
  phone_mobile: string
  alt_phone: string
  email: string
  country: string
  province: string
  city: string
  address: string
  is_active: boolean
  is_anonymous?: boolean
  /**
   * Texto libre. Útil para pacientes anónimos (ej: "Cama 5, hospital X")
   * o para anotar cualquier observación.
   */
  observations?: string
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

export interface PatientMergePreview {
  source_patient_id: number
  target_patient_id: number
  conflicts: Array<{ field: string; source_value: unknown; target_value: unknown }>
  auto_filled: Array<{ field: string; value: unknown }>
  protocols_to_move: number[]
}

export interface PatientMergeResult {
  detail: string
  unification_id: number
  moved_protocols: number[]
  patient: Patient
}

export interface PatientFormData {
  first_name: string
  last_name: string
  dni: string
  birth_date: string
  sex: string
  phone_mobile: string
  alt_phone: string
  email: string
  country: string
  province: string
  city: string
  address: string
}

// ============================================================================
// ENTIDADES MÉDICAS
// ============================================================================

export interface Doctor {
  id: number
  first_name: string
  last_name: string
  license: string
  is_active: boolean
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

// Alias for backward compatibility
export type Medico = Doctor

export interface Nbu {
  id: number
  name: string
  year?: number | null
}

export interface Insurance {
  id: number
  name: string
  description: string
  ub_value: string
  private_ub_value: number
  is_active: boolean
  charges_coseguro?: boolean
  charges_material_descartable?: boolean
  charges_derivacion?: boolean
  requires_preauthorization?: boolean
  /** La OOSS factura por Centro o Clínica según la preautorización: se elige en el ingreso. */
  chooses_billing_entity?: boolean
  /** El paciente paga como particular y la OOSS le reintegra después. */
  a_reintegro?: boolean
  /**
   * Tope de UB POR ANÁLISIS: del que lo supera se cobra el porcentaje de abajo.
   * "0.00" = sin descuento. Se mide análisis por análisis, no sobre el protocolo.
   */
  descuento_desde_ub?: string
  /** Qué porcentaje del análisis se cobra pasado el tope. "100.00" = no se descuenta. */
  descuento_porcentaje_a_cobrar?: string
  nbu?: Nbu | number | null
  /** Entidad de facturación a la que se presenta esta OOSS actualmente (null = sin asignar). */
  billing_entity?: { id: number; name: string } | null
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

// Alias for backward compatibility
export type ObraSocial = Insurance

// ============================================================================
// CATÁLOGO DE ANÁLISIS
// ============================================================================

/** Categoría NBU del análisis. "" = sin clasificar. */
export type AnalysisCategory = "pmo" | "pe" | "gestion" | ""

/** Ficha NBU del análisis (reglas de alcance/facturación y notas del laboratorio). */
export interface NbuInfo {
  work_minimum?: string
  interpretation?: string
  patient_instructions?: string
  report_note?: string
}

export interface Analysis {
  created_at: string
  created_by: null
  id: number
  /** Alfanumérico: los 6 dígitos del NBU, o el que le puso el laboratorio. */
  code: string
  name: string
  bio_unit: string
  bio_unit_values?: BioUnitValue[]
  is_urgent: boolean
  is_active: boolean
  requires_derivacion?: boolean
  /**
   * Si está activo, al paciente se le cobra `precio_particular` en vez de
   * calcularlo por UB. Requiere `PricingConfig.precios_fijos_habilitados`.
   */
  cobra_precio_fijo?: boolean
  /** El precio fijo cargado. Solo rige si `cobra_precio_fijo` está activo. */
  precio_particular?: string
  // --- Enriquecimiento NBU (todo opcional / retrocompatible) ---
  category?: AnalysisCategory
  is_ref_normalized?: boolean
  is_obsolete?: boolean
  nbu_info?: NbuInfo | null
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

// Legacy alias - panels are now just analysis
export type AnalysisPanel = Analysis

export interface BioUnitValue {
  // Nuevo formato (post NBU refactor): incluye id+name del nomenclador
  nbu_id?: number
  nbu_name?: string
  // Legacy / compat: year + value
  year: number
  value: string
}

export interface NBU {
  id: number
  name: string
  year?: number | null
  parent_nbu?: number | null
  parent_nbu_name?: string | null
  is_default: boolean
  is_active: boolean
  children_count?: number
  insurances_count?: number
  own_ub_count?: number
  total_changes?: number
}

export interface NBUEffectiveUB {
  analysis_code: string
  analysis_name: string
  effective_value: string
  found_in: {
    nbu_id: number
    nbu_name: string
    is_inherited: boolean
    inheritance_chain?: string[]
  }
}

export interface NBUUbValue {
  analysis_id: number
  analysis_code: string
  analysis_name: string
  value: string
}

export interface NBUUbValuesList {
  nbu_id: number
  nbu_name: string
  count: number
  values: NBUUbValue[]
}

export interface NBUImportResult {
  detail: string
  nbu_id: number
  nbu_name: string
  total_filas: number
  creados: number
  actualizados: number
  errores: Array<{ fila: number; codigo: number; motivo: string }>
}

export type ReferenceValueGroup = "hombre_mayor" | "mujer_mayor" | "nino" | "nina"

export interface ReferenceValueBounds {
  min?: string
  max?: string
}

export type ReferenceValues = Partial<Record<ReferenceValueGroup | string, ReferenceValueBounds>>

export interface ReferenceRange {
  id?: number
  group: ReferenceValueGroup | string
  sex: "male" | "female" | string
  age_group: "adult" | "child" | string
  min_value: string
  max_value: string
  /**
   * Si el número del borde cuenta como normal. Por defecto sí, que es como el
   * sistema evaluó siempre: `≥ 40` acepta el 40, `> 40` lo rechaza.
   */
  min_inclusive?: boolean
  max_inclusive?: boolean
}

/**
 * Un rango de referencia con nombre, cargado a mano por el laboratorio.
 *
 * No tiene sexo ni grupo etario y NO entra en la detección automática: se
 * imprime en el informe, debajo del rango del paciente, para que el médico lea
 * el resultado en contexto (las franjas del colesterol, por ejemplo).
 */
export interface NamedReferenceRange {
  id?: number
  label: string
  min_value: string
  max_value: string
  /**
   * Si el número del borde cuenta como normal. Por defecto sí, que es como el
   * sistema evaluó siempre: `≥ 40` acepta el 40, `> 40` lo rechaza.
   */
  min_inclusive?: boolean
  max_inclusive?: boolean
  orden?: number
}

export type ReferenceRangeEvaluationStatus =
  | "not_evaluated"
  | "no_applicable_reference"
  | "no_reference"
  | "in_range"
  | "out_of_range"
  | "uncheckable"

export interface ReferenceRangeEvaluation {
  status: ReferenceRangeEvaluationStatus
  is_out_of_reference_range: boolean
  value: string
  patient?: {
    sex_code: "M" | "F" | string
    age: number
    sex: "male" | "female" | string
    age_group: "adult" | "child" | string
  }
  reference?: ReferenceRange | null
}

/**
 * Un grupo de determinaciones cuya suma tiene que dar un número conocido.
 *
 * La fórmula leucocitaria suma 100: si suma 95 alguien contó mal, y eso no lo
 * ve ningún rango de referencia porque cada valor por separado puede ser
 * normal.
 */
export interface SubmoduloDeCorroboracion {
  id: number
  analysis: number
  nombre: string
  determinaciones: number[]
  determinaciones_detalle?: {
    id: number
    name: string
    measure_unit: string
    scientific_exponent?: number | null
  }[]
  total_esperado: string
  tolerancia: string
  is_active?: boolean
}

/** Cómo va la suma de un submódulo en un protocolo concreto. */
export interface SubmoduloEvaluado {
  id: number
  protocol_detail: number
  /** La pantalla agrupa por análisis, no por detalle del protocolo. */
  analysis: number
  nombre: string
  total_esperado: string
  tolerancia: string
  suma: string
  diferencia: string
  /** Con campos vacíos la suma no puede dar: hasta entonces no se opina. */
  completo: boolean
  cierra: boolean
  faltantes: string[]
  determinaciones: number[]
}

export interface Determination {
  id: number
  code: string
  analysis: number
  name: string
  measure_unit: string
  /** Exponente de 10 de la unidad: `/µL` + 6 se imprime `4.500.000 /µL`. */
  scientific_exponent?: number | null
  formula: string
  reference_values?: ReferenceValues
  reference_ranges?: ReferenceRange[]
  named_ranges?: NamedReferenceRange[]
  /** Posición dentro del análisis. Se ordena arrastrando en el catálogo. */
  orden?: number
  is_active: boolean
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

// ============================================================================
// PROTOCOLOS
// ============================================================================

export interface SendMethod {
  id: number
  name: string
  description: string
  is_active: boolean
}

export interface PaymentStatus {
  id: number
  name: string
}

export interface BillingStatus {
  id: number
  name: string
}

export interface ProtocolStatus {
  id: number
  name: string
}

export type TrajoOrdenStatus = "no_trajo" | "incompleta" | "completa"
export type PreauthStatus = "not_required" | "no_trajo" | "incompleta" | "completa"

export interface ProtocolDetail {
  id: number
  analysis: number
  is_authorized: boolean
  is_sent?: boolean
  is_valid?: boolean
  /** true si el análisis ya tiene resultados cargados (aunque no estén validados).
   * Lo provee el backend en el detalle (ProtocolDetailSerializer). */
  is_loaded?: boolean
  code: string
  name: string
  /** La UB que le corresponde: la de la OOSS si va cubierto, la de Particular si no. */
  ub: string
  /** La UB del nomenclador de Particular. */
  ub_particular?: string | null
  /** La UB del nomenclador de la OOSS. `null` = esa OOSS no nombra la práctica. */
  ub_obra_social?: string | null
  /**
   * El precio al que se cobró este análisis, o `null` si fue por UB. Sale del
   * snapshot: es lo que cobró ESTE protocolo, que puede no ser el precio de hoy.
   */
  precio_fijo?: string | null
  is_urgent: boolean
  is_active: boolean
}

export interface ProtocolDetailInput {
  analysis: number
  is_authorized: boolean
}

export interface Protocol {
  id: number
  patient: {
    id: number
    dni: string
    first_name: string
    last_name: string
    email?: string
    phone_mobile?: string
    alt_phone?: string
    is_anonymous?: boolean
  }
  doctor: {
    id: number
    first_name: string
    last_name: string
    license: string
  }
  insurance: {
    id: number
    name: string
    charges_coseguro?: boolean
    charges_material_descartable?: boolean
    charges_derivacion?: boolean
    requires_preauthorization?: boolean
  }
  affiliate_number: string
  status: ProtocolStatus
  send_method: {
    id: number
    name: string
  }
  insurance_ub_value?: string
  private_ub_value?: string
  // Payment fields (new API format)
  amount_due?: string
  amount_pending?: string
  patient_paid?: string
  amount_to_return?: string
  /** Lo que el paciente pagó de más y se tomó como redondeo: no es deuda
   *  del laboratorio. Pasado el tope configurado, va a `amount_to_return`. */
  redondeo?: string
  extra_amounts_overridden?: boolean
  // Pricing breakdown (new fields - May 2026)
  analyses_amount_due?: string
  /** Lo que se le descontó al particular por volumen. Ya está restado de
   *  `analyses_amount_due`; va aparte para que el total cierre con las partes. */
  descuento_por_volumen?: string
  coseguro_amount?: string
  material_descartable_amount?: string
  derivacion_amount?: string
  /** Cada cobro y cada devolución, con su forma y su cuenta. */
  pagos?: PagoDelProtocolo[]
  extras_total?: string
  private_amount_due?: string
  /** Cuántos componentes no se cobraron por estar incluidos en un módulo presente. */
  nbu?: Nbu | null
  // Returned by protocol create response
  value_paid?: string
  payment_status: PaymentStatus
  billing_status?: BillingStatus
  is_arca_billed?: boolean
  arca_billing_status?: "pendiente" | "emitida" | "error" | "anulada" | string
  arca_billed_at?: string | null
  arca_reference?: string
  arca_bill_to?: "patient" | "third_party"
  arca_receiver_doc_type?: string
  arca_receiver_doc_number?: string
  arca_receiver_name?: string
  arca_receiver_address?: string
  arca_cbte_tipo?: number | null
  arca_cbte_number?: number | null
  arca_cae?: string
  arca_cae_due_date?: string
  arca_invoice_pdf_url?: string | null
  is_printed: boolean
  trajo_orden: TrajoOrdenStatus
  preauth_status?: PreauthStatus
  preauth_reference?: string
  preauth_notes?: string
  is_in_patient?: boolean
  is_active: boolean
  created_at?: string
  completed_at?: string | null
  previous_status?: ProtocolStatus | null
  missing_info?: string[]
  details: ProtocolDetail[]
  unplanned_transactions?: UnplannedTransaction[]
  unplanned_charges_total?: string
  unplanned_payments_total?: string
  creation?: CreationAudit
  last_change?: LastChangeAudit
  history?: HistoryEntry[]
  total_changes?: number
}

export interface UnplannedTransaction {
  id: number
  protocol: number
  kind: "charge" | "payment"
  description: string
  amount: string
  /**
   * Cómo entró la plata. Solo en los pagos: un cobro es lo que el paciente
   * pasa a deber, no plata que se movió. "" en los cargados desde antes.
   */
  payment_method?: "" | "efectivo" | "transferencia"
  payment_account?: number | null
  payment_account_detail?: { id: number; nombre: string; alias: string } | null
  created_by?: {
    id: number
    username: string
    first_name?: string
    last_name?: string
  } | null
  created_at?: string
  is_active?: boolean
}

export interface ProtocolListItem {
  id: number
  patient: {
    id: number
    dni: string
    first_name: string
    last_name: string
    age?: number
    is_anonymous?: boolean
  }
  // Para la tabla densa (?view=table). Opcionales: el backend los agrega al
  // ProtocolRowSerializer (insurance, affiliate_number, send_method).
  insurance?: { id: number; name: string } | null
  affiliate_number?: string
  send_method?: { id: number; name: string } | null
  // Progreso de carga de resultados (cola de resultados). Los provee el backend
  // en protocols-with-loaded-results (ProtocolListSerializer anotado).
  loaded_results_count?: number
  total_analyses_count?: number
  validated_results_count?: number
  status: ProtocolStatus
  balance: string
  private_amount_due?: string
  patient_paid?: string
  amount_to_return?: string
  /** Lo que el paciente pagó de más y se tomó como redondeo: no es deuda
   *  del laboratorio. Pasado el tope configurado, va a `amount_to_return`. */
  redondeo?: string
  // Pricing breakdown (new fields)
  analyses_amount_due?: string
  /** Lo que se le descontó al particular por volumen. Ya está restado de
   *  `analyses_amount_due`. */
  descuento_por_volumen?: string
  coseguro_amount?: string
  material_descartable_amount?: string
  derivacion_amount?: string
  extras_total?: string
  /** Cuántos componentes no se cobraron por estar incluidos en un módulo presente. */
  payment_status: PaymentStatus
  billing_status?: BillingStatus
  is_printed: boolean
  trajo_orden: TrajoOrdenStatus
  preauth_status?: PreauthStatus
  preauth_reference?: string
  preauth_notes?: string
  is_in_patient?: boolean
  missing_info?: string[]
  created_at?: string
  is_arca_billed?: boolean
  arca_billing_status?: "pendiente" | "emitida" | "error" | "anulada" | string
  arca_billed_at?: string | null
  arca_reference?: string
  arca_bill_to?: "patient" | "third_party"
  arca_receiver_doc_type?: string
  arca_receiver_doc_number?: string
  arca_receiver_name?: string
  arca_receiver_address?: string
  arca_cbte_tipo?: number | null
  arca_cbte_number?: number | null
  arca_cae?: string
  arca_cae_due_date?: string
  creation?: CreationAudit
  last_change?: LastChangeAudit
}

/** Cómo entró la plata. "" = no se registró; no se le inventa una forma. */
export type FormaDePago = "" | "efectivo" | "transferencia"

/**
 * Un pago (o una devolución) del paciente sobre un protocolo.
 *
 * Cada uno con su forma: el paciente puede dejar una parte en efectivo y
 * transferir el resto, y la transferencia tiene que poder cruzarse sola contra
 * el extracto de su cuenta. Corregir uno no toca al otro.
 */
export interface PagoDelProtocolo {
  id: number
  tipo: "pago" | "devolucion"
  amount: string
  payment_method?: FormaDePago
  payment_account?: number | null
  payment_account_detail?: { id: number; nombre: string; alias: string } | null
  created_at?: string
  is_active?: boolean
}

/** Lo que manda el ingreso por cada forma en la que el paciente pagó. */
export interface PagoInput {
  amount: string
  payment_method?: FormaDePago
  payment_account?: number | null
}

export interface CreateProtocolInput {
  patient: number
  doctor: number
  insurance?: number
  /** Solo cuando la OOSS factura según la preautorización del paciente. */
  billing_entity?: number
  affiliate_number?: string
  send_method: number
  /**
   * Sigue yendo por compatibilidad, pero el total sale de `pagos_input`: el
   * backend lo recalcula como la suma de los pagos.
   */
  value_paid: string
  /** Un item por forma de pago usada. Sin esto no hay cómo conciliar. */
  pagos_input?: PagoInput[]
  trajo_orden?: TrajoOrdenStatus
  preauth_status?: PreauthStatus
  preauth_reference?: string
  preauth_notes?: string
  is_in_patient?: boolean
  material_descartable_amount_override?: string
  derivacion_amount_override?: string
  details: ProtocolDetailInput[]
  unplanned_transactions_input?: UnplannedTransactionInput[]
}

export interface Signature {
  id: number
  name: string
  image_url: string | null
  biochemist_name: string
  biochemist_mp: string
  is_default: boolean
  is_active: boolean
  uploaded_by?: {
    id: number
    username: string
    first_name?: string
    last_name?: string
  } | null
  created_at?: string
}

export interface UnplannedTransactionInput {
  kind: "charge" | "payment"
  description: string
  amount: string
}

export interface PricingConfig {
  id: number
  material_descartable_amount: string
  derivacion_amount: string
  /** Piso del total que paga un paciente particular. "0.00" = sin mínimo. */
  particular_minimum_amount: string
  /**
   * Hasta cuánto de más se toma como redondeo en vez de como deuda del
   * laboratorio. "0.00" = no se redondea nunca.
   */
  redondeo_maximo: string
  /**
   * Habilita cobrar análisis sueltos a un precio fijo en vez de por UB.
   * Apagado, los precios cargados en el catálogo no cotizan nada.
   */
  precios_fijos_habilitados?: boolean
}

// Respuesta de POST /protocols/protocols/quote/ — preview de precios que reusa
// la lógica de creación (resuelve el nomenclador correcto por OOSS/particular).
export interface QuoteDetail {
  analysis_id: number
  code: string
  name: string
  is_authorized: boolean
  /** `null` si el análisis no tiene UB, que solo puede pasar con precio fijo. */
  private_ub: string | null
  insurance_ub: string | null
  patient_amount: string
  /** Cuánto se le descontó a ESTE análisis por superar el tope de UB de la obra social. */
  descuento?: string
  /** El precio al que se cobra, o `null` si sale por UB (lo habitual). */
  precio_fijo?: string | null
}

export interface QuoteResult {
  insurance: { id: number; name: string } | null
  nbu: { id: number; name: string } | null
  details: QuoteDetail[]
  total_ub_authorized: string
  total_ub_private: string
  analyses_amount_due: string
  /** Lo que se le descontó al particular por volumen. "0.00" si no aplicó. */
  descuento_por_volumen: string
  material_descartable_amount: string
  derivacion_amount: string
  coseguro_amount: string
  extras_total: string
  private_amount_due: string
  arca_billable_amount: string
}

export interface PreauthorizationPayload {
  protocol_ids: number[]
  preauth_status?: Exclude<PreauthStatus, "not_required">
  authorized_analysis_ids: number[]
  reference?: string
  notes?: string
}

export interface PreauthorizationResponse {
  detail: string
  preauthorization_id: number | null
  preauth_status?: PreauthStatus
  protocols: number[]
  authorized_analysis_ids: number[]
}

export interface MergeReportPayload {
  protocol_ids: number[]
  action: "download" | "email" | "whatsapp"
  type: "full" | "summary"
  protocol_date?: string
  protocol_time?: string
  signed?: boolean
  signature_id?: number
  email?: string
  phone_number?: string
}

export interface ReportSignature {
  id: number
  name: string
  image?: string
  image_url?: string
  biochemist_name?: string
  biochemist_mp?: string
  is_default: boolean
  is_active: boolean
  uploaded_by?: {
    id: number
    username: string
    photo?: string | null
  } | null
  created_at?: string
}

export interface ProtocolSummary {
  id: number
  patient_first_name: string
  patient_last_name: string
  patient_dni: string
  ooss: string
  created_at: string
  state: "pending_entry" | "entry_complete" | "pending_validation" | "review" | "completed" | "cancelled"
  loaded_results_count: number
  total_analyses_count: number
}

// ============================================================================
// RESULTADOS
// ============================================================================

export interface ResultDetermination {
  id: number
  code?: string
  name: string
  measure_unit: string
  /** Exponente de 10 de la unidad: se carga `4,5` y el informe dice `4.500.000`. */
  scientific_exponent?: number | null
  formula: string
  reference_values?: ReferenceValues
  reference_ranges?: ReferenceRange[]
  named_ranges?: NamedReferenceRange[]
}

export interface ResultAnalysis {
  id: number
  name: string
  code: string
  is_urgent: boolean
  ub: string
  bio_unit_values?: BioUnitValue[]
}

export interface Result {
  id: number
  determination: ResultDetermination
  value: string
  is_valid: boolean
  /**
   * La determinación tiene fórmula pero el valor se carga a mano: el cálculo
   * automático deja de pisarlo. Se enciende desde la pantalla de carga cuando
   * la fórmula está mal y traba la fila.
   */
  carga_manual?: boolean
  /** true si este resultado ya fue enviado al paciente (envío parcial: se puede
   * enviar aunque el análisis no esté completo, con al menos un resultado). */
  is_sent?: boolean
  notes: string
  is_wrong: boolean
  is_out_of_reference_range?: boolean
  reference_range_evaluation?: ReferenceRangeEvaluation | null
  is_active: boolean
  analysis: ResultAnalysis
  validated_by?: {
    id: number
    username: string
    first_name: string
    last_name: string
  } | null
  validated_at?: string | null
  date?: string | null
  /** Estado NUEVO del protocolo dueño, recalculado por el backend tras guardar/validar. */
  protocol_status?: { id: number; name: string } | null
  protocol_id?: number | null
}

// Response from GET /results/results/by-analysis/{id}/
export interface ResultsByAnalysisItem {
  id: number // protocol id
  patient: {
    id: number
    first_name: string
    last_name: string
  }
  status: {
    id: number
    name: string
  }
  results: Result[]
}

// Response from GET /results/results/available-analyses/
export interface AvailableAnalysis {
  id: number
  code: string
  name: string
  bio_unit: string
  bio_unit_values?: BioUnitValue[]
  is_urgent: boolean
  is_active: boolean
}

// PreviousResult matches the Result structure returned by GET /results/results/history/
export type PreviousResult = Result

export interface ResultValidacion {
  id: number
  tipo: "tecnica" | "bioquimica"
  estado: "pendiente" | "aprobada" | "rechazada"
  validado_por: {
    id: number
    username: string
    first_name: string
    last_name: string
  } | null
  validado_at: string | null
  result_notes: string
  created_at: string
}

export interface ResultCambio {
  id: number
  valor_anterior: string
  valor_nuevo: string
  motivo: string
  modificado_por: {
    id: number
    username: string
    first_name: string
    last_name: string
  } | null
  created_at: string
}

export interface ProtocolWithLoadedResults {
  id: number
  patient: {
    id: number
    dni: string
    first_name: string
    last_name: string
    age?: number | null
  }
  status: {
    id: number
    name: string
  }
}

// ============================================================================
// FACTURACION
// ============================================================================

export interface Invoice {
  id: number
  protocol_id: number
  presentation_id?: number | null
  insurance_name: string
  ub_value_at_billing: string
  total_ub_billed: string
  total_amount: string
  amount_paid?: string
  difference_amount?: string
  invoice_number: string | null
  is_paid: boolean
  paid_date: string | null
  notes: string
  is_active: boolean
  created_at: string
}

export interface ProtocolToBill {
  protocol_id: number
  status: string
  billing_status?: string
  patient: {
    id: number
    first_name: string
    last_name: string
  } | null
  insurance: {
    id: number
    name: string
    ub_value_at_protocol_creation?: string
  } | null
  total_ub_authorized: string
  estimated_amount?: string
  expected_amount?: string
}

export interface BillingSummary {
  adeudado_total: number | string
  dinero_facturado_ooss: number | string
  dinero_cobrado_ooss?: number | string
  dinero_facturado_particular: number | string
  facturado_por_particular?: number | string
  ooss_top_facturacion: Array<{
    insurance_id?: number
    insurance_name: string
    total?: number | string
    total_facturado?: number | string
  }>
  protocolos_por_facturar: number
}

export interface BillingPresentation {
  id: number
  reference: string
  name: string
  period_start: string
  period_end: string
  invoice_count: number
  expected_amount: string
  expected_by_ooss?: Array<{
    insurance_id: number
    insurance_name: string
    protocol_count: number
    expected_amount: string
    collected_amount?: string
    difference_amount?: string
  }>
  protocols?: Array<{
    protocol_id: number
    invoice_id: number
    invoice_number: string
    insurance?: { id: number; name: string } | null
    patient?: { id: number; first_name: string; last_name: string } | null
    expected_amount: string
    paid_amount?: string
    difference_amount?: string
  }>
  collected_amount?: string
  difference_amount?: string
  balance_state?: "equilibrada" | "sobrecobro" | "subcobro"
  status: "cerrada" | "cobrada"
  collected_at?: string | null
  notes: string
  is_active: boolean
  created_by_id: number | null
  created_at: string
}

export interface BillingPresentationSummaryResponse {
  count: number
  results: BillingPresentation[]
  chart: Array<{
    id: number
    reference: string
    period_start: string
    period_end: string
    expected_amount: string
    collected_amount: string
    difference_amount: string
    balance_state: "equilibrada" | "sobrecobro" | "subcobro"
  }>
}

export interface BillingPresentationDetailResponse {
  count: number
  presentation: BillingPresentation & {
    expected_by_ooss?: Array<{
      insurance_id: number
      insurance_name: string
      expected_amount: string
      collected_amount: string
      difference_amount: string
    }>
    protocols?: Array<{
      protocol_id: number
      patient_name?: string
      insurance_name?: string
      expected_amount?: string
      paid_amount?: string
    }>
  }
  results: Array<{
    id: number
    protocol_id: number
    presentation_id?: number | null
    insurance_name: string
    invoice_number: string | null
    total_amount: string
    amount_paid: string
    is_paid: boolean
    paid_date: string | null
    notes: string
    created_at: string
  }>
}

export interface ProtocolBillingStatus {
  protocol_id: number
  is_billed: boolean
  billed_at: string | null
  status: string
  billing_status?: string
  insurance: {
    id: number
    name: string
  }
  patient: {
    id: number
    first_name: string
    last_name: string
  }
}

export interface BillingOossControlItem {
  invoice_id: number
  protocol_id: number
  date: string
  insurance: {
    id: number
    name: string
  }
  patient: {
    id: number
    first_name: string
    last_name: string
  } | null
  total_facturado: string
  total_cobrado: string
  diferencia: string
  is_paid: boolean
  paid_date: string | null
}

export interface BillingOossControlResponse {
  count: number
  total_facturado_ooss: string
  total_cobrado_ooss: string
  diferencia_total_ooss: string
  facturado_por_particular: string
  results: BillingOossControlItem[]
}

/**
 * Un atajo de teclado que escribe un resultado que se repite todo el día.
 *
 * `Alt + tecla` pone `texto` en el campo enfocado de la pantalla de carga. Son
 * del laboratorio, no de cada usuario: lo que se busca es que el informe diga
 * siempre lo mismo.
 */
export interface MacroDeResultado {
  id: number
  /** Una letra (a-z) o un dígito, siempre en minúscula. */
  tecla: string
  texto: string
}

// ============================================================================
// BÚSQUEDA GLOBAL
// ============================================================================

export type GlobalSearchType =
  | "patient"
  | "protocol"
  | "result"
  | "validation"
  | "ledger"
  /** El análisis del catálogo en sí, no un protocolo que lo tenga. */
  | "analysis"

/** Paciente asociado a un resultado de búsqueda. Puede no existir (ej: si algún día se indexan entidades sin paciente). */
export interface GlobalSearchPatientRef {
  id: number
  name: string
  dni: string
}

export interface GlobalSearchItem {
  type: GlobalSearchType
  id: number
  title: string
  /** Puede venir vacío. */
  subtitle: string
  patient: GlobalSearchPatientRef | null
  /** Nombre del estado del protocolo en español; vacío para tipos que no tienen estado. */
  status: string
  date: string | null
  /** Ruta interna del frontend (ej: `/pacientes/12`), NO una URL absoluta. */
  url: string
  /** Por qué matcheó este item ("nombre", "DNI", "N° de protocolo", "análisis"). */
  matched_on: string
}

/** Filtro por tipo. `all` es el default: trae todos los tipos mezclados. */
export type GlobalSearchFilter = GlobalSearchType | "all"

/** Totales por tipo para las chips. Vienen completos aunque se filtre por un solo tipo. */
export type GlobalSearchCounts = Record<GlobalSearchFilter, number>

export interface GlobalSearchResponse {
  query: string
  took_ms: number
  /** Filtro con el que respondió el backend (puede diferir del pedido si mandamos cualquier cosa). */
  type: GlobalSearchFilter
  page: number
  page_size: number
  has_next: boolean
  counts: GlobalSearchCounts
  /**
   * El backend cortó el conteo en un tope (contar exacto sobre millones de filas
   * es carísimo): los números que llegaron al tope son un piso, no un total.
   */
  counts_capped: boolean
  /** Valor del tope. Indica a qué conteos hay que ponerles el "+". */
  counts_cap?: number
  /** Lista PLANA, ya paginada. Sin coincidencias llega `[]`. */
  results: GlobalSearchItem[]
  /**
   * Una columna por tipo, con los primeros `page_size` de cada uno. Solo viene
   * con `?group=type`, que es lo que pide la pantalla de búsqueda para mostrar
   * los tipos lado a lado. En ese modo `results` llega vacío a propósito:
   * mandar además la lista mezclada duplicaría el payload.
   */
  groups?: Record<GlobalSearchType, GlobalSearchItem[]>
  /** Si esa columna tiene más resultados de los que entraron. */
  groups_has_next?: Record<GlobalSearchType, boolean>
  /**
   * La búsqueda exacta no encontró nada y esto es lo que SUENA parecido. La
   * pantalla tiene que decirlo: un resultado aproximado presentado como exacto
   * engaña.
   */
  aproximado?: boolean
}

// ============================================================================
// API Y RESPUESTAS
// ============================================================================

export interface PaginatedResponse<T> {
  next: string | null
  results: T[]
}

export interface ApiResponse<T = unknown> {
  data?: T
  message?: string
  errors?: FormErrors
  detail?: string
}

export interface FormErrors {
  [key: string]: string
}

// ============================================================================
// FORMULARIOS Y VALIDACIONES
// ============================================================================

export interface ValidationResultType {
  isValid: boolean
  message: string
}

export type ValidationState<T> = {
  [K in keyof T]: ValidationResultType
}

// ============================================================================
// COMPONENTES UI
// ============================================================================

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface LoadingState {
  isLoading: boolean
  error?: string
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export interface AppConfig {
  API_BASE_URL: string
  TOAST_DURATION: number
  IDLE_TIMEOUT: number
  WARNING_TIMEOUT: number
}

// ============================================================================
// ANÁLISIS SELECCIONADO CON AUTORIZACIÓN (para UI del ingreso)
// ============================================================================

export interface SelectedAnalysis extends Analysis {
  is_authorized: boolean
}

// ============================================================================
// SUPERCONFIGURACIÓN (solo superusuarios)
// ============================================================================

/** Una sección del dashboard puede venir con error sin tumbar el resto. */
export interface SectionError {
  error?: string
}

export interface SystemInfo extends SectionError {
  hostname: string
  platform: string
  python_version: string
  django_version: string
  debug: boolean
  timezone: string
  worker_pid: number
  process_uptime_seconds: number
  cpu_count: number | null
  load_average: number[] | null
  memory: { total_bytes: number; available_bytes: number; used_percent: number } | null
  disk: { total_bytes: number; free_bytes: number; used_percent: number } | null
}

export interface DatabaseInfo extends SectionError {
  engine: string
  name: string
  host: string
  size_bytes: number | null
  ping_ms: number | null
  pending_migrations: number | null
}

export interface EndpointMetric {
  endpoint: string
  count: number
  avg_ms: number
  max_ms: number
}

export interface RequestsInfo extends SectionError {
  window_hours: number
  count: number
  avg_ms: number | null
  max_ms: number | null
  p50_ms: number | null
  p95_ms: number | null
  p99_ms: number | null
  client_errors: number
  server_errors: number
  error_rate: number
  slowest_endpoints: EndpointMetric[]
  busiest_endpoints: EndpointMetric[]
  latency_histogram: Record<string, number>
  workers_reporting: number
}

export interface SecurityInfo extends SectionError {
  active_blocks: number
  active_ip_blocks: number
  active_account_blocks: number
  blocks_last_24h: number
  released_last_24h: number
  config: {
    failed_login_limit: number | null
    failed_login_ip_limit: number | null
    lockout_seconds: number | null
    throttle_login_ip: string | null
    throttle_login_account: string | null
    num_proxies: number | null
  }
}

export interface ApplicationInfo extends SectionError {
  protocols_total: number
  protocols_today: number
  patients_total: number
  results_total: number
  users_active: number
  users_total: number
  audit_events_24h: number
  audit_events_total: number
}

export interface SuperadminDashboard {
  generated_at: string
  system: SystemInfo
  database: DatabaseInfo
  requests: RequestsInfo
  security: SecurityInfo
  application: ApplicationInfo
}

export interface SecurityBlock {
  id: number
  kind: "ip" | "account"
  kind_display: string
  identifier: string
  reason: string
  failure_count: number
  last_ip: string
  created_at: string
  expires_at: string
  released_at: string | null
  released_by_username: string | null
  is_active: boolean
  seconds_remaining: number
}

export interface RequestLogEntry {
  id: number
  timestamp: string
  method: string
  path: string
  status_code: number
  duration_ms: number
  username: string
  ip: string
  worker_pid: number
}

export interface RequestLogResponse {
  count: number
  results: RequestLogEntry[]
}

// ============================================================================
// SEGUNDO FACTOR (TOTP)
// ============================================================================

/**
 * Respuesta de `POST /auth/token/` cuando el usuario tiene 2FA activo y este
 * dispositivo no está dentro de la ventana de confianza. Llega con HTTP 200 y
 * SIN `access`/`refresh`: el login todavía no terminó.
 */
export interface TwoFactorRequiredResponse {
  two_factor_required: true
  ephemeral_token: string
  /** Segundos de vida del `ephemeral_token` (el backend usa 300). */
  expires_in: number
  two_factor_method?: TwoFactorMethod
}

export type TwoFactorMethod = "totp" | "email"

/**
 * Respuesta de `POST /auth/token/` cuando la persona está OBLIGADA a tener
 * segundo factor y todavía no se enroló. Las credenciales eran correctas, pero
 * tampoco vienen tokens: el paso que falta es el alta, no un código.
 */
export interface TwoFactorEnrollmentRequiredResponse {
  two_factor_enrollment_required: true
  ephemeral_token: string
  /** Segundos de vida del `ephemeral_token` (el backend usa 900). */
  expires_in: number
}

/** Dispositivo con la ventana de confianza abierta. */
export interface TrustedDevice {
  id: string | number
  label: string
  last_2fa_at: string
  expires_at: string
  is_current: boolean
}

export interface TwoFactorStatus {
  enabled: boolean
  confirmed_at: string | null
  recovery_codes_left: number
  trusted_devices: TrustedDevice[]
  method: TwoFactorMethod | null
  email: string | null
}

export interface TwoFactorSetupResponse {
  method: TwoFactorMethod
  secret: string
  otpauth_uri: string
  email?: string | null
}

/** Los códigos de recuperación se devuelven una única vez, al confirmar el alta. */
export interface TwoFactorConfirmResponse {
  recovery_codes: string[]
}

/**
 * `POST /auth/2fa/confirm/` cuando el alta se hace con el pase del login
 * (enrolamiento obligatorio): además de los códigos cierra el login, así que
 * trae también los tokens.
 */
export interface TwoFactorEnrollmentConfirmResponse extends TwoFactorConfirmResponse {
  access: string
  refresh: string
  user: User
}

/**
 * Estado del segundo factor de OTRO usuario, tal como lo ve un superusuario en
 * la gestión de usuarios (`GET /users/users/<id>/2fa/`).
 *
 * Ojo con `trusted_devices`: acá es un CONTADOR, no la lista de equipos que
 * devuelve el estado propio (`TwoFactorStatus`). Un administrador no necesita
 * —ni debería— ver los equipos ajenos uno por uno.
 */
export interface UserTwoFactorStatus {
  enabled: boolean
  method: TwoFactorMethod | null
  confirmed_at: string | null
  required: boolean
  recovery_codes_left: number
  trusted_devices: number
  last_2fa_at: string | null
}

// ============================================================================
// CONTINGENCIA — el trabajo que quedó en la PC cuando el servidor estuvo caído
// ============================================================================

export type EstadoOperacionContingencia =
  | "pendiente"
  | "retenida"
  | "subida"
  | "conflicto"
  | "bloqueada"
  | "descartada"

export interface OperacionContingencia {
  id: number
  metodo: string
  ruta: string
  resumen: string
  usuario: string
  ocurrida_at: string | null
  estado: EstadoOperacionContingencia
  estado_legible: string
  necesita_atencion: boolean
  intentos: number
  ultimo_error: string
  respuesta_codigo: number | null
  subida_at: string | null
}

export interface ResumenContingencia {
  total: number
  por_estado: Partial<Record<EstadoOperacionContingencia, number>>
  pendientes: number
  necesitan_atencion: number
}

export interface DiarioContingencia {
  modo_contingencia: boolean
  resumen: ResumenContingencia
  operaciones: OperacionContingencia[]
}
