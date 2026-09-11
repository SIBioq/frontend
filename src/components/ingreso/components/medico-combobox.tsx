"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Check, ChevronsUpDown, Plus, User } from "lucide-react"
import { Button } from "../../ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"
import { cn } from "../../../lib/utils"
import { useApi } from "../../../hooks/use-api"
import { useDebounce } from "../../../hooks/use-debounce"
import type { Medico } from "../../../types"
import { MEDICAL_ENDPOINTS } from "@/config/api"

interface MedicoComboboxProps {
  medicos: Medico[]
  selectedMedico: Medico | null
  onMedicoSelect: (medico: Medico | null) => void
  onShowCreateMedico: () => void
  /**
   * El médico con el que este paciente vino la última vez: va primero.
   *
   * Sube en la lista y lleva un cartel que dice de dónde salió. NO queda
   * elegido: el paciente puede venir con otro médico, y elegir por él esconde
   * una decisión que alguien tiene que tomar mirando la orden.
   */
  idDeLaUltimaVez?: number | null
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export function MedicoCombobox({
  medicos: initialMedicos,
  selectedMedico,
  onMedicoSelect,
  onShowCreateMedico,
  idDeLaUltimaVez = null,
}: MedicoComboboxProps) {
  const { apiRequest } = useApi()
  const [open, setOpen] = useState(false)
  // "Crear nuevo médico" cierra el desplegable, y al cerrarse el desplegable
  // devuelve el foco a este botón: se lo sacaría al formulario que se acaba de
  // abrir. Con esto, ese cierre en particular no lo devuelve.
  const pidioCrear = useRef(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [allMedicos, setAllMedicos] = useState<Medico[]>(initialMedicos)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(20) // Start from 20 since we already have the first 20

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  useEffect(() => {
    setAllMedicos(initialMedicos)
  }, [initialMedicos])

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchMedicos(debouncedSearchTerm)
    } else {
      setAllMedicos(initialMedicos)
      setOffset(20)
      setHasMore(true)
    }
  }, [debouncedSearchTerm, initialMedicos])

  const searchMedicos = async (term: string) => {
    try {
      setIsLoading(true)
      const response = await apiRequest(
        `${MEDICAL_ENDPOINTS.DOCTORS}?search=${encodeURIComponent(term)}&limit=50&offset=0&is_active=true`,
      )

      if (response.ok) {
        const data: PaginatedResponse<Medico> = await response.json()
        setAllMedicos(data.results)
        setHasMore(!!data.next)
        setOffset(data.results.length)
      }
    } catch (error) {
      console.error("Error searching medicos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMoreMedicos = async () => {
    if (isLoading || !hasMore || debouncedSearchTerm) return

    try {
      setIsLoading(true)
      const response = await apiRequest(`${MEDICAL_ENDPOINTS.DOCTORS}?limit=20&offset=${offset}&is_active=true`)

      if (response.ok) {
        const data: PaginatedResponse<Medico> = await response.json()
        setAllMedicos((prev) => [...prev, ...data.results])
        setHasMore(!!data.next)
        setOffset((prev) => prev + data.results.length)
      }
    } catch (error) {
      console.error("Error loading more medicos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const medicosOrdenados = useMemo(() => {
    if (!idDeLaUltimaVez) return allMedicos
    const primero = allMedicos.find((m) => m.id === idDeLaUltimaVez)
    if (!primero) return allMedicos
    return [primero, ...allMedicos.filter((m) => m.id !== idDeLaUltimaVez)]
  }, [allMedicos, idDeLaUltimaVez])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-gray-300 focus:border-[#204983] focus:ring-[#204983] bg-transparent"
        >
          {selectedMedico ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#204983]" />
              <span>{`${selectedMedico.first_name} ${selectedMedico.last_name}`}</span>
            </div>
          ) : (
            <span className="text-gray-500">Seleccionar médico...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onCloseAutoFocus={(event) => {
          if (!pidioCrear.current) return
          pidioCrear.current = false
          event.preventDefault()
        }}
      >
        <Command>
          <CommandInput placeholder="Buscar médico..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandList>
            <CommandEmpty>
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">No se encontraron médicos</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {medicosOrdenados.map((medico, index) => (
                <CommandItem
                  key={medico.id}
                  value={`${medico.first_name} ${medico.last_name}`}
                  onSelect={() => {
                    onMedicoSelect(selectedMedico?.id === medico.id ? null : medico)
                    setOpen(false)
                  }}
                  ref={
                    index === medicosOrdenados.length - 5
                      ? (el: HTMLDivElement | null) => {
                          if (el) loadMoreMedicos()
                        }
                      : undefined
                  }
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", selectedMedico?.id === medico.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-[#204983]" />
                    <span className="min-w-0 truncate">{`${medico.first_name} ${medico.last_name}`}</span>
                    {medico.id === idDeLaUltimaVez && (
                      // El cartel dice POR QUÉ está arriba. Sin él, el orden
                      // parece arbitrario y quien atiende igual busca el nombre
                      // a mano — la lista quedaría reordenada para nada.
                      <span className="ml-auto shrink-0 rounded-full bg-[#204983]/10 px-2 py-0.5 text-[10px] font-medium text-[#204983]">
                        La última vez
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center p-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#204983] mr-2" />
                  <span className="text-sm text-gray-500">Cargando...</span>
                </div>
              )}
            </CommandGroup>
            <div className="border-t p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pidioCrear.current = true
                  onShowCreateMedico()
                  setOpen(false)
                }}
                className="w-full border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Crear nuevo médico
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
