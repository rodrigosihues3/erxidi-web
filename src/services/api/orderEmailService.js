import { supabase } from "../supabase";
import { generateReceiptPDFBase64 } from "../../utils/pdfReceiptGenerator";

/**
 * Invoca la Edge Function 'send-order-confirmation' en segundo plano,
 * adjuntando el comprobante electrónico (Factura/Boleta/Nota) en PDF Base64.
 */
export const triggerOrderConfirmationEmail = (order, items) => {
    if (!order || !order.customer_email) {
        console.warn(
            "[Email Service] No se ejecutó el envío: datos de orden o correo ausentes."
        );
        return;
    }

    const appUrl = window.location.origin;
    const orderWithItems = {
        ...order,
        items: items || order.items || order.order_items || [],
    };

    const pdfAttachment = generateReceiptPDFBase64(orderWithItems);

    supabase.functions
        .invoke("send-order-confirmation", {
            body: {
                order,
                items,
                app_url: appUrl,
                pdf_base64: pdfAttachment?.base64Content || null,
                pdf_filename: pdfAttachment?.fileName || null,
            },
        })
        .then(({ data, error }) => {
            if (error) {
                console.warn("[Email Service] Advertencia de Edge Function:", error);
            } else {
                console.info("[Email Service] Correo transaccional enviado:", data);
            }
        })
        .catch((err) => {
            console.error(
                "[Email Service] Error de red al invocar servicio de correo:",
                err
            );
        });
};