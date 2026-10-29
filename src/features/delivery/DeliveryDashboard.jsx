import { useState } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Phone,
  Clock,
  Banknote,
  CreditCard,
  ChevronDown,
  Navigation,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
  X,
} from "lucide-react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import { useDeliveryOrders, MAX_ITEMS_PER_TRIP } from "./useDeliveryOrders";
import {
  STATUS_CONFIG,
  NEXT_ACTIONS,
  CASH_METHODS,
  INCIDENT_REASONS,
} from "./deliveryStatus";

// Cada filtro agrupa uno o más estados. "activos" es el que se ve al abrir:
// los entregados quedan ocultos hasta que el repartidor los pida.
const FILTERS = [
  { key: "activos", label: "Activos", statuses: ["en_preparacion", "en_camino", "cerca"] },
  { key: "en_camino", label: "En camino", statuses: ["en_camino", "cerca"] },
  { key: "por_entregar", label: "Por entregar", statuses: ["en_preparacion"] },
  { key: "entregado", label: "Entregados", statuses: ["entregado"] },
];

const soles = (n) => `S/ ${Number(n).toFixed(2)}`;

const fullName = (p) =>
  p
    ? [p.first_name, p.paternal_surname, p.maternal_surname]
        .filter(Boolean)
        .join(" ")
    : "Cliente";

const formatDeliveryType = (order) => {
  const raw = (order.delivery_type ?? "").toLowerCase();
  if (raw.includes("express")) return "Express";
  if (raw.includes("programado") || raw.includes("scheduled") || order.scheduled_time_slot) {
    return "Programado";
  }
  return "Estándar";
};

function StatCard({ label, value, icon: Icon }) {
  return (
    <Card className="flex items-center gap-3 !p-4">
      <div className="w-10 h-10 rounded-button bg-surface-subtle flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-secondary" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono leading-none text-brand-primary">
          {value}
        </p>
        <p className="text-xs text-brand-secondary mt-1">{label}</p>
      </div>
    </Card>
  );
}

function CapacityBar({ current, max = MAX_ITEMS_PER_TRIP }) {
  const isFull = current >= max;
  const pct = Math.min(100, Math.round((current / max) * 100));

  return (
    <div
      className={`mb-6 rounded-card border px-4 py-3 transition-colors ${
        isFull
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-surface-card border-border text-brand-primary"
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="flex items-center gap-2">
          <ShoppingBag
            className={`w-4 h-4 ${isFull ? "text-amber-700" : "text-brand-secondary"}`}
          />
          <span>
            Capacidad:{" "}
            <span className="font-mono">
              {current} / {max}
            </span>{" "}
            prendas
          </span>
        </span>
        <span
          className={`font-mono ${isFull ? "text-amber-800" : "text-brand-secondary"}`}
        >
          {isFull ? "Mochila al límite" : `${max - current} disponibles`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-button bg-surface-subtle overflow-hidden border border-border">
        <div
          className={`h-full transition-all ${
            isFull ? "bg-amber-600" : "bg-brand-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PoolOrderCard({ order, currentTripItemsCount, onClaim, isUpdating }) {
  const status = STATUS_CONFIG.por_asignar_repartidor;
  const address = order.shipping_address;
  const addressText =
    order.delivery_address ??
    (address ? `${address.street_address}, ${address.district}` : "Sin dirección registrada");
  const shippingLabel = formatDeliveryType(order);
  const itemCount =
    order.total_items ??
    (order.order_items ?? order.items ?? []).reduce(
      (acc, i) => acc + (Number(i.quantity) || 0),
      0,
    );
  const exceedsLimit = currentTripItemsCount + itemCount > MAX_ITEMS_PER_TRIP;

  return (
    <Card className="!p-4 border border-border bg-surface-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold font-mono text-brand-primary">
              {order.order_number}
            </p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-button border border-border bg-surface-subtle text-brand-secondary">
              {shippingLabel}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-secondary">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{addressText}</span>
          </p>
          {order.scheduled_time_slot && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-secondary">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Horario: {order.scheduled_time_slot}</span>
            </p>
          )}
        </div>

        <Badge
          variant={status.variant}
          icon={status.icon}
          className={status.className}
        >
          {status.label}
        </Badge>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono font-semibold text-brand-primary bg-surface-subtle border border-border rounded-button px-2.5 py-1">
            {itemCount} {itemCount === 1 ? "prenda" : "prendas"}
          </span>
          {order.total_amount != null && (
            <span className="font-mono text-brand-secondary">
              {soles(order.total_amount)}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant="primary"
            disabled={exceedsLimit || isUpdating}
            isLoading={isUpdating}
            title={exceedsLimit ? "Excede límite de 30 prendas" : "Tomar Pedido"}
            onClick={() => onClaim(order.id)}
          >
            Tomar Pedido
          </Button>
          {exceedsLimit && (
            <span className="text-[11px] font-medium text-amber-800">
              Excede límite de 30 prendas
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function IncidentModal({ order, isSubmitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [validationError, setValidationError] = useState(null);

  if (!order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setValidationError("Selecciona un motivo tipificado.");
      return;
    }
    if (!comment.trim()) {
      setValidationError("Detalla la situación en los comentarios.");
      return;
    }
    setValidationError(null);
    await onSubmit(order.id, { reason, comment: comment.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-card p-5">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-button bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-primary">
                Reportar Incidencia
              </h3>
              <p className="text-xs text-brand-secondary font-mono">
                Orden {order.order_number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-brand-secondary hover:text-brand-primary p-1 rounded-button"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="incident-reason"
              className="block text-xs font-semibold text-brand-primary mb-1.5"
            >
              Motivo de la incidencia *
            </label>
            <select
              id="incident-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 px-3 text-sm rounded-button border border-border bg-surface-card text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">Selecciona un motivo...</option>
              {INCIDENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="incident-comment"
              className="block text-xs font-semibold text-brand-primary mb-1.5"
            >
              Detalle de la situación *
            </label>
            <textarea
              id="incident-comment"
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              placeholder="Describe brevemente lo ocurrido en el punto de entrega..."
              className="w-full p-3 text-sm rounded-button border border-border bg-surface-card text-brand-primary placeholder:text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            />
          </div>

          {validationError && (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-button px-3 py-2">
              {validationError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
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
              {isSubmitting ? "Submitting..." : "Confirmar Incidencia"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isOpen,
  onToggle,
  onChangeStatus,
  onOpenIncident,
  isUpdating,
}) {
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.en_preparacion;
  const address = order.shipping_address;
  const isCash = CASH_METHODS.includes(order.payment_method);
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const eta = order.ui_extra?.eta_minutes;

  // Los pedidos de invitado no tienen perfil ni libreta de direcciones:
  // por eso se prefieren los datos guardados en el propio pedido.
  const customerName = order.customer_name ?? fullName(order.customer);
  const phone =
    address?.receiver_phone ?? order.customer_phone ?? order.customer?.phone;
  const addressText =
    order.delivery_address ??
    (address ? `${address.street_address}, ${address.district}` : null);
  const mapsUrl =
    order.delivery_latitude && order.delivery_longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude},${order.delivery_longitude}`
      : addressText
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${addressText}, Lima, Perú`,
          )}`
        : null;

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold font-mono text-brand-primary">
              {order.order_number}
            </p>
            <p className="text-sm text-brand-secondary truncate">
              {customerName}
            </p>
          </div>
          <Badge
            variant={status.variant}
            icon={status.icon}
            className={status.className}
          >
            {status.label}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-brand-secondary">
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{addressText ?? "Sin dirección"}</span>
          </span>
          <span className="flex items-center gap-3 flex-shrink-0">
            <span className="font-mono">{order.total_items} artículos</span>
            <span className="font-semibold font-mono text-brand-primary">
              {soles(order.total_amount)}
            </span>
            {eta != null && order.status !== "entregado" && (
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {eta} min
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-4 bg-surface-card">
          {/* Productos */}
          <div className="space-y-2">
            {(order.items ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.variant?.color_hex && (
                    <span
                      className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: item.variant.color_hex }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-brand-primary truncate">
                      {item.variant?.product?.name ?? "Producto"}
                    </p>
                    <p className="text-xs text-brand-secondary">
                      Talla {item.variant?.size?.name ?? "-"}
                      {item.variant?.color ? ` · ${item.variant.color}` : ""}
                      {item.variant?.sku ? (
                        <span className="font-mono">{` · SKU ${item.variant.sku}`}</span>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 font-mono">
                  <p className="text-xs text-brand-secondary">
                    {item.quantity} × {soles(item.unit_price)}
                  </p>
                  <p className="font-semibold text-brand-primary">
                    {soles(item.subtotal)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Dirección y contacto */}
          <div className="border-t border-border pt-3 space-y-1.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
              Dirección de entrega
            </p>
            <p className="text-brand-primary">
              {addressText ?? "Sin dirección registrada"}
            </p>
            {order.scheduled_time_slot && (
              <p className="text-xs text-brand-secondary">
                Horario: {order.scheduled_time_slot}
              </p>
            )}
            {address?.reference && (
              <p className="text-xs text-brand-secondary">
                Ref.: {address.reference}
              </p>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold"
              >
                <Phone className="w-3.5 h-3.5" />
                {address?.receiver_name ?? customerName} ·{" "}
                <span className="font-mono">{phone}</span>
              </a>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent font-semibold"
              >
                <Navigation className="w-3.5 h-3.5" />
                Abrir ruta en Google Maps
              </a>
            )}
          </div>

          {/* Cobro */}
          <div className="border-t border-border pt-3 text-sm">
            {isCash ? (
              <p className="flex items-center gap-2 font-semibold text-status-warning-text bg-status-warning-bg border border-status-warning-border rounded-button px-3 py-2">
                <Banknote className="w-4 h-4" />
                Cobrar <span className="font-mono">{soles(order.total_amount)}</span> al entregar
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-brand-secondary">
                <CreditCard className="w-4 h-4" />
                Pago ya registrado, no se cobra
              </p>
            )}
            <p className="text-xs text-brand-secondary mt-2">
              Productos <span className="font-mono">{soles(order.subtotal)}</span> + envío{" "}
              <span className="font-mono">{soles(order.delivery_cost)}</span> ={" "}
              <strong className="text-brand-primary font-mono">
                {soles(order.total_amount)}
              </strong>
            </p>
          </div>

          {/* Acciones según el estado */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {actions.map((a) => {
                const isIncidentAction =
                  a.action === "REPORT_INCIDENT" ||
                  a.to === "incidencia_transporte";

                if (isIncidentAction) {
                  return (
                    <Button
                      key={a.to}
                      variant="outline"
                      disabled={isUpdating}
                      onClick={() => onOpenIncident(order)}
                      className="text-rose-800 border-rose-200 hover:bg-rose-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-1.5" />
                      {a.label}
                    </Button>
                  );
                }

                return (
                  <Button
                    key={a.to}
                    variant={a.variant ?? "primary"}
                    isLoading={isUpdating}
                    onClick={() => onChangeStatus(order.id, a.to)}
                    className="flex-1"
                  >
                    {a.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// useMock = true -> usa repartidor.json en vez de Supabase
export default function DeliveryDashboard({ useMock = false }) {
  const {
    repartidorName,
    orders,
    poolOrders,
    currentTripItemsCount,
    loading,
    error,
    actionError,
    updatingId,
    reload,
    changeStatus,
    claimOrder,
    reportIncident,
  } = useDeliveryOrders({ useMock });

  const [activeTab, setActiveTab] = useState("mis_entregas");
  const [filter, setFilter] = useState("activos");
  const [openId, setOpenId] = useState(null);
  const [incidentOrder, setIncidentOrder] = useState(null);

  // Contadores calculados desde los pedidos (no se guardan en la BD)
  const countOf = (...statuses) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const activeAssignedCount = countOf("en_preparacion", "en_camino", "cerca");
  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visibleOrders = orders.filter((o) =>
    activeFilter.statuses.includes(o.status),
  );

  const handleClaimOrder = async (orderId) => {
    try {
      await claimOrder(orderId);
    } catch {
      // El error descriptivo ya queda expuesto en actionError
    }
  };

  const handleConfirmIncident = async (orderId, payload) => {
    const ok = await reportIncident(orderId, payload);
    if (ok) {
      setIncidentOrder(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">
            Hola{repartidorName ? `, ${repartidorName}` : ""}
          </h1>
          <p className="text-sm text-brand-secondary">
            Aquí tienes tus pedidos de hoy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Actualizar
        </Button>
      </header>

      {/* Indicador de carga de mochila */}
      <CapacityBar
        current={currentTripItemsCount}
        max={MAX_ITEMS_PER_TRIP}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total de pedidos"
          value={orders.length}
          icon={ClipboardList}
        />
        <StatCard
          label="En camino"
          value={countOf("en_camino", "cerca")}
          icon={Truck}
        />
        <StatCard
          label="Por entregar"
          value={countOf("en_preparacion")}
          icon={Package}
        />
        <StatCard
          label="Entregados"
          value={countOf("entregado")}
          icon={CheckCircle2}
        />
      </section>

      {/* Navegación por pestañas */}
      <div className="flex border-b border-border mb-4 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("mis_entregas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "mis_entregas"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <span>Mis Entregas</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-badge border border-border bg-surface-subtle text-brand-primary">
            {activeAssignedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bolsa")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "bolsa"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <span>Bolsa de Pedidos</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-badge border border-amber-200 bg-amber-50 text-amber-900">
            {poolOrders.length}
          </span>
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "mis_entregas"
              ? "Pedidos asignados"
              : "Bolsa de Pedidos Disponibles"}
          </CardTitle>
          <CardDescription>
            {activeTab === "mis_entregas"
              ? "Toca un pedido para ver el detalle o reportar una incidencia en ruta."
              : "Toma pedidos listos para despacho sin exceder las 30 prendas por viaje."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === "mis_entregas" && (
            <div className="flex flex-wrap gap-2 mb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-badge border transition-colors ${
                    filter === f.key
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "bg-surface-card text-brand-secondary border-border hover:bg-surface-subtle"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {actionError && (
            <p className="text-sm text-status-danger-text bg-status-danger-bg border border-status-danger-border rounded-button px-3 py-2">
              {actionError}
            </p>
          )}

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
          ) : activeTab === "mis_entregas" ? (
            visibleOrders.length === 0 ? (
              <p className="text-sm text-brand-secondary py-6 text-center">
                No hay pedidos en este estado.
              </p>
            ) : (
              visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isOpen={openId === order.id}
                  onToggle={() =>
                    setOpenId(openId === order.id ? null : order.id)
                  }
                  onChangeStatus={changeStatus}
                  onOpenIncident={setIncidentOrder}
                  isUpdating={updatingId === order.id}
                />
              ))
            )
          ) : poolOrders.length === 0 ? (
            <p className="text-sm text-brand-secondary py-6 text-center">
              No hay pedidos disponibles en la bolsa en este momento.
            </p>
          ) : (
            poolOrders.map((order) => (
              <PoolOrderCard
                key={order.id}
                order={order}
                currentTripItemsCount={currentTripItemsCount}
                onClaim={handleClaimOrder}
                isUpdating={updatingId === order.id}
              />
            ))
          )}
        </CardContent>
      </Card>

      <IncidentModal
        order={incidentOrder}
        isSubmitting={ Boolean(incidentOrder && updatingId === incidentOrder.id) }
        onClose={() => setIncidentOrder(null)}
        onSubmit={handleConfirmIncident}
      />
    </div>
  );
}
