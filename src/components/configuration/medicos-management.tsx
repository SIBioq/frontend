"use client"

import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, type Column } from "@/components/common/data-table"
import { Search, Plus, Loader2, RotateCcw } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useApiInfiniteQuery, flattenPages } from "@/hooks/use-api-infinite-query"
import { useApiQuery } from "@/hooks/use-api-query"
import { useApi } from "@/hooks/use-api"
import { getErrorMessage, readApiError } from "@/lib/api-error"
import { MEDICAL_ENDPOINTS } from "@/config/api"
import { toast } from "sonner"
import { CreateMedicoDialog } from "./components/create-medico-dialog"
import { EditMedicoDialog } from "./components/edit-medico-dialog"
import { DeleteMedicoDialog } from "./components/delete-medico-dialog"
import { MedicoDetailDialog } from "./components/medico-detail-dialog"
import { AuditAvatars } from "@/components/common/audit-avatars"
import type { Medico } from "@/types"

const PAGE_LIMIT = 20

export function MedicosManagement() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMedico, setSelectedMedico] = useState<Medico | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMedico, setSheetMedico] = useState<Medico | null>(null)
  const [verBajas, setVerBajas] = useState(false)
  const [reactivando, setReactivando] = useState<number | null>(null)
  const { apiRequest } = useApi()

  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const buildUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        limit: String(PAGE_LIMIT),
        offset: String(offset),
        search: debouncedSearchTerm,
        is_active: "true",
      })
      return `${MEDICAL_ENDPOINTS.DOCTORS}?${params.toString()}`
    },
    [debouncedSearchTerm],
  )

  const medicosQuery = useApiInfiniteQuery<Medico>({
    queryKey: ["doctors", "list", debouncedSearchTerm],
    buildUrl,
  })

  const medicos = flattenPages<Medico>(medicosQuery.data?.pages)
  const isLoading = medicosQuery.isLoading
  const isLoadingMore = medicosQuery.isFetchingNextPage
  const hasMore = !!medicosQuery.hasNextPage
  const error = medicosQuery.error?.message

  const lastElementRef = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore,
    onLoadMore: () => {
      if (!isLoadingMore && hasMore) medicosQuery.fetchNextPage()
    },
    dependencies: [debouncedSearchTerm, hasMore, isLoadingMore],
  })

  const invalidateDoctors = () => {
    queryClient.invalidateQueries({ queryKey: ["doctors"] })
  }

  // Los dados de baja se piden aparte y sólo al abrir la lista: el listado
  // principal sigue trayendo únicamente activos.
  const bajasQuery = useApiQuery<{ results: Medico[] }>({
    queryKey: ["doctors", "inactivos"],
    url: `${MEDICAL_ENDPOINTS.DOCTORS}?is_active=false`,
    enabled: verBajas,
  })
  const bajas = bajasQuery.data?.results ?? []

  const reactivar = async (medico: Medico) => {
    setReactivando(medico.id)
    try {
      const response = await apiRequest(MEDICAL_ENDPOINTS.DOCTOR_DETAIL(medico.id), {
        method: "PATCH",
        body: { is_active: true },
      })
      if (!response.ok) {
        toast.error(await readApiError(response, "No se pudo reactivar el médico."))
        return
      }
      toast.success(`${medico.first_name} ${medico.last_name} vuelve a estar activo.`)
      invalidateDoctors()
    } catch (err) {
      toast.error("No se pudo reactivar el médico.", { description: getErrorMessage(err) })
    } finally {
      setReactivando(null)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    invalidateDoctors()
    toast.success("Médico creado exitosamente")
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedMedico(null)
    invalidateDoctors()
    toast.success("Médico actualizado exitosamente")
  }

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false)
    setSelectedMedico(null)
    invalidateDoctors()
    toast.success("Médico eliminado exitosamente")
  }

  const openSheet = (medico: Medico) => {
    setSheetMedico(medico)
    setSheetOpen(true)
  }

  const handleEditFromSheet = (medico: Medico) => {
    setSheetOpen(false)
    setSelectedMedico(medico)
    setShowEditDialog(true)
  }

  const handleDeleteFromSheet = (medico: Medico) => {
    setSheetOpen(false)
    setSelectedMedico(medico)
    setShowDeleteDialog(true)
  }

  const columns: Column<Medico>[] = [
    {
      id: "name",
      header: "Nombre y apellido",
      cell: (m) => (
        <div>
          <div className="font-medium text-gray-900">
            {m.first_name} {m.last_name}
          </div>
          <div className="text-xs text-gray-500 sm:hidden">Mat: {m.license}</div>
        </div>
      ),
    },
    {
      id: "license",
      header: "Matrícula",
      responsive: "hidden sm:table-cell",
      cell: (m) => <span className="text-sm text-gray-700">{m.license}</span>,
    },
    {
      id: "audit",
      header: "Auditoría",
      responsive: "hidden md:table-cell",
      cell: (m) =>
        m.creation || m.last_change ? (
          <AuditAvatars creation={m.creation} lastChange={m.last_change} size="sm" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Médicos</h2>
        <p className="text-sm text-gray-500">Administra los médicos del sistema</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar médicos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-[#204983] hover:bg-[#1a3d6f] w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Médico
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={medicos}
        getRowId={(m) => m.id}
        onRowClick={openSheet}
        isLoading={isLoading && medicos.length === 0}
        emptyMessage="No se encontraron médicos."
        footer={
          <div ref={lastElementRef} className="flex justify-center py-4">
            {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-[#204983]" />}
          </div>
        }
      />

      <div>
        <button
          type="button"
          onClick={() => setVerBajas((v) => !v)}
          className="text-sm font-medium text-[#204983] hover:underline"
        >
          {verBajas ? "Ocultar médicos dados de baja" : "Ver médicos dados de baja"}
        </button>
        {verBajas && (
          <div className="mt-3 rounded-xl border border-gray-200">
            {bajasQuery.isLoading ? (
              <p className="p-4 text-sm text-gray-500">Cargando…</p>
            ) : bajasQuery.isError ? (
              <p className="p-4 text-sm text-red-600">No se pudo cargar la lista.</p>
            ) : bajas.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No hay médicos dados de baja.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {bajas.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {m.first_name} {m.last_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">Mat: {m.license}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reactivando === m.id}
                      onClick={() => reactivar(m)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reactivar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <CreateMedicoDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleCreateSuccess}
        onOpenChange={(isOpen: boolean) => setShowCreateDialog(isOpen)}
      />

      {selectedMedico && (
        <>
          <EditMedicoDialog
            isOpen={showEditDialog}
            medico={selectedMedico}
            onClose={() => {
              setShowEditDialog(false)
              setSelectedMedico(null)
            }}
            onSuccess={handleEditSuccess}
          />

          <DeleteMedicoDialog
            isOpen={showDeleteDialog}
            medico={selectedMedico}
            onClose={() => {
              setShowDeleteDialog(false)
              setSelectedMedico(null)
            }}
            onSuccess={handleDeleteSuccess}
            onOpenChange={() => setShowDeleteDialog(false)}
          />
        </>
      )}

      <MedicoDetailDialog
        medico={sheetMedico}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={handleEditFromSheet}
        onDelete={handleDeleteFromSheet}
      />
    </div>
  )
}
