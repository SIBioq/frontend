"use client"

import type React from "react"
import type { Analysis } from "@/types"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DialogHeading } from "@/components/common/dialog-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApi } from "@/hooks/use-api"
import { usePreciosFijos } from "@/hooks/use-precios-fijos"
import { useToast } from "@/hooks/use-toast"
import { Loader2, TestTube } from "lucide-react"
import { CATALOG_ENDPOINTS } from "@/config/api"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import { useNbuOptions } from "@/hooks/use-nbu-options"
import { CampoPrecioFijo } from "./campo-precio-fijo"
import { CampoUbPorNomenclador } from "./campo-ub-por-nomenclador"
import {
  determinacionVacia,
  DeterminacionesDelAlta,
  paraEnviar,
  validar,
  type DeterminacionEnEdicion,
} from "./determinaciones-del-alta"

interface CreateAnalysisCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (newAnalysis: Analysis) => void
}

export const CreateAnalysisCatalogDialog: React.FC<CreateAnalysisCatalogDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { apiRequest } = useApi()
  const toastActions = useToast()
  const { habilitados: preciosFijosHabilitados } = usePreciosFijos()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [isUrgent, setIsUrgent] = useState(false)
  const [llevaResultado, setLlevaResultado] = useState(true)
  const [requiresDerivacion, setRequiresDerivacion] = useState(false)
  const [cobraPrecioFijo, setCobraPrecioFijo] = useState(false)
  const [precioParticular, setPrecioParticular] = useState("")
  const [category, setCategory] = useState<string>("")
  const [isObsolete, setIsObsolete] = useState(false)
  const [isRefNormalized, setIsRefNormalized] = useState(false)
  const [esModulo, setEsModulo] = useState(false)
  // EL UB SE CARGA ACÁ, NO DESPUÉS
  //
  // Este bloque estaba solo en la edición. Un análisis recién dado de alta
  // existía, aparecía en el buscador del ingreso y se podía pedir — y cotizaba
  // cero hasta que alguien se acordara de entrar a editarlo para cargarle el
  // UB. Es el mismo componente que usa la edición: es el mismo dato.
  //
  // En su lugar había un campo "Unidad Bioquímica" que escribía `bio_unit`, un
  // segundo número para lo mismo que no interviene en el precio. Ahora lo
  // deriva el backend del UB del principal (ver `sincronizar_bio_unit`).
  const { nbus } = useNbuOptions()
  const [ubPorNbu, setUbPorNbu] = useState<Record<number, string>>({})
  const [determinaciones, setDeterminaciones] = useState<DeterminacionEnEdicion[]>([
    determinacionVacia(),
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setCode("")
      setName("")
      setIsUrgent(false)
      setLlevaResultado(true)
      setRequiresDerivacion(false)
      setCobraPrecioFijo(false)
      setPrecioParticular("")
      setCategory("")
      setIsObsolete(false)
      setIsRefNormalized(false)
      setEsModulo(false)
      setUbPorNbu({})
      setDeterminaciones([determinacionVacia()])
      setErrors({})
      setIsLoading(false)
    }
  }, [open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "El nombre es requerido."
    // Alfanumérico: la mayoría son los 6 dígitos del NBU, pero el laboratorio
    // también numera sus propias prácticas (`A15`, `INT-3`).
    if (!code.trim()) newErrors.code = "El código es requerido."
    else if (!/^[\w.-]+$/.test(code.trim()))
      newErrors.code = "El código no puede tener espacios ni símbolos raros."
    // Con precio fijo la UB no cobra nada, y estas son justamente las
    // prácticas que no están en ningún nomenclador. Exigírsela obligaría a
    // inventarle una, que es lo que la función vino a evitar.
    const cobraFijo = cobraPrecioFijo && preciosFijosHabilitados
    // `nbus.length > 0` no es una formalidad: el bloque del UB no se dibuja sin
    // nomencladores, así que exigirlo cuando la lista todavía está viajando
    // —o cuando el laboratorio no tiene ninguno cargado— dejaría el alta
    // trabada con un error que no tiene dónde mostrarse.
    if (!cobraFijo && nbus.length > 0 && !nbus.some((nbu) => (ubPorNbu[nbu.id] ?? "").trim())) {
      newErrors.ub = "Cargá el UB en al menos un nomenclador: sin ninguno el análisis cotiza cero."
    }
    if (cobraFijo) {
      const precio = Number.parseFloat(precioParticular)
      if (!precioParticular.trim() || Number.isNaN(precio) || precio < 0) {
        newErrors.precioParticular = "Poné un precio válido (0 o más)."
      }
    }

    const problema = validar(determinaciones, esModulo)
    if (problema) newErrors.determinaciones = problema

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      const analysisData = {
        code: code.trim(),
        name,
        is_urgent: isUrgent,
        lleva_resultado: llevaResultado,
        requires_derivacion: requiresDerivacion,
        cobra_precio_fijo: cobraPrecioFijo && preciosFijosHabilitados,
        ...(cobraPrecioFijo && preciosFijosHabilitados
          ? { precio_particular: precioParticular }
          : {}),
        ...(category ? { category } : {}),
        is_obsolete: isObsolete,
        is_ref_normalized: isRefNormalized,
        // Se crean en la misma transacción que el análisis: si algo falla, no
        // queda un análisis a medio armar. Los UB van igual y por lo mismo: un
        // análisis creado sin ellos cotiza cero.
        determinations: paraEnviar(determinaciones, name, esModulo),
        ub_por_nomenclador: nbus
          .filter((nbu) => (ubPorNbu[nbu.id] ?? "").trim())
          .map((nbu) => ({ nbu_id: nbu.id, value: ubPorNbu[nbu.id].trim() })),
      }
      const response = await apiRequest(CATALOG_ENDPOINTS.ANALYSIS, {
        method: "POST",
        body: analysisData,
      })

      if (response.ok) {
        const newAnalysis = await response.json()
        toastActions.success("Éxito", { description: "Análisis creado correctamente." })
        onSuccess(newAnalysis)
        onOpenChange(false)
      } else {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }))
        const errorMessage = formatApiError(errorData, "No se pudo crear el análisis.")
        const backendErrors = errorData.errors || errorData.detail || errorData
        if (typeof backendErrors === "object" && backendErrors !== null) {
          const formattedErrors: Record<string, string> = {}
          for (const key in backendErrors) {
            if (Array.isArray(backendErrors[key])) {
              formattedErrors[key] = backendErrors[key].join(", ")
            } else {
              formattedErrors[key] = backendErrors[key]
            }
          }
          setErrors(formattedErrors)
        } else {
          setErrors({ form: backendErrors || "Error al crear el análisis." })
        }
        toastActions.error("Error", { description: errorMessage })
      }
    } catch (error) {
      console.error("Error creating analysis:", error)
      const errorMessage = getErrorMessage(error, "Ocurrió un error de red o servidor.")
      setErrors({ form: errorMessage })
      toastActions.error("Error", { description: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeading icon={TestTube} title="Nuevo análisis" description="Completá los datos para el nuevo análisis." />
        <div className="space-y-6 py-4">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{errors.form}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ej: 660412, o A15 para una práctica propia"
            />
            {errors.code && <p className="text-sm text-red-500">{errors.code}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingrese el nombre del análisis"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <CampoUbPorNomenclador
            nbus={nbus}
            valores={ubPorNbu}
            onChange={setUbPorNbu}
            error={errors.ub}
            disabled={isLoading}
          />

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="isUrgent" className="font-medium">
                Análisis Urgente
              </Label>
              <p className="text-sm text-gray-500">Marcar si este análisis es de carácter urgente</p>
            </div>
            <Switch id="isUrgent" checked={isUrgent} onCheckedChange={setIsUrgent} />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="requiresDerivacion" className="font-medium">
                Requiere derivación
              </Label>
              <p className="text-sm text-gray-500">
                Si la obra social cobra derivación, este análisis suma el monto fijo.
              </p>
            </div>
            <Switch
              id="requiresDerivacion"
              checked={requiresDerivacion}
              onCheckedChange={setRequiresDerivacion}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="llevaResultado" className="font-medium">
                Lleva resultado
              </Label>
              <p className="text-sm text-gray-500">
                Si se desactiva, la práctica aparece en el protocolo, pero no se carga, valida ni incluye en el informe clínico.
              </p>
            </div>
            <Switch id="llevaResultado" checked={llevaResultado} onCheckedChange={setLlevaResultado} />
          </div>

          <CampoPrecioFijo
            habilitado={preciosFijosHabilitados}
            cobraPrecioFijo={cobraPrecioFijo}
            onCobraPrecioFijoChange={setCobraPrecioFijo}
            precio={precioParticular}
            onPrecioChange={setPrecioParticular}
            error={errors.precioParticular}
          />

          <div className="space-y-2">
            <Label htmlFor="category">Categoría NBU</Label>
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin clasificar</SelectItem>
                <SelectItem value="pmo">PMO</SelectItem>
                <SelectItem value="pe">PE</SelectItem>
                <SelectItem value="gestion">Gestión</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="isObsolete" className="font-medium">
                En desuso
              </Label>
              <p className="text-sm text-gray-500">Práctica dada de baja del nomenclador (sin UB vigente).</p>
            </div>
            <Switch id="isObsolete" checked={isObsolete} onCheckedChange={setIsObsolete} />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="isRefNormalized" className="font-medium">
                Normalizado (N)
              </Label>
              <p className="text-sm text-gray-500">Marca "N" del NBU (referencia normalizada).</p>
            </div>
            <Switch id="isRefNormalized" checked={isRefNormalized} onCheckedChange={setIsRefNormalized} />
          </div>

          <div className="space-y-4 rounded-lg border border-[#204983]/20 bg-[#204983]/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="esModulo" className="font-medium">
                  ¿Es un módulo?
                </Label>
                <p className="text-sm text-gray-500">
                  Un módulo agrupa varias determinaciones (ej: Hemograma). Si no lo es, se
                  crea una sola con el mismo nombre del análisis.
                </p>
              </div>
              <Switch
                id="esModulo"
                checked={esModulo}
                onCheckedChange={(valor) => {
                  setEsModulo(valor)
                  // Al pasar a módulo se arranca con la que ya se estaba
                  // cargando; al volver, se deja solo la primera: las demás
                  // no tendrían dónde ir.
                  setDeterminaciones((previas) =>
                    valor ? previas : previas.slice(0, 1),
                  )
                }}
              />
            </div>

            <DeterminacionesDelAlta
              esModulo={esModulo}
              nombreDelAnalisis={name}
              determinaciones={determinaciones}
              onChange={setDeterminaciones}
              disabled={isLoading}
            />
            {errors.determinaciones && (
              <p className="text-sm text-red-500">{errors.determinaciones}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            style={{ backgroundColor: "#204983", color: "white" }}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Análisis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
