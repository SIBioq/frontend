// ============================================================================
// PERMISSIONS CONSTANTS - Sistema simplificado de permisos
// ============================================================================

/**
 * Un permiso tal como lo consume el front.
 *
 * Lo ÚNICO estable entre instalaciones es `codename`: es lo que compara
 * `hasPermission` (ver auth-context) contra `user.permissions`. `id` y
 * `contentTypeId` son PKs de la base donde se cargaron los permisos, dependen
 * del orden de inserción y cambian en cada laboratorio donde se instale el
 * sistema — por eso son opcionales y no se agregan a los permisos nuevos.
 */
export interface PermissionDescriptor {
  codename: string
  name: string
  /** PK del permiso en la base ORIGINAL. No es estable entre instalaciones. */
  id?: string
  /** PK del ContentType en la base ORIGINAL. Tampoco es estable. */
  contentTypeId?: number
}

export const PERMISSIONS = {
  // ID: 1 - ContentType: laboratory_protocols
  UNCANCEL_PROTOCOLS: {
    id: "1",
    contentTypeId: 1,
    codename: "descancelar_protocolos",
    name: "Puede descancelar protocolos",
  },

  // ID: 2 - ContentType: user_management
  MANAGE_USERS: {
    id: "2",
    contentTypeId: 7,
    codename: "administrar_usuarios",
    name: "Puede administrar usuarios",
  },

  // ID: 3 - ContentType: user_management
  MANAGE_TEMP_PERMISSIONS: {
    id: "3",
    contentTypeId: 8,
    codename: "administrar_permisos_temporales",
    name: "Puede administrar permisos temporales",
  },

  // ID: 4 - ContentType: user_management
  MANAGE_ROLES: {
    id: "4",
    contentTypeId: 4,
    codename: "administrar_roles",
    name: "Puede administrar roles",
  },

  // ID: 5 - ContentType: laboratory_results
  VALIDATE_RESULTS: {
    id: "5",
    contentTypeId: 29,
    codename: "validar_resultados",
    name: "Puede validar resultados",
  },

  // ID: 6 - ContentType: billing
  MANAGE_BILLING: {
    id: "6",
    contentTypeId: 32,
    codename: "administrar_facturacion",
    name: "Puede administrar facturación",
  },

  // Sin id/contentTypeId a propósito: los números de arriba no son estables
  // entre instalaciones y `hasPermission` ya resuelve por codename.
  // Aparte de MANAGE_BILLING a propósito: administrar facturación es operar
  // (emitir, cerrar presentaciones, cobrar); el libro diario es el registro de
  // cada movimiento de plata. Hay quien tiene que auditar sin poder facturar.
  //
  // Dice "administrar" y no "ver" porque desde el libro también se corrige la
  // forma de pago de un cobro que se cargó mal. El nombre es lo que se lee al
  // armar un rol, y ahí es donde se decide quién puede tocar la plata.
  MANAGE_LEDGER: {
    codename: "administrar_libro_diario",
    name: "Puede ver y administrar el libro diario",
  },

  MANAGE_RESULTS: {
    codename: "gestionar_resultados",
    name: "Puede cargar y modificar resultados",
  },

  UPDATE_PROTOCOL_PRIVATE_PRICE: {
    codename: "actualizar_precio_particular_protocolo",
    name: "Puede actualizar el precio particular de un protocolo",
  },

  MANAGE_PRINTS: {
    codename: "gestionar_impresiones",
    name: "Puede imprimir y enviar protocolos",
  },

  // Subir al servidor lo que el laboratorio hizo en la PC mientras el servidor
  // estuvo caído. Es aparte de todos los demás porque no se parece a ninguno:
  // quien lo tiene hace que el servidor ejecute escrituras a nombre de otras
  // personas. Va para quien administra el sistema, no para el mostrador.
  UPLOAD_CONTINGENCY: {
    codename: "subir_contingencia",
    name: "Puede subir el trabajo hecho en contingencia",
  },
} as const

/**
 * Mismos textos que devuelve el backend en el 403, para que el usuario lea lo
 * mismo si la acción se bloquea acá o si igual llega al servidor.
 */
export const PERMISSION_MESSAGES = {
  MANAGE_RESULTS: "No tenés permiso para cargar ni modificar resultados. Pedíselo a un administrador.",
  MANAGE_PRINTS: "No tenés permiso para imprimir ni enviar protocolos. Pedíselo a un administrador.",
} as const

// Helper functions para verificar permisos
export type PermissionKey = keyof typeof PERMISSIONS
export type PermissionValue = (typeof PERMISSIONS)[PermissionKey]

/** Devuelve `undefined` para los permisos que no traen PK hardcodeada. */
export const getPermissionId = (key: PermissionKey): string | undefined => {
  const permission: PermissionDescriptor = PERMISSIONS[key]
  return permission.id
}

// Helper para obtener el codename de un permiso
export const getPermissionCodename = (key: PermissionKey): string => {
  return PERMISSIONS[key].codename
}

/** Devuelve `undefined` para los permisos que no traen ContentType hardcodeado. */
export const getPermissionContentTypeId = (key: PermissionKey): number | undefined => {
  const permission: PermissionDescriptor = PERMISSIONS[key]
  return permission.contentTypeId
}
