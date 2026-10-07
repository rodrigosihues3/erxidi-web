/**
 * Servicio wrapper para la pasarela de pagos Culqi Checkout v4.
 * Aísla y centraliza las llamadas a la API global window.Culqi.
 */

const CULQI_PUBLIC_KEY = import.meta.env.VITE_CULQI_PUBLIC_KEY;

/**
 * Inicializa la configuración de Culqi Checkout v4.
 * @param {Object} options
 * @param {string} options.title - Título a mostrar en el modal de checkout.
 * @param {string} [options.currency='PEN'] - Código de moneda (ISO 4217).
 * @param {number} options.amountInCents - Monto total en céntimos (ej. S/ 10.50 => 1050).
 */
export function initCulqi({ title, currency = 'PEN', amountInCents }) {
  if (typeof window === 'undefined' || !window.Culqi) {
    throw new Error('El script de Culqi Checkout no se encuentra disponible. Por favor recarga la página o revisa tu conexión.');
  }

  window.Culqi.publicKey = CULQI_PUBLIC_KEY;

  window.Culqi.settings({
    title,
    currency,
    amount: Math.round(amountInCents),
  });

  window.Culqi.options({
    lang: 'es',
    installments: false,
    paymentMethods: {
      tarjeta: true,
      yape: true,
      billetera: false,
      pagoEfectivo: false,
    },
  });
}

/**
 * Abre el modal de pago de Culqi.
 */
export function openCulqi() {
  if (typeof window !== 'undefined' && window.Culqi) {
    window.Culqi.open();
  }
}

/**
 * Cierra el modal de pago de Culqi.
 */
export function closeCulqi() {
  if (typeof window !== 'undefined' && window.Culqi) {
    window.Culqi.close();
  }
}
