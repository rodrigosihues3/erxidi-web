import { useState } from "react";
import {
  ClipboardList,
  ArrowRight,
  Calendar,
  Zap,
  Store,
  Copy,
  Check,
  AlertOctagon,
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

const KANBAN_COLUMNS = [
  {
    id: "por_validar",
    title: "Por Validar",
    statuses: ["recibido", "received", "pendiente_pago", "pending"],
    headerClass: "bg-surface-subtle border-border text-brand-primary",
    badgeClass: "bg-slate-200 text-slate-800 border-slate-300",
  },
  {
    id: "en_almacen",
    title: "En Almacén",
    statuses: ["en_preparacion", "preparing"],
    headerClass: "bg-blue-50/70 border-blue-200 text-blue-900",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "en_bolsa",
    title: "En Bolsa",
    statuses: ["por_asignar_repartidor", "asignado"],
    headerClass: "bg-amber-50/70 border-amber-200 text-amber-900",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    id: "en_ruta",
    title: "En Ruta",
    statuses: [
      "en_camino",
      "dispatched",
      "cerca",
      "nearby",
      "en_destino",
      "arrived",
    ],
    headerClass: "bg-indigo-50/70 border-indigo-200 text-indigo-900",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
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
    headerClass: "bg-emerald-50/60 border-emerald-200 text-emerald-900",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
];

const PAYMENT_LABELS = {
  yape_plin: "Yape / Plin",
  culqi_gateway: "Culqi",
  contraentrega: "Contraentrega",
  efectivo: "Contraentrega",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

const ROUTE_STATUS_LABELS = {
  en_camino: "En ruta",
  dispatched: "En ruta",
  cerca: "Cerca",
  nearby: "Cerca",
  en_destino: "En puerta / En destino",
  arrived: "En puerta / En destino",
};

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function isRecentlyCreatedReceived(order) {
  const validStatuses = ["recibido", "received", "pendiente_pago", "pending"];
  if (!validStatuses.includes(order.status) || !order.created_at) return false;
  const createdMs = new Date(order.created_at).getTime();
  if (Number.isNaN(createdMs)) return false;
  return Date.now() - createdMs < 5 * 60 * 1000;
}

export default function OrderKanbanView({
  orders = [],
  recentOrderIds = [],
  onVerifyPayment,
  onSendToPool,
  onRequeueIncident,
  onNavigateDetail,
  updatingOrderId,
  deliveryStaff = [],
}) {
  const [copiedTxId, setCopiedTxId] = useState(null);

  function handleCopyTx(txId, e) {
    e?.stopPropagation?.();
    if (!txId) return;
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => setCopiedTxId(null), 2000);
  }

  function renderDeliveryBadge(type) {
    const t = (type || "").toLowerCase();
    if (t === "express") {
      return (
        <Badge
          variant="warning"
          className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border-amber-200"
        >
          <Zap className="w-3 h-3 mr-1" /> Express
        </Badge>
      );
    }
    if (t === "pickup" || t === "recojo") {
      return (
        <Badge
          variant="neutral"
          className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-800 border-slate-200"
        >
          <Store className="w-3 h-3 mr-1" /> Recojo
        </Badge>
      );
    }
    return (
      <Badge
        variant="neutral"
        className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-800 border-sky-200"
      >
        <Calendar className="w-3 h-3 mr-1" /> Programado
      </Badge>
    );
  }

  function resolveDriverName(order) {
    if (!order.assigned_delivery_id) return null;
    const staff = deliveryStaff.find((s) => s.id === order.assigned_delivery_id);
    if (staff) {
      return `${staff.first_name} ${staff.paternal_surname || ""}`.trim();
    }
    if (order.delivery_profile) {
      return `${order.delivery_profile.first_name} ${order.delivery_profile.paternal_surname || ""}`.trim();
    }
    return "Motorizado asignado";
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-5 gap-4 min-w-[1250px] pb-4">
        {KANBAN_COLUMNS.map((col) => {
          const columnOrders = orders.filter((o) =>
            col.statuses.includes(o.status),
          );

          return (
            <div
              key={col.id}
              className="flex flex-col bg-surface-subtle/60 border border-border rounded-card p-2.5 min-h-[520px]"
            >
              {/* Cabecera de Columna */}
              <div
                className={`flex items-center justify-between px-3 py-2 mb-3 rounded-button border ${col.headerClass}`}
              >
                <span className="text-xs font-bold tracking-tight">
                  {col.title}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${col.badgeClass}`}
                >
                  {columnOrders.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div className="space-y-2.5 flex-1">
                {columnOrders.length === 0 ? (
                  <div className="h-32 border border-dashed border-border rounded-card flex items-center justify-center text-[11px] text-brand-muted">
                    Sin pedidos en esta etapa
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const isNewPulse =
                      recentOrderIds.includes(order.id) ||
                      isRecentlyCreatedReceived(order);
                    const isIncident = order.status === "incidencia_transporte";
                    const isCancelled =
                      order.status === "cancelado" ||
                      order.status === "cancelled";
                    const isUpdating = updatingOrderId === order.id;

                    const customerName =
                      order.customer_name ||
                      [
                        order.profiles?.first_name,
                        order.profiles?.paternal_surname,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                      "Cliente";
                    const phone =
                      order.customer_phone || order.profiles?.phone || "";
                    const txId = order.payment_gateway_tx_id;
                    const isPendingPayment =
                      order.payment_status === "pending_verification";
                    const isPaid = order.payment_status === "paid";
                    const driverName = resolveDriverName(order);

                    return (
                      <Card
                        key={order.id}
                        className={`p-3 bg-surface-card border border-border shadow-xs space-y-2.5 transition-all ${
                          isNewPulse
                            ? "ring-2 ring-emerald-400 bg-emerald-50/40 animate-pulse"
                            : ""
                        } ${
                          isIncident
                            ? "border-l-4 border-l-rose-500 bg-rose-50/20"
                            : ""
                        }`}
                      >
                        {/* Cabecera de Tarjeta */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            {isIncident && (
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            )}
                            <span className="font-mono font-bold text-accent text-sm truncate">
                              #{order.order_number}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigateDetail(order.order_number)}
                            className="p-1 text-brand-muted hover:text-brand-primary rounded"
                            title="Ver detalle completo"
                          >
                            <ClipboardList className="w-3.5 h-3.5 inline" />
                            <ArrowRight className="w-2.5 h-2.5 -ml-0.5 inline" />
                          </button>
                        </div>

                        {/* Información del Cliente y Despacho */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-brand-primary truncate">
                              {customerName}
                            </p>
                            {phone && (
                              <p className="text-[11px] font-mono text-brand-secondary">
                                {phone}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {renderDeliveryBadge(order.delivery_type)}
                          </div>
                        </div>

                        {/* Desglose de Prendas (Solo en columnas En Almacén y En Bolsa) */}
                        {(col.id === "en_almacen" || col.id === "en_bolsa") &&
                          order.order_items?.length > 0 && (
                            <div className="bg-surface-subtle p-2 rounded text-[11px] border border-border/60 space-y-1">
                              <div className="text-[10px] uppercase font-bold text-brand-secondary">
                                Prendas a empacar/entregar:
                              </div>
                              <ul className="space-y-0.5">
                                {order.order_items?.map((item) => (
                                  <li
                                    key={item.id}
                                    className="text-brand-primary flex justify-between"
                                  >
                                    <span className="truncate">
                                      {item.quantity}x{" "}
                                      {item.product_variants?.products?.name} (
                                      {item.product_variants?.sizes?.name ||
                                        "Talla Única"}{" "}
                                      - {item.product_variants?.color})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        {/* Pago y Voucher */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-border/60">
                          <span className="text-[11px] font-medium text-brand-secondary">
                            {PAYMENT_LABELS[order.payment_method] ||
                              order.payment_method ||
                              "—"}
                          </span>

                          {txId && (
                            <button
                              type="button"
                              onClick={(e) => handleCopyTx(txId, e)}
                              title="Copiar N° Operación"
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                                isPendingPayment
                                  ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                  : isPaid
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-surface-subtle text-brand-secondary border-border"
                              }`}
                            >
                              {isPaid && (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              )}
                              <span>#Op: {txId}</span>
                              {copiedTxId === txId ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                !isPaid && <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Repartidor (en columnas En Bolsa y En Ruta) */}
                        {(col.id === "en_bolsa" || col.id === "en_ruta") && (
                          <div className="pt-1 border-t border-border/60 text-[11px]">
                            {!driverName ? (
                              <span className="text-amber-700 font-medium">
                                Esperando motorizado...
                              </span>
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-brand-primary truncate">
                                  {driverName}
                                </span>
                                <span className="text-[10px] text-brand-secondary shrink-0">
                                  {ROUTE_STATUS_LABELS[order.status] ||
                                    "Asignado"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pie de Tarjeta */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                          <span className="font-mono font-bold text-sm text-brand-primary">
                            {money(order.total_amount)}
                          </span>

                          {col.id === "por_validar" && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => onVerifyPayment(order)}
                              className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                            >
                              <span>Validar Pago</span>
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}

                          {col.id === "en_almacen" && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => onSendToPool(order)}
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              <span>A Bolsa</span>
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}

                          {col.id === "finalizados" &&
                            (isIncident ? (
                              <Button
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => onRequeueIncident(order)}
                                className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                              >
                                <span>Reencolar</span>
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            ) : (
                              <span className="text-[11px] text-brand-muted">
                                {isCancelled ? "Cancelado" : "Completado"}
                              </span>
                            ))}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

