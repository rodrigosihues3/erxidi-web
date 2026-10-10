import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  DollarSign,
  PackageCheck,
  ShoppingCart,
  Zap,
  Calendar,
  Store,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import KpiCard from "../components/KpiCard";
import OrderStatusBadge from "../components/OrderStatusBadge";
import {
  getDashboardOrders,
  getImmediateDispatchOrders,
  getOrderItemsForDashboard,
  calculateDashboardSales,
} from "../services/adminOrders.service";

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function formatCompactTime(dateString) {
  if (!dateString) return "--:--";
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export default function DashboardView() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("today");
  const [orders, setOrders] = useState([]);
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [dispatchFilter, setDispatchFilter] = useState("all"); // 'all' | 'express' | 'scheduled' | 'pickup'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [recent, dispatchList] = await Promise.all([
          getDashboardOrders(timeRange),
          getImmediateDispatchOrders(),
        ]);
        const orderItems = await getOrderItemsForDashboard(recent.map((o) => o.id));
        if (active) {
          setOrders(recent);
          setDispatchOrders(dispatchList);
          setItems(orderItems);
        }
      } catch (err) {
        if (active) setError(err.message || "No se pudieron cargar las métricas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [timeRange]);

  const metrics = useMemo(() => {
    const sales = calculateDashboardSales(orders);
    // Pedidos por Despachar: conteo de pedidos en 'received' y 'en_preparacion'
    const pendingDispatch = orders.filter((order) =>
      ["received", "en_preparacion"].includes(order.status),
    ).length;
    // Prendas vendidas / despachadas: conteo acumulado de unidades físicas
    const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return { sales, pendingDispatch, units };
  }, [orders, items]);

  const topProducts = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const product = item.product_variants?.products;
      if (!product) continue;
      const current = map.get(product.id) || { ...product, units: 0 };
      current.units += Number(item.quantity || 0);
      map.set(product.id, current);
    }
    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  }, [items]);

  // Conteo de pedidos por modalidad en la Cola de Despacho Inmediato
  const dispatchCounts = useMemo(() => {
    const counts = { all: dispatchOrders.length, express: 0, scheduled: 0, pickup: 0 };
    dispatchOrders.forEach((o) => {
      const type = String(o.delivery_type || "").toLowerCase();
      if (type === "express") counts.express += 1;
      else if (type === "scheduled" || type === "programado") counts.scheduled += 1;
      else if (type === "pickup" || type === "recojo") counts.pickup += 1;
      else counts.scheduled += 1;
    });
    return counts;
  }, [dispatchOrders]);

  // Lista filtrada en memoria para la Cola de Despacho Inmediato
  const filteredDispatchOrders = useMemo(() => {
    if (dispatchFilter === "all") return dispatchOrders;
    return dispatchOrders.filter((o) => {
      const type = String(o.delivery_type || "").toLowerCase();
      if (dispatchFilter === "express") return type === "express";
      if (dispatchFilter === "scheduled") return type === "scheduled" || type === "programado";
      if (dispatchFilter === "pickup") return type === "pickup" || type === "recojo";
      return true;
    });
  }, [dispatchOrders, dispatchFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) return <Card><p className="text-sm text-status-danger-text p-4">{error}</p></Card>;

  return (
    <div className="space-y-6">
      {/* Encabezado Operativo */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Resumen operativo</p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-black text-brand-primary">Dashboard</h1>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="h-9 px-3 border border-border rounded-button bg-white text-xs font-semibold text-brand-primary cursor-pointer"
            >
              <option value="today">Hoy (desde las 00:00)</option>
              <option value="7days">Últimos 7 días</option>
              <option value="30days">Últimos 30 días</option>
              <option value="all">Todo el historial</option>
            </select>
          </div>
          <p className="text-sm text-brand-secondary mt-1">
            {timeRange === "today"
              ? "Actividad del día local actual."
              : timeRange === "7days"
              ? "Actividad de los últimos 7 días."
              : timeRange === "30days"
              ? "Actividad de los últimos 30 días."
              : "Actividad histórica acumulada."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/pedidos")}>
          Ver todos los pedidos <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Fila Superior (Exactamente 3 KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Ventas del período"
          value={money(metrics.sales)}
          helper="Pedidos activos (no cancelados)"
          icon={DollarSign}
        />
        <KpiCard
          title="Pedidos por despachar"
          value={metrics.pendingDispatch}
          helper="En estado recibido o en preparación"
          icon={ShoppingCart}
        />
        <KpiCard
          title="Prendas vendidas / despachadas"
          value={metrics.units}
          helper="Unidades físicas en el período"
          icon={PackageCheck}
        />
      </div>

      {/* Fila Central: Cola de Despacho Inmediato a Ancho Completo */}
      <Card className="w-full col-span-full">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <CardTitle className="text-base font-bold text-brand-primary">
              Cola de Despacho Inmediato
            </CardTitle>
            <CardDescription className="text-xs text-brand-secondary mt-0.5">
              Pedidos pendientes de asignación o preparación
            </CardDescription>
          </div>

          {/* Mini-chips / Pestañas de filtro */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDispatchFilter("all")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                dispatchFilter === "all"
                  ? "bg-brand-primary text-white"
                  : "bg-surface-subtle text-brand-secondary hover:text-brand-primary border border-border"
              }`}
            >
              <span>Todos</span>
              <span className="font-mono text-[11px] opacity-80">({dispatchCounts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => setDispatchFilter("express")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                dispatchFilter === "express"
                  ? "bg-amber-500 text-white"
                  : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Express</span>
              <span className="font-mono text-[11px]">({dispatchCounts.express})</span>
            </button>

            <button
              type="button"
              onClick={() => setDispatchFilter("scheduled")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                dispatchFilter === "scheduled"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Programado</span>
              <span className="font-mono text-[11px]">({dispatchCounts.scheduled})</span>
            </button>

            <button
              type="button"
              onClick={() => setDispatchFilter("pickup")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                dispatchFilter === "pickup"
                  ? "bg-slate-700 text-white"
                  : "bg-surface-subtle text-brand-secondary border border-border hover:bg-slate-200"
              }`}
            >
              <Store className="w-3 h-3" />
              <span>Tienda</span>
              <span className="font-mono text-[11px]">({dispatchCounts.pickup})</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredDispatchOrders.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <p className="text-xs text-brand-secondary font-medium">
                No hay pedidos pendientes de despacho en este momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle text-brand-secondary font-semibold border-b border-border text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Pedido / Cliente</th>
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Modalidad</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDispatchOrders.map((order) => {
                    const isExpress = order.delivery_type === "express";
                    const isPickup =
                      order.delivery_type === "pickup" || order.delivery_type === "recojo";

                    return (
                      <tr key={order.id} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-brand-primary">
                            #{order.order_number}
                          </p>
                          <p className="text-[11px] text-brand-secondary truncate max-w-[200px]">
                            {order.customer_name || order.customer_email || "Cliente invitado"}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-brand-secondary whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-brand-muted" />
                            {formatCompactTime(order.created_at)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isExpress ? (
                            <Badge variant="warning" className="text-[10px] gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              Express
                            </Badge>
                          ) : isPickup ? (
                            <Badge variant="neutral" className="text-[10px] gap-1">
                              <Store className="w-2.5 h-2.5" />
                              Recojo
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px] gap-1 border-blue-200 bg-blue-50 text-blue-900">
                              <Calendar className="w-2.5 h-2.5 text-blue-700" />
                              Programado
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <OrderStatusBadge status={order.status} />
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-primary whitespace-nowrap">
                          {money(order.total_amount)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/pedidos/${order.order_number}`)}
                            className="text-xs h-7 px-2.5 bg-surface-card hover:bg-surface-subtle"
                          >
                            <span>Atender</span>
                            <ExternalLink className="w-3 h-3 ml-1 text-accent" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fila Inferior: Top 5 prendas por unidades vendidas */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 prendas por unidades vendidas</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-brand-secondary">
              No hay ventas suficientes para mostrar este ranking.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topProducts.map((product) => (
                <div key={product.id} className="border border-border rounded-card overflow-hidden">
                  <div className="aspect-square bg-surface-subtle">
                    {product.main_image_url && (
                      <img
                        src={product.main_image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold line-clamp-2">{product.name}</p>
                    <p className="text-xs text-brand-secondary mt-1">{product.units} unidades</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
