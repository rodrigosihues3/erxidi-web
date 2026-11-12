import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import {
  Package,
  Calendar,
  Truck,
  ShoppingBag,
  ArrowRight,
  Loader2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

const PAGE_SIZE = 5;

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(amount || 0));

const formatDate = (isoString) => {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
};

const STATUS_CONFIG = {
  // Estados en Español (Base de datos real)
  recibido: { label: "Recibido", variant: "neutral", group: "active" },
  pendiente_pago: { label: "Pendiente de Pago", variant: "warning", group: "active" },
  en_preparacion: { label: "En Preparación", variant: "warning", group: "active" },
  por_asignar_repartidor: { label: "Por Asignar", variant: "warning", group: "active" },
  asignado: { label: "Asignado", variant: "neutral", group: "active" },
  listo_recojo: { label: "Listo para Recojo", variant: "neutral", group: "active" },
  en_camino: { label: "En Camino", variant: "neutral", group: "active" },
  cerca: { label: "Cerca de Ti", variant: "warning", group: "active" },
  en_destino: { label: "En Destino", variant: "warning", group: "active" },
  entregado: { label: "Entregado", variant: "success", group: "delivered" },
  cancelado: { label: "Cancelado", variant: "danger", group: "cancelled" },
  incidencia_transporte: { label: "Incidencia", variant: "danger", group: "active" },

  // Compatibilidad en Inglés
  received: { label: "Recibido", variant: "neutral", group: "active" },
  pending: { label: "Pendiente", variant: "warning", group: "active" },
  preparing: { label: "En Preparación", variant: "warning", group: "active" },
  dispatched: { label: "En Camino", variant: "neutral", group: "active" },
  nearby: { label: "Cerca de Ti", variant: "warning", group: "active" },
  arrived: { label: "En Destino", variant: "warning", group: "active" },
  delivered: { label: "Entregado", variant: "success", group: "delivered" },
  cancelled: { label: "Cancelado", variant: "danger", group: "cancelled" },
};

const FILTER_TABS = [
  { id: "all", label: "Todos" },
  { id: "active", label: "En Curso" },
  { id: "delivered", label: "Entregados" },
  { id: "cancelled", label: "Cancelados" },
];

export default function OrdersHistoryView() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados de filtrado y paginación
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    async function fetchUserOrders() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;
        if (isMounted) setOrders(data || []);
      } catch (err) {
        console.error("Error al obtener pedidos:", err);
        if (isMounted) {
          setError(
            err.message || "No se pudieron cargar tus pedidos en este momento."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchUserOrders();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Filtrado reactivo de pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusKey = (order.status || "received").toLowerCase();
      const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.received;

      if (statusFilter !== "all" && statusMeta.group !== statusFilter) {
        return false;
      }

      if (
        deliveryFilter !== "all" &&
        order.delivery_type !== deliveryFilter
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNumber = (order.order_number || "")
          .toLowerCase()
          .includes(q);
        const matchAddress = (order.delivery_address || "")
          .toLowerCase()
          .includes(q);
        if (!matchNumber && !matchAddress) return false;
      }

      return true;
    });
  }, [orders, statusFilter, deliveryFilter, searchQuery]);

  // Reiniciar a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deliveryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredOrders.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredOrders, safePage]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">
            Historial de Pedidos
          </h1>
          <p className="text-xs text-brand-secondary mt-1">
            Revisa el detalle de tus compras, filtra por estado y realiza
            seguimiento en tiempo real.
          </p>
        </div>

        <Link to="/mi-cuenta">
          <Button variant="outline" size="sm" className="text-xs">
            Volver a Mi Perfil
          </Button>
        </Link>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      {!loading && !error && orders.length > 0 && (
        <div className="p-4 bg-surface-card border border-border rounded-card space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Pestañas por Estado */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_TABS.map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={
                      "px-3 py-1.5 rounded-button text-xs font-semibold transition-colors border " +
                      (active
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-surface-subtle text-brand-secondary border-border hover:border-brand-primary")
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Buscador por código y filtro de entrega */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar orden (ej. ERX-123)..."
                  className="w-full h-9 pl-8 pr-3 text-xs border border-border rounded-button bg-surface-subtle focus:bg-white focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-brand-muted hidden sm:inline" />
                <select
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value)}
                  className="h-9 px-2.5 text-xs border border-border rounded-button bg-surface-subtle text-brand-primary font-medium focus:outline-none"
                >
                  <option value="all">Toda entrega</option>
                  <option value="scheduled">Programado</option>
                  <option value="express">Express</option>
                  <option value="pickup">Recojo tienda</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-brand-muted pt-1 border-t border-border/60">
            <span>
              Mostrando {paginatedOrders.length} de {filteredOrders.length}{" "}
              {filteredOrders.length === 1
                ? "pedido encontrado"
                : "pedidos encontrados"}
            </span>
            {(statusFilter !== "all" ||
              deliveryFilter !== "all" ||
              searchQuery.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setDeliveryFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-accent font-semibold hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
          </div>
        </div>
      )}

      {/* Estado de Carga */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-brand-secondary">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-xs font-semibold">Cargando tus pedidos...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-4 rounded-card border border-status-danger-border bg-rose-50 text-status-danger-text text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista Vacía Inicial */}
      {!loading && !error && orders.length === 0 && (
        <div className="p-12 text-center bg-surface-card border border-border rounded-card space-y-4">
          <div className="w-14 h-14 rounded-full bg-surface-subtle border border-border text-brand-muted flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-brand-primary">
              Aún no tienes pedidos registrados
            </h2>
            <p className="text-xs text-brand-secondary max-w-sm mx-auto">
              Tus compras realizadas aparecerán aquí con su estado de despacho y
              comprobantes.
            </p>
          </div>
          <Link to="/catalogo">
            <Button
              variant="primary"
              size="md"
              className="bg-accent hover:bg-accent-hover text-white text-xs"
            >
              Explorar Catálogo
            </Button>
          </Link>
        </div>
      )}

      {/* Sin resultados para el filtro */}
      {!loading &&
        !error &&
        orders.length > 0 &&
        filteredOrders.length === 0 && (
          <div className="p-10 text-center bg-surface-card border border-border rounded-card space-y-2">
            <p className="text-sm font-bold text-brand-primary">
              No se encontraron pedidos con los filtros seleccionados
            </p>
            <p className="text-xs text-brand-secondary">
              Prueba cambiando el estado o buscando otro código de orden.
            </p>
          </div>
        )}

      {/* Listado Paginado de Pedidos */}
      {!loading && !error && paginatedOrders.length > 0 && (
        <div className="space-y-4">
          {paginatedOrders.map((order) => {
            const statusInfo =
              STATUS_CONFIG[order.status?.toLowerCase()] ||
              STATUS_CONFIG.received;
            const items = order.order_items || [];
            const totalUnits = items.reduce(
              (acc, curr) => acc + (curr.quantity || 1),
              0
            );

            return (
              <Card
                key={order.id || order.order_number}
                className="hover:border-border-strong transition-all duration-150 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-bold text-brand-primary">
                      {order.order_number}
                    </span>
                    <Badge variant={statusInfo.variant} className="text-[10px]">
                      {statusInfo.label}
                    </Badge>
                    <span className="text-xs text-brand-secondary flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-brand-muted" />
                      {formatDate(order.created_at)}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-brand-secondary">Total:</span>
                    <span className="font-mono text-base font-extrabold text-brand-primary">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-brand-primary flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-accent" />
                      {order.delivery_type === "express"
                        ? "Envío Express"
                        : order.delivery_type === "pickup"
                          ? "Recojo en Tienda"
                          : "Envío Programado"}
                    </p>
                    <p className="text-brand-secondary truncate">
                      {order.delivery_address || "Dirección no especificada"}
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:border-l sm:border-border sm:pl-4">
                    <p className="font-semibold text-brand-primary flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-brand-muted" />
                      {totalUnits} {totalUnits === 1 ? "prenda" : "prendas"} en total
                    </p>
                    <p className="text-[11px] text-brand-muted">
                      Comprobante:{" "}
                      {order.invoice_type?.toLowerCase() === "factura"
                        ? "Factura"
                        : "Boleta"}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-brand-muted">
                    Pago:{" "}
                    {order.payment_method === "culqi_gateway"
                      ? "Culqi Online"
                      : order.payment_method === "yape_plin"
                        ? "Yape / Plin / Transferencia"
                        : "Contra Entrega"}
                  </span>

                  <Link to={`/seguimiento/${order.order_number}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 text-xs bg-accent hover:bg-accent-hover text-white h-8 px-4"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Rastrear Pedido
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}

          {/* Controles de Paginación */}
          {totalPages > 1 && (
            <div className="pt-4 flex items-center justify-between border-t border-border">
              <span className="text-xs text-brand-secondary">
                Página <strong>{safePage}</strong> de{" "}
                <strong>{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={
                        "w-8 h-8 rounded-button text-xs font-mono font-bold border transition-colors " +
                        (pageNum === safePage
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-brand-secondary border-border hover:border-brand-primary")
                      }
                    >
                      {pageNum}
                    </button>
                  )
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="h-8 px-2.5 text-xs"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}