"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, CalendarRange, Clock, Settings } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useFacturacionApi } from "./use-facturacion-api"
import { ProtocolBillingRow } from "./components/protocol-billing-row"
import { BillingBoard } from "./components/billing-board"
import { CurrentInvoicesList } from "./components/current-invoices-list"
import { EditableCloseDate } from "./components/editable-close-date"
import { ClosePresentationDialog } from "./components/close-presentation-dialog"
import { PresentationHistoryCard } from "./components/presentation-history-card"
import { PresentationEarningsChart } from "./components/presentation-earnings-chart"
import { formatDateAR } from "./format"

const tabClass =
  "flex-shrink-0 rounded-full border border-transparent bg-transparent px-4 py-1.5 text-sm font-medium text-gray-600 shadow-none transition-colors hover:bg-gray-100 data-[state=active]:border-[#204983] data-[state=active]:bg-[#204983] data-[state=active]:text-white data-[state=active]:shadow-sm"

// Deep-link a la pestaña de Facturación dentro de Configuración.
const BILLING_CONFIG_PATH = "/configuracion?tab=facturacion"

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export default function FacturacionPage() {
  const [entityId, setEntityId] = useState<number | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const m = useFacturacionApi(entityId)

  // Selecciona la primera entidad apenas carga la lista.
  useEffect(() => {
    if (entityId == null && m.entities.length > 0) {
      setEntityId(m.entities[0].id)
    }
  }, [entityId, m.entities])

  const entity = m.entities.find((e) => e.id === entityId) ?? null
  const openPresentation = m.currentTotal?.presentation ?? null
  const remaining = daysUntil(openPresentation?.target_close_date)
  // No se auto-cierra al llegar la fecha: solo avisa (una vez por día, vía WhatsApp)
  // que ya está vencida y hay que cerrarla a mano.
  const isOverdue = remaining != null && remaining < 0
  // Anticipación del aviso ahora es por entidad (el cron ya no usa una config global).
  const withinReminderWindow =
    !!entity?.reminder_enabled && remaining != null && remaining >= 0 && remaining <= (entity?.reminder_days_before ?? 7)

  if (m.entitiesLoading && m.entities.length === 0) {
    return (
      <div className="w-full py-4">
        <div className="rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-sm md:p-6 space-y-4">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-10 w-full max-w-md rounded" />
          <Skeleton className="h-40 w-full rounded" />
        </div>
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="w-full py-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/95 p-6 text-center shadow-md backdrop-blur-sm">
          <p className="text-sm text-gray-500">
            Todavía no hay entidades de facturación configuradas.
          </p>
          <Button asChild className="bg-[#204983] hover:bg-[#1a3d6f]">
            <Link to={BILLING_CONFIG_PATH}>
              <Settings className="mr-1.5 h-4 w-4" />
              Ir a configuración de facturación
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <div className="rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-sm md:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Facturación</h1>
            <p className="text-sm text-gray-500">Ayuda memoria para presentar y cobrar a las obras sociales.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de entidad: cada una tiene su propio ciclo de presentación */}
            <div className="flex gap-1 rounded-full bg-gray-100 p-1">
              {m.entities.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEntityId(e.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    entityId === e.id ? "bg-[#204983] text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-gray-600">
              <Link to={BILLING_CONFIG_PATH}>
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="actual" className="w-full">
          <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-2 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="actual" className={tabClass}>
              Presentación actual
            </TabsTrigger>
            <TabsTrigger value="tablero" className={tabClass}>
              Tablero
            </TabsTrigger>
            <TabsTrigger value="historial" className={tabClass}>
              Historial
            </TabsTrigger>
            <TabsTrigger value="graficos" className={tabClass}>
              Gráficos
            </TabsTrigger>
          </TabsList>

          {/* ===== Tablero: todos los protocolos no presentados ===== */}
          <TabsContent value="tablero" className="space-y-4">
            <BillingBoard entityId={entity.id} entityName={entity.name} />
          </TabsContent>

          {/* ===== Presentación actual ===== */}
          <TabsContent value="actual" className="space-y-4">
            {openPresentation ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold text-gray-800">{openPresentation.name || openPresentation.reference}</p>
                  <div className="text-xs text-gray-500">
                    {formatDateAR(openPresentation.period_start)} →{" "}
                    <EditableCloseDate
                      closeDate={openPresentation.target_close_date}
                      onSave={(date) => m.setTargetCloseDate(openPresentation.id, date)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOverdue ? (
                    <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Vencida hace {Math.abs(remaining!)} día{Math.abs(remaining!) === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    remaining != null && (
                      <Badge
                        variant="outline"
                        className={
                          withinReminderWindow
                            ? "gap-1 border-amber-200 bg-amber-50 text-amber-700"
                            : "gap-1 border-gray-200 bg-gray-50 text-gray-600"
                        }
                      >
                        <Clock className="h-3 w-3" />
                        Faltan {remaining} días
                      </Badge>
                    )
                  )}
                  <Button size="sm" className="bg-[#204983] hover:bg-[#1a3d6f]" onClick={() => setCloseDialogOpen(true)}>
                    <CalendarRange className="mr-1.5 h-4 w-4" />
                    Cerrar presentación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Presentación en curso de {entity.name}.</p>
                <Button size="sm" className="bg-[#204983] hover:bg-[#1a3d6f]" onClick={() => setCloseDialogOpen(true)}>
                  <CalendarRange className="mr-1.5 h-4 w-4" />
                  Cerrar presentación
                </Button>
              </div>
            )}

            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Protocolos pendientes de facturar ({m.pendingProtocols.length})
              </h2>
              {m.pendingLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : m.pendingProtocols.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                  No hay protocolos pendientes para {entity.name}.
                </p>
              ) : (
                <div className="space-y-2">
                  {m.pendingProtocols.map((p) => (
                    <ProtocolBillingRow
                      key={p.protocol_id}
                      protocol={p}
                      onMarkBilled={m.markProtocolBilled}
                      isMarking={m.markingProtocolId === p.protocol_id}
                      otherEntities={m.entities.filter((e) => e.id !== entityId)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Facturados en esta presentación</h2>
              <p className="mb-2 text-xs text-gray-400">
                El valor UB y lo cobrado de cada OOSS se cargan una vez que la presentación esté cerrada, desde Historial.
                Si marcaste algo por error, desmarcalo acá.
              </p>
              {m.currentInvoicesLoading ? (
                <Skeleton className="h-16 w-full rounded-lg" />
              ) : (
                <CurrentInvoicesList
                  invoices={m.currentInvoices}
                  onUnbill={m.unbillProtocol}
                  unbillingProtocolId={m.unbillingProtocolId}
                />
              )}
            </div>
          </TabsContent>

          {/* ===== Historial ===== */}
          <TabsContent value="historial" className="space-y-2">
            {m.closedLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : m.closedPresentations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                {entity.name} todavía no tiene presentaciones cerradas.
              </p>
            ) : (
              m.closedPresentations.map((p) => (
                <PresentationHistoryCard
                  key={p.id}
                  presentation={p}
                  entity={entity}
                  onSaveUbValue={m.saveUbValue}
                  onSaveCollected={m.saveCollected}
                  onSaveCollectedTotal={m.saveCollectedTotal}
                />
              ))
            )}
          </TabsContent>

          {/* ===== Gráficos ===== */}
          <TabsContent value="graficos">
            {m.summaryLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <PresentationEarningsChart entity={entity} items={m.presentationsSummary} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ClosePresentationDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        entity={entity}
        onConfirm={async (nextDate, name, notes) => {
          await m.closePresentation(nextDate, name, notes)
        }}
      />
    </div>
  )
}
