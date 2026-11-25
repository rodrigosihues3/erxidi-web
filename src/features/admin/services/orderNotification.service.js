import { supabase } from "../../../services/supabase";

export const AUTO_NOTIFICATION_STATUSES = [
  "recibido",
  "en_preparacion",
  "por_asignar",
  "por_asignar_repartidor",
  "asignado",
  "en_bolsa",
  "en_camino",
  "cerca",
  "en_ubicacion",
  "en_destino",
  "listo_recojo",
  "entregado",
  "incidente",
  "incidencia_transporte",
  "cancelado",
  "reembolso_completado",
];

const DELIVERY_MODALITY_LABELS = {
  express: "Envío Express (Mismo Día)",
  scheduled: "Envío Programado",
  programado: "Envío Programado",
  pickup: "Recojo en Tienda ERXIDI",
  recojo: "Recojo en Tienda ERXIDI",
  recojo_tienda: "Recojo en Tienda ERXIDI",
};

const REFUND_METHOD_LABELS = {
  culqi_extorno: "Extorno automático a tarjeta (Culqi)",
  culqi_gateway: "Extorno a tarjeta (Culqi)",
  tarjeta: "Extorno a tarjeta",
  yape_plin: "Devolución vía Yape / Plin",
  transferencia: "Transferencia bancaria",
  efectivo: "Devolución en efectivo",
};

export const INCIDENT_CODE_LABELS = {
  cliente_ausente: "Cliente ausente en la dirección de entrega",
  direccion_erronea: "Dirección errónea o inaccesible",
  averia_mecanica: "Avería mecánica en la unidad de reparto",
  reasignacion_entre_repartidores: "Reasignación de unidad motorizada en ruta",
  otro: "Novedad operativa en reparto",
};

export function formatIncidentReason(rawReason, rawComment) {
  const cleanReason = String(rawReason || "").trim();
  const cleanComment = String(rawComment || "").trim();
  const mappedReason =
    INCIDENT_CODE_LABELS[cleanReason.toLowerCase()] || cleanReason;

  if (mappedReason && cleanComment && mappedReason.toLowerCase() !== cleanComment.toLowerCase()) {
    return `${mappedReason} — ${cleanComment}`;
  }
  return (
    mappedReason ||
    cleanComment ||
    "Contingencia operativa reportada durante el despacho."
  );
}

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveDriverDisplay(driverData) {
  if (!driverData) return { name: "", phone: "" };
  const cleanPart = (v) => String(v || "").replace(/\[.*?\]/g, "").trim();
  const directName = cleanPart(driverData.name || driverData.full_name);
  const composedName = [
    cleanPart(driverData.first_name),
    cleanPart(driverData.paternal_surname),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name: directName || composedName || "",
    phone: String(driverData.phone || "").trim(),
  };
}

export function normalizeNotificationStatus(rawStatus = "") {
  const s = String(rawStatus || "").toLowerCase().trim();
  if (["recibido", "received", "pendiente_pago", "pending"].includes(s)) {
    return "recibido";
  }
  if (["en_preparacion", "preparing"].includes(s)) return "en_preparacion";
  if (["por_asignar", "por_asignar_repartidor", "en_bolsa"].includes(s)) {
    return "por_asignar";
  }
  if (["asignado", "assigned"].includes(s)) return "asignado";
  if (["listo_recojo"].includes(s)) return "listo_recojo";
  if (["en_camino", "en_ruta", "dispatched"].includes(s)) return "en_camino";
  if (["cerca", "nearby"].includes(s)) return "cerca";
  if (["en_ubicacion", "en_destino", "arrived"].includes(s)) {
    return "en_ubicacion";
  }
  if (["entregado", "delivered"].includes(s)) return "entregado";
  if (["incidente", "incidencia_transporte"].includes(s)) return "incidente";
  if (["cancelado", "cancelled"].includes(s)) return "cancelado";
  if (["reembolso_completado", "refunded"].includes(s)) {
    return "reembolso_completado";
  }
  return null;
}

export function createOrderStatusTemplate(
  status,
  orderData = {},
  driverData = null,
  incidentData = null,
) {
  const statusKey = normalizeNotificationStatus(status);
  if (!statusKey) {
    return null;
  }

  const rawOrderNumber =
    orderData.orderNumber ||
    orderData.order_number ||
    `ERX-${String(orderData.orderId || orderData.id || "").slice(0, 6)}`;
  const cleanCode = escapeHtml(String(rawOrderNumber).replace(/^#/, "").trim());

  const customerName = escapeHtml(
    orderData.customerName || orderData.customer_name || "Cliente ERXIDI",
  );

  const rawDeliveryType = String(
    orderData.deliveryType ||
      orderData.shipping_type ||
      orderData.delivery_type ||
      "programado",
  ).toLowerCase();
  const isPickup = ["pickup", "recojo", "recojo_tienda"].includes(
    rawDeliveryType,
  );
  const modalityLabel = escapeHtml(
    DELIVERY_MODALITY_LABELS[rawDeliveryType] || "Despacho a Domicilio",
  );

  const deliveryAddress = escapeHtml(
    orderData.deliveryAddress ||
      orderData.delivery_address ||
      (isPickup
        ? "Tienda Central ERXIDI"
        : "Dirección registrada del cliente"),
  );

  const scheduleSlot = escapeHtml(
    orderData.scheduledTimeSlot ||
      orderData.scheduled_time_slot ||
      "Horario comercial (09:00 - 18:00)",
  );

  const rawPaymentMethod = String(
    orderData.paymentMethod || orderData.payment_method || "",
  ).toLowerCase();
  const rawPaymentStatus = String(
    orderData.paymentStatus || orderData.payment_status || "",
  ).toLowerCase();
  const isCashOnDelivery = [
    "contraentrega",
    "efectivo",
    "cash_on_delivery",
  ].includes(rawPaymentMethod);
  const isPaid = ["paid", "pagado"].includes(rawPaymentStatus);

  const refundStatus = String(
    orderData.refundStatus || orderData.refund_status || "none",
  ).toLowerCase();
  const refundMethod = String(
    orderData.refundMethod || orderData.refund_method || rawPaymentMethod,
  ).toLowerCase();
  const refundMethodLabel = escapeHtml(
    REFUND_METHOD_LABELS[refundMethod] || "Medio de pago original",
  );
  const refundReference = escapeHtml(
    orderData.refundReference || orderData.refund_reference || "",
  );
  const totalAmountFormatted = Number(
    orderData.totalAmount ?? orderData.total_amount ?? 0,
  ).toFixed(2);

  const resolvedDriver = resolveDriverDisplay(driverData);
  const driverName = escapeHtml(resolvedDriver.name);
  const driverPhone = escapeHtml(resolvedDriver.phone);

  const rawReason =
    typeof incidentData === "string"
      ? incidentData
      : incidentData?.reason ||
        orderData.incidentReason ||
        orderData.incident_reason ||
        "";
  const rawComment =
    typeof incidentData === "object" && incidentData !== null
      ? incidentData.comment
      : orderData.incidentComment || orderData.incident_comment || "";
  const formattedIncident = escapeHtml(
    formatIncidentReason(rawReason, rawComment),
  );

  const appUrl = "https://erxidi-web.vercel.app";
  const trackingUrl = `${appUrl}/seguimiento/${encodeURIComponent(
    String(rawOrderNumber).replace(/^#/, "").trim(),
  )}`;

  const cancelRefundBlock =
    refundStatus === "completed"
      ? `
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#065F46;">
          <div style="font-weight:700;margin-bottom:4px;">Reembolso procesado</div>
          <div>Se ha extornado el monto de <strong>S/ ${totalAmountFormatted}</strong> mediante <strong>${refundMethodLabel}</strong>.</div>
          ${refundReference ? `<div style="margin-top:4px;"><strong>Código de operación:</strong> <span style="font-family:monospace;">${refundReference}</span></div>` : ""}
        </div>
      `
      : refundStatus === "pending" || isPaid
        ? `
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#92400E;">
          <div style="font-weight:700;margin-bottom:4px;">Devolución de dinero en gestión</div>
          <div>Tu reembolso por <strong>S/ ${totalAmountFormatted}</strong> ya se encuentra registrado en administración. Te enviaremos la constancia con el número de operación tan pronto se ejecute el abono a tu medio de pago.</div>
        </div>
      `
        : `
        <p style="margin:0;font-size:13px;color:#475569;">No se registró ningún cobro sobre esta orden, por lo que no corresponde devolución de dinero.</p>
      `;

  const statusConfigs = {
    recibido: {
      subject: `Hemos recibido tu pedido #${cleanCode} - ERXIDI`,
      badge: "PEDIDO RECIBIDO",
      heading: "Tu pedido ha sido registrado",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Confirmamos la recepción de tu pedido <strong>#${cleanCode}</strong> en nuestro sistema.</p>
        <p style="margin:0;">${
          isCashOnDelivery
            ? "Nuestro equipo revisará tu orden para iniciar el empaque. Recuerda que el pago se realizará al momento de la entrega."
            : isPaid
              ? "Tu pago en línea fue registrado correctamente y tu orden está en cola para iniciar preparación."
              : "Estamos validando tu comprobante de pago y te notificaremos apenas pasemos a la preparación de tus prendas."
        }</p>
      `,
    },
    en_preparacion: {
      subject: `Tu pedido #${cleanCode} está en preparación - ERXIDI`,
      badge: "EN PREPARACIÓN",
      heading: isCashOnDelivery
        ? "Pedido aceptado y en preparación"
        : "Pago validado y pedido en preparación",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">${
          isCashOnDelivery
            ? `Tu pedido <strong>#${cleanCode}</strong> (pago contra entrega por <strong>S/ ${totalAmountFormatted}</strong>) ha sido aceptado. Nuestro equipo ya está seleccionando y empaquetando tus prendas.`
            : `Te informamos que el pago de tu pedido <strong>#${cleanCode}</strong> ha sido validado correctamente. Nuestro personal de almacén ya se encuentra seleccionando y empaquetando tus prendas.`
        }</p>
        <p style="margin:0;">Te notificaremos por este medio tan pronto tu paquete avance a la siguiente etapa.</p>
      `,
    },
    por_asignar: {
      subject: `Tu pedido #${cleanCode} está empacado en nuestro taller - ERXIDI`,
      badge: "LISTO PARA DESPACHO",
      heading: "Paquete embalado en nuestro taller",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Tu pedido <strong>#${cleanCode}</strong> ya está empacado en nuestro taller y listo en cola de despacho. En breve será asignado a un repartidor.</p>
        <p style="margin:0;">Te notificaremos por este medio tan pronto la unidad asignada inicie su recorrido hacia tu dirección.</p>
      `,
    },
    asignado: {
      subject: `Repartidor asignado a tu pedido #${cleanCode} - ERXIDI`,
      badge: "REPARTIDOR ASIGNADO",
      heading: "Repartidor asignado a tu pedido",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Tu paquete correspondiente al pedido <strong>#${cleanCode}</strong> ya fue asignado al repartidor <strong>${driverName || "de turno"}</strong>${driverPhone ? ` (Tel: <strong>${driverPhone}</strong>)` : ""}.</p>
        <p style="margin:0;">Recibirás un aviso adicional apenas la unidad inicie su recorrido hacia tu dirección.</p>
      `,
    },
    en_camino: {
      subject: `¡Tu pedido #${cleanCode} va en camino! - ERXIDI`,
      badge: "EN CAMINO",
      heading: "Tu pedido ha salido a ruta de reparto",
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
      subject: `El repartidor llegó a tu dirección #${cleanCode} - ERXIDI`,
      badge: "EN UBICACIÓN",
      heading: "El repartidor ha llegado a tu dirección",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0;">Nuestro repartidor${driverName ? ` <strong>${driverName}</strong>` : ""}${driverPhone ? ` (Tel: <strong>${driverPhone}</strong>)` : ""} ya se encuentra en el exterior de tu dirección para entregarte el pedido <strong>#${cleanCode}</strong>.</p>
      `,
    },
    listo_recojo: {
      subject: `¡Tu pedido #${cleanCode} está listo para recoger en tienda! - ERXIDI`,
      badge: "LISTO PARA RECOJO",
      heading: "Tu pedido está listo para recoger en tienda",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Tu pedido <strong>#${cleanCode}</strong> ya está empacado y listo para ser recogido en nuestra tienda central ERXIDI.</p>
        <p style="margin:0;">Recuerda acercarte portando tu documento de identidad (DNI) e indicando tu código de pedido <strong>#${cleanCode}</strong>.</p>
      `,
    },
    entregado: {
      subject: isPickup
        ? `Tu pedido #${cleanCode} fue retirado en tienda - ERXIDI`
        : `Tu pedido #${cleanCode} ha sido entregado - ERXIDI`,
      badge: isPickup ? "RETIRADO EN TIENDA" : "PEDIDO ENTREGADO",
      heading: isPickup
        ? "Confirmación de retiro en tienda"
        : "Confirmación de entrega conforme",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">${
          isPickup
            ? `Confirmamos que tu pedido <strong>#${cleanCode}</strong> ha sido retirado satisfactoriamente en nuestra tienda ERXIDI.`
            : `Confirmamos que tu pedido <strong>#${cleanCode}</strong> ha sido entregado satisfactoriamente en tu dirección${driverName ? ` por nuestro repartidor <strong>${driverName}</strong>` : ""}.`
        }</p>
        <p style="margin:0;">Agradecemos tu compra y preferencia en <strong>ERXIDI</strong>.</p>
      `,
    },
    incidente: {
      subject: `Novedad operativa en tu pedido #${cleanCode} - ERXIDI`,
      badge: "INCIDENCIA OPERATIVA",
      heading: "Registramos una novedad en tu pedido",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Lamentamos informarte que durante la gestión de tu pedido <strong>#${cleanCode}</strong> se registró la siguiente novedad operativa:</p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#991B1B;">
          <strong>Detalle reportado:</strong> ${formattedIncident}
        </div>
        <p style="margin:0;">Nuestro equipo ya está revisando tu pedido para reprogramar o reactivar el despacho a la brevedad. Te mantendremos informado por este medio.</p>
      `,
    },
    cancelado: {
      subject: `Cancelación de tu pedido #${cleanCode} - ERXIDI`,
      badge: "PEDIDO CANCELADO",
      heading: "Tu pedido ha sido cancelado",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Lamentamos los inconvenientes ocasionados. Confirmamos que tu pedido <strong>#${cleanCode}</strong> ha sido cancelado en nuestro sistema.</p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#991B1B;">
          <strong>Motivo:</strong> ${formattedIncident}
        </div>
        ${cancelRefundBlock}
      `,
    },
    reembolso_completado: {
      subject: `Confirmación de reembolso de tu pedido #${cleanCode} - ERXIDI`,
      badge: "REEMBOLSO COMPLETADO",
      heading: "Tu dinero ha sido reembolsado",
      messageHtml: `
        <p style="margin:0 0 12px 0;">Hola <strong>${customerName}</strong>,</p>
        <p style="margin:0 0 12px 0;">Te confirmamos que el reembolso correspondiente a tu pedido cancelado <strong>#${cleanCode}</strong> ha sido ejecutado con éxito.</p>
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;color:#065F46;">
          <div style="margin-bottom:4px;"><strong>Monto reembolsado:</strong> S/ ${totalAmountFormatted}</div>
          <div style="margin-bottom:4px;"><strong>Medio de devolución:</strong> ${refundMethodLabel}</div>
          ${refundReference ? `<div><strong>Código de operación:</strong> <span style="font-family:monospace;">${refundReference}</span></div>` : ""}
        </div>
        <p style="margin:0;">Agradecemos tu comprensión y esperamos atenderte pronto nuevamente en <strong>ERXIDI</strong>.</p>
      `,
    },
  };

  const currentConfig = statusConfigs[statusKey];
  if (!currentConfig) return null;

  const driverSummaryRow =
    driverName && !isPickup
      ? `<strong>Repartidor:</strong> ${driverName}${driverPhone ? ` (${driverPhone})` : ""}<br/>`
      : "";
  const scheduleRow =
    !isPickup && !["entregado", "cancelado", "reembolso_completado"].includes(statusKey)
      ? `<strong>Franja Horaria:</strong> ${scheduleSlot}`
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
            Ficha de Resumen del Pedido
          </div>
          <strong>Pedido:</strong> #${cleanCode}<br/>
          <strong>Modalidad:</strong> ${modalityLabel}<br/>
          <strong>${isPickup ? "Punto de Retiro" : "Dirección"}:</strong> ${deliveryAddress}<br/>
          ${driverSummaryRow}${scheduleRow}
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
  targetStatus,
  deliveryType,
  deliveryAddress,
  scheduledTimeSlot,
  driverInfo = null,
  incidentReason = null,
  incidentComment = null,
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
    paymentMethod: order?.payment_method || "",
    paymentStatus: order?.payment_status || "",
    totalAmount: order?.total_amount ?? 0,
    refundStatus: order?.refund_status || "none",
    refundMethod: order?.refund_method || order?.payment_method || "",
    refundReference: order?.refund_reference || "",
    incidentReason: incidentReason || order?.incident_reason || null,
    incidentComment: incidentComment || order?.incident_comment || null,
  };

  const effectiveStatus = targetStatus || status || order?.status;
  const incidentPayload =
    incidentReason || incidentComment
      ? {
          reason: incidentReason || order?.incident_reason || "",
          comment: incidentComment || order?.incident_comment || "",
        }
      : null;

  const template = createOrderStatusTemplate(
    effectiveStatus,
    orderData,
    driverInfo,
    incidentPayload,
  );

  if (!template) {
    return {
      success: false,
      error: `Estado no reconocido para notificación de correo: "${effectiveStatus}"`,
    };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke(
      "send-order-confirmation",
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

    if (error) {
      let descriptiveMessage = error.message || "Error al enviar notificación";
      const statusCode = error.context?.status;
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          if (body?.error) {
            descriptiveMessage =
              typeof body.error === "string"
                ? body.error
                : body.error.message || JSON.stringify(body.error);
          }
        }
      } catch (_) {}

      if (statusCode === 401 || statusCode === 403) {
        descriptiveMessage =
          "No autorizado para enviar la notificación de esta orden.";
      } else if (statusCode === 400) {
        descriptiveMessage = `Parámetros de correo incorrectos o inválidos: ${descriptiveMessage}`;
      } else if (statusCode === 404) {
        descriptiveMessage = "Orden o cliente no encontrado en el sistema.";
      } else if (statusCode >= 500) {
        descriptiveMessage =
          "Servicio de correo temporalmente no disponible (caída del proveedor).";
      }

      return {
        success: false,
        subject: template.subject,
        statusCode,
        error: descriptiveMessage,
      };
    }

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
    let descriptiveMessage = err?.message || "Error al enviar correo";
    const statusCode = err?.context?.status;
    try {
      if (err?.context && typeof err.context.json === "function") {
        const body = await err.context.json();
        if (body?.error) {
          descriptiveMessage =
            typeof body.error === "string"
              ? body.error
              : body.error.message || JSON.stringify(body.error);
        }
      }
    } catch (_) {}

    return {
      success: false,
      subject: template.subject,
      statusCode,
      error: descriptiveMessage,
    };
  }
}
