import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  Truck,
  MapPin,
  Store,
  LogOut,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true },
  { label: "Pedidos", path: "/admin/pedidos", icon: ShoppingBag },
  { label: "Productos", path: "/admin/productos", icon: Package },
  { label: "Categorías", path: "/admin/categorias", icon: Tags },
  { label: "Repartidores", path: "/admin/repartidores", icon: Truck },
  { label: "Zona de Cobertura", path: "/admin/cobertura", icon: MapPin },
];

export default function AdminSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const displayName =
    [profile?.first_name, profile?.paternal_surname].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Administrador";

  const role = profile?.role || "owner";

  async function handleLogout() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 bg-brand-primary text-white flex flex-col justify-between border-r border-white/10 transition-all duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-64"}`}
    >
      {/* 1. Cabecera del Sidebar con Marca y Botón Colapsador */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
        {!collapsed ? (
          <div className="overflow-hidden">
            <p className="font-bold tracking-[0.2em] text-white leading-none">ERXIDI</p>
            <p className="text-[10px] uppercase tracking-wider text-white/50 mt-1">Backoffice</p>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="font-extrabold text-base tracking-wider text-white">E</span>
          </div>
        )}

        {/* Botón para colapsar en escritorio */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          title={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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

      {/* 2. Enlaces de Navegación */}
      <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto scrollbar-none">
        {NAV_ITEMS.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            onClick={onCloseMobile}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-button text-xs font-semibold transition-all ${collapsed ? "justify-center px-0 h-10 w-full" : ""
              } ${isActive
                ? "bg-white text-brand-primary shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 3. Pie Integrado: Acceso a Tienda y Perfil de Usuario */}
      <div className="p-3 border-t border-white/10 space-y-3 flex-shrink-0 bg-black/10">
        {/* Acceso rápido a la tienda pública */}
        <button
          type="button"
          onClick={() => window.open("/", "_blank")}
          title="Ver tienda en una pestaña nueva"
          className={`w-full flex items-center gap-2.5 py-2 rounded-button border border-white/10 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors ${collapsed ? "justify-center px-0" : "px-3"
            }`}
        >
          <Store className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">Ver tienda</span>}
        </button>

        {/* Tarjeta de Administrador y Cierre de Sesión */}
        <div
          className={`flex items-center gap-2 pt-2 border-t border-white/5 ${collapsed ? "flex-col justify-center" : "justify-between"
            }`}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "justify-center" : ""}`}>
            <UserCircle className="h-8 w-8 text-white/70 flex-shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight" title={displayName}>
                  {displayName}
                </p>
                <span className="inline-block mt-0.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                  {role}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}