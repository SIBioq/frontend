"use client"

import { useState } from "react"
import { Check, Keyboard, Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { RESULTS_ENDPOINTS } from "@/config/api"
import { PERMISSIONS, PERMISSION_MESSAGES } from "@/config/permissions"
import useAuth from "@/contexts/auth-context"
import { useApi } from "@/hooks/use-api"
import { useMacrosDeResultado, teclaDelEvento } from "@/hooks/use-macros-de-resultado"
import { useToast } from "@/hooks/use-toast"
import { formatApiError, getErrorMessage } from "@/lib/api-error"
import type { MacroDeResultado } from "@/types"

/**
 * Los atajos `Alt + tecla` de la pantalla de carga de resultados.
 *
 * QUÉ RESUELVEN
 * =============
 * Los cualitativos. "No se observan elementos", "Negativo", "Reacción no
 * reactiva": textos largos que se tipean decenas de veces por jornada, siempre
 * iguales. Cada uno es una oportunidad de escribirlo distinto —"negativo",
 * "NEGATIVO", "Neg."— y de que el informe salga con tres redacciones para el
 * mismo hallazgo.
 *
 * SON DEL LABORATORIO, NO DE CADA USUARIO
 * =======================================
 * Justamente por eso. Si cada persona tuviera las suyas, dos bioquímicas
 * cargando la misma determinación escribirían dos textos distintos con la
 * misma tecla — que es el problema que esto viene a resolver.
 *
 * SE EDITAN EN LA FILA, NO EN UN DIÁLOGO
 * ======================================
 * Una macro son dos campos. Un diálogo para eso tapa la lista justo cuando lo
 * que se está decidiendo es qué tecla queda libre y qué dicen las demás — que
 * es la información que hay que tener a la vista para elegir bien.
 */

const VACIA = { tecla: "", texto: "" }

/** Los dos campos de una macro. Los mismos en el alta y en la edición. */
type Campos = { tecla: string; texto: string }

/**
 * LA TECLA SE APRIETA, NO SE ESCRIBE
 * ==================================
 * El campo se completa apretando la combinación de verdad. Es la única forma
 * de que quien la configura compruebe en el momento que Alt + esa tecla hace
 * algo en su teclado: escribir "n" a mano y descubrir después que en esa
 * máquina la combinación estaba tomada es el modo de que un atajo nazca roto.
 *
 * Está suelto y no adentro del formulario del alta porque lo usan los dos —el
 * alta y la fila que se está editando— y duplicarlo garantizaba que un día se
 * comporten distinto.
 */
function CamposDeLaMacro({
  valores,
  onChange,
  onError,
  onEnter,
  onEscape,
  disabled,
  idTecla,
  idTexto,
  autoFocus,
}: {
  valores: Campos
  onChange: (valores: Campos) => void
  onError: (mensaje: string) => void
  onEnter?: () => void
  onEscape?: () => void
  disabled?: boolean
  idTecla: string
  idTexto: string
  autoFocus?: boolean
}) {
  const capturarTecla = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab se deja pasar: es la forma de salir del campo, y capturarlo dejaría
    // el formulario sin manera de recorrerse con el teclado.
    if (evento.key === "Tab") return
    if (evento.key === "Escape") {
      onEscape?.()
      return
    }
    // Alt sola es el PRIMER evento de la combinación: hay que apretarla antes
    // que la letra. Tratarla como una tecla inválida mostraba el error justo
    // en el momento en que la persona estaba haciendo lo correcto.
    if (["Alt", "Shift", "Control", "Meta"].includes(evento.key)) return
    evento.preventDefault()

    if (!evento.altKey) {
      onError("Apretá Alt junto con la tecla, como se va a usar después.")
      return
    }
    const tecla = teclaDelEvento(evento.code)
    if (!tecla) {
      // Las flechas son las únicas que `teclaDelEvento` rechaza a propósito
      // (ver su comentario): están reservadas para moverse entre resultados,
      // y decirlo acá evita que alguien insista pensando que es un bug.
      if (evento.code.startsWith("Arrow")) {
        onError("Alt + flechas está reservado para moverse entre resultados.")
        return
      }
      onError("Esa tecla no sirve para un atajo. Tiene que ser una letra o un número.")
      return
    }
    onError("")
    onChange({ ...valores, tecla })
  }

  return (
    <>
      <div className="space-y-1.5 sm:w-40">
        <label htmlFor={idTecla} className="text-sm font-medium text-gray-700">
          Atajo
        </label>
        <Input
          id={idTecla}
          value={valores.tecla ? `Alt + ${valores.tecla}` : ""}
          onKeyDown={capturarTecla}
          // Sin `readOnly`: el campo tiene que poder recibir foco para capturar
          // la combinación. Lo que se escriba con el teclado ya lo intercepta
          // `capturarTecla`; esto cubre el pegado.
          onChange={() => undefined}
          placeholder="Apretá Alt + tecla"
          autoComplete="off"
          disabled={disabled}
          className="text-center font-medium"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <label htmlFor={idTexto} className="text-sm font-medium text-gray-700">
          Texto que carga
        </label>
        <Input
          id={idTexto}
          value={valores.texto}
          onChange={(evento) => onChange({ ...valores, texto: evento.target.value })}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && onEnter) {
              evento.preventDefault()
              onEnter()
            }
            if (evento.key === "Escape") onEscape?.()
          }}
          placeholder="ej: No se observan elementos"
          maxLength={255}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    </>
  )
}

export function MacrosManagement() {
  const { apiRequest } = useApi()
  const { hasPermission } = useAuth()
  const toastActions = useToast()
  const { macros, isLoading, refetch } = useMacrosDeResultado()

  // Mismo permiso que carga resultados: configurar una macro es decidir con
  // qué palabras se carga un cualitativo, y eso lo decide quien carga.
  const puedeEditar = hasPermission(PERMISSIONS.MANAGE_RESULTS.codename)

  const [nueva, setNueva] = useState<Campos>(VACIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  // Qué fila se está editando, y con qué valores. `null` = ninguna.
  const [editando, setEditando] = useState<number | null>(null)
  const [edicion, setEdicion] = useState<Campos>(VACIA)
  const [errorDeLaFila, setErrorDeLaFila] = useState("")

  const [ocupado, setOcupado] = useState<number | null>(null)

  const abrirEdicion = (macro: MacroDeResultado) => {
    setEditando(macro.id)
    setEdicion({ tecla: macro.tecla, texto: macro.texto })
    setErrorDeLaFila("")
  }

  const cerrarEdicion = () => {
    setEditando(null)
    setErrorDeLaFila("")
  }

  const agregar = async () => {
    const texto = nueva.texto.trim()
    if (!nueva.tecla) {
      setError("Apretá Alt y la tecla que querés usar.")
      return
    }
    if (!texto) {
      setError("Escribí el texto que la macro tiene que cargar.")
      return
    }

    setGuardando(true)
    try {
      const respuesta = await apiRequest(RESULTS_ENDPOINTS.MACROS, {
        method: "POST",
        body: { tecla: nueva.tecla, texto },
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo guardar la macro."))
      }
      setNueva(VACIA)
      setError("")
      refetch()
      toastActions.success("Macro guardada", {
        description: `Alt + ${nueva.tecla} carga «${texto}».`,
      })
    } catch (problema) {
      const mensaje = getErrorMessage(problema, "No se pudo guardar la macro.")
      setError(mensaje)
      toastActions.error("Error", { description: mensaje })
    } finally {
      setGuardando(false)
    }
  }

  const guardarEdicion = async (macro: MacroDeResultado) => {
    const texto = edicion.texto.trim()
    if (!edicion.tecla) {
      setErrorDeLaFila("Apretá Alt y la tecla que querés usar.")
      return
    }
    if (!texto) {
      setErrorDeLaFila("Escribí el texto que la macro tiene que cargar.")
      return
    }
    // Sin cambios se cierra y no se le pega al backend: guardar por guardar
    // deja un evento en la auditoría de algo que no pasó.
    if (edicion.tecla === macro.tecla && texto === macro.texto) {
      cerrarEdicion()
      return
    }

    setOcupado(macro.id)
    try {
      const respuesta = await apiRequest(RESULTS_ENDPOINTS.MACRO_DETAIL(macro.id), {
        method: "PATCH",
        body: { tecla: edicion.tecla, texto },
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo guardar la macro."))
      }
      cerrarEdicion()
      refetch()
      toastActions.success("Macro actualizada", {
        description: `Alt + ${edicion.tecla} carga «${texto}».`,
      })
    } catch (problema) {
      // El error se muestra EN LA FILA y la edición queda abierta: si se
      // cerrara, lo tipeado se perdería justo cuando hay que corregirlo.
      setErrorDeLaFila(getErrorMessage(problema, "No se pudo guardar la macro."))
    } finally {
      setOcupado(null)
    }
  }

  const borrar = async (macro: MacroDeResultado) => {
    setOcupado(macro.id)
    try {
      const respuesta = await apiRequest(RESULTS_ENDPOINTS.MACRO_DETAIL(macro.id), {
        method: "DELETE",
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(formatApiError(datos, "No se pudo borrar la macro."))
      }
      refetch()
      // Borrar una macro no toca ningún resultado ya cargado: el texto se
      // copió al apretar la tecla y desde entonces el resultado es dueño de su
      // valor. Decirlo saca la duda de si esto reescribe algo hacia atrás.
      toastActions.success("Macro borrada", {
        description: "Los resultados que ya se cargaron con ella no cambian.",
      })
    } catch (problema) {
      toastActions.error("Error", {
        description: getErrorMessage(problema, "No se pudo borrar la macro."),
      })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <Keyboard className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#204983]" />
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Macros de resultados</h4>
            <p className="text-xs text-gray-500">
              En la pantalla de carga, <strong>Alt + la tecla</strong> escribe el texto completo en
              el campo del resultado. Son para los cualitativos, que son los que se repiten iguales
              todo el día. Valen para todo el laboratorio: así el informe dice siempre lo mismo.
            </p>
          </div>
        </div>

        {!puedeEditar && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              <span className="font-semibold">Solo lectura.</span>{" "}
              {PERMISSION_MESSAGES.MANAGE_RESULTS}
            </span>
          </div>
        )}

        {puedeEditar && (
          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              agregar()
            }}
            className="mb-4 space-y-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <CamposDeLaMacro
                valores={nueva}
                onChange={setNueva}
                onError={setError}
                disabled={guardando}
                idTecla="macro-tecla"
                idTexto="macro-texto"
              />
              <Button
                type="submit"
                disabled={guardando}
                className="bg-[#204983] hover:bg-[#1a3d6f]"
              >
                {guardando ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Agregar
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 rounded" />
            <Skeleton className="h-11 rounded" />
          </div>
        ) : macros.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
            No hay ninguna macro todavía. La primera candidata suele ser el texto que más se repite
            en los cualitativos.
          </p>
        ) : (
          <ul className="space-y-2">
            {macros.map((macro) => {
              const enEdicion = editando === macro.id
              const trabajando = ocupado === macro.id

              if (enEdicion) {
                return (
                  <li
                    key={macro.id}
                    className="space-y-2 rounded-lg border border-[#204983] bg-[#204983]/5 p-2.5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <CamposDeLaMacro
                        valores={edicion}
                        onChange={setEdicion}
                        onError={setErrorDeLaFila}
                        onEnter={() => guardarEdicion(macro)}
                        onEscape={cerrarEdicion}
                        disabled={trabajando}
                        idTecla={`macro-tecla-${macro.id}`}
                        idTexto={`macro-texto-${macro.id}`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => guardarEdicion(macro)}
                          disabled={trabajando}
                          className="bg-[#204983] hover:bg-[#1a3d6f]"
                        >
                          {trabajando ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cerrarEdicion}
                          disabled={trabajando}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                    {errorDeLaFila && <p className="text-sm text-red-600">{errorDeLaFila}</p>}
                  </li>
                )
              }

              return (
                <li
                  key={macro.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5"
                >
                  <kbd className="shrink-0 rounded border border-gray-300 bg-gray-50 px-2 py-1 font-sans text-xs font-medium text-gray-700">
                    Alt + {macro.tecla}
                  </kbd>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{macro.texto}</span>
                  {puedeEditar && (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicion(macro)}
                        disabled={trabajando}
                        aria-label={`Editar la macro Alt + ${macro.tecla}`}
                        className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-[#204983]/10 hover:text-[#204983] disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => borrar(macro)}
                        disabled={trabajando}
                        aria-label={`Borrar la macro Alt + ${macro.tecla}`}
                        className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        {trabajando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
