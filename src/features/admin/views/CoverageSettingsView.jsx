import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import {
  MapPin,
  Save,
  RotateCcw,
  Store,
  Info,
  Check,
  AlertCircle,
  Loader2,
  Search,
  DollarSign,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Input from "../../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../../components/ui/Card";
import {
  getStoreDeliverySettings,
  saveStoreDeliverySettings,
} from "../services/adminSettings.service";

// Configuración de iconos Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Icono personalizado para el Taller / Tienda
const storeIcon = new L.DivIcon({
  className: "custom-store-pin",
  html: `<div style="background-color:#111827;border:2px solid #f59e0b;color:#ffffff;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Icono para los vértices arrastrables del polígono
const vertexIcon = new L.DivIcon({
  className: "custom-vertex-pin",
  html: `<div style="background-color:#f59e0b;border:2px solid #ffffff;border-radius:9999px;width:16px;height:16px;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const DEFAULT_POLYGON = [
  [-12.09, -77.05],
  [-12.085, -77.02],
  [-12.12, -77.01],
  [-12.15, -77.025],
  [-12.135, -77.045],
];

const DEFAULT_STORE = {
  lat: -12.1215,
  lng: -77.0298,
  name: "Taller ERXIDI Central",
  address: "Miraflores, Lima",
};

const DEFAULT_PRICING = {
  baseFee: 7.0,
  baseKm: 3.0,
  pricePerExtraKm: 1.5,
};

function MapViewUpdater({ center, flyToPos }) {
  const map = useMap();
  useEffect(() => {
    if (flyToPos && flyToPos.lat && flyToPos.lng) {
      map.flyTo([flyToPos.lat, flyToPos.lng], 16, { duration: 1.2 });
    }
  }, [flyToPos, map]);

  useEffect(() => {
    if (!flyToPos && center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, flyToPos, map]);
  return null;
}

export default function CoverageSettingsView() {
  const [polygon, setPolygon] = useState(DEFAULT_POLYGON);
  const [storeLocation, setStoreLocation] = useState(DEFAULT_STORE);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Buscador de dirección para el taller
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getStoreDeliverySettings()
      .then((data) => {
        if (!isMounted) return;
        if (data.polygon && Array.isArray(data.polygon) && data.polygon.length >= 3) {
          setPolygon(data.polygon);
        }
        if (data.storeLocation) {
          setStoreLocation(data.storeLocation);
          if (data.storeLocation.address) {
            setStoreSearchQuery(data.storeLocation.address);
          }
        }
        if (data.pricing) {
          setPricing({
            baseFee: Number(data.pricing.baseFee ?? DEFAULT_PRICING.baseFee),
            baseKm: Number(data.pricing.baseKm ?? DEFAULT_PRICING.baseKm),
            pricePerExtraKm: Number(
              data.pricing.pricePerExtraKm ?? DEFAULT_PRICING.pricePerExtraKm,
            ),
          });
        }
      })
      .catch((err) => {
        console.error("Error al cargar configuración de cobertura:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const searchWorkshopAddress = async (queryText) => {
    const q = (queryText || "").trim();
    if (!q || q.length < 3) return;
    setIsSearchingAddress(true);
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
        const newLoc = {
          ...storeLocation,
          lat: Number(foundLat.toFixed(6)),
          lng: Number(foundLng.toFixed(6)),
          address: data[0].display_name?.split(",")?.slice(0, 3)?.join(",") || q,
        };
        setStoreLocation(newLoc);
        setFlyToTarget({ lat: foundLat, lng: foundLng });
        setStatusMessage({
          type: "info",
          text: `Taller reubicado según búsqueda: ${data[0].display_name}`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: "No se encontraron coordenadas para esa dirección en Lima.",
        });
      }
    } catch (err) {
      console.error("Error en geocodificación Nominatim:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setStoreSearchQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length >= 4) {
      debounceTimerRef.current = setTimeout(() => {
        searchWorkshopAddress(val);
      }, 600);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    searchWorkshopAddress(storeSearchQuery);
  };

  const handleVertexDrag = (index, e) => {
    const { lat, lng } = e.target.getLatLng();
    setPolygon((prev) => {
      const next = [...prev];
      next[index] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
      return next;
    });
  };

  const handleStoreDrag = async (e) => {
    const { lat, lng } = e.target.getLatLng();
    const newLat = Number(lat.toFixed(6));
    const newLng = Number(lng.toFixed(6));

    setStoreLocation((prev) => ({
      ...prev,
      lat: newLat,
      lng: newLng,
    }));

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "es" },
      });
      const data = await res.json();
      const addr = data?.address || {};
      const road = addr.road || addr.pedestrian || addr.footway || addr.street;
      const houseNumber = addr.house_number;

      let addressText = "";
      if (road) {
        addressText = houseNumber ? `${road} ${houseNumber}` : road;
      } else if (data?.display_name) {
        addressText = data.display_name;
      }

      if (addressText) {
        setStoreSearchQuery(addressText);
        setStoreLocation((prev) => ({
          ...prev,
          lat: newLat,
          lng: newLng,
          address: addressText,
        }));
      }
    } catch (err) {
      console.error("Error en reverse geocoding:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      await saveStoreDeliverySettings(polygon, storeLocation, pricing);
      setStatusMessage({
        type: "success",
        text: "Configuración de cobertura, taller y tarifas guardada correctamente.",
      });
    } catch (err) {
      console.error("Error al guardar:", err);
      setStatusMessage({
        type: "error",
        text: "No se pudo guardar la configuración. Revisa los permisos.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPolygon(DEFAULT_POLYGON);
    setStoreLocation(DEFAULT_STORE);
    setPricing(DEFAULT_PRICING);
    setStatusMessage({
      type: "info",
      text: "Se restablecieron los valores predeterminados (recuerda presionar Guardar).",
    });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs text-brand-secondary font-semibold">
          Cargando configuración de cobertura...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-primary">
            Zona de Cobertura y Taller
          </h1>
          <p className="text-xs text-brand-secondary mt-0.5">
            Define el polígono geográfico para envíos a domicilio y la ubicación del taller de recojo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Resetear a valores por defecto
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={saving}
            disabled={saving}
            className="text-xs bg-accent hover:bg-accent-hover text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Guardar zona y ubicación de taller
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-card border text-xs flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : statusMessage.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : statusMessage.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Buscador de dirección para el taller */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5 items-end">
            <div className="flex-1 w-full">
              <Input
                label="Escribe la dirección del taller para centrar el pin"
                id="search-workshop-address"
                placeholder="Ej. Av. Larco 743, Miraflores o Av. Primavera 500"
                value={storeSearchQuery}
                onChange={handleSearchInputChange}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={isSearchingAddress || !storeSearchQuery.trim()}
              isLoading={isSearchingAddress}
              className="text-xs shrink-0 h-10 px-4"
            >
              <Search className="w-4 h-4 mr-1.5" />
              Buscar y centrar
            </Button>
          </form>
          <p className="mt-1.5 text-[11px] text-brand-muted">
            Se consulta OpenStreetMap / Nominatim y el pin del taller se moverá automáticamente a las coordenadas encontradas.
          </p>
        </CardContent>
      </Card>

      {/* Contenedor del Mapa */}
      <div className="bg-surface-card border border-border rounded-card overflow-hidden shadow-subtle">
        <div className="h-[520px] w-full relative z-0">
          <MapContainer
            center={[storeLocation.lat, storeLocation.lng]}
            zoom={13}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewUpdater center={storeLocation} flyToPos={flyToTarget} />

            {/* Polígono de Cobertura */}
            <Polygon
              positions={polygon}
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.2,
                weight: 2,
              }}
            />

            {/* Marcadores arrastrables en cada vértice del polígono */}
            {polygon.map((coord, idx) => (
              <Marker
                key={`vertex-${idx}`}
                position={coord}
                icon={vertexIcon}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => handleVertexDrag(idx, e),
                }}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    <strong>Vértice {idx + 1}</strong>
                    <br />
                    Lat: {coord[0].toFixed(5)}, Lng: {coord[1].toFixed(5)}
                    <br />
                    <span className="text-gray-500">Arrastra para modificar el límite.</span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Marcador arrastrable del Taller Central */}
            <Marker
              position={[storeLocation.lat, storeLocation.lng]}
              icon={storeIcon}
              draggable={true}
              eventHandlers={{
                dragend: handleStoreDrag,
              }}
            >
              <Popup>
                <div className="text-xs font-sans space-y-1">
                  <strong>{storeLocation.name || "Taller ERXIDI Central"}</strong>
                  <br />
                  <span>{storeLocation.address || "Punto de Partida y Recojo"}</span>
                  <br />
                  <span className="text-gray-500 font-mono text-[10px]">
                    [{storeLocation.lat.toFixed(5)}, {storeLocation.lng.toFixed(5)}]
                  </span>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Resumen de Coordenadas */}
        <div className="p-4 bg-surface-subtle border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="font-bold text-brand-primary block mb-1">
              Punto Taller ERXIDI:
            </span>
            <span className="text-brand-secondary">
              Lat: {storeLocation.lat} | Lng: {storeLocation.lng}
            </span>
          </div>
          <div>
            <span className="font-bold text-brand-primary block mb-1">
              Vértices del Polígono ({polygon.length} puntos):
            </span>
            <div className="flex flex-wrap gap-2 text-[11px] text-brand-secondary">
              {polygon.map((p, i) => (
                <span key={i} className="bg-surface-card border border-border px-1.5 py-0.5 rounded">
                  P{i + 1}: [{p[0]}, {p[1]}]
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Tarifas por Distancia debajo del Mapa */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-border bg-surface-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <CardTitle className="text-sm font-bold text-brand-primary">
                Configuración de Tarifas de Delivery por Distancia
              </CardTitle>
            </div>
            <Badge variant="neutral" className="text-[10px] font-mono">
              Fórmula Haversine
            </Badge>
          </div>
          <CardDescription className="text-xs text-brand-secondary">
            Define el costo de despacho en función de los kilómetros entre el Taller ERXIDI y la dirección de entrega del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Tarifa Base (S/)"
              id="pricing-base-fee"
              type="number"
              step="0.5"
              min="0"
              value={pricing.baseFee}
              onChange={(e) =>
                setPricing((prev) => ({
                  ...prev,
                  baseFee: parseFloat(e.target.value) || 0,
                }))
              }
              helperText="Costo cobrado dentro del radio base"
            />
            <Input
              label="Distancia Base Incluida (km)"
              id="pricing-base-km"
              type="number"
              step="0.5"
              min="0.5"
              value={pricing.baseKm}
              onChange={(e) =>
                setPricing((prev) => ({
                  ...prev,
                  baseKm: parseFloat(e.target.value) || 0,
                }))
              }
              helperText="Kilómetros cubiertos con la tarifa base"
            />
            <Input
              label="Costo por km Extra (S/)"
              id="pricing-extra-km"
              type="number"
              step="0.5"
              min="0"
              value={pricing.pricePerExtraKm}
              onChange={(e) =>
                setPricing((prev) => ({
                  ...prev,
                  pricePerExtraKm: parseFloat(e.target.value) || 0,
                }))
              }
              helperText="Monto adicional por cada km excedente"
            />
          </div>
          <div className="mt-4 p-3 bg-surface-subtle border border-border rounded-button text-xs text-brand-secondary">
            <p>
              <strong>Fórmula aplicada:</strong> Si distancia &le; {pricing.baseKm} km &rarr;{" "}
              <span className="font-mono text-brand-primary font-bold">
                S/ {pricing.baseFee.toFixed(2)}
              </span>. Si distancia &gt; {pricing.baseKm} km &rarr;{" "}
              <span className="font-mono text-brand-primary font-bold">
                S/ {pricing.baseFee.toFixed(2)} + (distancia - {pricing.baseKm}) &times; S/ {pricing.pricePerExtraKm.toFixed(2)}
              </span>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
