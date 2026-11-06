import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Zap,
  Store,
  Copy,
  Check,
  AlertOctagon,
} from "lucide-react";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

const KANBAN_COLUMNS = [
  {
    id: "por_validar",
    title: "Por Validar",
    statuses: ["recibido", "received", "pendiente_pago", "pending"],
    headerBg: "bg-slate-700",
  },
  {
    id: "en_preparacion",
    title: "En Preparación",
    statuses: ["en_preparacion", "preparing"],
    headerBg: "bg-blue-600",
  },
  {
    id: "en_bolsa",
    title: "En Bolsa",
    statuses: ["por_asignar_repartidor", "asignado"],
    headerBg: "bg-amber-600",
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
    headerBg: "bg-indigo-600",
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
    headerBg: "bg-emerald-700",
  },
];

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function formatConciseDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} · ${hours}:${minutes}`;
}

function isRecentlyCreatedReceived(order) {
  const validStatuses = ["recibido", "received", "pendiente_pago", "pending"];
  if (!validStatuses.includes(order.status) || !order.created_at) return false;
  const createdMs = new Date(order.created_at).getTime();
  if (Number.isNaN(createdMs)) return false;
  return Date.now() - createdMs < 5 * 60 * 1000;
}

function matchesDateFilter(order, dateFilter) {
  if (!dateFilter || dateFilter === "all") return true;
  const refDate = new Date(order.updated_at || order.created_at);
  if (Number.isNaN(refDate.getTime())) return true;

  const now = new Date();
  if (dateFilter === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    return refDate >= startOfToday;
  }
  if (dateFilter === "week") {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return refDate >= startOfWeek;
  }
  if (dateFilter === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return refDate >= startOfMonth;
  }
  return true;
}

function getNormalizedPaymentLabel(method) {
  if (method === "yape_plin" || method === "transferencia") {
    return "Pago manual";
  }
  if (method === "contraentrega" || method === "efectivo") {
    return "Contraentrega";
  }
  if (method === "culqi_gateway") {
    return "Culqi (Online)";
  }
  return method || "—";
}

export default function OrderKanbanView({
  orders = [],
  recentOrderIds = [],
  dateFilter = "all",
  onVerifyPayment,
  onSendToPreparation,
  onSendToPool,
  onNavigateDetail,
  updatingOrderId,
  deliveryStaff = [],
}) {
  const [copiedId, setCopiedId] = useState(null);

  function handleCopyOp(txId) {
    if (!txId) return;
    navigator.clipboard.writeText(txId);
    setCopiedId(txId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function renderPaymentBadge(method) {
    const label = getNormalizedPaymentLabel(method);
    return (
      <Badge className="bg-slate-100 text-slate-800 border-slate-300 rounded-button text-[10px] font-semibold px-2 py-0.5">
        {label}
      </Badge>
    );
  }

  function renderDeliveryBadge(type) {
    const t = (type || "").toLowerCase();
    if (t === "express") {
      return (
        <Badge className="bg-amber-50 text-amber-800 border-amber-200 rounded-button text-[10px] font-semibold px-2 py-0.5">
          <Zap className="w-3 h-3 mr-1" /> Express
        </Badge>
      );
    }
    if (t === "pickup" || t === "recojo") {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 rounded-button text-[10px] font-semibold px-2 py-0.5">
          <Store className="w-3 h-3 mr-1" /> Recojo
        </Badge>
      );
    }
    return (
      <Badge className="bg-sky-50 text-sky-800 border-sky-200 rounded-button text-[10px] font-semibold px-2 py-0.5">
        <Calendar className="w-3 h-3 mr-1" /> Programado
      </Badge>
    );
  }

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

  return (
    <div className="overflow-x-auto h-[calc(100vh-175px)]">
      <div className="grid grid-cols-5 gap-4 min-w-[1250px] h-full pb-2">
        {KANBAN_COLUMNS.map((col) => {
          const isFinalizados = col.id === "finalizados";
          const showDeliverySection =
            col.id === "en_bolsa" ||
            col.id === "en_ruta" ||
            col.id === "finalizados";

          const rawOrders = orders.filter((o) =>
            col.statuses.includes(o.status),
          );

          const filteredOrders = isFinalizados
            ? rawOrders.filter((o) => matchesDateFilter(o, dateFilter))
            : rawOrders;

          const sortedOrders = [...filteredOrders].sort((a, b) => {
            if (isFinalizados) {
              return (
                new Date(b.updated_at || b.created_at) -
                new Date(a.updated_at || a.created_at)
              );
            }
            return new Date(a.created_at) - new Date(b.created_at);
          });

          const visibleOrders = isFinalizados
            ? sortedOrders.slice(0, 15)
            : sortedOrders;

          return (
            <div key={col.id} className="flex flex-col h-full min-h-0">
              {/* Header Sólido */}
              <div
                className={`h-11 px-3.5 flex items-center justify-between rounded-t-card text-white font-bold text-xs shadow-xs shrink-0 ${col.headerBg}`}
              >
                <span className="tracking-tight">{col.title}</span>
                <span className="bg-white/20 text-white font-mono px-2 py-0.5 rounded-full text-[11px]">
                  {filteredOrders.length}
                </span>
              </div>

              {/* Cuerpo de Tarjetas con Scroll Independiente */}
              <div className="bg-surface-subtle border-x border-b border-border rounded-b-card p-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-230px)] space-y-2.5 scrollbar-thin">
                {visibleOrders.length === 0 ? (
                  <div className="h-32 border border-dashed border-border rounded-card flex items-center justify-center text-[11px] text-brand-muted">
                    Sin pedidos en esta etapa
                  </div>
                ) : (
                  <>
                    {visibleOrders.map((order) => {
                      const isNewPulse =
                        recentOrderIds.includes(order.id) ||
                        isRecentlyCreatedReceived(order);
                      const isIncident =
                        order.status === "incidencia_transporte";
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
                      const isCashOnDelivery =
                        order.payment_method === "contraentrega" ||
                        order.payment_method === "efectivo";
                      const paymentBadge = renderPaymentBadge(
                        order.payment_method,
                      );
                      const deliveryBadge = renderDeliveryBadge(
                        order.delivery_type,
                      );
                      const driverName = resolveDriverName(order);

                      return (
                        <div
                          key={order.id}
                          className={`bg-surface-card border border-border rounded-card shadow-xs overflow-hidden transition-all ${
                            isNewPulse
                              ? "ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] animate-pulse"
                              : ""
                          } ${
                            isIncident
                              ? "border-l-4 border-l-rose-500 bg-rose-50/20"
                              : ""
                          }`}
                        >
                          {/* Bloque A - Cabecera de la Card */}
                          <div className="bg-slate-50 border-b border-border/80 px-3 py-2 rounded-t-card">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-accent text-sm tracking-tight">
                                #{order.order_number}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigateDetail(order.order_number)
                                }
                                className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
                                title="Ver detalle completo del pedido"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {formatConciseDate(order.created_at)}
                            </p>
                          </div>

                          {/* Bloque B - Cuerpo de la Card */}
                          <div className="p-3">
                            {/* Paso 1: Fila del Cliente y Divisor */}
                            <p className="font-bold text-xs text-brand-primary w-full break-words leading-tight">
                              {customerName}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {phone || "Sin teléfono"}
                            </p>
                            <div className="border-t border-border/60 my-2" />

                            {/* Paso 2: Fila de Prendas (Color arriba, Talla abajo en 2 filas) */}
                            {order.order_items?.map((item) => (
                              <div
                                key={item.id}
                                className="bg-surface-subtle border border-border/60 rounded-button p-2 text-[11px] grid grid-cols-[1fr_auto_auto] items-center gap-2 mb-1.5"
                              >
                                <span className="text-brand-primary font-medium break-words leading-snug">
                                  {item.product_variants?.products?.name ||
                                    "Prenda"}
                                </span>

                                <div className="bg-white border border-border/50 rounded px-1.5 py-0.5 text-center font-mono leading-tight flex flex-col justify-center min-w-[75px]">
                                  <span className="text-[10px] text-brand-primary font-semibold truncate capitalize">
                                    {item.product_variants?.color || "—"}
                                  </span>
                                  <span className="text-[9px] text-brand-secondary truncate border-t border-border/30 mt-0.5 pt-0.5">
                                    {item.product_variants?.sizes?.name || "U"}
                                  </span>
                                </div>

                                <span className="text-brand-primary font-bold font-mono text-[11px] whitespace-nowrap pl-1">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}

                            {/* Paso 3: Pago y Despacho */}
                            <div className="flex items-center justify-between gap-2 mt-2">
                              {paymentBadge}
                              {deliveryBadge}
                            </div>

                            {order.payment_gateway_tx_id && (
                              <div className="flex items-center justify-between text-[11px] mt-1.5 px-0.5">
                                <span className="text-slate-500">
                                  Número de operación:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyOp(order.payment_gateway_tx_id)
                                  }
                                  className="font-mono font-bold text-brand-primary hover:text-accent flex items-center gap-1"
                                  title="Copiar número"
                                >
                                  <span>{order.payment_gateway_tx_id}</span>
                                  {copiedId === order.payment_gateway_tx_id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Paso 4: Divisor y Sección del Repartidor al Final */}
                            {showDeliverySection && (
                              <>
                                <div className="border-t border-border/60 my-2" />
                                <div className="text-xs flex items-center justify-between px-0.5">
                                  <span className="text-slate-500 text-[11px]">
                                    Repartidor:
                                  </span>
                                  {order.assigned_delivery_id ? (
                                    <span className="font-bold text-brand-primary text-xs">
                                      {order.delivery_name ||
                                        driverName ||
                                        "Asignado"}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-normal text-xs">
                                      Sin asignar
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Bloque C - Pie de la Card */}
                          <div className="bg-slate-50/70 border-t border-border/80 px-3 py-2 flex items-center justify-between">
                            <span className="font-mono font-bold text-base text-brand-primary">
                              {money(order.total_amount)}
                            </span>

                            <div>
                              {col.id === "por_validar" &&
                                (isCashOnDelivery ? (
                                  <Button
                                    size="sm"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      onSendToPreparation(order.id)
                                    }
                                    className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                                  >
                                    <span>A Preparación</span>
                                    <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={isUpdating}
                                    onClick={() => onVerifyPayment(order)}
                                    className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                                  >
                                    <span>Validar Pago</span>
                                    <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                ))}

                              {col.id === "en_preparacion" && (
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

                              {col.id === "en_ruta" && (
                                <span className="text-[11px] text-indigo-700 font-semibold">
                                  En ruta
                                </span>
                              )}

                              {col.id === "finalizados" && (
                                <span className="text-[11px] text-brand-muted">
                                  Completado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isFinalizados && sortedOrders.length > 0 && (
                      <p className="text-center text-[11px] text-brand-muted py-1.5">
                        Mostrando las últimas 15 entregas
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
