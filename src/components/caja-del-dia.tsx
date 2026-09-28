import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ANALYTICS_ENDPOINTS } from "@/config/api"
import { useApiQuery } from "@/hooks/use-api-query"

/**
 * El cierre de caja de un día, al hacer clic en su barra en el inicio.
 *
 * Lo que se muestra está ordenado por lo que alguien necesita para cerrar la
 * caja, no por cómo lo devuelve la API: primero cuánto entró, después cuánto
 * falta cobrar y cuánto hay que devolver, y recién al final de dónde viene cada
 * peso.
 */

type CajaDelDia = {
  fecha: string
  protocols_count: number
  total_paid: string
  total_due: string
  pending_to_collect: string
  to_return: string
  breakdown: {
    analyses_amount_due: string
    coseguro: string
    material_descartable: string
    derivacion: string
    unplanned_charges: string
    unplanned_payments_today: string
  }
}

const plata = (valor?: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number.parseFloat(valor || "0"))

const dia = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

function Renglon({
  titulo,
  valor,
  nota,
  tono = "normal",
}: {
  titulo: string
  valor: string
  nota?: string
  tono?: "normal" | "entra" | "falta" | "sale"
}) {
  const color = {
    normal: "text-slate-900",
    entra: "text-emerald-700",
    falta: "text-amber-700",
    sale: "text-rose-700",
  }[tono]

  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm text-slate-700">{titulo}</div>
        {nota ? <div className="text-xs text-slate-500">{nota}</div> : null}
      </div>
      <div className={`shrink-0 text-base font-semibold tabular-nums ${color}`}>{valor}</div>
    </div>
  )
}

export default function CajaDelDia({
  fecha,
  onClose,
}: {
  fecha: string | null
  onClose: () => void
}) {
  const consulta = useApiQuery<CajaDelDia>({
    queryKey: ["analytics", "caja", fecha],
    url: fecha ? ANALYTICS_ENDPOINTS.CAJA(fecha) : "",
    enabled: Boolean(fecha),
  })

  const caja = consulta.data
  const desglose = caja?.breakdown

  return (
    <Dialog open={Boolean(fecha)} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{fecha ? dia(fecha) : ""}</DialogTitle>
        </DialogHeader>

        {consulta.isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Buscando el detalle…</div>
        ) : consulta.error ? (
          <div className="py-8 text-center text-sm text-rose-700">
            No se pudo traer la caja de ese día. Probá de nuevo.
          </div>
        ) : !caja ? null : (
          <div className="divide-y divide-slate-200">
            <div className="pb-1">
              <Renglon
                titulo="Cobrado"
                valor={plata(caja.total_paid)}
                nota={`${caja.protocols_count} protocolo${caja.protocols_count === 1 ? "" : "s"} del día`}
                tono="entra"
              />
            </div>

            <div className="py-1">
              {/* Lo que se le facturó al paciente en el día: cobrado más lo
                  que falta. La API lo mandaba y no se mostraba. */}
              <Renglon
                titulo="Total del día"
                valor={plata(caja.total_due)}
                nota="Lo que tenían que pagar los protocolos del día"
              />
              <Renglon
                titulo="Queda por cobrar"
                valor={plata(caja.pending_to_collect)}
                nota="De los protocolos de este día"
                tono="falta"
              />
              {/*
                Faltaba, y para quien cierra la caja no es un detalle: es plata
                del cajón que ya no es del laboratorio. Sin verla, el arqueo
                cierra con un sobrante que nadie sabe explicar.
              */}
              <Renglon
                titulo="Hay que devolver"
                valor={plata(caja.to_return)}
                nota="Pacientes que pagaron de más"
                tono="sale"
              />
            </div>

            {desglose ? (
              <div className="pt-2">
                <div className="pb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  De dónde viene
                </div>
                <Renglon titulo="Análisis particulares" valor={plata(desglose.analyses_amount_due)} />
                <Renglon titulo="Coseguro" valor={plata(desglose.coseguro)} />
                <Renglon titulo="Material descartable" valor={plata(desglose.material_descartable)} />
                <Renglon titulo="Derivación" valor={plata(desglose.derivacion)} />
                <Renglon titulo="Cargos no contemplados" valor={plata(desglose.unplanned_charges)} />
                <Renglon
                  titulo="Pagos no contemplados"
                  valor={plata(desglose.unplanned_payments_today)}
                  nota="Transferencias y depósitos cargados este día"
                  tono="entra"
                />
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
