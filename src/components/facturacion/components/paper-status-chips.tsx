import { AlertCircle, Check, X } from "lucide-react"

interface PaperStatusChipsProps {
  /** Lista de papeles faltantes que devuelve el backend; vacía = completo. */
  missingPaperwork: string[]
}

/**
 * Checklist visual de los papeles físicos que puede pedir una OOSS (orden,
 * preautorización si aplica, resumen, etc.) — el backend decide qué falta
 * según la OOSS y el protocolo. Es solo informativo: el backend igual
 * bloquea con 400 si falta algo al intentar facturar.
 */
export function PaperStatusChips({ missingPaperwork }: PaperStatusChipsProps) {
  if (missingPaperwork.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <Check className="h-3 w-3" />
        Papeles completos
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {missingPaperwork.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
        >
          <AlertCircle className="h-3 w-3" />
          {item}
        </span>
      ))}
    </div>
  )
}

interface PaperChecklistProps {
  trajoOrden?: string
  preauthStatus?: string
  requierePreautorizacion?: boolean
  isSummaryPrinted?: boolean
}

/**
 * Los papeles uno por uno, con su estado: los chips de arriba sólo dicen lo
 * que falta, y con eso no se sabía si la orden estaba o si ni se había mirado.
 *
 * Mismas reglas que `get_billing_paperwork_missing` en el backend: orden
 * completa, preautorización completa sólo si la obra social la pide, y el
 * RESUMEN de resultados generado (no alcanza con el informe del paciente).
 */
export function PaperChecklist({
  trajoOrden,
  preauthStatus,
  requierePreautorizacion,
  isSummaryPrinted,
}: PaperChecklistProps) {
  const papeles = [
    { nombre: "Orden", ok: trajoOrden === "completa" },
    ...(requierePreautorizacion ? [{ nombre: "Preautorización", ok: preauthStatus === "completa" }] : []),
    { nombre: "Resumen", ok: Boolean(isSummaryPrinted) },
  ]

  return (
    <ul className="flex flex-wrap gap-1" aria-label="Papeles para facturar">
      {papeles.map((p) => (
        <li
          key={p.nombre}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            p.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {p.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {p.nombre}
          <span className="sr-only">{p.ok ? ": está" : ": falta"}</span>
        </li>
      ))}
    </ul>
  )
}
