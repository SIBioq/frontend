"use client"

import type { KeyboardEvent } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Mail,
  MessageCircle,
  Store,
  User,
  Stethoscope,
  Building,
  TestTube,
  Send,
  DollarSign,
  ClipboardCheck,
  ShieldCheck,
  Receipt,
  Plus,
  Trash2,
  Banknote,
  Landmark,
} from "lucide-react"
import { Label } from "../../ui/label"
import { Input } from "../../ui/input"
import { Button } from "../../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { PatientSearch } from "./patient-search"
import { MedicoCombobox } from "./medico-combobox"
import { ObraSocialCombobox } from "./obra-social-combobox"
import { BillingEntitySelect } from "@/components/configuration/components/billing-entity-select"
import { AnalysisSearch } from "./analysis-search"
import { AnalysisTable } from "./analysis-table"
import { TRAJO_ORDEN_OPTIONS, type TrajoOrdenStatus } from "@/lib/protocol-order"
import { getSendMethodAction } from "@/lib/status-styles"
import { SelectorDeCuenta } from "@/components/common/forma-de-pago"
import type {
  Patient,
  Doctor,
  Insurance,
  SelectedAnalysis,
  SendMethod,
  PreauthStatus,
  UnplannedTransactionInput,
  QuoteDetail,
} from "../../../types"

type CreationPreauthStatus = Exclude<PreauthStatus, "not_required">
type StatusTone = "complete" | "partial" | "missing" | "neutral"
type StatusOption<T extends string> = {
  value: T
  label: string
  description: string
  /**
   * El color. Sin esto sale del valor, que es lo que sirve para orden médica y
   * preautorización: ahí cada opción significa «está bien / falta algo / no
   * está» y el verde-ámbar-rojo ES la información.
   *
   * El método de envío no tiene nada de eso: mandar por mail no está «mejor»
   * que retirar en el mostrador. Pintarlo con la misma escala inventaría una
   * jerarquía que no existe y le sacaría fuerza al rojo de donde sí importa.
   * Por eso va en `neutral`.
   */
  tone?: StatusTone
  icon?: typeof CheckCircle2
}

const PREAUTH_OPTIONS: Array<StatusOption<CreationPreauthStatus>> = [
  {
    value: "completa",
    label: "Completa",
    description: "El paciente trajo la preautorización final. Los análisis no cubiertos se cobran particular.",
  },
  {
    value: "incompleta",
    label: "Incompleta",
    description: "Falta gestionar o traer otra preautorización para análisis pendientes.",
  },
  {
    value: "no_trajo",
    label: "No la trajo",
    description: "No hay preautorización presentada todavía; se cobra como particular hasta regularizar.",
  },
]

const getStatusTone = (value: string): StatusTone => {
  if (value === "completa") return "complete"
  if (value === "incompleta") return "partial"
  return "missing"
}

const toneClasses: Record<StatusTone, { selected: string; unselected: string; icon: string }> = {
  complete: {
    selected: "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200",
    unselected: "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/60",
    icon: "text-emerald-600",
  },
  partial: {
    selected: "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-200",
    unselected: "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/60",
    icon: "text-amber-600",
  },
  missing: {
    selected: "border-red-600 bg-red-50 text-red-900 ring-2 ring-red-200",
    unselected: "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/60",
    icon: "text-red-600",
  },
  neutral: {
    selected: "border-[#204983] bg-[#204983]/10 text-[#1a3a68] ring-2 ring-[#204983]/25",
    unselected: "border-gray-200 bg-white text-gray-700 hover:border-[#204983]/40 hover:bg-[#204983]/5",
    icon: "text-[#204983]",
  },
}

const statusIcons: Record<StatusTone, typeof CheckCircle2> = {
  complete: CheckCircle2,
  partial: AlertTriangle,
  missing: CircleX,
  neutral: Send,
}

/** El ícono del método de envío, por lo que hay que hacer con el informe. */
const iconoDelEnvio = (nombre: string) => {
  switch (getSendMethodAction(nombre)) {
    case "whatsapp":
      return MessageCircle
    case "email":
      return Mail
    case "print":
      return Store
    default:
      return Send
  }
}

function StatusButtonGroup<T extends string>({
  labelId,
  options,
  value,
  onChange,
}: {
  labelId: string
  options: Array<StatusOption<T>>
  value: T | ""
  onChange: (value: T) => void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value))
    const lastIndex = options.length - 1
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? currentIndex === 0
              ? lastIndex
              : currentIndex - 1
            : currentIndex === lastIndex
              ? 0
              : currentIndex + 1

    onChange(options[nextIndex].value)
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid gap-2 sm:grid-cols-3"
      onKeyDown={handleKeyDown}
    >
      {options.map((option, optionIndex) => {
        const tone = option.tone ?? getStatusTone(option.value)
        const Icon = option.icon ?? statusIcons[tone]
        const isSelected = value === option.value
        const descriptionId = `${labelId}-${option.value}-description`

        return (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            role="radio"
            aria-checked={isSelected}
            aria-describedby={descriptionId}
            tabIndex={isSelected || (!value && optionIndex === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`h-auto min-h-24 justify-start whitespace-normal rounded-md border p-3 text-left transition ${
              isSelected ? toneClasses[tone].selected : toneClasses[tone].unselected
            }`}
          >
            <span className="flex w-full items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${toneClasses[tone].icon}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{option.label}</span>
                <span id={descriptionId} className="mt-1 block text-xs leading-snug opacity-80">
                  {option.description}
                </span>
              </span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}

interface Totals {
  authorizedTotal: number
  privateTotal: number
  /** Lo que se descontó por los análisis que superan el tope de UB. Ya está restado. */
  descuentoPorVolumen: number
  total: number
  patientOwes: number
  authorizedUb: number
  privateUb: number
  extrasTotal: number
}

interface ProtocolFormProps {
  patient: Patient | null
  doctors: Doctor[]
  insurances: Insurance[]
  sendMethods: SendMethod[]
  /**
   * Con qué médico y qué obra social vino este paciente la última vez.
   *
   * Sólo para que aparezcan primeros en sus combos. No se eligen solos: ver el
   * comentario en cada combobox.
   */
  idsDeLaUltimaVez?: { medico: number | null; obraSocial: number | null }
  selectedAnalyses: SelectedAnalysis[]
  selectedDoctor: Doctor | null
  selectedInsurance: Insurance | null
  selectedSendMethod: SendMethod | null
  /** Lo que el paciente deja en efectivo y lo que transfiere, por separado. */
  pagoEfectivo: string
  pagoTransferencia: string
  cuentaDeCobroId: string
  affiliateNumber: string
  billingEntityId: string
  trajoOrden: TrajoOrdenStatus | ""
  preauthStatus: PreauthStatus | ""
  isPrivateInsurance: boolean
  shouldShowOrder: boolean
  shouldShowPreauth: boolean
  shouldChargeMaterial: boolean
  shouldChargeDerivacion: boolean
  shouldChargeCoseguro: boolean
  extraAmounts: {
    material_descartable_amount: string
    derivacion_amount: string
  }
  coseguroAmount: string
  unplannedTransactions: UnplannedTransactionInput[]
  totals: Totals
  quoteById?: Record<number, QuoteDetail>
  onAnalysisChange: (analyses: SelectedAnalysis[]) => void
  onDoctorSelect: (doctor: Doctor | null) => void
  onInsuranceSelect: (insurance: Insurance | null) => void
  onSendMethodSelect: (sendMethod: SendMethod | null) => void
  onPatientFound: (patient: Patient) => void
  onPatientNotFound: (dni: string, sex: "M" | "F") => void
  onCreateAnonymous?: () => void
  onReset: () => void
  onShowCreateMedico: () => void
  onShowCreateObraSocial: () => void
  onPagoEfectivoChange: (value: string) => void
  onPagoTransferenciaChange: (value: string) => void
  onCuentaDeCobroChange: (value: string) => void
  onAffiliateNumberChange: (number: string) => void
  onBillingEntityChange: (id: string) => void
  onTrajoOrdenChange: (trajoOrden: TrajoOrdenStatus | "") => void
  onPreauthStatusChange: (status: PreauthStatus | "") => void
  onExtraAmountsChange: (amounts: { material_descartable_amount: string; derivacion_amount: string }) => void
  onCoseguroChange: (value: string) => void
  onUnplannedTransactionsChange: (items: UnplannedTransactionInput[]) => void
}

export function ProtocolForm({
  patient,
  doctors,
  insurances,
  sendMethods,
  idsDeLaUltimaVez,
  selectedAnalyses,
  selectedDoctor,
  selectedInsurance,
  selectedSendMethod,
  pagoEfectivo,
  pagoTransferencia,
  cuentaDeCobroId,
  affiliateNumber,
  billingEntityId,
  trajoOrden,
  preauthStatus,
  isPrivateInsurance,
  shouldShowOrder,
  shouldShowPreauth,
  shouldChargeMaterial,
  shouldChargeDerivacion,
  shouldChargeCoseguro,
  extraAmounts,
  coseguroAmount,
  unplannedTransactions,
  totals,
  quoteById,
  onAnalysisChange,
  onDoctorSelect,
  onInsuranceSelect,
  onSendMethodSelect,
  onPatientFound,
  onPatientNotFound,
  onCreateAnonymous,
  onReset,
  onShowCreateMedico,
  onShowCreateObraSocial,
  onPagoEfectivoChange,
  onPagoTransferenciaChange,
  onCuentaDeCobroChange,
  onAffiliateNumberChange,
  onBillingEntityChange,
  onTrajoOrdenChange,
  onPreauthStatusChange,
  onExtraAmountsChange,
  onCoseguroChange,
  onUnplannedTransactionsChange,
}: ProtocolFormProps) {
  const isAnonymousPatient = Boolean(patient?.is_anonymous)
  const enEfectivo = Number.parseFloat(pagoEfectivo) || 0
  const porTransferencia = Number.parseFloat(pagoTransferencia) || 0
  const paidAmount = enEfectivo + porTransferencia
  const remaining = Math.max(0, totals.patientOwes - paidAmount)
  // Una transferencia sin cuenta no se puede cruzar contra ningún extracto.
  // El backend la rechaza; acá se avisa antes de perder la carga entera.
  const faltaCuenta = porTransferencia > 0 && !cuentaDeCobroId

  const addUnplanned = () =>
    onUnplannedTransactionsChange([...unplannedTransactions, { kind: "charge", description: "", amount: "" }])
  const updateUnplanned = (index: number, patch: Partial<UnplannedTransactionInput>) =>
    onUnplannedTransactionsChange(
      unplannedTransactions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    )
  const removeUnplanned = (index: number) =>
    onUnplannedTransactionsChange(unplannedTransactions.filter((_, i) => i !== index))

  // "Total" completa el efectivo con lo que falta para cubrir la cuenta. Es lo
  // que pasa en el mostrador: el resto se paga en mano.
  const handleFillTotal = () => {
    const falta = Math.max(0, totals.patientOwes - porTransferencia)
    onPagoEfectivoChange(falta.toFixed(2))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
        {/* Patient Search */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Paciente</h3>
          </div>
          <PatientSearch
            onPatientFound={onPatientFound}
            onPatientNotFound={onPatientNotFound}
            onReset={onReset}
            onCreateAnonymous={onCreateAnonymous}
          />
        </div>

        {/* Doctor Selection */}
        <div className="space-y-2 sm:space-y-3" data-medico-field>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Médico</h3>
          </div>
          <MedicoCombobox
            medicos={doctors}
            idDeLaUltimaVez={idsDeLaUltimaVez?.medico ?? null}
            selectedMedico={selectedDoctor}
            onMedicoSelect={onDoctorSelect}
            onShowCreateMedico={onShowCreateMedico}
          />
        </div>

        {/* Insurance Selection */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <h3 className="text-base sm:text-lg font-semibold text-[#204983]">
              Obra Social {isAnonymousPatient && <span className="text-xs font-normal text-amber-700">(opcional - paciente anónimo)</span>}
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="sm:flex-grow">
              <ObraSocialCombobox
                obrasSociales={insurances}
                idDeLaUltimaVez={idsDeLaUltimaVez?.obraSocial ?? null}
                selectedObraSocial={selectedInsurance}
                onObraSocialSelect={onInsuranceSelect}
                onShowCreateObraSocial={onShowCreateObraSocial}
              />
            </div>
            {!isPrivateInsurance && selectedInsurance && (
              <div className="sm:w-1/3">
                <Input
                  placeholder="Número de afiliado *"
                  value={affiliateNumber}
                  onChange={(e) => onAffiliateNumberChange(e.target.value)}
                  className="h-10 w-full"
                  required
                />
              </div>
            )}
          </div>
          {selectedInsurance?.chooses_billing_entity && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label
                htmlFor="protocolo_billing_entity"
                className="block text-sm font-medium text-amber-900"
              >
                ¿Por dónde factura este paciente? *
              </label>
              <p className="mb-2 text-xs text-amber-800">
                {selectedInsurance.name} va por Centro o por Clínica según cómo se
                preautorizó. Se decide por paciente, no por obra social.
              </p>
              <BillingEntitySelect
                id="protocolo_billing_entity"
                value={billingEntityId}
                onValueChange={onBillingEntityChange}
                allowNone={false}
                placeholder="Elegir Centro o Clínica"
              />
            </div>
          )}

          {selectedInsurance && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
              <span>
                Valor UB O.S.: <strong className="text-[#204983]">${selectedInsurance.ub_value}</strong>
              </span>
              <span>
                Valor UB Particular: <strong className="text-[#204983]">${selectedInsurance.private_ub_value}</strong>
              </span>
            </div>
          )}
        </div>

        {/* MÉTODO DE ENVÍO: BOTONES, NO UN DESPLEGABLE
            ============================================
            Es obligatorio, son tres opciones y no cambia nunca de cantidad. Un
            desplegable esconde las tres detrás de un click y no muestra cuál
            está elegida hasta abrirlo — al lado de «Orden médica» y
            «Condiciones de la obra social», que sí se ven de un vistazo, era el
            único dato del formulario que había que ir a buscar.

            Se arma con lo que devuelve el servidor y no con una lista fija acá:
            los métodos son filas de `SendMethod` y un laboratorio puede tener
            otros. El ícono sale del nombre por `getSendMethodAction`, que es la
            misma función que usa el diálogo de informes para saber qué botón
            resaltar: si mañana se agrega uno que no reconoce, cae en el sobre
            genérico y sigue funcionando. */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Método de Envío</h3>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Label id="send-method-label" className="text-sm sm:text-base">
              ¿Cómo recibe el informe? *
            </Label>
            {sendMethods.length === 0 && (
              // La lista viene del servidor: mientras carga —o si falló— el
              // recuadro quedaría vacío y sin explicación. El desplegable que
              // había antes al menos mostraba su placeholder.
              <p className="mt-2 text-xs text-gray-500">Cargando los métodos de envío…</p>
            )}
            <div className="mt-2">
              <StatusButtonGroup
                labelId="send-method-label"
                options={sendMethods.map((method) => ({
                  value: method.id.toString(),
                  label: method.name,
                  description: method.description || "",
                  tone: "neutral" as const,
                  icon: iconoDelEnvio(method.name),
                }))}
                value={selectedSendMethod?.id.toString() ?? ""}
                onChange={(value) =>
                  onSendMethodSelect(sendMethods.find((m) => m.id.toString() === value) || null)
                }
              />
            </div>
          </div>
        </div>

        {shouldShowOrder && (
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
              <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Orden médica</h3>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Label id="trajo-orden-label" className="text-sm sm:text-base">
                Estado de la orden *
              </Label>
              <div className="mt-2">
                <StatusButtonGroup
                  labelId="trajo-orden-label"
                  options={TRAJO_ORDEN_OPTIONS}
                  value={trajoOrden}
                  onChange={onTrajoOrdenChange}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Todas las obras sociales requieren orden. Particular no la solicita.
              </p>
            </div>
          </div>
        )}

        {/* Acá queda lo que hay que DECIDIR antes de cargar los análisis. Lo que
            hay que COBRAR bajó al final, junto al coseguro. */}
        {shouldShowPreauth && (
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
              <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Condiciones de la obra social</h3>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
              <div className="space-y-2">
                <Label id="preauth-status-label" className="text-sm sm:text-base">
                  Estado de la preautorización *
                </Label>
                <StatusButtonGroup
                  labelId="preauth-status-label"
                  options={PREAUTH_OPTIONS}
                  value={preauthStatus === "not_required" ? "" : preauthStatus}
                  onChange={onPreauthStatusChange}
                />
                <p className="text-xs text-blue-800">
                  Marcá en la tabla qué análisis cubre la OOSS. Los no cubiertos se cobran particular y no vuelven
                  incompleta la preautorización.
                </p>
                {preauthStatus && (
                  <p className="text-xs text-gray-600">
                    {PREAUTH_OPTIONS.find((option) => option.value === preauthStatus)?.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analysis Search */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
            <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Búsqueda de Análisis</h3>
          </div>
          <AnalysisSearch selectedAnalyses={selectedAnalyses} onAnalysisChange={onAnalysisChange} />
        </div>

        {/* Analysis Table with Authorization */}
        <AnalysisTable
          selectedAnalyses={selectedAnalyses}
          onAnalysisChange={onAnalysisChange}
          selectedInsurance={selectedInsurance}
          isPrivateInsurance={isPrivateInsurance}
          forcePrivateAnalyses={shouldShowPreauth && preauthStatus === "no_trajo"}
          quoteById={quoteById}
        />

        {/* TODOS LOS COBROS DE LA OBRA SOCIAL VAN DESPUÉS DE LOS ANÁLISIS
            ==============================================================
            El coseguro ya estaba acá por una razón: el monto lo informa la obra
            social al autorizar, así que recién se sabe cuando está claro qué
            análisis autorizó y cuáles no. Pedirlo arriba era pedir un número
            que en ese momento nadie tiene.

            El material descartable y la derivación estaban arriba, mezclados
            con la preautorización. Son lo mismo que el coseguro —plata que se
            le suma al paciente— y se revisan en el mismo momento: cuando ya
            está la lista y se va a cobrar. Repartidos entre dos partes de la
            pantalla, el de arriba se completaba a ciegas o se olvidaba.

            Arriba queda lo que hay que DECIDIR para poder cargar; acá abajo,
            todo lo que hay que COBRAR. */}
        {(shouldChargeCoseguro || shouldChargeMaterial || shouldChargeDerivacion) && (
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#204983] sm:h-5 sm:w-5" />
              <h3 className="text-base font-semibold text-[#204983] sm:text-lg">
                Cobros de la obra social
              </h3>
            </div>
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
              {shouldChargeCoseguro && (
                <div className="space-y-1.5">
                  <Label htmlFor="coseguro-protocol">
                    Coseguro — monto informado por la obra social al autorizar
                  </Label>
                  <Input
                    id="coseguro-protocol"
                    type="number"
                    min="0"
                    step="0.01"
                    value={coseguroAmount}
                    onChange={(event) => onCoseguroChange(event.target.value)}
                    placeholder="0.00"
                    className="max-w-xs bg-white"
                  />
                  <p className="text-xs text-blue-800">
                    Se suma a lo que paga el paciente. Si todavía no lo sabés, dejalo
                    vacío y se carga después.
                  </p>
                </div>
              )}

              {(shouldChargeMaterial || shouldChargeDerivacion) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {shouldChargeMaterial && (
                    <div className="space-y-1.5">
                      <Label htmlFor="material-descartable-protocol">Material descartable</Label>
                      <Input
                        id="material-descartable-protocol"
                        type="number"
                        min="0"
                        step="0.01"
                        value={extraAmounts.material_descartable_amount}
                        onChange={(event) =>
                          onExtraAmountsChange({
                            ...extraAmounts,
                            material_descartable_amount: event.target.value,
                          })
                        }
                        className="bg-white"
                      />
                    </div>
                  )}
                  {shouldChargeDerivacion && (
                    <div className="space-y-1.5">
                      <Label htmlFor="derivacion-protocol">Derivación</Label>
                      <Input
                        id="derivacion-protocol"
                        type="number"
                        min="0"
                        step="0.01"
                        value={extraAmounts.derivacion_amount}
                        onChange={(event) =>
                          onExtraAmountsChange({
                            ...extraAmounts,
                            derivacion_amount: event.target.value,
                          })
                        }
                        className="bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cobros / pagos no contemplados */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
              <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Cobros / pagos no contemplados</h3>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addUnplanned} className="bg-transparent">
              <Plus className="mr-1 h-4 w-4" />
              Agregar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Cargos o pagos que no encajan en los conceptos estándar (envío, transferencia, etc.). Suman al balance del
            protocolo. No se facturan a ARCA.
          </p>
          {unplannedTransactions.length > 0 && (
            <div className="space-y-2">
              {unplannedTransactions.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 sm:grid-cols-[110px_minmax(0,1fr)_120px_auto] sm:items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={item.kind}
                      onValueChange={(v: "charge" | "payment") => updateUnplanned(index, { kind: v })}
                    >
                      <SelectTrigger className="bg-white h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="charge">Cobro</SelectItem>
                        <SelectItem value="payment">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateUnplanned(index, { description: e.target.value })}
                      placeholder="Ej: envío a domicilio"
                      className="bg-white h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => updateUnplanned(index, { amount: e.target.value })}
                      placeholder="0.00"
                      className="bg-white h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUnplanned(index)}
                    className="h-9 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedAnalyses.length > 0 && selectedInsurance && (
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-[#204983]" />
              <h3 className="text-base sm:text-lg font-semibold text-[#204983]">Resumen de Pago</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {/* Totals breakdown */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {!isPrivateInsurance && (
                  <>
                    <div className="text-gray-600">Subtotal Obra Social:</div>
                    <div className="text-right font-medium">
                      ${totals.authorizedTotal.toFixed(2)}
                      <span className="text-xs text-gray-500 ml-1">({totals.authorizedUb.toFixed(2)} UB)</span>
                    </div>
                  </>
                )}

                <div className="text-gray-600">Subtotal Particular:</div>
                <div className="text-right font-medium">
                  ${totals.privateTotal.toFixed(2)}
                  <span className="text-xs text-gray-500 ml-1">({totals.privateUb.toFixed(2)} UB)</span>
                </div>

                {/* SE MUESTRA PORQUE HAY QUE PODER EXPLICARLO EN EL MOSTRADOR.
                    Sin este renglón, el subtotal no cierra con la suma de los
                    análisis de arriba y parece un error de la pantalla. */}
                {totals.descuentoPorVolumen > 0 && (
                  <>
                    <div className="text-emerald-700">Descuento por análisis grande:</div>
                    <div className="text-right font-medium text-emerald-700">
                      −${totals.descuentoPorVolumen.toFixed(2)}
                    </div>
                  </>
                )}

                {totals.extrasTotal > 0 && (
                  <>
                    <div className="text-gray-600">Cobros extra:</div>
                    <div className="text-right font-medium">${totals.extrasTotal.toFixed(2)}</div>
                  </>
                )}

                <div className="text-gray-600 font-semibold border-t pt-2">Total:</div>
                <div className="text-right font-bold text-[#204983] border-t pt-2">${totals.total.toFixed(2)}</div>
              </div>

              {/* Patient owes section */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">El paciente debe pagar:</span>
                  <span className="text-lg font-bold text-orange-600">${totals.patientOwes.toFixed(2)}</span>
                </div>

                {/* CUÁNTO Y POR DÓNDE, JUNTOS.
                    Un campo por forma y no uno solo con un selector al lado: el
                    paciente que deja una parte en efectivo y transfiere el
                    resto es un caso de todos los días, y con un campo había que
                    elegir UNA forma para el total — la parte transferida
                    después no se podía cruzar contra el extracto de nadie. */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pagoEfectivo" className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                      Efectivo
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="pagoEfectivo"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={pagoEfectivo}
                        onChange={(e) => onPagoEfectivoChange(e.target.value)}
                        className="h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFillTotal}
                        className="h-10 px-3 whitespace-nowrap bg-transparent"
                        title="Completar en efectivo lo que falta"
                      >
                        Total
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pagoTransferencia" className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-sky-600" />
                      Transferencia
                    </Label>
                    <Input
                      id="pagoTransferencia"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={pagoTransferencia}
                      onChange={(e) => onPagoTransferenciaChange(e.target.value)}
                      className="h-10"
                    />

                    {/* La cuenta aparece recién cuando hay algo transferido:
                        antes es una pregunta sobre plata que no entró. */}
                    {porTransferencia > 0 && (
                      <div className="mt-2 space-y-1 sm:max-w-sm">
                        <Label htmlFor="cuentaDelPago" className="text-xs text-gray-600">
                          ¿A qué cuenta? *
                        </Label>
                        <SelectorDeCuenta
                          id="cuentaDelPago"
                          cuentaId={cuentaDeCobroId}
                          onCuentaChange={onCuentaDeCobroChange}
                        />
                        {faltaCuenta && (
                          <p className="text-xs text-red-600">
                            Sin la cuenta, esta transferencia no se puede conciliar.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <div>
                    <span className="text-xs text-gray-500 block">Pagado</span>
                    <span className="text-lg font-bold text-gray-800">${paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Restante</span>
                    <span className={`text-lg font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                      ${remaining.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
