import { useEffect, useMemo, useState } from "react";
import { ArrowRight, DollarSign, PackageCheck, ShoppingCart, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import Button from "../../../components/ui/Button";
import KpiCard from "../components/KpiCard";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { getDashboardOrders, getOrderItemsForDashboard } from "../services/adminOrders.service";

const PAID_STATUSES = new Set(["pagado", "preparing", "en_preparacion", "dispatched", "en_camino", "nearby", "cerca", "delivered", "entregado"]);

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

export default function DashboardView() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const recent = await getDashboardOrders(30);
        const orderItems = await getOrderItemsForDashboard(recent.map((o) => o.id));
        if (active) {
          setOrders(recent);
          setItems(orderItems);
        }
      } catch (err) {
        if (active) setError(err.message || "No se pudieron cargar las métricas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => {
    const paid = orders.filter((order) => PAID_STATUSES.has(order.status));
    const sales = paid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const pending = orders.filter((order) => !["entregado", "delivered", "cancelado", "cancelled"].includes(order.status)).length;
    const completed = orders.filter((order) => ["entregado", "delivered"].includes(order.status)).length;
    const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const average = paid.length ? sales / paid.length : 0;
    return { sales, pending, completed, units, average };
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

  const deliverySummary = useMemo(() => orders.reduce((acc, order) => {
    const key = ["express"].includes(order.delivery_type) ? "Express" : ["programado", "scheduled"].includes(order.delivery_type) ? "Programado" : "Recojo";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [orders]);

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-56" /><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-32" />)}</div><Skeleton className="h-80" /></div>;

  if (error) return <Card><p className="text-sm text-status-danger-text">{error}</p></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Resumen operativo</p><h1 className="text-2xl font-black text-brand-primary">Dashboard</h1><p className="text-sm text-brand-secondary mt-1">Actividad de los últimos 30 días.</p></div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/pedidos")}>Ver pedidos <ArrowRight className="h-4 w-4 ml-2" /></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Ventas del período" value={money(metrics.sales)} helper="Pedidos pagados o en despacho" icon={DollarSign} />
        <KpiCard title="Pedidos pendientes" value={metrics.pending} helper={`${metrics.completed} completados`} icon={ShoppingCart} />
        <KpiCard title="Ticket promedio" value={money(metrics.average)} helper="Por pedido pagado" icon={TrendingUp} />
        <KpiCard title="Prendas despachadas" value={metrics.units} helper="Unidades en pedidos del período" icon={PackageCheck} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Pedidos recientes</CardTitle></CardHeader>
          <CardContent>
            {orders.slice(0, 5).length === 0 ? <p className="text-sm text-brand-secondary">Todavía no hay pedidos en el período.</p> : <div className="divide-y divide-border">{orders.slice(0, 5).map((order) => <button key={order.id} type="button" onClick={() => navigate(`/admin/pedidos/${order.order_number}`)} className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-subtle px-2 rounded"><div><p className="text-sm font-bold">#{order.order_number}</p><p className="text-xs text-brand-secondary">{order.customer_name || order.customer_email || "Cliente invitado"}</p></div><div className="text-right"><p className="text-sm font-bold">{money(order.total_amount)}</p><OrderStatusBadge status={order.status} /></div></button>)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tipo de entrega</CardTitle></CardHeader>
          <CardContent>
            {Object.entries(deliverySummary).map(([label, count]) => <div key={label} className="flex items-center justify-between py-2"><span className="text-sm text-brand-secondary">{label}</span><span className="text-sm font-bold">{count}</span></div>)}
            {!Object.keys(deliverySummary).length && <p className="text-sm text-brand-secondary">Sin datos.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top 5 prendas por unidades vendidas</CardTitle></CardHeader>
        <CardContent>
          {topProducts.length === 0 ? <p className="text-sm text-brand-secondary">No hay ventas suficientes para mostrar este ranking.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">{topProducts.map((product) => <div key={product.id} className="border border-border rounded-card overflow-hidden"><div className="aspect-square bg-surface-subtle">{product.main_image_url && <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />}</div><div className="p-3"><p className="text-sm font-bold line-clamp-2">{product.name}</p><p className="text-xs text-brand-secondary mt-1">{product.units} unidades</p></div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
