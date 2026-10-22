import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
  DRIVER_STATUS,
  useDeliveryAvailability,
} from "../DeliveryAvailabilityContext";

export default function DeliveryProfileView() {
  const { user, profile, signOut } = useAuth();
  const { status, resetAvailability } = useDeliveryAvailability();
  const navigate = useNavigate();
  const theme = DRIVER_STATUS[status];

  const firstName =
    profile?.first_name || user?.email?.split("@")[0] || "Usuario";
  const fullName =
    [profile?.first_name, profile?.paternal_surname, profile?.maternal_surname]
      .filter(Boolean)
      .join(" ") || firstName;
  const initial = firstName.charAt(0).toUpperCase();

  // Solo se muestran los datos que existan en el perfil
  const rows = [
    { label: "Correo", value: user?.email },
    { label: "Teléfono", value: profile?.phone },
    { label: "DNI", value: profile?.dni },
    { label: "Vehículo", value: profile?.vehicle },
  ].filter((r) => r.value);

  const handleSignOut = async () => {
    resetAvailability();
    await signOut();
    navigate("/login");
  };

  return (
    <div className="p-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 break-words">
              {fullName}
            </h2>
            <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Estado actual: {theme.label}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex justify-between gap-4 py-1 border-b border-slate-50"
            >
              <span className="text-slate-500 font-semibold">{r.label}</span>
              <span className="font-bold text-slate-800 text-right break-all">
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-2.5 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg text-xs border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}