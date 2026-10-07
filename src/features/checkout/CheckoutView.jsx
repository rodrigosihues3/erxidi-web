import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Banknote,
  Lock,
  Search,
  Edit3,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { fetchDni, fetchRuc } from '../../services/api/decolectaService';
import { createOrder } from '../../services/api/checkoutService';
import {
  defaultDeliveryZones,
  defaultDeliverySlots,
  pickupStoreInfo,
} from './data/mockDeliveryZones';

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
  const [dni, setDni] = useState(profile?.document_number || '');
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');

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
    const clean = String(dniToSearch || '').replace(/\D/g, '').slice(0, 8);
    if (!/^\d{8}$/.test(clean)) {
      setDniFeedback({
        type: 'error',
        message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
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
          `${res.firstLastName || ''} ${res.secondLastName || ''}`.trim()
        );
        setIsNameLocked(true);
        setDniFeedback({
          type: 'success',
          message: 'Identidad verificada exitosamente en RENIEC.',
        });
      } else {
        setIsNameLocked(false);
        setDniFeedback({
          type: 'info',
          message: 'No pudimos autocompletar tus datos. Ingrésalos manualmente.',
        });
      }
    } catch (err) {
      setIsNameLocked(false);
      setDniFeedback({
        type: 'info',
        message: 'Servicio no disponible momentáneamente. Ingresa tus datos manualmente.',
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  // Manejo de cambio en DNI con auto-lookup reactivo al 8vo dígito
  const handleDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 8);
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
    const isNameValid = firstName.trim().length > 1 && lastName.trim().length > 1;
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
  const [deliveryType, setDeliveryType] = useState('scheduled');
  const [selectedZoneId, setSelectedZoneId] = useState(
    defaultDeliveryZones[0]?.id || 1
  );
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(
    defaultDeliverySlots[0]
  );

  // Cálculo dinámico de ventana de envío express (hora actual + 45min a + 90min)
  const expressTimeWindow = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 45 * 60000);
    const end = new Date(now.getTime() + 90 * 60000);
    const formatH = (d) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `Tu pedido llegará hoy entre las ${formatH(start)} y ${formatH(end)} hrs`;
  }, []);

  const selectedZone = useMemo(
    () => defaultDeliveryZones.find((z) => z.id === Number(selectedZoneId)),
    [selectedZoneId]
  );

  const deliveryCost = useMemo(() => {
    if (deliveryType === 'pickup') return 0;
    const baseCost = selectedZone?.delivery_cost || 10.0;
    if (deliveryType === 'express') {
      return baseCost + 5.0; // Recargo express prioritario
    }
    return baseCost;
  }, [deliveryType, selectedZone]);

  const totalAmount = subtotal + deliveryCost;

  const isStep2Valid = useMemo(() => {
    if (deliveryType === 'pickup') return true;
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
  const [paymentMethod, setPaymentMethod] = useState('yape_plin');
  const [yapeOpNumber, setYapeOpNumber] = useState('');

  // Simulación de tarjeta
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Comprobante y Facturación
  const [receiptType, setReceiptType] = useState('boleta'); // 'none' | 'boleta' | 'factura'
  const [ruc, setRuc] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [rucFeedback, setRucFeedback] = useState(null);

  // Consulta de RUC con Decolecta
  const triggerRucLookup = async (rucToSearch = ruc) => {
    const clean = String(rucToSearch || '').replace(/\D/g, '').slice(0, 11);
    if (!/^(10|20)\d{9}$/.test(clean)) {
      setRucFeedback({
        type: 'error',
        message: 'El RUC debe tener 11 dígitos y empezar con 10 o 20.',
      });
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
        setRucFeedback({
          type: 'success',
          message: `RUC verificado: ${res.status || 'ACTIVO'}`,
        });
      } else {
        setRucFeedback({
          type: 'info',
          message: 'Completa la Razón Social y Dirección Fiscal manualmente.',
        });
      }
    } catch (err) {
      setRucFeedback({
        type: 'info',
        message: 'No pudimos consultar SUNAT. Ingrésalos manualmente.',
      });
    } finally {
      setIsSearchingRuc(false);
    }
  };

  const handleRucChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    setRuc(val);
    setRucFeedback(null);

    if (val.length === 11 && /^(10|20)\d{9}$/.test(val)) {
      triggerRucLookup(val);
    }
  };

  // Formateador de tarjeta 16 dígitos
  const handleCardNumberChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = clean.match(/.{1,4}/g)?.join(' ') || clean;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setCardExpiry(clean);
    }
  };

  const isStep3Valid = useMemo(() => {
    // Validación según método de pago
    if (paymentMethod === 'yape_plin') {
      if (!/^\d{6,8}$/.test(yapeOpNumber.trim())) return false;
    } else if (paymentMethod === 'card') {
      const cleanDigits = cardNumber.replace(/\s/g, '');
      if (cleanDigits.length !== 16) return false;
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return false;
      if (!/^\d{3}$/.test(cardCvv)) return false;
    } else if (paymentMethod === 'cash_on_delivery') {
      if (!user) return false; // Regla de negocio: solo registrados
    }

    // Validación según comprobante
    if (receiptType === 'factura') {
      if (!/^(10|20)\d{9}$/.test(ruc.trim())) return false;
      if (companyName.trim().length < 2) return false;
    }

    return true;
  }, [
    paymentMethod,
    yapeOpNumber,
    cardNumber,
    cardExpiry,
    cardCvv,
    user,
    receiptType,
    ruc,
    companyName,
  ]);

  // Ejecución transaccional del pedido
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (!isStep3Valid || isSubmitting) return;

    setIsSubmitting(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalAddress =
      deliveryType === 'pickup'
        ? pickupStoreInfo.address
        : `${deliveryAddress.trim()}${
            deliveryReference.trim() ? ` (Ref: ${deliveryReference.trim()})` : ''
          } - ${selectedZone?.district_name || 'Lima'}`;

    const txId =
      paymentMethod === 'yape_plin'
        ? `OP-${yapeOpNumber.trim()}`
        : paymentMethod === 'card'
        ? `AUTH-${Date.now().toString().slice(-6)}`
        : null;

    const paymentStatus =
      paymentMethod === 'card'
        ? 'completed'
        : paymentMethod === 'yape_plin'
        ? 'pending_verification'
        : 'pending';

    const invoiceDocNumber = `${
      receiptType === 'factura' ? 'F001' : 'B001'
    }-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      type: receiptType,
      doc_number: invoiceDocNumber,
      tax_id: receiptType === 'factura' ? ruc.trim() : dni.trim(),
      legal_name:
        receiptType === 'factura' ? companyName.trim() : fullName,
      fiscal_address:
        receiptType === 'factura'
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
      deliveryZoneId: deliveryType === 'pickup' ? null : selectedZone?.id || null,
      deliveryCost,
      scheduledTimeSlot:
        deliveryType === 'scheduled'
          ? scheduledTimeSlot
          : deliveryType === 'express'
          ? 'Express Mismo Día'
          : 'Horario Comercial 09:00 - 18:00',
      subtotal,
      totalAmount,
      paymentMethod,
      paymentStatus,
      paymentGatewayTxId: txId,
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
      console.error('Error al procesar la compra:', err);
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
    new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
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
            Para iniciar el proceso de checkout, primero añade prendas a tu bolsa de compras.
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
                  ? 'border-brand-primary bg-surface-card ring-1 ring-brand-primary'
                  : completedSteps[1]
                  ? 'border-emerald-300 bg-emerald-50/40 hover:border-brand-primary'
                  : 'border-border bg-surface-subtle opacity-70'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[1]
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 1
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-subtle text-brand-secondary border border-border'
                }`}
              >
                {completedSteps[1] ? <Check className="w-4 h-4" /> : '1'}
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
                completedSteps[1] ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              } select-none flex items-center gap-3 ${
                currentStep === 2
                  ? 'border-brand-primary bg-surface-card ring-1 ring-brand-primary'
                  : completedSteps[2]
                  ? 'border-emerald-300 bg-emerald-50/40 hover:border-brand-primary'
                  : 'border-border bg-surface-subtle'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  completedSteps[2]
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 2
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-subtle text-brand-secondary border border-border'
                }`}
              >
                {completedSteps[2] ? <Check className="w-4 h-4" /> : '2'}
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
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
              } select-none flex items-center gap-3 ${
                currentStep === 3
                  ? 'border-brand-primary bg-surface-card ring-1 ring-brand-primary'
                  : 'border-border bg-surface-subtle'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  currentStep === 3
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-subtle text-brand-secondary border border-border'
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
                  Ingresa tus datos personales para validar tu identidad con RENIEC y coordinar el despacho.
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
                          if (e.key === 'Enter') {
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
                        dniFeedback.type === 'success'
                          ? 'text-emerald-600 font-medium'
                          : 'text-amber-600'
                      }`}
                    >
                      {dniFeedback.type === 'success' ? (
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
                        setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))
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
                    onClick={() => setDeliveryType('pickup')}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === 'pickup'
                        ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary'
                        : 'border-border bg-surface-card hover:border-border-strong'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === 'pickup'}
                      onChange={() => setDeliveryType('pickup')}
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
                    onClick={() => setDeliveryType('express')}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === 'express'
                        ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary'
                        : 'border-border bg-surface-card hover:border-border-strong'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === 'express'}
                      onChange={() => setDeliveryType('express')}
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
                    onClick={() => setDeliveryType('scheduled')}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      deliveryType === 'scheduled'
                        ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary'
                        : 'border-border bg-surface-card hover:border-border-strong'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      checked={deliveryType === 'scheduled'}
                      onChange={() => setDeliveryType('scheduled')}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Calendar className="w-5 h-5 text-accent" />
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
                {deliveryType === 'pickup' && (
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
                {deliveryType === 'express' && (
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
                        onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        {defaultDeliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.district_name} (+S/ 5.00 Express &bull; Total: {formatCurrency(zone.delivery_cost + 5.0)})
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
                {deliveryType === 'scheduled' && (
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
                        onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        {defaultDeliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.district_name} ({formatCurrency(zone.delivery_cost)} - {zone.estimated_delivery_time})
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
                                  ? 'border-brand-primary bg-surface-subtle text-brand-primary ring-1 ring-brand-primary'
                                  : 'border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary'
                              }`}
                            >
                              <span>{slot}</span>
                              {isSelected && <Check className="w-4 h-4 text-accent" />}
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
                {/* Selector de Método de Pago */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Método de Pago
                  </label>

                  <div className="space-y-3">
                    {/* 1. Yape / Plin */}
                    <label
                      onClick={() => setPaymentMethod('yape_plin')}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === 'yape_plin'
                          ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary'
                          : 'border-border bg-surface-card hover:border-border-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === 'yape_plin'}
                        onChange={() => setPaymentMethod('yape_plin')}
                        className="sr-only"
                      />
                      <CreditCard className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="block text-sm font-bold text-brand-primary">
                          Billetera Digital (Yape / Plin)
                        </span>
                        <span className="block text-xs text-brand-secondary mt-0.5">
                          Transferencia al número <strong className="text-brand-primary">987 654 321</strong> (Titular: ERXIDI S.A.C.)
                        </span>
                      </div>
                    </label>

                    {/* Sub-form Yape: Número de Operación */}
                    {paymentMethod === 'yape_plin' && (
                      <div className="p-3.5 bg-surface-subtle border border-border rounded-card space-y-2 animate-in fade-in duration-150">
                        <Input
                          label="Número de Operación (6 a 8 dígitos)"
                          id="checkout-yape-op"
                          placeholder="Ej. 12345678"
                          value={yapeOpNumber}
                          onChange={(e) =>
                            setYapeOpNumber(
                              e.target.value.replace(/\D/g, '').slice(0, 8)
                            )
                          }
                          required
                        />
                        <span className="text-[11px] text-brand-muted block">
                          Ingresa el código numérico que figura en tu constancia de Yape o Plin.
                        </span>
                      </div>
                    )}

                    {/* 2. Tarjeta de Débito / Crédito (Simulador Demo) */}
                    <label
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 rounded-card border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        paymentMethod === 'card'
                          ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary'
                          : 'border-border bg-surface-card hover:border-border-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                        className="sr-only"
                      />
                      <CreditCard className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-brand-primary">
                            Tarjeta de Débito / Crédito
                          </span>
                          <Badge variant="neutral" className="text-[10px]">
                            Simulador Demo
                          </Badge>
                        </div>
                        <span className="block text-xs text-brand-secondary mt-0.5">
                          Acepta Visa, Mastercard y American Express
                        </span>
                      </div>
                    </label>

                    {/* Sub-form Tarjeta */}
                    {paymentMethod === 'card' && (
                      <div className="p-3.5 bg-surface-subtle border border-border rounded-card space-y-3 animate-in fade-in duration-150">
                        <Input
                          label="Número de Tarjeta"
                          id="checkout-card-num"
                          placeholder="4557 1234 5678 9010"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          required
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Vencimiento"
                            id="checkout-card-exp"
                            placeholder="MM/AA"
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            required
                          />
                          <Input
                            label="CVV"
                            id="checkout-card-cvv"
                            placeholder="123"
                            type="password"
                            maxLength={3}
                            value={cardCvv}
                            onChange={(e) =>
                              setCardCvv(
                                e.target.value.replace(/\D/g, '').slice(0, 3)
                              )
                            }
                            required
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Simulación segura de pasarela de pagos.</span>
                        </div>
                      </div>
                    )}

                    {/* 3. Pago Contra Entrega en Efectivo */}
                    <label
                      onClick={() => {
                        if (user) setPaymentMethod('cash_on_delivery');
                      }}
                      className={`p-4 rounded-card border transition-all flex items-start gap-3 select-none ${
                        !user
                          ? 'opacity-60 bg-surface-subtle border-border cursor-not-allowed'
                          : paymentMethod === 'cash_on_delivery'
                          ? 'border-brand-primary bg-surface-subtle ring-1 ring-brand-primary cursor-pointer'
                          : 'border-border bg-surface-card hover:border-border-strong cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        disabled={!user}
                        checked={paymentMethod === 'cash_on_delivery'}
                        onChange={() => {
                          if (user) setPaymentMethod('cash_on_delivery');
                        }}
                        className="sr-only"
                      />
                      <Banknote className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-brand-primary">
                            Pago Contra Entrega en Efectivo
                          </span>
                          {!user && (
                            <Badge variant="neutral" className="text-[10px]">
                              Disponible solo para usuarios registrados
                            </Badge>
                          )}
                        </div>
                        <span className="block text-xs text-brand-secondary mt-0.5">
                          Cancela en efectivo exacto al momento de recibir tus prendas.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selector de Comprobante */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                    Tipo de Comprobante
                  </label>

                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs font-semibold text-brand-primary cursor-pointer">
                      <input
                        type="radio"
                        name="receipt-choice"
                        value="none"
                        checked={receiptType === 'none'}
                        onChange={() => setReceiptType('none')}
                        className="accent-brand-primary"
                      />
                      Sin comprobante
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-brand-primary cursor-pointer">
                      <input
                        type="radio"
                        name="receipt-choice"
                        value="boleta"
                        checked={receiptType === 'boleta'}
                        onChange={() => setReceiptType('boleta')}
                        className="accent-brand-primary"
                      />
                      Boleta de Venta
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-brand-primary cursor-pointer">
                      <input
                        type="radio"
                        name="receipt-choice"
                        value="factura"
                        checked={receiptType === 'factura'}
                        onChange={() => setReceiptType('factura')}
                        className="accent-brand-primary"
                      />
                      Factura Electrónica
                    </label>
                  </div>

                  {/* Campos si es Factura con Búsqueda SUNAT Decolecta */}
                  {receiptType === 'factura' && (
                    <div className="space-y-3 pt-2 p-4 bg-surface-subtle border border-border rounded-card animate-in fade-in duration-150">
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
                            <input
                              id="checkout-ruc"
                              type="text"
                              inputMode="numeric"
                              placeholder="20XXXXXXXXX o 10XXXXXXXXX"
                              value={ruc}
                              onChange={handleRucChange}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  triggerRucLookup();
                                }
                              }}
                              className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
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
                              rucFeedback.type === 'success'
                                ? 'text-emerald-600 font-medium'
                                : 'text-amber-600'
                            }`}
                          >
                            {rucFeedback.type === 'success' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{rucFeedback.message}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Razón Social (Editable)"
                          id="checkout-company"
                          placeholder="Nombre comercial o razón social"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                        />

                        <Input
                          label="Dirección Fiscal (Editable)"
                          id="checkout-fiscal-address"
                          placeholder="Dirección fiscal registrada"
                          value={fiscalAddress}
                          onChange={(e) => setFiscalAddress(e.target.value)}
                        />
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
                    Confirmar Pedido {formatCurrency(totalAmount)}
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
                {totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'}
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
                        Talla:{' '}
                        <span className="font-mono font-semibold">
                          {item.size}
                        </span>{' '}
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
                Por motivos de higiene, la ropa interior no admite cambios ni devoluciones una vez entregada.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
