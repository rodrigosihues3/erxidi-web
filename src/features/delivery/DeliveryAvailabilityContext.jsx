import { createContext, useContext, useEffect, useRef, useState } from "react";

// Apariencia de cada estado del repartidor (fondo, cabecera y pulso)
export const DRIVER_STATUS = {
  available: {
    label: "Disponible",
    badge: "Estado operativo",
    title: "Disponible en Base",
    page: "bg-emerald-50",
    header: "bg-emerald-600",
    badgeText: "text-emerald-100",
    dot: "bg-white",
    ping: "bg-emerald-200",
  },
  on_route: {
    label: "En ruta",
    badge: "En despacho",
    title: "Entregando en Ruta",
    page: "bg-amber-50",
    header: "bg-amber-600",
    badgeText: "text-amber-100",
    dot: "bg-white",
    ping: "bg-amber-200",
  },
  paused: {
    label: "En pausa",
    badge: "Desconectado",
    title: "En Pausa / No Disponible",
    page: "bg-slate-200",
    header: "bg-slate-800 border-b-2 border-rose-500",
    badgeText: "text-slate-300",
    dot: "bg-rose-500",
    ping: "bg-rose-400",
  },
};

const DeliveryAvailabilityContext = createContext(null);

export function DeliveryAvailabilityProvider({ children }) {
  const [status, setStatus] = useState("available");
  const [activeRoutes, setActiveRoutes] = useState(0);
  const prevActive = useRef(0);

  // Automático: al iniciar la primera ruta -> en ruta; al terminar la última
  // -> disponible. Si está en pausa, no se toca.
  useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = activeRoutes;
    if (prev === 0 && activeRoutes > 0) {
      setStatus((s) => (s === "paused" ? s : "on_route"));
    }
    if (prev > 0 && activeRoutes === 0) {
      setStatus((s) => (s === "on_route" ? "available" : s));
    }
  }, [activeRoutes]);

  const resetAvailability = () => {
    prevActive.current = 0;
    setActiveRoutes(0);
    setStatus("available");
  };

  const value = {
    status,
    setStatus,
    activeRoutes,
    setActiveRoutes,
    resetAvailability,
  };

  return (
    <DeliveryAvailabilityContext.Provider value={value}>
      {children}
    </DeliveryAvailabilityContext.Provider>
  );
}

export function useDeliveryAvailability() {
  const context = useContext(DeliveryAvailabilityContext);
  if (!context) {
    throw new Error(
      "useDeliveryAvailability debe usarse dentro de DeliveryAvailabilityProvider",
    );
  }
  return context;
}