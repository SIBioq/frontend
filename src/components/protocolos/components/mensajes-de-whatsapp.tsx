"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  PhoneForwarded,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { REPORTING_ENDPOINTS } from "@/config/api"
import { useApi } from "@/hooks/use-api"
import { cn } from "@/lib/utils"

/**
 * La conversación de WhatsApp con el paciente, como un chat.
 *
 * POR QUÉ UN CHAT Y NO UNA LISTA DE ENVÍOS
 * ========================================
 * El número por el que salen los informes es un WhatsApp como cualquier otro, y
 * el paciente le contesta. A veces para avisar algo; muy seguido por error,
 * creyendo que le escribe al laboratorio y escribiéndole a una automatización
 * que no lee a nadie. Eso quedaba en el log del servidor, o sea en ningún lado.
 *
 * Puesto como chat se entiende sin explicación: lo que mandamos a la derecha,
 * lo que contestó a la izquierda, y los tildes de siempre diciendo si llegó.
 * Cualquiera que use WhatsApp ya sabe leer esta pantalla.
 *
 * ACÁ NO SE ESCRIBE
 * =================
 * Es para MIRAR. No hay campo de texto y no lo va a haber: contestar de verdad
 * desde acá es otra decisión, y media respuesta automática a alguien que
 * escribió "me dio mal el análisis" es peor que no contestar. Lo único que sale
 * solo es el aviso de que este número no atiende y a cuál escribir.
 *
 * Y ESO TIENE QUE DECIRLO LA PANTALLA
 * ===================================
 * Un chat sin campo de texto se lee como un chat roto. El cartel de abajo está
 * para que quien lo abre sepa que no falta nada: que no se escribe es la
 * decisión, no una función a medio hacer.
 *
 * POR QUÉ NO ALCANZABA CON "SE ENVIÓ"
 * ===================================
 * Mandar un informe termina cuando Meta contesta «lo recibí», y eso no es que
 * haya llegado: un mensaje aceptado puede fallar después —número que no tiene
 * WhatsApp, usuario que bloqueó, template rechazado—. Los tildes son eso, y el
 * globo en rojo con el motivo es el caso que antes no veía nadie.
 *
 * Y COMO NO SE MANDA TODO JUNTO, CADA ENVÍO DICE QUÉ LLEVÓ
 * ========================================================
 * Un protocolo se manda por partes: sale lo que está listo y el resto va
 * cuando se carga. Lo que hay que poder contestar en el mostrador es «¿le llegó
 * la glucemia?».
 */

type AnalisisDelMensaje = { analysis_id: number | null; code: string; name: string }

type Mensaje = {
  id: number
  wamid: string
  to_phone: string
  direction: "saliente" | "entrante"
  kind: string
  status: string
  status_display: string
  error_code: string
  error_message: string
  body: string
  media_type: string
  sent_at: string
  protocol_id: number | null
  del_unificado: boolean
  es_de_este_protocolo: boolean
  /** Salió a un número elegido al mandarlo, no al del paciente. */
  a_otro_numero?: boolean
  analyses: AnalisisDelMensaje[]
}

type Respuesta = {
  telefono: string
  paciente: string
  messages: Mensaje[]
  pendientes: AnalisisDelMensaje[]
}

/** Cada cuánto se vuelve a preguntar mientras la pantalla está abierta. Lo que
 *  se está esperando —que Meta confirme la entrega, o que el paciente
 *  conteste— llega en segundos, no en horas. */
const CADA_CUANTO_MS = 20_000

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

const diaDe = (iso: string) => new Date(iso).toDateString()

function tituloDelDia(iso: string) {
  const fecha = new Date(iso)
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)

  if (fecha.toDateString() === hoy.toDateString()) return "Hoy"
  if (fecha.toDateString() === ayer.toDateString()) return "Ayer"
  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
}

/**
 * Los tildes de WhatsApp, con el mismo significado que allá.
 *
 * Es la parte que no hay que reinventar: el reloj, un tilde, dos tildes, dos
 * tildes azules. Quien atiende el mostrador ya sabe qué quiere decir cada uno
 * sin que nadie se lo explique, y cualquier símbolo propio sería una cosa menos
 * que se entiende sola.
 */
function Tildes({ mensaje }: { mensaje: Mensaje }) {
  if (mensaje.status === "fallado") {
    return <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-label="No llegó" />
  }
  if (mensaje.status === "leido") {
    return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="Leído" />
  }
  if (mensaje.status === "entregado") {
    return <CheckCheck className="h-3.5 w-3.5 text-gray-400" aria-label="Entregado" />
  }
  if (mensaje.status === "enviado") {
    return <Check className="h-3.5 w-3.5 text-gray-400" aria-label="Enviado" />
  }
  // `aceptado`: Meta lo tomó y todavía no salió. El reloj es exactamente eso.
  return <Clock className="h-3.5 w-3.5 text-gray-400" aria-label="Pendiente de envío" />
}

function SeparadorDeDia({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 shadow-sm">
        {tituloDelDia(iso)}
      </span>
    </div>
  )
}

function Globo({ mensaje }: { mensaje: Mensaje }) {
  const esNuestro = mensaje.direction === "saliente"
  const fallo = mensaje.status === "fallado"
  const esAviso = mensaje.kind === "aviso_automatico"
  const esInforme = esNuestro && !esAviso

  return (
    <div className={cn("flex", esNuestro ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // `max-w-[85%]`: un globo que ocupa todo el ancho deja de leerse como
          // un globo. En un teléfono es lo que hace que se note de qué lado es.
          "max-w-[85%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[75%]",
          fallo
            ? "border border-red-200 bg-red-50"
            : esNuestro
              ? "bg-[#d9fdd3]"
              : "border border-gray-200 bg-white",
          // Los informes de OTRAS veces que vino el paciente se ven —son parte
          // de la conversación— pero apagados, para que no se confundan con lo
          // que se mandó de este protocolo.
          !mensaje.es_de_este_protocolo && !fallo && "opacity-70",
        )}
      >
        {esInforme && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-black/5 px-2 py-1.5">
            <FileText className="h-4 w-4 shrink-0 text-[#204983]" />
            <span className="min-w-0 text-xs font-medium text-gray-700">
              {mensaje.kind === "resumen" ? "Resumen para facturación" : "Informe de resultados"}
              {mensaje.del_unificado && " (informe unificado)"}
            </span>
          </div>
        )}

        {/* A OTRO NÚMERO. No salió al teléfono del paciente sino a uno que se
            eligió al mandarlo —el del médico, un familiar—: que se vea adónde fue. */}
        {esNuestro && mensaje.a_otro_numero && (
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-800">
            <PhoneForwarded className="h-3.5 w-3.5 shrink-0" />
            Enviado a otro número: +{mensaje.to_phone}
          </p>
        )}

        {esAviso && (
          <Badge
            variant="outline"
            className="mb-1.5 gap-1 border-slate-300 bg-white/60 text-[10px] font-normal text-slate-600"
          >
            <Bot className="h-3 w-3" />
            Respuesta automática
          </Badge>
        )}

        {mensaje.body && (
          <p className="text-sm whitespace-pre-wrap break-words text-gray-800">{mensaje.body}</p>
        )}

        {/* QUÉ LLEVABA ESTE MENSAJE.
            Un protocolo se manda por partes; sin esto el globo dice "entregado"
            pero no de qué, y para saber qué le falta al paciente hay que
            reconstruirlo de memoria. */}
        {mensaje.analyses.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mensaje.analyses.map((analisis) => (
              <span
                key={`${mensaje.id}-${analisis.analysis_id}-${analisis.code}`}
                className="rounded border border-black/10 bg-white/70 px-1.5 py-0.5 text-[11px] text-gray-700"
              >
                <span className="font-mono text-[10px] text-gray-500">{analisis.code}</span>{" "}
                {analisis.name}
              </span>
            ))}
          </div>
        )}

        {esInforme && mensaje.analyses.length === 0 && (
          <p className="text-xs text-gray-500">
            {mensaje.es_de_este_protocolo
              ? "Sin detalle de qué análisis llevaba."
              : `De otro protocolo del paciente${mensaje.protocol_id ? ` (#${mensaje.protocol_id})` : ""}.`}
          </p>
        )}

        {/* EL MOTIVO, NO SOLO "FALLÓ".
            Sin esto hay que entrar al servidor para saber si el número no tiene
            WhatsApp o si el paciente bloqueó al laboratorio, que se resuelven de
            maneras distintas. */}
        {fallo && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              No le llegó: {mensaje.error_message || "Meta no informó el motivo"}
              {mensaje.error_code ? ` (código ${mensaje.error_code})` : ""}.
            </span>
          </p>
        )}

        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            esNuestro ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-[10px] text-gray-500 tabular-nums">{horaDe(mensaje.sent_at)}</span>
          {esNuestro && <Tildes mensaje={mensaje} />}
        </div>
      </div>
    </div>
  )
}

export function MensajesDeWhatsApp({ protocolId }: { protocolId: number }) {
  const { apiRequest } = useApi()
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const finDelChat = useRef<HTMLDivElement>(null)
  const cantidadAnterior = useRef(0)

  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const respuesta = await apiRequest(REPORTING_ENDPOINTS.WHATSAPP_DEL_PROTOCOLO(protocolId))
      if (respuesta.ok) setDatos(await respuesta.json())
    } finally {
      setCargando(false)
    }
  }, [apiRequest, protocolId])

  useEffect(() => {
    traer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId])

  // Mientras la pantalla está abierta se vuelve a preguntar sola: lo que se
  // espera —la confirmación de entrega, o que el paciente conteste— llega en
  // segundos. Sin esto habría que acordarse de apretar "Actualizar".
  useEffect(() => {
    const reloj = window.setInterval(() => { void traer() }, CADA_CUANTO_MS)
    return () => window.clearInterval(reloj)
  }, [traer])

  const mensajes = useMemo(() => datos?.messages ?? [], [datos])
  const pendientes = datos?.pendientes ?? []

  // Abajo de todo, que es donde está lo último. Solo cuando llegó algo nuevo:
  // si se hiciera en cada refresco, le arrancaría el scroll de las manos a
  // quien está leyendo algo más arriba.
  useEffect(() => {
    if (mensajes.length > cantidadAnterior.current) {
      finDelChat.current?.scrollIntoView({ block: "nearest" })
    }
    cantidadAnterior.current = mensajes.length
  }, [mensajes])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
            <MessageCircle className="h-5 w-5 text-[#204983]" />
            WhatsApp con el paciente
          </h2>
          {datos?.telefono && (
            <p className="mt-0.5 truncate text-xs text-gray-500">
              +{datos.telefono}
              {datos.paciente ? ` · ${datos.paciente}` : ""}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 self-start px-2 text-xs text-[#204983] sm:self-auto"
          onClick={traer}
          disabled={cargando}
        >
          <RefreshCw className={cn("mr-1 h-3.5 w-3.5", cargando && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {cargando && !datos ? (
        <p className="flex items-center gap-2 py-3 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando la conversación...
        </p>
      ) : (
        <>
          {/* El fondo verdoso y apagado del chat. No es decoración: es lo que
              hace que los globos se lean como globos y no como tarjetas de una
              lista más del sistema. */}
          <div className="max-h-[26rem] space-y-1.5 overflow-y-auto rounded-lg bg-[#efeae2] p-3">
            {mensajes.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Todavía no se habló nada por WhatsApp con este paciente.
              </p>
            ) : (
              mensajes.map((mensaje, i) => (
                <div key={mensaje.id}>
                  {(i === 0 || diaDe(mensajes[i - 1].sent_at) !== diaDe(mensaje.sent_at)) && (
                    <SeparadorDeDia iso={mensaje.sent_at} />
                  )}
                  <Globo mensaje={mensaje} />
                </div>
              ))
            )}
            <div ref={finDelChat} />
          </div>

          {/* ACÁ NO SE ESCRIBE, Y HAY QUE DECIRLO.
              Un chat sin campo de texto se lee como un chat roto. Esto está
              para que se entienda que es a propósito. */}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              Este número solo manda resultados: desde acá no se contesta. Al paciente
              que escribe se le responde una vez, automáticamente, con el número de
              atención del laboratorio.
            </span>
          </p>

          {/* LO QUE TODAVÍA NO SALIÓ.
              Sale del protocolo y no de restarle los mensajes: un análisis
              también se entrega en mano o por mail, y ahí el paciente lo tiene
              aunque no haya ningún WhatsApp que lo diga. */}
          {pendientes.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                Sin marcar como entregado ({pendientes.length})
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {pendientes.map((analisis) => (
                  <span
                    key={`pendiente-${analisis.analysis_id}`}
                    className="rounded-md border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-900"
                  >
                    <span className="font-mono text-[10px] text-amber-700">{analisis.code}</span>{" "}
                    {analisis.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
