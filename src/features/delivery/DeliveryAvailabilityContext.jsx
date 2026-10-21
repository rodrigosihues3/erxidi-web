import { createContext, useContext, useEffect, useRef, useState } from "react";

const DeliveryAvailabilityContext = createContext(null);

export function DeliveryAvailabilityProvider({ children }) {
  const [available, setAvailable] = useState(true);
  const [activeRoutes, setActiveRoutes] = useState(0);
  const prevActive = useRef(0);

  // Automático: al iniciar la primera ruta -> no disponible;
  // al terminar la última -> disponible otra vez.
  useEffect(() => {
    if (prevActive.current === 0 && activeRoutes > 0) setAvailable(false);
    if (prevActive.current > 0 && activeRoutes === 0) setAvailable(true);
    prevActive.current = activeRoutes;
  }, [activeRoutes]);

  const value = { available, setAvailable, activeRoutes, setActiveRoutes };

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