import { useEffect, useState } from "react"
import { Info, Loader2 } from "lucide-react"
import { Button } from "../../../ui/button"
import { Input } from "../../../ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog"

interface PrivatePriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPrice?: string | null
  onSubmit: (price: string) => Promise<void>
}

export function PrivatePriceDialog({ open, onOpenChange, currentPrice, onSubmit }: PrivatePriceDialogProps) {
  const [price, setPrice] = useState(currentPrice ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPrice(currentPrice ?? "")
      setError(null)
    }
  }, [currentPrice, open])

  const submit = async () => {
    const normalized = price.trim().replace(",", ".")
    const amount = Number(normalized)
    if (!normalized || !Number.isFinite(amount) || amount < 0) {
      setError("Ingresá un monto válido mayor o igual a cero.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(normalized)
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar el precio particular.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-5 sm:p-6">
        <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <DialogHeader>
          <DialogTitle className="text-base text-[#204983] sm:text-lg">Actualizar precio particular por UB</DialogTitle>
          <DialogDescription>Definí cuánto vale una UB particular para calcular este protocolo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor actual</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{currentPrice ? `$${currentPrice}` : "Sin configurar"}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="precio-particular-protocolo" className="text-sm font-medium text-gray-700">Nuevo valor por UB</label>
            <Input id="precio-particular-protocolo" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={saving} aria-invalid={Boolean(error)} />
          </div>
          <div className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-[#204983]"><Info className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Alcance: Solo este protocolo</p><p className="mt-1 text-blue-900/75">No modifica la obra social, el catálogo ni otros protocolos.</p></div></div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" className="bg-[#204983] hover:bg-[#1a3d6f]" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar precio
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
