import { useState, useEffect } from "react";
import { X, Copy, Check, CheckCircle2, XCircle } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import {
  verifyOrderPayment,
  rejectOrderPayment,
} from "../services/adminOrders.service";

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

export default function OrderPaymentModal({ order, isOpen, onClose, onSuccess }) {
  const [copied, setCopied] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setShowRejectForm(false);
      setRejectReason("");
      setError("");
      setLoading(false);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const customerName =
    order.customer_name ||
    [order.profiles?.first_name, order.profiles?.paternal_surname]
      .filter(Boolean)
      .join(" ") ||
    "Cliente";

  const customerPhone = order.customer_phone || order.profiles?.phone || "—";
  const txId = order.payment_gateway_tx_id || "";

  function handleCopy() {
    if (!txId) return;
    navigator.clipboard.writeText(txId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      const updated = await verifyOrderPayment(order.id);
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Error al verificar el pago.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError("");
    try {
      const updated = await rejectOrderPayment(order.id, rejectReason.trim());
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Error al rechazar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-card border border-border rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-primary">
              Validar Comprobante de Pago
            </h3>
            <p className="text-xs text-brand-secondary">
              Pedido #{order.order_number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-button">
              {error}
            </div>
          )}

          {/* Información del Cliente y Monto */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-surface-subtle rounded-button border border-border text-xs">
            <div>
              <span className="text-brand-muted block text-[11px] uppercase tracking-wider">
                Cliente
              </span>
              <span className="font-bold text-brand-primary block truncate">
                {customerName}
              </span>
            </div>
            <div>
              <span className="text-brand-muted block text-[11px] uppercase tracking-wider">
                Teléfono
              </span>
              <span className="font-mono text-brand-primary block">
                {customerPhone}
              </span>
            </div>
            <div className="col-span-2 pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-brand-muted text-[11px] uppercase tracking-wider font-semibold">
                Monto Total a Validar
              </span>
              <span className="text-base font-black font-mono text-brand-primary">
                {money(order.total_amount)}
              </span>
            </div>
          </div>

          {/* N° de Operación / Voucher */}
          <div>
            <label className="block text-xs font-semibold text-brand-secondary mb-1.5">
              N° Operación / Código de Voucher
            </label>
            <div className="font-mono text-base font-bold bg-surface-subtle p-3 rounded border border-border flex items-center justify-between">
              <span className="text-brand-primary tracking-wider">
                {txId || "Sin código registrado"}
              </span>
              {txId && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copiar número de operación"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-button text-xs font-sans font-semibold bg-white border border-border text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-brand-muted" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Formulario de Rechazo Opcional */}
          {showRejectForm ? (
            <div className="space-y-3 pt-3 border-t border-border">
              <Input
                label="Motivo del rechazo / anulación"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: Monto no coincide, voucher duplicado..."
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={loading}
                  isLoading={loading}
                  onClick={handleReject}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirmar Anulación
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setShowRejectForm(true)}
                className="w-full sm:w-auto text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700 font-semibold"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Rechazar Pago / Anular
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={loading}
                isLoading={loading}
                onClick={handleApprove}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Aprobar Pago y Enviar a Preparación
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

