import { LayoutDashboard, ShoppingBag, Package, Tags, Store, X, Truck, MapPin } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true },
  { label: "Pedidos", path: "/admin/pedidos", icon: ShoppingBag },
  { label: "Productos", path: "/admin/productos", icon: Package },
  { label: "Categorías", path: "/admin/categorias", icon: Tags },
  { label: "Repartidores", path: "/admin/repartidores", icon: Truck },
  { label: "Zona de Cobertura", path: "/admin/cobertura", icon: MapPin },
];

export default function AdminSidebar({ open, onClose }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-primary text-white transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
        <div>
          <p className="font-bold tracking-[0.25em]">ERXIDI</p>
          <p className="text-[10px] uppercase tracking-wider text-white/50">Backoffice</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-button hover:bg-white/10 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="p-4 space-y-1.5">
        {items.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-button text-sm font-semibold transition ${isActive ? "bg-white text-brand-primary" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <button type="button" onClick={() => window.location.assign("/")} className="w-full flex items-center gap-2 rounded-button border border-white/10 px-4 py-3 text-xs text-white/70 hover:bg-white/10">
          <Store className="h-4 w-4" />
          Volver a la tienda
        </button>
      </div>
    </aside>
  );
}
