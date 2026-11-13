import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Truck,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Banknote,
  MapPin,
  Package,
  Phone,
  Navigation,
  ChevronDown,
  ShoppingBag,
  QrCode,
  X,
  LogOut,
  Zap,
  Calendar,
} from "lucide-react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { useDeliveryOrders, MAX_ITEMS_PER_TRIP } from "./useDeliveryOrders";
import { STATUS_CONFIG, CASH_METHODS } from "./deliveryStatus";
import { calculateAzimuth, isRouteCompatible } from "../../utils/geoUtils";
import {
  getAllStoreSettings,
  getStoreDeliverySettings,
} from "../admin/services/adminSettings.service";
import DeliveryMapView from "./DeliveryMapView";

const FALLBACK_STORE = [-12.1215, -77.0298];
const BAG_STATUSES = ["asignado", "en_camino", "cerca"];

const INCIDENT_OPTIONS = [
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "direccion_erronea", label: "Dirección errónea" },
  { value: "averia_mecanica", label: "Avería mecánica" },
  { value: "otro", label: "Otro" },
];

const PERIODS = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "all", label: "Histórico total" },
];

const HEADER_STYLES = {
  available: "bg-surface-card text-brand-primary border-b border-border",
  on_route: "bg-amber-600 text-white border-b border-amber-700",
  paused: "bg-rose-600 text-white border-b border-rose-700",
};

const SEMAPHORE = {
  available: {
    label: "Disponible en Base",
    desc: "Listo para tomar pedidos en almacén",
    dot: "emerald",
  },
  on_route: {
    label: "En Ruta",
    desc: "Entregando pedidos activos en calle",
    dot: "amber",
  },
  paused: {
    label: "En Pausa",
    desc: "No disponible para despachos",
    dot: "rose",
  },
};

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// --- Fechas en hora de Lima ---------------------------------------------
const limaFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const limaDay = (d) => limaFmt.format(new Date(d));

function inPeriod(iso, period) {
  if (!iso) return false;
  if (period === "all") return true;
  const day = limaDay(iso);
  const today = limaDay(new Date());
  if (period === "today") return day === today;
  if (period === "month") return day.slice(0, 7) === today.slice(0, 7);
  const t = new Date(`${today}T00:00:00Z`);
  const offset = (t.getUTCDay() + 6) % 7; // semana inicia el lunes
  t.setUTCDate(t.getUTCDate() - offset);
  return day >= t.toISOString().slice(0, 10) && day <= today;
}

// --- Helpers de pedido --------------------------------------------------
const itemCountOf = (o) =>
  o.total_items ??
  (o.order_items ?? o.items ?? []).reduce(
    (a, i) => a + (Number(i.quantity) || 0),
    0,
  );

const cleanDeliveryAddress = (addr) =>
  String(addr || "").replace(/\s*-\s*Miraflores\s*$/i, "").trim();

const getFirstName = (fullName) => {
  const clean = String(fullName || "").trim();
  return clean ? clean.split(/\s+/)[0] : "Cliente";
};

const addressOf = (o) =>
  cleanDeliveryAddress(
    o.delivery_address ??
      (o.shipping_address
        ? `${o.shipping_address.street_address}, ${o.shipping_address.district}`
        : ""),
  ) || "Sin dirección registrada";

const coordOf = (o) =>
  o.delivery_latitude != null && o.delivery_longitude != null
    ? [Number(o.delivery_latitude), Number(o.delivery_longitude)]
    : null;

// --- Presentacionales ---------------------------------------------------
function StatusPulse({ kind }) {
  if (kind === "rose") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-50 [animation-delay:300ms]" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
      </span>
    );
  }
  const ping = kind === "amber" ? "bg-amber-400" : "bg-emerald-400";
  const core = kind === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ping}`}
      />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${core}`} />
    </span>
  );
}

function SpecialtyBadge({ isExpress, translucent = false }) {
  const tone = translucent
    ? "bg-white/20 text-white border border-white/30 backdrop-blur-xs"
    : isExpress
      ? "bg-amber-50 text-amber-900 border border-amber-300"
      : "bg-sky-50 text-sky-900 border border-sky-300";
  const Icon = isExpress ? Zap : Calendar;
  return (
    <span
      className={`font-semibold px-2 py-0.5 text-xs rounded-badge flex items-center gap-1 ${tone}`}
    >
      <Icon className="w-3 h-3" />
      {isExpress ? "Express" : "Programado"}
    </span>
  );
}

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SEMAPHORE[value] ?? SEMAPHORE.available;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 h-9 px-2.5 rounded-button border border-border bg-surface-card text-xs font-semibold text-brand-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <StatusPulse kind={current.dot} />
        <span className="max-w-[110px] truncate">{current.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-brand-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-64 bg-surface-card border border-border rounded-card shadow-lg p-2 z-50 space-y-1"
        >
          {Object.entries(SEMAPHORE).map(([key, s]) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={key === value}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-button text-left outline-none transition-colors hover:bg-surface-subtle ${
                key === value ? "bg-surface-subtle" : ""
              }`}
            >
              <span className="mt-1">
                <StatusPulse kind={s.dot} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-brand-primary">
                  {s.label}
                </span>
                <span className="block text-xs text-brand-secondary">
                  {s.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }) {
  const initials =
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  const palette = ["#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#be123c", "#334155"];
  const hash = [...(name || "?")].reduce((h, c) => h + c.charCodeAt(0), 0);
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
      className="w-16 h-16 rounded-full mx-auto shadow-xs"
    >
      <circle cx="32" cy="32" r="32" fill={palette[hash % palette.length]} />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize="22"
        fontWeight="700"
        fontFamily="inherit"
      >
        {initials}
      </text>
    </svg>
  );
}

function CapacityBar({ current, max = MAX_ITEMS_PER_TRIP }) {
  const full = current >= max;
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div
      className={`rounded-card border px-3 py-2 ${
        full
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-surface-card border-border text-brand-primary"
      }`}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" />
          Capacidad <span className="font-mono">{current}/{max}</span> prendas
        </span>
        <span className="font-mono text-brand-secondary">
          {full ? "Al límite" : `${max - current} libres`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-button bg-surface-subtle overflow-hidden border border-border">
        <div
          className={`h-full transition-all ${full ? "bg-amber-600" : "bg-brand-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PoolOrderCard({ order, blockReason, onClaim, isUpdating }) {
  const items = itemCountOf(order);
  const blocked = Boolean(blockReason);
  return (
    <Card
      className={`!p-3 border border-border bg-surface-card ${
        blocked ? "opacity-75" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold font-mono text-brand-primary">
            {order.order_number}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-brand-secondary">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{addressOf(order)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-secondary mt-1">
            <span className="font-semibold text-brand-primary">
              {getFirstName(order.customer_name)}
            </span>
            {order.customer_email && (
              <>
                <span className="text-brand-muted">·</span>
                <span className="truncate max-w-[210px] text-brand-muted">
                  {order.customer_email}
                </span>
              </>
            )}
          </div>
        </div>
        {!blocked && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-badge border border-emerald-200 shrink-0">
            En ruta
          </span>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-border flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-brand-secondary">
          {soles(order.total_amount)}
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={blocked || isUpdating}
          isLoading={isUpdating}
          onClick={() => onClaim(order.id)}
        >
          {`Tomar pedido (+${items} prendas)`}
        </Button>
      </div>
      {blockReason && (
        <div className="mt-2 px-2.5 py-1.5 rounded-button bg-surface-subtle border border-border text-brand-secondary text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <span className="truncate">{blockReason}</span>
        </div>
      )}
    </Card>
  );
}

function AssignedCard({
  order,
  isOpen,
  onToggle,
  onStartRoute,
  onReturn,
  onChangeStatus,
  onOpenIncident,
  onShowQr,
  isUpdating,
}) {
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.asignado;
  const address = order.shipping_address;
  const isCash = CASH_METHODS.includes(order.payment_method);
  const isQrPaid =
    order.payment_method === "yape_plin" && order.payment_status === "paid";
  const phone =
    address?.receiver_phone ?? order.customer_phone ?? order.customer?.phone;
  const addressText = addressOf(order);
  const totalItems = itemCountOf(order);
  const mapsUrl =
    order.delivery_latitude && order.delivery_longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude},${order.delivery_longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${addressText}, Lima, Perú`,
        )}`;
  const inBase = order.status === "asignado";
  const inRoute = order.status === "en_camino" || order.status === "cerca";

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold font-mono text-brand-primary">
            {order.order_number}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant={status.variant} icon={status.icon}>
              {status.label}
            </Badge>
            <ChevronDown
              className={`w-4 h-4 text-brand-secondary transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border p-3 space-y-3 bg-surface-card">
          <div className="space-y-1.5 text-xs text-brand-secondary">
            <p className="text-brand-primary break-words whitespace-normal">
              {addressText}
            </p>
            {address?.reference && <p>Ref.: {address.reference}</p>}
            <div className="space-y-0.5 text-xs pt-0.5">
              <div className="font-semibold text-brand-primary">
                Cliente: {getFirstName(order.customer_name)}
              </div>
              {order.customer_email && (
                <a
                  href={`mailto:${order.customer_email}`}
                  className="block text-[11px] text-brand-secondary hover:text-accent truncate"
                >
                  {order.customer_email}
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={phone ? `tel:${phone}` : undefined}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-button border border-border bg-surface-subtle hover:bg-slate-200/70 text-xs font-semibold text-brand-primary transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate">{phone || "Sin teléfono"}</span>
              </a>
              <a
                href={mapsUrl}
                rel="noreferrer"
                target="_blank"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-button border border-border bg-surface-subtle hover:bg-slate-200/70 text-xs font-semibold text-brand-primary transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>Google Maps</span>
              </a>
            </div>
          </div>

          <div className="rounded-button border border-border bg-surface-subtle/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setItemsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-surface-subtle transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-brand-secondary" />
                {totalItems} {totalItems === 1 ? "prenda" : "prendas"} en bolsa
              </span>
              <ChevronDown
                className={`w-4 h-4 text-brand-secondary transition-transform ${
                  itemsExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {itemsExpanded && (
              <ul className="px-3 py-2 border-t border-border bg-surface-card space-y-1.5 text-[11px]">
                {(order.items || []).map((item, idx) => {
                  const prodName =
                    item.variant?.product?.name ||
                    item.product_variants?.products?.name ||
                    item.name ||
                    "Prenda";
                  const sizeName =
                    item.variant?.size?.name ||
                    item.product_variants?.sizes?.name ||
                    item.size ||
                    "";
                  const colorName =
                    item.variant?.color ||
                    item.product_variants?.color ||
                    item.color ||
                    "";
                  return (
                    <li
                      key={item.id || idx}
                      className="flex items-start justify-between gap-2 text-brand-secondary"
                    >
                      <span className="font-medium text-brand-primary">
                        {item.quantity}x {prodName}
                      </span>
                      <span className="font-mono text-[10px] text-brand-muted shrink-0">
                        {[sizeName, colorName].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {inRoute && (
            <div>
              {isCash ? (
                <div className="px-3 py-2 rounded-button bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900">
                    Cobrar{" "}
                    <span className="font-mono">
                      {soles(order.total_amount)}
                    </span>{" "}
                    en efectivo
                  </span>
                  <button
                    type="button"
                    onClick={() => onShowQr(order)}
                    className="px-2.5 py-1 rounded-button bg-brand-primary text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors shrink-0"
                  >
                    Mostrar QR
                  </button>
                </div>
              ) : isQrPaid ? (
                <div className="px-3 py-2 rounded-button bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                  Pagado vía Yape / Plin (
                  <span className="font-mono">{soles(order.total_amount)}</span>
                  ) — Sin deuda en efectivo.
                </div>
              ) : (
                <span className="text-xs text-brand-secondary">
                  Pagado electrónicamente
                </span>
              )}
            </div>
          )}

          {inBase && (
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                isLoading={isUpdating}
                onClick={() => onStartRoute(order.id)}
                className="w-full"
              >
                Iniciar Ruta
              </Button>
              <Button
                variant="outline"
                disabled={isUpdating}
                onClick={() => onReturn(order.id)}
                className="w-full"
              >
                Devolver a Bolsa
              </Button>
            </div>
          )}

          {inRoute && (
            <div className="flex gap-2">
              {order.status === "en_camino" ? (
                <Button
                  variant="primary"
                  isLoading={isUpdating}
                  onClick={() => onChangeStatus(order.id, "cerca")}
                  className="flex-1"
                >
                  Estoy Cerca
                </Button>
              ) : (
                <Button
                  isLoading={isUpdating}
                  onClick={() => onChangeStatus(order.id, "entregado")}
                  className="flex-1 !bg-emerald-600 hover:!bg-emerald-700 text-white"
                >
                  Confirmar Entrega
                </Button>
              )}
              <Button
                variant="outline"
                disabled={isUpdating}
                onClick={() => onOpenIncident(order)}
                className="text-rose-800 border-rose-200 hover:bg-rose-50"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Reportar Incidencia
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function QrPaymentModal({ order, paymentMethods, onClose, onConfirmPayment }) {
  const yapeReady = Boolean(
    paymentMethods?.yape_enabled ||
      paymentMethods?.yape_qr_url ||
      paymentMethods?.yape_phone,
  );
  const plinReady = Boolean(
    paymentMethods?.plin_enabled ||
      paymentMethods?.plin_qr_url ||
      paymentMethods?.plin_phone,
  );

  const [wallet, setWallet] = useState(yapeReady ? "yape" : "plin");
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const isYape = wallet === "yape";
  const qrUrl = isYape
    ? paymentMethods?.yape_qr_url
    : paymentMethods?.plin_qr_url;
  const phone = isYape
    ? paymentMethods?.yape_phone
    : paymentMethods?.plin_phone;
  const holder = isYape
    ? paymentMethods?.yape_holder_name
    : paymentMethods?.plin_holder_name;

  const handleConfirm = async () => {
    setSubmitting(true);
    const ok = await onConfirmPayment(order.id);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-brand-primary flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-brand-secondary" />
              Cobro digital QR
            </h3>
            <p className="text-xs text-brand-secondary font-mono mt-0.5">
              {order.order_number} · {soles(order.total_amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar"
            className="text-brand-secondary hover:text-brand-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(yapeReady || plinReady) && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-button bg-surface-subtle border border-border">
            <button
              type="button"
              disabled={!yapeReady}
              onClick={() => setWallet("yape")}
              className={`py-1.5 text-xs font-semibold rounded-button transition-colors ${
                wallet === "yape"
                  ? "bg-surface-card text-brand-primary border border-border"
                  : "text-brand-secondary disabled:opacity-40"
              }`}
            >
              Yape
            </button>
            <button
              type="button"
              disabled={!plinReady}
              onClick={() => setWallet("plin")}
              className={`py-1.5 text-xs font-semibold rounded-button transition-colors ${
                wallet === "plin"
                  ? "bg-surface-card text-brand-primary border border-border"
                  : "text-brand-secondary disabled:opacity-40"
              }`}
            >
              Plin
            </button>
          </div>
        )}

        <div className="flex flex-col items-center text-center space-y-2">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`Código QR ${isYape ? "Yape" : "Plin"}`}
              className="w-52 h-52 object-contain border border-border rounded-card bg-white p-2"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center border border-border rounded-card bg-surface-subtle text-xs text-brand-secondary px-4">
              QR no configurado para {isYape ? "Yape" : "Plin"}
            </div>
          )}

          <div className="space-y-0.5 text-xs">
            {holder && (
              <p className="font-semibold text-brand-primary">{holder}</p>
            )}
            {phone && (
              <p className="font-mono text-brand-secondary">{phone}</p>
            )}
            <p className="font-mono font-bold text-sm text-brand-primary pt-1">
              Monto exacto: {soles(order.total_amount)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="primary"
            isLoading={submitting}
            disabled={submitting}
            onClick={handleConfirm}
            className="w-full"
          >
            Confirmar pago recibido por Yape/Plin
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={onClose}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function IncidentModal({ order, isSubmitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [returnToPool, setReturnToPool] = useState(false);
  const [validationError, setValidationError] = useState(null);

  if (!order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!returnToPool && !reason) {
      setValidationError("Selecciona un motivo.");
      return;
    }
    if (!comment.trim()) {
      setValidationError("El detalle es obligatorio.");
      return;
    }
    setValidationError(null);
    await onSubmit(order.id, {
      reason,
      comment: comment.trim(),
      returnToPool,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-card p-4">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-brand-primary">
              Reportar Incidencia
            </h3>
            <p className="text-xs text-brand-secondary font-mono">
              Orden {order.order_number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-brand-secondary hover:text-brand-primary p-1"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label
              htmlFor="incident-reason"
              className="block text-xs font-semibold text-brand-primary mb-1"
            >
              Motivo {returnToPool ? "" : "*"}
            </label>
            <select
              id="incident-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting || returnToPool}
              className="w-full h-10 px-3 text-sm rounded-button border border-border bg-surface-card text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            >
              <option value="">Selecciona un motivo...</option>
              {INCIDENT_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 text-xs text-brand-primary">
            <input
              type="checkbox"
              checked={returnToPool}
              onChange={(e) => setReturnToPool(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <span>
              Devolver inmediatamente a bolsa (repartidor aún en base / cambio
              de unidad)
            </span>
          </label>

          <div>
            <label
              htmlFor="incident-comment"
              className="block text-xs font-semibold text-brand-primary mb-1"
            >
              Detalle de la situación *
            </label>
            <textarea
              id="incident-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              placeholder="Describe brevemente lo ocurrido..."
              className="w-full p-3 text-sm rounded-button border border-border bg-surface-card text-brand-primary placeholder:text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            />
          </div>

          {validationError && (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-button px-3 py-2">
              {validationError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Confirmar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MetricsView({ orders }) {
  const [period, setPeriod] = useState("today");

  const stats = useMemo(() => {
    const delivered = orders.filter(
      (o) => o.status === "entregado" && inPeriod(o.updated_at, period),
    );
    const incidents = orders.filter(
      (o) =>
        o.status === "incidencia_transporte" && inPeriod(o.updated_at, period),
    ).length;
    const collected = delivered
      .filter((o) => CASH_METHODS.includes(o.payment_method))
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const garments = delivered.reduce((s, o) => s + itemCountOf(o), 0);
    const total = delivered.length + incidents;
    return {
      delivered: delivered.length,
      incidents,
      collected,
      garments,
      effectiveness: incidents === 0 ? 100 : (delivered.length / total) * 100,
    };
  }, [orders, period]);

  return (
    <div className="space-y-3">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        aria-label="Periodo"
        className="w-full h-10 px-3 text-sm rounded-button border border-border bg-surface-card text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <Card className="!p-4 bg-amber-50/70 border border-amber-200 text-amber-900">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Banknote className="w-4 h-4" />
          Efectivo a rendir en base (Contraentrega)
        </div>
        <p className="mt-2 font-mono text-2xl font-bold">
          {soles(stats.collected)}
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-3 border border-border">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="mt-2 text-2xl font-bold font-mono text-brand-primary">
            {stats.delivered}
          </p>
          <p className="text-xs text-brand-secondary">Entregados</p>
        </Card>
        <Card className="!p-3 border border-border">
          <BarChart3 className="w-4 h-4 text-sky-600" />
          <p className="mt-2 text-2xl font-bold font-mono text-brand-primary">
            {Math.round(stats.effectiveness)}%
          </p>
          <p className="text-xs text-brand-secondary">Efectividad</p>
        </Card>
        <Card className="!p-3 border border-border">
          <ShoppingBag className="w-4 h-4 text-brand-secondary" />
          <p className="mt-2 text-2xl font-bold font-mono text-brand-primary">
            {stats.garments}
          </p>
          <p className="text-xs text-brand-secondary">Prendas</p>
        </Card>
        <Card className="!p-3 border border-border">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <p className="mt-2 text-2xl font-bold font-mono text-brand-primary">
            {stats.incidents}
          </p>
          <p className="text-xs text-brand-secondary">Incidencias</p>
        </Card>
      </div>
    </div>
  );
}

function ProfileView({ profile, fallbackName, isExpress, onSignOut }) {
  const clean = (str) => (str || "").replace(/\[.*?\]/g, "").trim();
  const firstName = clean(profile?.first_name) || "Carlos";
  const surnames = [
    clean(profile?.paternal_surname),
    clean(profile?.maternal_surname),
  ]
    .filter(Boolean)
    .join(" ");
  const fullName = [firstName, surnames].filter(Boolean).join(" ");
  const rows = [
    ["DNI", profile?.dni],
    [
      "Rol de Despacho",
      isExpress ? (
        <span className="inline-flex items-center">
          <Zap className="w-3.5 h-3.5 text-amber-500 inline mr-1" />
          Express
        </span>
      ) : (
        <span className="inline-flex items-center">
          <Calendar className="w-3.5 h-3.5 text-sky-600 inline mr-1" />
          Programado
        </span>
      ),
    ],
    ["Teléfono", profile?.phone],
  ];
  return (
    <div className="space-y-3">
      <Card className="!p-4 space-y-2 text-center">
        <Avatar name={fullName} />
        <h2 className="text-base font-bold text-brand-primary mt-2">
          {firstName}
        </h2>
        <p className="text-sm font-medium text-brand-secondary">{surnames}</p>
      </Card>
      <Card className="!p-4">
        <dl className="space-y-2">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-3 text-sm border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-brand-secondary">{k}</dt>
              <dd
                className={`text-brand-primary text-right ${
                  k === "DNI" || k === "Teléfono" ? "font-mono" : ""
                }`}
              >
                {v || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <button
        type="button"
        onClick={onSignOut}
        className="w-full flex items-center justify-center gap-1.5 h-10 rounded-button border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold outline-none transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar Sesión
      </button>
    </div>
  );
}

// --- Contenedor ---------------------------------------------------------
// useMock = true -> usa repartidor.json en vez de Supabase
export default function DeliveryDashboard({ useMock = false, storeLocation }) {
  const {
    repartidorName,
    profile,
    orders,
    poolOrders,
    currentTripItemsCount,
    operationalStatus,
    changeOperationalStatus,
    loading,
    error,
    actionError,
    updatingId,
    reload,
    changeStatus,
    claimOrder,
    returnToPool,
    startRoute,
    reportIncident,
    switchOrderPaymentToQr,
  } = useDeliveryOrders({ useMock });

  const [nav, setNav] = useState("deliveries");
  const [subTab, setSubTab] = useState("pool");
  const [openId, setOpenId] = useState(null);
  const [incidentOrder, setIncidentOrder] = useState(null);
  const [qrOrder, setQrOrder] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [dbStoreCoords, setDbStoreCoords] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState(null);

  const isExpress = profile?.delivery_type === "express";
  const { signOut } = useAuth();

  useEffect(() => {
    if (useMock) return undefined;
    let active = true;
    if (!storeLocation) {
      getStoreDeliverySettings()
        .then(({ storeLocation: loc }) => {
          if (!active || !loc) return;
          const lat = Number(loc.lat);
          const lng = Number(loc.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setDbStoreCoords([lat, lng]);
          }
        })
        .catch(() => {});
    }
    getAllStoreSettings()
      .then(({ paymentMethods: pm }) => {
        if (active && pm) setPaymentMethods(pm);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [useMock, storeLocation]);

  const base = storeLocation ?? dbStoreCoords ?? FALLBACK_STORE;

  const bagOrders = orders.filter((o) => BAG_STATUSES.includes(o.status));
  const activeCount = bagOrders.length;

  // El primer pedido tomado fija el azimut base
  const baseAzimuth = useMemo(() => {
    const first = [...bagOrders].reverse().find((o) => coordOf(o));
    return first ? calculateAzimuth(base, coordOf(first)) : null;
  }, [bagOrders, base]);

  const todayOrders = orders.filter((o) => inPeriod(o.updated_at, "today"));
  const todayDelivered = todayOrders.filter(
    (o) => o.status === "entregado",
  ).length;
  const todayIncidents = todayOrders.filter(
    (o) => o.status === "incidencia_transporte",
  ).length;

  const handleClaim = async (id) => {
    try {
      await claimOrder(id);
    } catch {
      // el error queda expuesto en actionError
    }
  };

  const handleIncident = async (id, payload) => {
    if (await reportIncident(id, payload)) setIncidentOrder(null);
  };

  const handleViewOrder = (order, kind) => {
    setMapOpen(false);
    if (kind === "assigned") {
      setSubTab("mine");
      setOpenId(order.id);
    } else {
      setSubTab("pool");
    }
  };

  const navItems = [
    { key: "metrics", label: "Métricas", icon: BarChart3 },
    { key: "deliveries", label: "Repartos", icon: Truck },
    { key: "profile", label: "Perfil", icon: User },
  ];

  const assigned = orders.filter((o) =>
    [...BAG_STATUSES].includes(o.status),
  );

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header
        className={`h-14 sticky top-0 z-40 ${HEADER_STYLES[operationalStatus] ?? HEADER_STYLES.available}`}
      >
        <div className="w-full max-w-md mx-auto px-4 h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-black tracking-tight">ERXIDI</span>
            <SpecialtyBadge
              isExpress={isExpress}
              translucent={operationalStatus !== "available"}
            />
          </div>
          <StatusDropdown
            value={operationalStatus}
            onChange={changeOperationalStatus}
          />
        </div>
      </header>

      {operationalStatus === "paused" && (
        <div className="sticky top-14 z-30 bg-rose-700 text-white px-4 py-1.5 text-xs font-bold text-center animate-pulse">
          Estás en Pausa: La tienda no asigna pedidos a tu cuenta
        </div>
      )}

      {operationalStatus === "on_route" && activeCount === 0 && !loading && (
        <div className="sticky top-14 z-30 bg-amber-100 text-amber-900 border-b border-amber-300 px-4 py-2 text-xs font-bold text-center">
          Tu bolsa está vacía, retorna a base para cargar nuevos pedidos.
        </div>
      )}

      <main className="w-full max-w-md mx-auto px-4 pb-24 pt-4 space-y-3">
        {actionError && (
          <p className="text-xs text-status-danger-text bg-status-danger-bg border border-status-danger-border rounded-button px-3 py-2">
            {actionError}
          </p>
        )}

        {nav === "metrics" && <MetricsView orders={orders} />}

        {nav === "profile" && (
          <ProfileView
            profile={profile}
            fallbackName={repartidorName}
            isExpress={isExpress}
            onSignOut={signOut}
          />
        )}

        {nav === "deliveries" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Card className="!p-2.5 flex items-center gap-2 border border-border bg-surface-card">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold font-mono text-brand-primary leading-tight">
                    {todayDelivered}
                  </p>
                  <p className="text-[10px] text-brand-secondary truncate">
                    Entregados
                  </p>
                </div>
              </Card>
              <Card className="!p-2.5 flex items-center gap-2 border border-border bg-surface-card">
                <Truck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold font-mono text-brand-primary leading-tight">
                    {activeCount}
                  </p>
                  <p className="text-[10px] text-brand-secondary truncate">
                    En Tránsito
                  </p>
                </div>
              </Card>
              <Card className="!p-2.5 flex items-center gap-2 border border-border bg-surface-card">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold font-mono text-brand-primary leading-tight">
                    {todayIncidents}
                  </p>
                  <p className="text-[10px] text-brand-secondary truncate">
                    Incidencias
                  </p>
                </div>
              </Card>
            </div>

            <CapacityBar current={currentTripItemsCount} />

            <div className="rounded-card border border-border bg-surface-card overflow-hidden">
              <button
                type="button"
                onClick={() => setMapOpen((o) => !o)}
                aria-expanded={mapOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-brand-primary outline-none"
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-secondary" />
                  Mapa de pedidos
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-brand-secondary transition-transform ${
                    mapOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {mapOpen && (
                <div
                  className="relative z-0 border-t border-border p-2"
                  style={{ isolation: "isolate" }}
                >
                  <DeliveryMapView
                    assigned={assigned}
                    poolOrders={poolOrders}
                    store={base}
                    onViewOrder={handleViewOrder}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-button bg-surface-subtle border border-border">
              {[
                { key: "pool", label: "Bolsa", count: poolOrders.length },
                { key: "mine", label: "Mis Asignados", count: assigned.length },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSubTab(t.key)}
                  className={`py-2 text-xs font-semibold rounded-button transition-colors ${
                    subTab === t.key
                      ? "bg-surface-card text-brand-primary border border-border"
                      : "text-brand-secondary"
                  }`}
                >
                  {t.label}{" "}
                  <span className="font-mono">({t.count})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-status-danger-text">
                  No se pudieron cargar los pedidos: {error}
                </p>
                <Button variant="outline" size="sm" onClick={reload}>
                  Reintentar
                </Button>
              </div>
            ) : subTab === "pool" ? (
              poolOrders.length === 0 ? (
                <p className="text-sm text-brand-secondary py-6 text-center">
                  No hay pedidos en la bolsa.
                </p>
              ) : (
                poolOrders.map((order) => {
                  const coord = coordOf(order);
                  const routeCompatible =
                    baseAzimuth == null || !coord
                      ? true
                      : isRouteCompatible(
                          baseAzimuth,
                          calculateAzimuth(base, coord),
                        );
                  const driverType = profile?.delivery_type;
                  const modalityMismatch =
                    Boolean(driverType && order.delivery_type) &&
                    driverType !== order.delivery_type;
                  const exceedsLimit =
                    currentTripItemsCount + itemCountOf(order) >
                    MAX_ITEMS_PER_TRIP;

                  let blockReason = null;
                  if (operationalStatus === "paused") {
                    blockReason = "Bloqueado: Tu estado actual está En Pausa.";
                  } else if (modalityMismatch) {
                    blockReason =
                      "Bloqueado: Modalidad incompatible con tu perfil.";
                  } else if (exceedsLimit) {
                    blockReason =
                      "Bloqueado: Supera la capacidad máxima de 30 prendas.";
                  } else if (!routeCompatible) {
                    blockReason =
                      "Bloqueado: Ruta contraria a tus entregas asignadas.";
                  }

                  return (
                    <PoolOrderCard
                      key={order.id}
                      order={order}
                      blockReason={blockReason}
                      onClaim={handleClaim}
                      isUpdating={updatingId === order.id}
                    />
                  );
                })
              )
            ) : assigned.length === 0 ? (
              <p className="text-sm text-brand-secondary py-6 text-center">
                No tienes pedidos asignados.
              </p>
            ) : (
              assigned.map((order) => (
                <AssignedCard
                  key={order.id}
                  order={order}
                  isOpen={openId === order.id}
                  onToggle={() =>
                    setOpenId(openId === order.id ? null : order.id)
                  }
                  onStartRoute={startRoute}
                  onReturn={returnToPool}
                  onChangeStatus={changeStatus}
                  onOpenIncident={setIncidentOrder}
                  onShowQr={setQrOrder}
                  isUpdating={updatingId === order.id}
                />
              ))
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 py-2.5 flex justify-around">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNav(key)}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold outline-none transition-colors duration-150 ${
              nav === key ? "text-brand-primary" : "text-slate-400"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>

      <IncidentModal
        key={incidentOrder?.id ?? "none"}
        order={incidentOrder}
        isSubmitting={Boolean(incidentOrder && updatingId === incidentOrder.id)}
        onClose={() => setIncidentOrder(null)}
        onSubmit={handleIncident}
      />

      <QrPaymentModal
        key={`qr-${qrOrder?.id ?? "none"}`}
        order={qrOrder}
        paymentMethods={paymentMethods}
        onClose={() => setQrOrder(null)}
        onConfirmPayment={switchOrderPaymentToQr}
      />
    </div>
  );
}
