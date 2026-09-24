"use client"

import { useEffect, useState } from "react"
import { Banknote, Landmark } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BILLING_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"

/**
 * Cómo pagó el paciente: efectivo o transferencia, y a qué cuenta.
 *
 * POR QUÉ LA CUENTA ES OBLIGATORIA CUANDO ES TRANSFERENCIA
 * ========================================================
 * Al cerrar la caja hay que cruzar cada transferencia contra el extracto de SU
 * cuenta. "Transferencia" a secas obliga a reconstruir a cuál entró, días
 * después y de memoria. El backend también lo rechaza; acá se pide antes para
 * no perder la carga entera por un campo.
 *
 * SE MUESTRAN NOMBRE Y ALIAS
 * ==========================
 * Los dos, porque se usan en momentos distintos: el alias se le dicta al
 * paciente en el mostrador, y el nombre es por el que se busca al conciliar.
 *
 * DOS PIEZAS Y NO UNA
 * ===================
 * `SelectorDeCuenta` va aparte porque el ingreso ya no elige UNA forma: pide
 * cuánto entró en efectivo y cuánto por transferencia, y de la transferencia
 * necesita la cuenta sin el par de botones al lado. Duplicar ahí el pedido de
 * cuentas serían dos listas que se cargan y se filtran distinto.
 *
 * `FormaDePago` sigue siendo para donde SÍ hay una sola forma: corregir un
 * pago ya cargado, y el pago no contemplado.
 */

export type CuentaElegible = { id: number; nombre: string; alias: string }

const EFECTIVO = "efectivo"
const TRANSFERENCIA = "transferencia"

/**
 * Las cuentas activas, una sola vez por montaje.
 *
 * `pedir` existe para no ir a buscarlas hasta que hagan falta: en `FormaDePago`
 * recién cuando se elige transferencia.
 */
function useCuentas(pedir: boolean) {
  const { apiRequest } = useApi()
  const [cuentas, setCuentas] = useState<CuentaElegible[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!pedir || cuentas.length > 0) return
    let vigente = true
    setCargando(true)
    apiRequest(`${BILLING_ENDPOINTS.CUENTAS_DE_COBRO}?is_active=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!vigente || !datos) return
        setCuentas(Array.isArray(datos) ? datos : datos.results || [])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedir])

  return { cuentas, cargando }
}

type SelectorDeCuentaProps = {
  cuentaId: string
  onCuentaChange: (id: string) => void
  disabled?: boolean
  /** Para que quien lo etiqueta desde afuera pueda apuntarle el `htmlFor`. */
  id?: string
  /** En false no pide la lista: sirve para no traerla antes de que haga falta. */
  activo?: boolean
}

export function SelectorDeCuenta({
  cuentaId,
  onCuentaChange,
  disabled = false,
  id = "cuenta-de-cobro",
  activo = true,
}: SelectorDeCuentaProps) {
  const { cuentas, cargando } = useCuentas(activo)
  const elegida = cuentas.find((c) => String(c.id) === cuentaId)

  return (
    <div className="space-y-1">
      <Select value={cuentaId} onValueChange={onCuentaChange} disabled={disabled || cargando}>
        <SelectTrigger id={id} className="bg-white">
          <SelectValue placeholder={cargando ? "Cargando cuentas..." : "Elegir cuenta"} />
        </SelectTrigger>
        <SelectContent>
          {cuentas.map((cuenta) => (
            <SelectItem key={cuenta.id} value={String(cuenta.id)}>
              {cuenta.nombre}
              {cuenta.alias ? ` · ${cuenta.alias}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {elegida?.alias ? (
        <p className="text-xs text-gray-500">
          alias <span className="font-mono">{elegida.alias}</span>
        </p>
      ) : null}

      {!cargando && cuentas.length === 0 && (
        <p className="text-xs text-amber-700">
          No hay cuentas cargadas. Se dan de alta en Configuración → Facturación.
        </p>
      )}
    </div>
  )
}

type Props = {
  formaDePago: string
  cuentaId: string
  onFormaChange: (forma: string) => void
  onCuentaChange: (id: string) => void
  disabled?: boolean
  /** Encabezado del bloque. El default sirve para un pago de paciente; el gasto de caja necesita decir de dónde sale la plata. */
  titulo?: string
}

export function FormaDePago({
  formaDePago,
  cuentaId,
  onFormaChange,
  onCuentaChange,
  disabled = false,
  titulo = "Forma de pago",
}: Props) {
  // Volver a tocar el que ya está elegido NO lo suelta. La forma es obligatoria
  // en todos lados donde se mueve plata, así que dejar volver a "ninguna" es
  // ofrecer un estado que el backend rechaza.
  const elegir = (forma: string) => {
    onFormaChange(forma)
    // Cambiar a efectivo tiene que soltar la cuenta: el backend rechaza un
    // efectivo con cuenta, y dejarla puesta guardaría un dato que contradice
    // lo que dice la pantalla.
    if (forma !== TRANSFERENCIA) onCuentaChange("")
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <Label className="text-sm font-medium text-gray-700">{titulo}</Label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => elegir(EFECTIVO)}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition
            ${formaDePago === EFECTIVO
              ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-800"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          <Banknote className="h-4 w-4" />
          Efectivo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => elegir(TRANSFERENCIA)}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition
            ${formaDePago === TRANSFERENCIA
              ? "border-sky-300 bg-sky-50 font-medium text-sky-800"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          <Landmark className="h-4 w-4" />
          Transferencia
        </button>
      </div>

      {formaDePago === TRANSFERENCIA && (
        <div className="space-y-1.5">
          <Label htmlFor="cuenta-de-cobro" className="text-sm">
            ¿A qué cuenta? *
          </Label>
          <SelectorDeCuenta
            cuentaId={cuentaId}
            onCuentaChange={onCuentaChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
