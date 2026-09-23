/**
 * Centralized API Configuration for Labsalud Frontend
 * Based on Django REST Framework backend documentation
 */

/**
 * API contra la que se habla, resuelta en tiempo de EJECUCIÓN.
 *
 * La app de escritorio de la PC de contingencia sirve este mismo frontend
 * compilado desde el disco de esa máquina, y necesita cambiar la API sin
 * recompilar: producción mientras el servidor responde, la copia local de esa
 * PC cuando se cayó. Como `VITE_API_BASE_URL` queda horneada en el build, la
 * app inyecta `__LABSALUD_API_BASE__` antes de que arranque la página.
 *
 * En el navegador esa variable no existe y todo funciona igual que siempre.
 */
const apiBaseInyectada =
  typeof window !== "undefined"
    ? (window as unknown as { __LABSALUD_API_BASE__?: string }).__LABSALUD_API_BASE__
    : undefined

// Base configuration
export const API_CONFIG = {
  BASE_URL: apiBaseInyectada || import.meta.env.VITE_API_BASE_URL || "http://192.168.1.88:8001",
  API_VERSION: "v1",
  TIMEOUT: 300000,
} as const

export const UI_CONFIG = {
  TOAST_DURATION: 4000,
} as const

export const TOAST_DURATION = UI_CONFIG.TOAST_DURATION

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, "")
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  return `${baseUrl}${cleanEndpoint}`
}

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  TOKEN: buildApiUrl("/auth/token/"),
  TOKEN_REFRESH: buildApiUrl("/auth/token/refresh/"),
  /** Invalida el refresh token del lado del servidor. Va SIN Authorization: la
   *  credencial es el propio refresh que viaja en el body. */
  LOGOUT: buildApiUrl("/auth/logout/"),
  PASSWORD_RESET: buildApiUrl("/users/password-reset/"),
  // El segundo paso: la pantalla donde cae el link del mail manda acá el token
  // y la contraseña elegida.
  PASSWORD_RESET_CONFIRM: buildApiUrl("/users/password-reset/confirm/"),
  // Segundo factor (TOTP). TOKEN_2FA cierra el login en dos pasos y, como el
  // login, va SIN Authorization: todavía no hay access token.
  TOKEN_2FA: buildApiUrl("/auth/token/2fa/"),
  TOKEN_2FA_CHALLENGE: buildApiUrl("/auth/token/2fa/challenge/"),
  TWO_FACTOR_STATUS: buildApiUrl("/auth/2fa/status/"),
  TWO_FACTOR_SETUP: buildApiUrl("/auth/2fa/setup/"),
  TWO_FACTOR_CONFIRM: buildApiUrl("/auth/2fa/confirm/"),
  /** DELETE con `{ password }` para desenrolar. */
  TWO_FACTOR: buildApiUrl("/auth/2fa/"),
  TWO_FACTOR_DEVICE_REVOKE: (id: string | number) => buildApiUrl(`/auth/2fa/devices/${id}/revoke/`),
} as const

// User management endpoints
export const USER_ENDPOINTS = {
  USERS: buildApiUrl("/users/users/"),
  USER_DETAIL: (id: number) => buildApiUrl(`/users/users/${id}/`),
  USER_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/users/users/${id}/audit-timeline/`),
  ME: buildApiUrl("/users/me/"),
  // Segundo factor de OTRO usuario, para el panel de gestión. Los tres son
  // exclusivos de superusuarios: al resto el backend le contesta 403.
  USER_TWO_FACTOR: (id: number) => buildApiUrl(`/users/users/${id}/2fa/`),
  /** POST con `{ required: boolean }`. */
  USER_TWO_FACTOR_REQUIRE: (id: number) => buildApiUrl(`/users/users/${id}/2fa/require/`),
  /** POST sin cuerpo: borra enrolamiento, códigos y dispositivos de confianza. */
  USER_TWO_FACTOR_RESET: (id: number) => buildApiUrl(`/users/users/${id}/2fa/reset/`),
  /** POST con `{ exigir: boolean }`: obliga a cambiar la contraseña al entrar. */
  USER_EXIGIR_CAMBIO_DE_CONTRASENA: (id: number) =>
    buildApiUrl(`/users/users/${id}/exigir-cambio-de-contrasena/`),
} as const

// Access control endpoints
export const AC_ENDPOINTS = {
  ROLES: buildApiUrl("/ac/roles/"),
  ROLE_DETAIL: (id: number) => buildApiUrl(`/ac/roles/${id}/`),
  ROLE_ASSIGN: buildApiUrl("/ac/roles/assign-roles/"),
  PERMISSIONS: buildApiUrl("/ac/permissions/"),
  TEMP_PERMISSIONS: buildApiUrl("/ac/tp/"),
  TEMP_PERMISSION_REVOKE: (id: number) => buildApiUrl(`/ac/tp/${id}/revoke/`),
} as const

// Patient management endpoints
export const PATIENT_ENDPOINTS = {
  PATIENTS: buildApiUrl("/patients/patients/"),
  PATIENT_DETAIL: (id: number) => buildApiUrl(`/patients/patients/${id}/`),
  PATIENT_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/patients/patients/${id}/audit-timeline/`),
  /** Números de afiliado ya conocidos del paciente, para sugerirlos al cargar. */
  PATIENT_AFILIACIONES: (id: number) => buildApiUrl(`/patients/patients/${id}/afiliaciones/`),
  MERGE_PREVIEW: (sourceId: number, targetId: number) =>
    buildApiUrl(`/patients/patients/${sourceId}/merge-preview/${targetId}/`),
  MERGE: (sourceId: number, targetId: number) =>
    buildApiUrl(`/patients/patients/${sourceId}/merge/${targetId}/`),
} as const

export const MEDICAL_ENDPOINTS = {
  DOCTORS: buildApiUrl("/medicale/doctors/"),
  DOCTOR_DETAIL: (id: number) => buildApiUrl(`/medicale/doctors/${id}/`),
  DOCTOR_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/medicale/doctors/${id}/audit-timeline/`),
  INSURANCES: buildApiUrl("/medicale/insurances/"),
  INSURANCE_DETAIL: (id: number) => buildApiUrl(`/medicale/insurances/${id}/`),
  INSURANCE_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/medicale/insurances/${id}/audit-timeline/`),
  INSURANCES_IMPORT: buildApiUrl("/medicale/insurances/importar-planilla/"),
  /** Baja las obras sociales en la MISMA planilla que come el importador. */
  INSURANCES_EXPORT: buildApiUrl("/medicale/insurances/exportar-planilla/"),
} as const

export const CATALOG_ENDPOINTS = {
  ANALYSIS: buildApiUrl("/catalog/analysis/"),
  ANALYSIS_COPIAR_DETERMINACIONES: (id: number) =>
    buildApiUrl(`/catalog/analysis/${id}/copiar-determinaciones/`),
  ANALYSIS_DETAIL: (id: number) => buildApiUrl(`/catalog/analysis/${id}/`),
  ANALYSIS_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/catalog/analysis/${id}/audit-timeline/`),
  ANALYSIS_IMPORT: buildApiUrl("/catalog/analysis/import-catalog/"),
  /** Baja el catálogo (análisis + determinaciones + UB por nomenclador) en
   *  el mismo Excel que come el importador. */
  ANALYSIS_EXPORT: buildApiUrl("/catalog/analysis/export-catalog/"),
  DETERMINATIONS: buildApiUrl("/catalog/determination/"),
  /** Grupos de determinaciones cuya suma tiene que cerrar. */
  SUBMODULOS_CORROBORACION: buildApiUrl("/catalog/submodulo-corroboracion/"),
  SUBMODULO_CORROBORACION: (id: number) =>
    buildApiUrl(`/catalog/submodulo-corroboracion/${id}/`),
  /** Orden de las determinaciones DENTRO de un análisis del catálogo.
   *  No confundir con `PROTOCOL_DETALLES_REORDENAR`, que mueve los
   *  análisis dentro de un protocolo. */
  DETERMINATIONS_REORDENAR: (analysisId: number) =>
    buildApiUrl(`/catalog/analysis/${analysisId}/determinations/reordenar/`),
  DETERMINATION_DETAIL: (id: number) => buildApiUrl(`/catalog/determination/${id}/`),
  DETERMINATION_AUDIT_TIMELINE: (id: number) => buildApiUrl(`/catalog/determination/${id}/audit-timeline/`),
  // NBU (Nomenclador Bioquímico Único)
  NBU: buildApiUrl("/catalog/nbu/"),
  NBU_DETAIL: (id: number) => buildApiUrl(`/catalog/nbu/${id}/`),
  NBU_UB_VALUES: (id: number) => buildApiUrl(`/catalog/nbu/${id}/ub-values/`),
  NBU_UPDATE_UB_VALUE: (id: number) => buildApiUrl(`/catalog/nbu/${id}/update-ub-value/`),
  NBU_DELETE_UB_VALUE: (nbuId: number, analysisCode: number | string) =>
    buildApiUrl(`/catalog/nbu/${nbuId}/ub-value/${analysisCode}/`),
  NBU_IMPORT_UB_VALUES: (id: number) => buildApiUrl(`/catalog/nbu/${id}/import-ub-values/`),
  NBU_CREATE_WITH_IMPORT: buildApiUrl("/catalog/nbu/create-with-import/"),
  PRICING_CONFIG: buildApiUrl("/catalog/pricing-config/"),
  // Composición de análisis (módulos): qué prácticas incluye/excluye un análisis.
} as const

// Protocol management endpoints
export const PROTOCOL_ENDPOINTS = {
  PROTOCOLS: buildApiUrl("/protocols/protocols/"),
  QUOTE: buildApiUrl("/protocols/protocols/quote/"),
  PROTOCOL_DETAIL: (id: number) => buildApiUrl(`/protocols/protocols/${id}/`),
  ARCA_BILLING: (id: number) => buildApiUrl(`/protocols/protocols/${id}/arca-billing/`),
  // Bloque ARCA completo (pdf, receptor, CAE, vencimiento). El detalle/listado
  // ya no lo embeben: solo traen is_arca_billed / arca_cae / arca_cbte_number.
  ARCA_DETAIL: (id: number) => buildApiUrl(`/protocols/protocols/${id}/arca-detail/`),
  REPORT: (id: number) => buildApiUrl(`/protocols/protocols/${id}/report/`),
  PROTOCOL_DETAILS: (id: number) => buildApiUrl(`/protocols/protocols/${id}/details/`),
  /** Corrige material descartable y derivación de un protocolo ya creado. */
  SET_EXTRAS: (id: number) => buildApiUrl(`/protocols/protocols/${id}/set-extras/`),
  /** Los pagos del paciente, uno por forma. Listar y agregar. */
  PROTOCOL_PAGOS: (id: number) => buildApiUrl(`/protocols/protocols/${id}/pagos/`),
  /** Protocolos ya creados a los que les cambiaría el precio si se los repreciara. */
  PROTOCOLOS_DESACTUALIZADOS: buildApiUrl("/protocols/protocols/desactualizados/"),
  /** Aplica los precios de hoy a los protocolos elegidos. */
  REPRECAR_PROTOCOLOS: buildApiUrl("/protocols/protocols/reprecar/"),
  ACTUALIZAR_PRECIO_PARTICULAR: (id: number) => buildApiUrl(`/protocols/protocols/${id}/actualizar-precio-particular/`),
  /** Corregir o anular UNO: la forma vive en el pago, no en el protocolo. */
  PROTOCOL_PAGO: (protocolId: number, pagoId: number) =>
    buildApiUrl(`/protocols/protocols/${protocolId}/pagos/${pagoId}/`),
  PROTOCOL_DETAIL_UPDATE: (protocolId: number, detailId: number) =>
    buildApiUrl(`/protocols/protocols/${protocolId}/details/${detailId}/`),
  SEND_METHODS: buildApiUrl("/protocols/send-methods/"),
  /**
   * Con qué médico y qué obra social vino este paciente la última vez.
   * Devuelve `{doctor, insurance}` (ids o null). Sirve para ORDENAR el combo,
   * no para elegir por nadie.
   */
  LO_DE_LA_ULTIMA_VEZ: (patientId: number) =>
    buildApiUrl(`/protocols/protocols/lo-de-la-ultima-vez/?patient=${patientId}`),
  REPORT_BATCH: buildApiUrl("/protocols/protocols/report-batch/"),
  REGULARIZE_BALANCE: (id: number) => buildApiUrl(`/protocols/protocols/${id}/regularize-balance/`),
  UNCANCEL: (id: number) => buildApiUrl(`/protocols/protocols/${id}/uncancel/`),
  ROLLBACK: (id: number) => buildApiUrl(`/protocols/protocols/${id}/rollback/`),
  DETAILS_ADD: (id: number) => buildApiUrl(`/protocols/protocols/${id}/details/add/`),
  DETAIL_REMOVE: (id: number, detailId: number) =>
    buildApiUrl(`/protocols/protocols/${id}/details/${detailId}/remove/`),
  DETAILS_REORDER: (id: number) =>
    buildApiUrl(`/protocols/protocols/${id}/details/reordenar/`),
  SET_COSEGURO: (id: number) => buildApiUrl(`/protocols/protocols/${id}/set-coseguro/`),
  UNPLANNED_LIST: (protocolId: number) => buildApiUrl(`/protocols/protocols/${protocolId}/unplanned/`),
  UNPLANNED_ITEM: (protocolId: number, txId: number) =>
    buildApiUrl(`/protocols/protocols/${protocolId}/unplanned/${txId}/`),
  MERGE_REPORT: buildApiUrl("/protocols/protocols/merge-report/"),
  AUDIT_TIMELINE: (id: number) => buildApiUrl(`/protocols/protocols/${id}/audit-timeline/`),
} as const

// Audit system endpoints
export const AUDIT_ENDPOINTS = {
  AUDIT: buildApiUrl("/audit/complete/"),
} as const

// Superconfiguración (solo superusuarios)
export const SUPERADMIN_ENDPOINTS = {
  DASHBOARD: (hours: number) => buildApiUrl(`/superadmin/dashboard/?hours=${hours}`),
  REQUESTS: (params: Record<string, string>) =>
    buildApiUrl(`/superadmin/requests/?${new URLSearchParams(params).toString()}`),
  BLOCKS: (all: boolean) => buildApiUrl(`/superadmin/blocks/${all ? "?all=true" : ""}`),
  RELEASE_BLOCK: (id: number) => buildApiUrl(`/superadmin/blocks/${id}/release/`),
} as const

// Contingencia: lo que quedó anotado en la PC mientras el servidor estuvo
// caído. Estos endpoints los atiende el backend LOCAL de la PC, no el servidor
// central — en el servidor existen igual y contestan un diario vacío, que es la
// respuesta correcta ahí.
export const CONTINGENCY_ENDPOINTS = {
  DIARIO: (estado?: string) =>
    buildApiUrl(`/sync/contingencia/${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`),
  OPERACION: (id: number, accion: "reintentar" | "descartar" | "confirmar") =>
    buildApiUrl(`/sync/contingencia/${id}/${accion}/`),
  // Lo que quedó de una caída y necesita una decisión, EN EL SERVIDOR.
  //
  // El diario de arriba vive en la base de la PC, y la app de escritorio solo
  // da acceso mientras el servidor está caído: esa pantalla quedaba accesible
  // justo cuando todavía no se puede resolver nada. Esto se ve desde la página.
  PENDIENTES: (estado?: string) =>
    buildApiUrl(`/sync/pendientes/lista/${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`),
  RESOLVER: (id: number, accion: "confirmar" | "descartar") =>
    buildApiUrl(`/sync/pendientes/${id}/${accion}/`),
} as const

// Búsqueda global (pacientes + protocolos + resultados + validaciones)
export const SEARCH_ENDPOINTS = {
  GLOBAL: ({
    q,
    type,
    page,
    pageSize,
    porTipo,
  }: {
    q: string
    /** `all` | `patient` | `protocol` | `result` | `validation`. */
    type?: string
    page?: number
    pageSize?: number
    /** Una columna por tipo (`groups`) en vez de la lista mezclada. */
    porTipo?: boolean
  }) => {
    const params = new URLSearchParams({ q })
    if (type) params.set("type", type)
    if (page) params.set("page", String(page))
    if (pageSize) params.set("page_size", String(pageSize))
    if (porTipo) params.set("group", "type")
    return buildApiUrl(`/search/?${params.toString()}`)
  },
} as const

// Analytics endpoints
export const ANALYTICS_ENDPOINTS = {
  DASHBOARD: buildApiUrl("/analytics/dashboard/"),
  PROTOCOLS_BY_STATUS: buildApiUrl("/analytics/dashboard/protocols-by-status/"),
  // El cierre de caja de un día cualquiera, no solo el de hoy: es lo que abre
  // al hacer clic en una barra del gráfico del inicio.
  CAJA: (fecha: string) => buildApiUrl(`/analytics/dashboard/caja/?fecha=${fecha}`),
  // Las estadísticas de un mes cualquiera, para mirar hacia atrás desde el
  // inicio. `mes` va como YYYY-MM; sin él contesta el mes actual.
  MES: (anio: number, mes: number) =>
    buildApiUrl(`/analytics/dashboard/mes/?mes=${anio}-${String(mes).padStart(2, "0")}`),
  // El número chico de cada tarjeta del inicio: las mismas métricas sobre otro
  // tramo. `alcance` es `mes-anterior` (el default), `3`, `6`, `12` o `siempre`.
  HISTORICO: (alcance: string) =>
    buildApiUrl(`/analytics/dashboard/historico/?alcance=${alcance}`),
  // Cuánta plata hay dando vueltas, en las dos direcciones.
  PENDIENTE: buildApiUrl("/analytics/dashboard/pendiente/"),
  LIBRO_DIARIO: buildApiUrl("/analytics/dashboard/libro-diario/"),
} as const

// Results endpoints
export const RESULTS_ENDPOINTS = {
  BY_PROTOCOL: (id: number) => buildApiUrl(`/results/results/by-protocol/${id}/`),
  RESULT_DETAIL: (id: number) => buildApiUrl(`/results/results/${id}/`),
  VALIDATE: (id: number) => buildApiUrl(`/results/results/${id}/validate/`),
  /** "No corresponde": la determinación no aplica en ESTE protocolo. Reversible. */
  EXCLUSION: (id: number) => buildApiUrl(`/results/results/${id}/exclusion/`),
  /** Validar varios de una: "Validar todos" mandaba una request por resultado. */
  VALIDATE_BATCH: buildApiUrl("/results/results/validate-batch/"),
  PREVIOUS_RESULTS: (patientId: number, determinationId: number) =>
    buildApiUrl(`/results/results/history/?patient_id=${patientId}&determination_id=${determinationId}`),
  // Cola de resultados: protocolos por estado (incluye los que aún no tienen
  // ningún valor) con progreso cargados/validados. Ver spec en doc/.
  QUEUE: buildApiUrl("/results/results/queue/"),
  /** Los atajos `Alt + tecla` que escriben un cualitativo entero. */
  MACROS: buildApiUrl("/results/macros/"),
  MACRO_DETAIL: (id: number) => buildApiUrl(`/results/macros/${id}/`),
} as const

// Reporting endpoints
export const REPORTING_ENDPOINTS = {
  SIGNATURES: buildApiUrl("/reports/signatures/"),
  SIGNATURE_DETAIL: (id: number) => buildApiUrl(`/reports/signatures/${id}/`),
  SIGNATURE_SET_DEFAULT: (id: number) => buildApiUrl(`/reports/signatures/${id}/set-default/`),
  /** Qué se le mandó al paciente por WhatsApp de este protocolo, y qué pasó con
   *  cada mensaje. */
  WHATSAPP_DEL_PROTOCOLO: (protocolId: number) =>
    buildApiUrl(`/reports/whatsapp/protocol/${protocolId}/`),
} as const

// Billing endpoints
export const BILLING_ENDPOINTS = {
  CREATE_FOR_PROTOCOL: (protocolId: number) =>
    buildApiUrl(`/billing/invoices/create-for-protocol/${protocolId}/`),
  UNBILL_PROTOCOL: (protocolId: number) =>
    buildApiUrl(`/billing/invoices/unbill/${protocolId}/`),
  PROTOCOLS_TO_BILL: buildApiUrl("/billing/invoices/protocols-to-bill/"),
  BILLING_BOARD: buildApiUrl("/billing/invoices/billing-board/"),
  SET_ELIGIBLE: (protocolId: number) =>
    buildApiUrl(`/billing/invoices/set-eligible/${protocolId}/`),
  FACTURADOS: buildApiUrl("/billing/invoices/facturados/"),
  CURRENT_TOTAL: buildApiUrl("/billing/invoices/current-total/"),
  CLOSED_PRESENTATIONS: buildApiUrl("/billing/presentations/closed/"),
  CLOSE_PRESENTATION: buildApiUrl("/billing/presentations/close-period/"),
  PRESENTATION_DETAIL: (id: number) => buildApiUrl(`/billing/presentations/${id}/`),
  PRESENTATION_PROTOCOLS: (id: number) => buildApiUrl(`/billing/presentations/${id}/protocols/`),
  SET_UB_VALUE_FOR_INSURANCE: (id: number) =>
    buildApiUrl(`/billing/presentations/${id}/set-ub-value-for-insurance/`),
  SET_COLLECTED_FOR_INSURANCE: (id: number) =>
    buildApiUrl(`/billing/presentations/${id}/set-collected-for-insurance/`),
  SET_COLLECTED_TOTAL: (id: number) => buildApiUrl(`/billing/presentations/${id}/set-collected-total/`),
  ANALYTICS_DAILY: buildApiUrl("/billing/analytics/daily/"),
  ANALYTICS_PRESENTATIONS_SUMMARY: buildApiUrl("/billing/analytics/presentations-summary/"),
  ENTITIES: buildApiUrl("/billing/entities/"),
  CUENTAS_DE_COBRO: buildApiUrl("/billing/cuentas-de-cobro/"),
  CUENTA_DE_COBRO: (id: number) => buildApiUrl(`/billing/cuentas-de-cobro/${id}/`),
  /** Gastos e ingresos del laboratorio que no pasan por ningún protocolo. */
  MOVIMIENTOS_DE_CAJA: buildApiUrl("/billing/movimientos-de-caja/"),
  MOVIMIENTO_DE_CAJA: (id: number) => buildApiUrl(`/billing/movimientos-de-caja/${id}/`),
  ENTITY_DETAIL: (id: number) => buildApiUrl(`/billing/entities/${id}/`),
  REMINDER_PHONES: buildApiUrl("/billing/reminders/phones/"),
  REMINDER_PHONE_DETAIL: (id: number) => buildApiUrl(`/billing/reminders/phones/${id}/`),
  // Nota: `/billing/reminders/config/` (días global) quedó deprecado — el cron
  // usa reminder_enabled/reminder_days_before por entidad (BillingEntity).
} as const

// Core endpoints
export const CORE_ENDPOINTS = {
  API_ROOT: `${API_CONFIG.BASE_URL}/`,
  HEALTH: `${API_CONFIG.BASE_URL}/health/`,
} as const

// HTTP Methods
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
} as const

// Common headers
export const getAuthHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token && { Authorization: `Bearer ${token}` }),
})

export const getMultipartHeaders = (token?: string) => ({
  ...(token && { Authorization: `Bearer ${token}` }),
})

// API Response types
export interface ApiResponse<T = unknown> {
  data: T
  status: number
  message?: string
}

export interface PaginatedResponse<T = unknown> {
  next: string | null
  results: T[]
}

// Error types
export interface ApiError {
  message: string
  status: number
  details?: Record<string, string[]>
}

// Common query parameters
export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface SearchParams extends PaginationParams {
  search?: string
}

// Patient specific filters
export interface PatientFilters extends SearchParams {
  dni?: string
  sex?: "M" | "F"
  city?: string
  province?: string
  country?: string
}

// Protocol specific filters
export interface ProtocolFilters extends SearchParams {
  status?: string
  is_paid?: boolean
  patient?: number
  doctor?: number
  insurance?: number
}

// Export all endpoints in a single object for easy access
export const API_ENDPOINTS = {
  AUTH: AUTH_ENDPOINTS,
  USERS: USER_ENDPOINTS,
  AC: AC_ENDPOINTS,
  PATIENTS: PATIENT_ENDPOINTS,
  MEDICAL: MEDICAL_ENDPOINTS,
  CATALOG: CATALOG_ENDPOINTS,
  PROTOCOL: PROTOCOL_ENDPOINTS,
  AUDIT: AUDIT_ENDPOINTS,
  SUPERADMIN: SUPERADMIN_ENDPOINTS,
  CONTINGENCY: CONTINGENCY_ENDPOINTS,
  SEARCH: SEARCH_ENDPOINTS,
  ANALYTICS: ANALYTICS_ENDPOINTS,
  RESULTS: RESULTS_ENDPOINTS,
  REPORTING: REPORTING_ENDPOINTS,
  BILLING: BILLING_ENDPOINTS,
  CORE: CORE_ENDPOINTS,
} as const

export default API_ENDPOINTS
