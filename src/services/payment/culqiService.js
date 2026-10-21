import { supabase } from "../supabase";

const CULQI_PUBLIC_KEY = (import.meta.env.VITE_CULQI_PUBLIC_KEY || "").trim();
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export function initCulqi({ title, currency = "PEN", amountInCents }) {
  if (typeof window === "undefined" || !window.Culqi) {
    throw new Error(
      "El script de Culqi Checkout no se encuentra disponible. Recarga la página o revisa tu conexión."
    );
  }

  if (!CULQI_PUBLIC_KEY || !CULQI_PUBLIC_KEY.startsWith("pk_")) {
    throw new Error(
      "Configuración faltante: VITE_CULQI_PUBLIC_KEY no es válida en las variables de entorno."
    );
  }

  window.Culqi.publicKey = CULQI_PUBLIC_KEY;

  window.Culqi.settings({
    title,
    currency,
    amount: Math.round(Number(amountInCents) || 0),
  });

  window.Culqi.options({
    lang: "es",
    installments: false,
    paymentMethods: {
      tarjeta: true,
      yape: true,
      billetera: false,
      pagoEfectivo: false,
    },
  });
}

export function openCulqi() {
  if (typeof window !== "undefined" && window.Culqi) {
    window.Culqi.open();
  }
}

export function closeCulqi() {
  if (typeof window !== "undefined" && window.Culqi) {
    window.Culqi.close();
  }
}

export const processCulqiCharge = async ({ tokenId, amount, email, orderId }) => {
  const endpoint = SUPABASE_URL + "/functions/v1/create-culqi-charge";

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };

  // Solo adjuntar Authorization Bearer si la llave es un JWT (eyJ...)
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) {
    headers.Authorization = "Bearer " + SUPABASE_ANON_KEY;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: tokenId,
      amount: Number(amount),
      email: email,
      order_id: orderId,
    }),
  });

  if (response.status === 401) {
    throw new Error(
      "Error 401 en Supabase Gateway: Entra a Supabase -> Edge Functions -> create-culqi-charge y desactiva 'Enforce JWT Verification'."
    );
  }

  if (response.status === 404) {
    throw new Error(
      "Error 404: Verifica que la Edge Function en Supabase se llame exactamente 'create-culqi-charge'."
    );
  }

  const responseData = await response.json();

  if (responseData?.error) {
    const errorMsg =
      typeof responseData.error === "string"
        ? responseData.error
        : responseData.error.user_message ||
        responseData.error.merchant_message ||
        responseData.error.message ||
        JSON.stringify(responseData.error);
    throw new Error(errorMsg);
  }

  return responseData;
};