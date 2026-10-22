import { NavLink, Outlet } from "react-router-dom";
import { Package, User } from "lucide-react";
import {
  DRIVER_STATUS,
  useDeliveryAvailability,
} from "../../features/delivery/DeliveryAvailabilityContext";

const navItem = ({ isActive }) =>
  `flex flex-col items-center gap-1 transition-colors ${
    isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-700"
  }`;

export default function DeliveryLayout() {
  const { status, setStatus } = useDeliveryAvailability();
  const theme = DRIVER_STATUS[status];

  return (
    <div
      className={`min-h-screen flex flex-col text-slate-800 transition-colors duration-500 ease-in-out ${theme.page}`}
    >
      <header
        className={`sticky top-0 z-40 text-white px-4 py-3 shadow-md transition-colors duration-500 ${theme.header}`}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.ping}`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${theme.dot}`}
              />
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

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Cambiar estado operativo"
            className="text-xs font-bold bg-black/20 hover:bg-black/30 border border-white/25 rounded-lg px-2.5 py-1.5 text-white focus:outline-none transition-colors shrink-0"
          >
            <option className="text-slate-900" value="available">
              🟢 Disponible
            </option>
            <option className="text-slate-900" value="on_route">
              🟠 En Ruta
            </option>
            <option className="text-slate-900" value="paused">
              🔴 En Pausa
            </option>
          </select>
        </div>
      </header>

      {status === "paused" && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center shadow-inner animate-pulse">
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