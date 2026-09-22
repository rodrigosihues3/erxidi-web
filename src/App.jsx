import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider, useCart } from "./context/CartContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DesignSystemShowcase from "./features/dev/DesignSystemShowcase";
import LoginView from "./features/auth/LoginView";

function NavigationBar() {
  const { user, profile, signOut } = useAuth();
  const { totalUnits } = useCart();

  return (
    <nav className="h-14 bg-brand-primary text-white px-6 flex justify-between items-center text-sm">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-extrabold tracking-tight text-base">
          ERXIDI
        </Link>
        <Link
          to="/ui"
          className="text-brand-muted hover:text-white transition-colors"
        >
          Sistema UI (/ui)
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs bg-slate-800 px-2 py-1 rounded">
          Carrito: {totalUnits}
        </span>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-muted">
              {profile?.first_name} ({profile?.role})
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs text-rose-400 hover:underline"
            >
              Salir
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="text-xs font-semibold bg-accent px-3 py-1 rounded text-white hover:bg-accent-hover transition-colors"
          >
            Ingresar
          </Link>
        )}
      </div>
    </nav>
  );
}

function HomeView() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-primary mb-2">
        ERXIDI • Estado Base Operativo
      </h1>
      <p className="text-sm text-brand-secondary mb-6">
        Contextos globales montados (AuthContext y CartContext). Rutas
        protegidas por RBAC listas para branching.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen bg-surface-app text-brand-primary">
            <NavigationBar />
            <Routes>
              {/* Rutas Públicas */}
              <Route path="/" element={<HomeView />} />
              <Route path="/ui" element={<DesignSystemShowcase />} />
              <Route path="/login" element={<LoginView />} />{" "}
              {/* <-- Ruta agregada */}
              {/* Rutas Protegidas de Cliente */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["customer", "owner"]} />
                }
              >
                <Route
                  path="/checkout"
                  element={<div>Vista Checkout (En desarrollo)</div>}
                />
                <Route
                  path="/mis-pedidos"
                  element={<div>Historial de Pedidos (En desarrollo)</div>}
                />
              </Route>
              {/* Rutas Protegidas de Administración (Dueña) */}
              <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
                <Route
                  path="/admin/*"
                  element={<div>Panel de Administración (En desarrollo)</div>}
                />
              </Route>
              {/* Rutas Protegidas de Logística (Repartidor) */}
              <Route element={<ProtectedRoute allowedRoles={["delivery"]} />}>
                <Route
                  path="/reparto"
                  element={<div>Bandeja de Reparto (En desarrollo)</div>}
                />
              </Route>
            </Routes>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
