"use client"

import { ChevronRight, Phone, Mail, GitMerge, Trash2 } from "lucide-react"
import { DataTable, type Column, type SortState } from "@/components/common/data-table"
import { InitialsAvatar } from "@/components/common/initials-avatar"
import { AuditAvatars } from "@/components/common/audit-avatars"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Patient } from "@/types"

interface PatientsTableProps {
  patients: Patient[]
  onRowClick: (id: number) => void
  onMerge: (patient: Patient) => void
  onDelete: (patient: Patient) => void
  sort: SortState
  onSortChange: (sort: SortState) => void
  isLoading?: boolean
}

function formatDni(dni?: string | null) {
  const digits = (dni || "").replace(/\D/g, "")
  if (digits.length >= 7 && digits.length <= 8) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return dni || "—"
}

// Un anónimo muestra lo que tenga cargado: el nombre (o apodo) si lo hay, y
// el DNI si lo hay. Sólo lo que falta se reemplaza por el rótulo de anónimo.
function fullName(p: Patient) {
  const nombre = p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
  if (nombre) return nombre
  return p.is_anonymous ? "Paciente anónimo" : "—"
}

function dniCell(p: Patient) {
  if (p.dni) return formatDni(p.dni)
  return p.is_anonymous ? "ANÓNIMO" : "—"
}

function IconAction({ icon: Icon, label, onClick, className }: { icon: typeof Trash2; label: string; onClick: () => void; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className={cn("rounded-md p-1.5 text-gray-400 hover:bg-gray-100", className)}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const nameSkeleton = (
  <div className="flex items-center gap-2.5">
    <Skeleton className="h-8 w-8 rounded-full" />
    <Skeleton className="h-4 w-32 rounded" />
  </div>
)
const auditSkeleton = (
  <div className="flex gap-1">
    <Skeleton className="h-6 w-6 rounded-full" />
    <Skeleton className="h-6 w-6 rounded-full" />
  </div>
)

export function PatientsTable({ patients, onRowClick, onMerge, onDelete, sort, onSortChange, isLoading }: PatientsTableProps) {
  const columns: Column<Patient>[] = [
    {
      id: "dni",
      compact: true,
      header: "DNI",
      sortable: true,
      sortField: "dni",
      className: "pl-4",
      skeleton: <Skeleton className="h-4 w-20 rounded" />,
      cell: (p) => (
        <span className="font-mono text-sm font-semibold text-[#204983]">
          {dniCell(p)}
        </span>
      ),
    },
    {
      id: "name",
      header: "Paciente",
      sortable: true,
      sortField: "last_name",
      flexible: true,
      skeleton: nameSkeleton,
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <InitialsAvatar name={fullName(p)} size="sm" />
          <span className="truncate font-semibold text-gray-800">{fullName(p)}</span>
        </div>
      ),
    },
    {
      id: "age",
      compact: true,
      header: "Edad",
      align: "center",
      sortable: true,
      sortField: "birth_date",
      responsive: "hidden md:table-cell",
      skeleton: <Skeleton className="mx-auto h-4 w-16 rounded" />,
      cell: (p) => <span className="text-sm text-gray-600">{typeof p.age === "number" ? `${p.age} años` : "—"}</span>,
    },
    {
      id: "sex",
      compact: true,
      header: "Sexo",
      align: "center",
      responsive: "hidden md:table-cell",
      skeleton: <Skeleton className="mx-auto h-5 w-8 rounded-full" />,
      cell: (p) => (
        <Badge className={cn("font-normal", p.sex === "M" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700")}>
          {p.sex === "M" ? "M" : p.sex === "F" ? "F" : "—"}
        </Badge>
      ),
    },
    {
      id: "phone",
      compact: true,
      header: "Teléfono",
      responsive: "hidden lg:table-cell",
      skeleton: <Skeleton className="h-4 w-24 rounded" />,
      cell: (p) =>
        p.phone_mobile || p.alt_phone ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {p.phone_mobile || p.alt_phone}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      id: "email",
      header: "Email",
      responsive: "hidden xl:table-cell",
      flexible: true,
      skeleton: <Skeleton className="h-4 w-36 rounded" />,
      cell: (p) =>
        p.email ? (
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-600">
            <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{p.email}</span>
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      id: "audit",
      compact: true,
      header: "Auditoría",
      responsive: "hidden lg:table-cell",
      skeleton: auditSkeleton,
      cell: (p) =>
        p.creation?.user || p.last_change?.user ? (
          <AuditAvatars creation={p.creation} lastChange={p.last_change} size="sm" />
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      id: "actions",
      compact: true,
      header: "",
      align: "right",
      className: "pr-3",
      responsive: "hidden sm:table-cell",
      skeleton: (
        <div className="flex justify-end gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ),
      cell: (p) => (
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center justify-end gap-0.5">
            <IconAction icon={GitMerge} label="Unificar paciente" onClick={() => onMerge(p)} className="hover:text-[#204983]" />
            <IconAction icon={Trash2} label="Eliminar paciente" onClick={() => onDelete(p)} className="hover:text-red-600" />
            <ChevronRight className="ml-1 h-4 w-4 text-gray-300" />
          </div>
        </TooltipProvider>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={patients}
      getRowId={(p) => p.id}
      onRowClick={(p) => onRowClick(p.id)}
      sort={sort}
      onSortChange={onSortChange}
      isLoading={isLoading}
      emptyMessage="No se encontraron pacientes"
    />
  )
}
