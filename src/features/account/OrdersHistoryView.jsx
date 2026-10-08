import React, { useEffect, useState } from "react";
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
  ExternalLink,
  ShoppingBag,
  ArrowRight,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";

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
  received: { label: "Recibido", variant: "neutral" },
  pending: { label: "Pendiente", variant: "warning" },
  preparing: { label: "En Preparación", variant: "warning" },
  dispatched: { label: "En Camino", variant: "neutral" },
  nearby: { label: "Cerca de Ti", variant: "warning" },
  delivered: { label: "Entregado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export default function OrdersHistoryView() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">
            Historial de Pedidos
          </h1>
          <p className="text-xs text-brand-secondary mt-1">
            Revisa el detalle de tus compras, comprobantes y realiza seguimiento en tiempo real.
          </p>
        </div>

        <Link to="/mi-cuenta">
          <Button variant="outline" size="sm" className="text-xs">
            Mi Perfil
          </Button>
        </Link>
      </div>

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
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista Vacía */}
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
              Tus compras realizadas aparecerán aquí con su estado de despacho y comprobantes.
            </p>
          </div>
          <Link to="/catalogo">
            <Button variant="primary" size="md" className="bg-accent hover:bg-accent-hover text-white text-xs">
              Explorar Catálogo
            </Button>
          </Link>
        </div>
      )}

      {/* Listado de Pedidos */}
      {!loading && !error && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo =
              STATUS_CONFIG[order.status?.toLowerCase()] || STATUS_CONFIG.received;
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
                {/* Cabecera del Pedido */}
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

                {/* Resumen de Prendas y Despacho */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
                  {/* Despacho (sm:col-span-5) */}
                  <div className="sm:col-span-5 space-y-1.5 border-b sm:border-b-0 sm:border-r border-border pb-3 sm:pb-0 sm:pr-4">
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
                    <p className="text-[11px] text-brand-muted">
                      Comprobante: {order.invoice_type?.toUpperCase() || "BOLETA"}
                    </p>
                  </div>

                  {/* Resumen de Prendas (sm:col-span-7) */}
                  <div className="sm:col-span-7 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-brand-primary flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-brand-muted" />
                        {totalUnits} {totalUnits === 1 ? "prenda" : "prendas"} en total
                      </p>
                      <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                        {items.slice(0, 3).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="flex justify-between text-[11px] text-brand-secondary"
                          >
                            <span className="truncate max-w-[200px]">
                              &bull; {item.product_name || `Prenda #${idx + 1}`} (x{item.quantity})
                            </span>
                            <span className="font-mono font-medium text-brand-primary">
                              {formatCurrency(item.subtotal || item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <p className="text-[10px] text-brand-muted italic">
                            + {items.length - 3} prenda(s) más...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer de Acciones */}
                <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-brand-muted">
                    Pago: {order.payment_method === "culqi_gateway" ? "Culqi Online" : order.payment_method === "yape_plin" ? "Yape / Plin" : "Contra Entrega"}
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
        </div>
      )}
    </div>
  );
}
