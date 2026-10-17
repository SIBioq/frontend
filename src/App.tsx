import { Suspense, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/query-client"

import { AuthProvider } from "./contexts/auth-context"
import { RouteChangeListener } from "./components/route-change-listener"
import { TituloDePestana } from "./components/titulo-de-pestana"
import { Layout } from "./components/layout"
import { ProtectedRoute } from "./components/protected-route"
import { Toaster } from "sonner"
import { PERMISSIONS } from "./config/permissions"
import { LimiteDeError } from "./components/common/limite-de-error"
import { olvidarLasRecargas, paginaLazy } from "./lib/carga-de-pagina"

// Login no se lazy-loadea: es la primera pantalla y bloquea el resto.
import Login from "./components/login"
import RestablecerContrasena from "./components/restablecer-contrasena"
import Home from "./components/home"
import NotFound from "./components/not-found"

// El resto va lazy-loadeado: cada ruta es un chunk separado.
// El primer render del usuario sólo descarga login + layout + home; el resto baja on-demand.
const ManagementPage = paginaLazy("ManagementPage", () => import("./components/admin/management-page"))
const PatientsPage = paginaLazy("PatientsPage", () => import("./components/patients/patients-page"))
const PatientDetailPage = paginaLazy("PatientDetailPage", () => import("./components/patients/patient-detail-page"))
const ProfilePage = paginaLazy("ProfilePage", () => import("./components/profile/profile-page"))
const ConfigurationPage = paginaLazy("ConfigurationPage", () => import("./components/configuration/configuration-page"))
const IngresoPage = paginaLazy("IngresoPage", () => import("./components/ingreso/ingreso-page"))
const ProtocolosPage = paginaLazy("ProtocolosPage", () => import("./components/protocolos/protocolos-page"))
const ProtocolDetailPage = paginaLazy("ProtocolDetailPage", () => import("./components/protocolos/protocol-detail-page"))
const ResultadosPage = paginaLazy("ResultadosPage", () => import("./components/results/results-page"))
const ProtocolResultsPage = paginaLazy("ProtocolResultsPage", () => import("./components/results/protocol-results-page"))
const ValidacionPage = paginaLazy("ValidacionPage", () => import("./components/validacion/validacion-page"))
const ProtocolValidationPage = paginaLazy("ProtocolValidationPage", () => import("./components/validacion/protocol-validation-page"))
const FacturacionPage = paginaLazy("FacturacionPage", () => import("./components/facturacion/facturacion-page"))
const SearchResultsPage = paginaLazy("SearchResultsPage", () => import("./components/search/search-results-page"))
const SuperadminPage = paginaLazy("SuperadminPage", () => import("./components/superadmin/superadmin-page"))
const LibroDiarioPage = paginaLazy("LibroDiarioPage", () => import("./components/caja/libro-diario-page"))

// Skeleton mientras se descarga el chunk de cada ruta.
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#204983] border-t-transparent" />
    </div>
  )
}

function App() {
  // Si el arranque llegó hasta acá, la versión que está corriendo es la buena:
  // se limpian las marcas de "ya recargué por esta pantalla" para que un
  // despliegue futuro vuelva a poder recargar sola. Sin esto, la marca de una
  // recarga vieja dejaría la próxima pantalla en blanco en vez de recargarla.
  useEffect(() => {
    olvidarLasRecargas()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-[#adadad] relative">
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
            <img
              src="/logo.svg"
              alt="Background Logo"
              className="w-[95vw] h-[95vh] max-w-[1500px] object-contain opacity-65 blur-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/placeholder.svg?height=800&width=800&text=LOGO&bg=f3f4f6&color=9ca3af"
                target.style.opacity = "0.9"
              }}
            />
          </div>

          <div className="relative z-10">
            <Router>
              <RouteChangeListener />
              <TituloDePestana />
              <LimiteDeError>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  {/* Donde cae el link del mail de recuperación. Público: lo
                      abre justamente quien no puede entrar.

                      `/forgot-password` ya no existe como pantalla: pedir el
                      link es un panel del login. Se deja redirigiendo para que
                      un link viejo —o un favorito— no termine en un 404. */}
                  <Route path="/restablecer/:uid/:token" element={<RestablecerContrasena />} />
                  <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Home />} />
                  </Route>
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ProfilePage />} />
                  </Route>
                  <Route
                    path="/management"
                    element={
                      <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS.codename}>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ManagementPage />} />
                  </Route>
                  <Route
                    path="/pacientes"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<PatientsPage />} />
                    <Route path=":id" element={<PatientDetailPage />} />
                  </Route>
                  <Route
                    path="/configuracion"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ConfigurationPage />} />
                  </Route>
                  <Route
                    path="/superconfiguracion"
                    element={
                      <ProtectedRoute requireSuperuser>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<SuperadminPage />} />
                  </Route>
                  <Route
                    path="/ingreso"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<IngresoPage />} />
                  </Route>
                  <Route
                    path="/protocolos"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ProtocolosPage />} />
                    <Route path=":id" element={<ProtocolDetailPage />} />
                  </Route>
                  <Route
                    path="/resultados"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ResultadosPage />} />
                    <Route path=":protocolId" element={<ProtocolResultsPage />} />
                  </Route>
                  <Route
                    path="/validacion"
                    element={
                      <ProtectedRoute requiredPermission={PERMISSIONS.VALIDATE_RESULTS.codename}>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ValidacionPage />} />
                    <Route path=":protocolId" element={<ProtocolValidationPage />} />
                  </Route>
                  <Route
                    path="/facturacion"
                    element={
                      <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_BILLING.codename}>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<FacturacionPage />} />
                  </Route>
                  {/* El libro diario, con permiso propio: mirar los
                      movimientos no es lo mismo que poder facturar. */}
                  <Route
                    path="/libro-diario"
                    element={
                      <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_LEDGER.codename}>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<LibroDiarioPage />} />
                  </Route>
                  {/* Búsqueda global: el término viaja en ?q= para que la
                      búsqueda sea compartible y el botón atrás funcione. */}
                  <Route
                    path="/buscar"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<SearchResultsPage />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </LimiteDeError>
            </Router>
            {/* Los toasts se sacan de encima deslizándolos: hacia la derecha
                —que es el borde más cercano, están abajo a la derecha— o hacia
                abajo. Va explícito y no por el default de sonner para que se
                lea acá qué gesto los cierra, y porque de la posición depende
                cuál es el gesto natural: si algún día los toasts se mudan de
                esquina, esta línea es la que hay que mover con ellos.

                `closeButton` es el mismo gesto para quien no arrastra: en una
                pantalla táctil el deslizamiento sale solo, con mouse no tanto. */}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              swipeDirections={["right", "bottom"]}
            />
          </div>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
