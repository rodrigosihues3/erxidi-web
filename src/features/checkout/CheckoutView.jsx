import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Check,
  ShoppingBag,
  Truck,
  Store,
  CreditCard,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Clock,
  Phone,
  Loader2,
  Zap,
  Calendar,
  AlertCircle,
  Search,
  Edit3,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Input from "../../components/ui/Input";
import { fetchDni, fetchRuc } from "../../services/api/decolectaService";
import { createOrder } from "../../services/api/checkoutService";
import {
  initCulqi,
  openCulqi,
  closeCulqi,
} from "../../services/payment/culqiService";
import {
  defaultDeliveryZones,
  defaultDeliverySlots,
  pickupStoreInfo,
} from "./data/mockDeliveryZones";

export default function CheckoutView() {
  const navigate = useNavigate();
  const { items, totalUnits, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({ 1: false, 2: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -------------------------------------------------------------
  // PASO 1: Identificación y Contacto
  // -------------------------------------------------------------
  const [dni, setDni] = useState(profile?.document_number || "");
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [dniFeedback, setDniFeedback] = useState(null); // { type: 'success' | 'info' | 'error', message: string }

  // Sincronizar datos si el usuario inicia sesión o carga perfil
  useEffect(() => {
    if (user && profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (user.email) setEmail(user.email);
      if (profile.phone) setPhone(profile.phone);
      if (profile.document_number) setDni(profile.document_number);
    }
  }, [user, profile]);

  // Función explícita para consulta de DNI (vía botón o Enter)
  const triggerDniLookup = async (dniToSearch = dni) => {
    const clean = String(dniToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (!/^\d{8}$/.test(clean)) {
      setDniFeedback({
        type: "error",
        message: "El DNI debe contener exactamente 8 dígitos numéricos.",
      });
      return;
    }

    setIsSearchingDni(true);
    setDniFeedback(null);

    try {
      const res = await fetchDni(clean);
      if (res.success && res.names) {
        setFirstName(res.names);
        setLastName(
          `${res.firstLastName || ""} ${res.secondLastName || ""}`.trim(),
        );
        setIsNameLocked(true);
        setDniFeedback({
          type: "success",
          message: "Identidad verificada exitosamente en RENIEC.",
        });
      } else {
        setIsNameLocked(false);
        setDniFeedback({
          type: "info",
          message:
            "No pudimos autocompletar tus datos. Ingrésalos manualmente.",
        });
      }
    } catch (err) {
      setIsNameLocked(false);
      setDniFeedback({
        type: "info",
        message:
          "Servicio no disponible momentáneamente. Ingresa tus datos manualmente.",
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  // Manejo de cambio en DNI con auto-lookup reactivo al 8vo dígito
  const handleDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDni(rawVal);
    setDniFeedback(null);

    if (rawVal.length === 8) {
      triggerDniLookup(rawVal);
    } else {
      setIsNameLocked(false);
    }
  };

  const isStep1Valid = useMemo(() => {
    const isDniValid = /^\d{8}$/.test(dni);
    const isNameValid =
      firstName.trim().length > 1 && lastName.trim().length > 1;
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isPhoneValid = /^9\d{8}$/.test(phone.trim());
    return isDniValid && isNameValid && isEmailValid && isPhoneValid;
  }, [dni, firstName, lastName, email, phone]);

  const handleNextFromStep1 = (e) => {
    e.preventDefault();
    if (isStep1Valid) {
      setCompletedSteps((prev) => ({ ...prev, 1: true }));
      setCurrentStep(2);
    }
  };

  // -------------------------------------------------------------
  // PASO 2: Método de Entrega y Horarios
  // -------------------------------------------------------------
  const [deliveryType, setDeliveryType] = useState("scheduled");
  const [selectedZoneId, setSelectedZoneId] = useState(
    defaultDeliveryZones[0]?.id || 1,
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(
    defaultDeliverySlots[0],
  );

  // Cálculo dinámico de ventana de envío express (hora actual + 45min a + 90min)
  const expressTimeWindow = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 45 * 60000);
    const end = new Date(now.getTime() + 90 * 60000);
    const formatH = (d) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `Tu pedido llegará hoy entre las ${formatH(start)} y ${formatH(end)} hrs`;
  }, []);

  const selectedZone = useMemo(
    () => defaultDeliveryZones.find((z) => z.id === Number(selectedZoneId)),
    [selectedZoneId],
  );

  const deliveryCost = useMemo(() => {
    if (deliveryType === "pickup") return 0;
    const baseCost = selectedZone?.delivery_cost || 10.0;
    if (deliveryType === "express") {
      return baseCost + 5.0; // Recargo express prioritario
    }
    return baseCost;
  }, [deliveryType, selectedZone]);

  const totalAmount = subtotal + deliveryCost;

  const isStep2Valid = useMemo(() => {
    if (deliveryType === "pickup") return true;
    return deliveryAddress.trim().length >= 4;
  }, [deliveryType, deliveryAddress]);

  const handleNextFromStep2 = (e) => {
    e.preventDefault();
    if (isStep2Valid) {
      setCompletedSteps((prev) => ({ ...prev, 2: true }));
      setCurrentStep(3);
    }
  };

  // -------------------------------------------------------------
  // PASO 3: Pago y Comprobante
  // -------------------------------------------------------------
  const [paymentMethod, setPaymentMethod] = useState("yape_plin"); // 'yape_plin' | 'culqi_gateway'
  const [yapeOpNumber, setYapeOpNumber] = useState("");
  const [culqiError, setCulqiError] = useState(null);

  // Comprobante y Facturación: 'nota_venta' | 'boleta' | 'factura'
  const [receiptType, setReceiptType] = useState("boleta");
  const [ruc, setRuc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [isRucLocked, setIsRucLocked] = useState(false);
  const [rucFeedback, setRucFeedback] = useState(null);

  // Mantener referencia actualizada para el callback global de Culqi
  const orderContextRef = useRef({});
  orderContextRef.current = {
    user,
    firstName,
    lastName,
    email,
    phone,
    deliveryType,
    deliveryAddress,
    deliveryReference,
    selectedZone,
    deliveryCost,
    scheduledTimeSlot,
    subtotal,
    totalAmount,
    receiptType,
    ruc,
    companyName,
    fiscalAddress,
    dni,
    items,
  };

  // Callback para procesar orden con Culqi (token u orden confirmada)
  const handleProcessCulqiOrder = async (gatewayTxId) => {
    const ctx = orderContextRef.current;
    const fullName = `${ctx.firstName.trim()} ${ctx.lastName.trim()}`.trim();
    const finalAddress =
      ctx.deliveryType === "pickup"
        ? pickupStoreInfo.address
        : `${ctx.deliveryAddress.trim()}${
            ctx.deliveryReference.trim()
              ? ` (Ref: ${ctx.deliveryReference.trim()})`
              : ""
          } - ${ctx.selectedZone?.district_name || "Lima"}`;

    const invoicePrefix =
      ctx.receiptType === "factura"
        ? "F001"
        : ctx.receiptType === "boleta"
          ? "B001"
          : "NV01";
    const invoiceDocNumber = `${invoicePrefix}-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      type: ctx.receiptType,
      doc_number: invoiceDocNumber,
      tax_id: ctx.receiptType === "factura" ? ctx.ruc.trim() : ctx.dni.trim(),
      legal_name: ctx.receiptType === "factura" ? ctx.companyName.trim() : fullName,
      fiscal_address:
        ctx.receiptType === "factura"
          ? ctx.fiscalAddress.trim() || finalAddress
          : finalAddress,
      issued_at: new Date().toISOString(),
    };

    const orderPayload = {
      userId: ctx.user?.id || null,
      customerName: fullName,
      customerEmail: ctx.email.trim(),
      customerPhone: ctx.phone.trim(),
      deliveryType: ctx.deliveryType,
      deliveryAddress: finalAddress,
      deliveryZoneId:
        ctx.deliveryType === "pickup" ? null : ctx.selectedZone?.id || null,
      deliveryCost: ctx.deliveryCost,
      scheduledTimeSlot:
        ctx.deliveryType === "scheduled"
          ? ctx.scheduledTimeSlot
          : ctx.deliveryType === "express"
            ? "Express Mismo Día"
            : "Horario Comercial 09:00 - 18:00",
      subtotal: ctx.subtotal,
      totalAmount: ctx.totalAmount,
      payment_method: "culqi_gateway",
      paymentMethod: "culqi_gateway",
      payment_status: "completed",
      paymentStatus: "completed",
      payment_gateway_tx_id: gatewayTxId,
      paymentGatewayTxId: gatewayTxId,
      invoice_type: ctx.receiptType,
      invoice_data: invoiceData,
      items: ctx.items,
    };

    try {
      const result = await createOrder(orderPayload);
      if (result.success && result.order) {
        clearCart();
        navigate(`/checkout/confirmacion/${result.order.order_number}`, {
          state: { order: result.order },
        });
      } else {
        throw new Error(result.error || "No se pudo registrar la compra.");
      }
    } catch (err) {
      console.error("Error al registrar orden de Culqi:", err);
      setCulqiError(err.message || "Error al registrar el pedido en el sistema.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador Global de Respuesta de Culqi Checkout v4
  useEffect(() => {
    window.culqi = async () => {
      try {
        if (window.Culqi?.token) {
          const token = window.Culqi.token;
          closeCulqi();
          setIsSubmitting(true);
          setCulqiError(null);
          await handleProcessCulqiOrder(token.id);
        } else if (window.Culqi?.order) {
          const order = window.Culqi.order;
          closeCulqi();
          setIsSubmitting(true);
          setCulqiError(null);
          await handleProcessCulqiOrder(order.id);
        } else if (window.Culqi?.error) {
          const errorMsg =
            window.Culqi.error.user_message ||
            window.Culqi.error.merchant_message ||
            "No se pudo completar el pago con Culqi.";
          setCulqiError(errorMsg);
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error("Error en callback window.culqi:", err);
        setCulqiError(err.message || "Error inesperado al procesar el pago.");
        setIsSubmitting(false);
      }
    };

    return () => {
      window.culqi = null;
    };
  }, []);

  // Consulta de RUC con Decolecta
  const triggerRucLookup = async (rucToSearch = ruc) => {
    const clean = String(rucToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (!/^(10|20)\d{9}$/.test(clean)) {
      setRucFeedback({
        type: "error",
        message: "El RUC debe tener 11 dígitos y empezar con 10 o 20.",
      });
      setIsRucLocked(false);
      return;
    }

    setIsSearchingRuc(true);
    setRucFeedback(null);

    try {
      const res = await fetchRuc(clean);
      if (res.success && res.legalName) {
        setCompanyName(res.legalName);
        if (res.address) {
          setFiscalAddress(res.address);
        }
        setIsRucLocked(true);
        setRucFeedback({
          type: "success",
          message: `✓ RUC verificado: ${res.status || "ACTIVO"}`,
        });
      } else {
        setIsRucLocked(false);
        setRucFeedback({
          type: "info",
          message: "Completa la Razón Social y Dirección Fiscal manualmente.",
        });
      }
    } catch (err) {
      setIsRucLocked(false);
      setRucFeedback({
        type: "info",
        message: "No pudimos consultar SUNAT. Ingrésalos manualmente.",
      });
    } finally {
      setIsSearchingRuc(false);
    }
  };

  const handleRucChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
    setRuc(val);
    setRucFeedback(null);
    setIsRucLocked(false);

    if (val.length === 11 && /^(10|20)\d{9}$/.test(val)) {
      triggerRucLookup(val);
    }
  };

  const isStep3Valid = useMemo(() => {
    // Validación según método de pago
    if (paymentMethod === "yape_plin") {
      if (!/^\d{6,8}$/.test(yapeOpNumber.trim())) return false;
    }

    // Validación según comprobante
    if (receiptType === "factura") {
      if (!/^(10|20)\d{9}$/.test(ruc.trim())) return false;
      if (companyName.trim().length < 2) return false;
    }

    return true;
  }, [
    paymentMethod,
    yapeOpNumber,
    receiptType,
    ruc,
    companyName,
  ]);

  // Ejecución transaccional del pedido
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validación de comprobante antes de avanzar
    if (receiptType === "factura") {
      if (!/^(10|20)\d{9}$/.test(ruc.trim()) || companyName.trim().length < 2) {
        setRucFeedback({
          type: "error",
          message: "Por favor completa un RUC y Razón Social válidos para la Factura.",
        });
        return;
      }
    }

    // Flujo Online Culqi
    if (paymentMethod === "culqi_gateway") {
      setCulqiError(null);
      try {
        initCulqi({
          title: "ERXIDI - Confecciones",
          amountInCents: totalAmount * 100,
        });
        openCulqi();
      } catch (err) {
        console.error("Error al iniciar Culqi:", err);
        setCulqiError(err.message || "No se pudo abrir la pasarela Culqi.");
      }
      return;
    }

    // Flujo Transferencia Directa (Yape / Plin Manual)
    if (!isStep3Valid) return;

    setIsSubmitting(true);
    setCulqiError(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalAddress =
      deliveryType === "pickup"
        ? pickupStoreInfo.address
        : `${deliveryAddress.trim()}${
            deliveryReference.trim()
              ? ` (Ref: ${deliveryReference.trim()})`
              : ""
          } - ${selectedZone?.district_name || "Lima"}`;

    const invoicePrefix =
      receiptType === "factura"
        ? "F001"
        : receiptType === "boleta"
          ? "B001"
          : "NV01";
    const invoiceDocNumber = `${invoicePrefix}-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      type: receiptType,
      doc_number: invoiceDocNumber,
      tax_id: receiptType === "factura" ? ruc.trim() : dni.trim(),
      legal_name: receiptType === "factura" ? companyName.trim() : fullName,
      fiscal_address:
        receiptType === "factura"
          ? fiscalAddress.trim() || finalAddress
          : finalAddress,
      issued_at: new Date().toISOString(),
    };

    const orderPayload = {
      userId: user?.id || null,
      customerName: fullName,
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      deliveryType,
      deliveryAddress: finalAddress,
      deliveryZoneId:
        deliveryType === "pickup" ? null : selectedZone?.id || null,
      deliveryCost,
      scheduledTimeSlot:
        deliveryType === "scheduled"
          ? scheduledTimeSlot
          : deliveryType === "express"
            ? "Express Mismo Día"
            : "Horario Comercial 09:00 - 18:00",
      subtotal,
      totalAmount,
      payment_method: "yape_plin",
      paymentMethod: "yape_plin",
      payment_status: "pending_verification",
      paymentStatus: "pending_verification",
      payment_gateway_tx_id: yapeOpNumber.trim(),
      paymentGatewayTxId: yapeOpNumber.trim(),
      invoice_type: receiptType,
      invoice_data: invoiceData,
      items,
    };

    try {
      const result = await createOrder(orderPayload);
      if (result.success && result.order) {
        clearCart();
        navigate(`/checkout/confirmacion/${result.order.order_number}`, {
          state: { order: result.order },
        });
      }
    } catch (err) {
      console.error("Error al procesar la compra:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepClick = (step) => {
    if (step === 1) setCurrentStep(1);
    if (step === 2 && completedSteps[1]) setCurrentStep(2);
    if (step === 3 && completedSteps[1] && completedSteps[2]) setCurrentStep(3);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount || 0);

  // -------------------------------------------------------------
  // VISTA DE CARRITO VACÍO
  // -------------------------------------------------------------
  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-muted">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-brand-primary">
            Tu carrito está vacío
          </h2>
          <p className="text-xs text-brand-secondary max-w-sm">
            Para iniciar el proceso de checkout, primero añade prendas a tu
            bolsa de compras.
          </p>
        </div>
        <Link to="/catalogo">
          <Button variant="primary" size="md">
            Explorar Catálogo
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Encabezado y Barra de Progreso */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link
              to="/catalogo"
              className="p-1 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors"
              title="Volver al catálogo"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-primary">
              Proceso de Compra
            </h1>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            Paso {currentStep} de 3
          </Badge>
        </div>

        {/* Stepper Progress Tabs */}
        <nav aria-label="Progreso de Checkout" className="pt-4">
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Paso 1 */}
            <li
              onClick={() => handleStepClick(1)}
              className={`p-3 rounded-card border transition-all cursor-pointer select-none flex items-center gap-3 ${
                currentStep === 1
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : completedSteps[1]
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-brand-primary"
                    : "border-border bg-surface-subtle opacity-70"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[1]
                    ? "bg-emerald-600 text-white"
                    : currentStep === 1
                      ? "bg-brand-primary text-white"
                      : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                {completedSteps[1] ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 1
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Identificación
                </span>
              </div>
            </li>

            {/* Paso 2 */}
            <li
              onClick={() => handleStepClick(2)}
              className={`p-3 rounded-card border transition-all ${
                completedSteps[1]
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              } select-none flex items-center gap-3 ${
                currentStep === 2
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : completedSteps[2]
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-brand-primary"
                    : "border-border bg-surface-subtle"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[2]
                    ? "bg-emerald-600 text-white"
                    : currentStep === 2
                      ? "bg-brand-primary text-white"
                      : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                {completedSteps[2] ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 2
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Entrega
                </span>
              </div>
            </li>

            {/* Paso 3 */}
            <li
              onClick={() => handleStepClick(3)}
              className={`p-3 rounded-card border transition-all ${
                completedSteps[1] && completedSteps[2]
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              } select-none flex items-center gap-3 ${
                currentStep === 3
                  ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary"
                  : "border-border bg-surface-subtle"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  currentStep === 3
                    ? "bg-brand-primary text-white"
                    : "bg-surface-subtle text-brand-secondary border border-border"
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Paso 3
                </span>
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Pago
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Grid Principal a Dos Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Principal: Formulario del Paso Activo (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ========================================================= */}
          {/* PASO 1: Identificación y Contacto */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  1. Identificación y Contacto
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Ingresa tus datos personales para validar tu identidad con
                  RENIEC y coordinar el despacho.
                </p>
              </div>

              <form onSubmit={handleNextFromStep1} className="space-y-4">
                {/* DNI con Búsqueda Manual / Enter / Auto */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="checkout-dni"
                      className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                    >
                      DNI (8 dígitos)
                    </label>
                    {isSearchingDni && (
                      <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Consultando RENIEC...
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        id="checkout-dni"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ingresa 8 dígitos"
                        value={dni}
                        onChange={handleDniChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            triggerDniLookup();
                          }
                        }}
                        disabled={Boolean(user && profile?.document_number)}
                        required
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => triggerDniLookup()}
                      disabled={isSearchingDni || dni.length !== 8}
                      className="h-10 px-3.5 flex-shrink-0"
                      title="Consultar DNI en RENIEC"
                    >
                      {isSearchingDni ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <Search className="w-4 h-4 text-brand-primary" />
                      )}
                    </Button>
                  </div>

                  {dniFeedback && (
                    <div
                      className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                        dniFeedback.type === "success"
                          ? "text-emerald-600 font-medium"
                          : "text-amber-600"
                      }`}
                    >
                      {dniFeedback.type === "success" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{dniFeedback.message}</span>
                    </div>
                  )}

                  {isNameLocked && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setIsNameLocked(false)}
                        className="text-xs text-accent hover:text-accent-hover font-semibold hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar nombres manualmente
                      </button>
                    </div>
                  )}
                </div>

                {/* Nombres y Apellidos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Nombres"
                    id="checkout-firstname"
                    placeholder="Tus nombres"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isNameLocked}
                    required
                  />

                  <Input
                    label="Apellidos"
                    id="checkout-lastname"
                    placeholder="Tus apellidos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isNameLocked}
                    required
                  />
                </div>

                {/* Email y Teléfono WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Correo Electrónico"
                    id="checkout-email"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <div>
                    <Input
                      label="WhatsApp / Celular"
                      id="checkout-phone"
                      type="tel"
                      placeholder="9XXXXXXXX (9 dígitos)"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      required
                    />
                    <span className="text-[10px] text-brand-muted mt-1 block">
                      Usado para validar el pago y coordinar la entrega.
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isStep1Valid}
                  >
                    Continuar a Entrega
                    <ChevronRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 2: Método de Entrega y Horarios */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  2. Método de Entrega y Horarios
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Elige la modalidad que mejor se adapte a tus necesidades.
                </p>
              </div>

              <form onSubmit={handleNextFromStep2} className="space-y-6">
                {/* 3 Opciones de Entrega */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Opción 1: Recojo en Tienda */}
                  <label
                    onClick={() => setDeliveryType("pickup")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "pickup"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "pickup"}
                      onChange={() => setDeliveryType("pickup")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Store className="w-5 h-5 text-accent" />
                        <Badge variant="success" className="text-[10px]">
                          Gratis
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Recojo en Tienda
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Stand Central ERXIDI
                      </span>
                    </div>
                  </label>

                  {/* Opción 2: Envío Express */}
                  <label
                    onClick={() => setDeliveryType("express")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "express"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "express"}
                      onChange={() => setDeliveryType("express")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-5 h-5 text-accent" />
                        <Badge variant="warning" className="text-[10px]">
                          Mismo Día
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Express
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Entrega prioritaria en 45 a 90 min
                      </span>
                    </div>
                  </label>

                  {/* Opción 3: Envío Programado */}
                  <label
                    onClick={() => setDeliveryType("scheduled")}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === "scheduled"
                        ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === "scheduled"}
                      onChange={() => setDeliveryType("scheduled")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Calendar className="w-5 h-5 text-accent" />
                        <Badge variant="success" className="text-[10px]">
                          Gratis
                        </Badge>
                        <Badge variant="neutral" className="text-[10px]">
                          Día Siguiente
                        </Badge>
                      </div>
                      <span className="block text-xs font-bold text-brand-primary">
                        Envío Programado
                      </span>
                      <span className="block text-[11px] text-brand-secondary mt-1 leading-snug">
                        Elige tu ventana horaria preferida
                      </span>
                    </div>
                  </label>
                </div>

                {/* Detalle de Recojo */}
                {deliveryType === "pickup" && (
                  <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-brand-primary">
                      <Store className="w-4 h-4 text-accent" />
                      <span>{pickupStoreInfo.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-brand-secondary">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Horario fijo: Lunes a Sábado de 09:00 a 18:00</span>
                    </div>
                    <div className="flex items-center gap-2 text-brand-secondary">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Coordinación previa: {pickupStoreInfo.phone}</span>
                    </div>
                  </div>
                )}

                {/* Detalle de Envío Express */}
                {deliveryType === "express" && (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="font-semibold">{expressTimeWindow}</span>
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-express-zone"
                        className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
                      >
                        Distrito de Lima
                      </label>
                      <select
                        id="checkout-express-zone"
                        value={selectedZoneId}
                        onChange={(e) =>
                          setSelectedZoneId(Number(e.target.value))
                        }
                        className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        {defaultDeliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.district_name} (+S/ 5.00 Express &bull; Total:{" "}
                            {formatCurrency(zone.delivery_cost + 5.0)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Input
                      label="Dirección Exacta"
                      id="checkout-express-address"
                      placeholder="Calle / Av., Número, Interior o Departamento"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />

                    <Input
                      label="Referencia de Llegada"
                      id="checkout-express-ref"
                      placeholder="Ej. Frente al parque, puerta blanca, timbre 2"
                      value={deliveryReference}
                      onChange={(e) => setDeliveryReference(e.target.value)}
                    />
                  </div>
                )}

                {/* Detalle de Envío Programado */}
                {deliveryType === "scheduled" && (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div>
                      <label
                        htmlFor="checkout-scheduled-zone"
                        className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
                      >
                        Distrito de Lima
                      </label>
                      <select
                        id="checkout-scheduled-zone"
                        value={selectedZoneId}
                        onChange={(e) =>
                          setSelectedZoneId(Number(e.target.value))
                        }
                        className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        {defaultDeliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.district_name} (
                            {formatCurrency(zone.delivery_cost)} -{" "}
                            {zone.estimated_delivery_time})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selector de Ventana Horaria */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5">
                        Ventana Horaria (Día Siguiente)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {defaultDeliverySlots.map((slot) => {
                          const isSelected = scheduledTimeSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setScheduledTimeSlot(slot)}
                              className={`p-3 rounded-button border text-xs font-semibold flex items-center justify-between transition-colors focus:outline-none ${
                                isSelected
                                  ? "border-brand-primary bg-surface-subtle text-brand-primary ring-1 ring-brand-primary"
                                  : "border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary"
                              }`}
                            >
                              <span>{slot}</span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-accent" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Input
                      label="Dirección Exacta"
                      id="checkout-scheduled-address"
                      placeholder="Calle / Av., Número, Interior o Departamento"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />

                    <Input
                      label="Referencia de Entrega (Opcional)"
                      id="checkout-scheduled-ref"
                      placeholder="Ej. Casa verde, rejas negras"
                      value={deliveryReference}
                      onChange={(e) => setDeliveryReference(e.target.value)}
                    />
                  </div>
                )}

                <div className="pt-4 flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setCurrentStep(1)}
                  >
                    Regresar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isStep2Valid}
                  >
                    Continuar al Pago
                    <ChevronRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: Pago y Comprobante */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-base font-bold text-brand-primary">
                  3. Pago y Comprobante
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Selecciona tu forma de pago y los datos para tu comprobante.
                </p>
              </div>

              <form onSubmit={handleConfirmOrder} className="space-y-6">
                {/* A. SECCIÓN COMPROBANTES: Tarjetas Segmentadas */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Tipo de Comprobante
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Nota de Venta */}
                    <div
                      onClick={() => setReceiptType("nota_venta")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "nota_venta"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Nota de Venta
                        </span>
                        {receiptType === "nota_venta" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Control interno de pedido
                      </span>
                    </div>

                    {/* 2. Boleta de Venta */}
                    <div
                      onClick={() => setReceiptType("boleta")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "boleta"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Boleta de Venta
                        </span>
                        {receiptType === "boleta" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Consumo personal / DNI
                      </span>
                    </div>

                    {/* 3. Factura Electrónica */}
                    <div
                      onClick={() => setReceiptType("factura")}
                      className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                        receiptType === "factura"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-brand-primary">
                          Factura Electrónica
                        </span>
                        {receiptType === "factura" && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <span className="text-xs text-brand-secondary">
                        Para empresas / RUC
                      </span>
                    </div>
                  </div>

                  {/* Detalle Boleta: Reutilización de DNI y Nombres de Paso 1 */}
                  {receiptType === "boleta" && (
                    <div className="p-3.5 bg-surface-subtle border border-border rounded-card text-xs space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-brand-secondary font-medium">
                          Titular del comprobante:
                        </span>
                        <span className="font-semibold text-brand-primary truncate max-w-[240px] text-right">
                          {firstName} {lastName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-brand-secondary font-medium">
                          Documento de Identidad:
                        </span>
                        <span className="font-mono font-semibold text-brand-primary">
                          DNI {dni}
                        </span>
                      </div>
                      <p className="text-[11px] text-brand-muted pt-1 border-t border-border/60">
                        La Boleta se emitirá automáticamente con los datos verificados en el Paso 1.
                      </p>
                    </div>
                  )}

                  {/* Detalle Nota de Venta */}
                  {receiptType === "nota_venta" && (
                    <div className="p-3 bg-surface-subtle border border-border rounded-card text-xs text-brand-secondary animate-in fade-in duration-150">
                      Comprobante para control interno y seguimiento de despacho. No tiene efectos tributarios.
                    </div>
                  )}

                  {/* Detalle Factura: Formulario RUC, Razón Social y Dirección Fiscal */}
                  {receiptType === "factura" && (
                    <div className="space-y-3.5 p-4 bg-surface-subtle border border-border rounded-card animate-in fade-in duration-150">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="checkout-ruc"
                            className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                          >
                            RUC (11 dígitos)
                          </label>
                          {isSearchingRuc && (
                            <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Consultando SUNAT...
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <Input
                              id="checkout-ruc"
                              type="text"
                              inputMode="numeric"
                              placeholder="20XXXXXXXXX o 10XXXXXXXXX"
                              value={ruc}
                              onChange={handleRucChange}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  triggerRucLookup();
                                }
                              }}
                              required
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => triggerRucLookup()}
                            disabled={isSearchingRuc || ruc.length !== 11}
                            className="h-10 px-3.5 flex-shrink-0"
                            title="Consultar RUC en SUNAT"
                          >
                            {isSearchingRuc ? (
                              <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            ) : (
                              <Search className="w-4 h-4 text-brand-primary" />
                            )}
                          </Button>
                        </div>

                        {rucFeedback && (
                          <div
                            className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                              rucFeedback.type === "success"
                                ? "text-emerald-600 font-medium"
                                : rucFeedback.type === "error"
                                  ? "text-rose-600 font-medium"
                                  : "text-amber-600"
                            }`}
                          >
                            {rucFeedback.type === "success" ? (
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span>{rucFeedback.message}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1.5">
                            <label
                              htmlFor="checkout-company"
                              className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                            >
                              Razón Social
                            </label>
                            {isRucLocked && (
                              <button
                                type="button"
                                onClick={() => setIsRucLocked(false)}
                                className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Editar manualmente
                              </button>
                            )}
                          </div>
                          <Input
                            id="checkout-company"
                            placeholder="Nombre comercial o razón social"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            readOnly={isRucLocked}
                            className={
                              isRucLocked
                                ? "bg-slate-100 text-slate-700 cursor-not-allowed"
                                : ""
                            }
                            required
                          />
                        </div>

                        <Input
                          label="Dirección Fiscal (Opcional)"
                          id="checkout-fiscal-address"
                          placeholder="Dirección fiscal registrada"
                          value={fiscalAddress}
                          onChange={(e) => setFiscalAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* B. SECCIÓN MÉTODOS DE PAGO: Dos opciones interactivas */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Método de Pago
                  </label>

                  <div className="space-y-3">
                    {/* 1. Transferencia Directa (Yape / Plin Manual) */}
                    <div
                      onClick={() => setPaymentMethod("yape_plin")}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === "yape_plin"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/30"
                      }`}
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors border-brand-primary bg-brand-primary text-white">
                        {paymentMethod === "yape_plin" ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-brand-primary">
                            Transferencia Directa (Yape / Plin Manual)
                          </span>
                          <Badge variant="neutral" className="text-[10px]">
                            Sin recargo
                          </Badge>
                        </div>
                        <span className="block text-xs text-brand-secondary mt-1">
                          Transfiere desde tu app bancaria e ingresa el número de operación.
                        </span>
                      </div>
                    </div>

                    {/* Sub-bloque Yape / Plin Manual */}
                    {paymentMethod === "yape_plin" && (
                      <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-4 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                          {/* Datos institucionales */}
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between sm:block border-b sm:border-b-0 border-border pb-1.5 sm:pb-0">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Número Institucional:
                              </span>
                              <span className="font-mono text-sm font-bold text-brand-primary">
                                987 654 321
                              </span>
                            </div>
                            <div className="flex justify-between sm:block border-b sm:border-b-0 border-border pb-1.5 sm:pb-0">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Titular:
                              </span>
                              <span className="font-semibold text-brand-primary">
                                ERXIDI S.A.C.
                              </span>
                            </div>
                            <div className="flex justify-between sm:block">
                              <span className="text-brand-secondary block text-[11px] uppercase tracking-wider font-semibold">
                                Monto a Transferir:
                              </span>
                              <span className="font-mono text-sm font-bold text-accent">
                                {formatCurrency(totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Contenedor visual sobrio para el QR */}
                          <div className="flex flex-col items-center justify-center p-3.5 bg-surface-card border border-border rounded-card text-center space-y-1.5">
                            <div className="w-24 h-24 rounded border border-border bg-white flex items-center justify-center p-2 shadow-xs">
                              <QrCode className="w-20 h-20 text-brand-primary" />
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                              QR Institucional Yape / Plin
                            </span>
                          </div>
                        </div>

                        {/* Input Número de Operación */}
                        <div className="pt-2 border-t border-border space-y-1.5">
                          <Input
                            label="Número de Operación (6 a 8 dígitos)"
                            id="checkout-yape-op"
                            placeholder="Ej. 12345678"
                            value={yapeOpNumber}
                            onChange={(e) =>
                              setYapeOpNumber(
                                e.target.value.replace(/\D/g, "").slice(0, 8),
                              )
                            }
                            helperText="Ingresa el código numérico de 6 a 8 dígitos que figura en tu comprobante de Yape o Plin."
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* 2. Pago Online Seguro (Culqi: Tarjetas de Débito/Crédito y Yape App) */}
                    <div
                      onClick={() => setPaymentMethod("culqi_gateway")}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === "culqi_gateway"
                          ? "border-brand-primary bg-surface-subtle ring-1 ring-brand-primary"
                          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-subtle/30"
                      }`}
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors border-brand-primary bg-brand-primary text-white">
                        {paymentMethod === "culqi_gateway" ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-primary">
                              Pago Online Seguro (Culqi: Tarjetas y Yape App)
                            </span>
                            <Badge variant="success" className="text-[10px]">
                              Acreditación Inmediata
                            </Badge>
                          </div>
                          <CreditCard className="w-4 h-4 text-accent" />
                        </div>
                        <p className="text-xs text-brand-secondary mt-1">
                          Acepta Visa, Mastercard y Yape con código de aprobación. Procesado de forma segura por Culqi
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Alerta de Culqi en caso de error */}
                  {culqiError && (
                    <div className="p-3 bg-rose-50 border border-status-danger-border rounded-card text-xs text-status-danger-text flex items-start gap-2 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-status-danger-text" />
                      <div className="flex-1">
                        <p className="font-semibold">Inconveniente con la pasarela</p>
                        <p>{culqiError}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones Finales */}
                <div className="pt-4 flex justify-between items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setCurrentStep(2)}
                    disabled={isSubmitting}
                  >
                    Regresar
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isStep3Valid || isSubmitting}
                    isLoading={isSubmitting}
                    className="bg-accent hover:bg-accent-hover text-white px-8"
                  >
                    {paymentMethod === "culqi_gateway"
                      ? `Pagar con Culqi ${formatCurrency(totalAmount)}`
                      : `Confirmar Pedido ${formatCurrency(totalAmount)}`}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Columna Lateral: Resumen Financiero Inmutable (lg:col-span-4) */}
        <aside className="lg:col-span-4">
          <div className="bg-surface-card border border-border rounded-card p-5 space-y-5 sticky top-24 shadow-subtle">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-primary">
                Resumen del Pedido
              </h3>
              <Badge variant="neutral" className="text-[11px] font-mono">
                {totalUnits} {totalUnits === 1 ? "prenda" : "prendas"}
              </Badge>
            </div>

            {/* Lista compacta de items */}
            <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-3 text-xs items-center justify-between"
                >
                  <div className="flex gap-2.5 items-center min-w-0">
                    <div className="w-10 h-12 rounded bg-surface-subtle border border-border overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-brand-muted">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-brand-primary truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-brand-secondary">
                        Talla:{" "}
                        <span className="font-mono font-semibold">
                          {item.size}
                        </span>{" "}
                        &bull; Cant: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-brand-primary flex-shrink-0">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Desglose Financiero */}
            <div className="border-t border-border pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-brand-secondary">
                <span>Subtotal prendas:</span>
                <span className="font-mono font-semibold text-brand-primary">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex justify-between text-brand-secondary">
                <span>Costo de envío:</span>
                <span className="font-mono font-semibold text-brand-primary">
                  {deliveryCost === 0 ? (
                    <span className="text-emerald-600 font-bold">Gratis</span>
                  ) : (
                    formatCurrency(deliveryCost)
                  )}
                </span>
              </div>

              <div className="border-t border-border pt-2 flex justify-between items-baseline text-sm">
                <span className="font-bold text-brand-primary">Total:</span>
                <span className="font-mono text-lg font-extrabold text-brand-primary">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* Aviso Sanitario Obligatorio */}
            <div className="p-3 bg-surface-subtle border border-border rounded text-[11px] text-brand-secondary flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Por motivos de higiene, la ropa interior no admite cambios ni
                devoluciones una vez entregada.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
