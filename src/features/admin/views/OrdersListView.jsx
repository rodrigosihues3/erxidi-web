import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Columns3,
  LayoutGrid,
  LayoutList,
  RefreshCw,
  RotateCcw,
  X,
  ArrowUpRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  Play,
  PackageCheck,
  AlertOctagon,
  Calendar,
  Zap,
  Store,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../services/supabase";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import OrderPaymentModal from "../components/OrderPaymentModal";
import OrderKanbanView from "../components/OrderKanbanView";
import { useAdminOrders } from "../hooks/useAdminOrders";
import {
  getDeliveryStaff,
  listOrders,
  markOrderReadyForDelivery,
  resolveOrderIncident,
  updateOrderStatus,
} from "../services/adminOrders.service";

const STATUS_OPTIONS = [
  { value: "all", label: "Estado" },
  { value: "recibido", label: "Recibido" },
  { value: "pendiente_pago", label: "Pendiente de Pago" },
  { value: "en_preparacion", label: "En Preparación" },
  { value: "por_asignar_repartidor", label: "En Bolsa" },
  { value: "en_camino", label: "En Camino" },
  { value: "cerca", label: "Cerca" },
  { value: "en_destino", label: "En Destino" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "incidencia_transporte", label: "Incidencia" },
];

const DELIVERY_OPTIONS = [
  { value: "all", label: "Despacho" },
  { value: "express", label: "Express" },
  { value: "scheduled", label: "Programado" },
  { value: "pickup", label: "Recojo" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Pago" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [shippingFilter, setShippingFilter] = useState("todos");
  const [paymentFilter, setPaymentFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("todos"); // "todos" | "hoy" | "7dias" | "30dias" | "mes"
  const [viewMode, setViewMode] = useState("kanban"); // 'kanban' | 'cards' | 'table'
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [localOrders, setLocalOrders] = useState([]);
  const [recentOrderIds, setRecentOrderIds] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [copiedTxId, setCopiedTxId] = useState(null);

  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    order: null,
  });

  const statusApiValue = useMemo(() => {
    if (viewMode === "kanban" || statusFilter === "todos") return "all";
    if (statusFilter === "por_validar")
      return ["received", "recibido", "pendiente_pago", "pending"];
    if (statusFilter === "en_preparacion")
      return ["en_preparacion", "preparing"];
    if (statusFilter === "en_bolsa")
      return ["por_asignar_repartidor", "asignado"];
    if (statusFilter === "en_ruta")
      return [
        "en_camino",
        "dispatched",
        "cerca",
        "nearby",
        "en_destino",
        "arrived",
      ];
    if (statusFilter === "finalizado")
      return ["entregado", "delivered"];
    if (statusFilter === "cancelado")
      return ["cancelado", "cancelled"];
    return statusFilter;
  }, [statusFilter, viewMode]);

  const shippingApiValue = useMemo(() => {
    if (shippingFilter === "todos") return "all";
    if (shippingFilter === "programado")
      return ["scheduled", "programado"];
    if (shippingFilter === "express")
      return ["express"];
    return shippingFilter;
  }, [shippingFilter]);

  const paymentApiValue = useMemo(() => {
    if (paymentFilter === "todos") return "all";
    if (paymentFilter === "tarjeta")
      return ["culqi_gateway", "tarjeta"];
    if (paymentFilter === "yape_plin")
      return ["yape_plin"];
    if (paymentFilter === "contraentrega")
      return ["contraentrega", "efectivo"];
    return paymentFilter;
  }, [paymentFilter]);

  const pageSize = viewMode === "kanban" ? 100 : 12;
  const filters = useMemo(
    () => ({
      page: viewMode === "kanban" ? 1 : page,
      pageSize,
      status: statusApiValue,
      deliveryType: shippingApiValue,
      paymentMethod: paymentApiValue,
      search: searchQuery,
      refreshTick,
    }),
    [
      viewMode,
      page,
      pageSize,
      statusApiValue,
      shippingApiValue,
      paymentApiValue,
      searchQuery,
      refreshTick,
    ],
  );

  const { data, count, loading, error } = useAdminOrders(filters);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== "" ||
      (viewMode !== "kanban" && statusFilter !== "todos") ||
      shippingFilter !== "todos" ||
      paymentFilter !== "todos" ||
      dateFilter !== "todos"
    );
  }, [
    searchQuery,
    statusFilter,
    shippingFilter,
    paymentFilter,
    dateFilter,
    viewMode,
  ]);

  const FINALIZED_STATUSES = [
    "entregado",
    "delivered",
    "cancelado",
    "cancelled",
    "incidencia_transporte",
  ];
  const FINALIZED_LIMIT = 10;

  function handleClearFilters() {
    setSearchQuery("");
    setStatusFilter("todos");
    setShippingFilter("todos");
    setPaymentFilter("todos");
    setDateFilter("todos");
    setPage(1);
  }

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? "" : curr));
    }, 4000);
  }

  async function handleManualRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await listOrders(filters);
      setLocalOrders(result.data || []);
      setRefreshTick((t) => t + 1);
      showToast("Lista de pedidos actualizada.");
    } catch (err) {
      showToast("No se pudo actualizar la lista de pedidos.");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  }

  useEffect(() => {
    setLocalOrders(data);
  }, [data]);

  const displayedOrders = useMemo(() => {
    if (!dateFilter || dateFilter === "todos") return localOrders;

    const now = new Date();

    return localOrders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = new Date(order.created_at);
      if (Number.isNaN(orderDate.getTime())) return false;

      if (dateFilter === "hoy") {
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        );
        return orderDate >= startOfToday;
      }

      if (dateFilter === "7dias") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= sevenDaysAgo;
      }

      if (dateFilter === "30dias") {
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return orderDate >= thirtyDaysAgo;
      }

      if (dateFilter === "mes") {
        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
          0,
          0,
          0,
          0,
        );
        return orderDate >= startOfMonth;
      }

      return true;
    });
  }, [localOrders, dateFilter]);

  const { kanbanOrders, finalizedTotal } = useMemo(() => {
    const live = [];
    const finalized = [];
    displayedOrders.forEach((o) =>
      (FINALIZED_STATUSES.includes(o.status) ? finalized : live).push(o),
    );
    finalized.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at) -
        new Date(a.updated_at || a.created_at),
    );
    return {
      kanbanOrders: [...live, ...finalized.slice(0, FINALIZED_LIMIT)],
      finalizedTotal: finalized.length,
    };
  }, [displayedOrders]);

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

  // Detección de Nuevos Pedidos (WebSocket)
  useEffect(() => {
    const timers = new Map();

    const channel = supabase
      .channel("admin-orders-realtime-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newId = payload.new?.id;
          if (!newId) return;

          setRecentOrderIds((prev) =>
            prev.includes(newId) ? prev : [...prev, newId],
          );
          setRefreshTick((t) => t + 1);

          if (timers.has(newId)) {
            clearTimeout(timers.get(newId));
          }
          const timerId = setTimeout(() => {
            setRecentOrderIds((prev) => prev.filter((id) => id !== newId));
            timers.delete(newId);
          }, 20000);
          timers.set(newId, timerId);
        },
      )
      .subscribe();

    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
      supabase.removeChannel(channel);
    };
  }, []);



  function handleCopyTx(txId, e) {
    e?.stopPropagation?.();
    if (!txId) return;
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => setCopiedTxId(null), 2000);
  }

  async function handleStartPreparing(orderOrId) {
    const orderId = typeof orderOrId === "object" ? orderOrId.id : orderOrId;
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, "en_preparacion");
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, ...updated, status: "en_preparacion" } : o,
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



  function renderDeliveryBadge(type) {
    const t = (type || "").toLowerCase();
    if (t === "pickup" || t === "recojo") {
      return (
        <Badge
          variant="neutral"
          className="inline-flex items-center bg-slate-100 text-slate-800 border-slate-200"
        >
          <Store className="w-3 h-3 mr-1" /> Recojo
        </Badge>
      );
    }
    if (t === "express") {
      return (
        <Badge
          variant="warning"
          className="inline-flex items-center bg-amber-50 text-amber-800 border-amber-200"
        >
          <Zap className="w-3 h-3 mr-1" /> Express
        </Badge>
      );
    }
    return (
      <Badge
        variant="neutral"
        className="inline-flex items-center bg-sky-50 text-sky-800 border-sky-200"
      >
        <Calendar className="w-3 h-3 mr-1" /> Programado
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

    return (
      <span className="text-xs font-bold text-brand-primary">{driverName}</span>
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
    const isCashOnDelivery =
      order.payment_method === "contraentrega" ||
      order.payment_method === "efectivo";
    const isPendingVerification =
      order.payment_status === "pending_verification" && !isCashOnDelivery;
    const isReceivedOrPaid =
      (order.status === "received" ||
        order.status === "recibido" ||
        order.status === "pagado" ||
        order.status === "pending" ||
        order.status === "pendiente_pago") &&
      (!isPendingVerification || isCashOnDelivery) &&
      order.status !== "cancelado" &&
      order.status !== "cancelled";
    const isEnPreparacion =
      order.status === "en_preparacion" || order.status === "preparing";
    const isPickup =
      (order.delivery_type || "").toLowerCase() === "pickup" ||
      (order.delivery_type || "").toLowerCase() === "recojo";
    const isIncident = order.status === "incidencia_transporte";
    const isCompletedOrCancelled =
      order.status === "entregado" ||
      order.status === "delivered" ||
      order.status === "cancelado" ||
      order.status === "cancelled";
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
          onClick={() => handleStartPreparing(order.id)}
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

    if (isCompletedOrCancelled) {
      return (
        <span className="text-[11px] text-brand-muted">Pedido completado</span>
      );
    }

    return <span className="text-[11px] text-brand-muted">En curso</span>;
  }

  return (
    <div className="space-y-4">
      {/* =========================================================================
          FILA 1: Encabezado de Sección y Conmutador de Vistas (Estilo Repartidores)
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        {/* Izquierda: Título de sección */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-brand-primary">
            Pedidos
          </h1>
        </div>

        {/* Derecha: Botonera de Vistas y Refresco Manual */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Selector de vistas agrupado */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-button border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-bold transition-all ${viewMode === "kanban"
                ? "bg-white text-brand-primary shadow-xs"
                : "text-slate-600 hover:text-brand-primary"
                }`}
              title="Vista de tablero por etapas"
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-bold transition-all ${viewMode === "cards" || viewMode === "grid"
                ? "bg-white text-brand-primary shadow-xs"
                : "text-slate-600 hover:text-brand-primary"
                }`}
              title="Vista en tarjetas cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-bold transition-all ${viewMode === "table"
                ? "bg-white text-brand-primary shadow-xs"
                : "text-slate-600 hover:text-brand-primary"
                }`}
              title="Vista en tabla o filas compactas"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Botón de Refresco Manual con Feedback Visual */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-9 w-9 inline-flex items-center justify-center rounded-button border border-border bg-white text-slate-600 hover:text-brand-primary hover:border-brand-primary/50 shadow-xs transition-colors disabled:opacity-50"
            title="Sincronizar pedidos ahora"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-brand-primary" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* =========================================================================
          FILA 2: Buscador a la Izquierda y Filtros Desplegables a la Derecha
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3">
        {/* Izquierda: Buscador */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pedido, cliente, teléfono o #operación..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-border rounded-button text-brand-primary placeholder:text-slate-400 focus:outline-none focus:border-brand-primary shadow-xs"
          />
        </div>

        {/* Derecha: Desplegables y Limpiador de Filtros */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Botón dinámico: Limpiar Filtros con texto completo */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-button shadow-xs transition-colors animate-in fade-in duration-150"
              title="Restablecer todos los filtros y búsqueda"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}

          {/* Filtro por Estado de Pedido (oculto en Kanban: las columnas ya lo representan) */}
          {viewMode !== "kanban" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs font-semibold bg-white border border-border rounded-button text-brand-primary focus:outline-none focus:border-brand-primary shadow-xs"
            >
              <option value="todos">Estado: Todos</option>
              <option value="por_validar">Por Validar</option>
              <option value="en_preparacion">En Preparación</option>
              <option value="en_bolsa">En Bolsa</option>
              <option value="en_ruta">En Ruta</option>
              <option value="finalizado">Finalizados</option>
              <option value="cancelado">Cancelados</option>
            </select>
          )}

          {/* Filtro por Tipo de Despacho */}
          <select
            value={shippingFilter}
            onChange={(e) => setShippingFilter(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-white border border-border rounded-button text-brand-primary focus:outline-none focus:border-brand-primary shadow-xs"
          >
            <option value="todos">Despacho: Todos</option>
            <option value="express">Express</option>
            <option value="programado">Programado</option>
          </select>

          {/* Filtro por Método de Pago */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-white border border-border rounded-button text-brand-primary focus:outline-none focus:border-brand-primary shadow-xs"
          >
            <option value="todos">Pago: Todos</option>
            <option value="yape_plin">Yape / Plin (Manual)</option>
            <option value="tarjeta">Tarjeta (Culqi)</option>
            <option value="contraentrega">Contraentrega</option>
          </select>

          {/* Filtro por Rango de Fechas */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-white border border-border rounded-button text-brand-primary focus:outline-none focus:border-brand-primary shadow-xs"
          >
            <option value="todos">Fecha: Todas</option>
            <option value="hoy">Hoy</option>
            <option value="7dias">Últimos 7 días</option>
            <option value="30dias">Últimos 30 días</option>
            <option value="mes">Este mes</option>
          </select>
        </div>
      </div>

      {/* ERROR / LOADING / EMPTY / CONTENT */}
      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-card">
          {error.message}
        </div>
      ) : loading && localOrders.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-card p-12 text-center text-sm text-brand-secondary">
          Cargando pedidos...
        </div>
      ) : viewMode === "kanban" ? (
        <OrderKanbanView
          orders={kanbanOrders}
          finalizedTotal={finalizedTotal}
          onViewHistory={() => setViewMode("table")}
          recentOrderIds={recentOrderIds}
          onVerifyPayment={(order) => setPaymentModal({ isOpen: true, order })}
          onSendToPreparation={handleStartPreparing}
          onSendToPool={handleSendToPool}
          onRequeueIncident={handleRequeueIncident}
          onNavigateDetail={(orderNumber) =>
            navigate(`/admin/pedidos/${orderNumber}`)
          }
          updatingOrderId={updatingOrderId}
          deliveryStaff={deliveryStaff}
        />
      ) : displayedOrders.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-card p-12 text-center text-sm text-brand-secondary">
          No encontramos pedidos con los filtros aplicados.
        </div>
      ) : viewMode === "cards" || viewMode === "grid" ? (
        /* VISTA EN TARJETAS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedOrders.map((order) => {
            const customerName =
              order.customer_name ||
              [order.profiles?.first_name, order.profiles?.paternal_surname]
                .filter(Boolean)
                .join(" ") ||
              "Cliente";
            const phone = order.customer_phone || order.profiles?.phone || "";
            const isIncident = order.status === "incidencia_transporte";
            const isRecent = recentOrderIds.includes(order.id);

            return (
              <Card
                key={order.id}
                className={`p-4 flex flex-col justify-between border border-border bg-surface-card hover:border-brand-primary/40 transition-colors ${isIncident ? "border-l-4 border-l-rose-500 bg-rose-50/20" : ""
                  } ${isRecent
                    ? "ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] animate-pulse"
                    : ""
                  }`}
              >
                {/* Header Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isIncident && (
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-bold font-mono text-base text-accent truncate">
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
                        className="p-1 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
                        title="Ver detalle completo del pedido"
                      >
                        <ArrowUpRight className="w-4 h-4" />
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
                {displayedOrders.map((order) => {
                  const isIncident = order.status === "incidencia_transporte";
                  const isRecent = recentOrderIds.includes(order.id);
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
                      className={`hover:bg-surface-subtle/50 transition-colors ${isIncident
                        ? "bg-rose-50/70 border-l-4 border-l-rose-500"
                        : ""
                        } ${isRecent ? "bg-emerald-50/40 animate-pulse" : ""}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {isIncident && (
                            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <p className="font-bold font-mono text-accent">
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

      {/* PAGINACIÓN (Solo en Grid y Tabla) */}
      {viewMode !== "kanban" && (
        <div className="bg-surface-card border border-border rounded-card p-3 flex items-center justify-between">
          <p className="text-xs text-brand-secondary">
            {displayedOrders.length} pedido(s)
          </p>
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
      )}

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
      {/* Toast Flotante de Notificaciones */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-button bg-brand-primary text-white text-xs font-semibold shadow-xl border border-brand-primary/20 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
