import { useEffect, useState } from "react"

import { MEDICAL_ENDPOINTS, PROTOCOL_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import type { Doctor, Insurance } from "@/types"

/**
 * Con qué médico y qué obra social vino este paciente la última vez.
 *
 * PARA ORDENAR EL COMBO, NO PARA ELEGIR POR NADIE
 * ===============================================
 * El combo de médicos tiene cientos de nombres y el de obras sociales varias
 * decenas, y un paciente que ya vino repite casi siempre los mismos dos. Con
 * esto suben al principio de la lista y con un cartelito que dice de dónde
 * salieron.
 *
 * NO se autoseleccionan a propósito. Un paciente cambia de obra social —se
 * cambia de trabajo, la pierde, entra a otra— y el que la elige por él es el
 * que después factura contra la cobertura equivocada. Aparecer primero ahorra
 * el scroll; elegir solo esconde una decisión que alguien tiene que tomar
 * mirando el carnet.
 *
 * TRAE LA FICHA SI NO ESTÁ EN LA LISTA
 * ====================================
 * El ingreso arranca con los primeros 20 médicos y las primeras 20 obras
 * sociales. El médico de la última vez puede no estar entre esos —de hecho,
 * cuanto más grande el catálogo, más probable— y sin la ficha no hay nada que
 * poner arriba. Por eso, cuando el id no aparece en lo ya cargado, se pide esa
 * fila sola.
 */

type LoDeLaUltimaVez = {
  doctor: number | null
  insurance: number | null
}

export type PrimerosDeLaLista = {
  /** Id del médico a destacar, o `null`. */
  medico: number | null
  /** Id de la obra social a destacar, o `null`. */
  obraSocial: number | null
  /** Fichas que hubo que traer porque no estaban en las listas ya cargadas. */
  medicoFaltante: Doctor | null
  obraSocialFaltante: Insurance | null
}

const VACIO: PrimerosDeLaLista = {
  medico: null,
  obraSocial: null,
  medicoFaltante: null,
  obraSocialFaltante: null,
}

export function useLoDeLaUltimaVez(
  patientId: number | null | undefined,
  medicosCargados: Doctor[],
  obrasSocialesCargadas: Insurance[],
): PrimerosDeLaLista {
  const { apiRequest } = useApi()
  const [primeros, setPrimeros] = useState<PrimerosDeLaLista>(VACIO)

  useEffect(() => {
    if (!patientId) {
      setPrimeros(VACIO)
      return
    }

    // Si la respuesta llega después de que cambiaron de paciente, se descarta:
    // poner el médico del paciente anterior arriba de la lista del nuevo es
    // peor que no poner ninguno.
    let vigente = true

    const traer = async () => {
      try {
        const response = await apiRequest(PROTOCOL_ENDPOINTS.LO_DE_LA_ULTIMA_VEZ(patientId))
        if (!response.ok || !vigente) return

        const datos: LoDeLaUltimaVez = await response.json()
        if (!vigente) return

        const [medicoFaltante, obraSocialFaltante] = await Promise.all([
          traerSiFalta<Doctor>(datos.doctor, medicosCargados, MEDICAL_ENDPOINTS.DOCTOR_DETAIL),
          traerSiFalta<Insurance>(
            datos.insurance,
            obrasSocialesCargadas,
            MEDICAL_ENDPOINTS.INSURANCE_DETAIL,
          ),
        ])
        if (!vigente) return

        setPrimeros({
          medico: datos.doctor,
          obraSocial: datos.insurance,
          medicoFaltante,
          obraSocialFaltante,
        })
      } catch {
        // Que no se pueda averiguar no rompe nada: el combo queda como siempre.
        if (vigente) setPrimeros(VACIO)
      }
    }

    const traerSiFalta = async <T extends { id: number }>(
      id: number | null,
      yaCargados: Array<{ id: number }>,
      detalle: (id: number) => string,
    ): Promise<T | null> => {
      if (!id || yaCargados.some((x) => x.id === id)) return null
      try {
        const response = await apiRequest(detalle(id))
        return response.ok ? ((await response.json()) as T) : null
      } catch {
        return null
      }
    }

    void traer()
    return () => {
      vigente = false
    }
    // `medicosCargados` y `obrasSocialesCargadas` quedan afuera a propósito:
    // sólo se usan para saber si hace falta pedir una ficha suelta, y meterlos
    // acá repetiría la consulta cada vez que el combo pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, apiRequest])

  return primeros
}
