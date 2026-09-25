"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft, GitMerge, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PATIENT_ENDPOINTS, TOAST_DURATION } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type { Patient, PatientMergePreview } from "@/types"
import { formatDniForDisplay } from "@/lib/dni"
import { useDebounce } from "@/hooks/use-debounce"

interface MergePatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: Patient | null
  onMerged: (mergedPatient: Patient) => void
}

const FIELD_LABELS: Record<string, string> = {
  dni: "DNI",
  first_name: "Nombre",
  last_name: "Apellido",
  birth_date: "Fecha de nacimiento",
  sex: "Sexo",
  phone_mobile: "Teléfono móvil",
  alt_phone: "Teléfono alternativo",
  email: "Email",
  country: "País",
  province: "Provincia",
  city: "Ciudad",
  address: "Dirección",
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

export function MergePatientDialog({ open, onOpenChange, source, onMerged }: MergePatientDialogProps) {
  const { apiRequest } = useApi()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 350)
  const [candidates, setCandidates] = useState<Patient[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [target, setTarget] = useState<Patient | null>(null)
  const [preview, setPreview] = useState<PatientMergePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [resolutions, setResolutions] = useState<Record<string, unknown>>({})
  const [isMerging, setIsMerging] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch("")
      setCandidates([])
      setTarget(null)
      setPreview(null)
      setResolutions({})
    }
  }, [open])

  useEffect(() => {
    if (!open || !debouncedSearch.trim() || target) {
      return
    }

    const fetchCandidates = async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({ search: debouncedSearch.trim(), limit: "10", offset: "0" })
        const response = await apiRequest(`${PATIENT_ENDPOINTS.PATIENTS}?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          const filtered = (data.results || []).filter((p: Patient) => p.id !== source?.id)
          setCandidates(filtered)
        }
      } catch (error) {
        console.error("Error buscando pacientes:", error)
      } finally {
        setIsSearching(false)
      }
    }

    fetchCandidates()
  }, [debouncedSearch, open, source?.id, target, apiRequest])

  const handleSelectTarget = async (candidate: Patient) => {
    if (!source) return
    setTarget(candidate)
    setIsLoadingPreview(true)
    setPreview(null)
    setResolutions({})
    try {
      const response = await apiRequest(PATIENT_ENDPOINTS.MERGE_PREVIEW(source.id, candidate.id), { method: "POST" })
      if (response.ok) {
        const data: PatientMergePreview = await response.json()
        setPreview(data)
        // No pre-seleccionar: el usuario debe elegir explícitamente qué valor conservar.
        setResolutions({})
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error("Error al previsualizar la unificación", {
          description: formatApiError(errorData, "No se pudo obtener la vista previa."),
          duration: TOAST_DURATION,
        })
        setTarget(null)
      }
    } catch (error) {
      toast.error("Error", {
        description: getErrorMessage(error, "No se pudo obtener la vista previa."),
        duration: TOAST_DURATION,
      })
      setTarget(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleResolutionChange = (field: string, value: unknown) => {
    setResolutions((prev) => ({ ...prev, [field]: value }))
  }

  const handleMerge = async () => {
    if (!source || !target) return
    setIsMerging(true)
    try {
      const response = await apiRequest(PATIENT_ENDPOINTS.MERGE(source.id, target.id), {
        method: "POST",
        body: { resolutions },
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.detail || "Pacientes unificados correctamente", { duration: TOAST_DURATION })
        if (data.patient) onMerged(data.patient as Patient)
        onOpenChange(false)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error("Error al unificar", {
          description: formatApiError(errorData, "No se pudo unificar los pacientes."),
          duration: TOAST_DURATION,
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: getErrorMessage(error, "No se pudo unificar los pacientes."),
        duration: TOAST_DURATION,
      })
    } finally {
      setIsMerging(false)
    }
  }

  const allConflictsResolved =
    !preview ||
    preview.conflicts.every((c) => Object.prototype.hasOwnProperty.call(resolutions, c.field))

  const renderCandidate = (candidate: Patient) => (
    <button
      key={candidate.id}
      type="button"
      onClick={() => handleSelectTarget(candidate)}
      className="w-full text-left p-3 rounded-md border border-gray-200 hover:border-[#204983] hover:bg-[#204983]/5 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">
            {`${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()}
          </p>
          <p className="text-xs text-gray-500 font-mono">
            {candidate.is_anonymous ? "ANÓNIMO" : formatDniForDisplay(candidate.dni || "")}
          </p>
        </div>
        {candidate.is_anonymous && (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">Anónimo</Badge>
        )}
      </div>
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-[#204983]" />
            Unificar pacientes
          </DialogTitle>
          <DialogDescription>
            Mueve todos los protocolos del paciente origen al destino y desactiva el origen. Acción reversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border border-gray-200 p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">Origen (se desactiva)</p>
              <p className="break-words font-semibold text-sm text-gray-800">
                {source ? `${source.first_name || ""} ${source.last_name || ""}`.trim() : "—"}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                {source?.is_anonymous ? "ANÓNIMO" : formatDniForDisplay(source?.dni || "")}
              </p>
            </div>
            <ArrowRightLeft className="h-5 w-5 text-[#204983] mx-auto rotate-90 md:rotate-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">Destino (queda activo)</p>
              {target ? (
                <>
                  <p className="break-words font-semibold text-sm text-gray-800">
                    {`${target.first_name || ""} ${target.last_name || ""}`.trim()}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {target.is_anonymous ? "ANÓNIMO" : formatDniForDisplay(target.dni || "")}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-400">Buscá un paciente destino</p>
              )}
            </div>
          </div>

          {!target && (
            <div className="space-y-2">
              <Label htmlFor="merge-search">Buscar paciente destino</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="merge-search"
                  placeholder="Buscar por nombre o DNI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {isSearching && <Skeleton className="h-12 w-full rounded-md" />}
                {!isSearching && debouncedSearch && candidates.length === 0 && (
                  <p className="text-xs text-gray-500">No se encontraron pacientes.</p>
                )}
                {candidates.map(renderCandidate)}
              </div>
            </div>
          )}

          {target && isLoadingPreview && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-20 w-full rounded" />
            </div>
          )}

          {target && preview && !isLoadingPreview && (
            <div className="space-y-3">
              {preview.protocols_to_move.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-sm text-blue-900">
                    Se moverán <strong>{preview.protocols_to_move.length}</strong> protocolo(s) al destino.
                  </p>
                </div>
              )}

              {preview.auto_filled.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-600">Campos a completar automáticamente:</p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    {preview.auto_filled.map((item) => (
                      <li key={item.field}>
                        • {FIELD_LABELS[item.field] || item.field}: <span className="break-all font-mono">{formatValue(item.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.conflicts.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-600">
                    Conflictos a resolver. Ninguna opción viene seleccionada: elegí qué valor conservar en cada campo.
                  </p>
                  {preview.conflicts.map((conflict) => (
                    <div key={conflict.field} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-900 mb-2">
                        {FIELD_LABELS[conflict.field] || conflict.field}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleResolutionChange(conflict.field, conflict.source_value)}
                          className={`min-w-0 text-left p-2 rounded border text-xs ${
                            resolutions[conflict.field] === conflict.source_value
                              ? "border-[#204983] bg-[#204983]/10 ring-2 ring-[#204983]/40"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <p className="text-[10px] text-gray-500 uppercase">Origen</p>
                          <p className="break-all font-mono">{formatValue(conflict.source_value)}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolutionChange(conflict.field, conflict.target_value)}
                          className={`min-w-0 text-left p-2 rounded border text-xs ${
                            resolutions[conflict.field] === conflict.target_value
                              ? "border-[#204983] bg-[#204983]/10 ring-2 ring-[#204983]/40"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <p className="text-[10px] text-gray-500 uppercase">Destino</p>
                          <p className="break-all font-mono">{formatValue(conflict.target_value)}</p>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No hay conflictos. Podés unificar directamente.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {target && (
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null)
                setPreview(null)
                setResolutions({})
              }}
              disabled={isMerging}
            >
              Cambiar destino
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancelar
          </Button>
          <Button
            className="bg-[#204983] hover:bg-[#1a3d6f]"
            onClick={handleMerge}
            disabled={!target || !preview || isMerging || isLoadingPreview || !allConflictsResolved}
            title={!allConflictsResolved ? "Resolvé todos los conflictos antes de unificar" : undefined}
          >
            {isMerging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unificando...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" /> Confirmar unificación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
