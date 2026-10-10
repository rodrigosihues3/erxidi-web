import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

// Corregir el icono roto por defecto de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const DEFAULT_CENTER = [-12.046374, -77.042793]; // Lima Metropolitana
const DEFAULT_ZOOM = 13;

function MapEventsHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterController({ position, flyToTarget }) {
  const map = useMap();
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (flyToTarget && flyToTarget.lat && flyToTarget.lng) {
      map.flyTo([flyToTarget.lat, flyToTarget.lng], 16, { duration: 1.2 });
      return;
    }

    if (
      position &&
      Array.isArray(position) &&
      (!lastPosRef.current ||
        lastPosRef.current[0] !== position[0] ||
        lastPosRef.current[1] !== position[1])
    ) {
      lastPosRef.current = position;
      map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 1.2 });
    }
  }, [position, flyToTarget, map]);

  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  className = "",
  height = "h-64",
  searchQuery = "",
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchText, setLocalSearchText] = useState("");
  const [flyToTarget, setFlyToTarget] = useState(null);
  const markerRef = useRef(null);
  const lastExecutedSearchRef = useRef("");

  const searchAddress = async (text) => {
    const q = (text || "").trim();
    if (!q || q.length < 5) return;
    if (lastExecutedSearchRef.current === q) return;
    lastExecutedSearchRef.current = q;
    setIsSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q + ", Lima, Peru",
      )}&limit=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "es" },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        setFlyToTarget({ lat: foundLat, lng: foundLng });
        onChange?.({ lat: foundLat, lng: foundLng });
      }
    } catch (err) {
      console.warn("Error geocodificando en LocationPickerMap:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Reaccionar al prop searchQuery si cambia con longitud >= 5
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 5) {
      const timer = setTimeout(() => {
        searchAddress(searchQuery);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const isValidCoord =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  const markerPosition = useMemo(() => {
    return isValidCoord ? [latitude, longitude] : null;
  }, [isValidCoord, latitude, longitude]);

  const mapCenter = markerPosition || DEFAULT_CENTER;
  const initialZoom = isValidCoord ? 15 : DEFAULT_ZOOM;

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onChange?.({ lat, lng });
        }
      },
    }),
    [onChange],
  );

  const handleMapClick = (lat, lng) => {
    onChange?.({ lat, lng });
  };

  const handleUseCurrentLocation = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!navigator.geolocation) {
      alert("La geolocalización no está disponible en tu navegador.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange?.({ lat, lng });
      },
      (err) => {
        setIsLocating(false);
        console.warn("Error obteniendo ubicación:", err);
        alert(
          "No se pudo acceder a tu ubicación actual. Revisa los permisos del navegador.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  return (
    <div
      className={`relative w-full rounded-card border border-border overflow-hidden bg-surface-subtle ${height} ${className}`}
    >
      <MapContainer
        center={mapCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventsHandler onSelect={handleMapClick} />

        <MapCenterController
          position={markerPosition}
          flyToTarget={flyToTarget}
        />

        {markerPosition && (
          <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={markerPosition}
            ref={markerRef}
          />
        )}
      </MapContainer>

      {/* Buscador de dirección rápido en la esquina superior izquierda */}
      <div className="absolute top-2.5 left-2.5 z-[1000] max-w-[210px] sm:max-w-xs w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            searchAddress(localSearchText);
          }}
          className="flex items-center bg-white/95 backdrop-blur-sm rounded-button border border-border shadow-md overflow-hidden"
        >
          <input
            type="text"
            placeholder="Buscar calle o ref..."
            value={localSearchText}
            onChange={(e) => setLocalSearchText(e.target.value)}
            className="w-full px-2.5 py-1 text-xs text-brand-primary placeholder:text-brand-muted bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching || localSearchText.trim().length < 3}
            className="p-1.5 text-brand-secondary hover:text-accent disabled:opacity-40"
            title="Buscar dirección"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

      {/* Botón flotante: Usar mi ubicación actual */}
      <div className="absolute top-2.5 right-2.5 z-[1000]">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-brand-primary rounded-button shadow-md border border-border hover:bg-surface-subtle transition-colors disabled:opacity-50 select-none cursor-pointer"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          ) : (
            <Crosshair className="w-3.5 h-3.5 text-accent" />
          )}
          <span>Usar mi ubicación actual</span>
        </button>
      </div>

      {/* Indicador de coordenadas / instrucción */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-button border border-border text-[11px] font-mono text-brand-secondary shadow-sm flex items-center gap-1.5 select-none">
        <MapPin className="w-3 h-3 text-accent shrink-0" />
        {isValidCoord ? (
          <span>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </span>
        ) : (
          <span className="font-sans text-[11px] text-brand-muted">
            Haz clic en el mapa para fijar el pin de entrega
          </span>
        )}
      </div>
    </div>
  );
}
