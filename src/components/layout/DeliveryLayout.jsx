import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Package,
  Pause,
  Truck,
  User,
} from "lucide-react";
import {
  DRIVER_STATUS,
  useDeliveryAvailability,
} from "../../features/delivery/DeliveryAvailabilityContext";

// Icono, etiqueta corta y color de cada estado del repartidor
const STATUS_OPTIONS = [
  {
    key: "available",
    label: "Disponible",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  { key: "on_route", label: "En ruta", icon: Truck, color: "text-amber-600" },
  { key: "paused", label: "En pausa", icon: Pause, color: "text-rose-600" },
];

const navItem = ({ isActive }) =>
  `flex flex-col items-center gap-1 transition-colors ${
    isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-700"
  }`;

export default function DeliveryLayout() {
  const { status, setStatus } = useDeliveryAvailability();
  const theme = DRIVER_STATUS[status];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const current =
    STATUS_OPTIONS.find((o) => o.key === status) ?? STATUS_OPTIONS[0];
  const CurrentIcon = current.icon;

  // Cierra el menú al tocar fuera o al presionar Escape
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const selectStatus = (key) => {
    setStatus(key);
    setMenuOpen(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col text-slate-800 transition-colors duration-500 ease-in-out ${theme.page}`}
    >
      <header
        className={`sticky top-0 z-40 text-white px-4 py-3 shadow-md transition-colors duration-500 ${theme.header}`}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${theme.ping}`}
              />
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <CurrentIcon className="h-4 w-4" />
              </span>
            </span>
            <div className="min-w-0">
              <span
                className={`text-[9px] uppercase font-bold tracking-widest block leading-tight ${theme.badgeText}`}
              >
                {theme.badge}
              </span>
              <h1 className="text-sm font-extrabold leading-none truncate">
                {theme.title}
              </h1>
            </div>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label="Cambiar estado operativo"
              className="flex items-center gap-1.5 text-xs font-bold bg-black/20 hover:bg-black/30 border border-white/25 rounded-lg px-2.5 py-1.5 text-white focus:outline-none transition-colors"
            >
              <CurrentIcon className="h-4 w-4" />
              <span>{current.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-2 w-44 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-lg py-1 z-50"
              >
                {STATUS_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  const selected = o.key === status;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectStatus(o.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left transition-colors hover:bg-slate-50 ${
                        selected ? "bg-slate-50" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${o.color}`} />
                      <span className="flex-1">{o.label}</span>
                      {selected && (
                        <Check className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {status === "paused" && (
        <div className="flex items-center justify-center gap-2 bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center shadow-inner animate-pulse">
          <Pause className="h-3.5 w-3.5" />
          Estás en Pausa: no se te asignarán pedidos
        </div>
      )}

      <main className="flex-1 w-full max-w-md mx-auto pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2.5">
        <div className="max-w-md mx-auto flex justify-around text-xs font-bold">
          <NavLink to="/reparto" end className={navItem}>
            <Package className="w-4 h-4" />
            <span>Repartos</span>
          </NavLink>
          <NavLink to="/reparto/perfil" className={navItem}>
            <User className="w-4 h-4" />
            <span>Mi Perfil</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}