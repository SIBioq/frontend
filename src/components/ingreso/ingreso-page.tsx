"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { FileText } from "lucide-react"
import { Button } from "../ui/button"
import { Skeleton } from "../ui/skeleton"
import { toast } from "sonner"
import { ProtocolForm } from "./components/protocol-form"
import { PatientInfo } from "./components/patient-info"
import { DoctorInfo, InsuranceInfo } from "./components/selection-info"
import { CreatePatientForm } from "./components/create-patient-form"
import { EditPatientDialog } from "./components/edit-patient-dialog"
import { CreateMedicoForm } from "./components/create-medico-form"
import { CreateObraSocialForm } from "./components/create-obra-social-form"
import { EditMedicoDialog } from "../configuration/components/edit-medico-dialog"
import { EditObraSocialDialog } from "../configuration/components/edit-obra-social-dialog"
import { ProtocolSuccess } from "./components/protocol-success"
import { useApi } from "../../hooks/use-api"
import { CATALOG_ENDPOINTS, MEDICAL_ENDPOINTS, PROTOCOL_ENDPOINTS, PATIENT_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type { TrajoOrdenStatus } from "@/lib/protocol-order"
import {
  ACTO_BIOQUIMICO_INTERNACION, esActoDeIngreso, mismoCodigo,
} from "@/lib/codigos-analisis"
import { useEndpointProgress } from "@/hooks/use-endpoint-progress"
import { menosMovimiento } from "@/lib/menos-movimiento"
import { cn } from "@/lib/utils"
import { useProtocolQuote } from "@/hooks/use-protocol-quote"
import { useLoDeLaUltimaVez } from "@/hooks/use-lo-de-la-ultima-vez"
import type {
  Analysis,
  Patient,
  Doctor,
  Insurance,
  SelectedAnalysis,
  SendMethod,
  CreateProtocolInput,
  PaginatedResponse,
  Protocol,
  PricingConfig,
  PreauthStatus,
  PagoInput,
  UnplannedTransactionInput,
  QuoteDetail,
} from "../../types"

/**
 * Cuánto se queda el botón lleno y verde antes de que arranque el resumen.
 *
 * Es el respiro que hace que se lea «terminó» y no «se colgó y apareció otra
 * pantalla». Más corto no se registra; más largo se siente como una demora.
 */
const MS_DEL_BOTON_LLENO = 420

/**
 * Cuánto tarda el verde en taparlo todo (lo que dura la transición del reveal
 * en `protocol-success`). Hasta que termine, el formulario NO se limpia.
 *
 * Si se limpiara antes, el botón verde —que es de donde sale el círculo— se
 * desmontaría en el mismo cuadro en que el círculo todavía mide cero: se ve el
 * formulario pelado un instante y después un punto verde creciendo de la nada.
 * Justo el corte que la animación viene a sacar.
 */
const MS_DEL_REVELADO = 750

const esperar = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms))

// Todo lo que hace falta para reconstruir el formulario si el usuario deshace
// un protocolo recién creado (botón "Deshacer" de la pantalla de éxito).
type FormSnapshot = {
  currentPatient: Patient | null
  searchedDni: string
  searchedSex: "M" | "F" | ""
  selectedAnalyses: SelectedAnalysis[]
  selectedDoctor: Doctor | null
  selectedInsurance: Insurance | null
  pagoEfectivo: string
  pagoTransferencia: string
  selectedSendMethod: SendMethod | null
  affiliateNumber: string
  billingEntityId: string
  cuentaDeCobroId: string
  trajoOrden: TrajoOrdenStatus | ""
  preauthStatus: PreauthStatus | ""
  extraAmounts: { material_descartable_amount: string; derivacion_amount: string }
  coseguroAmount: string
  unplannedTransactions: UnplannedTransactionInput[]
}

export default function IngresoPage() {
  const { apiRequest } = useApi()

  // Main states
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [patientNotFound, setPatientNotFound] = useState(false)
  const [searchedDni, setSearchedDni] = useState("")
  const [searchedSex, setSearchedSex] = useState<"M" | "F" | "">("")
  const [creatingAnonymous, setCreatingAnonymous] = useState(false)
  const [selectedAnalyses, setSelectedAnalyses] = useState<SelectedAnalysis[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedInsurance, setSelectedInsurance] = useState<Insurance | null>(null)
  const [showEditPatient, setShowEditPatient] = useState(false)
  const [showEditDoctor, setShowEditDoctor] = useState(false)
  const [showEditInsurance, setShowEditInsurance] = useState(false)
  // Lo que el paciente deja en mano y lo que transfiere, por separado: son
  // dos movimientos distintos y cada uno se concilia por su lado.
  const [pagoEfectivo, setPagoEfectivo] = useState("")
  const [pagoTransferencia, setPagoTransferencia] = useState("")
  const [selectedSendMethod, setSelectedSendMethod] = useState<SendMethod | null>(null)
  const [affiliateNumber, setAffiliateNumber] = useState("")
  // Solo se usa para las OOSS que facturan segun la preautorizacion
  // del paciente (`chooses_billing_entity`).
  const [billingEntityId, setBillingEntityId] = useState("")
  // Números de afiliado que ya se le conocen al paciente, por obra social.
  // Se piden al elegirlo y se ofrecen cuando elige la OOSS: la segunda vez que
  // viene la misma persona, el número ya está.
  const [afiliacionesConocidas, setAfiliacionesConocidas] = useState<
    Record<number, string>
  >({})
  const [cuentaDeCobroId, setCuentaDeCobroId] = useState("")
  const [trajoOrden, setTrajoOrden] = useState<TrajoOrdenStatus | "">("")
  const [preauthStatus, setPreauthStatus] = useState<PreauthStatus | "">("")
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null)
  const [extraAmounts, setExtraAmounts] = useState({
    material_descartable_amount: "",
    derivacion_amount: "",
  })
  const [coseguroAmount, setCoseguroAmount] = useState("")
  const [unplannedTransactions, setUnplannedTransactions] = useState<UnplannedTransactionInput[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [insurances, setInsurances] = useState<Insurance[]>([])
  const [sendMethods, setSendMethods] = useState<SendMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateMedico, setShowCreateMedico] = useState(false)
  const [showCreateObraSocial, setShowCreateObraSocial] = useState(false)
  // Cuántas veces se pidió crear. Va de `key` de los formularios: pedirlo con
  // el formulario ya abierto lo vuelve a montar, y montarlo es lo que lleva
  // la vista y el cursor hasta él (`useIrAlFormulario`).
  const [pedidosDeCrear, setPedidosDeCrear] = useState(0)
  const [successData, setSuccessData] = useState<{
    protocol: Protocol
    patient: Patient
    doctor: Doctor
    insurance: Insurance | null
    sendMethod: SendMethod
    // Foto del formulario tal como se envió: si el usuario deshace (rollback),
    // restauramos exactamente estos datos para que los edite.
    formSnapshot: FormSnapshot
  } | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const createProgress = useEndpointProgress()

  /**
   * EL BOTÓN ES LA BARRA DE PROGRESO, Y AL LLENARSE SE VUELVE LA PANTALLA
   * ====================================================================
   * `idle` → azul, con su texto.
   * `creando` → la barra se llena adentro del botón.
   * `completo` → llena del todo, verde y sin texto. Se queda así un momento
   *   —`MS_DEL_BOTON_LLENO`— antes de montar el resumen, que abre su verde
   *   desde el centro de este mismo botón. Sin esa pausa el botón pasa de
   *   celeste a tapado por el overlay en el mismo cuadro y no se llega a ver
   *   que terminó: la animación cuenta que el protocolo se creó, así que el
   *   final tiene que verse.
   *
   * Es estado propio y no `createProgress.isRunning` porque el hook se
   * reinicia solo a los 350 ms; el botón tiene que quedarse verde hasta que el
   * overlay lo tape.
   */
  const [faseDeCreacion, setFaseDeCreacion] = useState<"idle" | "creando" | "completo">("idle")
  const botonDeCrear = useRef<HTMLButtonElement>(null)
  /**
   * El formulario se limpia con retraso (ver `MS_DEL_REVELADO`) y deshacer
   * vuelve a llenarlo. Si alguien deshace antes de que corra esa limpieza, la
   * limpieza le borraría lo que deshacer acaba de devolver — y ahí no hay nada
   * que apretar para recuperarlo. La bandera la cancela.
   */
  const seDeshizoElProtocolo = useRef(false)
  const [origenDelVerde, setOrigenDelVerde] = useState<{ x: number; y: number } | null>(null)

  /**
   * Lo que este paciente usó la última vez, para subirlo en los combos.
   *
   * No elige nada: sólo cambia el ORDEN de las listas y le pone un cartel al
   * que estuvo. Ver `use-lo-de-la-ultima-vez`.
   */
  const loDeLaUltimaVez = useLoDeLaUltimaVez(currentPatient?.id, doctors, insurances)

  /**
   * Las listas de los combos, con la ficha de la última vez adentro.
   *
   * El ingreso arranca con los primeros 20 médicos y las primeras 20 obras
   * sociales. El de la última vez puede no estar entre esos —cuanto más grande
   * el catálogo, más probable— y sin la ficha no hay nada que poner arriba: el
   * hook la trae suelta y acá se suma a la lista.
   *
   * Se hace acá y no con `setDoctors` para no ensuciar el estado que usan el
   * alta y la edición: esto es una lista para MOSTRAR, no el catálogo cargado.
   */
  const doctorsConElDeLaUltimaVez = useMemo(
    () =>
      loDeLaUltimaVez.medicoFaltante
        ? [loDeLaUltimaVez.medicoFaltante, ...doctors]
        : doctors,
    [doctors, loDeLaUltimaVez.medicoFaltante],
  )
  const insurancesConLaDeLaUltimaVez = useMemo(
    () =>
      loDeLaUltimaVez.obraSocialFaltante
        ? [loDeLaUltimaVez.obraSocialFaltante, ...insurances]
        : insurances,
    [insurances, loDeLaUltimaVez.obraSocialFaltante],
  )
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    loadInitialData()
  }, [])

  // Si se entró desde "Nuevo protocolo" en la ficha de un paciente, viene el
  // paciente en el state: lo cargamos y enfocamos el siguiente campo (Médico).
  useEffect(() => {
    const preset = (location.state as { patient?: Patient } | null)?.patient
    if (!preset) return
    handlePatientFound(preset)
    navigate(location.pathname, { replace: true, state: null })
    const t = setTimeout(() => {
      document.querySelector<HTMLElement>("[data-medico-field] button")?.focus()
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const extractErrorMessage = (errorData: unknown): string => formatApiError(errorData)

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const [doctorsResponse, insurancesResponse, sendMethodsResponse, pricingResponse] = await Promise.all([
        apiRequest(`${MEDICAL_ENDPOINTS.DOCTORS}?limit=20&offset=0&is_active=true`),
        apiRequest(`${MEDICAL_ENDPOINTS.INSURANCES}?limit=20&offset=0&is_active=true`),
        apiRequest(PROTOCOL_ENDPOINTS.SEND_METHODS),
        apiRequest(CATALOG_ENDPOINTS.PRICING_CONFIG),
      ])

      if (doctorsResponse.ok) {
        const doctorsData: PaginatedResponse<Doctor> = await doctorsResponse.json()
        setDoctors(doctorsData.results)
      } else {
        const errorData = await doctorsResponse.json().catch(() => ({}))
        toast.error("Error al cargar médicos", { description: extractErrorMessage(errorData) })
      }

      if (insurancesResponse.ok) {
        const insurancesData: PaginatedResponse<Insurance> = await insurancesResponse.json()
        setInsurances(insurancesData.results)
      } else {
        const errorData = await insurancesResponse.json().catch(() => ({}))
        toast.error("Error al cargar obras sociales", { description: extractErrorMessage(errorData) })
      }

      if (sendMethodsResponse.ok) {
        const sendMethodsData: PaginatedResponse<SendMethod> = await sendMethodsResponse.json()
        setSendMethods(sendMethodsData.results)
      } else {
        const errorData = await sendMethodsResponse.json().catch(() => ({}))
        toast.error("Error al cargar métodos de envío", { description: extractErrorMessage(errorData) })
      }

      if (pricingResponse.ok) {
        const data: PricingConfig = await pricingResponse.json()
        setPricingConfig(data)
        setExtraAmounts({
          material_descartable_amount: data.material_descartable_amount || "0.00",
          derivacion_amount: data.derivacion_amount || "0.00",
        })
      }
    } catch (error) {
      console.error("Error loading initial data:", error)
      toast.error("Error al cargar los datos iniciales")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateTotals = () => {
    if (!selectedInsurance || selectedAnalyses.length === 0) {
      return { authorizedTotal: 0, privateTotal: 0, total: 0, patientOwes: 0, authorizedUb: 0, privateUb: 0, extrasTotal: 0, descuentoPorVolumen: 0 }
    }

    const insuranceUbValue = Number.parseFloat(selectedInsurance.ub_value) || 0
    const privateUbValue = selectedInsurance.private_ub_value || 0

    let authorizedUb = 0
    let privateUb = 0
    let privateTotal = 0

    if (quote) {
      // Montos del backend: nomenclador correcto por OOSS/particular.
      authorizedUb = Number.parseFloat(quote.total_ub_authorized) || 0
      privateUb = Number.parseFloat(quote.total_ub_private) || 0
      privateTotal = Number.parseFloat(quote.analyses_amount_due) || 0
    } else {
      // Fallback local mientras carga la cotización (puede diferir del real).
      selectedAnalyses.forEach((analysis) => {
        const ub = Number.parseFloat(analysis.bio_unit) || 0
        if (selectedInsurance?.name.toLowerCase() === "particular") {
          privateUb += ub
        } else if (shouldShowPreauth && preauthStatus === "no_trajo") {
          privateUb += ub
        } else if (analysis.is_authorized) {
          authorizedUb += ub
        } else {
          privateUb += ub
        }
      })
      privateTotal = privateUb * privateUbValue
    }

    const authorizedTotal = authorizedUb * insuranceUbValue
    const material = shouldChargeMaterial ? Number.parseFloat(extraAmounts.material_descartable_amount) || 0 : 0
    const derivacion = shouldChargeDerivacion ? Number.parseFloat(extraAmounts.derivacion_amount) || 0 : 0
    const coseguro = shouldChargeCoseguro ? Number.parseFloat(coseguroAmount) || 0 : 0
    const unplannedCharges = unplannedTransactions
      .filter((t) => t.kind === "charge")
      .reduce((acc, t) => acc + (Number.parseFloat(t.amount) || 0), 0)
    const unplannedPayments = unplannedTransactions
      .filter((t) => t.kind === "payment")
      .reduce((acc, t) => acc + (Number.parseFloat(t.amount) || 0), 0)
    const extrasTotal = material + derivacion + coseguro + unplannedCharges
    const total = authorizedTotal + privateTotal + extrasTotal
    const patientOwes = Math.max(0, privateTotal + extrasTotal - unplannedPayments)

    // Ya viene restado de `privateTotal`; se muestra aparte para que el
    // paciente vea por qué paga menos que la suma de los análisis.
    const descuentoPorVolumen = Number.parseFloat(quote?.descuento_por_volumen || "0") || 0

    return {
      authorizedTotal, privateTotal, total, patientOwes,
      authorizedUb, privateUb, extrasTotal, descuentoPorVolumen,
    }
  }

  const handleEditPatient = () => {
    setShowEditPatient(true)
  }

  const handlePatientUpdated = (updatedPatient: Patient) => {
    setCurrentPatient(updatedPatient)
    setShowEditPatient(false)
  }

  const handlePatientFound = (patient: Patient) => {
    setCurrentPatient(patient)
    setPatientNotFound(false)
    setSearchedDni("")
    setSearchedSex("")
  }

  const handlePatientNotFound = (dni: string, sex: "M" | "F") => {
    setCurrentPatient(null)
    setPatientNotFound(true)
    setSearchedDni(dni)
    setSearchedSex(sex)
  }

  const handlePatientCreated = (patient: Patient) => {
    setCurrentPatient(patient)
    setPatientNotFound(false)
    setSearchedDni("")
    setSearchedSex("")
    setCreatingAnonymous(false)
  }

  const handleCreateAnonymous = () => {
    setCurrentPatient(null)
    setSearchedDni("")
    setSearchedSex("")
    setPatientNotFound(true)
    setCreatingAnonymous(true)
  }

  // El recién creado es el que se quería elegir: queda elegido. El aviso de
  // "creado" lo da el formulario; repetirlo acá eran dos toasts iguales.
  const handleDoctorCreated = (doctor: Doctor) => {
    setDoctors([...doctors, doctor])
    setSelectedDoctor(doctor)
    setShowCreateMedico(false)
  }

  const handleInsuranceCreated = (insurance: Insurance) => {
    setInsurances([...insurances, insurance])
    // Por `handleInsuranceSelect` y no con el setter directo: elegirla tiene
    // que limpiar el afiliado, la entidad y los montos de la que estaba antes,
    // igual que cuando se elige del combo.
    handleInsuranceSelect(insurance)
    setShowCreateObraSocial(false)
  }

  useEffect(() => {
    const id = currentPatient?.id
    if (!id) {
      setAfiliacionesConocidas({})
      return
    }
    let vigente = true
    apiRequest(PATIENT_ENDPOINTS.PATIENT_AFILIACIONES(id))
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!vigente || !datos) return
        const porOoss: Record<number, string> = {}
        for (const fila of datos.afiliaciones || []) {
          porOoss[fila.insurance_id] = fila.affiliate_number
        }
        setAfiliacionesConocidas(porOoss)
      })
      .catch(() => {
        // Que no se sepa el número de antes no puede frenar una carga: se
        // escribe a mano, como siempre.
      })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id])

  /**
   * El ABI del paciente anónimo.
   *
   * Ningún acto bioquímico se agrega solo al elegir análisis: lo pone quien
   * atiende. La excepción es el anónimo, que casi siempre es un internado —el
   * botón que lo crea dice "ej: internado"—, así que el acto de internación
   * (661001) se carga al elegirlo y queda primero en la lista.
   *
   * `abiCargadoPara` dice para qué paciente ya se hizo, y hace dos cosas:
   * sacarlo de la tabla es definitivo —si este caso no lleva ABI, no vuelve a
   * aparecer— y una respuesta que llega tarde no se mete en la lista de otro
   * paciente. No se cancela con una bandera por corrida porque en `StrictMode`
   * el efecto corre dos veces: la primera pediría el acto y la segunda, ya
   * marcada, no volvería a pedirlo, y el ABI no aparecería nunca en desarrollo.
   */
  const abiCargadoPara = useRef<number | null>(null)

  useEffect(() => {
    const paciente = currentPatient
    if (!paciente?.is_anonymous) {
      // Sin un anónimo a la vista no hay nada cargado, y lo que venga en
      // camino ya no corresponde a este formulario.
      abiCargadoPara.current = null
      return
    }
    if (abiCargadoPara.current === paciente.id) return
    abiCargadoPara.current = paciente.id

    apiRequest(`${CATALOG_ENDPOINTS.ANALYSIS}?code=${ACTO_BIOQUIMICO_INTERNACION}&is_active=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: PaginatedResponse<Analysis> | null) => {
        if (!datos || abiCargadoPara.current !== paciente.id) return
        const acto = (datos.results || []).find((a) =>
          mismoCodigo(a.code, ACTO_BIOQUIMICO_INTERNACION),
        )
        if (!acto) return
        // Se mira si hay CUALQUIER acto y no solo el ABI. La primera práctica
        // suma el acto común por su cuenta, y si llegó antes que esto —el
        // pedido al catálogo tarda lo que tarda— el protocolo terminaría con
        // los dos. Uno solo, y quien atiende cambia el que no corresponda.
        setSelectedAnalyses((previos) =>
          previos.some((a) => esActoDeIngreso(a.code))
            ? previos
            : [{ ...acto, is_authorized: false }, ...previos],
        )
      })
      .catch(() => {
        // Si el catálogo no contesta, el acto se busca a mano como cualquier
        // otro análisis. No puede frenar la carga del protocolo.
        abiCargadoPara.current = null
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id, currentPatient?.is_anonymous])

  const handleInsuranceSelect = (insurance: Insurance | null) => {
    setSelectedInsurance(insurance)
    // Se propone el que ya usó en esta obra social, si hay. Es una sugerencia:
    // el campo queda editable, porque el que vale es el del carnet que la
    // persona trae hoy.
    setAffiliateNumber(
      (insurance && afiliacionesConocidas[insurance.id]) || "",
    )
    setBillingEntityId("")
    setCuentaDeCobroId("")
    setTrajoOrden("")
    setPreauthStatus("")
    setExtraAmounts({
      material_descartable_amount: pricingConfig?.material_descartable_amount || "0.00",
      derivacion_amount: pricingConfig?.derivacion_amount || "0.00",
    })
    setCoseguroAmount("")
  }

  const handleReset = () => {
    setCurrentPatient(null)
    setPatientNotFound(false)
    setSearchedDni("")
    setSearchedSex("")
    setCreatingAnonymous(false)
    setSelectedAnalyses([])
    setSelectedDoctor(null)
    setSelectedInsurance(null)
    setShowCreateMedico(false)
    setShowCreateObraSocial(false)
    setPagoEfectivo("")
    setPagoTransferencia("")
    setSelectedSendMethod(null)
    setAffiliateNumber("")
    setBillingEntityId("")
    setTrajoOrden("")
    setPreauthStatus("")
    setExtraAmounts({
      material_descartable_amount: pricingConfig?.material_descartable_amount || "0.00",
      derivacion_amount: pricingConfig?.derivacion_amount || "0.00",
    })
    setCoseguroAmount("")
    setUnplannedTransactions([])
  }

  // Deshace un protocolo recién creado desde la pantalla de éxito: pide al
  // backend el rollback (borrado físico) y restaura el formulario con los datos
  // que se habían cargado, para que el usuario los corrija y vuelva a crearlo.
  const handleRollbackAndEdit = async () => {
    if (!successData) return
    setIsRollingBack(true)
    try {
      const response = await apiRequest(PROTOCOL_ENDPOINTS.ROLLBACK(successData.protocol.id), {
        method: "POST",
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast.error("No se pudo deshacer el protocolo", {
          description: formatApiError(errorData, "El protocolo no se pudo deshacer."),
        })
        return
      }

      seDeshizoElProtocolo.current = true
      const s = successData.formSnapshot
      // La lista vuelve tal como estaba, con o sin ABI: si el usuario lo había
      // sacado, que el efecto del anónimo no se lo devuelva.
      abiCargadoPara.current = s.currentPatient?.id ?? null
      setCurrentPatient(s.currentPatient)
      setPatientNotFound(false)
      setSearchedDni(s.searchedDni)
      setSearchedSex(s.searchedSex)
      setCreatingAnonymous(false)
      setSelectedAnalyses(s.selectedAnalyses)
      setSelectedDoctor(s.selectedDoctor)
      setSelectedInsurance(s.selectedInsurance)
      setPagoEfectivo(s.pagoEfectivo)
      setPagoTransferencia(s.pagoTransferencia)
      setSelectedSendMethod(s.selectedSendMethod)
      setAffiliateNumber(s.affiliateNumber)
      setBillingEntityId(s.billingEntityId)
      setCuentaDeCobroId(s.cuentaDeCobroId)
      setTrajoOrden(s.trajoOrden)
      setPreauthStatus(s.preauthStatus)
      setExtraAmounts(s.extraAmounts)
      setCoseguroAmount(s.coseguroAmount)
      setUnplannedTransactions(s.unplannedTransactions)

      setSuccessData(null)
      toast.success("Protocolo deshecho", {
        description: "Cargamos de nuevo los datos para que los modifiques y lo vuelvas a crear.",
      })
    } catch (error) {
      toast.error("No se pudo deshacer el protocolo", {
        description: getErrorMessage(error, "No se pudo completar la operación."),
      })
    } finally {
      setIsRollingBack(false)
    }
  }

  const isPrivateInsurance = selectedInsurance?.name.toLowerCase() === "particular"
  const isAnonymousPatient = Boolean(currentPatient?.is_anonymous)
  const treatAsPrivate = isPrivateInsurance || (isAnonymousPatient && !selectedInsurance)
  const hasDerivationAnalysis = selectedAnalyses.some((analysis) => Boolean(analysis.requires_derivacion))
  const shouldShowOrder = Boolean(selectedInsurance && !isPrivateInsurance)
  const shouldShowPreauth = Boolean(selectedInsurance && !isPrivateInsurance && selectedInsurance.requires_preauthorization)
  const shouldChargeMaterial = Boolean(selectedInsurance && selectedInsurance.charges_material_descartable)
  const shouldChargeDerivacion = Boolean(
    selectedInsurance && selectedInsurance.charges_derivacion && hasDerivationAnalysis,
  )
  const shouldChargeCoseguro = Boolean(
    selectedInsurance && !isPrivateInsurance && selectedInsurance.charges_coseguro,
  )

  // Cotización en el backend: garantiza que el monto del particular use el
  // nomenclador correcto (2024), en vez del `bio_unit` único del catálogo.
  const quoteDetails = useMemo(
    () =>
      selectedAnalyses.map((a) => ({
        analysis_id: a.id,
        is_authorized: treatAsPrivate ? false : a.is_authorized,
      })),
    [selectedAnalyses, treatAsPrivate],
  )
  const { quote } = useProtocolQuote(
    selectedInsurance?.id ?? null,
    quoteDetails,
    shouldShowPreauth ? preauthStatus || undefined : undefined,
  )
  const quoteById = useMemo(() => {
    const map: Record<number, QuoteDetail> = {}
    quote?.details.forEach((d) => {
      map[d.analysis_id] = d
    })
    return map
  }, [quote])

  const handleDoctorUpdated = async () => {
    if (!selectedDoctor) return

    try {
      const response = await apiRequest(MEDICAL_ENDPOINTS.DOCTOR_DETAIL(selectedDoctor.id))
      if (!response.ok) {
        toast.error("No se pudo actualizar la vista del médico")
        setShowEditDoctor(false)
        return
      }
      const updatedDoctor: Doctor = await response.json()
      setSelectedDoctor(updatedDoctor)
      setDoctors((prev) => prev.map((doctor) => (doctor.id === updatedDoctor.id ? updatedDoctor : doctor)))
    } catch (error) {
      console.error("Error refreshing doctor:", error)
      toast.error("No se pudo actualizar la vista del médico")
    } finally {
      setShowEditDoctor(false)
    }
  }

  const handleInsuranceUpdated = async () => {
    if (!selectedInsurance) return

    try {
      const response = await apiRequest(MEDICAL_ENDPOINTS.INSURANCE_DETAIL(selectedInsurance.id))
      if (!response.ok) {
        toast.error("No se pudo actualizar la vista de la obra social")
        setShowEditInsurance(false)
        return
      }
      const updatedInsurance: Insurance = await response.json()
      setSelectedInsurance(updatedInsurance)
      setInsurances((prev) =>
        prev.map((insurance) => (insurance.id === updatedInsurance.id ? updatedInsurance : insurance)),
      )
    } catch (error) {
      console.error("Error refreshing insurance:", error)
      toast.error("No se pudo actualizar la vista de la obra social")
    } finally {
      setShowEditInsurance(false)
    }
  }

  const handleCreateProtocol = async () => {
    const missing: string[] = []
    if (!currentPatient) missing.push("paciente")
    if (!selectedDoctor) missing.push("médico")
    if (!isAnonymousPatient && !selectedInsurance) missing.push("obra social")
    if (selectedAnalyses.length === 0) missing.push("al menos un análisis")
    if (!selectedSendMethod) missing.push("método de envío")
    if (selectedInsurance && !isPrivateInsurance && !affiliateNumber.trim()) missing.push("número de afiliado")
    if (selectedInsurance?.chooses_billing_entity && !billingEntityId) {
      missing.push("por dónde factura (Centro o Clínica)")
    }
    // Una transferencia sin cuenta no se puede cruzar contra ningún extracto.
    if ((Number.parseFloat(pagoTransferencia) || 0) > 0 && !cuentaDeCobroId) {
      missing.push("a qué cuenta fue la transferencia")
    }
    if (shouldShowOrder && !trajoOrden) missing.push("estado de la orden médica")
    if (shouldShowPreauth && !preauthStatus) missing.push("estado de la preautorización")

    if (missing.length > 0) {
      toast.error("Faltan datos para crear el protocolo", {
        description: `Completá: ${missing.join(", ")}.`,
      })
      return
    }

    if (!currentPatient || !selectedDoctor || !selectedSendMethod) {
      return
    }

    // Regla del médico "N/A": si la OOSS no es Particular, hubo una orden y por
    // lo tanto un médico real; no puede quedar en 'N/A'. (El backend también lo
    // valida, pero acá lo avisamos antes de mandar.)
    if (
      selectedInsurance &&
      !isPrivateInsurance &&
      (selectedDoctor.license || "").trim().toLowerCase() === "n/a"
    ) {
      toast.error("Cargá el médico que hizo la orden", {
        description: "La obra social no es Particular, así que el médico no puede quedar en 'N/A'.",
      })
      return
    }

    const patientForSuccess = currentPatient
    const doctorForSuccess = selectedDoctor
    const insuranceForSuccess = selectedInsurance
    const sendMethodForSuccess = selectedSendMethod

    try {
      createProgress.start()
      setFaseDeCreacion("creando")
      seDeshizoElProtocolo.current = false
      const enEfectivo = Number.parseFloat(pagoEfectivo) || 0
      const porTransferencia = Number.parseFloat(pagoTransferencia) || 0
      const totalValuePaid = enEfectivo + porTransferencia

      // UN PAGO POR FORMA.
      //
      // El backend saca `value_paid` de la suma de estos, así que el total que
      // se manda es informativo. Van solo los que tienen monto: un pago de cero
      // no es un pago, y guardarlo llenaría el libro de filas vacías.
      const pagosInput: PagoInput[] = []
      if (enEfectivo > 0) {
        pagosInput.push({ amount: enEfectivo.toFixed(2), payment_method: "efectivo" })
      }
      if (porTransferencia > 0) {
        pagosInput.push({
          amount: porTransferencia.toFixed(2),
          payment_method: "transferencia",
          payment_account: Number(cuentaDeCobroId),
        })
      }

      const protocolData: CreateProtocolInput = {
        patient: currentPatient.id,
        doctor: selectedDoctor.id,
        send_method: selectedSendMethod.id,
        value_paid: totalValuePaid.toFixed(2),
        details: selectedAnalyses.map((analysis) => ({
          analysis: analysis.id,
          is_authorized: treatAsPrivate || preauthStatus === "no_trajo" ? false : analysis.is_authorized,
        })),
      }

      if (shouldShowOrder && trajoOrden) {
        protocolData.trajo_orden = trajoOrden
      }

      if (shouldShowPreauth && preauthStatus) {
        protocolData.preauth_status = preauthStatus
      }

      if (shouldChargeMaterial) {
        protocolData.material_descartable_amount_override = (Number.parseFloat(extraAmounts.material_descartable_amount) || 0).toFixed(2)
      }

      if (shouldChargeDerivacion) {
        protocolData.derivacion_amount_override = (Number.parseFloat(extraAmounts.derivacion_amount) || 0).toFixed(2)
      }

      // Si hay OOSS seleccionada se manda; si es anónimo sin OOSS, el backend asigna Particular
      if (selectedInsurance) {
        protocolData.insurance = selectedInsurance.id
      }

      if (selectedInsurance && !isPrivateInsurance && affiliateNumber.trim()) {
        protocolData.affiliate_number = affiliateNumber.trim()
      }

      if (selectedInsurance?.chooses_billing_entity && billingEntityId) {
        protocolData.billing_entity = Number(billingEntityId)
      }

      if (pagosInput.length > 0) {
        protocolData.pagos_input = pagosInput
      }

      const cleanedUnplanned = unplannedTransactions
        .map((t) => ({
          kind: t.kind,
          description: t.description.trim(),
          amount: (Number.parseFloat(t.amount) || 0).toFixed(2),
        }))
        .filter((t) => t.description !== "" && Number.parseFloat(t.amount) > 0)
      if (cleanedUnplanned.length > 0) {
        protocolData.unplanned_transactions_input = cleanedUnplanned
      }

      const protocolResponse = await apiRequest(PROTOCOL_ENDPOINTS.PROTOCOLS, {
        method: "POST",
        body: protocolData,
      })

      if (!protocolResponse.ok) {
        const errorData = await protocolResponse.json()
        console.error("Protocol creation error:", errorData)
        toast.error("Error al crear el protocolo", { description: extractErrorMessage(errorData) })
        createProgress.finish()
        setFaseDeCreacion("idle")
        return
      }

      const newProtocol = await protocolResponse.json()

      // Coseguro: monto opcional que da la OOSS. Se carga via endpoint dedicado.
      const coseguroValue = Number.parseFloat(coseguroAmount) || 0
      if (shouldChargeCoseguro && coseguroValue > 0) {
        try {
          const coseguroRes = await apiRequest(PROTOCOL_ENDPOINTS.SET_COSEGURO(newProtocol.id), {
            method: "POST",
            body: { amount: coseguroValue.toFixed(2) },
          })
          if (!coseguroRes.ok) {
            const errorData = await coseguroRes.json().catch(() => ({}))
            toast.warning("Protocolo creado, pero falló el coseguro", {
              description: extractErrorMessage(errorData),
            })
          }
        } catch (err) {
          toast.warning("Protocolo creado, pero falló el coseguro", {
            description: getErrorMessage(err, "Error al guardar coseguro"),
          })
        }
      }

      // La barra llega al final y el botón se pone verde. Se guarda dónde está
      // ANTES de resetear el formulario: `handleReset` lo desmonta (deja de
      // haber paciente) y después ya no hay rectángulo del que salir.
      createProgress.finish()
      setFaseDeCreacion("completo")
      const rect = botonDeCrear.current?.getBoundingClientRect()
      setOrigenDelVerde(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null)

      await esperar(menosMovimiento() ? 0 : MS_DEL_BOTON_LLENO)

      setSuccessData({
        protocol: newProtocol,
        patient: patientForSuccess,
        doctor: doctorForSuccess,
        insurance: insuranceForSuccess,
        sendMethod: sendMethodForSuccess,
        formSnapshot: {
          currentPatient,
          searchedDni,
          searchedSex,
          selectedAnalyses,
          selectedDoctor,
          selectedInsurance,
          pagoEfectivo,
          pagoTransferencia,
          selectedSendMethod,
          affiliateNumber,
          billingEntityId,
          cuentaDeCobroId,
          trajoOrden,
          preauthStatus,
          extraAmounts,
          coseguroAmount,
          unplannedTransactions,
        },
      })
      toast.success("Protocolo creado exitosamente")

      await esperar(menosMovimiento() ? 0 : MS_DEL_REVELADO)
      setFaseDeCreacion("idle")
      if (!seDeshizoElProtocolo.current) handleReset()
    } catch (error) {
      console.error("Error creating protocol:", error)
      toast.error("Error al crear el protocolo", { description: getErrorMessage(error, "No se pudo completar la operación.") })
      createProgress.finish()
      setFaseDeCreacion("idle")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full py-2 sm:py-4 lg:py-6">
        <div className="w-full">
          {/* Header skeleton */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6 lg:mb-8">
            <div className="text-center">
              <Skeleton className="h-10 w-64 rounded mx-auto mb-3" />
              <Skeleton className="h-5 w-96 rounded mx-auto" />
            </div>
          </div>

          {/* Form and sidebar skeleton */}
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 justify-center">
            <div className="w-full lg:flex-1 lg:max-w-2xl">
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
            <div className="w-full lg:w-96 lg:flex-shrink-0">
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
          </div>

          {/* Button skeleton */}
          <div className="mt-4 sm:mt-6 flex justify-center px-2 sm:px-0">
            <Skeleton className="h-12 sm:h-14 lg:h-16 w-full max-w-4xl rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  const showRightPanel =
    currentPatient ||
    patientNotFound ||
    selectedDoctor ||
    selectedInsurance ||
    showCreateMedico ||
    showCreateObraSocial
  const isFormValid =
    currentPatient &&
    selectedDoctor &&
    (isAnonymousPatient || selectedInsurance) &&
    selectedAnalyses.length > 0 &&
    selectedSendMethod &&
    (treatAsPrivate || !selectedInsurance || affiliateNumber.trim()) &&
    (!selectedInsurance?.chooses_billing_entity || billingEntityId) &&
    (!shouldShowOrder || trajoOrden) &&
    (!shouldShowPreauth || preauthStatus)

  return (
    <div className="w-full py-4">
      <div className="rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-sm md:p-6">
        <div className="mb-4 flex items-center justify-center gap-2">
          <FileText className="h-6 w-6 text-[#204983]" />
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Ingreso de Protocolos</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 justify-center">
          <div
            className={`
              w-full transition-all duration-500 ease-in-out
              ${showRightPanel ? "lg:flex-1 lg:max-w-2xl" : "lg:max-w-4xl mx-auto"}
            `}
          >
            <ProtocolForm
              patient={currentPatient}
              doctors={doctorsConElDeLaUltimaVez}
              insurances={insurancesConLaDeLaUltimaVez}
              idsDeLaUltimaVez={{
                medico: loDeLaUltimaVez.medico,
                obraSocial: loDeLaUltimaVez.obraSocial,
              }}
              sendMethods={sendMethods}
              selectedAnalyses={selectedAnalyses}
              selectedDoctor={selectedDoctor}
              selectedInsurance={selectedInsurance}
              selectedSendMethod={selectedSendMethod}
              pagoEfectivo={pagoEfectivo}
              pagoTransferencia={pagoTransferencia}
              affiliateNumber={affiliateNumber}
              billingEntityId={billingEntityId}
              cuentaDeCobroId={cuentaDeCobroId}
              trajoOrden={trajoOrden}
              preauthStatus={preauthStatus}
              isPrivateInsurance={treatAsPrivate}
              shouldShowOrder={shouldShowOrder}
              shouldShowPreauth={shouldShowPreauth}
              shouldChargeMaterial={shouldChargeMaterial}
              shouldChargeDerivacion={shouldChargeDerivacion}
              shouldChargeCoseguro={shouldChargeCoseguro}
              extraAmounts={extraAmounts}
              coseguroAmount={coseguroAmount}
              unplannedTransactions={unplannedTransactions}
              totals={calculateTotals()}
              quoteById={quoteById}
              onAnalysisChange={setSelectedAnalyses}
              onDoctorSelect={setSelectedDoctor}
              onInsuranceSelect={handleInsuranceSelect}
              onSendMethodSelect={setSelectedSendMethod}
              onPatientFound={handlePatientFound}
              onPatientNotFound={handlePatientNotFound}
              onCreateAnonymous={handleCreateAnonymous}
              onReset={handleReset}
              onShowCreateMedico={() => {
                setShowCreateMedico(true)
                setPedidosDeCrear((n) => n + 1)
              }}
              onShowCreateObraSocial={() => {
                setShowCreateObraSocial(true)
                setPedidosDeCrear((n) => n + 1)
              }}
              onPagoEfectivoChange={setPagoEfectivo}
              onPagoTransferenciaChange={setPagoTransferencia}
              onAffiliateNumberChange={setAffiliateNumber}
              onBillingEntityChange={setBillingEntityId}
              onCuentaDeCobroChange={setCuentaDeCobroId}
              onTrajoOrdenChange={setTrajoOrden}
              onPreauthStatusChange={setPreauthStatus}
              onExtraAmountsChange={setExtraAmounts}
              onCoseguroChange={setCoseguroAmount}
              onUnplannedTransactionsChange={setUnplannedTransactions}
            />
          </div>

          <div
            className={`
              w-full transition-all duration-500 ease-in-out
              ${
                showRightPanel
                  ? "lg:w-96 lg:flex-shrink-0 opacity-100 transform translate-x-0"
                  : "lg:w-0 lg:opacity-0 lg:transform lg:translate-x-full lg:overflow-hidden"
              }
            `}
          >
            <div className="space-y-4">
              {currentPatient && <PatientInfo patient={currentPatient} onEdit={handleEditPatient} />}
              {selectedDoctor && <DoctorInfo doctor={selectedDoctor} onEdit={() => setShowEditDoctor(true)} />}
              {selectedInsurance && (
                <InsuranceInfo insurance={selectedInsurance} onEdit={() => setShowEditInsurance(true)} />
              )}

              {patientNotFound && (
                <CreatePatientForm
                  initialDni={searchedDni}
                  initialSex={searchedSex}
                  defaultAnonymous={creatingAnonymous}
                  onPatientCreated={handlePatientCreated}
                  onCancel={() => {
                    setPatientNotFound(false)
                    setCreatingAnonymous(false)
                  }}
                />
              )}

              {showCreateMedico && (
                <CreateMedicoForm
                  key={pedidosDeCrear}
                  onMedicoCreated={handleDoctorCreated}
                  onCancel={() => setShowCreateMedico(false)}
                />
              )}

              {showCreateObraSocial && (
                <CreateObraSocialForm
                  key={pedidosDeCrear}
                  onObraSocialCreated={handleInsuranceCreated}
                  onCancel={() => setShowCreateObraSocial(false)}
                />
              )}
            </div>
          </div>
        </div>

        {currentPatient && (
          <div className="mt-4 sm:mt-6 flex justify-center px-2 sm:px-0">
            <div
              className={`
                w-full transition-all duration-500 ease-in-out
                ${showRightPanel ? "max-w-full lg:max-w-4xl" : "max-w-full lg:max-w-4xl"}
              `}
            >
              <Button
                ref={botonDeCrear}
                onClick={handleCreateProtocol}
                disabled={!currentPatient || faseDeCreacion !== "idle"}
                aria-busy={faseDeCreacion === "creando"}
                className={cn(
                  "w-full h-12 sm:h-14 lg:h-16 text-white text-base sm:text-lg font-semibold",
                  // Mientras crea el botón queda deshabilitado, pero NO apagado:
                  // es la barra de progreso, y una barra al 50% de opacidad no
                  // se lee. Deshabilitado acá sólo puede querer decir "está en
                  // curso" — sin paciente este bloque ni se renderiza.
                  "disabled:opacity-100 disabled:cursor-default",
                  "relative overflow-hidden transition-colors duration-300",
                  faseDeCreacion === "completo"
                    ? "bg-green-500 hover:bg-green-500"
                    : faseDeCreacion === "creando"
                      // Azul aclarado y no gris: el texto del botón es blanco y
                      // viaja por encima de la parte llena Y de la vacía, así
                      // que las dos tienen que contrastar contra blanco. Sobre
                      // el gris que había antes, "Creando protocolo..." casi no
                      // se leía.
                      ? "bg-[#3d6296] hover:bg-[#3d6296]"
                      : "bg-[#204983] hover:bg-[#2d5a9b]",
                )}
              >
                {/* Lo que se llena. Al terminar se pone verde y queda al 100%:
                    de ahí sale el verde que después ocupa toda la pantalla. */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 ease-out",
                    // Mientras avanza, la transición tiene que ser MÁS CORTA que
                    // el cuadro que la mueve: el ancho lo reescribe un
                    // `requestAnimationFrame` cada ~16 ms, y una transición
                    // larga sobre eso deja la barra corriendo atrás del valor
                    // real. Al llenarse ya no hay quien la mueva, así que ahí sí
                    // conviene larga: es el salto al 100 y el pase a verde.
                    faseDeCreacion === "completo"
                      ? "bg-green-500 transition-[width,background-color] duration-300"
                      : "bg-[#204983] transition-[width] duration-150",
                  )}
                  style={{ width: `${faseDeCreacion === "completo" ? 100 : createProgress.progress}%` }}
                />

                {/* El texto se va cuando el botón se llena: el verde solo dice
                    lo mismo y sin ruido. */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center transition-opacity duration-200",
                    faseDeCreacion === "completo" ? "opacity-0" : "opacity-100",
                  )}
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="text-sm sm:text-base lg:text-lg">
                    {faseDeCreacion === "creando" ? "Creando protocolo..." : isFormValid ? "Crear Protocolo" : "Revisar y crear protocolo"}
                  </span>
                </div>
              </Button>
            </div>
          </div>
        )}

        <EditPatientDialog
          isOpen={showEditPatient}
          onClose={() => setShowEditPatient(false)}
          patient={currentPatient}
          onPatientUpdated={handlePatientUpdated}
        />

        {selectedDoctor && (
          <EditMedicoDialog
            isOpen={showEditDoctor}
            medico={selectedDoctor}
            onClose={() => setShowEditDoctor(false)}
            onSuccess={handleDoctorUpdated}
          />
        )}

        {selectedInsurance && (
          <EditObraSocialDialog
            open={showEditInsurance}
            onOpenChange={setShowEditInsurance}
            obraSocial={selectedInsurance}
            onSuccess={handleInsuranceUpdated}
          />
        )}

        {successData && (
          <ProtocolSuccess
            protocol={successData.protocol}
            patient={successData.patient}
            doctor={successData.doctor}
            insurance={successData.insurance}
            sendMethod={successData.sendMethod}
            onClose={() => setSuccessData(null)}
            onRollback={handleRollbackAndEdit}
            isRollingBack={isRollingBack}
            origen={origenDelVerde}
          />
        )}
      </div>
    </div>
  )
}
