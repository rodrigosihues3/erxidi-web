import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Mail, Phone } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDeliveryAvailability } from "../../features/delivery/DeliveryAvailabilityContext";

export default function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const { available, setAvailable, activeRoutes } = useDeliveryAvailability();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Cierra el desplegable al tocar fuera de él
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  const firstName =
    profile?.first_name || user?.email?.split("@")[0] || "Usuario";
  const fullName =
    [profile?.first_name, profile?.paternal_surname, profile?.maternal_surname]
      .filter(Boolean)
      .join(" ") || firstName;
  const email = user?.email;
  const phone = profile?.phone;
  const initial = firstName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-button px-2 py-1.5 hover:bg-surface-subtle transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-800 text-sm font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </span>
        <span className="text-sm font-semibold text-brand-primary max-w-[110px] truncate">
          {firstName}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-brand-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface-card shadow-lg z-50 overflow-hidden">
          {/* 1. Datos del usuario */}
          <div className="p-4 space-y-1.5">
            <p className="text-sm font-bold text-brand-primary break-words">
              {fullName}
            </p>
            {email && (
              <p className="flex items-center gap-1.5 text-xs text-brand-secondary break-all">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                {email}
              </p>
            )}
            {phone && (
              <p className="flex items-center gap-1.5 text-xs text-brand-secondary">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {phone}
              </p>
            )}
          </div>

          {/* 2. Estado: disponible / no disponible (NUEVO) */}
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-brand-primary">
                  Estado
                </p>
                <p
                  className={`text-xs font-semibold ${
                    available ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {available ? "Disponible" : "No disponible"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={available}
                aria-label="Cambiar disponibilidad"
                onClick={() => setAvailable((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  available ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    available ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            {activeRoutes > 0 && !available && (
              <p className="mt-2 text-[11px] text-brand-secondary">
                Tienes una ruta en curso.
              </p>
            )}
          </div>

          {/* 3. Cerrar sesión */}
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-button text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}