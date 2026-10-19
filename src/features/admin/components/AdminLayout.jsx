import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-app">
      {/* Backdrop en dispositivos móviles */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Menú lateral interactivo */}
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Contenedor principal sin barra superior */}
      <div
        className={`min-h-screen transition-all duration-300 ease-in-out ${collapsed ? "lg:pl-20" : "lg:pl-64"
          }`}
      >
        {/* Botón flotante para desplegar menú en pantallas móviles */}
        <div className="lg:hidden p-4 pb-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú de navegación"
            className="p-2 rounded-xl bg-brand-primary text-white shadow-md active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-secondary">
            ERXIDI Backoffice
          </span>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}