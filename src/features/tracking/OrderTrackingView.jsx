import React, { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  PackageCheck,
  Package,
  Truck,
  Navigation,
  MapPin,
  CheckCircle2,
  Store,
  Clock3,
  Phone,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Mail,
  MessageCircle,
  Download,
  Loader2,
  ShoppingBag,
  ExternalLink,
  Ban,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { generateReceiptPDF } from "../../utils/pdfReceiptGenerator";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { formatIncidentReason } from "../admin/services/orderNotification.service";
import {
  DELIVERY_TRACKING_STEPS,
  PICKUP_TRACKING_STEPS,
  isPickupDeliveryType,
  getTrackingStepIndex,
  getStatusBadgeConfig,
  fetchOrderForTracking,
  fetchDeliveryProfileById,
  subscribeToOrderRealtime,
  canCustomerCancelOrder,
  cancelCustomerOrder,
} from "./services/tracking.service";

const CUSTOMER_CANCEL_REASONS = [
  "Cambié de opinión / ya no necesito el pedido",
  "Me equivoqué de talla, color o dirección de entrega",
  "Demora en la preparación o despacho",
  "Otro motivo",
];

const REFUND_METHOD_LABELS = {
  culqi_extorno: "Extorno automático a tu tarjeta (Culqi)",
  culqi_gateway: "Extorno a tu tarjeta (Culqi)",
  tarjeta: "Extorno a tu tarjeta",
  yape_plin: "Devolución vía Yape / Plin",
  transferencia: "Transferencia bancaria",
  efectivo: "Devolución en efectivo",
};

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const formatCurrency = (amount) => `S/ ${Number(amount || 0).toFixed(2)}`;

const PAYMENT_LABELS = {
  culqi_gateway: "Pago Online (Culqi)",
  yape_plin: "Yape / Plin",
  card: "Tarjeta de Débito / Crédito",
  cash_on_delivery: "Pago Contra Entrega",
  contraentrega: "Pago Contra Entrega",
  transferencia: "Transferencia Bancaria",
  efectivo: "Efectivo",
};

export default function OrderTrackingView() {
  const { orderNumber } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [identityValue, setIdentityValue] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CUSTOMER_CANCEL_REASONS[0]);
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Auto-validación si el usuario ya está autenticado y es propietario del pedido
  useEffect(() => {
    if (!orderNumber || !user) return;
    let isMounted = true;

    async function checkOwnership() {
      try {
        const { data, error } = await fetchOrderForTracking(orderNumber);

        if (error) {
          console.error("Error al cargar orden para usuario autenticado:", error);
          return;
        }

        if (
          isMounted &&
          data &&
          (data.customer_id === user.id || data.user_id === user.id)
        ) {
          setOrder(data);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Error inesperado en comprobación de propiedad:", err);
      }
    }

    checkOwnership();

    return () => {
      isMounted = false;
    };
  }, [orderNumber, user]);

  // Suscripción WebSocket a Supabase Realtime para actualizaciones de estado en caliente
  useEffect(() => {
    if (!orderNumber || !isAuthenticated) return;

    const unsubscribe = subscribeToOrderRealtime(
      orderNumber,
      async (newOrderData) => {
        let updatedDriver = null;
        if (newOrderData.assigned_delivery_id) {
          updatedDriver = await fetchDeliveryProfileById(
            newOrderData.assigned_delivery_id,
          );
        }

        setOrder((prev) => {
          if (!prev) return prev;
          const merged = {
            ...prev,
            ...newOrderData,
            order_items: prev.order_items || [],
            items: prev.items || [],
          };
          if (updatedDriver) {
            merged.delivery_user = updatedDriver;
            merged.delivery_profile = updatedDriver;
          }
          return merged;
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [orderNumber, isAuthenticated]);

  // Comprobación de identidad (Puerta de privacidad)
  const handleVerify = async (e) => {
    e.preventDefault();
    setIdentityError("");

    const supplied = digitsOnly(identityValue);
    if (!supplied) {
      setIdentityError(
        "Ingresa tu DNI o los últimos 4 dígitos de tu teléfono.",
      );
      return;
    }

    setIsChecking(true);

    try {
      const { data, error: queryError } =
        await fetchOrderForTracking(orderNumber);

      if (queryError) {
        throw queryError;
      }

      if (!data) {
        setIdentityError(
          "No se encontró ningún pedido con el código ingresado. Verifica tu comprobante.",
        );
        setIsChecking(false);
        return;
      }

      const phoneDigits = digitsOnly(data.customer_phone);
      const dniCandidates = [
        data.customer_dni,
        data.profiles?.dni,
        data.invoice_data?.tax_id,
        data.invoice_data?.dni,
      ]
        .map(digitsOnly)
        .filter(Boolean);

      const matchesPhone =
        supplied.length === 4 && phoneDigits.slice(-4) === supplied;
      const matchesDni = dniCandidates.includes(supplied);

      if (matchesPhone || matchesDni) {
        setOrder(data);
        setIsAuthenticated(true);
        setIdentityError("");
      } else {
        setIdentityError(
          "Los datos ingresados no coinciden con los registros de este pedido.",
        );
      }
    } catch (err) {
      console.error("Error al consultar pedido en Supabase:", err);
      setIdentityError(
        "No se pudo consultar el estado del pedido en este momento. Inténtalo nuevamente.",
      );
    } finally {
      setIsChecking(false);
    }
  };

  // Descarga del comprobante fiscal en PDF
  const handleDownloadFiscalReceipt = async () => {
    if (!order) return;
    setIsDownloadingReceipt(true);

    try {
      generateReceiptPDF(order);
    } catch (err) {
      console.error("Error al generar el comprobante PDF:", err);
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const isPickup = useMemo(
    () => isPickupDeliveryType(order),
    [order],
  );

  const steps = useMemo(
    () => (isPickup ? PICKUP_TRACKING_STEPS : DELIVERY_TRACKING_STEPS),
    [isPickup],
  );

  const currentStep = useMemo(
    () => getTrackingStepIndex(order?.status, isPickup),
    [order?.status, isPickup],
  );

  const statusBadge = useMemo(
    () => getStatusBadgeConfig(order?.status, isPickup),
    [order?.status, isPickup],
  );

  const progressPercentage = useMemo(() => {
    if (currentStep < 0) return 0;
    const maxIndex = steps.length - 1;
    return Math.min(100, Math.round((currentStep / maxIndex) * 100));
  }, [currentStep, steps.length]);

  const isFinalDelivered = useMemo(() => {
    const s = String(order?.status || "").toLowerCase();
    return s === "entregado" || s === "delivered";
  }, [order?.status]);

  const isCancelled = useMemo(() => {
    const s = String(order?.status || "").toLowerCase();
    return s === "cancelado" || s === "cancelled";
  }, [order?.status]);

  const isActiveIncident = useMemo(() => {
    const s = String(order?.status || "").toLowerCase();
    return s === "incidencia_transporte";
  }, [order?.status]);

  const hasReprogrammedIncident = useMemo(() => {
    return (
      !isActiveIncident &&
      !isFinalDelivered &&
      !isCancelled &&
      Boolean(order?.incident_reason)
    );
  }, [isActiveIncident, isFinalDelivered, isCancelled, order?.incident_reason]);

  const canCancel = useMemo(
    () => canCustomerCancelOrder(order?.status),
    [order?.status],
  );

  const handleConfirmCustomerCancel = async () => {
    if (!order || isCancelling) return;
    const isCustom = cancelReason === "Otro motivo";
    const resolvedReason = isCustom
      ? cancelCustomReason.trim() || "Cancelado por el cliente"
      : cancelReason;

    setIsCancelling(true);
    setCancelError("");
    try {
      const { order: updatedOrder } = await cancelCustomerOrder(
        order,
        resolvedReason,
      );
      setOrder((prev) => ({ ...prev, ...updatedOrder }));
      setCancelModalOpen(false);
      setCancelCustomReason("");
    } catch (err) {
      setCancelError(err.message || "No se pudo cancelar tu pedido.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Ficha de Repartidor en ruta (solo en camino, cerca o en ubicación)
  const isDriverInTransit = useMemo(() => {
    if (isPickup) return false;
    const s = String(order?.status || "").toLowerCase();
    return [
      "en_camino",
      "dispatched",
      "cerca",
      "nearby",
      "en_ubicacion",
      "en_destino",
      "arrived",
    ].includes(s);
  }, [isPickup, order?.status]);

  const driverName = useMemo(() => {
    if (!order) return "";
    return (
      order.delivery_user?.full_name ||
      order.delivery_profile?.full_name ||
      (order.delivery_profile
        ? `${order.delivery_profile.first_name || ""} ${order.delivery_profile.paternal_surname || ""}`.trim()
        : null) ||
      "Repartidor Asignado"
    );
  }, [order]);

  const deliveryTypeLabel = useMemo(() => {
    if (isPickup) return "Recojo en Tienda ERXIDI";
    if (order?.delivery_type === "express") return "Envío Express Mismo Día";
    return `Envío Programado${
      order?.scheduled_time_slot ? ` · ${order.scheduled_time_slot}` : ""
    }`;
  }, [isPickup, order?.delivery_type, order?.scheduled_time_slot]);

  const invoiceDisplayName = useMemo(() => {
    const rawType = String(
      order?.invoice_type || order?.invoice_data?.type || "boleta",
    ).toLowerCase();
    if (rawType === "factura") return "Factura Electrónica";
    if (rawType === "nota_venta") return "Nota de Venta";
    return "Boleta de Venta Electrónica";
  }, [order?.invoice_type, order?.invoice_data]);

  const corporateWhatsAppUrl = `https://wa.me/51961211119?text=${encodeURIComponent(
    `Hola ERXIDI, necesito asistencia sobre mi pedido ${order?.order_number || ""}.`,
  )}`;

  // -------------------------------------------------------------
  // FASE 1: Pantalla de Validación Previa (Puerta de Privacidad)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-[65vh] w-full max-w-lg items-center px-4 py-12">
        <Card className="w-full space-y-6 p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-subtle text-brand-primary">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="font-mono text-xs !rounded-sm">
                {orderNumber || "SIN CÓDIGO"}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-brand-primary">
              Seguimiento de Pedido
            </h1>
            <p className="text-xs leading-relaxed text-brand-secondary">
              Para proteger tu privacidad, ingresa tu DNI o los últimos 4
              dígitos del teléfono registrado en tu compra.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              label="DNI o últimos 4 dígitos del teléfono"
              id="tracking-identity"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              placeholder="Ej. 72345678 o 4321"
              value={identityValue}
              onChange={(e) => {
                setIdentityValue(digitsOnly(e.target.value));
                setIdentityError("");
              }}
              required
            />

            {identityError && (
              <div className="flex items-start gap-2 rounded-card border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-text">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-status-danger-text" />
                <span>{identityError}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isChecking || !identityValue}
              isLoading={isChecking}
              className="w-full"
            >
              Consultar Pedido
            </Button>
          </form>

          <div className="pt-2 text-center">
            <Link
              to="/catalogo"
              className="text-xs text-brand-secondary hover:text-brand-primary hover:underline"
            >
              Volver al catálogo de productos
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  // -------------------------------------------------------------
  // FASE 2: Visualización Completa del Pedido Desbloqueado
  // -------------------------------------------------------------
  const items = order.order_items || order.items || [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      {/* Encabezado */}
      <header className="space-y-4 border-b border-border pb-5">
        {/* Fila 1: Botón de retorno y Estado */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/mis-pedidos"
            className="inline-flex items-center gap-1.5 rounded-button border border-border bg-surface-card px-2.5 py-1 text-xs font-medium text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Mis pedidos</span>
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant={statusBadge.variant} className="text-xs font-mono !rounded-sm">
              {statusBadge.label}
            </Badge>
            {isPickup && (
              <Badge variant="neutral" className="text-xs !rounded-sm">
                Recojo en Tienda
              </Badge>
            )}
          </div>
        </div>

        {/* Fila 2: Título, Código y Cancelación */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">
              Seguimiento de Pedido
            </h1>
            <p className="font-mono text-sm font-bold text-brand-primary mt-1">
              Código: <span className="text-accent">{order.order_number}</span>
            </p>
          </div>
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCancelReason(CUSTOMER_CANCEL_REASONS[0]);
                setCancelCustomReason("");
                setCancelError("");
                setCancelModalOpen(true);
              }}
              className="text-status-danger-text border-status-danger-border hover:bg-status-danger-bg self-start sm:self-auto"
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              Cancelar Pedido
            </Button>
          )}
        </div>
      </header>

      {/* Banner de Incidencia Operativa Activa */}
      {isActiveIncident && (
        <section
          aria-label="Aviso de novedad operativa"
          className="rounded-card border border-status-danger-border bg-status-danger-bg p-4 flex items-start gap-3 text-status-danger-text shadow-subtle"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-status-danger-text" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider">
                Aviso de Novedad Operativa
              </span>
              <Badge variant="danger" className="text-[10px] font-mono !rounded-sm">
                En Revisión Logística
              </Badge>
            </div>
            <p className="text-sm font-medium leading-relaxed">
              Registramos un inconveniente durante el despacho:{" "}
              <strong className="font-semibold">
                {formatIncidentReason(
                  order.incident_reason,
                  order.incident_comment,
                )}
              </strong>
              . Nuestro equipo ya está gestionando la solución y reprogramación.
            </p>
          </div>
        </section>
      )}

      {/* Aviso suave si tuvo incidencia previa y ya fue reprogramado */}
      {hasReprogrammedIncident && (
        <section
          aria-label="Aviso de pedido reprogramado"
          className="rounded-card border border-status-warning-border bg-status-warning-bg p-3.5 flex items-start gap-3 text-status-warning-text shadow-subtle"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            <strong>Pedido reprogramado:</strong> Tu orden registró una novedad
            previa (
            {formatIncidentReason(order.incident_reason, order.incident_comment)}
            ) y ya fue retomada para continuar con su entrega.
          </p>
        </section>
      )}

      {/* Tarjeta de Pedido Cancelado y Estado de Reembolso */}
      {isCancelled && (
        <section
          aria-label="Información de pedido cancelado"
          className="rounded-card border border-status-danger-border bg-status-danger-bg p-6 text-status-danger-text space-y-4 shadow-subtle"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 border border-status-danger-border flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-status-danger-text" />
            </div>
            <div>
              <h2 className="text-base font-bold text-status-danger-text">
                Pedido Cancelado
              </h2>
              <p className="text-xs text-rose-800">
                Esta orden fue cancelada y no continuará su proceso de entrega.
              </p>
            </div>
          </div>

          {order.incident_reason && (
            <div className="rounded-button bg-surface-card border border-status-danger-border px-3.5 py-2.5 text-xs text-brand-primary">
              <span className="font-semibold text-brand-secondary">Motivo: </span>
              {formatIncidentReason(order.incident_reason, order.incident_comment)}
            </div>
          )}

          {/* Bloque de estado de devolución de dinero */}
          {order.refund_status === "completed" ? (
            <div className="rounded-card border border-status-success-border bg-status-success-bg p-4 text-status-success-text space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Reembolso completado ({formatCurrency(order.total_amount)})
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                Tu dinero ha sido reembolsado mediante{" "}
                <strong>
                  {REFUND_METHOD_LABELS[order.refund_method] ||
                    "tu medio de pago original"}
                </strong>
                .
              </p>
              {order.refund_reference && (
                <p className="text-xs font-mono font-semibold">
                  Código de operación: {order.refund_reference}
                </p>
              )}
            </div>
          ) : order.refund_status === "pending" ||
            order.payment_status === "paid" ? (
            <div className="rounded-card border border-status-warning-border bg-status-warning-bg p-4 text-status-warning-text space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Clock3 className="h-4 w-4 shrink-0" />
                <span>
                  Reembolso en gestión ({formatCurrency(order.total_amount)})
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                Hemos registrado la devolución pendiente de tu pago. Nuestro
                equipo de administración procesará el abono y te enviará la
                constancia con el número de operación a tu correo.
              </p>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-rose-900">
              No se registró ningún cobro previo sobre esta orden, por lo que no
              corresponde devolución de dinero.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="mailto:soporte@erxidi.pe"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-button bg-status-danger-text text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Mail className="h-3.5 w-3.5" />
              soporte@erxidi.pe
            </a>
            <a
              href={corporateWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-button border border-border bg-surface-card text-brand-primary text-xs font-semibold hover:bg-surface-subtle transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp de Soporte
            </a>
          </div>
        </section>
      )}

      {/* Stepper Adaptativo con Barra de Progreso Animada */}
      {!isCancelled && (
        <section
          aria-label="Progreso del pedido"
          className="rounded-card border border-border bg-surface-card p-5 shadow-subtle sm:p-6 space-y-6"
        >
          {/* Barra de progreso global */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-brand-primary">
                Fase {currentStep >= 0 ? currentStep + 1 : 1} de {steps.length}:{" "}
                <span className="text-accent">
                  {steps[currentStep]?.title || "Procesando"}
                </span>
                <span className="hidden sm:inline text-brand-secondary font-normal ml-1.5">
                  — {steps[currentStep]?.detail}
                </span>
              </span>
              <span className="font-mono text-xs font-bold text-brand-primary">
                {progressPercentage}%
              </span>
            </div>
            <div className="overflow-hidden h-2 rounded-full bg-surface-subtle border border-border">
              <div
                style={{ width: `${progressPercentage}%` }}
                className="h-full bg-brand-primary rounded-full transition-all duration-500 ease-out"
              />
            </div>
          </div>

          {/* Stepper Nodes */}
          <ol
            className={`flex flex-col space-y-6 md:grid ${
              isPickup ? "md:grid-cols-4" : "md:grid-cols-8"
            } md:gap-2 md:space-y-0`}
          >
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = isFinalDelivered || index < currentStep;
              const isActive = !isFinalDelivered && index === currentStep;

              return (
                <li
                  key={step.id}
                  title={step.detail}
                  className="relative flex min-w-0 gap-3 md:flex-col md:items-center md:gap-3"
                >
                  {/* Conector lineal entre pasos */}
                  {index < steps.length - 1 && (
                    <span
                      className={`absolute left-[17px] top-9 h-[calc(100%+8px)] w-px md:left-1/2 md:top-[18px] md:h-px md:w-[calc(100%+8px)] ${
                        isCompleted ? "bg-emerald-500" : "bg-border"
                      }`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Ícono indicador de Estado */}
                  <span
                    className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all ${
                      isCompleted
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : isActive
                          ? "border-accent bg-accent text-white ring-4 ring-accent/20"
                          : "border-border bg-surface-subtle text-brand-muted"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </span>

                  {/* Texto de la etapa */}
                  <div className="min-w-0 pb-1 md:pr-1 w-full">
                    <h2
                      className={`text-[11px] md:text-xs font-bold text-center leading-tight break-words ${
                        isActive || isCompleted
                          ? "text-brand-primary"
                          : "text-brand-muted"
                      }`}
                    >
                      {step.title}
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-secondary md:hidden">
                      {step.detail}
                    </p>
                    {isActive && (
                      <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-accent uppercase md:hidden">
                        <Clock3 className="h-3 w-3" />
                        Estado actual
                      </span>
                    )}
                    {isCompleted && index === steps.length - 1 && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        {isPickup ? "RETIRADO" : "FINALIZADO"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Ficha del Repartidor (Visible únicamente en camino, cerca o en ubicación) */}
      {isDriverInTransit && (
        <Card className="p-5 space-y-4 shadow-subtle border border-border">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-primary">
                <Truck className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-primary">
                  Ficha del Repartidor Asignado
                </h2>
                <p className="text-[11px] text-brand-secondary">
                  Tu pedido se encuentra actualmente en tránsito
                </p>
              </div>
            </div>
            <Badge variant="warning" className="text-[10px] font-mono !rounded-sm">
              {statusBadge.label}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                {driverName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-brand-primary">
                  {driverName}
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs text-brand-secondary font-medium">
                El repartidor te contactará al llegar a tu dirección
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Ficha de Recojo en Tienda (Visible cuando la orden está lista para recojo) */}
      {isPickup && (order.status === "listo_recojo" || currentStep >= 2) && !isFinalDelivered && (
        <Card className="p-5 space-y-4 shadow-subtle border border-border">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-primary">
                <Store className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-primary">
                  Punto de Retiro en Tienda
                </h2>
                <p className="text-[11px] text-brand-secondary">
                  Tu paquete está listo para ser retirado
                </p>
              </div>
            </div>
            <Badge variant="warning" className="text-[10px] font-mono !rounded-sm">
              Listo para Retiro
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px] block">
                Dirección de Retiro
              </span>
              <p className="font-semibold text-brand-primary mt-1">
                Tienda y Taller Central ERXIDI
              </p>
              <p className="text-brand-secondary mt-0.5">
                {order.delivery_address ||
                  "Av. Carlos Izaguirre 1234, Los Olivos, Lima"}
              </p>
            </div>

            <div>
              <span className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px] block">
                Horarios de Atención
              </span>
              <p className="font-semibold text-brand-primary mt-1">
                Lunes a Sábado: 09:00 - 18:30
              </p>
              <p className="text-brand-secondary mt-0.5">
                Domingos y feriados cerrado
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-3 text-xs">
            <p className="text-brand-secondary">
              Presenta tu <strong>DNI físico</strong> y el código{" "}
              <strong className="font-mono text-accent">
                #{order.order_number}
              </strong>{" "}
              en mostrador.
            </p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Av.+Carlos+Izaguirre+Los+Olivos+Lima"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-hover hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Cómo llegar a la tienda</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </Card>
      )}

      {/* Grid de Despacho y Prendas */}
      <section className="grid gap-6 md:grid-cols-2 items-start">
        {/* Tarjeta de Detalles de Despacho */}
        <Card className="space-y-4 p-5 shadow-subtle border border-border">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-brand-primary">
              Detalles de Despacho
            </h2>
          </div>

          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                {isPickup ? "Lugar de Retiro" : "Dirección de Entrega"}
              </dt>
              <dd className="mt-1 font-medium text-brand-primary">
                {order.delivery_address ||
                  (isPickup
                    ? "Tienda y Taller Central ERXIDI"
                    : "Dirección no especificada")}
              </dd>
            </div>

            <div className="flex justify-between items-center gap-4">
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                Tipo de Envío
              </dt>
              <dd className="text-right font-medium text-brand-primary">
                {deliveryTypeLabel}
              </dd>
            </div>

            <div className="flex justify-between items-center gap-4">
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                Comprobante Emitido
              </dt>
              <dd className="text-right">
                <button
                  type="button"
                  onClick={handleDownloadFiscalReceipt}
                  disabled={isDownloadingReceipt}
                  className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-hover hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-accent rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title={`Descargar ${invoiceDisplayName}`}
                >
                  {isDownloadingReceipt ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Descargar {invoiceDisplayName}</span>
                </button>
              </dd>
            </div>

            <div className="flex justify-between items-center gap-4">
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                Método de Pago
              </dt>
              <dd className="text-right font-medium text-brand-primary">
                {PAYMENT_LABELS[order.payment_method] ||
                  order.payment_method ||
                  "No especificado"}
              </dd>
            </div>

            <div className="flex justify-between items-baseline gap-4 border-t border-border pt-3 text-sm">
              <dt className="font-bold text-brand-primary">Total Pagado</dt>
              <dd className="font-mono font-extrabold text-brand-primary text-base">
                {formatCurrency(order.total_amount)}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Tarjeta de Lista de Prendas */}
        <Card className="space-y-4 p-5 shadow-subtle border border-border">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-brand-primary">
                Prendas del Pedido
              </h2>
            </div>
            <Badge variant="neutral" className="text-[10px] font-mono !rounded-sm">
              {items.length} {items.length === 1 ? "prenda" : "prendas"}
            </Badge>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-3 pr-1 divide-y divide-border">
            {items.length === 0 ? (
              <p className="text-xs text-brand-secondary py-3 text-center">
                Detalle de ítems no disponible.
              </p>
            ) : (
              items.map((item, idx) => {
                const itemImageUrl =
                  item.image_url ||
                  item.product_variants?.products?.main_image_url ||
                  item.products?.main_image_url ||
                  item.product_variants?.image_url ||
                  null;

                return (
                  <div
                    key={item.id || idx}
                    className="pt-3 first:pt-0 flex items-center gap-3.5 text-xs"
                  >
                    {/* Foto miniatura en formato e-commerce 4:5 */}
                    <div className="w-14 aspect-[4/5] shrink-0 rounded-button border border-border bg-slate-50 p-1 overflow-hidden flex items-center justify-center">
                      {itemImageUrl ? (
                        <img
                          src={itemImageUrl}
                          alt={item.product_name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-brand-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-brand-primary truncate">
                        {item.product_name}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.variant_color && item.variant_color !== "—" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border bg-surface-subtle text-[10px] text-brand-primary font-medium">
                            Color: {item.variant_color}
                          </span>
                        )}
                        {item.variant_size && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border bg-surface-subtle text-[10px] text-brand-primary font-medium">
                            Talla: {item.variant_size}
                          </span>
                        )}
                        {item.sku && (
                          <span className="font-mono text-[10px] text-brand-secondary">
                            SKU: {item.sku}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-brand-secondary">
                        Cantidad:{" "}
                        <span className="font-mono font-semibold text-brand-primary">
                          {item.quantity}
                        </span>{" "}
                        &bull; P. Unit:{" "}
                        <span className="font-mono font-medium text-brand-primary">
                          {formatCurrency(item.unit_price)}
                        </span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-brand-primary text-sm">
                        {formatCurrency(item.total_price)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      {/* Soporte Directo */}
      <section className="rounded-card border border-border bg-surface-card p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-brand-primary">
            ¿Tienes alguna consulta sobre tu pedido?
          </h2>
          <p className="text-xs text-brand-secondary mt-0.5">
            Nuestro equipo de soporte y atención al cliente está listo para asistirte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={corporateWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-accent px-4 text-xs font-semibold text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <Phone className="h-4 w-4" />
            Contactar por WhatsApp
          </a>
          <Link to="/catalogo">
            <Button variant="outline" size="md" className="text-xs">
              Volver al Catálogo
            </Button>
          </Link>
        </div>
      </section>

      {/* Modal de Cancelación del Cliente */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-status-danger-text" />
                <h3 className="text-sm font-bold text-brand-primary">
                  Cancelar Pedido {order.order_number}
                </h3>
              </div>
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancelModalOpen(false)}
                className="p-1 rounded-button text-brand-muted hover:text-brand-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-secondary leading-relaxed">
                Puedes cancelar tu pedido porque aún no ha salido en ruta.{" "}
                {order.payment_status === "paid"
                  ? ["culqi_gateway", "tarjeta"].includes(order.payment_method)
                    ? "Al confirmar, se procesará automáticamente el extorno a tu tarjeta."
                    : "Al confirmar, tu reembolso quedará registrado para devolución en administración."
                  : "No se aplicará ningún cargo."}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-brand-primary">
                  Motivo de cancelación:
                </p>
                {CUSTOMER_CANCEL_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2.5 rounded-button border text-xs cursor-pointer ${
                      cancelReason === r
                        ? "border-rose-400 bg-rose-50/40 text-brand-primary font-semibold"
                        : "border-border bg-surface-card text-brand-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tracking_cancel_reason"
                      value={r}
                      checked={cancelReason === r}
                      onChange={() => setCancelReason(r)}
                      className="accent-rose-600"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              {cancelReason === "Otro motivo" && (
                <Input
                  label="Especificar motivo"
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  placeholder="Cuéntanos brevemente el motivo..."
                  autoFocus
                />
              )}

              {cancelError && (
                <div className="p-2.5 rounded-button bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs">
                  {cancelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCancelling}
                  onClick={() => setCancelModalOpen(false)}
                >
                  Volver
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={isCancelling}
                  disabled={
                    isCancelling ||
                    (cancelReason === "Otro motivo" &&
                      !cancelCustomReason.trim())
                  }
                  onClick={handleConfirmCustomerCancel}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirmar Cancelación
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
