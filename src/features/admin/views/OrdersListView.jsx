import { useMemo, useState } from "react";
import { Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { useAdminOrders } from "../hooks/useAdminOrders";

const statuses = ["all", "received", "pendiente_pago", "en_preparacion", "en_camino", "entregado", "cancelado"];
const invoices = ["all", "none", "boleta", "factura"];
const payments = ["all", "yape_plin", "culqi_gateway", "transferencia", "tarjeta", "contraentrega", "efectivo"];

const labels = { all: "Todos", received: "Recibido", pendiente_pago: "Pendiente de pago", en_preparacion: "En preparación", en_camino: "En camino", entregado: "Entregado", cancelado: "Cancelado", none: "Sin comprobante", boleta: "Boleta", factura: "Factura" };

function money(value) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0)); }

export default function OrdersListView() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [invoiceType, setInvoiceType] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const pageSize = 10;
  const filters = useMemo(() => ({ page, pageSize, status, invoiceType, paymentMethod, search }), [page, status, invoiceType, paymentMethod, search]);
  const { data, count, loading, error } = useAdminOrders(filters);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  function updateFilter(setter, value) { setter(value); setPage(1); }

  return (
    <div className="space-y-6">
      <div><p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Operación</p><h1 className="text-2xl font-black">Pedidos</h1><p className="text-sm text-brand-secondary mt-1">Consulta, filtra y actualiza el flujo de cada pedido.</p></div>
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative"><Search className="absolute left-3 top-8 h-4 w-4 text-brand-muted" /><Input label="Buscar" value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} placeholder="Pedido, nombre, email o teléfono" className="pl-9" /></div>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Estado<select value={status} onChange={(e) => updateFilter(setStatus, e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm">{statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Comprobante<select value={invoiceType} onChange={(e) => updateFilter(setInvoiceType, e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm">{invoices.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Pago<select value={paymentMethod} onChange={(e) => updateFilter(setPaymentMethod, e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm">{payments.map((item) => <option key={item} value={item}>{item === "all" ? "Todos" : item}</option>)}</select></label>
          </div>
        </CardContent>
      </Card>

      <Card className="p-0 overflow-hidden">
        {error ? <div className="p-6 text-sm text-status-danger-text">{error.message}</div> : loading ? <div className="p-6 text-sm text-brand-secondary">Cargando pedidos...</div> : data.length === 0 ? <div className="p-10 text-center text-sm text-brand-secondary">No encontramos pedidos con esos filtros.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-surface-subtle"><tr><th className="text-left p-4">Pedido</th><th className="text-left p-4">Cliente</th><th className="text-left p-4">Fecha</th><th className="text-left p-4">Entrega</th><th className="text-left p-4">Pago</th><th className="text-left p-4">Estado</th><th className="text-right p-4">Total</th><th className="p-4" /></tr></thead><tbody>{data.map((order) => <tr key={order.id} className="border-t border-border"><td className="p-4 font-bold">#{order.order_number}</td><td className="p-4"><p className="font-semibold">{order.customer_name || "Cliente"}</p><p className="text-xs text-brand-secondary">{order.customer_email || order.customer_phone || "—"}</p></td><td className="p-4 text-xs text-brand-secondary">{new Date(order.created_at).toLocaleString("es-PE")}</td><td className="p-4 text-xs">{order.delivery_type}</td><td className="p-4 text-xs">{order.payment_method}</td><td className="p-4"><OrderStatusBadge status={order.status} /></td><td className="p-4 text-right font-bold">{money(order.total_amount)}</td><td className="p-4 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/admin/pedidos/${order.order_number}`)}><Eye className="h-4 w-4 mr-1" /> Ver</Button></td></tr>)}</tbody></table></div>}
        <div className="border-t border-border p-4 flex items-center justify-between"><p className="text-xs text-brand-secondary">{count} pedido(s)</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="text-xs font-semibold">Página {page} / {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button></div></div>
      </Card>
    </div>
  );
}
