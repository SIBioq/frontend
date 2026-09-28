interface MensajeDeAuditoriaProps {
  message?: string
  encabezado?: string | null
  detalle?: string[]
  className?: string
}

// Cuando un alta, un cambio o una baja toca varios campos, el backend manda un
// encabezado y un ítem por campo: se lee como lista, no como un párrafo largo.
// Con un solo campo (o eventos de negocio) queda el mensaje de una línea.
export function MensajeDeAuditoria({ message, encabezado, detalle, className = "" }: MensajeDeAuditoriaProps) {
  if (encabezado && detalle && detalle.length > 0) {
    return (
      <div className={`text-slate-700 break-words min-w-0 ${className}`}>
        <p>{encabezado}</p>
        <ul className="mt-0.5 list-disc pl-5 space-y-0.5">
          {detalle.map((item, idx) => (
            <li key={idx} className="leading-snug whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (!message) return null
  return <p className={`text-slate-700 break-words whitespace-pre-wrap ${className}`}>{message}</p>
}
