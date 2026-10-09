import { useState } from "react";
import { Menu, Store, LogOut, UserCircle, X } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const displayName = [profile?.first_name, profile?.paternal_surname]
    .filter(Boolean)
    .join(" ") || user?.email || "Administrador";

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-app">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-white/95 backdrop-blur">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-button hover:bg-surface-subtle lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">ERXIDI</p>
                <p className="text-sm font-bold text-brand-primary">Panel administrativo</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-button border border-border text-xs font-semibold hover:bg-surface-subtle"
              >
                <Store className="h-4 w-4" />
                Ver tienda
              </button>

              <div className="flex items-center gap-2">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-brand-primary">{displayName}</p>
                  <p className="text-[10px] uppercase tracking-wider text-brand-secondary">
                    {profile?.role || "owner"}
                  </p>
                </div>
                <UserCircle className="h-8 w-8 text-brand-secondary" />
                <button
                  type="button"
                  title="Cerrar sesión"
                  onClick={handleLogout}
                  className="p-2 rounded-button text-status-danger-text hover:bg-status-danger-bg"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed top-4 right-4 z-[60] p-2 bg-white rounded-full shadow lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
