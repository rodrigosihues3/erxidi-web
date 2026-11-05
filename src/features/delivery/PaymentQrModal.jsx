import { useEffect, useState } from "react";
import { QrCode, X } from "lucide-react";
import { supabase } from "../../services/supabase";

// Las imágenes del QR van en la carpeta public/ (se sirven desde la raíz)
const WALLETS = [
  { key: "yape", label: "Yape", numberKey: "yape_number", image: "/qr-yape.png" },
  { key: "plin", label: "Plin", numberKey: "plin_number", image: "/qr-plin.png" },
];

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// Pantalla completa para mostrarle el QR de cobro al cliente en la puerta
export default function PaymentQrModal({ order, onClose }) {
  const [method, setMethod] = useState("yape");
  const [wallets, setWallets] = useState({});
  const [failed, setFailed] = useState({});

  // Número y titular configurados por la dueña en Ajustes (lectura pública)
  useEffect(() => {
    let active = true;
    supabase
      .from("store_settings")
      .select("value")
      .eq("key", "payment_methods")
      .maybeSingle()
      .then(({ data }) => {
        if (active) setWallets(data?.value?.digital_wallets ?? {});
      });
    return () => {
      active = false;
    };
  }, []);

  if (!order) return null;

  const wallet = WALLETS.find((w) => w.key === method);
  const number = wallets[wallet.numberKey];
  const holder = wallets.holder_name;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-surface-card"
      role="dialog"
      aria-modal="true"
      aria-label="Cobro con Yape o Plin"
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-brand-primary">
            Cobrar con Yape / Plin
          </h3>
          <p className="text-xs text-brand-secondary font-mono">
            Orden {order.order_number}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="p-2 text-brand-secondary hover:text-brand-primary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
            Monto a cobrar
          </p>
          <p className="text-4xl font-bold font-mono text-brand-primary">
            {soles(order.total_amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 w-full max-w-sm rounded-button bg-surface-subtle border border-border">
          {WALLETS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setMethod(w.key)}
              className={`py-2 text-sm font-semibold rounded-button transition-colors ${
                method === w.key
                  ? "bg-surface-card text-brand-primary border border-border"
                  : "text-brand-secondary"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm aspect-square rounded-card border border-border bg-white flex items-center justify-center overflow-hidden">
          {failed[method] ? (
            <div className="px-6 text-center space-y-2 text-brand-secondary">
              <QrCode className="w-12 h-12 mx-auto" />
              <p className="text-sm font-semibold text-brand-primary">
                No se encontró el QR de {wallet.label}.
              </p>
              <p className="text-xs">
                Archivo esperado: <span className="font-mono">{wallet.image}</span>
              </p>
            </div>
          ) : (
            <img
              src={wallet.image}
              alt={`QR de ${wallet.label}`}
              className="w-full h-full object-contain"
              onError={() => setFailed((f) => ({ ...f, [method]: true }))}
            />
          )}
        </div>

        <div className="text-center text-sm space-y-0.5">
          {number && (
            <p className="text-brand-primary">
              {wallet.label}: <span className="font-mono font-semibold">{number}</span>
            </p>
          )}
          {holder && (
            <p className="text-xs text-brand-secondary">Titular: {holder}</p>
          )}
        </div>
      </div>
    </div>
  );
}