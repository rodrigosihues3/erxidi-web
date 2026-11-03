import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  Truck,
  Settings,
  Store,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

const NAV_GROUPS = [
  {
    title: "OPERACIÓN",
    items: [
      { label: "Pedidos", path: "/admin/pedidos", icon: ShoppingBag },
      { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: "CATÁLOGO & LOGÍSTICA",
    items: [
      { label: "Productos", path: "/admin/productos", icon: Package },
      { label: "Atributos y Tallas", path: "/admin/categorias", icon: Tags },
      { label: "Repartidores", path: "/admin/repartidores", icon: Truck },
    ],
  },
  {
    title: "CONFIGURACIÓN",
    items: [
      { label: "Ajustes", path: "/admin/ajustes", icon: Settings },
    ],
  },
];

export default function AdminSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef(null);

  const displayName =
    [profile?.first_name, profile?.paternal_surname].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Administrador";

  const initials =
    [profile?.first_name?.[0], profile?.paternal_surname?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    displayName.slice(0, 2).toUpperCase();

  const role = (profile?.role || "owner").toUpperCase();

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setPopoverOpen(false);
      }
    }

    if (popoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverOpen]);

  async function handleLogout() {
    setPopoverOpen(false);
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 bg-brand-primary text-white flex flex-col justify-between border-r border-white/10 transition-all duration-300 ease-in-out ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-64"}`}
    >
      {/* 1. Cabecera del Sidebar con Marca y Botón Colapsador */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
        {!collapsed ? (
          <div className="overflow-hidden">
            <p className="font-bold tracking-[0.2em] text-white leading-none">
              ERXIDI
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/50 mt-1">
              Backoffice
            </p>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="font-extrabold text-base tracking-wider text-white">
              E
            </span>
          </div>
        )}

        {/* Botón para colapsar en escritorio */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          title={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Botón para cerrar en móvil */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 2. Enlaces de Navegación Jerárquicos */}
      <nav className="p-3 space-y-5 flex-1 overflow-y-auto scrollbar-none">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(({ label, path, icon: Icon, end }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={end}
                  onClick={onCloseMobile}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-button text-xs font-semibold transition-all ${
                      collapsed ? "justify-center px-0 h-10 w-full" : ""
                    } ${
                      isActive
                        ? "bg-white text-brand-primary shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 3. Footer Unificado con Popover Superior */}
      <div
        ref={popoverRef}
        className="relative h-14 border-t border-white/10 px-3 flex items-center justify-between gap-2 flex-shrink-0 bg-black/10"
      >
        {/* Izquierda: Botón compacto Ver tienda */}
        <button
          type="button"
          onClick={() => window.open("/", "_blank")}
          title="Ver tienda en nueva pestaña"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-button border border-white/10 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Store className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span className="truncate">Tienda</span>}
        </button>

        {/* Derecha: Trigger de perfil Admin */}
        <button
          type="button"
          onClick={() => setPopoverOpen((prev) => !prev)}
          title="Perfil y sesión"
          className={`flex items-center gap-2 py-1.5 px-2 rounded-button border border-white/10 hover:bg-white/10 transition-colors ${
            collapsed ? "justify-center" : "flex-1 min-w-0 justify-between"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-white/15 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <p className="text-[11px] font-bold text-white truncate leading-tight">
                  {displayName}
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <ChevronUp
              className={`h-3.5 w-3.5 text-white/70 shrink-0 transition-transform ${
                popoverOpen ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {/* Popover flotante superior */}
        {popoverOpen && (
          <div className="absolute bottom-full mb-2 right-2 w-60 bg-brand-primary border border-white/10 rounded-card shadow-2xl p-3 z-50 space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white truncate">
                  {displayName}
                </p>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/90 shrink-0">
                  {role}
                </span>
              </div>
              {user?.email && (
                <p className="text-[11px] text-white/60 truncate">
                  {user.email}
                </p>
              )}
            </div>

            <div className="border-t border-white/10 pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-2 rounded-button text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
