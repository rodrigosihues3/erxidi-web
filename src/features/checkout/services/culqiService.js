import { supabase } from "../../../services/supabase";
export {
  initCulqi,
  openCulqi,
  closeCulqi,
} from "../../../services/payment/culqiService";

/**
 * Procesa el cobro seguro delegando el token a la Edge Function
 * @param {Object} params
 * @param {string} params.tokenId - Token devuelto por Culqi Checkout (ej. tkn_test_...)
 * @param {number} params.amount - Monto total en Soles (PEN) en formato decimal (ej. 36.00)
 * @param {string} params.email - Email del comprador
 * @param {string} params.orderId - UUID de la orden creada en Supabase
 */
export const processCulqiCharge = async ({ tokenId, amount, email, orderId }) => {
  const { data, error } = await supabase.functions.invoke("create-culqi-charge", {
    body: {
      token: tokenId,
      amount: Number(amount),
      email: email,
      order_id: orderId,
    },
  });

  if (error) {
    throw new Error(
      error.message || "Error de comunicación con el servicio de pagos."
    );
  }

  if (data?.error) {
    const errorMsg =
      typeof data.error === "string"
        ? data.error
        : data.error.user_message ||
          data.error.merchant_message ||
          data.error.message ||
          JSON.stringify(data.error);
    throw new Error(errorMsg);
  }

  return data; // Retorna el payload del cargo aprobado por Culqi
};
