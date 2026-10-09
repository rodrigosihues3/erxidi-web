import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function AdminProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-app flex flex-col items-center justify-center gap-2 text-brand-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wider">Verificando acceso...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location, accessDenied: true }} replace />;
  }

  const allowed = profile?.role === "owner" || profile?.role === "admin";
  if (!allowed) {
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  return <Outlet />;
}
