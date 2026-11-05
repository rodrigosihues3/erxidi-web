import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";
import { STATUS_CONFIG } from "./deliveryStatus";

// Colores de los puntos según el estado del pedido
const PIN_COLORS = {
  asignado: "#2563eb",
  en_camino: "#d97706",
  cerca: "#059669",
  pool: "#94a3b8",
};

const LEGEND = [
  { label: "Asignado", color: PIN_COLORS.asignado },
  { label: "En camino", color: PIN_COLORS.en_camino },
  { label: "Cerca", color: PIN_COLORS.cerca },
  { label: "Bolsa", color: PIN_COLORS.pool },
];

// Íconos dibujados con HTML: no dependen de imágenes externas
const makePin = (color) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });

const PIN_ICONS = {
  asignado: makePin(PIN_COLORS.asignado),
  en_camino: makePin(PIN_COLORS.en_camino),
  cerca: makePin(PIN_COLORS.cerca),
  pool: makePin(PIN_COLORS.pool),
};

const STORE_ICON = L.divIcon({
  className: "",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:#111827;color:#fff;font:700 13px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">T</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

const coordOf = (o) => {
  const lat = Number(o.delivery_latitude);
  const lng = Number(o.delivery_longitude);
  return o.delivery_latitude != null &&
    o.delivery_longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
    ? [lat, lng]
    : null;
};

const itemCountOf = (o) =>
  o.total_items ??
  (o.order_items ?? o.items ?? []).reduce(
    (a, i) => a + (Number(i.quantity) || 0),
    0,
  );

const navigateUrl = ([lat, lng]) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

// Encuadra el mapa para que se vean todos los puntos.
// Solo se reencuadra cuando cambia el conjunto de puntos, no en cada render.
function FitBounds({ pointsKey }) {
  const map = useMap();
  useEffect(() => {
    const pts = pointsKey
      ? pointsKey.split("|").map((p) => p.split(",").map(Number))
      : [];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 16 });
  }, [pointsKey, map]);
  return null;
}

function OrderPopup({ order, kind, coord, onViewOrder }) {
  const statusLabel =
    kind === "pool"
      ? "En bolsa"
      : (STATUS_CONFIG[order.status]?.label ?? order.status);
  const address = order.delivery_address ?? "Sin dirección registrada";

  return (
    <div style={{ minWidth: 190 }}>
      <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>
        {order.order_number}
      </div>
      <div style={{ fontSize: 12, marginTop: 2, color: "#475569" }}>
        {statusLabel}
      </div>
      <div style={{ fontSize: 12, marginTop: 6 }}>{address}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: "#475569" }}>
        <span style={{ fontFamily: "monospace" }}>{itemCountOf(order)}</span>{" "}
        prendas ·{" "}
        <span style={{ fontFamily: "monospace" }}>
          {soles(order.total_amount)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <a
          href={navigateUrl(coord)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-button bg-accent text-xs font-semibold"
          style={{ color: "#fff", textDecoration: "none" }}
        >
          <Navigation className="w-3.5 h-3.5" />
          Navegar
        </a>
        <button
          type="button"
          onClick={() => onViewOrder(order, kind)}
          className="inline-flex items-center justify-center h-8 px-3 rounded-button border border-border bg-surface-card text-xs font-semibold text-brand-primary"
        >
          {kind === "pool" ? "Ver en bolsa" : "Ver pedido"}
        </button>
      </div>
    </div>
  );
}

// assigned: pedidos del repartidor; poolOrders: pedidos de la bolsa;
// store: [lat, lng] de la tienda; onViewOrder(order, "assigned" | "pool")
export default function DeliveryMapView({
  assigned,
  poolOrders,
  store,
  onViewOrder,
}) {
  const assignedPins = assigned
    .map((order) => ({ order, coord: coordOf(order) }))
    .filter((p) => p.coord);
  const poolPins = poolOrders
    .map((order) => ({ order, coord: coordOf(order) }))
    .filter((p) => p.coord);

  const missing =
    assigned.length + poolOrders.length - assignedPins.length - poolPins.length;

  const pointsKey = [
    store,
    ...assignedPins.map((p) => p.coord),
    ...poolPins.map((p) => p.coord),
  ]
    .map((c) => c.join(","))
    .join("|");

  return (
    <div className="space-y-2">
      <div
        className="relative z-0 h-[60vh] min-h-[320px] overflow-hidden rounded-card border border-border"
        style={{ isolation: "isolate" }}
      >
        <MapContainer center={store} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds pointsKey={pointsKey} />

          <Marker position={store} icon={STORE_ICON}>
            <Popup>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Tienda (base)</div>
            </Popup>
          </Marker>

          {poolPins.map(({ order, coord }) => (
            <Marker key={`p-${order.id}`} position={coord} icon={PIN_ICONS.pool}>
              <Popup>
                <OrderPopup
                  order={order}
                  kind="pool"
                  coord={coord}
                  onViewOrder={onViewOrder}
                />
              </Popup>
            </Marker>
          ))}

          {assignedPins.map(({ order, coord }) => (
            <Marker
              key={`a-${order.id}`}
              position={coord}
              icon={PIN_ICONS[order.status] ?? PIN_ICONS.asignado}
            >
              <Popup>
                <OrderPopup
                  order={order}
                  kind="assigned"
                  coord={coord}
                  onViewOrder={onViewOrder}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-secondary">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: l.color }}
            />
            {l.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: "#111827" }}
          />
          Tienda
        </span>
      </div>

      {missing > 0 && (
        <p className="text-xs text-brand-secondary">
          {missing === 1
            ? "1 pedido sin ubicación no aparece en el mapa."
            : `${missing} pedidos sin ubicación no aparecen en el mapa.`}
        </p>
      )}
    </div>
  );
}