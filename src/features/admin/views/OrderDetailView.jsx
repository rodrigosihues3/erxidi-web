import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertOctagon, PackageCheck, RotateCcw, MessageCircle } from "lucide-react";
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
  verifyOrderPayment,
  markOrderReadyForDelivery,
  resolveOrderIncident,
} from "../services/adminOrders.service";

const transitions = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_DELIVERY,
  ORDER_STATUS.DISPATCHED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.INCIDENT,
];

const labels = {
  received: "Recibido",
  en_preparacion: "En preparación",
  por_asignar_repartidor: "Por asignar repartidor",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
  incidencia_transporte: "Incidencia en reparto",
};

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

export default function OrderDetailView() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase.from("orders").select("id").eq("order_number", orderNumber).single();
      if (queryError) throw queryError;
      const [detail, staff] = await Promise.all([
        getOrderDetail(data.id),
        getDeliveryStaff().catch(() => []),
      ]);
      setOrder(detail);
      setDeliveryStaff(staff);
    } catch (err) {
      setError(err.message || "No se pudo cargar el pedido.");
    } finally {
      setLoading(false);
    }
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
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  useEffect(() => {
    if (!order?.id) return undefined;
    const channel = supabase
      .channel(`admin-order-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => setOrder((current) => (current ? { ...current, ...payload.new } : current)),
      )
      .subscribe();
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
    } catch (err) {
      window.alert(err.message || "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
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

  async function handleVerifyPayment() {
    if (!window.confirm("¿Confirmar que el abono o voucher fue verificado en cuenta y pasar a preparación?")) return;
    setSaving(true);
    try {
      const updated = await verifyOrderPayment(order.id);
      setOrder((current) => ({ ...current, ...updated }));
      window.alert("Pago verificado. Pedido listo para empaque.");
    } catch (err) {
      window.alert(err.message || "Error al verificar el pago.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendToPool() {
    setSaving(true);
    try {
      const updated = await markOrderReadyForDelivery(order.id);
      setOrder((current) => ({ ...current, ...updated }));
      window.alert("Pedido marcado como Empacado y disponible en la bolsa de reparto.");
    } catch (err) {
      window.alert(err.message || "Error al enviar pedido a la bolsa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveIncident(targetStatus) {
    setSaving(true);
    try {
      const updated = await resolveOrderIncident(order.id, targetStatus);
      setOrder((current) => ({ ...current, ...updated }));
      window.alert("Incidencia gestionada correctamente.");
    } catch (err) {
      window.alert(err.message || "Error al gestionar incidencia.");
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
  const isPickup = (order.delivery_type || "").toLowerCase() === "pickup";
  const customerPhone = order.customer_phone || profile?.phone;

  const whatsappClientUrl = customerPhone
    ? `https://wa.me/51${customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
      `Hola ${order.customer_name || "Cliente"}, te escribimos de ERXIDI respecto a tu pedido #${order.order_number}.`,
    )}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/pedidos")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pedidos
          </Button>
          <div>
            <p className="text-xs text-brand-secondary">Detalle de pedido</p>
            <h1 className="text-2xl font-black">#{order.order_number}</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* BANNER DE ALERTA: INCIDENCIA EN TRANSPORTE */}
      {order.status === "incidencia_transporte" && (
        <Card className="border-rose-300 bg-rose-50/70">
          <CardHeader>
            <CardTitle className="text-rose-900 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-600" /> Incidencia Reportada en Ruta de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-rose-950">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-rose-200">
              <div>
                <span className="font-bold text-slate-500 block">Motivo Tipificado:</span>
                <span className="font-black text-rose-700 text-sm">
                  {order.incident_reason || "No especificado"}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block">Detalle del Repartidor:</span>
                <span className="font-medium text-slate-800 italic">
                  &ldquo;{order.incident_comment || "Sin comentarios adicionales"}&rdquo;
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {whatsappClientUrl && (
                <a
                  href={whatsappClientUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contactar al cliente por WhatsApp</span>
                </a>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={() => handleResolveIncident("por_asignar_repartidor")}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Reenviar a Bolsa de Reparto
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleResolveIncident("en_preparacion")}
              >
                Regresar a Preparación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CONTROL OPERATIVO */}
      <Card>
        <CardHeader><CardTitle>Control operativo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-brand-primary">Estado actual:</label>
              <select
                disabled={saving}
                value={order.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="h-10 px-3 border border-border rounded-button bg-white text-sm font-semibold"
              >
                {transitions.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
              </select>
            </div>

            {/* BOTONES DE ACCIÓN RÁPIDA DE FLUJO */}
            <div className="flex items-center gap-2">
              {order.payment_status === "pending_verification" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  onClick={handleVerifyPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>Aprobar Pago ({order.payment_gateway_tx_id || "Sin N°"})</span>
                </Button>
              )}

              {order.status === "en_preparacion" && !isPickup && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  onClick={handleSendToPool}
                  className="bg-brand-primary hover:bg-slate-800 text-white"
                >
                  <PackageCheck className="w-4 h-4 mr-1.5" />
                  <span>Empaque Listo / Enviar a Bolsa</span>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-border">
            <label className="text-xs font-bold text-brand-primary">
              Repartidor asignado:
            </label>
            <select
              disabled={saving || isPickup}
              value={order.assigned_delivery_id || ""}
              onChange={(e) => handleAssignDelivery(e.target.value)}
              className="h-10 px-3 border border-border rounded-button bg-white text-sm"
            >
              <option value="">-- Sin asignar (En bolsa común) --</option>
              {deliveryStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.first_name} {staff.paternal_surname || ""} ({staff.phone || "Sin tel."})
                </option>
              ))}
            </select>
            {isPickup && (
              <span className="text-xs text-brand-muted">
                (Pedido con recojo en tienda, no requiere repartidor)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Cliente y despacho</CardTitle></CardHeader>
          <CardContent>
            <Info label="Nombre" value={order.customer_name || [profile?.first_name, profile?.paternal_surname, profile?.maternal_surname].filter(Boolean).join(" ")} />
            <Info label="DNI" value={profile?.dni} />
            <Info label="Teléfono" value={order.customer_phone || profile?.phone} />
            <Info label="Correo" value={order.customer_email || profile?.email} />
            <Info label="Dirección" value={order.delivery_address || address?.street_address} />
            <Info label="Referencia" value={address?.reference} />
            <Info label="Distrito" value={address?.delivery_zones?.district_name} />
            <Info label="Franja" value={order.scheduled_time_slot} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Datos fiscales y pago</CardTitle></CardHeader>
          <CardContent>
            <Info label="Comprobante" value={order.invoice_type} />
            <Info label="Documento" value={fiscal.tax_id || fiscal.ruc || fiscal.dni || profile?.dni} />
            <Info label="Razón social" value={fiscal.legal_name || fiscal.razonSocial || fiscal.businessName || fiscal.razon_social} />
            <Info label="Dirección fiscal" value={fiscal.fiscal_address || fiscal.address || fiscal.direccionFiscal} />
            <Info label="Método de pago" value={order.payment_method} />
            <Info label="Estado de pago" value={order.payment_status} />
            <Info label="N° Operación / Voucher" value={order.payment_gateway_tx_id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
          <CardContent>
            <Info label="Subtotal" value={money(order.subtotal)} />
            <Info label="Delivery" value={money(order.delivery_cost)} />
            <Info label="Total" value={money(order.total_amount)} />
            <Info label="Creado" value={new Date(order.created_at).toLocaleString("es-PE")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Artículos del Pedido</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-left p-3">Variante</th>
                  <th className="text-right p-3">Cantidad</th>
                  <th className="text-right p-3">Precio</th>
                  <th className="text-right p-3">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded overflow-hidden bg-surface-subtle">
                          {item.product_variants?.products?.main_image_url && (
                            <img
                              src={item.product_variants.products.main_image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <span className="font-semibold">{item.product_variants?.products?.name || "Producto"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {item.product_variants?.sizes?.name || "—"} / {item.product_variants?.color || "—"}
                      <div className="text-xs text-brand-muted">SKU: {item.product_variants?.sku || "—"}</div>
                    </td>
                    <td className="p-3 text-right font-mono">{item.quantity}</td>
                    <td className="p-3 text-right font-mono">{money(item.unit_price)}</td>
                    <td className="p-3 text-right font-mono font-bold">{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="py-1.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-brand-muted">{label}</p>
      <p className="text-sm text-brand-primary break-words">{value || "—"}</p>
    </div>
  );
}