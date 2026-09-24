"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { Menu, X, LogOut, Search } from "lucide-react"
import useAuth from "@/contexts/auth-context"
import { cerrarSesionConAnimacion, recordarFormaDeLaNavbar } from "@/lib/forma-de-la-navbar"
import { useCierreDeSesion } from "@/hooks/use-cierre-de-sesion"
import { UserDropdown } from "./user-dropdown"
import { PERMISSIONS } from "@/config/permissions"
import { getVisibleUserMenuItems } from "@/config/user-menu-items"
import { SessionNotificationToggle } from "@/components/session-notification-toggle"
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

interface NavLinkProps {
  to: string
  children: React.ReactNode
  isActive?: boolean
  onClick?: () => void
  /** Hay un ingreso a medias esperando: el ítem se pinta en ámbar para que se
   *  vea desde cualquier pantalla. No se usa junto con `isActive`: estando en la
   *  pantalla, el pendiente ya está a la vista. */
  destacado?: boolean
}

const NavLink: React.FC<NavLinkProps> = ({ to, children, isActive, onClick, destacado }) => {
  // El aviso sólo se muestra si no estamos ya parados en la pantalla del ítem.
  const avisoDestacado = destacado && !isActive

  return (
    <Link
      to={to}
      onClick={onClick}
      title={avisoDestacado ? "Quedó un protocolo sin enviar" : undefined}
      className={`
        relative px-3 py-2 text-sm font-medium transition-colors duration-200
        group
        ${avisoDestacado ? "text-amber-600 hover:text-amber-700" : "hover:text-[#204983] text-gray-700"}
        ${isActive ? "text-[#204983]" : ""}
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

export const Navbar: React.FC = () => {
  const { user, hasPermission, logout } = useAuth()
  const location = useLocation()
  const scrollState = useScrollReveal()
  // Reactivo: si en esta PC quedó un ingreso a medias, el ítem "Ingreso" se
  // pinta en ámbar. Va antes del `if (!user)` de abajo para no romper la
  // regla de los hooks.
  const hayBorrador = useHayBorradorDeIngreso()
  const navRef = useRef<HTMLElement>(null)
  // Alto real medido, no un valor fijo: la navbar cambia de alto entre desktop
  // y mobile, y el espaciador tiene que coincidir exacto o el salto se ve.
  const [navHeight, setNavHeight] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  // Solo el logo despliega la búsqueda; el resto de la navbar no hace nada.
  const [isLogoHovered, setIsLogoHovered] = useState(false)
  // Búsqueda abierta a propósito (tap en mobile o Ctrl/⌘+K), no por hover.
  const [isSearchPinned, setIsSearchPinned] = useState(false)
  // Las dos barras blancas —la de escritorio y la del teléfono—. Solo una está
  // dibujada a la vez; la que mide 0 es la que está apagada por el breakpoint.
  const barraDeEscritorio = useRef<HTMLDivElement>(null)
  const barraMobile = useRef<HTMLDivElement>(null)
  // Cerrando sesión: la navbar se va para arriba y se lleva sus menús.
  const cerrandoSesion = useCierreDeSesion()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const userAvatarRef = useRef<HTMLDivElement>(null)
  const logoHoverTimerRef = useRef<number | null>(null)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => {
      if (!prev) setIsUserMenuOpen(false) // close user menu when opening hamburger
      return !prev
    })
    setIsSearchPinned(false)
  }

  const toggleUserMenu = () => {
    setIsUserMenuOpen((prev) => {
      if (!prev) setIsMobileMenuOpen(false) // close hamburger when opening user menu
      return !prev
    })
    setIsSearchPinned(false)
  }

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
  const cerrarSesion = () => cerrarSesionConAnimacion(() => logout(true))

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

  // Close menus when clicking outside
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
        userAvatarRef.current &&
        !userAvatarRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobileMenuOpen, isUserMenuOpen])

  // Close all menus on route change
  useEffect(() => {
    closeAllMenus()
  }, [location.pathname])

  // Alto de la navbar para el espaciador. Se observa en vez de medirse una
  // sola vez porque cambia: al pasar de mobile a desktop, o cuando el menú de
  // usuario le agrega la extensión de abajo.
  useEffect(() => {
    const elemento = navRef.current
    if (!elemento) return

    const medir = () => {
      setNavHeight(elemento.getBoundingClientRect().height)
      // De paso se publica la forma de la barra blanca, que es a lo que
      // aterriza el panel del login cuando alguien entra. Se mide la de
      // verdad —esta pantalla, este avatar— en vez de copiar las medidas al
      // login, que es lo que hacía que en el teléfono no cerrara.
      const barra = [barraDeEscritorio.current, barraMobile.current]
        .find((candidata) => candidata && candidata.offsetWidth > 0)
      if (barra) {
        const caja = barra.getBoundingClientRect()
        recordarFormaDeLaNavbar({
          ancho: Math.round(caja.width),
          alto: Math.round(caja.height),
          radio: Math.round(
            Number.parseFloat(getComputedStyle(barra).borderBottomLeftRadius) || 0,
          ),
        })
      }
    }
    medir()

    const observer = new ResizeObserver(medir)
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [])

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

  // Desktop-only: forward user menu state from UserDropdown
  const handleUserMenuToggle = useCallback((isOpen: boolean) => {
    setIsUserMenuOpen(isOpen)
  }, [])

  if (!user) return null

  // Activo también en rutas anidadas (ej: /protocolos/4822 marca "Protocolos").
  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

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
  ]

  // Mismo listado que consume el dropdown de desktop: acá solo cambian los estilos.
  const userMenuItems = getVisibleUserMenuItems({ user, hasPermission })
  const isAtTop = scrollState === "top"

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
        // telón del buscador y el del menú mobile) que dejarían de cubrir la
        // pantalla para cubrir solo la navbar.
        style={isAtTop ? undefined : { top: scrollState === "hidden" ? -navHeight : 0 }}
        // OJO con `position`: va entera en el condicional. Si `relative`
        // quedara en las clases base, Tailwind emitiría las dos reglas y cuál
        // gana lo decide el ORDEN DE LA HOJA DE ESTILOS, no el orden en el
        // atributo — y `.relative` está después de `.fixed`, así que ganaría
        // siempre y la navbar nunca se despegaría.
        // Cerrando sesión la navbar se va por arriba, entera, después de los
        // 200ms que tarda el menú de usuario en plegarse (`MS_DEL_MENU`): el
        // menú se cierra primero y la barra se va después, no las dos encima.
        // El `transform`
        // que la mueve es justamente lo que el comentario de acá arriba evita
        // el resto del tiempo, y acá no molesta: los menús y el buscador ya se
        // cerraron, así que no queda ningún `position: fixed` adentro al que
        // cambiarle el marco de referencia.
        className={`w-full px-0 lg:px-4 ${
          cerrandoSesion
            ? "pointer-events-none -translate-y-full opacity-0 transition-all duration-500 delay-200 ease-in"
            : "transition-[top] duration-300 ease-out"
        } ${isAtTop ? "relative" : "fixed inset-x-0 z-50"}`}
      >
        {/* Desktop Navbar */}
        <div className="hidden lg:block">
          <div
            ref={barraDeEscritorio}
            className={`bg-white shadow-lg mx-4 px-8 py-4 relative transition-all duration-200 ${
              isUserMenuOpen
                ? "rounded-bl-[25px] rounded-br-none rounded-tl-none rounded-tr-none"
                : "rounded-bl-[25px] rounded-br-[25px] rounded-tl-none rounded-tr-none"
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Left Navigation - Centrado entre borde izquierdo y logo */}
              <div className="flex-1 flex items-center justify-center space-x-8">
                {leftNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    isActive={isPathActive(item.path)}
                    destacado={item.path === "/ingreso" && hayBorrador}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>

              {/* Center Logo — es el único disparador de la búsqueda por hover */}
              <div
                className="flex-shrink-0 mx-8"
                onMouseEnter={handleLogoMouseEnter}
                onMouseLeave={handleLogoMouseLeave}
              >
                <Link to="/" className="flex items-center">
                  <img
                    src="/logo_icono.svg"
                    alt="Logo"
                    className="h-9 w-auto object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = "/placeholder.svg?height=48&width=160&text=LOGO"
                    }}
                  />
                </Link>
              </div>

              {/* Right Navigation + User */}
              <div className="flex-1 flex items-center justify-between">
                {/* Right Navigation Items - Centrado entre logo y usuario */}
                <div className="flex-1 flex items-center justify-center space-x-8">
                  {rightNavItems
                    .filter((item) => item.condition)
                    .map((item) => (
                      <NavLink key={item.path} to={item.path} isActive={isPathActive(item.path)}>
                        {item.label}
                      </NavLink>
                    ))}
                </div>

                {/* User Dropdown - Pegado a la derecha */}
                <div className="flex-shrink-0 relative">
                  <UserDropdown onMenuToggle={handleUserMenuToggle} />
                </div>
              </div>
            </div>


            {/* Extensión del menú de usuario para desktop */}
            {isUserMenuOpen && (
              <div
                className="absolute right-4 top-full bg-white shadow-lg z-40"
                style={{
                  width: "12rem", // w-48 = 12rem
                  marginTop: "0px",
                }}
              >
                {/* Este div actúa como la extensión visual de la navbar */}
              </div>
            )}
          </div>
        </div>

        {/* Mobile/Tablet Navbar */}
        <div className="lg:hidden relative">
          <div
            ref={barraMobile}
            className={`
              bg-white shadow-lg px-4 py-3 w-full transition-all duration-200
              ${isMobileMenuOpen || isUserMenuOpen ? "rounded-b-none" : "rounded-b-lg"}
            `}
          >
            <div className="flex items-center justify-between">
              {/* Left - User Avatar (toggles user menu panel) */}
              {/* El flex-1 va afuera del ref: el ref tiene que envolver SOLO al
                  avatar, o el click-outside del menú de usuario dejaría de andar. */}
              <div className="flex flex-1 items-center">
                <div className="flex-shrink-0" ref={userAvatarRef}>
                  <UserDropdown isMobile={true} onMenuToggle={() => toggleUserMenu()} />
                </div>
              </div>

              {/* Center - Logo */}
              <div className="flex-shrink-0">
                <Link to="/" onClick={closeAllMenus} className="flex items-center">
                  <img
                    src="/logo_icono.svg"
                    alt="Logo"
                    className="h-8 w-auto object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = "/placeholder.svg?height=32&width=120&text=LOGO"
                    }}
                  />
                </Link>
              </div>

              {/* Right - Búsqueda + Hamburger Menu */}
              {/* flex-1 en los dos costados para que el logo quede centrado de
                  verdad, aunque a la derecha ahora haya dos botones. */}
              <div className="flex flex-1 items-center justify-end">
                {/* Sin hover en touch: acá la búsqueda se abre con un tap. */}
                <button
                  onClick={toggleSearch}
                  data-global-search-trigger=""
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={isSearchPinned ? "Cerrar búsqueda" : "Abrir búsqueda"}
                  aria-expanded={isSearchPinned}
                >
                  <Search className={`w-6 h-6 ${isSearchPinned ? "text-[#204983]" : ""}`} />
                </button>

                <button
                  ref={hamburgerRef}
                  onClick={toggleMobileMenu}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Backdrop overlay - closes any open menu when tapping outside */}
          {(isMobileMenuOpen || isUserMenuOpen) && (
            <div
              className="fixed inset-0 z-30"
              onClick={closeAllMenus}
              aria-hidden="true"
            />
          )}

          {/* Mobile Navigation Menu (hamburger) */}
          <div
            ref={mobileMenuRef}
            className={`
              absolute left-0 w-full bg-white shadow-lg z-40 overflow-hidden rounded-b-lg
              transition-all duration-200 ease-in-out
              ${isMobileMenuOpen ? "opacity-100 max-h-[70vh]" : "opacity-0 max-h-0 pointer-events-none"}
            `}
          >
            <div className="px-4 py-4">
              <div className="flex flex-col items-center space-y-2">
                {leftNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    isActive={isPathActive(item.path)}
                    onClick={closeAllMenus}
                    destacado={item.path === "/ingreso" && hayBorrador}
                  >
                    <div className="block px-3 py-2 text-base">{item.label}</div>
                  </NavLink>
                ))}
                {rightNavItems
                  .filter((item) => item.condition)
                  .map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      isActive={isPathActive(item.path)}
                      onClick={closeAllMenus}
                    >
                      <div className="block px-3 py-2 text-base">{item.label}</div>
                    </NavLink>
                  ))}
              </div>
            </div>
          </div>

          {/* Mobile User Menu (same pattern as hamburger menu) */}
          <div
            ref={userMenuRef}
            className={`
              absolute left-0 w-full bg-white shadow-lg z-40 overflow-hidden rounded-b-lg
              transition-all duration-200 ease-in-out
              ${isUserMenuOpen ? "opacity-100 max-h-[70vh]" : "opacity-0 max-h-0 pointer-events-none"}
            `}
          >
            <div className="px-4 py-4">
              {/* User Info */}
              <div className="pb-3 mb-3 border-b border-gray-100">
                <p className="text-lg font-medium text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-sm text-gray-500">{user?.username}</p>
              </div>

              {/* Menu Items — el listado sale de @/config/user-menu-items */}
              <div className="flex flex-col items-center space-y-1">
                {userMenuItems.map(({ id, to, label, icon: Icon }) => (
                  <Link
                    key={id}
                    to={to}
                    className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3 rounded-lg transition-colors duration-150"
                    onClick={closeAllMenus}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                ))}

                <hr className="w-full my-2" />

                <SessionNotificationToggle
                  onDone={closeAllMenus}
                  className="px-3 rounded-lg space-x-3"
                />

                <button
                  onClick={cerrarSesion}
                  className="w-full text-left px-3 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 rounded-lg transition-colors duration-150"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Cerrar Sesion</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Búsqueda global: cuelga del borde inferior de la navbar, más angosta
            que ella. Se despliega con el hover sobre el logo (desktop) o con el
            botón de lupa (touch). Enter lleva a la página de resultados. */}
        <GlobalSearch
          isHovering={isLogoHovered && !isMobileMenuOpen && !isUserMenuOpen}
          isPinned={isSearchPinned}
          onRequestClose={closeSearch}
        />
      </nav>
    </>
  )
}
