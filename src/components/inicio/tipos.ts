/**
 * La respuesta de `GET /analytics/dashboard/inicio/`. Ver `analytics/inicio.py`.
 *
 * Los montos llegan como texto ("1234.50") para no perder centavos en el
 * camino; los tiempos, en segundos. Un `null` siempre quiere decir "no hay con
 * qué comparar" o "no aplica a este mes", nunca cero.
 */

export interface MesDisponible {
  anio: number
  mes: number
}

/** Un pendiente de ahora con la pila de hace una semana (puede faltar). */
export interface ConHaceUnaSemana {
  valor: number
  hace_una_semana: number | null
}

export interface Pila extends ConHaceUnaSemana {
  viejos: number
  dias_para_viejo?: number
  horas_para_viejo?: number
  estado_id?: number | null
  protocolos?: number
}

export interface PorForma {
  efectivo: string
  transferencia: string
  sin_forma: string
}

export interface FilaDeObraSocial {
  insurance_id: number | null
  nombre: string
  protocolos: number
  ub: number
  comparacion: { protocolos: number | null; ub: number | null }
}

export interface Inicio {
  anio: number
  mes: number
  es_mes_actual: boolean
  /** Hoy en el mes en curso; el último día en uno cerrado. */
  referencia: string
  ahora: string
  comparacion: {
    alcance: string
    /** Un tramo por mes comparado, del 1 al mismo día. */
    meses: Array<{ desde: string; hasta: string }>
  }
  encabezado: {
    completados: number
    comparacion: number | null
    crecimiento: number | null
  }
  pacientes: {
    hoy: { valor: number; a_esta_hora: number | null } | null
    semana: { valor: number; semana_pasada: number; desde: string } | null
    mes: { valor: number; comparacion: number | null }
    crecimiento: { semanas: number; valor: number; anio_anterior: number; porcentaje: number | null }
    por_dia: { desde: string; valores: number[] }
    feriados: Array<{ fecha: string; nombre: string }>
  }
  caja: {
    hoy: {
      cobrado: PorForma & { total: string; por_cuenta: Array<{ cuenta: string; monto: string }> }
      de_otros_dias: string
      devuelto: string
      devuelto_efectivo: string
      gastos_efectivo: string
      ingresos_efectivo: string
      efectivo_neto: string
      falta_cobrar: string
      a_devolver: string
      protocolos: number
      desglose: Record<string, string>
    } | null
    mes: PorForma & { cobrado: string; comparacion: string | null }
    por_dia: Array<PorForma & { fecha: string }>
  }
  tiempos: {
    carga: number | null
    resolucion: number | null
    protocolos: number
    comparacion: { carga: number | null; resolucion: number | null }
  }
  obras_sociales: {
    total_protocolos: number
    total_ub: number
    particulares: FilaDeObraSocial | null
    filas: FilaDeObraSocial[]
  }
  top_urgentes: Array<{ code: string; name: string; protocols: number }>
  pacientes_por_lugar: Array<{ lugar: string | null; pacientes: number }>
  meses_disponibles: MesDisponible[]
  /** Sólo en el mes en curso: un mes cerrado no tiene pilas. */
  resultados: { por_cargar: Pila; por_validar: Pila; urgentes: Pila } | null
  papeles: {
    informacion_faltante: { valor: number; estado_id: number | null }
    dias: number
    completado_estado_id: number | null
    orden_no_presentada: number
    orden_incompleta: number
    preauth_completa: number
    preauth_incompleta: number
    preauth_no_trajo: number
    preauth_pendientes: number
    con_papeles_pendientes: number
    completados_sin_papel: number
    anonimos_del_mes: number
    hace_una_semana: Record<string, number | null>
  } | null
  /** Sólo con permiso de facturación (lo decide el backend). */
  facturacion: {
    listos_para_facturar?: ConHaceUnaSemana
    arca_pendientes?: ConHaceUnaSemana
    arca_fallidos?: ConHaceUnaSemana
    arca_facturado: { valor: number; comparacion: number | null }
    dias_arca?: number
  } | null
  pendiente: {
    nos_deben: string
    protocolos_con_deuda: number
    a_devolver: string
    protocolos_con_devolucion: number
    neto: string
    impresos_con_pago_incompleto: number
    hace_una_semana: Record<string, string | number | null>
  } | null
}
