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
  Save,
  RotateCcw,
  Info,
  Check,
  AlertCircle,
  Loader2,
  Search,
  DollarSign,
  HelpCircle,
  X,
  Zap,
  Layers,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Input from "../../../components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../../components/ui/Card";
import {
  getStoreDeliverySettings,
  saveStoreDeliverySettings,
} from "../services/adminSettings.service";
import {
  calculateDeliveryFee,
  DEFAULT_SHIPPING_CONFIG,
} from "../../checkout/services/shippingCalculator";

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
  hyperlocalEnabled: DEFAULT_SHIPPING_CONFIG.hyperlocalEnabled,
  hyperlocalDistanceKm: DEFAULT_SHIPPING_CONFIG.hyperlocalDistanceKm,
  hyperlocalFee: DEFAULT_SHIPPING_CONFIG.hyperlocalFee,
  baseFee: DEFAULT_SHIPPING_CONFIG.baseFee,
  baseKm: DEFAULT_SHIPPING_CONFIG.baseDistanceKm,
  pricePerExtraKm: DEFAULT_SHIPPING_CONFIG.extraKmFee,
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

  // Popover de ayuda y simulador interactivo
  const [showPricingHelp, setShowPricingHelp] = useState(false);
  const [simulatedKm, setSimulatedKm] = useState("0.8");
  const helpPopoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        helpPopoverRef.current &&
        !helpPopoverRef.current.contains(event.target)
      ) {
        setShowPricingHelp(false);
      }
    }
    if (showPricingHelp) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPricingHelp]);

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
        if (
          data.polygon &&
          Array.isArray(data.polygon) &&
          data.polygon.length >= 3
        ) {
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
            hyperlocalEnabled:
              data.pricing.hyperlocalEnabled !== undefined
                ? Boolean(data.pricing.hyperlocalEnabled)
                : DEFAULT_PRICING.hyperlocalEnabled,
            hyperlocalDistanceKm: Number(
              data.pricing.hyperlocalDistanceKm ??
              DEFAULT_PRICING.hyperlocalDistanceKm
            ),
            hyperlocalFee: Number(
              data.pricing.hyperlocalFee ?? DEFAULT_PRICING.hyperlocalFee
            ),
            baseFee: Number(data.pricing.baseFee ?? DEFAULT_PRICING.baseFee),
            baseKm: Number(data.pricing.baseKm ?? DEFAULT_PRICING.baseKm),
            pricePerExtraKm: Number(
              data.pricing.pricePerExtraKm ?? DEFAULT_PRICING.pricePerExtraKm
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
          address:
            data[0].display_name?.split(",")?.slice(0, 3)?.join(",") || q,
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
          <p className="text-xs text-brand-secondary">
            Define el polígono geográfico para envíos a domicilio y la ubicación
            del taller de recojo.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
          className={`p-3.5 rounded-card border text-xs flex items-center gap-2 ${statusMessage.type === "success"
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
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-2.5 items-end"
          >
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
            Se consulta OpenStreetMap / Nominatim y el pin del taller se moverá
            automáticamente a las coordenadas encontradas.
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
                    <span className="text-gray-500">
                      Arrastra para modificar el límite.
                    </span>
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
                  <strong>
                    {storeLocation.name || "Taller ERXIDI Central"}
                  </strong>
                  <br />
                  <span>
                    {storeLocation.address || "Punto de Partida y Recojo"}
                  </span>
                  <br />
                  <span className="text-gray-500 font-mono text-[10px]">
                    [{storeLocation.lat.toFixed(5)},{" "}
                    {storeLocation.lng.toFixed(5)}]
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
                <span
                  key={i}
                  className="bg-surface-card border border-border px-1.5 py-0.5 rounded"
                >
                  P{i + 1}: [{p[0]}, {p[1]}]
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Tarifas por Distancia debajo del Mapa */}
      <Card className="overflow-hidden border border-border shadow-subtle">
        <CardHeader className="py-4 px-5 border-b border-border bg-surface-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 relative">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold text-brand-primary">
                    Configuración de Tarifas de Delivery por Distancia
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setShowPricingHelp((prev) => !prev)}
                    className="text-brand-secondary hover:text-brand-primary p-0.5 rounded transition-colors focus:outline-none"
                    title="Ver explicación de tramos y simulador interactivo"
                    aria-label="Ayuda y simulador interactivo de tarifas"
                  >
                    <HelpCircle className="w-4 h-4 text-brand-secondary hover:text-brand-primary" />
                  </button>
                </div>
                <CardDescription className="text-xs text-brand-secondary mt-0.5">
                  Define los costos escalonados de despacho según la distancia entre el Taller ERXIDI y el cliente.
                </CardDescription>
              </div>

              {/* Popover Explicativo con Simulador en Vivo */}
              {showPricingHelp && (
                <div
                  ref={helpPopoverRef}
                  className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 bg-surface-card border border-border rounded-card p-4 shadow-dropdown text-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold text-brand-primary text-xs uppercase tracking-wider">
                      Estructura Tarifaria Escalonada
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPricingHelp(false)}
                      className="text-brand-secondary hover:text-brand-primary p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-brand-secondary leading-relaxed">
                    <div className="p-2.5 rounded bg-surface-subtle border border-border">
                      <strong className="text-brand-primary block mb-0.5">
                        1. Tramo Hiperlocal (0 a{" "}
                        {Number(pricing.hyperlocalDistanceKm).toFixed(2)} km)
                      </strong>
                      <span>
                        Tarifa preferencial de{" "}
                        <span className="font-mono font-bold text-brand-primary">
                          S/ {Number(pricing.hyperlocalFee).toFixed(2)}
                        </span>{" "}
                        aplicable a pedidos ultracercanos dentro del radio
                        hiperlocal{" "}
                        {pricing.hyperlocalEnabled
                          ? "(Activo)"
                          : "(Desactivado)"}
                        .
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-surface-subtle border border-border">
                      <strong className="text-brand-primary block mb-0.5">
                        2. Cobertura Base en Moto (Hasta{" "}
                        {Number(pricing.baseKm).toFixed(2)} km)
                      </strong>
                      <span>
                        Tarifa regular en motocicleta de{" "}
                        <span className="font-mono font-bold text-brand-primary">
                          S/ {Number(pricing.baseFee).toFixed(2)}
                        </span>{" "}
                        para el radio de despacho nuclear.
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-surface-subtle border border-border">
                      <strong className="text-brand-primary block mb-0.5">
                        3. Kilómetros Excedentes (&gt;{" "}
                        {Number(pricing.baseKm).toFixed(2)} km)
                      </strong>
                      <span>
                        Tarifa base más{" "}
                        <span className="font-mono font-bold text-brand-primary">
                          S/ {Number(pricing.pricePerExtraKm).toFixed(2)}
                        </span>{" "}
                        por cada kilómetro adicional que exceda el radio base.
                      </span>
                    </div>
                  </div>

                  {/* Simulador Interactivo */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                      Simulador Interactivo
                    </label>
                    <Input
                      label="Probar distancia (km)"
                      id="pricing-sim-distance"
                      type="number"
                      step="0.1"
                      min="0"
                      value={simulatedKm}
                      onChange={(e) => setSimulatedKm(e.target.value)}
                      className="font-mono text-xs"
                    />
                    {(() => {
                      const parsedKm = parseFloat(simulatedKm);
                      const validKm = isNaN(parsedKm) ? 0 : Math.max(0, parsedKm);
                      const res = calculateDeliveryFee(validKm, pricing);
                      return (
                        <div className="p-2.5 rounded bg-surface-subtle border border-border font-mono text-[11px] text-brand-primary">
                          Distancia ingresada:{" "}
                          <span className="font-bold">
                            {validKm.toFixed(1)} km
                          </span>{" "}
                          &rarr; Tarifa resultante:{" "}
                          <span className="font-bold text-accent">
                            S/ {res.fee.toFixed(2)}
                          </span>{" "}
                          <span className="text-brand-secondary">
                            [Tramo: {res.tier}]
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <Badge variant="neutral" className="text-[10px] font-mono self-start sm:self-auto">
              Fórmula Escalonada
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Bloque 1: Escalón Hiperlocal */}
          <div
            className={`rounded-card border transition-all ${pricing.hyperlocalEnabled
              ? "bg-surface-card border-border shadow-xs"
              : "bg-surface-subtle/50 border-border/70"
              }`}
          >
            <div className="p-4 border-b border-border/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${pricing.hyperlocalEnabled
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-brand-primary block">
                    Escalón Hiperlocal
                  </span>
                  <span className="text-[11px] text-brand-secondary">
                    Tarifa preferencial reducida para despachos a pie o proximidad inmediata.
                  </span>
                </div>
              </div>

              {/* Switch Toggle Accesible */}
              <button
                type="button"
                role="switch"
                aria-checked={pricing.hyperlocalEnabled}
                onClick={() =>
                  setPricing((prev) => ({
                    ...prev,
                    hyperlocalEnabled: !prev.hyperlocalEnabled,
                  }))
                }
                className="flex items-center gap-2.5 focus:outline-none cursor-pointer shrink-0"
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${pricing.hyperlocalEnabled
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-slate-500 bg-slate-100 border-slate-200"
                    }`}
                >
                  {pricing.hyperlocalEnabled ? "Habilitado" : "Deshabilitado"}
                </span>
                <div
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${pricing.hyperlocalEnabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${pricing.hyperlocalEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                  />
                </div>
              </button>
            </div>

            <div
              className={`p-4 transition-opacity duration-200 ${!pricing.hyperlocalEnabled ? "opacity-45 pointer-events-none" : ""
                }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Tarifa Hiperlocal (S/)"
                  id="pricing-hyperlocal-fee"
                  type="number"
                  step="0.5"
                  min="0"
                  disabled={!pricing.hyperlocalEnabled}
                  value={pricing.hyperlocalFee}
                  onChange={(e) =>
                    setPricing((prev) => ({
                      ...prev,
                      hyperlocalFee: parseFloat(e.target.value) || 0,
                    }))
                  }
                  helperText="Costo cobrado dentro del radio hiperlocal (por defecto S/ 3.50)"
                  className="font-mono"
                />
                <Input
                  label="Radio Hiperlocal (km)"
                  id="pricing-hyperlocal-km"
                  type="number"
                  step="0.05"
                  min="0.1"
                  disabled={!pricing.hyperlocalEnabled}
                  value={pricing.hyperlocalDistanceKm}
                  onChange={(e) =>
                    setPricing((prev) => ({
                      ...prev,
                      hyperlocalDistanceKm: parseFloat(e.target.value) || 0,
                    }))
                  }
                  helperText="Distancia máxima para tarifa hiperlocal (por defecto 0.80 km)"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Bloque 2: Cobertura Base y Km Extra */}
          <div className="rounded-card border border-border bg-surface-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-brand-primary block">
                  Cobertura Base en Moto y Kilómetros Excedentes
                </span>
                <span className="text-[11px] text-brand-secondary">
                  Tarifa regular en motocicleta y recargo adicional por distancia recorrida.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
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
                helperText="Costo cobrado dentro del radio base (por defecto S/ 7.00)"
                className="font-mono"
              />
              <Input
                label="Distancia Base (km)"
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
                helperText="Kilómetros cubiertos con tarifa base (por defecto 3.00 km)"
                className="font-mono"
              />
              <Input
                label="Costo por km extra (S/)"
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
                helperText="Monto adicional por cada km excedente (por defecto S/ 1.00)"
                className="font-mono"
              />
            </div>
          </div>

          {/* Bloque 3: Resumen Visual de Tramos y Fórmula */}
          <div className="rounded-card border border-border bg-surface-subtle p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-secondary block">
              Escala de Liquidación Resultante
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-card border border-border rounded-lg space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary block">
                  Tramo 1: Hiperlocal
                </span>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-brand-secondary">
                    0.0 - {Number(pricing.hyperlocalDistanceKm).toFixed(2)} km
                  </span>
                  {pricing.hyperlocalEnabled ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                      S/ {Number(pricing.hyperlocalFee).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      Inactivo
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-surface-card border border-border rounded-lg space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary block">
                  Tramo 2: Base Moto
                </span>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-brand-secondary">
                    {pricing.hyperlocalEnabled
                      ? Number(pricing.hyperlocalDistanceKm).toFixed(2)
                      : "0.00"}{" "}
                    - {Number(pricing.baseKm).toFixed(2)} km
                  </span>
                  <span className="font-bold text-brand-primary bg-surface-subtle border border-border px-1.5 py-0.5 rounded text-[11px]">
                    S/ {Number(pricing.baseFee).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-surface-card border border-border rounded-lg space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary block">
                  Tramo 3: Excedente
                </span>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-brand-secondary">
                    &gt; {Number(pricing.baseKm).toFixed(2)} km
                  </span>
                  <span className="font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded text-[11px]">
                    S/ {Number(pricing.baseFee).toFixed(2)} + S/ {Number(pricing.pricePerExtraKm).toFixed(2)}/km
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-brand-secondary pt-1 border-t border-border/70 font-mono">
              <strong>Fórmula:</strong>{" "}
              {pricing.hyperlocalEnabled && (
                <>
                  Si d &le; {Number(pricing.hyperlocalDistanceKm).toFixed(2)} km &rarr;{" "}
                  <span className="text-brand-primary font-bold">
                    S/ {Number(pricing.hyperlocalFee).toFixed(2)}
                  </span>
                  .{" "}
                </>
              )}
              Si d &le; {Number(pricing.baseKm).toFixed(2)} km &rarr;{" "}
              <span className="text-brand-primary font-bold">
                S/ {Number(pricing.baseFee).toFixed(2)}
              </span>
              . Si d &gt; {Number(pricing.baseKm).toFixed(2)} km &rarr;{" "}
              <span className="text-brand-primary font-bold">
                S/ {Number(pricing.baseFee).toFixed(2)} + (d - {Number(pricing.baseKm).toFixed(2)}) &times; S/ {Number(pricing.pricePerExtraKm).toFixed(2)}
              </span>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
