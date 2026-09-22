"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUpRight, Banknote, ExternalLink, Landmark, Loader2, Minus, Pencil, Receipt,
  Save, Wallet,
} from "lucide-react"

import { SelectorDeCuenta } from "@/components/common/forma-de-pago"
import { UnplannedTransactionsDialog } from "@/components/protocolos/components/dialogs/unplanned-transactions-dialog"
import { RoundingConfirmDialog } from "@/components/protocolos/components/dialogs/rounding-confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PROTOCOL_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { useToast } from "@/hooks/use-toast"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { FormaDePagoDialog } from "@/components/protocolos/components/dialogs/forma-de-pago-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { PagoDelProtocolo, Protocol } from "@/types"

/**
 * Corregir todo lo que se cobró de un protocolo, sin salir del libro.
 *
 * POR QUÉ ACÁ Y NO EN EL DETALLE
 * ==============================
 * El error se descubre en el libro: cuadrando la caja contra el extracto,
 * alguien ve que un cobro no cierra. Mandarlo al detalle del protocolo a
 * buscar cuatro diálogos distintos —coseguro por un lado, no contemplados por
 * otro, los montos extra en ninguno— es hacerle reconstruir a mano lo que ya
 * tiene delante.
 *
 * LOS CARGOS Y LOS COBROS SON DOS COSAS
 * =====================================
 * Arriba, lo que el paciente DEBE: análisis, material, derivación, coseguro y
 * los no contemplados. Abajo, lo que PAGÓ y por dónde entró. Se editan por
 * separado porque son preguntas distintas —cuánto había que cobrar y cuánto
 * entró— y mezclarlas es como se llega a "corrijo el total bajando el pago".
 *
 * LOS ANÁLISIS NO SE EDITAN A MANO
 * ================================
 * Su precio sale del nomenclador (UB × valor). Escribir un importe encima
 * rompe ese vínculo y después no hay forma de saber por qué ese protocolo
 * cobró distinto. Se corrigen agregando, quitando o cambiando la autorización,
 * desde el detalle — que es donde está la lista.
 */

type Props = {
  protocolId: number
  /** Para refrescar el libro cuando la corrección movió plata. */
  onCambio: () => void
}

const plata = (valor: string | number | undefined) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
    .format(Number.parseFloat(String(valor ?? "0")) || 0)

export function CorreccionDelCobro({ protocolId, onCambio }: Props) {
  const { apiRequest } = useApi()
  const toastActions = useToast()

  const [protocolo, setProtocolo] = useState<Protocol | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardandoCargos, setGuardandoCargos] = useState(false)
  const [guardandoCobro, setGuardandoCobro] = useState(false)
  const [noContempladosAbierto, setNoContempladosAbierto] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState<PagoDelProtocolo | null>(null)
  const [anulando, setAnulando] = useState<PagoDelProtocolo | null>(null)
  const [guardandoAnulacion, setGuardandoAnulacion] = useState(false)
  const [confirmandoRedondeo, setConfirmandoRedondeo] = useState(false)

  const [cargos, setCargos] = useState({ material: "", derivacion: "", coseguro: "" })
  const [cobro, setCobro] = useState({ efectivo: "", transferencia: "", cuentaId: "" })

  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const respuesta = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_DETAIL(protocolId))
      if (!respuesta.ok) throw new Error("No se pudo traer el protocolo.")
      const datos: Protocol = await respuesta.json()
      setProtocolo(datos)
      setCargos({
        material: datos.material_descartable_amount ?? "0.00",
        derivacion: datos.derivacion_amount ?? "0.00",
        coseguro: datos.coseguro_amount ?? "0.00",
      })
    } catch (err) {
      toastActions.error("No se pudo cargar el protocolo", {
        description: getErrorMessage(err, "Probá de nuevo."),
      })
    } finally {
      setCargando(false)
    }
  }, [apiRequest, protocolId, toastActions])

  useEffect(() => {
    void traer()
  }, [traer])

  const refrescar = async () => {
    await traer()
    onCambio()
  }

  const guardarCargos = async () => {
    setGuardandoCargos(true)
    try {
      // Dos endpoints porque son dos conceptos con reglas distintas: el
      // coseguro lo informa la obra social y solo aplica si lo cobra; los
      // montos extra son snapshots de la configuración global.
      const extras = await apiRequest(PROTOCOL_ENDPOINTS.SET_EXTRAS(protocolId), {
        method: "POST",
        body: {
          material_descartable_amount: cargos.material.replace(",", ".") || "0",
          derivacion_amount: cargos.derivacion.replace(",", ".") || "0",
        },
      })
      if (!extras.ok) {
        const datos = await extras.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudieron guardar los montos extra."))
      }

      if (protocolo?.insurance?.charges_coseguro) {
        const coseguro = await apiRequest(PROTOCOL_ENDPOINTS.SET_COSEGURO(protocolId), {
          method: "POST",
          body: { amount: cargos.coseguro.replace(",", ".") || "0" },
        })
        if (!coseguro.ok) {
          const datos = await coseguro.json().catch(() => ({}))
          throw new Error(formatApiError(datos, "No se pudo guardar el coseguro."))
        }
      }

      toastActions.success("Cargos corregidos", {
        description: "El total y el saldo del protocolo se recalcularon.",
      })
      await refrescar()
    } catch (err) {
      toastActions.error("No se pudieron guardar los cargos", {
        description: getErrorMessage(err, "Revisá los montos."),
      })
    } finally {
      setGuardandoCargos(false)
    }
  }

  const anularPago = async () => {
    if (!anulando) return
    setGuardandoAnulacion(true)
    try {
      const respuesta = await apiRequest(
        PROTOCOL_ENDPOINTS.PROTOCOL_PAGO(protocolId, anulando.id),
        { method: "DELETE" },
      )
      if (!respuesta.ok && respuesta.status !== 204) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo anular el cobro."))
      }
      toastActions.success("Cobro anulado", {
        description: "El saldo del protocolo se recalculó.",
      })
      setAnulando(null)
      await refrescar()
    } catch (err) {
      toastActions.error("No se pudo anular el cobro", {
        description: getErrorMessage(err),
      })
    } finally {
      setGuardandoAnulacion(false)
    }
  }

  const corregirPago = async (forma: string, cuentaId: string, monto?: string) => {
    if (!corrigiendo) return false
    try {
      const respuesta = await apiRequest(
        PROTOCOL_ENDPOINTS.PROTOCOL_PAGO(protocolId, corrigiendo.id),
        {
          method: "PATCH",
          body: {
            payment_method: forma,
            payment_account:
              forma === "transferencia" && cuentaId ? Number(cuentaId) : null,
            ...(monto !== undefined ? { amount: monto } : {}),
          },
        },
      )
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo corregir el cobro."))
      }
      toastActions.success("Cobro corregido")
      setCorrigiendo(null)
      await refrescar()
      return true
    } catch (err) {
      toastActions.error("No se pudo corregir el cobro", {
        description: getErrorMessage(err, "Revisá el monto y la forma."),
      })
      return false
    }
  }

  const enEfectivo = Number.parseFloat(cobro.efectivo.replace(",", ".")) || 0
  const porTransferencia = Number.parseFloat(cobro.transferencia.replace(",", ".")) || 0
  const faltaCuenta = porTransferencia > 0 && !cobro.cuentaId
  const puedeCobrar = (enEfectivo > 0 || porTransferencia > 0) && !faltaCuenta && !guardandoCobro

  const registrarCobro = async (decision?: "redondear" | "justo") => {
    if (!puedeCobrar) return
    const pendiente = Number.parseFloat(protocolo?.amount_pending || "0") || 0
    const total = enEfectivo + porTransferencia
    if (!decision && pendiente > 0 && total > pendiente) {
      setConfirmandoRedondeo(true)
      return
    }
    setConfirmandoRedondeo(false)
    let efectivo = enEfectivo
    let transferencia = porTransferencia
    if (decision === "justo") {
      let diferencia = Math.max(0, total - pendiente)
      const quitarEfectivo = Math.min(efectivo, diferencia)
      efectivo -= quitarEfectivo
      diferencia -= quitarEfectivo
      transferencia = Math.max(0, transferencia - diferencia)
    }
    setGuardandoCobro(true)
    try {
      // Un pago por forma, igual que en el ingreso: son dos movimientos y cada
      // uno se concilia por su lado.
      const aCrear = [
        ...(efectivo > 0
          ? [{ amount: efectivo.toFixed(2), payment_method: "efectivo" }]
          : []),
        ...(transferencia > 0
          ? [{
              amount: transferencia.toFixed(2),
              payment_method: "transferencia",
              payment_account: Number(cobro.cuentaId),
            }]
          : []),
      ]

      for (const pago of aCrear) {
        const respuesta = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOL_PAGOS(protocolId), {
          method: "POST",
          body: pago,
        })
        if (!respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}))
          throw new Error(formatApiError(datos, "No se pudo registrar el cobro."))
        }
      }

      toastActions.success("Cobro registrado")
      setCobro({ efectivo: "", transferencia: "", cuentaId: "" })
      await refrescar()
    } catch (err) {
      toastActions.error("No se pudo registrar el cobro", {
        description: getErrorMessage(err, "Revisá los montos."),
      })
    } finally {
      setGuardandoCobro(false)
    }
  }

  if (cargando && !protocolo) {
    return (
      <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!protocolo) return null

  const cobraCoseguro = Boolean(protocolo.insurance?.charges_coseguro)

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Wallet className="h-4 w-4 text-[#204983]" />
          Corregir el cobro del protocolo #{protocolId}
        </h3>
        <Link
          to={`/protocolos/${protocolId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#204983] hover:underline"
        >
          Abrir el protocolo <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* LO QUE EL PACIENTE DEBE */}
      <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold text-gray-700">Cargos</p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Análisis</span>
          <span className="tabular-nums font-medium">
            {plata(protocolo.analyses_amount_due)}
          </span>
        </div>
        <p className="-mt-2 text-[11px] text-gray-400">
          Sale del nomenclador. Se corrige agregando, quitando o cambiando la
          autorización, desde el protocolo.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cargo-material" className="text-xs">Material descartable</Label>
            <Input
              id="cargo-material"
              inputMode="decimal"
              value={cargos.material}
              onChange={(e) => setCargos((p) => ({ ...p, material: e.target.value }))}
              className="bg-white tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-derivacion" className="text-xs">Derivación</Label>
            <Input
              id="cargo-derivacion"
              inputMode="decimal"
              value={cargos.derivacion}
              onChange={(e) => setCargos((p) => ({ ...p, derivacion: e.target.value }))}
              className="bg-white tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-coseguro" className="text-xs">Coseguro</Label>
            <Input
              id="cargo-coseguro"
              inputMode="decimal"
              value={cargos.coseguro}
              disabled={!cobraCoseguro}
              onChange={(e) => setCargos((p) => ({ ...p, coseguro: e.target.value }))}
              className="bg-white tabular-nums"
            />
            {/* Un campo gris sin explicación se lee como que la pantalla está
                rota. La regla es del backend: `set-coseguro` rebota si la obra
                social no lo cobra. */}
            {!cobraCoseguro && (
              <p className="text-[11px] text-gray-400">
                {protocolo.insurance?.name || "Esta obra social"} no cobra
                coseguro. Se habilita desde Configuración → Obras sociales.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNoContempladosAbierto(true)}
            className="border-violet-600 text-violet-700 hover:bg-violet-600 hover:text-white"
          >
            <Receipt className="mr-1 h-3.5 w-3.5" />
            Pagos y cobros no contemplados
          </Button>
          <Button
            size="sm"
            onClick={guardarCargos}
            disabled={guardandoCargos}
            className="bg-[#204983] hover:bg-[#1a3d6f]"
          >
            {guardandoCargos ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Guardar cargos
          </Button>
        </div>
      </div>

      {/* EL RESUMEN, PARA SABER CUÁNTO FALTA */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Resumen titulo="Total a pagar" valor={plata(protocolo.amount_due)} />
        <Resumen titulo="Pagado" valor={plata(protocolo.patient_paid)} tono="ok" />
        <Resumen
          titulo={
            Number.parseFloat(protocolo.amount_to_return || "0") > 0
              ? "A devolver"
              : "Pendiente"
          }
          valor={
            Number.parseFloat(protocolo.amount_to_return || "0") > 0
              ? plata(protocolo.amount_to_return)
              : plata(protocolo.amount_pending)
          }
          tono="alerta"
        />
      </div>

      {/* LO QUE YA ENTRÓ (Y LO QUE SALIÓ) */}
      {(protocolo.pagos ?? []).length > 0 && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-700">Cobros y devoluciones</p>
          {(protocolo.pagos ?? []).map((pago) => (
            <div
              key={pago.id}
              className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
            >
              {/* EL MENOS VA PRIMERO DE TODO, COMO EN LOS ANÁLISIS.
                  Sacar algo tiene que estar siempre en el mismo lugar y no
                  perdido entre los datos de la fila. */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Anular el cobro de ${plata(pago.amount)}`}
                title="Anular este movimiento"
                onClick={() => setAnulando(pago)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>

              {pago.tipo === "devolucion" ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                  <ArrowUpRight className="h-3 w-3" />
                  Devolución
                </span>
              ) : null}

              <span className="font-medium tabular-nums text-gray-900">
                {pago.tipo === "devolucion" ? "−" : ""}{plata(pago.amount)}
              </span>

              {pago.payment_method === "transferencia" ? (
                <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">
                  <Landmark className="h-3 w-3" />
                  Transferencia
                  {pago.payment_account_detail ? ` · ${pago.payment_account_detail.nombre}` : ""}
                  {pago.payment_account_detail?.alias ? ` (${pago.payment_account_detail.alias})` : ""}
                </span>
              ) : pago.payment_method === "efectivo" ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">
                  <Banknote className="h-3 w-3" />
                  Efectivo
                </span>
              ) : (
                <span className="text-xs text-gray-400">Sin registrar</span>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6 text-gray-400 hover:text-[#204983]"
                aria-label={`Corregir el cobro de ${plata(pago.amount)}`}
                title="Corregir monto y forma"
                onClick={() => setCorrigiendo(pago)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* LO QUE PAGÓ Y POR DÓNDE */}
      <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold text-gray-700">Registrar otro cobro</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cobro-efectivo" className="text-xs">Efectivo</Label>
            <Input
              id="cobro-efectivo"
              inputMode="decimal"
              placeholder="0,00"
              value={cobro.efectivo}
              onChange={(e) => setCobro((p) => ({ ...p, efectivo: e.target.value }))}
              className="bg-white tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobro-transferencia" className="text-xs">Transferencia</Label>
            <Input
              id="cobro-transferencia"
              inputMode="decimal"
              placeholder="0,00"
              value={cobro.transferencia}
              onChange={(e) => setCobro((p) => ({ ...p, transferencia: e.target.value }))}
              className="bg-white tabular-nums"
            />
            {porTransferencia > 0 && (
              <div className="mt-2 space-y-1">
                <Label htmlFor="cobro-cuenta" className="text-xs">¿A qué cuenta? *</Label>
                <SelectorDeCuenta
                  id="cobro-cuenta"
                  cuentaId={cobro.cuentaId}
                  onCuentaChange={(id) => setCobro((p) => ({ ...p, cuentaId: id }))}
                />
                {faltaCuenta && (
                  <p className="text-xs text-red-600">
                    Sin la cuenta, esta transferencia no se puede conciliar.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void registrarCobro()}
            disabled={!puedeCobrar}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {guardandoCobro ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wallet className="mr-1 h-3.5 w-3.5" />
            )}
            Registrar cobro
          </Button>
        </div>
      </div>

      {/* SE PREGUNTA ANTES, PORQUE MUEVE PLATA.
          Anular baja lo pagado y puede dejar al protocolo debiendo. Un clic sin
          confirmación al lado de un lápiz es un error esperando. */}
      <AlertDialog open={anulando !== null} onOpenChange={(abierto) => !abierto && setAnulando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {anulando ? (
                <>
                  {anulando.tipo === "devolucion" ? "Devolución" : "Cobro"} de{" "}
                  <strong>{plata(anulando.amount)}</strong>
                  {anulando.payment_method === "transferencia"
                    ? " por transferencia"
                    : anulando.payment_method === "efectivo"
                      ? " en efectivo"
                      : ""}
                  . Deja de contar y sale de esta lista; el saldo del protocolo se
                  recalcula solo. Queda registrado en el historial del protocolo,
                  con quién lo anuló.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardandoAnulacion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(evento) => {
                // El AlertDialog cierra solo al confirmar; sin esto se cierra
                // antes de que termine el pedido y no se ve si falló.
                evento.preventDefault()
                anularPago()
              }}
              disabled={guardandoAnulacion}
              className="bg-red-600 hover:bg-red-700"
            >
              {guardandoAnulacion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormaDePagoDialog
        open={corrigiendo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCorrigiendo(null)
        }}
        formaDePago={corrigiendo?.payment_method || ""}
        cuentaDeCobroId={
          corrigiendo?.payment_account ? String(corrigiendo.payment_account) : ""
        }
        monto={corrigiendo?.amount ?? ""}
        onGuardar={corregirPago}
      />

      <UnplannedTransactionsDialog
        open={noContempladosAbierto}
        onOpenChange={setNoContempladosAbierto}
        protocolId={protocolId}
        isEditable
        onChanged={refrescar}
      />

      <RoundingConfirmDialog
        open={confirmandoRedondeo}
        diferencia={Math.max(0, enEfectivo + porTransferencia - (Number.parseFloat(protocolo.amount_pending || "0") || 0))}
        isProcessing={guardandoCobro}
        onOpenChange={setConfirmandoRedondeo}
        onRedondear={() => void registrarCobro("redondear")}
        onCobrarJusto={() => void registrarCobro("justo")}
      />
    </div>
  )
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string
  valor: string
  tono?: "ok" | "alerta"
}) {
  const color =
    tono === "ok" ? "text-emerald-700" : tono === "alerta" ? "text-orange-700" : "text-gray-900"
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{valor}</div>
    </div>
  )
}
