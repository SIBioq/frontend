"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { BILLING_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { readApiError } from "@/lib/api-error"

/**
 * Las cuentas a las que un paciente puede transferir.
 *
 * POR QUÉ HACEN FALTA
 * ===================
 * Al cerrar la caja hay que cruzar cada transferencia contra el extracto de SU
 * cuenta. Saber que "fue por transferencia" no alcanza: hay que saber a dónde
 * entró, y reconstruirlo de memoria días después es lo que hace que un día no
 * cierre y nadie sepa por qué.
 *
 * NO SE BORRAN, SE DAN DE BAJA
 * ============================
 * Los cobros viejos siguen apuntando a su cuenta. Borrarla dejaría cobros que
 * no se pueden conciliar contra nada. Dada de baja, desaparece de la lista de
 * elegibles y los cobros que ya la usaban la siguen mostrando.
 */

export type CuentaDeCobro = {
  id: number
  nombre: string
  alias: string
  is_active: boolean
}

export function CuentasDeCobro() {
  const { apiRequest } = useApi()

  const [cuentas, setCuentas] = useState<CuentaDeCobro[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [nombre, setNombre] = useState("")
  const [alias, setAlias] = useState("")

  const traer = async () => {
    try {
      const respuesta = await apiRequest(BILLING_ENDPOINTS.CUENTAS_DE_COBRO)
      if (!respuesta.ok) return
      const datos = await respuesta.json()
      setCuentas(Array.isArray(datos) ? datos : datos.results || [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void traer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!nombre.trim()) {
      toast.error("La cuenta necesita un nombre", { duration: TOAST_DURATION })
      return
    }
    setCreando(true)
    try {
      const respuesta = await apiRequest(BILLING_ENDPOINTS.CUENTAS_DE_COBRO, {
        method: "POST",
        body: { nombre: nombre.trim(), alias: alias.trim() },
      })
      if (!respuesta.ok) {
        toast.error(await readApiError(respuesta, "No se pudo crear la cuenta"),
          { duration: TOAST_DURATION })
        return
      }
      setNombre("")
      setAlias("")
      toast.success("Cuenta creada", { duration: TOAST_DURATION })
      await traer()
    } finally {
      setCreando(false)
    }
  }

  const cambiarEstado = async (cuenta: CuentaDeCobro, activa: boolean) => {
    setGuardando(cuenta.id)
    try {
      const respuesta = activa
        ? await apiRequest(BILLING_ENDPOINTS.CUENTA_DE_COBRO(cuenta.id), {
            method: "PATCH",
            body: { is_active: true },
          })
        : await apiRequest(BILLING_ENDPOINTS.CUENTA_DE_COBRO(cuenta.id), {
            method: "DELETE",
          })

      if (!respuesta.ok && respuesta.status !== 204) {
        toast.error(await readApiError(respuesta, "No se pudo cambiar la cuenta"),
          { duration: TOAST_DURATION })
        return
      }
      setCuentas((previas) =>
        previas.map((c) => (c.id === cuenta.id ? { ...c, is_active: activa } : c)))
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Wallet className="h-4 w-4 text-[#204983]" />
          Cuentas de cobro
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          A dónde transfieren los pacientes. Se eligen al cobrar, y sirven para
          conciliar la caja contra el extracto de cada cuenta. No se eliminan: se
          dan de baja, así los cobros viejos la siguen mostrando.
        </p>
      </div>

      <form
        onSubmit={crear}
        className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cuenta-nombre">Nombre</Label>
          <Input
            id="cuenta-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Cuenta Galicia"
            className="bg-white"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cuenta-alias">Alias / CBU</Label>
          <Input
            id="cuenta-alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ej: lab.salud.mp"
            className="bg-white"
          />
        </div>
        <Button type="submit" disabled={creando} className="shrink-0 bg-[#204983] hover:bg-[#1a3d6f]">
          {creando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Agregar cuenta
        </Button>
      </form>

      {cargando ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : cuentas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
          No hay cuentas cargadas. Sin cuentas, al cobrar solo se puede elegir efectivo.
        </p>
      ) : (
        <div className="space-y-2">
          {cuentas.map((cuenta) => (
            <div
              key={cuenta.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3
                          ${cuenta.is_active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"}`}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-900">{cuenta.nombre}</p>
                <p className="break-all text-xs text-gray-500">{cuenta.alias || "sin alias"}</p>
              </div>
              <div className="flex items-center gap-2">
                {guardando === cuenta.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-[#204983]" />
                )}
                <span className="text-xs text-gray-500">
                  {cuenta.is_active ? "Activa" : "De baja"}
                </span>
                <Switch
                  checked={cuenta.is_active}
                  disabled={guardando === cuenta.id}
                  onCheckedChange={(activa) => cambiarEstado(cuenta, activa)}
                  className="data-[state=checked]:bg-[#204983]"
                  aria-label={cuenta.is_active ? "Dar de baja" : "Reactivar"}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-gray-400">
        <Trash2 className="mt-0.5 h-3 w-3 shrink-0" />
        Dar de baja no borra nada: los cobros que usaron esa cuenta la siguen
        mostrando, para poder conciliarlos.
      </p>
    </div>
  )
}
