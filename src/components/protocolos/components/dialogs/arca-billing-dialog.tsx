"use client"

import { useEffect, useState } from "react"
import { Landmark, Loader2, FileDown, User, Building2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Label } from "../../../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/select"

export type ArcaBillTo = "patient" | "third_party"
export type ArcaDocType = "dni" | "cuit" | "cuil" | "cdi"

export interface ArcaPayload {
  bill_to: ArcaBillTo
  cbte_tipo?: number
  receiver?: {
    doc_type: ArcaDocType
    doc_number: string
    full_name: string
    address: string
  }
}

interface ArcaBillingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  protocolId: number
  patientName: string
  patientDni?: string
  invoicePdfUrl?: string | null
  arcaCae?: string
  arcaCbteNumber?: number | null
  isAlreadyBilled?: boolean
  onConfirm: (payload: ArcaPayload) => Promise<boolean>
  isProcessing: boolean
}

// Tipos comunes de comprobante AFIP
const CBTE_TIPO_OPTIONS = [
  { value: "11", label: "Factura C (monotributo)" },
  { value: "6", label: "Factura B (responsable inscripto a consumidor final)" },
  { value: "1", label: "Factura A (responsable inscripto a inscripto)" },
]

const DOC_TYPE_OPTIONS: Array<{ value: ArcaDocType; label: string }> = [
  { value: "dni", label: "DNI" },
  { value: "cuit", label: "CUIT" },
  { value: "cuil", label: "CUIL" },
  { value: "cdi", label: "CDI" },
]

export function ArcaBillingDialog({
  open,
  onOpenChange,
  protocolId,
  patientName,
  patientDni,
  invoicePdfUrl,
  arcaCae,
  arcaCbteNumber,
  isAlreadyBilled = false,
  onConfirm,
  isProcessing,
}: ArcaBillingDialogProps) {
  const [billTo, setBillTo] = useState<ArcaBillTo>("patient")
  const [cbteTipo, setCbteTipo] = useState<string>("11")
  const [docType, setDocType] = useState<ArcaDocType>("dni")
  const [docNumber, setDocNumber] = useState("")
  const [fullName, setFullName] = useState("")
  const [address, setAddress] = useState("")

  useEffect(() => {
    if (open) {
      setBillTo("patient")
      setCbteTipo("11")
      setDocType("dni")
      setDocNumber("")
      setFullName("")
      setAddress("")
    }
  }, [open])

  const isReceiverValid =
    billTo === "patient" ||
    (docNumber.trim().length >= 7 && fullName.trim().length >= 3)

  const handleSubmit = async () => {
    const payload: ArcaPayload = {
      bill_to: billTo,
      cbte_tipo: Number.parseInt(cbteTipo, 10),
    }
    if (billTo === "third_party") {
      payload.receiver = {
        doc_type: docType,
        doc_number: docNumber.trim(),
        full_name: fullName.trim(),
        address: address.trim(),
      }
    }
    const ok = await onConfirm(payload)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90dvh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-700" />
            Facturación ARCA — Protocolo #{protocolId}
          </DialogTitle>
          <DialogDescription>
            Emisión de comprobante electrónico. El coseguro nunca se factura: la factura cubre
            análisis particulares + material descartable + derivación.
          </DialogDescription>
        </DialogHeader>

        {/* Si ya fue facturado, mostrar info y permitir descargar PDF */}
        {isAlreadyBilled ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-900">Comprobante emitido</p>
              {arcaCae && (
                <p className="text-xs text-emerald-800">
                  CAE: <span className="font-mono font-semibold">{arcaCae}</span>
                </p>
              )}
              {arcaCbteNumber != null && (
                <p className="text-xs text-emerald-800">
                  N° comprobante: <span className="font-mono font-semibold">{arcaCbteNumber}</span>
                </p>
              )}
            </div>

            {invoicePdfUrl ? (
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                <a href={invoicePdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4 mr-2" />
                  Descargar factura PDF
                </a>
              </Button>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                El PDF de la factura aún no está disponible en Cloudinary.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Selector de bill_to */}
            <div className="space-y-2">
              <Label>¿A quién se le factura?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillTo("patient")}
                  className={`rounded-md border p-3 text-left transition ${
                    billTo === "patient"
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-amber-700" />
                    <span className="text-sm font-semibold">Al paciente</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {patientName}
                    {patientDni ? ` · ${patientDni}` : ""}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setBillTo("third_party")}
                  className={`rounded-md border p-3 text-left transition ${
                    billTo === "third_party"
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-amber-700" />
                    <span className="text-sm font-semibold">A un tercero</span>
                  </div>
                  <p className="text-xs text-gray-600">Empresa o particular distinto al paciente</p>
                </button>
              </div>
            </div>

            {/* Tipo de comprobante */}
            <div className="space-y-2">
              <Label htmlFor="cbte_tipo">Tipo de comprobante</Label>
              <Select value={cbteTipo} onValueChange={setCbteTipo}>
                <SelectTrigger id="cbte_tipo" className="w-full min-w-0">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {CBTE_TIPO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Datos del receptor (sólo si es tercero) */}
            {billTo === "third_party" && (
              <div className="space-y-3 rounded-md border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-700">Datos del receptor</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-1">
                    <Label htmlFor="doc_type" className="text-xs">Tipo doc</Label>
                    <Select value={docType} onValueChange={(v) => setDocType(v as ArcaDocType)}>
                      <SelectTrigger id="doc_type" className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="doc_number" className="text-xs">Número</Label>
                    <Input
                      id="doc_number"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="12345678"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="full_name" className="text-xs">Razón social / Nombre completo</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Empresa S.A. o Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address" className="text-xs">Dirección</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Corrientes 1234"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            {isAlreadyBilled ? "Cerrar" : "Cancelar"}
          </Button>
          {!isAlreadyBilled && (
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !isReceiverValid}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitiendo...
                </>
              ) : (
                <>
                  <Landmark className="mr-2 h-4 w-4" /> Emitir factura ARCA
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
