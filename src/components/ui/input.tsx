import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"

const inputBaseClassName =
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

const isoToDisplayDate = (value: string) => {
  const dateOnly = value.split("T")[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!match) return ""
  return `${match[3]}/${match[2]}/${match[1]}`
}

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") return ""
  const dateOnly = value.split("T")[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly
  return displayToIsoDate(value)
}

const displayToIsoDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return ""

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return ""
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`
}

const maskDisplayDate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function DateInput({
  className,
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  readOnly,
  min,
  max,
  name,
  ...props
}: React.ComponentProps<"input">) {
  const nativeInputRef = React.useRef<HTMLInputElement | null>(null)
  const isControlled = value !== undefined
  const controlledValue = normalizeIsoDate(value)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => normalizeIsoDate(defaultValue))
  const currentValue = isControlled ? controlledValue : uncontrolledValue
  const [displayValue, setDisplayValue] = React.useState(() => isoToDisplayDate(currentValue))

  React.useEffect(() => {
    if (isControlled) {
      setDisplayValue(isoToDisplayDate(currentValue))
    }
  }, [currentValue, isControlled])

  const emitDateChange = (nextValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue)
      setDisplayValue(isoToDisplayDate(nextValue))
    }

    const event = {
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name },
    } as React.ChangeEvent<HTMLInputElement>
    onChange?.(event)
  }

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDisplayValue = maskDisplayDate(event.target.value)
    setDisplayValue(nextDisplayValue)

    if (!nextDisplayValue) {
      emitDateChange("")
      if (!isControlled) setDisplayValue("")
      return
    }

    if (nextDisplayValue.length === 10) {
      const nextIsoValue = displayToIsoDate(nextDisplayValue)
      if (nextIsoValue) emitDateChange(nextIsoValue)
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (displayValue && displayValue.length < 10) {
      setDisplayValue(isoToDisplayDate(currentValue))
    }
    if (displayValue.length === 10 && !displayToIsoDate(displayValue)) {
      setDisplayValue(isoToDisplayDate(currentValue))
    }
    props.onBlur?.(event)
  }

  const openNativePicker = () => {
    if (disabled || readOnly) return
    const nativeInput = nativeInputRef.current
    if (!nativeInput) return

    if (typeof nativeInput.showPicker === "function") {
      nativeInput.showPicker()
      return
    }

    nativeInput.click()
  }

  return (
    <div className="relative w-full min-w-0">
      <input
        {...props}
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        inputMode="numeric"
        placeholder={placeholder || "dd/mm/aaaa"}
        className={cn(inputBaseClassName, "pr-10", className)}
        data-slot="input"
      />
      <button
        type="button"
        onClick={openNativePicker}
        disabled={disabled || readOnly}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Elegir fecha"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={nativeInputRef}
        type="date"
        name={name}
        value={currentValue}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-px w-px opacity-0"
        onChange={(event) => {
          const nextValue = event.target.value
          setDisplayValue(isoToDisplayDate(nextValue))
          emitDateChange(nextValue)
        }}
      />
    </div>
  )
}

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  if (type === "date") {
    return <DateInput className={className} {...props} />
  }

  /**
   * LA RUEDA DEL MOUSE NO CAMBIA NÚMEROS
   * ====================================
   * Un `<input type="number">` con el foco puesto sube y baja su valor cuando
   * se scrollea encima. Es comportamiento del navegador y nadie lo pide: se
   * carga un monto, se scrollea para seguir llenando el formulario, el cursor
   * pasa por arriba del campo que quedó enfocado y el número cambia solo. No
   * hay aviso, no hay marca, y el que lo encuentra es el que factura.
   *
   * En un laboratorio eso son montos, coseguros y valores de UB. El error de
   * carga que esto evita no se distingue de un dato bien cargado.
   *
   * Se resuelve sacándole el foco: sin foco, la rueda no le hace nada y la
   * página scrollea normal. La otra salida —cancelar el evento— también frena
   * el scroll de la página mientras el cursor esté encima, que es peor.
   */
  const alScrollear = (event: React.WheelEvent<HTMLInputElement>) => {
    if (type === "number" && document.activeElement === event.currentTarget) {
      event.currentTarget.blur()
    }
    onWheel?.(event)
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputBaseClassName, className)}
      {...props}
      onWheel={alScrollear}
    />
  )
}

export { Input }
