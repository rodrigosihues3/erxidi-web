import React, { useState, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  ZoomControl,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search,
  LocateFixed,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER = [-12.0464, -77.0428];

function MapController({ center, isExpanded }) {
  const map = useMap();

  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 0.8 });
    }
  }, [center, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isExpanded, map]);

  return null;
}

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  searchQuery: externalSearchQuery = "",
  coveragePolygon = null,
  height = "h-64",
}) {
  const [internalQuery, setInternalQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasCoords = latitude != null && longitude != null;
  const currentPosition = hasCoords
    ? [Number(latitude), Number(longitude)]
    : null;

  const polygonPositions =
    Array.isArray(coveragePolygon) && coveragePolygon.length >= 3
      ? coveragePolygon.map((pt) =>
        Array.isArray(pt)
          ? [Number(pt[0]), Number(pt[1])]
          : [Number(pt.lat), Number(pt.lng)]
      )
      : null;

  const executeGeocodeSearch = useCallback(
    async (rawText) => {
      const clean = String(rawText || "").trim();
      if (clean.length < 3) return;
      setIsSearching(true);
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(clean + ", Lima, Peru") +
          "&limit=1";
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          onChange?.({ lat, lng });
        }
      } catch (err) {
        console.warn("Error buscando ubicación en el mapa:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [onChange]
  );

  // Ejecutar búsqueda cuando el componente padre dispara searchQuery mediante botón de lupa
  useEffect(() => {
    if (externalSearchQuery && externalSearchQuery.trim().length >= 3) {
      setInternalQuery(externalSearchQuery.trim());
      executeGeocodeSearch(externalSearchQuery);
    }
  }, [externalSearchQuery, executeGeocodeSearch]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      window.alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange?.({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        window.alert(
          "No se pudo obtener tu ubicación actual. Verifica los permisos de GPS de tu navegador."
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const wrapperClasses = isExpanded
    ? "fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex flex-col justify-center items-center"
    : "relative w-full";

  const containerClasses = isExpanded
    ? "relative w-full max-w-5xl h-[85vh] bg-white rounded-card border border-border overflow-hidden shadow-2xl flex flex-col"
    : "relative w-full rounded-card border border-border overflow-hidden bg-surface-subtle " +
    height;

  return (
    <div className={wrapperClasses}>
      <div className={containerClasses}>
        {/* Barra superior responsiva libre de colisión con los botones de Zoom */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-[400] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center bg-white/95 backdrop-blur-xs rounded-button border border-border shadow-md overflow-hidden flex-1 max-w-full sm:max-w-xs pointer-events-auto">
            <input
              type="text"
              value={internalQuery}
              onChange={(e) => setInternalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  executeGeocodeSearch(internalQuery);
                }
              }}
              placeholder="Buscar calle o distrito..."
              className="w-full h-9 px-3 text-xs text-brand-primary bg-transparent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => executeGeocodeSearch(internalQuery)}
              disabled={isSearching}
              className="h-9 px-3 bg-brand-primary text-white hover:bg-brand-secondary transition-colors flex items-center justify-center shrink-0"
              title="Buscar en el mapa"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="h-9 px-3 bg-white/95 hover:bg-white text-brand-primary border border-border rounded-button shadow-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Usar mi ubicación GPS actual"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5 text-accent" />
              )}
              <span>Mi ubicación</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-9 px-3 bg-brand-primary text-white hover:bg-brand-secondary rounded-button shadow-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title={
                isExpanded
                  ? "Reducir mapa"
                  : "Ampliar mapa a pantalla completa"
              }
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Cerrar vista amplia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ampliar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Leyenda inferior izquierda del área de cobertura */}
        {polygonPositions && (
          <div className="absolute bottom-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur-xs border border-border rounded-badge px-2.5 py-1 shadow-sm flex items-center gap-2 text-[11px] font-medium text-brand-primary pointer-events-none">
            <span className="w-3 h-3 rounded-xs bg-emerald-500/30 border border-emerald-600 inline-block" />
            <span>Área de cobertura de reparto</span>
          </div>
        )}

        <MapContainer
          center={currentPosition || DEFAULT_CENTER}
          zoom={currentPosition ? 16 : 12}
          zoomControl={false}
          className="w-full h-full z-10"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Control de Zoom (+) y (-) en la esquina inferior derecha */}
          <ZoomControl position="bottomright" />

          <MapController center={currentPosition} isExpanded={isExpanded} />
          <ClickHandler onSelect={onChange} />

          {polygonPositions && (
            <Polygon
              positions={polygonPositions}
              pathOptions={{
                color: "#059669",
                weight: 2,
                fillColor: "#10B981",
                fillOpacity: 0.14,
                dashArray: "6, 6",
              }}
            />
          )}

          {currentPosition && (
            <Marker
              position={currentPosition}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onChange?.({ lat: pos.lat, lng: pos.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}