import { useEffect, useMemo, useState } from "react";
import {
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  Play,
  PackageCheck,
  RotateCcw,
  AlertOctagon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import OrderPaymentModal from "../components/OrderPaymentModal";
import { useAdminOrders } from "../hooks/useAdminOrders";
import {
  getDeliveryStaff,
  markOrderReadyForDelivery,
  resolveOrderIncident,
  updateOrderStatus,
} from "../services/adminOrders.service";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "received", label: "Recibido" },
  { value: "en_preparacion", label: "En Preparación" },
  { value: "por_asignar_repartidor", label: "Por Asignar Repartidor" },
  { value: "en_camino", label: "En Camino" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "incidencia_transporte", label: "Incidencia" },
];

const DELIVERY_OPTIONS = [
  { value: "all", label: "Todo despacho" },
  { value: "express", label: "Express" },
  { value: "scheduled", label: "Programado" },
  { value: "pickup", label: "Recojo" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Todo método" },
  { value: "yape_plin", label: "Yape / Plin" },
  { value: "culqi_gateway", label: "Culqi" },
  { value: "contraentrega", label: "Contraentrega" },
  { value: "transferencia", label: "Transferencia" },
];

const PAYMENT_LABELS = {
  yape_plin: "Yape / Plin",
  culqi_gateway: "Culqi (Online)",
  contraentrega: "Contraentrega",
  efectivo: "Contraentrega",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function formatPaymentMethod(method) {
  if (!method) return "—";
  return PAYMENT_LABELS[method] || method;
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

export default function OrdersListView() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deliveryType, setDeliveryType] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [refreshTick, setRefreshTick] = useState(0);

  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [localOrders, setLocalOrders] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [copiedTxId, setCopiedTxId] = useState(null);

  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    order: null,
  });

  const pageSize = 12;
  const filters = useMemo(
    () => ({
      page,
      pageSize,
      status,
      deliveryType,
      paymentMethod,
      search,
      refreshTick,
    }),
    [page, pageSize, status, deliveryType, paymentMethod, search, refreshTick],
  );

  const { data, count, loading, error } = useAdminOrders(filters);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    setLocalOrders(data);
  }, [data]);

  useEffect(() => {
    let active = true;
    getDeliveryStaff()
      .then((staff) => {
        if (active) setDeliveryStaff(staff);
      })
      .catch((err) => {
        console.error("Error al cargar repartidores:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleCopyTx(txId, e) {
    e?.stopPropagation?.();
    if (!txId) return;
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => setCopiedTxId(null), 2000);
  }

  async function handleStartPreparing(order) {
    setUpdatingOrderId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, "en_preparacion");
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, ...updated, status: "en_preparacion" } : o,
        ),
      );
    } catch (err) {
      window.alert(err.message || "Error al iniciar preparación.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleSendToPool(order) {
    setUpdatingOrderId(order.id);
    try {
      const updated = await markOrderReadyForDelivery(order.id);
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, ...updated, status: "por_asignar_repartidor" }
            : o,
        ),
      );
    } catch (err) {
      window.alert(err.message || "Error al enviar pedido a la bolsa.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleRequeueIncident(order) {
    if (
      !window.confirm(
        `¿Reenviar el pedido #${order.order_number} a la bolsa de repartidores?`,
      )
    )
      return;
    setUpdatingOrderId(order.id);
    try {
      const updated = await resolveOrderIncident(
        order.id,
        "por_asignar_repartidor",
      );
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, ...updated, status: "por_asignar_repartidor" }
            : o,
        ),
      );
    } catch (err) {
      window.alert(err.message || "Error al reencolar el pedido.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function renderDeliveryBadge(type) {
    const t = (type || "").toLowerCase();
    if (t === "pickup" || t === "recojo") {
      return (
        <Badge
          variant="neutral"
          className="bg-slate-100 text-slate-800 border-slate-200"
        >
          🏪 Recojo
        </Badge>
      );
    }
    if (t === "express") {
      return (
        <Badge
          variant="warning"
          className="bg-amber-50 text-amber-800 border-amber-200"
        >
          ⚡ Express
        </Badge>
      );
    }
    return (
      <Badge
        variant="neutral"
        className="bg-sky-50 text-sky-800 border-sky-200"
      >
        📅 Programado
      </Badge>
    );
  }

  function renderDriverInfo(order) {
    const type = (order.delivery_type || "").toLowerCase();
    const isPickup = type === "pickup" || type === "recojo";
    if (isPickup) {
      return (
        <span className="text-xs text-brand-muted italic">
          No aplica (Tienda)
        </span>
      );
    }
    if (!order.assigned_delivery_id) {
      return (
        <span className="text-xs text-amber-700 font-medium">
          Bolsa (Sin asignar)
        </span>
      );
    }

    const staff = deliveryStaff.find(
      (s) => s.id === order.assigned_delivery_id,
    );
    const driverName = staff
      ? `${staff.first_name} ${staff.paternal_surname || ""}`.trim()
      : order.delivery_profile
        ? `${order.delivery_profile.first_name} ${order.delivery_profile.paternal_surname || ""}`.trim()
        : "Repartidor";
    const driverType =
      staff?.delivery_type ||
      order.delivery_profile?.delivery_type ||
      "scheduled";
    const isExpressDriver = driverType === "express";

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-brand-primary">
          {driverName}
        </span>
        {isExpressDriver ? (
          <Badge
            variant="warning"
            className="text-[10px] px-1 py-0 bg-amber-50 text-amber-800 border-amber-200"
          >
            ⚡ Express
          </Badge>
        ) : (
          <Badge
            variant="neutral"
            className="text-[10px] px-1 py-0 bg-sky-50 text-sky-800 border-sky-200"
          >
            📅 Prog
          </Badge>
        )}
      </div>
    );
  }

  function renderPaymentInfo(order) {
    const isPending = order.payment_status === "pending_verification";
    const isPaid = order.payment_status === "paid";
    const txId = order.payment_gateway_tx_id;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="neutral"
            className="text-[10px] px-1.5 py-0 font-medium bg-surface-subtle text-brand-secondary border-border"
          >
            {formatPaymentMethod(order.payment_method)}
          </Badge>
          {isPending && (
            <span className="text-[10px] font-bold text-amber-700">
              Por verificar
            </span>
          )}
        </div>

        {txId && (
          <div>
            {isPending ? (
              <button
                type="button"
                onClick={(e) => handleCopyTx(txId, e)}
                title="Clic para copiar N° Operación"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
              >
                <span>#Op: {txId}</span>
                {copiedTxId === txId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-amber-600" />
                )}
              </button>
            ) : isPaid ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>#Op: {txId}</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono text-brand-muted">
                #Op: {txId}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderQuickAction(order) {
    const isPendingVerification =
      order.payment_status === "pending_verification";
    const isReceivedOrPaid =
      (order.status === "received" ||
        order.status === "pagado" ||
        order.status === "pending") &&
      order.payment_status !== "pending_verification" &&
      order.status !== "cancelado" &&
      order.status !== "cancelled";
    const isEnPreparacion = order.status === "en_preparacion";
    const isPickup =
      (order.delivery_type || "").toLowerCase() === "pickup" ||
      (order.delivery_type || "").toLowerCase() === "recojo";
    const isIncident = order.status === "incidencia_transporte";
    const isUpdating = updatingOrderId === order.id;

    if (isPendingVerification) {
      return (
        <Button
          size="sm"
          disabled={isUpdating}
          onClick={() => setPaymentModal({ isOpen: true, order })}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          <span>Validar Pago</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    if (isReceivedOrPaid) {
      return (
        <Button
          size="sm"
          disabled={isUpdating}
          onClick={() => handleStartPreparing(order)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
        >
          <Play className="w-3.5 h-3.5 mr-1" />
          <span>A Preparación</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    if (isEnPreparacion && !isPickup) {
      return (
        <Button
          size="sm"
          disabled={isUpdating}
          onClick={() => handleSendToPool(order)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
        >
          <PackageCheck className="w-3.5 h-3.5 mr-1" />
          <span>A Bolsa</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    if (isIncident) {
      return (
        <Button
          size="sm"
          disabled={isUpdating}
          onClick={() => handleRequeueIncident(order)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          <span>Reencolar</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      );
    }

    return <span className="text-xs text-brand-muted">—</span>;
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE HERRAMIENTAS COMPACTA */}
      <div className="bg-surface-card border border-border rounded-card p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
        {/* Izquierda: Buscador */}
        <div className="relative flex-1 min-w-[220px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => updateFilter(setSearch, e.target.value)}
            placeholder="Buscar pedido, cliente, teléfono o #operación..."
            className="w-full h-9 pl-9 pr-3 border border-border rounded-button text-xs bg-surface-card text-brand-primary outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Centro: Selectores Compactos */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => updateFilter(setStatus, e.target.value)}
            className="h-9 px-2.5 text-xs bg-surface-card border border-border rounded-button text-brand-primary outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={deliveryType}
            onChange={(e) => updateFilter(setDeliveryType, e.target.value)}
            className="h-9 px-2.5 text-xs bg-surface-card border border-border rounded-button text-brand-primary outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            {DELIVERY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(e) => updateFilter(setPaymentMethod, e.target.value)}
            className="h-9 px-2.5 text-xs bg-surface-card border border-border rounded-button text-brand-primary outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            {PAYMENT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Derecha: Alternador de Vistas y Refresco */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <div className="inline-flex items-center gap-1 bg-surface-subtle p-1 rounded-button border border-border">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista cuadrícula"
              className={`p-1.5 rounded-button transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-brand-primary shadow-xs"
                  : "text-brand-muted hover:text-brand-primary"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista tabla"
              className={`p-1.5 rounded-button transition-colors ${
                viewMode === "table"
                  ? "bg-white text-brand-primary shadow-xs"
                  : "text-brand-muted hover:text-brand-primary"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshTick((t) => t + 1)}
            title="Refrescar pedidos"
            className="h-9 px-2.5 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-secondary" />
          </Button>
        </div>
      </div>

      {/* ERROR / LOADING / EMPTY / CONTENT */}
      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-card">
          {error.message}
        </div>
      ) : loading ? (
        <div className="bg-surface-card border border-border rounded-card p-12 text-center text-sm text-brand-secondary">
          Cargando pedidos...
        </div>
      ) : localOrders.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-card p-12 text-center text-sm text-brand-secondary">
          No encontramos pedidos con los filtros aplicados.
        </div>
      ) : viewMode === "grid" ? (
        /* VISTA EN TARJETAS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {localOrders.map((order) => {
            const customerName =
              order.customer_name ||
              [order.profiles?.first_name, order.profiles?.paternal_surname]
                .filter(Boolean)
                .join(" ") ||
              "Cliente";
            const phone = order.customer_phone || order.profiles?.phone || "";
            const isIncident = order.status === "incidencia_transporte";

            return (
              <Card
                key={order.id}
                className={`p-4 flex flex-col justify-between border border-border bg-surface-card hover:border-brand-primary/40 transition-colors ${
                  isIncident ? "border-l-4 border-l-rose-500 bg-rose-50/20" : ""
                }`}
              >
                {/* Header Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isIncident && (
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-bold font-mono text-base text-brand-primary truncate">
                        #{order.order_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <OrderStatusBadge status={order.status} />
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/admin/pedidos/${order.order_number}`)
                        }
                        title="Ver detalle del pedido"
                        className="p-1.5 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo Card */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-brand-primary block truncate">
                        {customerName}
                      </span>
                      {phone && (
                        <span className="text-brand-secondary font-mono text-[11px]">
                          {phone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <span className="text-brand-muted text-[11px]">
                        Modalidad:
                      </span>
                      {renderDeliveryBadge(order.delivery_type)}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-muted text-[11px]">
                        Repartidor:
                      </span>
                      {renderDriverInfo(order)}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <span className="text-brand-muted text-[11px]">
                        Pago:
                      </span>
                      <div className="text-right">
                        {renderPaymentInfo(order)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-brand-muted text-[11px]">
                      <span>Fecha:</span>
                      <span className="font-mono">
                        {formatConciseDate(order.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Card */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-4 border-t border-border">
                  <div>
                    <span className="block text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
                      Total
                    </span>
                    <span className="font-mono font-black text-lg text-brand-primary">
                      {money(order.total_amount)}
                    </span>
                  </div>

                  <div>{renderQuickAction(order)}</div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* VISTA EN TABLA */
        <div className="bg-surface-card border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Pedido / Cliente
                  </th>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Fecha
                  </th>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Despacho
                  </th>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Pago
                  </th>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Repartidor
                  </th>
                  <th className="text-left p-4 font-semibold text-brand-primary">
                    Estado
                  </th>
                  <th className="text-right p-4 font-semibold text-brand-primary">
                    Total
                  </th>
                  <th className="p-4 text-center font-semibold text-brand-primary">
                    Acción Rápida
                  </th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {localOrders.map((order) => {
                  const isIncident = order.status === "incidencia_transporte";
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

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-surface-subtle/50 transition-colors ${
                        isIncident
                          ? "bg-rose-50/70 border-l-4 border-l-rose-500"
                          : ""
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {isIncident && (
                            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <p className="font-bold font-mono text-brand-primary">
                            #{order.order_number}
                          </p>
                        </div>
                        <p className="text-xs text-brand-secondary mt-0.5">
                          {customerName}
                          {phone ? ` · ${phone}` : ""}
                        </p>
                      </td>

                      <td className="p-4 text-xs font-mono text-brand-secondary whitespace-nowrap">
                        {formatConciseDate(order.created_at)}
                      </td>

                      <td className="p-4 text-xs">
                        {renderDeliveryBadge(order.delivery_type)}
                      </td>

                      <td className="p-4 text-xs text-brand-primary whitespace-nowrap">
                        {renderPaymentInfo(order)}
                      </td>

                      <td className="p-4 text-xs">
                        {renderDriverInfo(order)}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <OrderStatusBadge status={order.status} />
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-sm whitespace-nowrap text-brand-primary">
                        {money(order.total_amount)}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        {renderQuickAction(order)}
                      </td>

                      <td className="p-4 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/admin/pedidos/${order.order_number}`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINACIÓN */}
      <div className="bg-surface-card border border-border rounded-card p-3 flex items-center justify-between">
        <p className="text-xs text-brand-secondary">{count} pedido(s)</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-semibold text-brand-primary">
            Página {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* MODAL DE VALIDACIÓN DE PAGO */}
      <OrderPaymentModal
        order={paymentModal.order}
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, order: null })}
        onSuccess={(updatedOrder) => {
          setLocalOrders((prev) =>
            prev.map((o) =>
              o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o,
            ),
          );
          setRefreshTick((t) => t + 1);
        }}
      />
    </div>
  );
}
