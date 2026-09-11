"use client"

import { Fragment, useRef, type MouseEvent as EventoDeMouse, type PointerEvent as EventoDePuntero, type ReactNode } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown, AlertCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ENTRADA_ABAJO } from "@/lib/entrada"

export type SortDirection = "asc" | "desc"
export type SortState = { field: string; dir: SortDirection } | null

export interface Column<T> {
  /** Identificador estable de la columna. */
  id: string
  header: ReactNode
  /** Render de la celda para una fila. */
  cell: (row: T) => ReactNode
  /** Si la columna ordena. Requiere `sortField` (campo de ordering del backend). */
  sortable?: boolean
  sortField?: string
  align?: "left" | "right" | "center"
  /** La columna cede su ancho preferido y se queda con el que sobra.
   *
   * Sirve para las columnas de texto largo —un nombre, un email— que hoy se
   * cortan aunque haya lugar. El truncado tiene que depender del ancho REAL
   * que la tabla le dio a la columna, no de un número escrito a mano: con un
   * `max-w-[240px]` en el contenido, una pantalla que le da 400 px a la
   * columna igual corta a los 240 y deja el resto en blanco.
   *
   * `max-w-0` es la forma de decirle al algoritmo de tabla que esta columna no
   * tiene ancho preferido: reparte primero entre las demás y le deja el resto.
   * El contenido se trunca contra ese resto, así que corta solo cuando de
   * verdad no entra.
   *
   * El contenido necesita `truncate`, y si está adentro de un flex, `min-w-0`
   * en el contenedor — sin eso un flex item no achica por debajo de su
   * contenido y el truncate no llega a activarse nunca. */
  flexible?: boolean
  /** La columna se encoge hasta su contenido y no acepta espacio de relleno.
   *
   * Es la otra mitad de `flexible`, y sin ella `flexible` casi no sirve. El
   * algoritmo de `table-layout: auto` reparte el espacio sobrante entre TODAS
   * las columnas, y una columna con `max-w-0` declara ancho preferido cero, así
   * que es la que menos recibe: el DNI se quedaba con 265 px para mostrar
   * "12.345.678" mientras el nombre del paciente cortaba a 132.
   *
   * `w-px` es el modo de decir "encogé al contenido" en una tabla —un ancho
   * declarado más chico que el contenido hace que la columna tome su mínimo—
   * y `whitespace-nowrap` evita que el texto se parta en dos renglones al
   * apretarla. Lo que sobra queda para las columnas `flexible`.
   *
   * Medido sobre la tabla de pacientes a 1600 px: sin esto el nombre corta a
   * 132 px de los 248 que necesita; con esto entra completo, y a 1024 px vuelve
   * a cortar, que es cuando de verdad no entra. */
  compact?: boolean
  className?: string
  headerClassName?: string
  /** Clases de visibilidad responsive (ej. "hidden md:table-cell") aplicadas
   * al header y a la celda, para ocultar la columna en pantallas chicas. */
  responsive?: string
  /** Skeleton de carga propio de la columna (matchea la forma del contenido). */
  skeleton?: ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** Estado de orden controlado. Las columnas con `sortField` lo togglean. */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  isLoading?: boolean
  skeletonRows?: number
  emptyMessage?: ReactNode
  /** Pie de tabla: sentinel de scroll infinito, "cargando más", etc. */
  footer?: ReactNode
  rowClassName?: (row: T) => string
  /** Fila separadora que se inserta ANTES de `fila` cuando devuelve algo.
   *
   * Recibe también la fila anterior (`undefined` en la primera) para poder
   * decidir por el corte y no por la fila sola: así el separador de día sale
   * una vez, cuando la fecha cambia, y no repetido en cada fila.
   *
   * Ocupa todas las columnas y no dispara `onRowClick`. */
  rowSeparator?: (fila: T, anterior: T | undefined) => ReactNode
  /**
   * Mantener apretada una fila con el dedo, medio segundo. Es para el celular,
   * donde no hay checkboxes a la vista ni clic derecho: la lista de protocolos
   * lo usa para empezar a elegir un lote. Con el mouse no se dispara.
   */
  onRowLongPress?: (row: T) => void
}

/** Cuánto hay que mantener apretada una fila para que cuente, en ms. */
const DEMORA_PARA_MANTENER_MS = 500
/** Cuánto se puede mover el dedo sin que deje de contar: más que esto es scroll. */
const TOLERANCIA_AL_MANTENER_PX = 10

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const

// Click en header ordenable: asc → desc → sin orden.
function nextSort(current: SortState, field: string): SortState {
  if (!current || current.field !== field) return { field, dir: "asc" }
  if (current.dir === "asc") return { field, dir: "desc" }
  return null
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  sort,
  onSortChange,
  isLoading,
  skeletonRows = 8,
  emptyMessage = "No hay datos para mostrar",
  footer,
  rowClassName,
  rowSeparator,
  onRowLongPress,
}: DataTableProps<T>) {
  // MANTENER APRETADO
  // Un temporizador que arranca al apoyar el dedo y se cancela si el dedo se
  // levanta o se mueve. Si llega a cumplirse, el clic que el navegador dispara
  // al soltar se descarta: si no, la misma fila se elegiría y se sacaría en el
  // mismo gesto. La marca se limpia en el próximo toque, porque hay navegadores
  // (Safari) que después de mantener apretado no disparan ese clic.
  const mantenido = useRef<{ temporizador: number; x: number; y: number } | null>(null)
  const descartarElClic = useRef(false)
  const soltar = () => {
    if (mantenido.current) window.clearTimeout(mantenido.current.temporizador)
    mantenido.current = null
  }
  const alMantener = (row: T) =>
    onRowLongPress
      ? {
          onPointerDown: (e: EventoDePuntero) => {
            descartarElClic.current = false
            if (e.pointerType === "mouse") return
            soltar()
            const temporizador = window.setTimeout(() => {
              mantenido.current = null
              descartarElClic.current = true
              navigator.vibrate?.(30)
              onRowLongPress(row)
            }, DEMORA_PARA_MANTENER_MS)
            mantenido.current = { temporizador, x: e.clientX, y: e.clientY }
          },
          onPointerMove: (e: EventoDePuntero) => {
            const inicio = mantenido.current
            if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > TOLERANCIA_AL_MANTENER_PX) soltar()
          },
          onPointerUp: soltar,
          onPointerCancel: soltar,
          onPointerLeave: soltar,
          // El menú del navegador (Android) sale justo al mantener apretado, y
          // acá mantener apretado ya quiere decir otra cosa.
          onContextMenu: (e: EventoDeMouse) => {
            if (descartarElClic.current || mantenido.current) e.preventDefault()
          },
        }
      : {}

  const renderSortIcon = (col: Column<T>) => {
    if (!col.sortable || !col.sortField) return null
    const active = sort?.field === col.sortField
    if (!active) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
    return sort?.dir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-[#204983]" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-[#204983]" />
    )
  }

  // LA TABLA ENTRA CUANDO ENTRAN LOS DATOS, NO CUANDO SE ABRE LA PANTALLA.
  // La `key` es lo que lo hace: al pasar de esqueleto a filas cambia, el
  // bloque se monta de nuevo y la animación arranca ahí. Sin ella la tabla ya
  // estaba montada desde el esqueleto y para cuando llegaba la respuesta hacía
  // rato que había terminado de entrar.
  //
  // Entra el bloque entero y no fila por fila: escalonar cincuenta filas —cada
  // una con su transform— se ve entrecortado justo en las listas largas, que
  // son las que importan.
  return (
    <div
      key={isLoading ? "esqueleto" : "filas"}
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm",
        ENTRADA_ABAJO,
      )}
    >
      <Table>
        <TableHeader className="bg-gray-50/80">
          <TableRow className="border-gray-200 hover:bg-transparent">
            {columns.map((col) => {
              const canSort = col.sortable && col.sortField && onSortChange
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    "h-11 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500",
                    alignClass[col.align ?? "left"],
                    canSort && "cursor-pointer select-none hover:text-[#204983]",
                    col.responsive,
                    col.headerClassName,
                  )}
                  onClick={
                    canSort
                      ? () => onSortChange!(nextSort(sort ?? null, col.sortField!))
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      col.align === "right" && "flex-row-reverse",
                    )}
                  >
                    {col.header}
                    {renderSortIcon(col)}
                  </span>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="border-gray-100 hover:bg-transparent">
                {columns.map((col, ci) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "px-3 py-3",
                      alignClass[col.align ?? "left"],
                      col.flexible && "max-w-0",
                      col.compact && "w-px whitespace-nowrap",
                      col.responsive,
                      col.className,
                    )}
                  >
                    {col.skeleton ?? (
                      <Skeleton
                        className={cn(
                          "h-4 rounded",
                          ci === 0 ? "w-10" : ci === 1 ? "w-32" : "w-16",
                          col.align === "right" && "ml-auto",
                          col.align === "center" && "mx-auto",
                        )}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-14 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <AlertCircle className="mb-2 h-8 w-8" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => {
              const separador = rowSeparator?.(row, i > 0 ? rows[i - 1] : undefined)
              return (
                <Fragment key={getRowId(row)}>
                  {separador && (
                    // `border-b-0` y `p-0`: la fila separadora no tiene que
                    // aportar ni una línea gris de más ni un pixel de alto.
                    // Lo único que se ve es lo que dibuje `rowSeparator`.
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={columns.length} className="p-0">
                        {separador}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow
                    className={cn(
                      "border-gray-100",
                      onRowClick && "cursor-pointer",
                      // Sin la selección de texto ni el menú de iOS al mantener apretado.
                      onRowLongPress && "max-md:select-none max-md:[-webkit-touch-callout:none]",
                      rowClassName?.(row),
                    )}
                    onClick={
                      onRowClick
                        ? () => {
                            if (descartarElClic.current) {
                              descartarElClic.current = false
                              return
                            }
                            onRowClick(row)
                          }
                        : undefined
                    }
                    {...alMantener(row)}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          "px-3 py-3",
                          alignClass[col.align ?? "left"],
                          col.flexible && "max-w-0",
                          col.compact && "w-px whitespace-nowrap",
                          col.responsive,
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>

      {footer}
    </div>
  )
}
