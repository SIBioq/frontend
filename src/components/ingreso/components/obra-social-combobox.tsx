"use client"

import { useState, useEffect, useMemo } from "react"
import { Check, ChevronsUpDown, Plus, Building } from "lucide-react"
import { Button } from "../../ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"
import { cn } from "../../../lib/utils"
import { useApi } from "../../../hooks/use-api"
import { useDebounce } from "../../../hooks/use-debounce"
import { getNbuDisplayName, useNbuOptions } from "@/hooks/use-nbu-options"
import type { Insurance } from "../../../types"
import { MEDICAL_ENDPOINTS } from "@/config/api"

interface ObraSocialComboboxProps {
  obrasSociales: Insurance[]
  selectedObraSocial: Insurance | null
  onObraSocialSelect: (obraSocial: Insurance | null) => void
  onShowCreateObraSocial: () => void
  /**
   * La obra social con la que este paciente vino la última vez: va primera.
   *
   * NO queda elegida. Un paciente se cambia de trabajo, pierde la cobertura o
   * entra a otra, y el que la elige por él es el que después factura contra la
   * obra social equivocada. Primera en la lista ahorra el scroll; elegida sola
   * esconde una decisión que se toma mirando el carnet.
   */
  idDeLaUltimaVez?: number | null
}

interface PaginatedResponse<T> {
  next: string | null
  results: T[]
}

export function ObraSocialCombobox({
  obrasSociales: initialObrasSociales,
  selectedObraSocial,
  onObraSocialSelect,
  onShowCreateObraSocial,
  idDeLaUltimaVez = null,
}: ObraSocialComboboxProps) {
  const { apiRequest } = useApi()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [allObrasSociales, setAllObrasSociales] = useState<Insurance[]>(initialObrasSociales)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(20)
  const { nbus } = useNbuOptions()

  const obrasSocialesOrdenadas = useMemo(() => {
    if (!idDeLaUltimaVez) return allObrasSociales
    const primera = allObrasSociales.find((o) => o.id === idDeLaUltimaVez)
    if (!primera) return allObrasSociales
    return [primera, ...allObrasSociales.filter((o) => o.id !== idDeLaUltimaVez)]
  }, [allObrasSociales, idDeLaUltimaVez])

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  useEffect(() => {
    setAllObrasSociales(initialObrasSociales)
  }, [initialObrasSociales])

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchObrasSociales(debouncedSearchTerm)
    } else {
      setAllObrasSociales(initialObrasSociales)
      setOffset(20)
      setHasMore(true)
    }
  }, [debouncedSearchTerm, initialObrasSociales])

  const searchObrasSociales = async (term: string) => {
    try {
      setIsLoading(true)
      const response = await apiRequest(
        `${MEDICAL_ENDPOINTS.INSURANCES}?search=${encodeURIComponent(term)}&limit=50&offset=0&is_active=true`,
      )

      if (response.ok) {
        const data: PaginatedResponse<Insurance> = await response.json()
        setAllObrasSociales(data.results)
        setHasMore(!!data.next)
        setOffset(data.results.length)
      }
    } catch (error) {
      console.error("Error searching obras sociales:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMoreObrasSociales = async () => {
    if (isLoading || !hasMore || debouncedSearchTerm) return

    try {
      setIsLoading(true)
      const response = await apiRequest(`${MEDICAL_ENDPOINTS.INSURANCES}?limit=20&offset=${offset}&is_active=true`)

      if (response.ok) {
        const data: PaginatedResponse<Insurance> = await response.json()
        setAllObrasSociales((prev) => [...prev, ...data.results])
        setHasMore(!!data.next)
        setOffset((prev) => prev + data.results.length)
      }
    } catch (error) {
      console.error("Error loading more obras sociales:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-gray-300 focus:border-[#204983] focus:ring-[#204983] bg-transparent"
        >
          {selectedObraSocial ? (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-[#204983]" />
              <span>{selectedObraSocial.name}</span>
              <span className="text-xs text-gray-500 ml-1">(UB: ${selectedObraSocial.ub_value})</span>
            </div>
          ) : (
            <span className="text-gray-500">Seleccionar obra social...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Buscar obra social..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandList>
            <CommandEmpty>
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">No se encontraron obras sociales</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {obrasSocialesOrdenadas.map((obraSocial, index) => {
                const flags: string[] = []
                if (obraSocial.charges_coseguro) flags.push("Coseguro")
                if (obraSocial.charges_material_descartable) flags.push("Mat. desc.")
                if (obraSocial.charges_derivacion) flags.push("Derivación")
                if (obraSocial.requires_preauthorization) flags.push("Preautorización")
                const nbuName = obraSocial.nbu ? getNbuDisplayName(obraSocial.nbu, nbus) : null

                return (
                  <CommandItem
                    key={obraSocial.id}
                    value={obraSocial.name}
                    onSelect={() => {
                      onObraSocialSelect(selectedObraSocial?.id === obraSocial.id ? null : obraSocial)
                      setOpen(false)
                    }}
                    ref={
                      index === obrasSocialesOrdenadas.length - 5
                        ? (el: HTMLDivElement | null) => {
                            if (el) loadMoreObrasSociales()
                          }
                        : undefined
                    }
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedObraSocial?.id === obraSocial.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex items-start gap-2 flex-grow min-w-0">
                      <Building className="h-4 w-4 text-[#204983] mt-0.5 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{obraSocial.name}</span>
                          {obraSocial.id === idDeLaUltimaVez && (
                            // El cartel dice POR QUÉ está arriba. Sin él el
                            // orden parece arbitrario y quien atiende busca el
                            // nombre a mano igual.
                            <span className="rounded-full bg-[#204983]/10 px-2 py-0.5 text-[10px] font-medium text-[#204983]">
                              La última vez
                            </span>
                          )}
                          {nbuName && (
                            <span className="text-[10px] font-mono text-[#204983] bg-[#204983]/10 rounded px-1.5 py-0.5">
                              {nbuName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          UB O.S.: ${obraSocial.ub_value} · UB Part.: ${obraSocial.private_ub_value}
                        </span>
                        {flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {flags.map((flag) => (
                              <span
                                key={flag}
                                className="inline-block rounded-full bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
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
                  onShowCreateObraSocial()
                  setOpen(false)
                }}
                className="w-full border-[#204983] text-[#204983] hover:bg-[#204983] hover:text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Crear nueva obra social
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
