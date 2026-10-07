import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Truck,
  AlertCircle,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

const TRACKING_STEPS = [
  {
    id: "received",
    title: "Pedido Recibido",
    detail: "Tu compra quedó registrada exitosamente.",
    icon: Check,
  },
  {
    id: "preparing",
    title: "En Preparación",
    detail: "Estamos seleccionando y empacando tus prendas.",
    icon: PackageCheck,
  },
  {
    id: "dispatched",
    title: "En Camino",
    detail: "El pedido ha sido despachado con el courier.",
    icon: Truck,
  },
  {
    id: "nearby",
    title: "Cerca a tu ubicación",
    detail: "El repartidor está próximo a tu dirección.",
    icon: MapPin,
  },
  {
    id: "delivered",
    title: "Entregado con Éxito",
    detail: "El pedido fue entregado en destino.",
    icon: Check,
  },
];

const STATUS_INDEX = {
  received: 0,
  pending: 0,
  preparing: 1,
  dispatched: 2,
  nearby: 3,
  delivered: 4,
};

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(amount || 0));

export default function OrderTrackingView() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [identityValue, setIdentityValue] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Comprobación de identidad y consulta a Supabase
  const handleVerify = async (e) => {
    e.preventDefault();
    setIdentityError("");

    const supplied = digitsOnly(identityValue);
    if (!supplied) {
      setIdentityError("Ingresa tu DNI o los últimos 4 dígitos de tu teléfono.");
      return;
    }

    setIsChecking(true);

    try {
      // Consulta directa y real a Supabase
      const { data, error: queryError } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (!data) {
        setIdentityError(
          "No se encontró ningún pedido con el código ingresado. Verifica tu comprobante."
        );
        setIsChecking(false);
        return;
      }

      // Verificación de credencial contra datos del pedido
      const phoneDigits = digitsOnly(data.customer_phone);
      const dniCandidates = [
        data.customer_dni,
        data.invoice_data?.tax_id,
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
          "Los datos ingresados no coinciden con los registros de este pedido."
        );
      }
    } catch (err) {
      console.error("Error al consultar pedido en Supabase:", err);
      setIdentityError(
        "No se pudo consultar el estado del pedido en este momento. Inténtalo nuevamente."
      );
    } finally {
      setIsChecking(false);
    }
  };

  const currentStep = useMemo(() => {
    const status = String(order?.status || "received").toLowerCase();
    return STATUS_INDEX[status] ?? STATUS_INDEX.received;
  }, [order?.status]);

  const deliveryTypeLabel = useMemo(() => {
    if (order?.delivery_type === "express") return "Envío Express Mismo Día";
    if (order?.delivery_type === "pickup") return "Recojo en Tienda";
    return `Envío Programado${
      order?.scheduled_time_slot ? ` · ${order.scheduled_time_slot}` : ""
    }`;
  }, [order]);

  const invoiceTypeLabel = useMemo(() => {
    const type = String(
      order?.invoice_type || order?.invoice_data?.type || "boleta"
    ).toLowerCase();
    if (type === "factura") return "Factura Electrónica";
    if (type === "nota_venta") return "Nota de Venta";
    return "Boleta de Venta";
  }, [order]);

  const paymentLabels = {
    culqi_gateway: "Pago Online (Culqi)",
    yape_plin: "Yape / Plin",
    card: "Tarjeta de Débito / Crédito",
    cash_on_delivery: "Pago Contra Entrega",
  };

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
              <Badge variant="neutral" className="font-mono text-xs">
                {orderNumber || "SIN CÓDIGO"}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-brand-primary">
              Seguimiento de Pedido
            </h1>
            <p className="text-xs leading-relaxed text-brand-secondary">
              Para proteger tu privacidad, ingresa tu DNI o los últimos 4 dígitos
              del teléfono con el que realizaste la compra.
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
              <div className="flex items-start gap-2 rounded-card border border-status-danger-border bg-rose-50 p-3 text-xs text-status-danger-text">
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
              className="w-full bg-accent hover:bg-accent-hover text-white"
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
  const items = order.order_items || [];
  const whatsappUrl = `https://wa.me/51987654321?text=${encodeURIComponent(
    `Hola ERXIDI, necesito consultar sobre mi pedido ${order.order_number}.`
  )}`;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      {/* Encabezado */}
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Badge
            variant={currentStep === 4 ? "success" : "neutral"}
            className="text-xs font-mono"
          >
            {currentStep === 4 ? "Pedido Entregado" : "Pedido en Proceso"}
          </Badge>
          <h1 className="text-2xl font-bold text-brand-primary">
            Seguimiento de Pedido
          </h1>
        </div>
        <p className="font-mono text-sm font-bold text-brand-primary">
          Código: <span className="text-accent">{order.order_number}</span>
        </p>
      </header>

      {/* Línea de Tiempo de 5 Estados */}
      <section
        aria-label="Progreso del pedido"
        className="rounded-card border border-border bg-surface-card p-5 shadow-subtle sm:p-6"
      >
        <ol className="space-y-6 md:grid md:grid-cols-5 md:gap-3 md:space-y-0">
          {TRACKING_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <li
                key={step.id}
                className="relative flex gap-3 md:flex-col md:gap-3"
              >
                {/* Conector lineal */}
                {index < TRACKING_STEPS.length - 1 && (
                  <span
                    className={`absolute left-[17px] top-9 h-[calc(100%+8px)] w-px md:left-[34px] md:top-[17px] md:h-px md:w-[calc(100%-20px)] ${
                      isCompleted ? "bg-emerald-500" : "bg-border"
                    }`}
                    aria-hidden="true"
                  />
                )}

                {/* Ícono de Estado */}
                <span
                  className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isCompleted
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : isActive
                        ? "border-accent bg-accent text-white ring-2 ring-accent/30"
                        : "border-border bg-surface-subtle text-brand-muted"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <StepIcon className="h-4 w-4" />
                </span>

                {/* Título y Detalle */}
                <div className="pb-1 md:pr-2">
                  <h2
                    className={`text-xs font-bold ${
                      isActive || isCompleted
                        ? "text-brand-primary"
                        : "text-brand-muted"
                    }`}
                  >
                    {step.title}
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-brand-secondary">
                    {step.detail}
                  </p>
                  {isActive && (
                    <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-accent uppercase">
                      <Clock3 className="h-3 w-3" />
                      Estado actual
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Grid de Despacho y Prendas */}
      <section className="grid gap-6 md:grid-cols-2 items-start">
        {/* Tarjeta de Detalles de Despacho */}
        <div className="space-y-4 rounded-card border border-border bg-surface-card p-5 shadow-subtle">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-brand-primary">
              Detalles de Despacho
            </h2>
          </div>

          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                Dirección de Entrega
              </dt>
              <dd className="mt-1 font-medium text-brand-primary">
                {order.delivery_address || "Recojo en punto ERXIDI"}
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
              <dd className="text-right font-medium text-brand-primary flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-accent" />
                {invoiceTypeLabel}
              </dd>
            </div>

            <div className="flex justify-between items-center gap-4">
              <dt className="text-brand-secondary font-semibold uppercase tracking-wider text-[10px]">
                Método de Pago
              </dt>
              <dd className="text-right font-medium text-brand-primary">
                {paymentLabels[order.payment_method] ||
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
        </div>

        {/* Tarjeta de Lista de Prendas */}
        <div className="space-y-4 rounded-card border border-border bg-surface-card p-5 shadow-subtle">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-brand-primary">
                Prendas del Pedido
              </h2>
            </div>
            <Badge variant="neutral" className="text-[10px] font-mono">
              {items.length} {items.length === 1 ? "ítem" : "ítems"}
            </Badge>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {items.length === 0 ? (
              <p className="text-xs text-brand-secondary py-3 text-center">
                Detalle de ítems no disponible.
              </p>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between py-2 border-b border-border last:border-b-0 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-brand-primary truncate">
                      {item.product_name || `Prenda #${idx + 1}`}
                    </p>
                    <p className="text-[11px] text-brand-secondary">
                      Cantidad:{" "}
                      <span className="font-mono font-semibold">
                        {item.quantity}
                      </span>{" "}
                      &bull; P. Unit:{" "}
                      <span className="font-mono">
                        {formatCurrency(item.unit_price)}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono font-bold text-brand-primary flex-shrink-0">
                    {formatCurrency(
                      item.subtotal || item.unit_price * item.quantity
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Soporte por WhatsApp */}
      <section className="rounded-card border border-border bg-surface-card p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-brand-primary">
            ¿Tienes alguna consulta sobre tu entrega?
          </h2>
          <p className="text-xs text-brand-secondary mt-0.5">
            Comunícate con nuestro equipo de soporte directamente vía WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={whatsappUrl}
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
    </main>
  );
}
