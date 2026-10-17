"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { useAuth } from "@/contexts/auth-context"
import { PROTOCOL_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { seguirElWhatsApp } from "@/lib/seguimiento-de-whatsapp"
import { PaymentDialog } from "./dialogs/payment-dialog"
import type { ProtocolListItem, ProtocolStatus } from "@/types"

/**
 * Acciones rápidas desde la fila de la tabla (sin abrir el detalle):
 * registrar pago, imprimir informe y enviar por el método elegido por el
 * paciente. La página monta `dialogs` una sola vez y dispara las acciones por
 * fila. Reusa el endpoint de reporte/regularización; no duplica la lógica de
 * los diálogos pesados del detalle.
 *
 * `onChanged` recibe el estado nuevo cuando la respuesta lo trae (se aplica al
 * toque, sin recargar la lista); si no viene se llama sin argumento y el
 * caller decide si recargar todo.
 */
export function useProtocolQuickActions(
  onChanged: (statusUpdate?: {
    id: number
    status: ProtocolStatus | null
    payment_status?: ProtocolListItem["payment_status"] | null
  }) => void,
) {
  const { apiRequest } = useApi()
  const { hasPermission } = useAuth()
  const canPrintReports = hasPermission(PERMISSIONS.MANAGE_PRINTS.codename)
  const [paymentTarget, setPaymentTarget] = useState<ProtocolListItem | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const openPayment = (p: ProtocolListItem) => setPaymentTarget(p)

  const ensureCanPrintReports = () => {
    if (canPrintReports) return true
    toast.error(PERMISSION_MESSAGES.MANAGE_PRINTS, { duration: TOAST_DURATION })
    return false
  }

  const regularize = async (amount: number, operation: "patient_paid" | "refunded_to_patient") => {
    if (!paymentTarget) return false
    setIsProcessingPayment(true)
    try {
      const res = await apiRequest(PROTOCOL_ENDPOINTS.REGULARIZE_BALANCE(paymentTarget.id), {
        method: "POST",
        body: { operation, amount: amount.toFixed(2) },
      })
      if (res.ok) {
        toast.success(
          `${operation === "patient_paid" ? "Pago" : "Devolución"} de $${amount.toFixed(2)} registrado`,
          { duration: TOAST_DURATION },
        )
        // El "Pago" de la tabla es el `balance` (method field, fresco) y el
        // serializer de esta respuesta NO lo trae; por eso refrescamos la
        // lista (onChanged sin args → refetch) y quedan balance + estado de
        // pago + estado actualizados.
        onChanged()
        setPaymentTarget(null)
        return true
      }
      const err = await res.json().catch(() => ({}))
      throw new Error(formatApiError(err, "Error al registrar la operación"))
    } catch (e) {
      toast.error(getErrorMessage(e, "Error al procesar la operación"), { duration: TOAST_DURATION })
      return false
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const sendReport = async (p: ProtocolListItem, action: "email" | "whatsapp") => {
    if (!ensureCanPrintReports()) return
    setBusyId(p.id)
    try {
      const res = await apiRequest(PROTOCOL_ENDPOINTS.REPORT(p.id), {
        method: "POST",
        body: { action, type: "full", signed: true },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "No se pudo enviar el informe"))
      }
      const data = await res.json().catch(() => ({}))

      toast.success(data.detail || "Informe enviado", { duration: TOAST_DURATION })
      onChanged(data.protocol_status !== undefined ? { id: p.id, status: data.protocol_status } : undefined)

      // El 200 solo dice que Meta lo aceptó. Si el mensaje falla —número sin
      // WhatsApp, paciente que bloqueó al laboratorio— el servidor devuelve el
      // protocolo a "Pendiente de envío" y el seguimiento avisa acá.
      if (action === "whatsapp") {
        void seguirElWhatsApp(apiRequest, p.id, data.wamid, { alFallar: () => onChanged() })
      }
    } catch (e) {
      toast.error(getErrorMessage(e, "Error al enviar el informe"), { duration: TOAST_DURATION })
    } finally {
      setBusyId(null)
    }
  }

  // Imprimir: genera el PDF y lo abre en una pestaña nueva (preview de impresión
  // del navegador), sin descargarlo.
  const printReport = async (p: ProtocolListItem) => {
    if (!ensureCanPrintReports()) return
    setBusyId(p.id)
    try {
      const res = await apiRequest(PROTOCOL_ENDPOINTS.REPORT(p.id), {
        method: "POST",
        body: { action: "download", type: "full", signed: true },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "No se pudo generar el informe"))
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (!win) {
        toast.error("El navegador bloqueó la pestaña. Permití pop-ups para imprimir.", { duration: TOAST_DURATION })
      }
      // Liberar la URL después de que la pestaña la haya cargado.
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      toast.error(getErrorMessage(e, "Error al generar el informe"), { duration: TOAST_DURATION })
    } finally {
      setBusyId(null)
    }
  }

  // Envía por el método cargado en el protocolo (WhatsApp / Email). Si el
  // método no permite envío digital (ej. retiro en laboratorio), avisa.
  const sendByPatientMethod = (p: ProtocolListItem) => {
    if (!ensureCanPrintReports()) return
    const name = (p.send_method?.name || "").toLowerCase()
    if (name.includes("whats")) return sendReport(p, "whatsapp")
    if (name.includes("mail")) return sendReport(p, "email")
    toast.info("Este protocolo no tiene WhatsApp/Email como método de envío.", { duration: TOAST_DURATION })
  }

  // Reactivar un protocolo cancelado (requiere permiso; la tabla gatea el botón).
  const uncancel = async (p: ProtocolListItem) => {
    setBusyId(p.id)
    try {
      const res = await apiRequest(PROTOCOL_ENDPOINTS.UNCANCEL(p.id), { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(formatApiError(err, "No se pudo reactivar el protocolo"))
      }
      const data = await res.json().catch(() => ({}))
      toast.success("Protocolo reactivado", { duration: TOAST_DURATION })
      onChanged(data.status !== undefined ? { id: p.id, status: data.status } : undefined)
    } catch (e) {
      toast.error(getErrorMessage(e, "Error al reactivar el protocolo"), { duration: TOAST_DURATION })
    } finally {
      setBusyId(null)
    }
  }

  const dialogs = (
    <PaymentDialog
      open={paymentTarget !== null}
      onOpenChange={(open) => !open && setPaymentTarget(null)}
      protocolId={paymentTarget?.id ?? 0}
      amountDue={paymentTarget && Number.parseFloat(paymentTarget.balance) > 0 ? paymentTarget.balance : "0"}
      amountPending={paymentTarget && Number.parseFloat(paymentTarget.balance) > 0 ? paymentTarget.balance : "0"}
      patientPaid="0"
      amountToReturn={paymentTarget && Number.parseFloat(paymentTarget.balance) < 0 ? String(-Number.parseFloat(paymentTarget.balance)) : "0"}
      paymentStatusName={paymentTarget?.payment_status?.name ?? ""}
      onRegularize={regularize}
      isProcessing={isProcessingPayment}
    />
  )

  return { openPayment, printReport, sendByPatientMethod, uncancel, busyId, dialogs, canPrintReports }
}
