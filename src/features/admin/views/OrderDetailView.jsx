import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Truck,
  Store,
  Package,
  Copy,
  Check,
  FileText,
  Download,
  Send,
  MessageCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  X,
  ExternalLink,
  UserCheck,
  Users,
  RotateCcw,
  Loader2,
  MapPin,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../services/supabase";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Input from "../../../components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../../components/ui/Card";
import OrderPaymentModal from "../components/OrderPaymentModal";
import AssignCourierModal from "../components/AssignCourierModal";
import { handleDownloadFiscalReceipt } from "../services/fiscalReceipt.service";
import {
  sendOrderNotificationEmail,
  AUTO_NOTIFICATION_STATUSES,
} from "../services/orderNotification.service";
import {
  getOrderDetail,
  DELIVERY_STEPS,
  PICKUP_STEPS,
  ORDER_LIFECYCLE_STEPS,
  normalizeStatusToStepKey,
  updateOrderStatus,
  getDeliveryStaff,
  assignOrderDelivery,
  toggleOrderPool,
  reportOrderIncident,
  cancelOrderWithStockRestore,
  resolveOrderIncident,
} from "../services/adminOrders.service";

export { DELIVERY_STEPS, PICKUP_STEPS, ORDER_LIFECYCLE_STEPS };

const CANCEL_REASONS = [
  "Solicitud directa del cliente (dentro del plazo).",
  "Sin cobertura de entrega / Dirección no alcanzable.",
  "Inconsistencia en comprobante de pago.",
  "Quiebre de stock no previsto.",
  "Otro motivo",
];

const INCIDENT_REASONS = [
  "Repartidor no responde / Dispositivo averiado.",
  "Cliente ausente en dirección de entrega.",
  "Accidente en ruta o avería mecánica.",
  "Paquete dañado (requiere re-empaque).",
];

const PAYMENT_METHOD_LABELS = {
  yape_plin: "Yape / Plin",
  culqi_gateway: "Culqi (Online)",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta",
  contraentrega: "Contraentrega",
  efectivo: "Contraentrega (Efectivo)",
};

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadgeClass(status) {
  const s = (status || "").toLowerCase();
  if (["entregado", "delivered"].includes(s)) {
    return "bg-status-success-bg text-status-success-text border border-status-success-border";
  }
  if (["cancelado", "cancelled", "incidencia_transporte"].includes(s)) {
    return "bg-status-danger-bg text-status-danger-text border border-status-danger-border";
  }
  if (
    [
      "en_camino",
      "dispatched",
      "cerca",
      "nearby",
      "en_ubicacion",
      "en_destino",
      "arrived",
      "asignado",
      "listo_recojo",
    ].includes(s)
  ) {
    return "bg-stage-route-bg text-stage-route-dot border border-stage-route-border";
  }
  if (["en_preparacion", "preparing"].includes(s)) {
    return "bg-stage-prep-bg text-stage-prep-dot border border-stage-prep-border";
  }
  return "bg-status-warning-bg text-status-warning-text border border-status-warning-border";
}

function ConfirmJumpModal({
  isOpen,
  targetStep,
  isRevert,
  loading,
  onClose,
  onConfirm,
}) {
  if (!isOpen || !targetStep) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-brand-primary">
            Confirmar cambio a {targetStep.label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-brand-secondary leading-relaxed">
            {isRevert
              ? `¿Regresar el pedido a ${targetStep.label}? Esta acción notificará el cambio de estado en el sistema.`
              : `¿Deseas actualizar el estado operativo de la orden a ${targetStep.label}?`}
          </p>

          <div className="p-3 rounded-button bg-surface-subtle border border-border flex items-center justify-between text-xs">
            <span className="text-brand-secondary font-medium">
              Fase destino:
            </span>
            <span className="font-bold text-brand-primary">
              {targetStep.label} · {targetStep.sublabel}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={loading}
              disabled={loading}
              onClick={onConfirm}
            >
              Confirmar cambio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelOrderModal({ isOpen, loading, onClose, onConfirm }) {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(CANCEL_REASONS[0]);
      setCustomReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCustom = selectedReason === "Otro motivo";

  function handleSubmit() {
    const finalReason = isCustom
      ? customReason.trim() || "Otro motivo"
      : selectedReason;
    onConfirm({
      reason: finalReason,
      comment: isCustom ? customReason.trim() : selectedReason,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-bold text-brand-primary">
              Cancelar Pedido
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-button bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
            Al cancelar, las cantidades de los productos retornarán
            automáticamente al inventario activo.
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-brand-primary">
              Selecciona el motivo de cancelación:
            </p>
            {CANCEL_REASONS.map((reason) => {
              const active = selectedReason === reason;
              return (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-button border text-xs cursor-pointer transition-colors ${
                    active
                      ? "border-rose-400 bg-rose-50/40 text-brand-primary font-semibold"
                      : "border-border bg-surface-card text-brand-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    value={reason}
                    checked={active}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-rose-600"
                  />
                  <span>{reason}</span>
                </label>
              );
            })}
          </div>

          {isCustom && (
            <Input
              label="Especificar otro motivo"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe el motivo de cancelación..."
              autoFocus
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onClose}
            >
              Volver
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={loading}
              disabled={loading || (isCustom && !customReason.trim())}
              onClick={handleSubmit}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirmar Cancelación
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportIncidentModal({ isOpen, loading, onClose, onConfirm }) {
  const [selectedReason, setSelectedReason] = useState(INCIDENT_REASONS[0]);
  const [comment, setComment] = useState("");
  const [returnToPool, setReturnToPool] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(INCIDENT_REASONS[0]);
      setComment("");
      setReturnToPool(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit() {
    onConfirm({
      reason: selectedReason,
      comment: comment.trim(),
      returnToPool,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-brand-primary">
              Reportar Incidente Operativo
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-brand-primary">
              Tipificación del incidente:
            </p>
            {INCIDENT_REASONS.map((reason) => {
              const active = selectedReason === reason;
              return (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-button border text-xs cursor-pointer transition-colors ${
                    active
                      ? "border-amber-400 bg-amber-50/50 text-brand-primary font-semibold"
                      : "border-border bg-surface-card text-brand-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <input
                    type="radio"
                    name="incident_reason"
                    value={reason}
                    checked={active}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-amber-600"
                  />
                  <span>{reason}</span>
                </label>
              );
            })}
          </div>

          <Input
            label="Observaciones adicionales (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Detalle reportado por el repartidor o cliente..."
          />

          <label className="flex items-center gap-2.5 p-3 rounded-button bg-amber-50/60 border border-amber-200 text-xs font-semibold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={returnToPool}
              onChange={(e) => setReturnToPool(e.target.checked)}
              className="accent-amber-600 w-4 h-4"
            />
            <span>Desvincular repartidor y regresar a bolsa común</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={loading}
              disabled={loading}
              onClick={handleSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              Registrar Incidente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailView() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [jumpModal, setJumpModal] = useState({
    isOpen: false,
    targetStep: null,
    isRevert: false,
  });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? "" : curr));
    }, 3500);
  }

  async function fetchOrderData(isManual = false) {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id")
        .eq("order_number", orderNumber)
        .single();
      if (queryError) throw queryError;

      const [detail, staff] = await Promise.all([
        getOrderDetail(data.id),
        getDeliveryStaff().catch(() => []),
      ]);
      setOrder(detail);
      setDeliveryStaff(staff);
      if (isManual) showToast("Datos del pedido sincronizados.");
    } catch (err) {
      setError(err.message || "No se pudo cargar el pedido.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: queryError } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", orderNumber)
          .single();
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
        if (!cancelled) {
          setError(err.message || "No se pudo cargar el pedido.");
        }
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
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) =>
          setOrder((current) => {
            if (!current) return current;
            const merged = { ...current, ...payload.new };
            merged.in_pool =
              merged.status === "por_asignar_repartidor" &&
              !merged.assigned_delivery_id;
            return merged;
          }),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [order?.id]);

  const isPickup = useMemo(() => {
    if (!order) return false;
    const sType = (order.shipping_type || "").toLowerCase();
    const dType = (order.delivery_type || "").toLowerCase();
    return (
      sType === "recojo_tienda" ||
      dType === "pickup" ||
      dType === "recojo" ||
      sType === "recojo" ||
      sType === "pickup"
    );
  }, [order]);

  const currentSteps = useMemo(() => {
    return isPickup ? PICKUP_STEPS : DELIVERY_STEPS;
  }, [isPickup]);

  const currentStepKey = useMemo(() => {
    if (!order) return "recibido";
    return normalizeStatusToStepKey(order.status, isPickup);
  }, [order, isPickup]);

  const currentStepIndex = useMemo(() => {
    const idx = currentSteps.findIndex((s) => s.key === currentStepKey);
    return idx >= 0 ? idx : 0;
  }, [currentSteps, currentStepKey]);

  const currentStepMeta = useMemo(() => {
    if (currentStepKey === "cancelado") {
      return {
        key: "cancelado",
        label: "Cancelado",
        sublabel: "Orden anulada",
      };
    }
    if (currentStepKey === "incidencia_transporte") {
      return {
        key: "incidencia_transporte",
        label: "Incidencia",
        sublabel: "Contingencia en ruta",
      };
    }
    return currentSteps[currentStepIndex] || currentSteps[0];
  }, [currentStepKey, currentSteps, currentStepIndex]);

  const isCancelled = currentStepKey === "cancelado";
  const isFinishedOrCancelled =
    isCancelled ||
    currentStepKey === "entregado" ||
    order?.status === "entregado" ||
    order?.status === "delivered";

  const nextStep = useMemo(() => {
    if (isFinishedOrCancelled || currentStepKey === "incidencia_transporte") {
      return null;
    }
    return currentSteps[currentStepIndex + 1] || null;
  }, [isFinishedOrCancelled, currentStepKey, currentSteps, currentStepIndex]);

  const canToggleBolsa = useMemo(() => {
    if (!order || isPickup) return false;
    return (
      currentStepIndex >= 2 ||
      Boolean(order.has_incident || order.status === "incidencia_transporte")
    );
  }, [order, isPickup, currentStepIndex]);

  function handleRequestJump(stepKey) {
    const targetIdx = currentSteps.findIndex((s) => s.key === stepKey);
    const targetStep = currentSteps[targetIdx];
    if (!targetStep) return;
    setJumpModal({
      isOpen: true,
      targetStep,
      isRevert: targetIdx < currentStepIndex,
    });
  }

  function buildEmailPayload(
    targetOrder,
    statusOverride,
    driverOverride = null,
    reasonOverride = null,
  ) {
    const prof = targetOrder?.profiles || order?.profiles;
    const email =
      targetOrder?.customer_email ||
      targetOrder?.client_email ||
      prof?.email ||
      "";
    const resolvedName =
      targetOrder?.customer_name ||
      [prof?.first_name, prof?.paternal_surname, prof?.maternal_surname]
        .filter(Boolean)
        .join(" ") ||
      "Cliente ERXIDI";

    const driverObj =
      driverOverride ||
      deliveryStaff.find((s) => s.id === targetOrder?.assigned_delivery_id) ||
      targetOrder?.delivery_profile ||
      null;

    const cleanDriverName = driverObj
      ? `${driverObj.first_name || ""} ${String(driverObj.paternal_surname || "").replace(/\[.*?\]/g, "").trim()}`.trim()
      : null;

    const addressObj =
      typeof targetOrder?.delivery_address === "object" &&
      targetOrder?.delivery_address !== null
        ? targetOrder.delivery_address
        : null;
    const formattedAddress = addressObj
      ? [
          addressObj.street || addressObj.address,
          addressObj.district,
          addressObj.city,
        ]
          .filter(Boolean)
          .join(", ")
      : targetOrder?.delivery_address ||
        targetOrder?.shipping_address ||
        "—";

    return {
      orderId: targetOrder?.id,
      orderNumber:
        targetOrder?.order_number ||
        `ERX-${String(targetOrder?.id || "").slice(0, 6)}`,
      customerEmail: email,
      customerName: resolvedName,
      status: statusOverride || targetOrder?.status,
      deliveryType:
        targetOrder?.shipping_type ||
        targetOrder?.delivery_type ||
        "programado",
      deliveryAddress: formattedAddress,
      scheduledTimeSlot: targetOrder?.scheduled_time_slot || null,
      order: targetOrder,
      driverInfo: driverObj
        ? {
            name: cleanDriverName,
            phone: driverObj.phone || "",
            dni: driverObj.dni || "",
          }
        : null,
      incidentReason:
        reasonOverride ||
        targetOrder?.incident_reason ||
        targetOrder?.incident_comment ||
        null,
    };
  }

  async function handleConfirmJump() {
    if (!order || !jumpModal.targetStep) return;
    setSaving(true);
    try {
      const targetKey = jumpModal.targetStep.key;
      const updated = await updateOrderStatus(order.id, targetKey);
      const nextOrderState = { ...order, ...updated };
      setOrder(nextOrderState);
      const targetStepLabel = jumpModal.targetStep.label;
      setJumpModal({ isOpen: false, targetStep: null, isRevert: false });
      showToast(`Estado actualizado a ${targetStepLabel}.`);

      const payload = buildEmailPayload(nextOrderState, targetKey);
      if (payload.customerEmail && AUTO_NOTIFICATION_STATUSES.includes(targetKey)) {
        sendOrderNotificationEmail(payload);
      }
    } catch (err) {
      showToast(err.message || "Error al cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBolsa() {
    if (!order) return;
    setSaving(true);
    try {
      const currentlyInPool = order.in_pool !== false;
      const updated = await toggleOrderPool(order.id, currentlyInPool);
      setOrder((curr) => ({ ...curr, ...updated }));
      showToast(
        updated.in_pool
          ? "Pedido reintegrado a la bolsa común."
          : "Pedido retirado de la bolsa común.",
      );
    } catch (err) {
      showToast(err.message || "No se pudo actualizar el estado en bolsa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshOrder() {
    await fetchOrderData(true);
  }

  async function handleConfirmCancel({ reason, comment }) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await cancelOrderWithStockRestore(order.id, {
        reason,
        comment,
        items: order.items || [],
        previousStatus: order.status,
      });
      const nextOrderState = { ...order, ...updated };
      setOrder(nextOrderState);
      setCancelModalOpen(false);
      showToast("Pedido cancelado y stock restituido.");

      const payload = buildEmailPayload(
        nextOrderState,
        "cancelado",
        null,
        reason,
      );
      if (payload.customerEmail) {
        sendOrderNotificationEmail(payload);
      }
    } catch (err) {
      showToast(err.message || "Error al cancelar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmIncident({ reason, comment, returnToPool }) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await reportOrderIncident(order.id, {
        reason,
        comment,
        returnToPool,
      });
      const nextOrderState = { ...order, ...updated };
      setOrder(nextOrderState);
      setIncidentModalOpen(false);
      showToast("Incidente operativo registrado.");

      const payload = buildEmailPayload(
        nextOrderState,
        "incidente",
        null,
        reason,
      );
      if (payload.customerEmail) {
        sendOrderNotificationEmail(payload);
      }
    } catch (err) {
      showToast(err.message || "Error al reportar incidente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignDelivery(deliveryId) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await assignOrderDelivery(
        order.id,
        deliveryId,
        order.status,
      );
      const selectedStaff = deliveryStaff.find((s) => s.id === deliveryId);
      const courierName = selectedStaff
        ? `${selectedStaff.first_name || ""} ${String(selectedStaff.paternal_surname || "").replace(/\[.*?\]/g, "").trim()}`.trim()
        : null;

      const nextOrderState = {
        ...order,
        ...updated,
        assigned_delivery_id: deliveryId || null,
        delivery_profile: selectedStaff || null,
      };
      setOrder(nextOrderState);
      setAssignModalOpen(false);

      if (deliveryId) {
        if (currentStepKey === "por_asignar") {
          showToast(
            `Pedido asignado a ${courierName}. Fase actualizada a Asignado.`,
          );
        } else {
          showToast(`Repartidor reasignado a ${courierName}.`);
        }
        const payload = buildEmailPayload(
          nextOrderState,
          "asignado",
          selectedStaff,
        );
        if (payload.customerEmail) {
          sendOrderNotificationEmail(payload);
        }
      } else {
        showToast("Repartidor desvinculado. Pedido en bolsa común.");
      }
    } catch (err) {
      showToast(err.message || "Error al asignar repartidor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveIncident(targetStatus) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await resolveOrderIncident(order.id, targetStatus);
      setOrder((curr) => ({
        ...curr,
        ...updated,
        incident_reason: null,
        incident_comment: null,
        in_pool: targetStatus === "por_asignar_repartidor",
      }));
      showToast("Incidencia resuelta.");
    } catch (err) {
      showToast(err.message || "Error al resolver incidencia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCustomerEmail(targetStatus) {
    const payload = buildEmailPayload(order, targetStatus || currentStepKey);
    if (!payload.customerEmail) {
      showToast("El pedido no tiene un correo electrónico asociado.");
      return;
    }
    setIsSendingEmail(true);
    try {
      const res = await sendOrderNotificationEmail(payload);
      if (res && res.success === false) {
        showToast(res.error || "Error al enviar el correo.");
        return;
      }
      showToast("Notificación enviada al cliente para el estado actual.");
    } catch (err) {
      showToast(err.message || "Error al enviar el correo.");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleDownloadReceipt() {
    if (!order) return;
    setIsDownloadingPdf(true);
    try {
      await handleDownloadFiscalReceipt(order);
      showToast("Comprobante fiscal (PDF) descargado.");
    } catch (err) {
      showToast(err.message || "No se pudo sintetizar el comprobante fiscal.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-brand-secondary">Cargando pedido...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-status-danger-text">{error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fetchOrderData(false)}
        >
          Reintentar
        </Button>
      </Card>
    );
  }

  if (!order) return null;

  const profile = order.profiles;
  const address = order.addresses;
  const fiscal = order.invoice_data || {};
  const customerName =
    order.customer_name ||
    [profile?.first_name, profile?.paternal_surname, profile?.maternal_surname]
      .filter(Boolean)
      .join(" ") ||
    "Cliente";
  const customerDni = profile?.dni || fiscal.dni || "—";
  const customerPhone = (order.customer_phone || profile?.phone || "").trim();
  const cleanPhone = customerPhone.replace(/\D/g, "");

  const assignedDriver =
    deliveryStaff.find((s) => s.id === order.assigned_delivery_id) ||
    order.delivery_profile;
  const driverName = assignedDriver
    ? `${assignedDriver.first_name || ""} ${assignedDriver.paternal_surname || ""}`.trim()
    : null;

  const isPaid = order.payment_status === "paid";
  const hasIncident = Boolean(
    order.incident_reason ||
      order.incident_comment ||
      order.status === "incidencia_transporte" ||
      order.has_incident,
  );

  const invoiceTypeLabel =
    order.invoice_type === "factura"
      ? "Factura Electrónica"
      : order.invoice_type === "boleta"
        ? "Boleta de Venta"
        : "Sin comprobante";

  const operationNumber =
    order.operation_number ||
    order.payment_reference ||
    order.payment_gateway_tx_id ||
    "";

  return (
    <div className="space-y-6">
      {/* =====================================================================
          2. BARRA SUPERIOR DE ACCIONES DE CABECERA
         ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        {/* Izquierda: Volver y Código */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/pedidos")}
            className="text-slate-600 hover:text-brand-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Pedidos
          </Button>
          <div className="h-5 w-[1px] bg-border" />
          <h1 className="text-xl font-mono font-black text-brand-primary">
            {order.order_number
              ? `#${order.order_number}`
              : `#ERX-${order.id?.slice(0, 6)}`}
          </h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(order.status)}`}
          >
            {currentStepMeta.label}
          </span>
        </div>

        {/* Derecha: Botonera de Acción */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quitar / Reintegrar Bolsa (Solo delivery con step >= 3 o incidente) */}
          {canToggleBolsa && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || isCancelled}
              onClick={() => handleToggleBolsa()}
              className="text-xs font-semibold text-slate-600 hover:text-brand-primary"
              title="Oculta este pedido de la bolsa común de repartidores"
            >
              <Package className="w-3.5 h-3.5 mr-1" />
              {order.in_pool === false
                ? "Reintegrar a bolsa"
                : "Quitar de bolsa"}
            </Button>
          )}

          {/* Reportar Incidencia Operativa */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || isFinishedOrCancelled}
            onClick={() => setIncidentModalOpen(true)}
            className="text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Reportar incidente
          </Button>

          {/* Cancelar Pedido (Destructivo) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || isFinishedOrCancelled}
            onClick={() => setCancelModalOpen(true)}
            className="text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Cancelar pedido
          </Button>

          {/* Refrescar Datos */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshOrder}
            disabled={isRefreshing}
            className="text-xs"
            title="Sincronizar datos del pedido"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* =====================================================================
          DISTRIBUCIÓN DEL LAYOUT EN DOS COLUMNAS (65% / 35%)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6 items-start">
        {/* ===================================================================
            COLUMNA PRINCIPAL (65%)
           =================================================================== */}
        <div className="space-y-6 min-w-0">
          {/* 1. Stepper Operativo & Controles de Transición */}
          <Card className="bg-white shadow-xs border border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div>
                <CardTitle className="text-sm font-bold text-brand-primary">
                  {isPickup
                    ? "Progreso de Recojo en Tienda"
                    : "Progreso de Despacho y Entrega"}
                </CardTitle>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Fase actual:{" "}
                  <span className="font-bold text-brand-primary">
                    {currentStepMeta.label}
                  </span>{" "}
                  — {currentStepMeta.sublabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSendingEmail || saving}
                onClick={() => handleSendCustomerEmail(order.status)}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-accent" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    <span>Notificar por email</span>
                  </>
                )}
              </Button>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* Barra Horizontal Conectada con los Pasos Dinámicos */}
              <div className="overflow-x-auto pb-2">
                <div
                  className={`min-w-[600px] grid ${
                    isPickup ? "grid-cols-4" : "grid-cols-8"
                  } gap-2 relative`}
                >
                  {currentSteps.map((step, idx) => {
                    const isCompleted =
                      !isCancelled && idx < currentStepIndex;
                    const isCurrent =
                      !isCancelled && idx === currentStepIndex;

                    const circleClass = isCompleted
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : isCurrent
                        ? "bg-amber-500 text-white animate-pulse border-amber-500"
                        : "bg-slate-100 text-slate-400 border-slate-200";

                    const connectorClass = isCompleted
                      ? "bg-emerald-500"
                      : "bg-slate-200";

                    const canRevertToThisStep = idx < currentStepIndex;

                    return (
                      <div
                        key={step.key}
                        className="relative flex flex-col items-center text-center"
                      >
                        {idx < currentSteps.length - 1 && (
                          <div
                            className={`absolute top-4 left-1/2 w-full h-0.5 ${connectorClass}`}
                            aria-hidden="true"
                          />
                        )}

                        <button
                          type="button"
                          disabled={saving || isCancelled || !canRevertToThisStep}
                          onClick={() =>
                            canRevertToThisStep && handleRequestJump(step.key)
                          }
                          title={
                            canRevertToThisStep
                              ? `Regresar a ${step.label}`
                              : isCurrent
                                ? `Fase actual: ${step.label}`
                                : `Fase pendiente: ${step.label}`
                          }
                          className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold transition-transform ${
                            canRevertToThisStep
                              ? "hover:scale-105 cursor-pointer"
                              : "cursor-default"
                          } ${circleClass}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isCurrent ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <span>{step.stepNumber || idx + 1}</span>
                          )}
                        </button>

                        <span
                          className={`mt-2 text-[11px] font-bold leading-tight ${
                            isCurrent
                              ? "text-amber-700"
                              : isCompleted
                                ? "text-brand-primary"
                                : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="text-[10px] text-brand-muted leading-tight mt-0.5 px-1">
                          {step.sublabel}
                        </span>

                        {/* Botón Volver Aquí: estrictamente stepIndex < currentStepIndex */}
                        {canRevertToThisStep && (
                          <button
                            type="button"
                            onClick={() => handleRequestJump(step.key)}
                            className="mt-1.5 text-[10px] text-slate-500 hover:text-brand-primary flex items-center gap-1 font-semibold"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Volver aquí
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel de Acción Inmediata del Estado Actual */}
              <div className="p-4 rounded-card bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                    Control de transición inmediata
                  </span>
                  <p className="text-xs text-brand-secondary">
                    {isCancelled
                      ? "Este pedido fue cancelado y su flujo operativo se encuentra cerrado."
                      : !isPickup && currentStepKey === "por_asignar"
                        ? "Asigna un repartidor especializado para pasar a la fase de entrega."
                        : nextStep
                          ? `Siguiente etapa recomendada: ${nextStep.label} (${nextStep.sublabel}).`
                          : "El pedido ha completado todas las etapas del flujo."}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botón secundario para reasignar repartidor en fases posteriores (Paso 4 en adelante) */}
                  {!isPickup &&
                    !isCancelled &&
                    currentStepIndex >= 3 &&
                    !isFinishedOrCancelled && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => setAssignModalOpen(true)}
                        className="text-xs border-border text-brand-primary font-semibold flex items-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reasignar Repartidor</span>
                      </Button>
                    )}

                  {/* En Fase 3 (Por Asignar) para despacho a domicilio: botón primario especializado */}
                  {!isPickup &&
                  !isCancelled &&
                  currentStepKey === "por_asignar" ? (
                    <Button
                      type="button"
                      onClick={() => setAssignModalOpen(true)}
                      disabled={saving}
                      className="bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2 text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Seleccionar Repartidor y Asignar</span>
                    </Button>
                  ) : (
                    /* En cualquier otra etapa con nextStep */
                    nextStep &&
                    !isCancelled && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleRequestJump(nextStep.key)}
                        className="text-xs font-bold"
                      >
                        <span>Pasar a: {nextStep.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Artículos del Pedido (Miniaturas 4:5, Color, Talla) */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Artículos del Pedido</CardTitle>
              <span className="text-xs font-mono text-brand-secondary">
                {(order.items || []).reduce(
                  (acc, it) => acc + Number(it.quantity || 0),
                  0,
                )}{" "}
                prenda(s)
              </span>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {(order.items || []).map((item) => {
                  const variant = item.product_variants || {};
                  const product = variant.products || {};
                  const sizeName = variant.sizes?.name || "U";
                  const colorName = variant.color || "—";
                  const colorHex = variant.color_hex;

                  return (
                    <div
                      key={item.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="aspect-[4/5] w-14 h-16 shrink-0 rounded border border-border bg-slate-50 p-1 overflow-hidden flex items-center justify-center">
                          {product.main_image_url ? (
                            <img
                              src={product.main_image_url}
                              alt={product.name || "Prenda"}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-bold text-brand-primary truncate">
                            {product.name || "Producto"}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface-subtle border border-border text-xs font-medium text-brand-primary capitalize">
                              {colorHex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                  style={{ backgroundColor: colorHex }}
                                />
                              )}
                              {colorName}
                            </span>

                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-surface-subtle border border-border text-xs font-mono font-semibold text-brand-primary">
                              Talla: {sizeName}
                            </span>

                            <span className="text-xs font-mono text-slate-400">
                              SKU: {variant.sku || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs font-mono text-brand-secondary">
                          <span className="font-bold text-brand-primary">
                            {item.quantity}x
                          </span>{" "}
                          {money(item.unit_price)}
                        </p>
                        <p className="text-sm font-mono font-bold text-brand-primary">
                          {money(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 3. Bitácora de Eventos & Incidentes */}
          <Card>
            <CardHeader>
              <CardTitle>Bitácora de Eventos e Incidentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasIncident ? (
                <div className="p-4 rounded-card bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-amber-900">
                        Reporte de Incidente Registrado
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-800">
                      {formatDateTime(order.updated_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-button border border-amber-200/80">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                        Motivo tipificado
                      </span>
                      <span className="font-bold text-brand-primary">
                        {order.incident_reason || "Incidencia operativa"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                        Repartidor involucrado
                      </span>
                      <span className="font-semibold text-brand-primary">
                        {driverName || "Sin repartidor asignado"}
                      </span>
                    </div>
                    {order.incident_comment && (
                      <div className="sm:col-span-2 pt-2 border-t border-border">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                          Observaciones
                        </span>
                        <p className="text-brand-secondary mt-0.5">
                          {order.incident_comment}
                        </p>
                      </div>
                    )}
                  </div>

                  {order.status === "incidencia_transporte" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          handleResolveIncident("por_asignar_repartidor")
                        }
                        className="text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Reenviar a Bolsa Común
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleResolveIncident("en_preparacion")}
                        className="text-xs"
                      >
                        Regresar a Preparación
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-button bg-surface-subtle border border-border text-xs text-brand-secondary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Sin incidentes operativos reportados en esta orden.
                  </span>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-border text-xs">
                <div className="flex items-center justify-between text-brand-secondary">
                  <span>Creación del pedido</span>
                  <span className="font-mono text-brand-primary">
                    {formatDateTime(order.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-brand-secondary">
                  <span>Última actualización de estado</span>
                  <span className="font-mono text-brand-primary">
                    {formatDateTime(order.updated_at)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===================================================================
            COLUMNA LATERAL (35%)
           =================================================================== */}
        <div className="space-y-6 min-w-0">
          {/* 1. Resumen Financiero & Pagos */}
          <Card>
            <CardHeader className="border-b border-border/80 pb-2.5 mb-3.5 flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-brand-primary">
                Resumen Financiero & Pagos
              </CardTitle>
              <Badge variant={isPaid ? "success" : "warning"}>
                {isPaid ? "Pagado" : "Pendiente"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-brand-secondary">
                  <span>Subtotal prendas</span>
                  <span className="font-mono text-brand-primary font-semibold">
                    {money(order.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-brand-secondary">
                  <span>Costo de envío</span>
                  <span className="font-mono text-brand-primary font-semibold">
                    {money(order.delivery_cost)}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                    Total General
                  </span>
                  <span className="text-lg font-black font-mono text-brand-primary">
                    {money(order.total_amount)}
                  </span>
                </div>
              </div>

              {/* Método de pago */}
              <div className="p-3 rounded-button bg-surface-subtle border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Método de pago:</span>
                  <span className="font-semibold text-brand-primary">
                    {PAYMENT_METHOD_LABELS[order.payment_method] ||
                      order.payment_method ||
                      "—"}
                  </span>
                </div>

                {/* Número de Operación con Copiado Rápido */}
                <div className="flex items-center justify-between py-1.5 px-2.5 bg-white border border-border rounded-button text-xs">
                  <span className="text-slate-500 font-medium">
                    N° Operación:
                  </span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-brand-primary">
                    <span>{operationNumber || "—"}</span>
                    {operationNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(operationNumber);
                          showToast("Número de operación copiado.");
                        }}
                        className="p-1 text-slate-400 hover:text-brand-primary rounded transition-colors"
                        title="Copiar número de operación"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón Condicional: Validar Comprobante vs Descargar comprobante (PDF) */}
              {order.payment_status !== "paid" && currentStepIndex === 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setPaymentModalOpen(true)}
                  className="w-full text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span>Validar Comprobante / Voucher</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingPdf}
                  onClick={handleDownloadReceipt}
                  className="w-full text-xs font-semibold text-brand-primary hover:bg-surface-subtle"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-brand-secondary" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-brand-secondary" />
                  )}
                  <span>
                    {isDownloadingPdf
                      ? "Generando comprobante (PDF)..."
                      : "Descargar comprobante (PDF)"}
                  </span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 2. Ficha de Cliente & Despacho */}
          <Card>
            <CardHeader className="border-b border-border/80 pb-2.5 mb-3.5">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-brand-primary">
                Cliente & Despacho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                    Cliente
                  </span>
                  <p className="text-sm font-bold text-brand-primary">
                    {customerName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                      DNI
                    </span>
                    <span className="font-mono font-semibold text-brand-primary">
                      {customerDni}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                      Teléfono / WhatsApp
                    </span>
                    {cleanPhone ? (
                      <div className="mt-1">
                        <a
                          href={`https://wa.me/51${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-colors shadow-2xs"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600 fill-emerald-600/10" />
                          <span>Chat WhatsApp</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-brand-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Correo Electrónico Formal */}
                <div className="pt-2 border-t border-border/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Correo electrónico
                  </span>
                  <p className="text-xs font-medium text-brand-primary truncate mt-0.5">
                    {order.customer_email ||
                      order.client_email ||
                      profile?.email ||
                      "cliente@erxidi.pe"}
                  </p>
                </div>
              </div>

              {/* Ficha de Despacho */}
              <div className="p-3 rounded-button bg-surface-subtle border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-secondary" />
                    Modalidad de entrega
                  </span>

                  {/* Distintivo Claro de Tipo de Entrega */}
                  <div className="inline-flex items-center gap-1.5">
                    {isPickup ? (
                      <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs">
                        <Store className="w-3.5 h-3.5" /> Recojo en Tienda
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs">
                        <Truck className="w-3.5 h-3.5" /> Delivery{" "}
                        {order.shipping_type === "express" ||
                        order.delivery_type === "express"
                          ? "Express"
                          : "Programado"}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs font-bold text-brand-primary leading-snug">
                  {order.delivery_address ||
                    address?.street_address ||
                    (isPickup ? "Recojo en tienda ERXIDI" : "—")}
                </p>

                {address?.delivery_zones?.district_name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-muted">Distrito:</span>
                    <span className="font-semibold text-brand-primary">
                      {address.delivery_zones.district_name}
                    </span>
                  </div>
                )}

                {address?.reference && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                      Referencia
                    </span>
                    <p className="text-xs font-medium text-brand-primary">
                      {address.reference}
                    </p>
                  </div>
                )}

                {order.scheduled_time_slot && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-brand-muted">Franja horaria:</span>
                    <span className="font-mono font-semibold text-brand-primary">
                      {order.scheduled_time_slot}
                    </span>
                  </div>
                )}
              </div>

              {!isPickup && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                      Repartidor asignado
                    </span>
                    <span className="font-semibold text-brand-primary flex items-center gap-1.5 mt-0.5">
                      <Truck className="w-3.5 h-3.5 text-brand-secondary" />
                      {driverName || "Sin asignar (Bolsa común)"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || isCancelled}
                    onClick={() => setAssignModalOpen(true)}
                    className="text-xs"
                  >
                    {assignedDriver ? "Reasignar" : "Asignar"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Datos Fiscales (Facturación) */}
          <Card>
            <CardHeader className="border-b border-border/80 pb-2.5 mb-3.5">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-brand-primary">
                Datos Fiscales (Facturación)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Tipo de documento:</span>
                <span className="font-bold text-brand-primary uppercase">
                  {invoiceTypeLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">RUC / DNI:</span>
                <span className="font-mono font-semibold text-brand-primary">
                  {fiscal.tax_id ||
                    fiscal.ruc ||
                    fiscal.dni ||
                    profile?.dni ||
                    "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-muted shrink-0">Razón Social:</span>
                <span className="font-semibold text-brand-primary text-right break-words">
                  {fiscal.legal_name ||
                    fiscal.razonSocial ||
                    fiscal.businessName ||
                    fiscal.razon_social ||
                    customerName}
                </span>
              </div>
              {(fiscal.fiscal_address ||
                fiscal.address ||
                fiscal.direccionFiscal) && (
                <div className="pt-2 border-t border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                    Dirección Fiscal
                  </span>
                  <p className="text-brand-primary mt-0.5">
                    {fiscal.fiscal_address ||
                      fiscal.address ||
                      fiscal.direccionFiscal}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* =====================================================================
          MODALES DE CONFIRMACIÓN Y CONTINGENCIA
         ===================================================================== */}
      <ConfirmJumpModal
        isOpen={jumpModal.isOpen}
        targetStep={jumpModal.targetStep}
        isRevert={jumpModal.isRevert}
        loading={saving}
        onClose={() =>
          setJumpModal({ isOpen: false, targetStep: null, isRevert: false })
        }
        onConfirm={handleConfirmJump}
      />

      <CancelOrderModal
        isOpen={cancelModalOpen}
        loading={saving}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      <ReportIncidentModal
        isOpen={incidentModalOpen}
        loading={saving}
        onClose={() => setIncidentModalOpen(false)}
        onConfirm={handleConfirmIncident}
      />

      <AssignCourierModal
        isOpen={assignModalOpen}
        currentDriverId={order.assigned_delivery_id}
        orderDeliveryType={order.shipping_type || order.delivery_type}
        deliveryStaff={deliveryStaff}
        loading={saving}
        onClose={() => setAssignModalOpen(false)}
        onConfirm={handleAssignDelivery}
        onCouriersChange={setDeliveryStaff}
      />

      <OrderPaymentModal
        order={order}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={(updated) => {
          const nextOrderState = {
            ...order,
            ...updated,
            status: "en_preparacion",
            payment_status: "paid",
          };
          setOrder(nextOrderState);
          showToast("Pago verificado y orden en preparación.");
          const payload = buildEmailPayload(nextOrderState, "en_preparacion");
          if (payload.customerEmail) {
            sendOrderNotificationEmail(payload);
          }
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-button bg-brand-primary text-white text-xs font-semibold shadow-dropdown border border-border">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
