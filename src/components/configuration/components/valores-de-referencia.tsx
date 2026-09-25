"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Los valores de referencia de una determinación.
 *
 * POR QUÉ ES UN COMPONENTE Y NO ESTÁ ESCRITO EN CADA DIÁLOGO
 * ==========================================================
 * La edición tenía esta grilla y el alta pedía un JSON a mano, en un
 * `<textarea>`. O sea que para cargar un rango al crear había que saber la
 * forma del objeto, y equivocarse en una llave no daba error: guardaba una
 * determinación sin rangos, y el informe salía sin ellos.
 *
 * Ahora es la misma grilla en los dos lados, y el mismo formato de salida.
 *
 * SON DOS COSAS DISTINTAS
 * =======================
 * Arriba, los cuatro grupos de siempre —hombre, mujer, niño, niña—: el sistema
 * elige uno según el sexo y la edad del paciente, lo compara con el resultado
 * y marca fuera de rango. Es automático y por eso son fijos.
 *
 * Abajo, los rangos con nombre: los escribe el laboratorio y salen en el
 * informe, nada más. Existen porque hay análisis que no se leen por sexo ni por
 * edad. El colesterol no tiene un valor normal y uno anormal sino franjas
 * —deseable, límite alto, alto— y el médico las necesita todas para interpretar
 * el resultado. Como un rango llamado "Alto" no significa que el resultado
 * tenga que estar adentro, no se evalúan.
 *
 * EL RANGO PUEDE SER ABIERTO
 * ==========================
 * No todo valor de referencia tiene dos puntas: hay análisis en los que la
 * referencia es "menor a 200" o "mayor a 40". Se cargaba dejando un casillero
 * vacío, sin que nada lo dijera, y encima la detección automática ni siquiera
 * lo entendía como abierto. Ahora se elige el modo y lo que se ve es lo que se
 * imprime.
 *
 * Y EL BORDE ENTRA O NO ENTRA
 * ===========================
 * Los abiertos son cuatro y no dos: `≥ 40` acepta el 40 y `> 40` lo rechaza.
 * Antes había uno solo por lado, que se evaluaba como "o igual" pero se
 * imprimía como "mayor" — el papel del paciente y el rojo de la pantalla
 * decían cosas distintas.
 */

export const REF_GROUPS = [
  { key: "hombre", label: "Hombre", sex: "male", age_group: "adult" },
  { key: "mujer", label: "Mujer", sex: "female", age_group: "adult" },
  { key: "nino", label: "Niño", sex: "male", age_group: "child" },
  { key: "nina", label: "Niña", sex: "female", age_group: "child" },
] as const

/**
 * Cómo se lee el rango: entre dos números, o abierto de un lado.
 *
 * Los abiertos vienen de a dos porque el borde importa. "Mayor o igual a 40"
 * acepta el 40 y "mayor a 40" lo rechaza, y son dos cosas distintas que el
 * laboratorio decide por análisis. Hasta acá había una sola opción por lado,
 * que se EVALUABA como "o igual" pero se IMPRIMÍA como "mayor": el papel y el
 * rojo de la pantalla decían cosas distintas.
 */
export type ModoDeRango = "rango" | "menor" | "menor_igual" | "mayor" | "mayor_igual"

export type Rango = { modo: ModoDeRango; min: string; max: string }

/** Si el modo deja el borde adentro. */
const bordeAdentro = (modo: ModoDeRango) =>
  modo === "mayor_igual" || modo === "menor_igual" || modo === "rango"

/** Los dos modos que usan el casillero de la izquierda. */
const esDeMinimo = (modo: ModoDeRango) => modo === "mayor" || modo === "mayor_igual"

const SIGNO: Record<ModoDeRango, string> = {
  rango: "",
  mayor_igual: "≥",
  mayor: ">",
  menor_igual: "≤",
  menor: "<",
}

export type RangeMap = Record<string, Rango>

export type RefRange = {
  sex?: string
  age_group?: string
  age_min_years?: number | null
  age_max_years?: number | null
  min_value?: string
  max_value?: string
  min_inclusive?: boolean
  max_inclusive?: boolean
}

/** Un rango con nombre, como se edita en pantalla. */
export type RangoConNombre = Rango & { label: string }

/** Un rango con nombre, como lo manda y lo devuelve el backend. */
export type NamedRange = {
  id?: number
  label: string
  min_value?: string
  max_value?: string
  min_inclusive?: boolean
  max_inclusive?: boolean
  orden?: number
}

const rangoVacio = (): Rango => ({ modo: "rango", min: "", max: "" })

export const rangosVacios = (): RangeMap => ({
  hombre: rangoVacio(),
  mujer: rangoVacio(),
  nino: rangoVacio(),
  nina: rangoVacio(),
})

/**
 * El modo se deduce de qué límite vino: es lo único que hay guardado.
 *
 * Un rango con un solo límite se imprime `> 4,5` o `< 5,9`, así que abrirlo en
 * modo "rango" con un casillero vacío mostraría otra cosa que el informe.
 */
const modoSegunLimites = (
  min: string,
  max: string,
  minEntra: boolean,
  maxEntra: boolean,
): ModoDeRango => {
  if (min && !max) return minEntra ? "mayor_igual" : "mayor"
  if (max && !min) return maxEntra ? "menor_igual" : "menor"
  return "rango"
}

const rangoDesde = (
  min?: string,
  max?: string,
  minEntra?: boolean,
  maxEntra?: boolean,
): Rango => {
  const desdeMin = (min ?? "").trim()
  const hastaMax = (max ?? "").trim()
  // Sin la bandera se asume que el borde entra, que es como el sistema evaluó
  // siempre: un rango cargado antes de esto se abre como "≥" y no como ">".
  return {
    modo: modoSegunLimites(desdeMin, hastaMax, minEntra ?? true, maxEntra ?? true),
    min: desdeMin,
    max: hastaMax,
  }
}

/** Los límites que se mandan al backend según el modo: el lado que no va, vacío. */
const limitesDe = (rango: Rango): {
  min_value: string
  max_value: string
  min_inclusive: boolean
  max_inclusive: boolean
} => {
  const min = rango.min.trim()
  const max = rango.max.trim()
  const entra = bordeAdentro(rango.modo)

  if (esDeMinimo(rango.modo)) {
    return { min_value: min, max_value: "", min_inclusive: entra, max_inclusive: true }
  }
  if (rango.modo === "menor" || rango.modo === "menor_igual") {
    return { min_value: "", max_value: max, min_inclusive: true, max_inclusive: entra }
  }
  // Un rango de dos puntas va con las dos adentro: es como se leyó siempre y
  // es lo que se quiere el 99% de las veces.
  return { min_value: min, max_value: max, min_inclusive: true, max_inclusive: true }
}

const tieneAlgo = (rango: Rango): boolean => {
  const { min_value, max_value } = limitesDe(rango)
  return Boolean(min_value || max_value)
}

/**
 * Si el valor entra en uno de los 4 casilleros. Neonato, "cualquier sexo" y
 * los tramos por edad los carga el NBU y la grilla no los edita: el backend
 * los deja como están cuando se guarda la grilla.
 */
const esDeLaGrilla = (r: RefRange): boolean =>
  REF_GROUPS.some((g) => g.sex === r.sex && g.age_group === r.age_group) &&
  r.age_min_years == null &&
  r.age_max_years == null

/** Lo que viene del backend, en los 4 casilleros. */
export function rangosDesde(existentes?: RefRange[]): RangeMap {
  const mapa = rangosVacios()
  for (const grupo of REF_GROUPS) {
    const encontrado = (existentes || []).find(
      (r) => esDeLaGrilla(r) && r.sex === grupo.sex && r.age_group === grupo.age_group,
    )
    if (encontrado) {
      mapa[grupo.key] = rangoDesde(
        encontrado.min_value,
        encontrado.max_value,
        encontrado.min_inclusive,
        encontrado.max_inclusive,
      )
    }
  }
  return mapa
}

/** Los 4 casilleros, en lo que espera el backend. Los vacíos no van. */
export function rangosParaEnviar(ranges: RangeMap): RefRange[] {
  return REF_GROUPS.filter((g) => tieneAlgo(ranges[g.key])).map((g) => ({
    sex: g.sex,
    age_group: g.age_group,
    ...limitesDe(ranges[g.key]),
  }))
}

/** Los valores que no entran en la grilla, para mostrarlos sin editar. */
export function rangosFueraDeLaGrilla(existentes?: RefRange[]): RefRange[] {
  return (existentes || []).filter((r) => !esDeLaGrilla(r))
}

/** Si la grilla cambió respecto de lo guardado. Si no, no hace falta mandarla. */
export function grillaCambio(ranges: RangeMap, existentes?: RefRange[]): boolean {
  const antes = rangosParaEnviar(rangosDesde(existentes))
  return JSON.stringify(rangosParaEnviar(ranges)) !== JSON.stringify(antes)
}

const SEXOS: Record<string, string> = {
  male: "Hombre",
  female: "Mujer",
  any: "Cualquier sexo",
}
const EDADES: Record<string, string> = {
  neonate: "Neonato",
  child: "Niño",
  adult: "Adulto",
}

/** "Neonato · Cualquier sexo", "Hombre · 18–65 años". */
const etiquetaDe = (r: RefRange): string => {
  const partes = [SEXOS[r.sex ?? ""] ?? r.sex ?? ""]
  const desde = r.age_min_years
  const hasta = r.age_max_years
  if (desde != null && hasta != null) partes.push(`${desde}–${hasta} años`)
  else if (desde != null) partes.push(`desde ${desde} años`)
  else if (hasta != null) partes.push(`hasta ${hasta} años`)
  else partes.unshift(EDADES[r.age_group ?? ""] ?? r.age_group ?? "")
  return partes.filter(Boolean).join(" · ")
}

const textoDe = (r: RefRange): string => {
  const { modo, min, max } = rangoDesde(r.min_value, r.max_value, r.min_inclusive, r.max_inclusive)
  if (modo === "rango") return min === max ? min : `${min} – ${max}`
  return `${SIGNO[modo]} ${min || max}`
}

/** Los rangos con nombre que vienen del backend, en orden. */
export function rangosConNombreDesde(existentes?: NamedRange[]): RangoConNombre[] {
  return (existentes || []).map((r) => ({
    label: r.label || "",
    ...rangoDesde(r.min_value, r.max_value, r.min_inclusive, r.max_inclusive),
  }))
}

/** Los rangos con nombre, en lo que espera el backend. Sin nombre o sin límite, no van. */
export function rangosConNombreParaEnviar(rangos: RangoConNombre[]): NamedRange[] {
  return rangos
    .filter((r) => r.label.trim() && tieneAlgo(r))
    .map((r, indice) => ({
      label: r.label.trim(),
      ...limitesDe(r),
      orden: indice,
    }))
}

interface EditorDeRangoProps {
  rango: Rango
  onChange: (rango: Rango) => void
  disabled?: boolean
}

/** El selector de modo y los casilleros que correspondan. */
function EditorDeRango({ rango, onChange, disabled }: EditorDeRangoProps) {
  return (
    <>
      <Select
        value={rango.modo}
        onValueChange={(modo) => onChange({ ...rango, modo: modo as ModoDeRango })}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rango">Rango</SelectItem>
          {/* Los cuatro abiertos, con el signo adelante: es como se va a
              imprimir en el informe, así que no hay que traducir nada
              mentalmente entre lo que se elige y lo que sale en el papel. */}
          <SelectItem value="mayor_igual">≥ Mayor o igual</SelectItem>
          <SelectItem value="mayor">&gt; Mayor</SelectItem>
          <SelectItem value="menor_igual">≤ Menor o igual</SelectItem>
          <SelectItem value="menor">&lt; Menor</SelectItem>
        </SelectContent>
      </Select>
      {rango.modo === "rango" ? (
        <>
          <Input
            value={rango.min}
            onChange={(e) => onChange({ ...rango, min: e.target.value })}
            placeholder="Mínimo"
            disabled={disabled}
            className="h-9 text-sm"
          />
          <Input
            value={rango.max}
            onChange={(e) => onChange({ ...rango, max: e.target.value })}
            placeholder="Máximo"
            disabled={disabled}
            className="h-9 text-sm"
          />
        </>
      ) : (
        <Input
          value={esDeMinimo(rango.modo) ? rango.min : rango.max}
          onChange={(e) =>
            onChange(
              esDeMinimo(rango.modo)
                ? { ...rango, min: e.target.value }
                : { ...rango, max: e.target.value },
            )
          }
          placeholder={`${SIGNO[rango.modo]} …`}
          disabled={disabled}
          className="col-span-2 h-9 text-sm"
        />
      )}
    </>
  )
}

interface Props {
  ranges: RangeMap
  onChange: (ranges: RangeMap) => void
  /** Los rangos con nombre. Si no se pasan, la sección no aparece. */
  namedRanges?: RangoConNombre[]
  onNamedRangesChange?: (rangos: RangoConNombre[]) => void
  /** Los valores que la grilla no edita (neonato, tramos por edad): se listan sin tocar. */
  fueraDeLaGrilla?: RefRange[]
  disabled?: boolean
}

export function ValoresDeReferencia({
  ranges,
  onChange,
  namedRanges,
  onNamedRangesChange,
  fueraDeLaGrilla,
  disabled,
}: Props) {
  const setRange = (key: string, rango: Rango) => onChange({ ...ranges, [key]: rango })

  const conNombre = namedRanges ?? []
  const setNamed = (indice: number, rango: RangoConNombre) =>
    onNamedRangesChange?.(conNombre.map((r, i) => (i === indice ? rango : r)))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm">Valores de referencia (opcional)</Label>
        <p className="text-xs text-gray-500">
          Dejá vacío el grupo que no aplique. Acepta decimales con «,» o «.».
        </p>
        <div className="space-y-2">
          {REF_GROUPS.map((g) => (
            <div key={g.key} className="grid grid-cols-[80px_110px_1fr_1fr] items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{g.label}</span>
              <EditorDeRango
                rango={ranges[g.key]}
                onChange={(rango) => setRange(g.key, rango)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
        {fueraDeLaGrilla && fueraDeLaGrilla.length > 0 && (
          <div className="space-y-1 rounded-md border border-dashed border-gray-200 p-2">
            <p className="text-xs text-gray-500">
              También tiene estos, que vienen del nomenclador y no se editan acá. Guardar no los
              cambia.
            </p>
            <ul className="space-y-0.5">
              {fueraDeLaGrilla.map((r, indice) => (
                <li key={indice} className="flex flex-wrap justify-between gap-x-3 text-sm">
                  <span className="text-gray-700">{etiquetaDe(r)}</span>
                  <span className="font-mono text-gray-900">{textoDe(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {onNamedRangesChange && (
        <div className="space-y-2">
          <Label className="text-sm">Otros rangos</Label>
          <p className="text-xs text-gray-500">
            Para lo que no depende del sexo ni de la edad: se imprimen en el informe con su
            nombre, debajo del rango del paciente. No se usan para marcar fuera de rango.
          </p>
          {conNombre.length > 0 && (
            <div className="space-y-2">
              {conNombre.map((rango, indice) => (
                <div
                  key={indice}
                  className="grid grid-cols-[1fr_110px_1fr_1fr_36px] items-center gap-2"
                >
                  <Input
                    value={rango.label}
                    onChange={(e) => setNamed(indice, { ...rango, label: e.target.value })}
                    placeholder="Nombre (ej.: Deseable)"
                    disabled={disabled}
                    className="h-9 text-sm"
                  />
                  <EditorDeRango
                    rango={rango}
                    onChange={(nuevo) => setNamed(indice, { ...rango, ...nuevo })}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onNamedRangesChange(conNombre.filter((_, i) => i !== indice))
                    }
                    disabled={disabled}
                    className="h-9 w-9 text-gray-400 hover:text-red-600"
                    aria-label={`Quitar el rango ${rango.label || indice + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onNamedRangesChange([...conNombre, { label: "", ...rangoVacio() }])}
            disabled={disabled}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar rango
          </Button>
        </div>
      )}
    </div>
  )
}
