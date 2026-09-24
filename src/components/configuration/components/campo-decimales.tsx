"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DECIMALES_MAXIMO, DECIMALES_MINIMO } from "@/lib/decimales"

/**
 * Decimales fijos para el resultado de una determinación CALCULADA (con
 * fórmula). Por eso este campo sólo se muestra cuando hay una fórmula
 * cargada: en una determinación sin fórmula el valor lo carga la bioquímica
 * tal cual lo mide el equipo, no hay nada que redondear acá.
 *
 * Existe por cocientes como VCM, HCM y CHCM: por cifras significativas van
 * sin decimales (o con uno), y la regla automática del frontend
 * (`formatFormulaNumber` en `result-formulas.ts`) les pone un piso de dos.
 */

interface Props {
  id: string
  /** Texto porque el input puede estar vacío, que es "automático". */
  decimales: string
  onChange: (valor: string) => void
  error?: string
}

export function CampoDecimales({ id, decimales, onChange, error }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        Decimales (opcional)
      </Label>
      <Input
        id={id}
        type="number"
        min={DECIMALES_MINIMO}
        max={DECIMALES_MAXIMO}
        inputMode="numeric"
        value={decimales}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Automático"
        className="h-9 w-24 text-sm"
      />
      {error ? (
        <p className="text-xs md:text-sm text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-gray-500">
          Vacío: se usan los decimales de los componentes (mínimo 2). Útil para VCM, HCM y CHCM,
          que van sin decimales.
        </p>
      )}
    </div>
  )
}
