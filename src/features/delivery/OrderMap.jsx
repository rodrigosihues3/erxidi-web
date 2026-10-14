import { useEffect, useState } from "react";

// Clave opcional de Google Maps (Maps Embed API). Sin clave, el mapa sigue
// funcionando pero solo muestra el punto de destino, sin ruta desde el repartidor.
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// destination: dirección ya limpia, por ejemplo "Av. jose diaz, Miraflores"
export default function OrderMap({ destination }) {
  const [origin, setOrigin] = useState(null);

  // Solo con clave se pide la ubicación del repartidor, para trazar la ruta
  // desde donde está. El navegador le pedirá permiso.
  useEffect(() => {
    if (!API_KEY || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin(`${pos.coords.latitude},${pos.coords.longitude}`),
      () => setOrigin(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  if (!destination) return null;

  const place = encodeURIComponent(`${destination}, Lima, Perú`);

  let src;
  let caption;
  if (API_KEY && origin) {
    src = `https://www.google.com/maps/embed/v1/directions?key=${API_KEY}&origin=${origin}&destination=${place}&mode=driving`;
    caption = "Ruta desde tu ubicación actual";
  } else if (API_KEY) {
    src = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${place}`;
    caption = "Ubicación del cliente (activa tu ubicación para ver la ruta)";
  } else {
    src = `https://www.google.com/maps?q=${place}&output=embed`;
    caption = "Ubicación del cliente";
  }

  return (
    <div className="mt-3">
      <div className="h-56 w-full overflow-hidden rounded-button border border-border">
        <iframe
          title={`Mapa de ${destination}`}
          src={src}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="mt-1 text-xs text-brand-secondary">{caption}</p>
    </div>
  );
}
