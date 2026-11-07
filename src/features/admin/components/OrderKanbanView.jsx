import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Zap,
  Store,
  UserX,
  CircleCheck,
  Clock,
  History,
} from "lucide-react";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

const KANBAN_COLUMNS = [
  {
    id: "por_validar",
    title: "Por Validar",
    statuses: ["recibido", "received", "pendiente_pago", "pending"],
    bar: "bg-status-warning-text",
    headerBg: "bg-status-warning-bg",
    dot: "bg-status-warning-text",
    count:
      "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  },
  {
    id: "en_preparacion",
    title: "En Preparación",
    statuses: ["en_preparacion", "preparing"],
    bar: "bg-stage-prep-dot",
    headerBg: "bg-stage-prep-bg",
    dot: "bg-stage-prep-dot",
    count: "bg-stage-prep-bg text-stage-prep-dot border-stage-prep-border",
  },
  {
    id: "en_bolsa",
    title: "En Bolsa",
    statuses: ["por_asignar_repartidor", "asignado"],
    bar: "bg-brand-muted",
    headerBg: "bg-surface-subtle",
    dot: "bg-brand-muted",
    count: "bg-surface-subtle text-brand-secondary border-border",
  },
  {
    id: "en_ruta",
    title: "En Ruta / Por Recoger",
    statuses: [
      "en_camino",
      "dispatched",
      "cerca",
      "nearby",
      "en_destino",
      "arrived",
      "listo_recojo",
    ],
    bar: "bg-stage-route-dot",
    headerBg: "bg-stage-route-bg",
    dot: "bg-stage-route-dot",
    count: "bg-stage-route-bg text-stage-route-dot border-stage-route-border",
  },
  {
    id: "finalizados",
    title: "Finalizados",
    statuses: [
      "entregado",
      "delivered",
      "cancelado",
      "cancelled",
      "incidencia_transporte",
    ],
    bar: "bg-status-success-text",
    headerBg: "bg-status-success-bg",
    dot: "bg-status-success-text",
    count:
      "bg-status-success-bg text-status-success-text border-status-success-border",
  },
];

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const MAX_ITEMS_PREVIEW = 2;

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function getAgeMs(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Date.now() - ms);
}

function formatRelativeAge(ageMs) {
  if (ageMs === null) return "—";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñü])/g, (_, space, char) => space + char.toUpperCase());
}

function isRecentlyCreatedReceived(order) {
  const validStatuses = ["recibido", "received", "pendiente_pago", "pending"];
  if (!validStatuses.includes(order.status)) return false;
  const age = getAgeMs(order.created_at);
  return age !== null && age < 5 * 60 * 1000;
}

function getPaymentMethodLabel(method) {
  if (method === "yape_plin" || method === "transferencia") return "Pago manual";
  if (method === "contraentrega" || method === "efectivo") return "Contraentrega";
  if (method === "culqi_gateway" || method === "tarjeta") return "Culqi (Online)";
  return method || "—";
}

function PaymentBadges({ order }) {
  const isCashOnDelivery =
    order.payment_method === "contraentrega" ||
    order.payment_method === "efectivo";
  const isPaid = order.payment_status === "paid";
  const isPending = order.payment_status === "pending_verification";

  return (
    <>
      <Badge
        variant="neutral"
        className="rounded-sm text-[11px] px-2 py-0.5 font-medium"
      >
        {getPaymentMethodLabel(order.payment_method)}
      </Badge>
      {!isCashOnDelivery && isPaid && (
        <Badge
          variant="success"
          icon={CircleCheck}
          className="rounded-sm text-[11px] px-2 py-0.5 font-medium"
        >
          Validado
        </Badge>
      )}
      {!isCashOnDelivery && isPending && (
        <Badge
          variant="warning"
          icon={Clock}
          className="rounded-sm text-[11px] px-2 py-0.5 font-medium"
        >
          Pendiente
        </Badge>
      )}
    </>
  );
}

const DELIVERY_STYLES = {
  programado: {
    label: "Programado",
    icon: CalendarClock,
    classes:
      "bg-delivery-scheduled-bg text-delivery-scheduled-text border-delivery-scheduled-border",
  },
  scheduled: {
    label: "Programado",
    icon: CalendarClock,
    classes:
      "bg-delivery-scheduled-bg text-delivery-scheduled-text border-delivery-scheduled-border",
  },
  express: {
    label: "Express",
    icon: Zap,
    classes:
      "bg-delivery-express-bg text-delivery-express-text border-delivery-express-border",
  },
  recojo: {
    label: "Recojo",
    icon: Store,
    classes: "bg-surface-subtle text-brand-secondary border-border",
  },
  pickup: {
    label: "Recojo",
    icon: Store,
    classes: "bg-surface-subtle text-brand-secondary border-border",
  },
};

const DELIVERY_FALLBACK_CLASSES =
  "bg-surface-subtle text-brand-secondary border-border";

function CardRevealFooter() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="overflow-hidden">
        <div className="h-7 flex items-center justify-center gap-1 bg-brand-primary text-white text-xs font-semibold">
          <span>Ver pedido</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

function DeliveryBadge({ type }) {
  const raw = String(type || "");
  const style = DELIVERY_STYLES[raw.toLowerCase()];
  const Icon = style?.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[11px] font-medium ${
        style ? style.classes : DELIVERY_FALLBACK_CLASSES
      }`}
    >
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
      {style ? style.label : raw || "—"}
    </span>
  );
}

function OrderItemSummary({ item }) {
  const product = item.product_variants?.products;
  const imageUrl = product?.main_image_url;

  return (
    <div className="flex items-start gap-2.5 mb-2 last:mb-0">
      {imageUrl && (
        <div className="w-10 shrink-0 aspect-[4/5] bg-slate-50 border border-border rounded-button overflow-hidden">
          <img
            src={imageUrl}
            alt={product?.name || "Prenda"}
            loading="lazy"
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand-primary leading-snug break-words">
          {product?.name || "Prenda"}
          <span className="font-mono font-bold text-brand-secondary ml-1.5">
            {item.quantity}x
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded-sm bg-surface-subtle border border-border text-brand-primary capitalize">
            {item.product_variants?.color || "—"}
          </span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded-sm bg-surface-subtle border border-border text-brand-primary">
            {item.product_variants?.sizes?.name || "U"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OrderKanbanView({
  orders = [],
  recentOrderIds = [],
  finalizedTotal = 0,
  onVerifyPayment,
  onSendToPreparation,
  onSendToPool,
  onNavigateDetail,
  onViewHistory,
  updatingOrderId,
  deliveryStaff = [],
}) {
  function resolveDriverName(order) {
    if (order.delivery_name) return order.delivery_name;
    if (!order.assigned_delivery_id) return null;
    const staff = deliveryStaff.find((s) => s.id === order.assigned_delivery_id);
    if (staff) {
      return `${staff.first_name} ${staff.paternal_surname || ""}`.trim();
    }
    if (order.delivery_profile) {
      return `${order.delivery_profile.first_name} ${order.delivery_profile.paternal_surname || ""}`.trim();
    }
    return "Asignado";
  }

  function handleCardKeyDown(e, order) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigateDetail(order.order_number);
    }
  }

  function renderAction(col, order, isCashOnDelivery, isUpdating) {
    if (col.id === "por_validar") {
      if (isCashOnDelivery) {
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              onSendToPreparation(order.id);
            }}
            className="h-8 px-3 text-xs"
          >
            <span>A Preparación</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        );
      }
      return (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isUpdating}
          onClick={(e) => {
            e.stopPropagation();
            onVerifyPayment(order);
          }}
          className="h-8 px-3 text-xs"
        >
          <span>Validar pago</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    if (col.id === "en_preparacion") {
      const isPickup =
        order.delivery_type === "pickup" || order.delivery_type === "recojo";
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isUpdating}
          onClick={(e) => {
            e.stopPropagation();
            onSendToPool(order);
          }}
          className="h-8 px-3 text-xs"
        >
          <span>{isPickup ? "A Recojo" : "A Bolsa"}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    return null;
  }

  return (
    <div className="overflow-x-auto h-[calc(100vh-175px)]">
      <div className="grid grid-cols-5 gap-4 min-w-[1250px] h-full pb-2">
        {KANBAN_COLUMNS.map((col) => {
          const isFinalizados = col.id === "finalizados";
          const showDeliverySection =
            col.id === "en_bolsa" ||
            col.id === "en_ruta" ||
            col.id === "finalizados";

          const columnOrders = orders.filter((o) =>
            col.statuses.includes(o.status),
          );

          const sortedOrders = [...columnOrders].sort((a, b) => {
            if (isFinalizados) {
              return (
                new Date(b.updated_at || b.created_at) -
                new Date(a.updated_at || a.created_at)
              );
            }
            return new Date(a.created_at) - new Date(b.created_at);
          });

          const totalCount = isFinalizados
            ? Math.max(finalizedTotal, columnOrders.length)
            : columnOrders.length;

          return (
            <section
              key={col.id}
              className="flex flex-col h-full min-h-0 bg-surface-subtle border border-border rounded-card overflow-hidden"
            >
              {/* Franja de etapa + cabecera tintada */}
              <div className={`h-[3px] shrink-0 ${col.bar}`} aria-hidden="true" />
              <header
                className={`h-11 px-3.5 flex items-center justify-between shrink-0 border-b border-border ${col.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${col.dot}`}
                    aria-hidden="true"
                  />
                  <h2 className="text-xs font-bold tracking-tight text-brand-primary">
                    {col.title}
                  </h2>
                </div>
                <span
                  className={`border font-mono px-2 py-0.5 rounded-badge text-[11px] ${col.count}`}
                >
                  {totalCount}
                </span>
              </header>

              {/* Cuerpo con scroll independiente */}
              <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
                {sortedOrders.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-brand-muted">
                    Sin pedidos
                  </p>
                ) : (
                  sortedOrders.map((order) => {
                    const isNewPulse =
                      recentOrderIds.includes(order.id) ||
                      isRecentlyCreatedReceived(order);
                    const isIncident = order.status === "incidencia_transporte";
                    const isUpdating = updatingOrderId === order.id;

                    const rawName =
                      order.customer_name ||
                      [
                        order.profiles?.first_name,
                        order.profiles?.paternal_surname,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                      "Cliente";
                    const customerName = toTitleCase(rawName);
                    const isCashOnDelivery =
                      order.payment_method === "contraentrega" ||
                      order.payment_method === "efectivo";
                    const driverName = resolveDriverName(order);

                    const ageMs = getAgeMs(order.created_at);
                    const isStale =
                      !isFinalizados &&
                      ageMs !== null &&
                      ageMs > STALE_THRESHOLD_MS;

                    const items = order.order_items || [];
                    const visibleItems = items.slice(0, MAX_ITEMS_PREVIEW);
                    const hiddenItems = items.length - visibleItems.length;
                    const action = renderAction(
                      col,
                      order,
                      isCashOnDelivery,
                      isUpdating,
                    );

                    return (
                      <article
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver detalle del pedido ${order.order_number}`}
                        onClick={() => onNavigateDetail(order.order_number)}
                        onKeyDown={(e) => handleCardKeyDown(e, order)}
                        className={`group overflow-hidden bg-surface-card border border-border rounded-card cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-app focus:outline-none focus-visible:border-border-strong focus-visible:bg-surface-app focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
                          isNewPulse
                            ? "ring-2 ring-status-success-text animate-pulse"
                            : ""
                        } ${isIncident ? "border-l-4 border-l-rose-500" : ""}`}
                      >
                        {/* Nivel 1 - Identificación y antigüedad */}
                        <div className="px-3 pt-3 flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-brand-primary text-sm tracking-tight truncate">
                            #{order.order_number}
                          </span>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              isStale
                                ? "px-1.5 py-0.5 rounded-sm border font-bold bg-status-warning-bg text-status-warning-text border-status-warning-border"
                                : "text-brand-secondary"
                            }`}
                          >
                            {formatRelativeAge(ageMs)}
                          </span>
                        </div>

                        {/* Nivel 2 - Cliente y producto */}
                        <div className="px-3 pt-2 pb-3">
                          <p className="font-bold text-sm text-brand-primary leading-tight break-words">
                            {customerName}
                          </p>
                          <div className="border-t border-border my-2" />
                          {visibleItems.map((item) => (
                            <OrderItemSummary key={item.id} item={item} />
                          ))}
                          {hiddenItems > 0 && (
                            <p className="text-xs text-brand-secondary">
                              +{hiddenItems} prenda{hiddenItems > 1 ? "s" : ""} más
                            </p>
                          )}
                        </div>

                        {/* Nivel 3 - Pago, despacho, repartidor y monto */}
                        <div className="px-3 py-2.5 border-t border-border space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <PaymentBadges order={order} />
                            <DeliveryBadge type={order.delivery_type} />
                          </div>

                          {showDeliverySection && (
                            order.delivery_type === "pickup" ||
                            order.delivery_type === "recojo" ? (
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-brand-secondary">
                                  Entrega
                                </span>
                                <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm text-[11px] font-medium">
                                  Esperando al cliente
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-brand-secondary">
                                  Repartidor
                                </span>
                                {order.assigned_delivery_id ? (
                                  <span className="text-brand-primary">
                                    {driverName || "Asignado"}
                                  </span>
                                ) : (
                                  <Badge
                                    variant="warning"
                                    icon={UserX}
                                    className="rounded-sm text-[11px] px-2 py-0.5 font-medium cursor-default"
                                  >
                                    Sin asignar
                                  </Badge>
                                )}
                              </div>
                            )
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="font-mono font-bold text-base text-brand-primary">
                              {money(order.total_amount)}
                            </span>
                            {action}
                          </div>
                        </div>
                        <CardRevealFooter />
                      </article>
                    );
                  })
                )}

                {isFinalizados && totalCount > sortedOrders.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onViewHistory}
                    className="w-full text-xs"
                  >
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    <span>Ver historial completo</span>
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
