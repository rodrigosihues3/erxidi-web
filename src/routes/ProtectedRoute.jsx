import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Esperar a que Supabase resuelva la sesión antes de tomar decisiones de ruteo
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-app flex flex-col items-center justify-center gap-2 text-brand-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Verificando Credenciales...
        </span>
      </div>
    );WWW
  }

  // Si no está autenticado, redirigir a login guardando la ruta previa
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se especificaron roles y el rol del usuario no está autorizado
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
