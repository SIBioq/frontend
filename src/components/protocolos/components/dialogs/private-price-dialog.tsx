import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar precio particular</DialogTitle>
          <DialogDescription>Este monto se aplicará solo a este protocolo y puede cambiar el saldo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="precio-particular-protocolo" className="text-sm font-medium text-gray-700">Monto</label>
          <Input id="precio-particular-protocolo" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={saving} aria-invalid={Boolean(error)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
