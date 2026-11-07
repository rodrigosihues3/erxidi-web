import { supabase } from "../../../services/supabase";

export const AUTO_NOTIFICATION_STATUSES = [
  "en_preparacion",
  "asignado",
  "en_bolsa",
  "en_camino",
  "cerca",
  "en_ubicacion",
  "listo_recojo",
  "entregado",
  "incidente",
  "incidencia_transporte",
  "cancelado",
];

const DELIVERY_MODALITY_LABELS = {
  express: "Envío Express (Mismo Día)",
  scheduled: "Envío Programado",
  programado: "Envío Programado",
  pickup: "Recojo en Tienda ERXIDI",
  recojo: "Recojo en Tienda ERXIDI",
  recojo_tienda: "Recojo en Tienda ERXIDI",
};

export function normalizeNotificationStatus(rawStatus = "") {
  const s = String(rawStatus).toLowerCase().trim();
  if (["en_preparacion", "preparing"].includes(s)) return "en_preparacion";
  if (["asignado", "assigned", "en_bolsa", "por_asignar", "por_asignar_repartidor"].includes(s)) {
    return "asignado";
  }
  if (["en_camino", "dispatched"].includes(s)) return "en_camino";
  if (["cerca", "nearby"].includes(s)) return "cerca";
  if (["en_ubicacion", "en_destino", "arrived"].includes(s)) {
    return "en_ubicacion";
  }
  if (["listo_recojo"].includes(s)) return "listo_recojo";
  if (["entregado", "delivered"].includes(s)) return "entregado";
  if (["incidente", "incidencia_transporte"].includes(s)) return "incidente";
  if (["cancelado", "cancelled"].includes(s)) return "cancelado";
  return "en_preparacion";
}

export function createOrderStatusTemplate(
  status,
  orderData = {},
  driverData = null,
  incidentData = null,
) {
  const statusKey = normalizeNotificationStatus(status);
  const rawOrderNumber =
    orderData.orderNumber ||
    orderData.order_number ||
    `ERX-${String(orderData.orderId || orderData.id || "").slice(0, 6)}`;
  const cleanCode = String(rawOrderNumber).replace(/^#/, "").trim();

  const customerName =
    orderData.customerName ||
    orderData.customer_name ||
    "Cliente ERXIDI";

  const rawDeliveryType = String(
    orderData.deliveryType ||
      orderData.shipping_type ||
      orderData.delivery_type ||
      "programado",
  ).toLowerCase();
  const modalityLabel =
    DELIVERY_MODALITY_LABELS[rawDeliveryType] || "Despacho a Domicilio";

  const deliveryAddress =
    orderData.deliveryAddress ||
    orderData.delivery_address ||
    (rawDeliveryType.includes("pickup") || rawDeliveryType.includes("recojo")
      ? "Tienda Central ERXIDI"
      : "Dirección registrada del cliente");

  const scheduleSlot =
    orderData.scheduledTimeSlot ||
    orderData.scheduled_time_slot ||
    "Horario comercial (09:00 - 18:00)";

  const driverName = driverData?.name || "";
  const driverPhone = driverData?.phone || "";

  const incidentReason =
    (typeof incidentData === "string"
      ? incidentData
      : incidentData?.reason || incidentData?.comment) ||
    orderData.incidentReason ||
    orderData.incident_reason ||
    "Contingencia operativa reportada durante el despacho.";

  const appUrl = "https://erxidi-web.vercel.app";
  const trackingUrl = `${appUrl}/seguimiento/${cleanCode}`;

  const statusConfigs = {
    en_preparacion: {
      subject: `Tu pedido #${cleanCode} está en preparación - ERXIDI`,
      badge: "EN PREPARACIÓN",
      heading: "Pago validado y pedido en preparación",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Te informamos que el pago de tu pedido <strong>#${cleanCode}</strong> ha sido validado correctamente. Nuestro personal de almacén ya se encuentra seleccionando y empaquetando tus prendas.</p>
        <p style="margin:0;">Te notificaremos por este medio tan pronto tu paquete sea asignado a reparto.</p>
      `,
    },
    asignado: {
      subject: `Repartidor asignado a tu pedido #${cleanCode} - ERXIDI`,
      badge: "REPARTIDOR ASIGNADO",
      heading: "Paquete embalado y repartidor asignado",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Tu paquete correspondiente al pedido <strong>#${cleanCode}</strong> ya se encuentra embalado en almacén y ha sido asignado al repartidor <strong>${driverName || "de turno"}</strong>${driverPhone ? ` (Tel: <strong>${driverPhone}</strong>)` : ""}.</p>
        <p style="margin:0;">Recibirás un aviso adicional apenas la unidad inicie su recorrido hacia tu dirección.</p>
      `,
    },
    en_camino: {
      subject: `¡Tu pedido #${cleanCode} va en camino! - ERXIDI`,
      badge: "EN CAMINO",
      heading: "Tu orden ha salido a ruta de reparto",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Tu pedido <strong>#${cleanCode}</strong> ha salido de nuestro centro de despacho y va en camino hacia tu dirección.</p>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#0F172A;">
          <div style="margin-bottom:4px;"><strong>Repartidor asignado:</strong> ${driverName || "Unidad ERXIDI"}</div>
          <div style="margin-bottom:4px;"><strong>Teléfono de contacto:</strong> ${driverPhone || "No registrado"}</div>
          <div><strong>Franja horaria:</strong> ${scheduleSlot}</div>
        </div>
        <p style="margin:0;">Te recomendamos mantenerte atento a tu teléfono para coordinar la recepción.</p>
      `,
    },
    cerca: {
      subject: `El repartidor está cerca de tu dirección #${cleanCode} - ERXIDI`,
      badge: "CERCA DE TU DIRECCIÓN",
      heading: "El repartidor se encuentra a pocas cuadras",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Nuestro motorizado${driverName ? ` <strong>${driverName}</strong>` : ""}${driverPhone ? ` (Tel: <strong>${driverPhone}</strong>)` : ""} se encuentra a pocas cuadras de tu domicilio con tu pedido <strong>#${cleanCode}</strong>.</p>
        <p style="margin:0;">Por favor, mantente atento al timbre o a tu teléfono para recibir tu entrega.</p>
      `,
    },
    en_ubicacion: {
      subject: `El repartidor está en tu dirección #${cleanCode} - ERXIDI`,
      badge: "EN UBICACIÓN",
      heading: "El repartidor ha llegado a tu domicilio",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0;">Nuestro repartidor${driverName ? ` <strong>${driverName}</strong>` : ""}${driverPhone ? ` (Tel: <strong>${driverPhone}</strong>)` : ""} ya se encuentra en el exterior de tu dirección para entregarte el pedido <strong>#${cleanCode}</strong>.</p>
      `,
    },
    listo_recojo: {
      subject: `Tu pedido #${cleanCode} está listo para recojo en tienda - ERXIDI`,
      badge: "LISTO PARA RECOJO",
      heading: "Tu pedido está listo para recoger en tienda",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Te informamos que tu pedido <strong>#${cleanCode}</strong> ya se encuentra embalado y listo para recojo en nuestra tienda física.</p>
        <p style="margin:0;">Recuerda acercarte portando tu documento de identidad (DNI) e indicando el número de tu pedido.</p>
      `,
    },
    entregado: {
      subject: `Tu pedido #${cleanCode} ha sido entregado - ERXIDI`,
      badge: "ENTREGADO",
      heading: "Confirmación de entrega conforme",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Confirmamos que tu pedido <strong>#${cleanCode}</strong> ha sido entregado satisfactoriamente.</p>
        <p style="margin:0;">Agradecemos tu compra y preferencia en <strong>ERXIDI</strong>.</p>
      `,
    },
    incidente: {
      subject: `Novedad operativa en tu pedido #${cleanCode} - ERXIDI`,
      badge: "INCIDENCIA OPERATIVA",
      heading: "Novedad operativa registrada en el reparto",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Durante la gestión de despacho de tu pedido <strong>#${cleanCode}</strong> se ha registrado la siguiente incidencia operativa:</p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#991B1B;">
          <strong>Detalle reportado:</strong> ${incidentReason}
        </div>
        <p style="margin:0;">Nuestro equipo de logística ya se encuentra gestionando la reprogramación o reintento de entrega.</p>
      `,
    },
    cancelado: {
      subject: `Cancelación de pedido #${cleanCode} - ERXIDI`,
      badge: "PEDIDO CANCELADO",
      heading: "Confirmación de cancelación de orden",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Confirmamos que tu pedido <strong>#${cleanCode}</strong> ha sido cancelado en nuestro sistema.</p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#991B1B;">
          <strong>Motivo:</strong> ${incidentReason}
        </div>
        <p style="margin:0;">En caso corresponda un reembolso o extorno por pago previo, nuestra área de administración procesará la devolución según el medio de pago utilizado.</p>
      `,
    },
  };

  const currentConfig = statusConfigs[statusKey] || statusConfigs.en_preparacion;

  const driverSummaryRow = driverName
    ? `<strong>Repartidor:</strong> ${driverName}${driverPhone ? ` (${driverPhone})` : ""}<br/>`
    : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;color:#0F172A;background:#FFFFFF;">
      <div style="background:#0F172A;color:#FFFFFF;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 style="font-size:20px;font-weight:900;letter-spacing:-0.03em;margin:0;color:#FFFFFF;">ERXIDI</h1>
          <p style="font-size:11px;color:#94A3B8;margin:2px 0 0 0;">Comercio y Distribución Minorista</p>
        </div>
        <span style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;background:#1E293B;color:#F8FAFC;border:1px solid #334155;">
          ${currentConfig.badge}
        </span>
      </div>

      <div style="padding:24px;">
        <h2 style="font-size:17px;font-weight:800;margin:0 0 14px 0;color:#0F172A;">
          ${currentConfig.heading}
        </h2>

        <div style="font-size:14px;line-height:1.6;color:#334155;margin-bottom:20px;">
          ${currentConfig.messageHtml}
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${trackingUrl}" style="background-color:#0F172A;color:#FFFFFF;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">
            Ver Seguimiento del Pedido #${cleanCode}
          </a>
          <p style="font-size:11px;color:#64748B;margin-top:8px;">
            Enlace directo: <a href="${trackingUrl}" style="color:#2563EB;">${trackingUrl}</a>
          </p>
        </div>

        <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:14px;border-radius:6px;font-size:12px;line-height:1.6;color:#334155;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;letter-spacing:0.05em;">
            Ficha de Resumen de Despacho
          </div>
          <strong>Pedido:</strong> #${cleanCode}<br/>
          <strong>Modalidad:</strong> ${modalityLabel}<br/>
          <strong>Dirección:</strong> ${deliveryAddress}<br/>
          ${driverSummaryRow}<strong>Franja Horaria:</strong> ${scheduleSlot}
        </div>

        <div style="margin-top:20px;border-top:1px solid #E2E8F0;padding-top:12px;font-size:11px;color:#94A3B8;line-height:1.4;">
          <strong>Aviso Sanitario:</strong> Por regulaciones de salud e higiene pública, las prendas íntimas no admiten cambios ni devoluciones una vez retiradas de su empaque original.
        </div>
      </div>
    </div>
  `;

  return {
    subject: currentConfig.subject,
    html,
  };
}

export async function sendOrderNotificationEmail({
  orderId,
  orderNumber,
  customerEmail,
  customerName,
  status,
  deliveryType,
  deliveryAddress,
  scheduledTimeSlot,
  driverInfo = null,
  incidentReason = null,
  order = null,
}) {
  const resolvedEmail = (
    customerEmail ||
    order?.customer_email ||
    order?.client_email ||
    order?.profiles?.email ||
    ""
  ).trim();

  if (!resolvedEmail) {
    console.warn("La orden no posee email de cliente. Omitiendo notificación.");
    return { success: false, reason: "NO_EMAIL" };
  }

  const rawCode =
    orderNumber ||
    order?.order_number ||
    `ERX-${String(orderId || order?.id || "").slice(0, 6)}`;
  const cleanCode = String(rawCode).replace(/^#/, "").trim();

  const resolvedName =
    customerName ||
    order?.customer_name ||
    [
      order?.profiles?.first_name,
      order?.profiles?.paternal_surname,
      order?.profiles?.maternal_surname,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Cliente ERXIDI";

  const orderData = {
    orderId: orderId || order?.id,
    orderNumber: cleanCode,
    customerName: resolvedName,
    deliveryType:
      deliveryType ||
      order?.shipping_type ||
      order?.delivery_type ||
      "programado",
    deliveryAddress:
      deliveryAddress ||
      order?.delivery_address ||
      order?.addresses?.street_address ||
      "",
    scheduledTimeSlot:
      scheduledTimeSlot || order?.scheduled_time_slot || "",
    incidentReason: incidentReason || order?.incident_reason || null,
  };

  const template = createOrderStatusTemplate(
    status || order?.status,
    orderData,
    driverInfo,
    incidentReason,
  );

  try {
    const { data, error } = await supabase.functions.invoke(
      "send-order-confirmation",
      {
        body: {
          is_status_update: true,
          customerEmail: resolvedEmail,
          customerName: resolvedName,
          subject: template.subject,
          html: template.html,
          order_number: cleanCode,
        },
      },
    );

    if (error) throw error;
    return {
      success: true,
      subject: template.subject,
      data,
    };
  } catch (err) {
    console.warn(
      "Fallo en servicio de email transaccional:",
      err?.message || err,
    );
    return {
      success: false,
      subject: template.subject,
      error: err?.message || "Error al enviar correo",
    };
  }
}
