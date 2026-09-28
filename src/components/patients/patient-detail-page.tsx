"use client"

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  Pencil,
  GitMerge,
  Trash2,
  Clock,
  Phone,
  Smartphone,
  Mail,
  MapPin,
  FileText,
  Plus,
  StickyNote,
  Contact,
  Cake,
  IdCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InitialsAvatar } from "@/components/common/initials-avatar"
import { StatusPill } from "@/components/common/status-pill"
import { AuditTimelineMini } from "@/components/common/audit-timeline-mini"
import { useApi } from "@/hooks/use-api"
import { useApiQuery } from "@/hooks/use-api-query"
import { useTituloDePestana } from "@/hooks/use-titulo-de-pestana"
import { tituloDeDetalle } from "@/lib/titulo-de-pestana"
import { useQueryClient } from "@tanstack/react-query"
import { EditPatientDialog } from "./components/edit-patient-dialog"
import DeletePatientDialog from "./components/delete-patient-dialog"
import { MergePatientDialog } from "./components/merge-patient-dialog"
import { PatientHistoryDialog } from "./components/patient-history-dialog"
import { PatientDetailSkeleton } from "./components/patient-detail-skeleton"
import { PATIENT_ENDPOINTS, PROTOCOL_ENDPOINTS } from "@/config/api"
import { cn } from "@/lib/utils"
import type { Patient, ProtocolAuditEvent, ProtocolListItem } from "@/types"

function formatDni(dni?: string | null) {
  const digits = (dni || "").replace(/\D/g, "")
  if (digits.length >= 7 && digits.length <= 8) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return dni || "—"
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-AR")
}

/** "1990-05-12" → "12/05/1990" sin pasar por Date: un `new Date` de una fecha
 * sola la toma en UTC y en Argentina muestra el día anterior. */
function formatFechaCivil(value?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "")
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

interface Afiliacion {
  insurance_id: number
  insurance_name: string
  affiliate_number: string
  usado_at: string
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="break-words text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { apiRequest } = useApi()

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [merging, setMerging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const patientQuery = useApiQuery<Patient>({
    queryKey: ["patients", "detail", id],
    url: PATIENT_ENDPOINTS.PATIENT_DETAIL(Number(id)),
    enabled: Boolean(id),
  })
  const patient = patientQuery.data

  useTituloDePestana(tituloDeDetalle("Paciente", patient))

  const protocolsQuery = useApiQuery<{ results: ProtocolListItem[]; count: number }>({
    queryKey: ["patients", "protocols", id],
    url: `${PROTOCOL_ENDPOINTS.PROTOCOLS}?patient=${id}&view=table&limit=50`,
    enabled: Boolean(id),
  })
  const protocols = protocolsQuery.data?.results ?? []

  const auditQuery = useApiQuery<{ events: ProtocolAuditEvent[] }>({
    queryKey: ["patients", "audit", id],
    url: `${PATIENT_ENDPOINTS.PATIENT_AUDIT_TIMELINE(Number(id))}?limit=5`,
    enabled: Boolean(id),
  })
  const auditEvents = auditQuery.data?.events ?? []

  // Números de afiliado que ya se le conocen, por obra social (sólo las activas).
  const afiliacionesQuery = useApiQuery<{ afiliaciones: Afiliacion[] }>({
    queryKey: ["patients", "afiliaciones", id],
    url: PATIENT_ENDPOINTS.PATIENT_AFILIACIONES(Number(id)),
    enabled: Boolean(id),
  })
  const afiliaciones = afiliacionesQuery.data?.afiliaciones ?? []

  const refetchPatient = () => {
    queryClient.invalidateQueries({ queryKey: ["patients", "detail", id] })
    queryClient.invalidateQueries({ queryKey: ["patients", "list"] })
  }

  const Breadcrumb = (
    <nav className="mb-4 flex items-center gap-1.5 text-sm">
      <Link to="/pacientes" className="flex items-center gap-1 text-gray-500 transition-colors hover:text-[#204983]">
        <ArrowLeft className="h-4 w-4" />
        Pacientes
      </Link>
      <ChevronRight className="h-4 w-4 text-gray-400" />
      <span className="font-medium text-gray-700">{patient ? patient.full_name : `#${id}`}</span>
    </nav>
  )

  if (patientQuery.isLoading) {
    return (
      <div className="w-full py-4">
        {Breadcrumb}
        <PatientDetailSkeleton />
      </div>
    )
  }

  if (patientQuery.error || !patient) {
    return (
      <div className="w-full py-4">
        {Breadcrumb}
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p>No se pudo cargar el paciente #{id}.</p>
          <Button size="sm" className="ml-auto bg-[#204983]" onClick={() => patientQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const name = patient.full_name || `${patient.first_name} ${patient.last_name}`
  const address = [patient.address, patient.city, patient.province, patient.country].filter(Boolean).join(", ")

  return (
    <div className="w-full py-4">
      {Breadcrumb}

      {/* Cabecera */}
      <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <InitialsAvatar name={name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800 md:text-2xl">{name}</h1>
                {!patient.is_active && <Badge className="bg-gray-200 text-gray-600">Inactivo</Badge>}
                {patient.is_anonymous && <Badge className="bg-amber-100 text-amber-800">Anónimo</Badge>}
              </div>
              <p className="text-sm text-gray-500">
                DNI {formatDni(patient.dni)}
                {typeof patient.age === "number" && ` · ${patient.age} años`}
                {patient.sex && ` · ${patient.sex === "M" ? "Masculino" : "Femenino"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-[#204983] text-white hover:bg-[#1a3d6f]" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
            <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => setMerging(true)}>
              <GitMerge className="mr-1.5 h-4 w-4" />
              Unificar
            </Button>
            <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeleting(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sus protocolos */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
                <FileText className="h-5 w-5 text-[#204983]" />
                Protocolos
                <span className="text-sm font-normal text-gray-500">
                  {patient.protocols_count ?? protocolsQuery.data?.count ?? protocols.length}
                  {patient.last_protocol_at && ` · último: ${formatDate(patient.last_protocol_at)}`}
                </span>
              </h2>
              <Button size="sm" variant="outline" onClick={() => navigate("/ingreso", { state: { patient } })}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo
              </Button>
            </div>
            {protocolsQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
            ) : protocols.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Este paciente no tiene protocolos</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {protocols.map((p) => {
                  const amount = Number.parseFloat(p.balance || "0")
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/protocolos/${p.id}`)}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-[#204983]">#{p.id}</span>
                          <StatusPill statusName={p.status?.name} />
                          <span className="hidden text-xs text-gray-500 sm:inline">{formatDate(p.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {amount > 0 ? (
                            <span className="text-sm font-medium text-red-600">Debe ${Math.abs(amount).toLocaleString("es-AR")}</span>
                          ) : amount < 0 ? (
                            <span className="text-sm font-medium text-amber-600">A favor</span>
                          ) : (
                            <span className="text-sm font-medium text-emerald-600">Pagado</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Contacto + observaciones */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Contact className="h-4 w-4 text-gray-400" />
              Contacto
            </h3>
            <InfoRow icon={Cake} label="Fecha de nacimiento" value={formatFechaCivil(patient.birth_date)} />
            <InfoRow icon={Phone} label="Teléfono" value={patient.phone_mobile} />
            <InfoRow icon={Smartphone} label="Teléfono alternativo" value={patient.alt_phone} />
            <InfoRow icon={Mail} label="Email" value={patient.email} />
            <InfoRow icon={MapPin} label="Domicilio" value={address} />
            {!patient.phone_mobile && !patient.alt_phone && !patient.email && !address && (
              <p className="py-2 text-sm text-gray-400">Sin datos de contacto</p>
            )}
          </section>

          {afiliaciones.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <IdCard className="h-4 w-4 text-gray-400" />
                Afiliaciones
              </h3>
              <ul className="divide-y divide-gray-100">
                {afiliaciones.map((a) => (
                  <li key={a.insurance_id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 break-words text-gray-800">{a.insurance_name}</span>
                    <span className="shrink-0 font-mono text-gray-600">{a.affiliate_number}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">El último número usado con cada obra social.</p>
            </section>
          )}

          {patient.observations && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <StickyNote className="h-4 w-4 text-gray-400" />
                Observaciones
              </h3>
              <p className={cn("whitespace-pre-wrap text-sm text-gray-700")}>{patient.observations}</p>
            </section>
          )}

          {/* Historial: últimos 5 cambios + ver completo */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Clock className="h-4 w-4 text-gray-400" />
                Historial
              </h3>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#204983]" onClick={() => setHistoryOpen(true)}>
                Ver completo
              </Button>
            </div>
            <AuditTimelineMini events={auditEvents} />
          </section>
        </div>
      </div>

      {/* Diálogos */}
      <EditPatientDialog
        isOpen={editing}
        onClose={() => setEditing(false)}
        patient={patient}
        setPatients={() => refetchPatient()}
        apiRequest={apiRequest}
      />
      <DeletePatientDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        patient={patient}
        setPatients={() => navigate("/pacientes")}
        apiRequest={apiRequest}
      />
      <MergePatientDialog
        open={merging}
        onOpenChange={setMerging}
        source={patient}
        onMerged={(merged) => {
          refetchPatient()
          navigate(`/pacientes/${merged.id}`)
        }}
      />
      <PatientHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        patientId={patient.id}
        patientName={name}
      />
    </div>
  )
}
