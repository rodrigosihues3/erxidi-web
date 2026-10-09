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
import { useDeliveryOrders } from "./useDeliveryOrders";
import { STATUS_CONFIG, NEXT_ACTIONS, CASH_METHODS } from "./deliveryStatus";

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

function StatCard({ label, value, icon: Icon }) {
  return (
    <Card className="flex items-center gap-3 !p-4">
      <div className="w-10 h-10 rounded-button bg-surface-subtle flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-secondary" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none text-brand-primary">
          {value}
        </p>
        <p className="text-xs text-brand-secondary mt-1">{label}</p>
      </div>
    </Card>
  );
}

function OrderCard({ order, isOpen, onToggle, onChangeStatus, isUpdating }) {
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
            <p className="text-sm font-bold text-brand-primary">
              {order.order_number}
            </p>
            <p className="text-sm text-brand-secondary truncate">
              {customerName}
            </p>
          </div>
          <Badge variant={status.variant} icon={status.icon}>
            {status.label}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-brand-secondary">
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{addressText ?? "Sin dirección"}</span>
          </span>
          <span className="flex items-center gap-3 flex-shrink-0">
            <span>{order.total_items} artículos</span>
            <span className="font-semibold text-brand-primary">
              {soles(order.total_amount)}
            </span>
            {eta != null && order.status !== "entregado" && (
              <span className="flex items-center gap-1">
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
                      {item.variant?.sku ? ` · SKU ${item.variant.sku}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
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
                {address?.receiver_name ?? customerName} · {phone}
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
                Cobrar {soles(order.total_amount)} al entregar
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-brand-secondary">
                <CreditCard className="w-4 h-4" />
                Pago ya registrado, no se cobra
              </p>
            )}
            <p className="text-xs text-brand-secondary mt-2">
              Productos {soles(order.subtotal)} + envío{" "}
              {soles(order.delivery_cost)} ={" "}
              <strong className="text-brand-primary">
                {soles(order.total_amount)}
              </strong>
            </p>
          </div>

          {/* Acciones según el estado */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {actions.map((a) => (
                <Button
                  key={a.to}
                  variant={a.variant ?? "primary"}
                  isLoading={isUpdating}
                  onClick={() => onChangeStatus(order.id, a.to)}
                  className="flex-1"
                >
                  {a.label}
                </Button>
              ))}
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
    loading,
    error,
    actionError,
    updatingId,
    reload,
    changeStatus,
  } = useDeliveryOrders({ useMock });

  const [filter, setFilter] = useState("activos");
  const [openId, setOpenId] = useState(null);

  // Contadores calculados desde los pedidos (no se guardan en la BD)
  const countOf = (...statuses) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visibleOrders = orders.filter((o) =>
    activeFilter.statuses.includes(o.status),
  );

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

      <Card>
        <CardHeader>
          <CardTitle>Pedidos asignados</CardTitle>
          <CardDescription>Toca un pedido para ver el detalle.</CardDescription>
        </CardHeader>
        <CardContent>
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
          ) : visibleOrders.length === 0 ? (
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
                isUpdating={updatingId === order.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
