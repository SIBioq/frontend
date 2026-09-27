"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Pencil, Star, Trash2 } from "lucide-react"
import type { Signature } from "@/types"

const nombreDeQuienSubio = (usuario: NonNullable<Signature["uploaded_by"]>): string =>
  [usuario.first_name, usuario.last_name].filter(Boolean).join(" ") || usuario.username

interface SignatureDetailDialogProps {
  signature: Signature | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSetDefault: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number, data: { name: string; biochemist_name: string; biochemist_mp: string }) => Promise<void>
  actionId: number | null
}

export function SignatureDetailDialog({
  signature,
  open,
  onOpenChange,
  onSetDefault,
  onDelete,
  onEdit,
  actionId,
}: SignatureDetailDialogProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [biochemistName, setBiochemistName] = useState("")
  const [biochemistMp, setBiochemistMp] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (signature) {
      setName(signature.name ?? "")
      setBiochemistName(signature.biochemist_name ?? "")
      setBiochemistMp(signature.biochemist_mp ?? "")
    }
    setEditing(false)
  }, [signature, open])

  if (!signature) return null
  const busy = actionId === signature.id

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onEdit(signature.id, {
        name: name.trim(),
        biochemist_name: biochemistName.trim(),
        biochemist_mp: biochemistMp.trim(),
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Cabecera y botonera quietas, el medio scrollea: con el diálogo más
            alto que la pantalla —un teléfono acostado, o uno chico— los botones
            de abajo quedaban fuera de la ventana y no había forma de llegar. */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 border-b border-gray-100 p-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {editing ? "Editar firma" : signature.name}
            {!editing && signature.is_default && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Predeterminada
              </Badge>
            )}
          </DialogTitle>
          {!editing && (signature.biochemist_name || signature.biochemist_mp) && (
            <DialogDescription>
              {signature.biochemist_name}
              {signature.biochemist_name && signature.biochemist_mp ? " · " : ""}
              {signature.biochemist_mp ? `M.P. ${signature.biochemist_mp}` : ""}
            </DialogDescription>
          )}
        </DialogHeader>

        {editing ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <Label htmlFor="sig_name">Nombre</Label>
              <Input id="sig_name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sig_bioname">Bioquímico/a</Label>
              <Input id="sig_bioname" value={biochemistName} onChange={(e) => setBiochemistName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sig_mp">Matrícula (M.P.)</Label>
              <Input id="sig_mp" value={biochemistMp} onChange={(e) => setBiochemistMp(e.target.value)} />
            </div>
            <p className="text-xs text-gray-500">
              Para cambiar la imagen, eliminá la firma y cargá una nueva.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vista previa</p>
            <div className="flex h-40 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              {signature.image_url ? (
                <img src={signature.image_url} alt={signature.name} className="max-h-32 object-contain" />
              ) : (
                <span className="text-sm text-gray-400">Sin imagen</span>
              )}
            </div>
            {(signature.uploaded_by || signature.created_at) && (
              <p className="text-xs text-gray-500">
                Cargada
                {signature.uploaded_by ? ` por ${nombreDeQuienSubio(signature.uploaded_by)}` : ""}
                {signature.created_at ? ` el ${new Date(signature.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : ""}
              </p>
            )}
          </div>
        )}

        <div className="shrink-0 space-y-2 border-t border-gray-100 bg-gray-50/60 p-4">
          {editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]"
                onClick={save}
                disabled={saving || !name.trim()}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(true)} disabled={busy}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar datos
              </Button>
              {!signature.is_default && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => onSetDefault(signature.id)} disabled={busy}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Star className="mr-1.5 h-4 w-4" />}
                  Marcar como predeterminada
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => onDelete(signature.id)}
                disabled={busy}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Eliminar firma
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
