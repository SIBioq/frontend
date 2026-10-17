"use client"

import { forwardRef, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react"
import { Link } from "react-router-dom"
import { LogOut } from "lucide-react"

import useAuth from "@/contexts/auth-context"
import { getVisibleUserMenuItems } from "@/config/user-menu-items"
import { SessionNotificationToggle } from "@/components/session-notification-toggle"
import type { User } from "@/types"

/**
 * EL USUARIO EN LA BARRA.
 * =======================
 * Se ve con su nombre, no con el usuario: «MG María». Sin flechita: al tocarlo
 * se despliega el menú y el botón queda marcado en gris mientras está abierto.
 * El nombre crece hasta 120 px y si no entra se corta con «…». La barra se
 * mide con el nombre en su mínimo (40 px), así los cortes entre los tres
 * estados no dependen de quién inició sesión.
 *
 * Se abre con un clic, un toque, Enter o espacio —nunca al pasar el mouse—,
 * así anda igual con el dedo y con el teclado.
 */

const nombreVisible = (user: User) => user.first_name?.trim() || user.username

const inicialesDe = (user: User) => {
  const nombre = user.first_name?.trim()
  const apellido = user.last_name?.trim()
  if (nombre && apellido) return `${nombre[0]}${apellido[0]}`.toUpperCase()
  if (nombre) return nombre.slice(0, 2).toUpperCase()
  return user.username.slice(0, 2).toUpperCase()
}

function Avatar({ user }: { user: User }) {
  if (user.photo) {
    return (
      <img
        src={user.photo}
        alt=""
        className="h-8 w-8 flex-shrink-0 rounded-full border border-gray-300 object-cover"
      />
    )
  }
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#204983] text-[13px] font-semibold tracking-[0.02em] text-white">
      {inicialesDe(user)}
    </span>
  )
}

interface BotonDeUsuarioProps {
  user: User
  abierto: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** En la copia que se usa para medir la barra el nombre va en su mínimo. */
  paraMedir?: boolean
  celular?: boolean
  controla?: string
}

export const BotonDeUsuario = forwardRef<HTMLButtonElement, BotonDeUsuarioProps>(function BotonDeUsuario(
  { user, abierto, onClick, paraMedir = false, celular = false, controla },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      tabIndex={paraMedir ? -1 : undefined}
      aria-haspopup="menu"
      aria-expanded={abierto}
      aria-controls={controla}
      aria-label={`Menú de ${nombreVisible(user)}`}
      className={`flex h-10 min-w-0 flex-shrink items-center rounded-[10px] text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-slate-100 ${
        abierto ? "bg-slate-100" : ""
      } ${celular ? "w-10 flex-shrink-0 justify-center" : "gap-2 pl-1 pr-2.5"}`}
    >
      <Avatar user={user} />
      {/* En el celular va sólo el avatar: el nombre está adentro del menú. */}
      {celular ? null : (
        <span
          className={`overflow-hidden text-ellipsis whitespace-nowrap ${paraMedir ? "w-10" : "min-w-10 max-w-[120px]"}`}
        >
          {nombreVisible(user)}
        </span>
      )}
    </button>
  )
})

interface MenuDeUsuarioProps {
  id: string
  abierto: boolean
  celular: boolean
  /** Se abrió con el teclado: el foco va al primer ítem. */
  conTeclado: boolean
  onCerrar: (devolverFoco?: boolean) => void
  onCerrarSesion: () => void
}

/**
 * El menú, como parte de la barra: baja pegado al borde derecho, del mismo
 * blanco y sin línea de por medio. Abre en 200 ms creciendo hacia abajo, con
 * los ítems entrando de a uno (20 ms entre cada uno); cierra en 150 ms. En el
 * celular va a todo el ancho, con ítems de 48 px.
 */
export const MenuDeUsuario = forwardRef<HTMLDivElement, MenuDeUsuarioProps>(function MenuDeUsuario(
  { id, abierto, celular, conTeclado, onCerrar, onCerrarSesion },
  ref,
) {
  const { user, hasPermission } = useAuth()
  const lista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto || !conTeclado) return
    lista.current?.querySelector<HTMLElement>("[data-item]")?.focus()
  }, [abierto, conTeclado])

  if (!user) return null
  const items = getVisibleUserMenuItems({ user, hasPermission })

  // Las flechas recorren los ítems; Esc cierra y devuelve el foco al botón.
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const todos = Array.from(lista.current?.querySelectorAll<HTMLElement>("[data-item]:not(:disabled)") ?? [])
    const actual = todos.indexOf(document.activeElement as HTMLElement)
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const paso = e.key === "ArrowDown" ? 1 : -1
      todos[(actual + paso + todos.length) % todos.length]?.focus()
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      todos[e.key === "Home" ? 0 : todos.length - 1]?.focus()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCerrar(true)
    }
  }

  const alto = celular ? "min-h-12 text-[15px]" : "min-h-10 text-sm"
  // Entran de a uno al abrir; al cerrar se van todos juntos.
  const entrada = (i: number) => ({
    transitionDelay: abierto ? `${60 + i * 20}ms, ${60 + i * 20}ms, 0ms` : "0ms",
  })
  const claseDeItem = `flex w-full items-center gap-3 rounded-lg px-3 text-left text-gray-700 no-underline outline-none transition-[opacity,transform,background-color] duration-100 hover:bg-slate-100 focus-visible:bg-slate-100 motion-reduce:transition-none ${alto} ${
    abierto ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
  }`

  return (
    <div
      ref={ref}
      id={id}
      // `inert` cerrado: sigue en el DOM para poder animar, pero no se tabula.
      inert={!abierto}
      className={`absolute top-full z-40 grid rounded-b-2xl bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-4px_rgba(0,0,0,.1)] [clip-path:inset(0_-24px_-24px_-24px)] motion-reduce:transition-none ${
        celular ? "inset-x-0" : "right-0 w-60"
      } ${
        abierto
          ? "visible grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out"
          : "invisible grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-150 ease-in"
      }`}
    >
      {/* La curva hacia adentro donde el menú sale de la barra: el blanco
          fluye en vez de cortar en ángulo. */}
      {!celular ? (
        <span
          aria-hidden="true"
          className={`absolute -left-4 top-0 h-4 w-4 bg-[radial-gradient(circle_at_0_100%,transparent_15.5px,#fff_16px)] transition-opacity duration-100 ${
            abierto ? "opacity-100 delay-[60ms]" : "opacity-0"
          }`}
        />
      ) : null}
      <div className="min-h-0 overflow-hidden">
        <div
          ref={lista}
          role="menu"
          aria-label="Menú de usuario"
          onKeyDown={alTeclear}
          className={`flex flex-col gap-0.5 p-2 ${celular ? "max-h-[70dvh] overflow-y-auto overscroll-contain" : ""}`}
        >
          <div className="px-3 pb-2.5 pt-1.5" style={entrada(0)}>
            <p className="m-0 truncate text-sm font-medium text-gray-900">
              {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
            </p>
            <p className="m-0 truncate text-xs text-gray-500">{user.username}</p>
          </div>
          {items.map(({ id: clave, to, label, icon: Icono }, i) => (
            <Link
              key={clave}
              to={to}
              role="menuitem"
              data-item=""
              onClick={() => onCerrar()}
              className={claseDeItem}
              style={entrada(i + 1)}
            >
              <Icono className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
          <hr className="mx-2 my-1.5 border-slate-100" />
          <SessionNotificationToggle
            itemDeMenu
            onDone={() => onCerrar()}
            style={entrada(items.length + 1)}
            className={`${claseDeItem} !space-x-0 !px-3 !py-0`}
          />
          <button
            type="button"
            role="menuitem"
            data-item=""
            onClick={onCerrarSesion}
            className={`${claseDeItem} !text-red-700 hover:!bg-red-50 focus-visible:!bg-red-50`}
            style={entrada(items.length + 2)}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
})
