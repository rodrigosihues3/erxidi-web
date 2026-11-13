import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Smartphone,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Lock,
} from "lucide-react";

/**
 * Réplica autocontenida de Culqi Checkout v4 para modo Sandbox local.
 */
export default function CulqiCheckoutModal({
  isOpen,
  amount = 0,
  customerEmail = "",
  orderNumber,
  onSuccess,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("card"); // "card" | "yape"
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [email, setEmail] = useState(customerEmail || "");

  const [yapePhone, setYapePhone] = useState("");
  const [yapeCode, setYapeCode] = useState("");

  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(customerEmail || "");
      setErrorMsg(null);
      setIsProcessing(false);
    }
  }, [isOpen, customerEmail]);

  if (!isOpen) return null;

  const cleanCardDigits = cardNumber.replace(/\D/g, "");

  const cardBrand = cleanCardDigits.startsWith("4")
    ? "VISA"
    : cleanCardDigits.startsWith("5")
      ? "MASTERCARD"
      : null;

  const handleCardNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
    setErrorMsg(null);
  };

  const handleExpiryChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setExpiry(formatted);
    setErrorMsg(null);
  };

  const handleCvvChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCvv(digits);
    setErrorMsg(null);
  };

  const isValidExpiry = (val) => {
    const match = /^(\d{2})\/(\d{2})$/.exec(val);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    const year = 2000 + parseInt(match[2], 10);
    if (month < 1 || month > 12) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    return true;
  };

  const handleTabChange = (tab) => {
    if (isProcessing) return;
    setActiveTab(tab);
    setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isProcessing) return;
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Ingresa un correo electrónico válido para continuar.");
      return;
    }

    if (activeTab === "card") {
      if (cleanCardDigits === "4000000000000002") {
        setErrorMsg(
          "Tu tarjeta no cuenta con fondos suficientes. Por favor, intenta con otro medio de pago."
        );
        return;
      }

      if (cleanCardDigits.length < 16 || cvv.length < 3 || !isValidExpiry(expiry)) {
        setErrorMsg(
          "No pudimos validar los datos de tu tarjeta, vuelve a intentarlo."
        );
        return;
      }
    } else {
      const cleanPhone = yapePhone.replace(/\D/g, "");
      const cleanCode = yapeCode.replace(/\D/g, "");
      if (cleanPhone.length !== 9 || !cleanPhone.startsWith("9")) {
        setErrorMsg("Ingresa un número de celular Yape válido de 9 dígitos.");
        return;
      }
      if (cleanCode.length !== 6) {
        setErrorMsg("Ingresa el código de aprobación Yape de 6 dígitos.");
        return;
      }
    }

    setIsProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const mockChargeId = `chr_test_${Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase()}`;

      await onSuccess({
        id: mockChargeId,
        object: "charge",
        amount: Math.round(Number(amount) * 100),
        currency_code: "PEN",
        source_id: `tkn_test_${Date.now()}`,
      });
    } catch (err) {
      setErrorMsg(
        err?.message ||
          "Ocurrió un inconveniente al registrar tu pago. Intenta nuevamente."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedAmount = Number(amount || 0).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="culqi-modal-title"
    >
      <div className="w-full max-w-2xl bg-surface-card border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera oscura estilo Culqi Checkout v4 */}
        <div className="bg-neutral-900 text-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-md bg-amber-500 text-neutral-950 font-extrabold text-lg flex items-center justify-center shrink-0 select-none">
                Q
              </div>
              <div className="min-w-0">
                <h2
                  id="culqi-modal-title"
                  className="text-sm font-semibold tracking-tight truncate"
                >
                  ERXIDI — Ropa Interior y Calcetería
                </h2>
                {orderNumber && (
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Pedido #{orderNumber}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              aria-label="Cerrar pasarela de pago"
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
              Total a pagar
            </span>
            <span className="font-mono text-lg font-bold text-amber-400">
              S/ {formattedAmount}
            </span>
          </div>
        </div>

        {/* Cuerpo: panel lateral de métodos + formulario */}
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Panel izquierdo (Tabs) */}
          <aside className="md:col-span-4 bg-surface-subtle border-b md:border-b-0 md:border-r border-border p-3 flex md:flex-col gap-2">
            <button
              type="button"
              onClick={() => handleTabChange("card")}
              disabled={isProcessing}
              className={`flex-1 md:flex-none flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-xs font-semibold transition-colors border ${
                activeTab === "card"
                  ? "bg-surface-card border-amber-500 text-brand-primary shadow-xs"
                  : "border-transparent text-brand-secondary hover:bg-surface-card/60"
              }`}
            >
              <CreditCard
                className={`w-4 h-4 shrink-0 ${
                  activeTab === "card" ? "text-amber-600" : "text-brand-muted"
                }`}
              />
              <span>Tarjeta débito / crédito</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("yape")}
              disabled={isProcessing}
              className={`flex-1 md:flex-none flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-xs font-semibold transition-colors border ${
                activeTab === "yape"
                  ? "bg-surface-card border-amber-500 text-brand-primary shadow-xs"
                  : "border-transparent text-brand-secondary hover:bg-surface-card/60"
              }`}
            >
              <Smartphone
                className={`w-4 h-4 shrink-0 ${
                  activeTab === "yape" ? "text-amber-600" : "text-brand-muted"
                }`}
              />
              <span>Yape</span>
            </button>
          </aside>

          {/* Formulario derecho */}
          <form onSubmit={handleSubmit} className="md:col-span-8 p-5 space-y-4">
            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {activeTab === "card" ? (
              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="culqi-card-number"
                      className="text-xs font-semibold text-brand-primary"
                    >
                      Número de tarjeta
                    </label>
                    {cardBrand && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white font-mono text-[10px] font-bold tracking-wider">
                        {cardBrand}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="culqi-card-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="4111 1111 1111 1111"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      disabled={isProcessing}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="culqi-card-expiry"
                      className="block text-xs font-semibold text-brand-primary mb-1"
                    >
                      Vencimiento (MM/AA)
                    </label>
                    <input
                      id="culqi-card-expiry"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="12/28"
                      value={expiry}
                      onChange={handleExpiryChange}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 text-sm font-mono bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="culqi-card-cvv"
                      className="block text-xs font-semibold text-brand-primary mb-1"
                    >
                      Código de seguridad (CVV)
                    </label>
                    <div className="relative">
                      <input
                        id="culqi-card-cvv"
                        type={showCvv ? "text" : "password"}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        value={cvv}
                        onChange={handleCvvChange}
                        disabled={isProcessing}
                        className="w-full pl-3 pr-9 py-2 text-sm font-mono bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCvv((prev) => !prev)}
                        tabIndex={-1}
                        aria-label={showCvv ? "Ocultar CVV" : "Mostrar CVV"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-primary"
                      >
                        {showCvv ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="culqi-yape-phone"
                    className="block text-xs font-semibold text-brand-primary mb-1"
                  >
                    Número de celular Yape
                  </label>
                  <input
                    id="culqi-yape-phone"
                    type="text"
                    inputMode="numeric"
                    placeholder="999888777"
                    value={yapePhone}
                    onChange={(e) => {
                      setYapePhone(
                        e.target.value.replace(/\D/g, "").slice(0, 9)
                      );
                      setErrorMsg(null);
                    }}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm font-mono bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="culqi-yape-code"
                    className="block text-xs font-semibold text-brand-primary mb-1"
                  >
                    Código de aprobación (6 dígitos)
                  </label>
                  <input
                    id="culqi-yape-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={yapeCode}
                    onChange={(e) => {
                      setYapeCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6)
                      );
                      setErrorMsg(null);
                    }}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm font-mono bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="culqi-email"
                className="block text-xs font-semibold text-brand-primary mb-1"
              >
                Correo electrónico
              </label>
              <input
                id="culqi-email"
                type="email"
                autoComplete="email"
                placeholder="cliente@correo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                disabled={isProcessing}
                className="w-full px-3 py-2 text-sm bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando pago...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span className="font-mono">Pagar S/ {formattedAmount}</span>
                </>
              )}
            </button>

            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-brand-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Compra segura con PCI DSS · Verified by Visa</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

