import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../services/supabase";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import {
  getOrderDetail,
  ORDER_STATUS,
  updateOrderStatus,
  getDeliveryStaff,
  assignOrderDelivery,
} from "../services/adminOrders.service";

const transitions = [ORDER_STATUS.RECEIVED, ORDER_STATUS.PREPARING, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];
const labels = { received: "Recibido", en_preparacion: "En preparación", en_camino: "En camino", entregado: "Entregado", cancelado: "Cancelado" };

function money(value) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0)); }

export default function OrderDetailView() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("orders").select("id").eq("order_number", orderNumber).single();
      if (queryError) throw queryError;
      const [detail, staff] = await Promise.all([
        getOrderDetail(data.id),
        getDeliveryStaff().catch(() => []),
      ]);
      setOrder(detail);
      setDeliveryStaff(staff);
    } catch (err) { setError(err.message || "No se pudo cargar el pedido."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: queryError } = await supabase.from("orders").select("id").eq("order_number", orderNumber).single();
        if (queryError) throw queryError;
        const [detail, staff] = await Promise.all([
          getOrderDetail(data.id),
          getDeliveryStaff().catch(() => []),
        ]);
        if (!cancelled) {
          setOrder(detail);
          setDeliveryStaff(staff);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar el pedido.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [orderNumber]);

  useEffect(() => {
    if (!order?.id) return undefined;
    const channel = supabase.channel(`admin-order-${order.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => setOrder((current) => current ? { ...current, ...payload.new } : current)).subscribe();
    return () => supabase.removeChannel(channel);
  }, [order?.id]);

  async function changeStatus(status) {
    if (!order || status === order.status) return;
    if (!window.confirm(`¿Cambiar el estado a ${labels[status]}?`)) return;
    setSaving(true);
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrder((current) => ({ ...current, ...updated }));
      window.alert("Estado actualizado correctamente.");
    } catch (err) { window.alert(err.message || "No se pudo actualizar el estado."); }
    finally { setSaving(false); }
  }

  async function handleAssignDelivery(deliveryId) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await assignOrderDelivery(order.id, deliveryId, order.status);
      setOrder((current) => ({ ...current, ...updated, assigned_delivery_id: deliveryId }));
      window.alert("Repartidor asignado correctamente.");
    } catch (err) {
      window.alert(err.message || "Error al asignar repartidor.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card><p className="text-sm text-brand-secondary">Cargando pedido...</p></Card>;
  if (error) return <Card><p className="text-sm text-status-danger-text">{error}</p><Button variant="outline" size="sm" className="mt-4" onClick={load}>Reintentar</Button></Card>;
  if (!order) return null;

  const profile = order.profiles;
  const address = order.addresses;
  const fiscal = order.invoice_data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => navigate("/admin/pedidos")}><ArrowLeft className="h-4 w-4 mr-1" /> Pedidos</Button><div><p className="text-xs text-brand-secondary">Detalle de pedido</p><h1 className="text-2xl font-black">#{order.order_number}</h1></div></div><Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button></div>

      <Card>
        <CardHeader><CardTitle>Control operativo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <select disabled={saving} value={order.status} onChange={(e) => changeStatus(e.target.value)} className="h-10 px-3 border border-border rounded-button bg-white text-sm">
              {transitions.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
            </select>
            <p className="text-xs text-brand-secondary">El cambio se refleja mediante Supabase Realtime en el seguimiento del cliente.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 pt-4 border-t border-border">
            <label className="text-xs font-bold text-brand-primary">
              Repartidor asignado:
            </label>
            <select
              disabled={saving || order.delivery_type === "pickup"}
              value={order.assigned_delivery_id || ""}
              onChange={(e) => handleAssignDelivery(e.target.value)}
              className="h-10 px-3 border border-border rounded-button bg-white text-sm"
            >
              <option value="">-- Sin asignar --</option>
              {deliveryStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.first_name} {staff.paternal_surname || ""} ({staff.phone || "Sin tel."})
                </option>
              ))}
            </select>
            {order.delivery_type === "pickup" && (
              <span className="text-xs text-brand-muted">
                (Pedido con recojo en tienda, no requiere repartidor)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle>Cliente y despacho</CardTitle></CardHeader><CardContent><Info label="Nombre" value={order.customer_name || [profile?.first_name, profile?.paternal_surname, profile?.maternal_surname].filter(Boolean).join(" ")} /><Info label="DNI" value={profile?.dni} /><Info label="Teléfono" value={order.customer_phone || profile?.phone} /><Info label="Correo" value={order.customer_email || profile?.email} /><Info label="Dirección" value={order.delivery_address || address?.street_address} /><Info label="Referencia" value={address?.reference} /><Info label="Distrito" value={address?.delivery_zones?.district_name} /><Info label="Franja" value={order.scheduled_time_slot} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Datos fiscales y pago</CardTitle></CardHeader><CardContent><Info label="Comprobante" value={order.invoice_type} /><Info label="Documento" value={fiscal.ruc || fiscal.dni || profile?.dni} /><Info label="Razón social" value={fiscal.razonSocial || fiscal.businessName || fiscal.razon_social} /><Info label="Dirección fiscal" value={fiscal.address || fiscal.direccionFiscal} /><Info label="Método de pago" value={order.payment_method} /><Info label="Estado de pago" value={order.payment_status} /><Info label="Operación" value={order.payment_gateway_tx_id} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Resumen</CardTitle></CardHeader><CardContent><Info label="Subtotal" value={money(order.subtotal)} /><Info label="Delivery" value={money(order.delivery_cost)} /><Info label="Total" value={money(order.total_amount)} /><Info label="Creado" value={new Date(order.created_at).toLocaleString("es-PE")} /></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Artículos</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-surface-subtle"><tr><th className="text-left p-3">Producto</th><th className="text-left p-3">Variante</th><th className="text-right p-3">Cantidad</th><th className="text-right p-3">Precio</th><th className="text-right p-3">Subtotal</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id} className="border-t border-border"><td className="p-3"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded overflow-hidden bg-surface-subtle">{item.product_variants?.products?.main_image_url && <img src={item.product_variants.products.main_image_url} alt="" className="w-full h-full object-cover" />}</div><span className="font-semibold">{item.product_variants?.products?.name || "Producto"}</span></div></td><td className="p-3">{item.product_variants?.sizes?.name || "—"} / {item.product_variants?.color || "—"}<div className="text-xs text-brand-muted">SKU: {item.product_variants?.sku || "—"}</div></td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{money(item.unit_price)}</td><td className="p-3 text-right font-bold">{money(item.subtotal)}</td></tr>)}</tbody></table></div></CardContent></Card>
    </div>
  );
}

function Info({ label, value }) { return <div className="py-1.5"><p className="text-[10px] uppercase tracking-wider font-bold text-brand-muted">{label}</p><p className="text-sm text-brand-primary break-words">{value || "—"}</p></div>; }
