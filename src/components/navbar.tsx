"use client"

import type React from "react"
import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { Menu, X, Search } from "lucide-react"
import useAuth from "@/contexts/auth-context"
import { cerrarSesionConAnimacion, recordarFormaDeLaNavbar } from "@/lib/forma-de-la-navbar"
import { useCierreDeSesion } from "@/hooks/use-cierre-de-sesion"
import { BotonDeUsuario, MenuDeUsuario } from "./user-dropdown"
import { PERMISSIONS } from "@/config/permissions"
import { GlobalSearch } from "@/components/search/global-search"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { useHayBorradorDeIngreso } from "@/hooks/use-hay-borrador-de-ingreso"

// En pantallas táctiles el hover no existe (el navegador lo emula con el tap y
// deja la barra "pegada"), así que ahí la búsqueda se abre solo con el botón.
const supportsHover = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches

// El logo y la barra están separados por el padding de la navbar: sin esta
// gracia, salir del logo la cerraría justo cuando el mouse va en camino.
const LOGO_HOVER_GRACE_MS = 250

/**
 * LAS TRES FORMAS DE LA BARRA.
 * ============================
 * - `completa`: una sola fila, tres accesos a cada lado del logo.
 * - `dos-pisos`: el logo y el usuario arriba; los seis accesos en una segunda
 *   fila, repartidos a los dos lados del eje del logo.
 * - `celular`: el menú ☰ y el avatar solo; el nombre va adentro del menú.
 *
 * No hay cortes fijos: la barra se mide (con una copia invisible, el nombre
 * del usuario en su mínimo) y elige la más completa que entra. Así se resuelve
 * igual el zoom del navegador, la letra grande del sistema y un rol con menos
 * accesos. Antes pasaba a celular en 1024 px fijos y entre 1024 y 1055 el
 * avatar se salía de la barra.
 */
type Forma = "completa" | "dos-pisos" | "celular"

/** Lo que la barra ocupa además de su contenido: 16+16 del wrapper y 32 del `px-8`, por lado. */
const MARGENES_DE_LA_BARRA = 128
/** El aire entre los accesos de la derecha y el usuario, y el `mx-8` del logo. */
const AIRE_DEL_USUARIO = 32
const AIRE_DEL_LOGO = 64
/** El `gap-x-8` entre las dos mitades del segundo piso. */
const AIRE_DEL_SEGUNDO_PISO = 32

/** Antes de medir: lo que daría la letra de siempre. */
const formaEstimada = (): Forma => {
  if (typeof window === "undefined") return "completa"
  const ancho = document.documentElement.clientWidth || window.innerWidth
  return ancho >= 1260 ? "completa" : ancho >= 791 ? "dos-pisos" : "celular"
}

interface NavLinkProps {
  to: string
  children: React.ReactNode
  isActive?: boolean
  onClick?: () => void
  /** Hay un ingreso a medias esperando: el ítem se pinta en ámbar para que se
   *  vea desde cualquier pantalla. No se usa junto con `isActive`: estando en la
   *  pantalla, el pendiente ya está a la vista. */
  destacado?: boolean
  tabIndex?: number
  className?: string
}

const NavLink: React.FC<NavLinkProps> = ({ to, children, isActive, onClick, destacado, tabIndex, className = "" }) => {
  // El aviso sólo se muestra si no estamos ya parados en la pantalla del ítem.
  const avisoDestacado = destacado && !isActive

  return (
    <Link
      to={to}
      onClick={onClick}
      tabIndex={tabIndex}
      title={avisoDestacado ? "Quedó un protocolo sin enviar" : undefined}
      className={`
        group relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors duration-200
        ${avisoDestacado ? "text-amber-600 hover:text-amber-700" : "hover:text-[#204983] text-gray-700"}
        ${isActive ? "text-[#204983]" : ""}
        ${className}
      `}
    >
      {children}
      {avisoDestacado && <span className="sr-only"> (quedó un protocolo sin enviar)</span>}
      <span
        className={`
          absolute bottom-0 left-0 w-full h-0.5 transition-all duration-200
          ${avisoDestacado ? "bg-amber-500 opacity-100" : "bg-[#204983]"}
          ${avisoDestacado ? "" : isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
      />
    </Link>
  )
}

const ID_DEL_MENU = "menu-de-usuario"

export const Navbar: React.FC = () => {
  const { user, hasPermission, logout } = useAuth()
  const location = useLocation()
  const scrollState = useScrollReveal()
  // Reactivo: si en esta PC quedó un ingreso a medias, el ítem "Ingreso" se
  // pinta en ámbar. Va antes del `if (!user)` de abajo para no romper la
  // regla de los hooks.
  const hayBorrador = useHayBorradorDeIngreso()
  const navRef = useRef<HTMLElement>(null)
  // Alto real medido, no un valor fijo: la navbar cambia de alto entre sus
  // tres formas, y el espaciador tiene que coincidir exacto o el salto se ve.
  const [navHeight, setNavHeight] = useState(0)
  const [forma, setForma] = useState<Forma>(formaEstimada)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [abiertoConTeclado, setAbiertoConTeclado] = useState(false)
  // Solo el logo despliega la búsqueda; el resto de la navbar no hace nada.
  const [isLogoHovered, setIsLogoHovered] = useState(false)
  // Búsqueda abierta a propósito (tap en mobile o Ctrl/⌘+K), no por hover.
  const [isSearchPinned, setIsSearchPinned] = useState(false)
  // La barra blanca que se ve. Su forma es a lo que aterriza el login.
  const barra = useRef<HTMLDivElement>(null)
  // Cerrando sesión: la navbar se va para arriba y se lleva sus menús.
  const cerrandoSesion = useCierreDeSesion()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const botonDeUsuario = useRef<HTMLButtonElement>(null)
  const logoHoverTimerRef = useRef<number | null>(null)

  // La copia invisible con la que se mide.
  const medidaIzquierda = useRef<HTMLDivElement>(null)
  const medidaDerecha = useRef<HTMLDivElement>(null)
  const medidaUsuario = useRef<HTMLDivElement>(null)
  const medidaLogo = useRef<HTMLImageElement>(null)
  const medidaIzquierda2 = useRef<HTMLDivElement>(null)
  const medidaDerecha2 = useRef<HTMLDivElement>(null)

  const celular = forma === "celular"

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev)
    setIsUserMenuOpen(false)
    setIsSearchPinned(false)
  }

  const toggleUserMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    // `detail` en 0: lo abrió el teclado (Enter o espacio), y el foco va al
    // primer ítem. Con el mouse o el dedo el foco se queda en el botón.
    setAbiertoConTeclado(e.detail === 0)
    setIsUserMenuOpen((prev) => !prev)
    // Nunca hay dos desplegados a la vez.
    setIsMobileMenuOpen(false)
    setIsSearchPinned(false)
  }

  const cerrarMenuDeUsuario = useCallback((devolverFoco = false) => {
    setIsUserMenuOpen(false)
    if (devolverFoco) botonDeUsuario.current?.focus()
  }, [])

  const toggleSearch = () => {
    // Los tres paneles cuelgan del mismo borde de la navbar: solo uno a la vez.
    setIsSearchPinned((prev) => {
      if (!prev) {
        setIsMobileMenuOpen(false)
        setIsUserMenuOpen(false)
      }
      return !prev
    })
  }

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false)
    setIsUserMenuOpen(false)
    setIsSearchPinned(false)
  }

  const closeSearch = useCallback(() => setIsSearchPinned(false), [])

  /** Cerrar sesión, pero recién cuando la pantalla quedó limpia. */
  const cerrarSesion = () => {
    setIsUserMenuOpen(false)
    cerrarSesionConAnimacion(() => logout(true))
  }

  const cancelLogoHoverClose = useCallback(() => {
    if (logoHoverTimerRef.current === null) return
    window.clearTimeout(logoHoverTimerRef.current)
    logoHoverTimerRef.current = null
  }, [])

  const handleLogoMouseEnter = useCallback(() => {
    if (!supportsHover()) return
    cancelLogoHoverClose()
    setIsLogoHovered(true)
  }, [cancelLogoHoverClose])

  // No cierra al toque: la barra vive debajo de la navbar y hay que poder
  // llegar hasta ella. Una vez encima, ella misma se sostiene abierta.
  const handleLogoMouseLeave = useCallback(() => {
    cancelLogoHoverClose()
    logoHoverTimerRef.current = window.setTimeout(() => {
      logoHoverTimerRef.current = null
      setIsLogoHovered(false)
    }, LOGO_HOVER_GRACE_MS)
  }, [cancelLogoHoverClose])

  useEffect(() => cancelLogoHoverClose, [cancelLogoHoverClose])

  // Se cierran tocando afuera.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false)
      }

      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        botonDeUsuario.current &&
        !botonDeUsuario.current.contains(target)
      ) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobileMenuOpen, isUserMenuOpen])

  // Esc cierra lo que esté abierto, aunque el foco no esté adentro.
  useEffect(() => {
    if (!isMobileMenuOpen && !isUserMenuOpen) return
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (isUserMenuOpen) cerrarMenuDeUsuario(true)
      setIsMobileMenuOpen(false)
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [isMobileMenuOpen, isUserMenuOpen, cerrarMenuDeUsuario])

  // Close all menus on route change
  useEffect(() => {
    closeAllMenus()
  }, [location.pathname])

  // ELEGIR LA FORMA.
  // Lo que pide cada una sale de la copia invisible, que siempre se dibuja
  // igual (no depende de la forma elegida), así que medir no se retroalimenta.
  const elegirForma = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const ancho = (ref: React.RefObject<HTMLElement | null>) => ref.current?.offsetWidth ?? 0
    const disponible = nav.clientWidth - MARGENES_DE_LA_BARRA
    const pideLaCompleta =
      2 * Math.max(ancho(medidaIzquierda), ancho(medidaDerecha) + AIRE_DEL_USUARIO + ancho(medidaUsuario)) +
      ancho(medidaLogo) +
      AIRE_DEL_LOGO
    const pidenLosDosPisos = 2 * Math.max(ancho(medidaIzquierda2), ancho(medidaDerecha2)) + AIRE_DEL_SEGUNDO_PISO
    setForma(pideLaCompleta <= disponible ? "completa" : pidenLosDosPisos <= disponible ? "dos-pisos" : "celular")
  }, [])

  const hayUsuario = Boolean(user)

  useLayoutEffect(() => {
    if (!hayUsuario) return
    elegirForma()
    // Se mira la navbar (cambia el ancho de la ventana) y la copia (carga la
    // fuente o el logo, cambia el rol y aparece o se va un acceso).
    const observer = new ResizeObserver(elegirForma)
    for (const ref of [navRef, medidaIzquierda, medidaDerecha, medidaUsuario, medidaLogo, medidaIzquierda2, medidaDerecha2]) {
      if (ref.current) observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [hayUsuario, elegirForma])

  // Alto de la navbar para el espaciador, y la forma de la barra para el
  // login. Se observa porque cambia con la forma y con el ancho.
  useEffect(() => {
    const elemento = navRef.current
    if (!elemento) return

    const medir = () => {
      setNavHeight(elemento.getBoundingClientRect().height)
      // Se mide la barra de verdad —esta pantalla, este usuario— en vez de
      // copiar las medidas al login, que es lo que hacía que en el teléfono
      // no cerrara.
      const visible = barra.current
      if (visible && visible.offsetWidth > 0) {
        const caja = visible.getBoundingClientRect()
        recordarFormaDeLaNavbar({
          ancho: Math.round(caja.width),
          alto: Math.round(caja.height),
          radio: Math.round(Number.parseFloat(getComputedStyle(visible).borderBottomLeftRadius) || 0),
        })
      }
    }
    medir()

    const observer = new ResizeObserver(medir)
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [hayUsuario, forma])

  // Cerrando sesión: los menús se pliegan solos —para arriba, con su propia
  // transición— y después la navbar entera se va por arriba. Ver
  // `cerrarSesionConAnimacion`.
  useEffect(() => {
    if (cerrandoSesion) closeAllMenus()
  }, [cerrandoSesion])

  // Si la navbar se va mientras hay un menú abierto, el menú se iría con ella
  // (o peor, quedaría flotando). Al ocultarse se cierra todo.
  useEffect(() => {
    if (scrollState === "hidden") closeAllMenus()
  }, [scrollState])

  // Al cambiar de forma con un menú abierto, el menú cambiaría de lugar.
  useEffect(() => {
    closeAllMenus()
  }, [forma])

  // Ctrl/⌘+K abre y enfoca la búsqueda: es una búsqueda global, tiene que poder
  // usarse sin tocar el mouse (y es la única forma de abrirla desde el teclado,
  // porque el disparador natural es el hover).
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsMobileMenuOpen(false)
        setIsUserMenuOpen(false)
        setIsSearchPinned(true)
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  if (!user) return null

  // Activo también en rutas anidadas (ej: /protocolos/4822 marca "Protocolos").
  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  // Tres y tres: lo que pasa cuando llega el paciente | lo que pasa después.
  const leftNavItems = [
    { path: "/ingreso", label: "Ingreso" },
    { path: "/protocolos", label: "Protocolos" },
    { path: "/pacientes", label: "Pacientes" },
  ]

  const rightNavItems = [
    { path: "/resultados", label: "Resultados", condition: true }, // Todos pueden ver
    {
      path: "/validacion",
      label: "Validación",
      condition: hasPermission(PERMISSIONS.VALIDATE_RESULTS.codename),
    },
    {
      path: "/libro-diario",
      label: "Libro diario",
      condition: hasPermission(PERMISSIONS.MANAGE_LEDGER.codename),
    },
  ].filter((item) => item.condition)

  const isAtTop = scrollState === "top"

  const enlaces = (items: Array<{ path: string; label: string }>, extra: Partial<NavLinkProps> = {}) =>
    items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        isActive={isPathActive(item.path)}
        destacado={item.path === "/ingreso" && hayBorrador}
        {...extra}
      >
        {item.label}
      </NavLink>
    ))

  const logo = (alto: string, conBusqueda: boolean) => (
    <div
      className="flex flex-shrink-0 justify-center"
      onMouseEnter={conBusqueda ? handleLogoMouseEnter : undefined}
      onMouseLeave={conBusqueda ? handleLogoMouseLeave : undefined}
    >
      <Link to="/" onClick={conBusqueda ? undefined : closeAllMenus} className="flex items-center">
        <img
          src="/logo_icono.svg"
          alt="Inicio"
          className={`${alto} w-auto object-contain`}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/placeholder.svg?height=48&width=160&text=LOGO"
          }}
        />
      </Link>
    </div>
  )

  const usuario = (
    <BotonDeUsuario
      ref={botonDeUsuario}
      user={user}
      abierto={isUserMenuOpen}
      onClick={toggleUserMenu}
      celular={celular}
      controla={ID_DEL_MENU}
    />
  )

  const menuDeUsuario = (
    <MenuDeUsuario
      ref={userMenuRef}
      id={ID_DEL_MENU}
      abierto={isUserMenuOpen}
      celular={celular}
      conTeclado={abiertoConTeclado}
      onCerrar={cerrarMenuDeUsuario}
      onCerrarSesion={cerrarSesion}
    />
  )

  return (
    <>
      {/* Espaciador: cuando la navbar sale del flujo para pegarse arriba, algo
          tiene que ocupar su lugar o todo el contenido pega un salto hacia
          arriba de golpe. Arriba de todo no se renderiza: ahí la navbar está
          en el flujo y ocupa su espacio sola. */}
      {!isAtTop && <div aria-hidden="true" style={{ height: navHeight }} />}

      <nav
        ref={navRef}
        // Se anima `top` y NO `transform`. Un `transform` en un ancestro
        // convierte a la navbar en el bloque contenedor de sus descendientes
        // `position: fixed`, y adentro hay dos overlays `fixed inset-0` (el
        // telón del buscador y el del menú del celular) que dejarían de cubrir
        // la pantalla para cubrir solo la navbar.
        style={isAtTop ? undefined : { top: scrollState === "hidden" ? -navHeight : 0 }}
        // OJO con `position`: va entera en el condicional. Si `relative`
        // quedara en las clases base, Tailwind emitiría las dos reglas y cuál
        // gana lo decide el ORDEN DE LA HOJA DE ESTILOS, no el orden en el
        // atributo — y `.relative` está después de `.fixed`, así que ganaría
        // siempre y la navbar nunca se despegaría.
        // Cerrando sesión la navbar se va por arriba, entera, después de los
        // 200ms que tarda el menú de usuario en plegarse (`MS_DEL_MENU`): el
        // menú se cierra primero y la barra se va después, no las dos encima.
        // El `transform` que la mueve es justamente lo que el comentario de
        // acá arriba evita el resto del tiempo, y acá no molesta: los menús y
        // el buscador ya se cerraron, así que no queda ningún `position: fixed`
        // adentro al que cambiarle el marco de referencia.
        className={`w-full ${celular ? "px-0" : "px-4"} ${
          cerrandoSesion
            ? "pointer-events-none -translate-y-full opacity-0 transition-all duration-500 delay-200 ease-in"
            : "transition-[top] duration-300 ease-out"
        } ${isAtTop ? "relative" : "fixed inset-x-0 z-50"}`}
      >
        {/* La copia con la que se mide: invisible, fuera del flujo y sin foco.
            Mide lo que pide cada forma con la fuente y el zoom de esta PC. */}
        <div
          aria-hidden="true"
          inert
          className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden"
        >
          <div ref={medidaIzquierda} className="flex w-max flex-shrink-0 items-center gap-8">
            {enlaces(leftNavItems, { tabIndex: -1 })}
          </div>
          <div ref={medidaDerecha} className="flex w-max flex-shrink-0 items-center gap-8">
            {enlaces(rightNavItems, { tabIndex: -1 })}
          </div>
          <div ref={medidaUsuario} className="flex w-max flex-shrink-0">
            <BotonDeUsuario user={user} abierto={false} paraMedir />
          </div>
          <img ref={medidaLogo} src="/logo_icono.svg" alt="" className="h-9 w-auto flex-shrink-0" />
          <div ref={medidaIzquierda2} className="flex w-max flex-shrink-0 items-center gap-4">
            {enlaces(leftNavItems, { tabIndex: -1 })}
          </div>
          <div ref={medidaDerecha2} className="flex w-max flex-shrink-0 items-center gap-4">
            {enlaces(rightNavItems, { tabIndex: -1 })}
          </div>
        </div>

        {!celular ? (
          <div
            ref={barra}
            // La barra y el menú son una sola pieza: al abrir, la esquina de
            // abajo a la derecha se vuelve recta y el menú baja pegado a ese
            // borde. Al cerrar, la esquina recién se redondea cuando el menú
            // terminó de plegarse.
            className={`relative z-40 mx-4 rounded-bl-[25px] bg-white px-8 py-4 shadow-lg transition-[border-bottom-right-radius] duration-200 ease-out motion-reduce:transition-none ${
              isUserMenuOpen ? "rounded-br-none delay-0" : "rounded-br-[25px] delay-[120ms]"
            }`}
          >
            {forma === "completa" ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
                <div className="flex min-w-0 items-center justify-center gap-8">{enlaces(leftNavItems)}</div>
                <div className="mx-8">{logo("h-9", true)}</div>
                <div className="flex min-w-0 items-center gap-8">
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-8">{enlaces(rightNavItems)}</div>
                  {usuario}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
                  <span />
                  {logo("h-9", true)}
                  <div className="flex min-w-0 justify-end">{usuario}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-8">
                  <div className="flex items-center justify-end gap-4">{enlaces(leftNavItems)}</div>
                  <div className="flex items-center justify-start gap-4">{enlaces(rightNavItems)}</div>
                </div>
              </>
            )}
            {menuDeUsuario}
          </div>
        ) : (
          <div className="relative">
            <div
              ref={barra}
              className={`relative z-40 w-full bg-white px-3 py-3 shadow-lg transition-[border-radius] duration-[120ms] motion-reduce:transition-none ${
                isMobileMenuOpen || isUserMenuOpen ? "rounded-b-none" : "rounded-b-lg"
              }`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
                <div className="flex min-w-0 justify-start">{usuario}</div>
                {/* 28 px y no 32: así «María» entra entero desde 360 px. */}
                {logo("h-7", false)}
                <div className="flex items-center justify-end">
                  {/* Sin hover en touch: acá la búsqueda se abre con un tap. */}
                  <button
                    type="button"
                    onClick={toggleSearch}
                    data-global-search-trigger=""
                    className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                    aria-label={isSearchPinned ? "Cerrar búsqueda" : "Abrir búsqueda"}
                    aria-expanded={isSearchPinned}
                  >
                    <Search className={`h-6 w-6 ${isSearchPinned ? "text-[#204983]" : ""}`} />
                  </button>

                  <button
                    type="button"
                    ref={hamburgerRef}
                    onClick={toggleMobileMenu}
                    className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                    aria-label={isMobileMenuOpen ? "Cerrar el menú" : "Abrir el menú"}
                    aria-expanded={isMobileMenuOpen}
                  >
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </button>
                </div>
              </div>

              {menuDeUsuario}

              {/* El menú ☰: los seis accesos. */}
              <div
                ref={mobileMenuRef}
                className={`absolute inset-x-0 top-full z-40 rounded-b-lg bg-white shadow-lg transition-all duration-200 ease-in-out ${
                  isMobileMenuOpen
                    ? "max-h-[70dvh] overflow-y-auto overscroll-contain opacity-100"
                    : "pointer-events-none max-h-0 overflow-hidden opacity-0"
                }`}
              >
                <div className="flex flex-col items-center gap-2 px-4 py-4">
                  {enlaces([...leftNavItems, ...rightNavItems], { onClick: closeAllMenus, className: "!px-6 !py-3 text-base" })}
                </div>
              </div>
            </div>

            {/* La pantalla de atrás se oscurece y tocarla cierra el menú. */}
            <div
              className={`fixed inset-0 z-30 bg-slate-900/25 transition-opacity duration-200 ${
                isMobileMenuOpen || isUserMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={closeAllMenus}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Búsqueda global: cuelga del borde inferior de la navbar, más angosta
            que ella. Se despliega con el hover sobre el logo (computadora) o
            con el botón de lupa (celular). Enter lleva a la página de
            resultados. */}
        <GlobalSearch
          isHovering={isLogoHovered && !isMobileMenuOpen && !isUserMenuOpen}
          isPinned={isSearchPinned}
          onRequestClose={closeSearch}
        />
      </nav>
    </>
  )
}
