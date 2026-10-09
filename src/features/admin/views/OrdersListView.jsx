import { useEffect, useMemo, useState } from "react";
import { Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { useAdminOrders } from "../hooks/useAdminOrders";
import { getDeliveryStaff, assignOrderDelivery } from "../services/adminOrders.service";

const statuses = ["all", "received", "pendiente_pago", "en_preparacion", "en_camino", "entregado", "cancelado"];
const invoices = ["all", "none", "boleta", "factura"];
const payments = ["all", "yape_plin", "culqi_gateway", "transferencia", "tarjeta", "contraentrega", "efectivo"];

const labels = {
  all: "Todos",
  received: "Recibido",
  pendiente_pago: "Pendiente de pago",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
  none: "Sin comprobante",
  boleta: "Boleta",
  factura: "Factura",
};

const PAYMENT_LABELS = {
  yape_plin: "Yape / Plin",
  culqi_gateway: "Culqi (Online)",
  contraentrega: "Contraentrega",
  efectivo: "Contraentrega",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
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

function extractDistrict(address) {
  if (!address) return "—";
  if (address.includes(" - ")) {
    return address.split(" - ").pop().trim();
  }
  return address;
}

export default function OrdersListView() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [invoiceType, setInvoiceType] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [localOrders, setLocalOrders] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const pageSize = 10;
  const filters = useMemo(
    () => ({ page, pageSize, status, invoiceType, paymentMethod, search }),
    [page, status, invoiceType, paymentMethod, search],
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

  async function handleAssignDelivery(order, deliveryId) {
    setUpdatingOrderId(order.id);
    try {
      const updated = await assignOrderDelivery(order.id, deliveryId, order.status);
      const nextStatus =
        updated?.status ||
        (order.status === "received" ? "en_preparacion" : order.status);
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                ...updated,
                assigned_delivery_id: deliveryId || null,
                status: nextStatus,
              }
            : o,
        ),
      );
    } catch (err) {
      window.alert(err.message || "Error al asignar repartidor.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Operación</p>
        <h1 className="text-2xl font-black">Pedidos</h1>
        <p className="text-sm text-brand-secondary mt-1">Consulta, filtra y actualiza el flujo de cada pedido.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-8 h-4 w-4 text-brand-muted" />
              <Input
                label="Buscar"
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Pedido, nombre, email o teléfono"
                className="pl-9"
              />
            </div>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
              Estado
              <select
                value={status}
                onChange={(e) => updateFilter(setStatus, e.target.value)}
                className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"
              >
                {statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
              Comprobante
              <select
                value={invoiceType}
                onChange={(e) => updateFilter(setInvoiceType, e.target.value)}
                className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"
              >
                {invoices.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
              Pago
              <select
                value={paymentMethod}
                onChange={(e) => updateFilter(setPaymentMethod, e.target.value)}
                className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"
              >
                {payments.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "Todos" : formatPaymentMethod(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="p-0 overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-status-danger-text">{error.message}</div>
        ) : loading ? (
          <div className="p-6 text-sm text-brand-secondary">Cargando pedidos...</div>
        ) : localOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-brand-secondary">
            No encontramos pedidos con esos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="text-left p-4">Pedido / Cliente</th>
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Despacho / Zona</th>
                  <th className="text-left p-4">Pago</th>
                  <th className="text-left p-4">Repartidor</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-right p-4">Total</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {localOrders.map((order) => {
                  const type = (order.delivery_type || "").toLowerCase();
                  const isPickup = type === "pickup" || type === "recojo";
                  const isExpress = type === "express";
                  const customerName =
                    order.customer_name ||
                    [order.profiles?.first_name, order.profiles?.paternal_surname]
                      .filter(Boolean)
                      .join(" ") ||
                    "Cliente";
                  const phone = order.customer_phone || order.profiles?.phone || "";

                  return (
                    <tr key={order.id} className="border-t border-border hover:bg-surface-subtle/40">
                      {/* 1. Pedido y Cliente (Fusión) */}
                      <td className="p-4">
                        <p className="font-bold text-brand-primary">#{order.order_number}</p>
                        <p className="text-xs text-brand-secondary mt-0.5">
                          {customerName}
                          {phone ? ` · ${phone}` : ""}
                        </p>
                      </td>

                      {/* 2. Fecha (dd/mm · hh:mm) */}
                      <td className="p-4 text-xs font-mono text-brand-secondary whitespace-nowrap">
                        {formatConciseDate(order.created_at)}
                      </td>

                      {/* 3. Despacho / Zona */}
                      <td className="p-4 text-xs">
                        <div className="space-y-1">
                          {isPickup ? (
                            <Badge variant="neutral">Recojo en Tienda</Badge>
                          ) : isExpress ? (
                            <Badge variant="warning">Express</Badge>
                          ) : (
                            <Badge variant="neutral" className="bg-sky-50 text-sky-800 border-sky-200">
                              Programado
                            </Badge>
                          )}
                          <p className="text-xs font-semibold text-brand-primary">
                            {isPickup ? "Tienda física" : extractDistrict(order.delivery_address)}
                          </p>
                        </div>
                      </td>

                      {/* 4. Pago */}
                      <td className="p-4 text-xs text-brand-primary whitespace-nowrap">
                        {formatPaymentMethod(order.payment_method)}
                      </td>

                      {/* 5. Repartidor (Nueva Columna de Asignación Directa) */}
                      <td className="p-4 text-xs">
                        {isPickup ? (
                          <span className="text-xs text-brand-muted italic whitespace-nowrap">
                            No aplica (Recojo)
                          </span>
                        ) : (
                          <select
                            disabled={updatingOrderId === order.id}
                            value={order.assigned_delivery_id || ""}
                            onChange={(e) => handleAssignDelivery(order, e.target.value)}
                            className="h-8 text-xs border border-border rounded px-2 bg-white text-brand-primary max-w-[170px]"
                          >
                            <option value="">-- Sin asignar --</option>
                            {deliveryStaff.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.first_name} {staff.paternal_surname || ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* 6. Estado y Total */}
                      <td className="p-4 whitespace-nowrap">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-sm whitespace-nowrap">
                        {money(order.total_amount)}
                      </td>

                      {/* 7. Acciones */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/pedidos/${order.order_number}`)}
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
        )}

        <div className="border-t border-border p-4 flex items-center justify-between">
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
            <span className="text-xs font-semibold">
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
      </Card>
    </div>
  );
}
