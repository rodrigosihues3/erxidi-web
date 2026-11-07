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
  User,
  UserCheck,
  Users,
  UserX,
  RotateCcw,
  Loader2,
  MapPin,
  Zap,
  CalendarClock,
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

function getStageSolid(status) {
  const s = (status || "").toLowerCase();
  if (["entregado", "delivered"].includes(s)) {
    return "bg-status-success-text ring-status-success-border";
  }
  if (["cancelado", "cancelled", "incidencia_transporte"].includes(s)) {
    return "bg-status-danger-text ring-status-danger-border";
  }
  if (
    [
      "en_camino",
      "en_ruta",
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
    return "bg-stage-route-dot ring-stage-route-border";
  }
  if (["en_preparacion", "preparing"].includes(s)) {
    return "bg-stage-prep-dot ring-stage-prep-border";
  }
  return "bg-status-warning-text ring-status-warning-border";
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-semibold text-brand-primary">{children}</h2>
  );
}

function InfoRow({ label, mono = false, wide = false, children }) {
  return (
    <div
      className={`grid items-baseline gap-x-3 ${wide ? "grid-cols-[9rem_1fr]" : "grid-cols-[7.5rem_1fr]"
        }`}
    >
      <dt className="text-xs text-brand-secondary">{label}</dt>
      <dd
        className={`min-w-0 break-words text-sm font-medium text-brand-primary ${mono ? "font-mono" : ""
          }`}
      >
        {children}
      </dd>
    </div>
  );
}

const NAME_LOWER_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function toDisplayName(value) {
  if (!value || typeof value !== "string") return value;
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && NAME_LOWER_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function getOrderAgeInfo(createdAt) {
  if (!createdAt) return null;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return null;
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3600000));
  const text =
    hours < 1
      ? "hace menos de 1 h"
      : hours < 24
        ? `hace ${hours} h`
        : `hace ${Math.floor(hours / 24)} d`;
  const tone = hours >= 168 ? "danger" : hours >= 48 ? "warning" : "neutral";
  return { text, tone };
}

const AGE_TONE_CLASSES = {
  danger:
    "bg-status-danger-bg text-status-danger-text border-status-danger-border",
  warning:
    "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  neutral: "bg-surface-subtle text-brand-secondary border-border",
};

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
                  className={`flex items-center gap-2.5 p-2.5 rounded-button border text-xs cursor-pointer transition-colors ${active
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
                  className={`flex items-center gap-2.5 p-2.5 rounded-button border text-xs cursor-pointer transition-colors ${active
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
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
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

    const isPickupOrder =
      (targetOrder?.delivery_type || order?.delivery_type) === "pickup" ||
      (targetOrder?.delivery_type || order?.delivery_type) === "recojo" ||
      (targetOrder?.shipping_type || order?.shipping_type) === "recojo_tienda" ||
      (targetOrder?.shipping_type || order?.shipping_type) === "recojo" ||
      (targetOrder?.shipping_type || order?.shipping_type) === "pickup";

    const driverObj = isPickupOrder
      ? null
      : driverOverride ||
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
        (isPickupOrder ? "pickup" : "programado"),
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

      const payload = buildEmailPayload(nextOrderState, targetKey);
      if (payload.customerEmail && AUTO_NOTIFICATION_STATUSES.includes(targetKey)) {
        const emailResult = await sendOrderNotificationEmail(payload);
        if (emailResult?.success === false) {
          showToast(
            `Estado actualizado a ${targetStepLabel}. Aviso de correo: ${emailResult.error}`,
          );
        } else {
          showToast(
            `Estado actualizado a ${targetStepLabel} y cliente notificado.`,
          );
        }
      } else {
        showToast(`Estado actualizado a ${targetStepLabel}.`);
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

      const payload = buildEmailPayload(
        nextOrderState,
        "cancelado",
        null,
        reason,
      );
      if (payload.customerEmail) {
        const emailResult = await sendOrderNotificationEmail(payload);
        if (emailResult?.success === false) {
          showToast(
            `Pedido cancelado y stock restituido. Aviso de correo: ${emailResult.error}`,
          );
        } else {
          showToast("Pedido cancelado, stock restituido y cliente notificado.");
        }
      } else {
        showToast("Pedido cancelado y stock restituido.");
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

      const payload = buildEmailPayload(
        nextOrderState,
        "incidente",
        null,
        reason,
      );
      if (payload.customerEmail) {
        const emailResult = await sendOrderNotificationEmail(payload);
        if (emailResult?.success === false) {
          showToast(
            `Incidente operativo registrado. Aviso de correo: ${emailResult.error}`,
          );
        } else {
          showToast("Incidente operativo registrado y cliente notificado.");
        }
      } else {
        showToast("Incidente operativo registrado.");
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
        const actionLabel =
          currentStepKey === "por_asignar"
            ? `Pedido asignado a ${courierName}. Fase actualizada a Asignado.`
            : `Repartidor reasignado a ${courierName}.`;

        const payload = buildEmailPayload(
          nextOrderState,
          "asignado",
          selectedStaff,
        );
        if (payload.customerEmail) {
          const emailResult = await sendOrderNotificationEmail(payload);
          if (emailResult?.success === false) {
            showToast(`${actionLabel} Aviso de correo: ${emailResult.error}`);
          } else {
            showToast(`${actionLabel} Cliente notificado.`);
          }
        } else {
          showToast(actionLabel);
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
      setEmailSentSuccess(true);
      setTimeout(() => {
        setEmailSentSuccess(false);
      }, 2000);
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

  const age = getOrderAgeInfo(order.created_at);
  const totalUnits = (order.items || []).reduce(
    (acc, it) => acc + Number(it.quantity || 0),
    0,
  );

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
            className="text-brand-secondary hover:text-brand-primary focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Pedidos
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-xl font-mono font-bold text-brand-primary">
            {order.order_number
              ? `#${order.order_number}`
              : `#ERX-${order.id?.slice(0, 6)}`}
          </h1>
          <span
            className={`px-2.5 py-0.5 rounded-badge text-xs font-semibold ${getStatusBadgeClass(order.status)}`}
          >
            {currentStepMeta.label}
          </span>
          {hasIncident && order.status !== "incidencia_transporte" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-bg px-2.5 py-0.5 text-xs font-semibold text-status-warning-text">
              <AlertTriangle className="h-3.5 w-3.5" />
              Incidente
            </span>
          )}
          {!isFinishedOrCancelled && age && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${AGE_TONE_CLASSES[age.tone]}`}
            >
              <Clock className="h-3.5 w-3.5" />
              Creado {age.text}
            </span>
          )}
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
              title="Oculta este pedido de la bolsa común de repartidores"
              className="text-brand-primary border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none"
            >
              <Package className="w-3.5 h-3.5 mr-1.5 text-brand-secondary" />
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
            className="text-xs font-semibold text-brand-primary border-border-strong hover:bg-surface-subtle disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-status-warning-text" />
            Reportar incidente
          </Button>

          {/* Cancelar Pedido (Destructivo) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || isFinishedOrCancelled}
            onClick={() => setCancelModalOpen(true)}
            className="text-xs font-semibold text-status-danger-text border-border hover:bg-status-danger-bg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none"
          >
            <Ban className="w-3.5 h-3.5 mr-1.5 text-status-danger-text" />
            Cancelar pedido
          </Button>

          {/* Refrescar Datos */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshOrder}
            disabled={isRefreshing}
            title="Sincronizar datos del pedido"
            aria-label="Sincronizar datos del pedido"
            className="text-brand-primary border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-brand-secondary ${isRefreshing ? "animate-spin" : ""}`}
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
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <SectionTitle>
                  {isPickup
                    ? "Progreso de recojo en tienda"
                    : "Progreso de despacho y entrega"}
                </SectionTitle>
                <p className="text-sm text-brand-secondary mt-0.5">
                  {currentStepMeta.sublabel}
                </p>
              </div>
              <Button
                type="button"
                variant={emailSentSuccess ? "secondary" : "outline"}
                size="sm"
                disabled={isSendingEmail || saving || emailSentSuccess}
                onClick={() => handleSendCustomerEmail(order.status)}
                className={`shrink-0 transition-all duration-300 ${emailSentSuccess
                  ? "bg-brand-primary text-white border-transparent"
                  : ""
                  }`}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-brand-secondary" />
                    <span>Enviando...</span>
                  </>
                ) : emailSentSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-white" />
                    <span>Mensaje enviado</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5 text-brand-secondary transition-transform duration-200 group-hover:translate-x-0.5" />
                    <span>Notificar por email</span>
                  </>
                )}
              </Button>
            </div>

            {/* Barra Horizontal Conectada con los Pasos Dinámicos */}
            <div className="overflow-x-auto mt-5 pt-1.5 pb-1">
              <ol
                className={`min-w-[560px] grid ${isPickup ? "grid-cols-4" : "grid-cols-8"
                  } gap-2`}
              >
                {currentSteps.map((step, idx) => {
                  const isCompleted = !isCancelled && idx < currentStepIndex;
                  const isCurrent = !isCancelled && idx === currentStepIndex;

                  const circleClass = isCompleted
                    ? "bg-status-success-text text-white cursor-pointer disabled:cursor-not-allowed"
                    : isCurrent
                      ? `${getStageSolid(order.status)} text-white ring-4 cursor-default`
                      : "bg-surface-subtle border border-border-strong text-brand-secondary cursor-default";

                  const connectorClass = isCompleted
                    ? "bg-status-success-text"
                    : "bg-border";

                  const labelClass = isCurrent
                    ? "text-brand-primary font-semibold"
                    : isCompleted
                      ? "text-brand-primary"
                      : "text-brand-secondary";

                  const canRevertToThisStep = idx < currentStepIndex;

                  return (
                    <li
                      key={step.key}
                      className="relative flex flex-col items-center text-center"
                    >
                      {idx < currentSteps.length - 1 && (
                        <div
                          className={`absolute top-3 left-1/2 w-full h-px ${connectorClass}`}
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
                        aria-label={`Volver a ${step.label}`}
                        className={`group relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${circleClass}`}
                      >
                        {isCompleted ? (
                          <>
                            <Check
                              className="w-3.5 h-3.5 group-hover:hidden group-focus-visible:hidden"
                              strokeWidth={3}
                            />
                            <RotateCcw
                              className="w-3.5 h-3.5 hidden group-hover:block group-focus-visible:block"
                              strokeWidth={2.5}
                            />
                          </>
                        ) : isCurrent ? (
                          <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                        ) : (
                          <span>{step.stepNumber || idx + 1}</span>
                        )}
                      </button>

                      <span
                        className={`mt-2 text-xs leading-tight px-1 ${labelClass}`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Fila de Control de Transición Inmediata */}
            <div className="mt-4 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-brand-secondary">
                {isCancelled
                  ? "Este pedido fue cancelado y su flujo operativo se encuentra cerrado."
                  : !isPickup && currentStepKey === "por_asignar"
                    ? "Asigna un repartidor especializado para pasar a la fase de entrega."
                    : nextStep
                      ? `Siguiente: ${nextStep.sublabel}`
                      : "El pedido ha completado todas las etapas del flujo."}
              </p>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
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
                      className="text-sm font-semibold px-4 py-2.5 h-auto"
                    >
                      <Users className="w-4 h-4 mr-1.5 text-brand-secondary" />
                      <span>Reasignar Repartidor</span>
                    </Button>
                  )}

                {/* En Fase 3 (Por Asignar) para despacho a domicilio: botón primario especializado */}
                {!isPickup &&
                  !isCancelled &&
                  currentStepKey === "por_asignar" ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setAssignModalOpen(true)}
                    disabled={saving}
                    className="text-sm font-semibold px-5 py-2.5 h-auto"
                  >
                    <UserCheck className="w-4 h-4 mr-1.5" />
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
                      className="text-sm font-semibold px-5 py-2.5 h-auto"
                    >
                      <span>Pasar a: {nextStep.label}</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* 2. Artículos del Pedido (Miniaturas 4:5, Color, Talla) */}
          <Card>
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold text-brand-primary">
                Artículos del pedido
              </CardTitle>
              <span className="text-xs text-brand-secondary">
                <span className="font-mono">{totalUnits}</span>{" "}
                {totalUnits === 1 ? "prenda" : "prendas"}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {(order.items || []).map((item) => {
                const variant = item.product_variants || {};
                const product = variant.products || {};
                const sizeName = variant.sizes?.name || "U";
                const colorName = variant.color || "—";
                const colorHex = variant.color_hex;

                return (
                  <li
                    key={item.id}
                    className="py-4 last:pb-0 flex items-center gap-4"
                  >
                    <div className="w-16 aspect-[4/5] shrink-0 rounded-button border border-border bg-slate-50 p-1 overflow-hidden flex items-center justify-center">
                      {product.main_image_url ? (
                        <img
                          src={product.main_image_url}
                          alt={product.name || "Prenda"}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-brand-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-brand-primary truncate">
                        {product.name || "Producto"}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border border-border bg-surface-subtle text-xs text-brand-primary capitalize">
                          {colorHex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-border-strong shrink-0"
                              style={{ backgroundColor: colorHex }}
                            />
                          )}
                          {colorName}
                        </span>

                        <span className="inline-flex items-center h-6 px-2 rounded-sm border border-border bg-surface-subtle text-xs text-brand-primary">
                          Talla {sizeName}
                        </span>

                        <span className="text-xs font-mono text-brand-secondary">
                          SKU {variant.sku || "—"}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex min-w-[2.75rem] justify-center rounded-button border border-border-strong bg-surface-subtle px-2 py-1 font-mono text-base font-bold text-brand-primary">
                      ×{item.quantity}
                    </span>

                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-mono font-semibold text-brand-primary">
                        {money(item.subtotal)}
                      </p>
                      <p className="text-xs font-mono text-brand-secondary">
                        {money(item.unit_price)} c/u
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* 3. Bitácora de Eventos & Incidentes (Línea de tiempo) */}
          <Card>
            <div className="pb-3 mb-5 border-b border-border">
              <CardTitle className="text-base font-semibold text-brand-primary">
                Bitácora de eventos e incidentes
              </CardTitle>
            </div>

            <ol className="relative ml-1.5 border-l border-border space-y-6">
              {/* Creación del pedido */}
              <li className="relative pl-5">
                <span
                  className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border-strong ring-4 ring-surface-card"
                  aria-hidden="true"
                />
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-brand-primary">
                    Creación del pedido
                  </p>
                  <time className="text-xs font-mono text-brand-secondary shrink-0">
                    {formatDateTime(order.created_at)}
                  </time>
                </div>
              </li>

              {/* Incidente registrado */}
              {hasIncident && (
                <li className="relative pl-5">
                  <span
                    className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-status-warning-text ring-4 ring-surface-card"
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-semibold text-status-warning-text">
                      Reporte de incidente registrado
                    </p>
                    <time className="text-xs font-mono text-brand-secondary shrink-0">
                      {formatDateTime(order.updated_at)}
                    </time>
                  </div>

                  <div className="mt-3 p-3 rounded-card bg-status-warning-bg border border-status-warning-border">
                    <dl className="space-y-2">
                      <InfoRow wide label="Motivo tipificado">
                        {order.incident_reason || "Incidencia operativa"}
                      </InfoRow>
                      <InfoRow wide label="Repartidor involucrado">
                        {driverName || "Sin repartidor asignado"}
                      </InfoRow>
                      {order.incident_comment && (
                        <InfoRow wide label="Observaciones">
                          {order.incident_comment}
                        </InfoRow>
                      )}
                    </dl>

                    {order.status === "incidencia_transporte" && (
                      <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-status-warning-border">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            handleResolveIncident("por_asignar_repartidor")
                          }
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
                        >
                          Regresar a Preparación
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )}

              {/* Última actualización */}
              <li className="relative pl-5">
                <span
                  className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border-strong ring-4 ring-surface-card"
                  aria-hidden="true"
                />
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-brand-primary">
                    Última actualización de estado
                  </p>
                  <time className="text-xs font-mono text-brand-secondary shrink-0">
                    {formatDateTime(order.updated_at)}
                  </time>
                </div>
              </li>
            </ol>

            {!hasIncident && (
              <p className="mt-5 pt-4 border-t border-border flex items-center gap-2 text-sm text-brand-secondary">
                <CheckCircle2 className="w-4 h-4 text-status-success-text shrink-0" />
                <span>Sin incidentes operativos reportados en esta orden.</span>
              </p>
            )}
          </Card>
        </div>

        {/* ===================================================================
            COLUMNA LATERAL (35%): FICHA ÚNICA
           =================================================================== */}
        <div className="min-w-0">
          <Card>
            <div className="divide-y divide-border">
              {/* 1. Resumen Financiero & Pagos */}
              <section className="pb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-base font-semibold text-brand-primary">
                    Resumen financiero y pagos
                  </h3>
                  <Badge variant={isPaid ? "success" : "warning"}>
                    {isPaid ? "Pagado" : "Pendiente"}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-brand-secondary">
                      Subtotal prendas
                    </span>
                    <span className="text-sm font-mono font-medium text-brand-primary">
                      {money(order.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-brand-secondary">
                      Costo de envío
                    </span>
                    <span className="text-sm font-mono font-medium text-brand-primary">
                      {money(order.delivery_cost)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
                  <span className="text-sm font-semibold text-brand-primary">
                    Total general
                  </span>
                  <span className="text-2xl font-mono font-bold text-brand-primary">
                    {money(order.total_amount)}
                  </span>
                </div>

                <dl className="mt-5 space-y-2.5">
                  <InfoRow label="Método de pago">
                    {PAYMENT_METHOD_LABELS[order.payment_method] ||
                      order.payment_method ||
                      "—"}
                  </InfoRow>
                  <InfoRow mono label="N° de operación">
                    <span className="break-all">{operationNumber || "—"}</span>
                    {operationNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(operationNumber);
                          showToast("Número de operación copiado.");
                        }}
                        className="ml-1.5 inline-flex rounded p-1 text-brand-secondary hover:text-brand-primary focus-visible:ring-2 focus-visible:ring-border-strong"
                        title="Copiar número de operación"
                        aria-label="Copiar número de operación"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </InfoRow>
                </dl>

                {/* Botón Condicional: Validar Comprobante vs Descargar comprobante (PDF) */}
                <div className="mt-5">
                  {order.payment_status !== "paid" && currentStepIndex === 0 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setPaymentModalOpen(true)}
                      className="w-full"
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
                      className="w-full"
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
                </div>
              </section>

              {/* 2. Cliente & Despacho */}
              <section className="py-6">
                <h3 className="text-base font-semibold text-brand-primary mb-4">
                  Cliente y despacho
                </h3>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-primary">
                    <User className="h-4 w-4 text-brand-secondary" />
                    Cliente
                  </h4>
                  <dl className="space-y-2.5">
                    <InfoRow label="Nombre">
                      {toDisplayName(customerName)}
                    </InfoRow>
                    <InfoRow label="DNI" mono>
                      {customerDni}
                    </InfoRow>
                    <InfoRow label="Teléfono" mono>
                      {cleanPhone ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span>{customerPhone}</span>
                          <a
                            href={`https://wa.me/51${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-button bg-status-success-bg text-status-success-text border border-status-success-border text-xs font-semibold transition-colors hover:border-status-success-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-text focus-visible:ring-offset-2 font-sans"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat WhatsApp</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </span>
                      ) : (
                        <span className="text-brand-secondary">—</span>
                      )}
                    </InfoRow>
                    <InfoRow label="Correo electrónico">
                      <span className="break-all">
                        {order.customer_email ||
                          order.client_email ||
                          profile?.email ||
                          "cliente@erxidi.pe"}
                      </span>
                    </InfoRow>
                  </dl>
                </div>

                <div className="mt-6">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-primary">
                    <MapPin className="h-4 w-4 text-brand-secondary" />
                    Entrega
                  </h4>
                  <dl className="space-y-2.5">
                    <InfoRow label="Modalidad">
                      {isPickup ? (
                        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-badge border text-xs font-semibold bg-delivery-pickup-bg text-delivery-pickup-text border-delivery-pickup-border">
                          <Store className="w-3.5 h-3.5" /> Recojo en tienda
                        </span>
                      ) : order.shipping_type === "express" ||
                        order.delivery_type === "express" ? (
                        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-badge border text-xs font-semibold bg-delivery-express-bg text-delivery-express-text border-delivery-express-border">
                          <Zap className="w-3.5 h-3.5" /> Delivery express
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-badge border text-xs font-semibold bg-delivery-scheduled-bg text-delivery-scheduled-text border-delivery-scheduled-border">
                          <CalendarClock className="w-3.5 h-3.5" /> Delivery
                          programado
                        </span>
                      )}
                    </InfoRow>
                    <InfoRow label="Dirección">
                      {order.delivery_address ||
                        address?.street_address ||
                        (isPickup ? "Recojo en tienda ERXIDI" : "—")}
                    </InfoRow>
                    {address?.delivery_zones?.district_name && (
                      <InfoRow label="Distrito">
                        {address.delivery_zones.district_name}
                      </InfoRow>
                    )}
                    {address?.reference && (
                      <InfoRow label="Referencia">{address.reference}</InfoRow>
                    )}
                    {order.scheduled_time_slot && (
                      <InfoRow label="Franja horaria" mono>
                        {order.scheduled_time_slot}
                      </InfoRow>
                    )}
                    {!isPickup && (
                      <InfoRow label="Repartidor">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            {driverName ? (
                              <span className="truncate block">
                                {driverName}
                              </span>
                            ) : (
                              <Badge variant="warning" icon={UserX}>
                                Sin asignar (Bolsa común)
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saving || isCancelled}
                            onClick={() => setAssignModalOpen(true)}
                            className="shrink-0"
                          >
                            {assignedDriver ? "Reasignar" : "Asignar"}
                          </Button>
                        </div>
                      </InfoRow>
                    )}
                  </dl>
                </div>
              </section>

              {/* 3. Datos Fiscales (Facturación) */}
              <section className="pt-6">
                <h3 className="text-base font-semibold text-brand-primary mb-4">
                  Datos fiscales
                </h3>

                <dl className="space-y-2.5">
                  <InfoRow label="Tipo de documento">{invoiceTypeLabel}</InfoRow>
                  <InfoRow label="RUC / DNI" mono>
                    {fiscal.tax_id ||
                      fiscal.ruc ||
                      fiscal.dni ||
                      profile?.dni ||
                      "—"}
                  </InfoRow>
                  <InfoRow label="Razón social">
                    {fiscal.legal_name ||
                      fiscal.razonSocial ||
                      fiscal.businessName ||
                      fiscal.razon_social ||
                      customerName}
                  </InfoRow>
                  {(fiscal.fiscal_address ||
                    fiscal.address ||
                    fiscal.direccionFiscal) && (
                      <InfoRow label="Dirección fiscal">
                        {fiscal.fiscal_address ||
                          fiscal.address ||
                          fiscal.direccionFiscal}
                      </InfoRow>
                    )}
                </dl>
              </section>
            </div>
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
        onSuccess={async (updated) => {
          if (
            updated?.status === "cancelado" ||
            updated?.status === "cancelled" ||
            updated?.payment_status === "failed" ||
            updated?.payment_status === "rejected"
          ) {
            setOrder((curr) => ({ ...curr, ...updated }));
            showToast("Comprobante de pago rechazado.");
            return;
          }

          if (updated?.payment_status === "paid") {
            const nextOrderState = {
              ...order,
              ...updated,
              status: "en_preparacion",
              payment_status: "paid",
            };
            setOrder(nextOrderState);

            const payload = buildEmailPayload(nextOrderState, "en_preparacion");
            if (payload.customerEmail) {
              const emailResult = await sendOrderNotificationEmail(payload);
              if (emailResult?.success === false) {
                showToast(
                  `Pago verificado y orden en preparación. Aviso de correo: ${emailResult.error}`,
                );
              } else {
                showToast("Pago verificado y orden en preparación.");
              }
            } else {
              showToast("Pago verificado y orden en preparación.");
            }
          }
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-button bg-brand-primary text-white text-xs font-semibold shadow-dropdown border border-border">
          <CheckCircle2 className="w-4 h-4 text-status-success-border shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
