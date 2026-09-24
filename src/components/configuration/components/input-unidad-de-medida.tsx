"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { aSupraindice } from "@/lib/supraindices"

/**
 * La unidad de medida, con un botón para escribir un carácter en supraíndice.
 *
 * Se aprieta `x²`, se escribe el carácter y el modo se apaga solo: es de un
 * solo uso a propósito. Una unidad es `mm³` o `m/s²`, nunca `mm³³³`, así que
 * dejarlo prendido obligaría a apagarlo a mano cada vez.
 *
 * El carácter que se inserta es Unicode (`³`, no `<sup>3</sup>`): el campo es
 * un CharField y lo que se ve acá es exactamente lo que se guarda y lo que
 * imprime el informe.
 *
 * Abajo del campo van los símbolos que no están a mano en el teclado (µ, °,
 * Δ…). Cada botón escribe el suyo donde está el cursor del input, reemplazando
 * lo seleccionado; si el cursor no está en el campo, lo agrega al final.
 */

/**
 * Los símbolos con botón. Salen de las unidades que hay de verdad en el
 * catálogo (`µg/dL`, `ΔDO450`) y de las de laboratorio que se escriben igual
 * (`°C`, `mmol·L`, `‰`). Lo que está en el teclado (`%`, `/`) no va, y los
 * supraíndices tampoco: para eso está el botón `x²`.
 *
 * El micro es U+00B5 (MICRO SIGN), no la mu griega U+03BC: es el que ya usa
 * el catálogo, y mezclarlos haría que dos unidades iguales no coincidan.
 */
const SIMBOLOS: { simbolo: string; nombre: string }[] = [
  { simbolo: "\u00B5", nombre: "micro" },
  { simbolo: "°", nombre: "grado" },
  { simbolo: "Δ", nombre: "delta" },
  { simbolo: "·", nombre: "punto medio" },
  { simbolo: "×", nombre: "por" },
  { simbolo: "‰", nombre: "por mil" },
]
interface Props {
  id: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function InputUnidadDeMedida({
  id,
  value,
  onChange,
  placeholder = "ej: mg/dL, UI/L, etc.",
  disabled,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [armado, setArmado] = useState(false)

  // Al insertar el carácter a mano, React repinta el input con el valor nuevo
  // y el caret se va al final. Hay que reponerlo, y después del repintado:
  // por eso queda anotado acá y se aplica en el layout effect.
  const caretPendiente = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caretPendiente.current === null) return
    inputRef.current?.setSelectionRange(caretPendiente.current, caretPendiente.current)
    caretPendiente.current = null
  })

  const manejarTecla = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!armado) return
    // Sólo caracteres imprimibles. Backspace, flechas, Tab, Enter y los
    // atajos con Ctrl/Cmd pasan de largo SIN gastar el modo: si alguien
    // arma el supraíndice y antes corrige una letra, el modo lo espera.
    if (evento.key.length !== 1 || evento.ctrlKey || evento.metaKey || evento.altKey) return

    evento.preventDefault()
    const input = evento.currentTarget
    const desde = input.selectionStart ?? input.value.length
    const hasta = input.selectionEnd ?? desde

    // Si Unicode no tiene ese carácter en supraíndice (la `q`, casi todas las
    // mayúsculas) se escribe tal cual y el modo se gasta igual: así nunca
    // queda prendido esperando algo que no va a llegar.
    const caracter = aSupraindice(evento.key)

    onChange(input.value.slice(0, desde) + caracter + input.value.slice(hasta))
    setArmado(false)
    caretPendiente.current = desde + caracter.length
  }

  const insertarSimbolo = (simbolo: string) => {
    const input = inputRef.current
    if (!input) return
    // `onMouseDown` del botón no deja que el foco se vaya: si el input lo
    // tenía, lo sigue teniendo y la selección es la del cursor. Si no lo
    // tenía, la selección que queda guardada no es algo que la persona esté
    // viendo, así que el símbolo va al final.
    const conCursor = document.activeElement === input
    const desde = conCursor ? (input.selectionStart ?? value.length) : value.length
    const hasta = conCursor ? (input.selectionEnd ?? desde) : value.length

    onChange(value.slice(0, desde) + simbolo + value.slice(hasta))
    caretPendiente.current = desde + simbolo.length
    input.focus()
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={manejarTecla}
          // Si el foco se va del campo, el supraíndice armado no tiene dónde
          // caer. Se desarma para no volver dentro de un rato y escribir un
          // carácter raro sin que nadie entienda por qué.
          onBlur={() => setArmado(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "text-sm",
            armado && "border-[#204983] ring-2 ring-[#204983]/40",
            className,
          )}
        />
        <Button
          type="button"
          variant={armado ? "default" : "outline"}
          size="icon"
          disabled={disabled}
          aria-pressed={armado}
          aria-label={
            armado
              ? "Supraíndice activo: el próximo carácter va arriba"
              : "Escribir el próximo carácter en supraíndice"
          }
          title="Escribir el próximo carácter en supraíndice (mm³, cm², m/s²)"
          // El foco no se tiene que ir del input: si se fuera, `onBlur` lo
          // desarmaría en el mismo click que lo armó, y además habría que
          // volver a hacer click en el campo para escribir.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setArmado((estaba) => !estaba)
            // Para cuando se llega por teclado (Tab + Enter), donde el foco
            // sí está en el botón.
            inputRef.current?.focus()
          }}
          className={cn("shrink-0", armado && "bg-[#204983] hover:bg-[#204983]/90")}
        >
          <span className="text-sm leading-none">
            x<sup className="text-[0.6em]">2</sup>
          </span>
        </Button>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Símbolos para la unidad">
        {SIMBOLOS.map(({ simbolo, nombre }) => (
          <Button
            key={simbolo}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`Insertar ${nombre} (${simbolo})`}
            title={`Insertar ${nombre} (${simbolo})`}
            // Igual que en `x²`: sin esto el foco se va al botón y se pierde
            // dónde estaba el cursor.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertarSimbolo(simbolo)}
            className="h-7 min-w-8 px-2 text-sm"
          >
            {simbolo}
          </Button>
        ))}
      </div>
      {armado && (
        <p className="text-xs text-[#204983]">El próximo carácter se escribe en supraíndice.</p>
      )}
    </div>
  )
}
