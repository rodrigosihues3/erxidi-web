import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYMENT_LABELS: Record<string, string> = {
  culqi_gateway: "Pago Online (Culqi)",
  yape_plin: "Yape / Plin / Transferencia",
  cash_on_delivery: "Pago Contra Entrega",
  contraentrega: "Pago Contra Entrega",
};

const DELIVERY_LABELS: Record<string, string> = {
  express: "Envío Express (Mismo Día)",
  scheduled: "Envío Programado",
  pickup: "Recojo en Tienda ERXIDI",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const brevoApiKey = (Deno.env.get("BREVO_API_KEY") || "").trim();
    if (!brevoApiKey) {
      throw new Error(
        "La variable BREVO_API_KEY no está configurada en los Secrets de Supabase."
      );
    }

    const body = await req.json();

    // =========================================================================
    // 1. DISCRIMINADOR ESTRICTO: Notificaciones de Cambio de Estado (Backoffice)
    // =========================================================================
    if (body.is_status_update === true) {
      const targetEmail = (
        body.customerEmail ||
        body.recipient ||
        body.order?.customer_email ||
        ""
      ).trim();
      const targetName =
        body.customerName || body.order?.customer_name || "Cliente ERXIDI";
      const subject =
        body.subject ||
        `Actualización de tu pedido #${body.order_number || ""} - ERXIDI`;
      const html = body.html || "";

      if (!targetEmail || !html) {
        return new Response(
          JSON.stringify({
            sent: false,
            mode: "status_update",
            reason: "missing_email_or_html",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const brevoStatusPayload = {
        sender: {
          name: "ERXIDI",
          email: "sihues3@gmail.com",
        },
        to: [
          {
            email: targetEmail,
            name: targetName,
          },
        ],
        subject,
        htmlContent: html,
      };

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify(brevoStatusPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ sent: false, mode: "status_update", error: data }),
          {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ sent: true, mode: "status_update", data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================================
    // 2. FLUJO DE CHECKOUT ORIGINAL (Confirmación Inicial con Comprobante PDF)
    // =========================================================================
    const { order, items, app_url, pdf_base64, pdf_filename } = body;

    if (!order?.customer_email) {
      return new Response(
        JSON.stringify({ sent: false, reason: "missing_customer_email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = (app_url || "https://erxidi-web.vercel.app").replace(
      /\/$/,
      ""
    );
    const trackingUrl = `${baseUrl}/seguimiento/${order.order_number}`;

    const invoice = order.invoice_data || {};
    const docTypeLabel =
      (invoice.type || order.invoice_type || "boleta").toLowerCase() ===
      "factura"
        ? "Factura Electrónica"
        : (invoice.type || order.invoice_type || "").toLowerCase() ===
            "nota_venta"
          ? "Nota de Venta"
          : "Boleta de Venta Electrónica";

    const deliveryModality =
      DELIVERY_LABELS[order.delivery_type] || "Envío Local";
    const paymentMethodLabel =
      PAYMENT_LABELS[order.payment_method] ||
      String(order.payment_method || "Registrado");
    const scheduleLabel =
      order.scheduled_time_slot || "Horario comercial 09:00 - 18:00";

    const itemsRowsHtml = (items || [])
      .map(
        (i: any) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
            <strong>${i.name || i.title || "Prenda"}</strong><br/>
            <span style="font-size:12px;color:#6b7280;">Talla: ${i.size || "-"} | Color: ${i.color || "-"}</span>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">S/ ${Number(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
      )
      .join("");

    const attachmentNoticeHtml = pdf_base64
      ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;color:#0f172a;">
           <strong>Comprobante Adjunto:</strong> Hemos adjuntado tu <strong>${docTypeLabel} (${pdf_filename || "Comprobante.pdf"})</strong> directamente en este correo para tu descarga.
         </div>`
      : "";

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:24px;color:#0f172a;background:#ffffff;">
        <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">
          <h1 style="font-size:20px;margin:0;color:#0f172a;">ERXIDI</h1>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0 0;">Comercio y Distribución Minorista</p>
        </div>

        <h2 style="font-size:16px;margin:0 0 8px 0;">¡Tu pedido ha sido confirmado!</h2>
        <p style="font-size:14px;color:#334155;margin:0 0 16px 0;">
          Hola <strong>${order.customer_name}</strong>, hemos recibido tu compra con el código de seguimiento <strong>${order.order_number}</strong>.
        </p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${trackingUrl}" style="background-color:#0f172a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
            Ver Estado de mi Pedido en Vivo
          </a>
          <p style="font-size:11px;color:#64748b;margin-top:8px;">
            Enlace directo: <a href="${trackingUrl}" style="color:#2563eb;">${trackingUrl}</a>
          </p>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:6px;margin-bottom:16px;font-size:12px;line-height:1.6;color:#334155;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;letter-spacing:0.05em;">
            Detalles de Entrega y Despacho
          </div>
          <strong>Modalidad:</strong> ${deliveryModality}<br/>
          <strong>Destino:</strong> ${order.delivery_address || "Tienda Central ERXIDI"}<br/>
          <strong>Ventana Horaria:</strong> ${scheduleLabel}<br/>
          <strong>Contacto / Recibe:</strong> ${order.customer_name} (${order.customer_phone || "-"})<br/>
          <strong>Método de Pago:</strong> ${paymentMethodLabel}
          ${attachmentNoticeHtml}
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f5f9;color:#475569;text-align:left;">
              <th style="padding:8px;">Prenda</th>
              <th style="padding:8px;text-align:center;">Cant.</th>
              <th style="padding:8px;text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <div style="text-align:right;font-size:13px;color:#334155;line-height:1.6;">
          Costo de Envío: S/ ${Number(order.delivery_cost || 0).toFixed(2)}<br/>
          <strong style="font-size:16px;color:#0f172a;">Total Pagado: S/ ${Number(order.total_amount || 0).toFixed(2)}</strong>
        </div>

        <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;line-height:1.4;">
          <strong>Aviso Sanitario:</strong> Por regulaciones de salud e higiene pública, las prendas íntimas no admiten cambios ni devoluciones una vez retiradas de su empaque original.
        </div>
      </div>
    `;

    const brevoPayload: Record<string, any> = {
      sender: {
        name: "ERXIDI",
        email: "sihues3@gmail.com",
      },
      to: [
        {
          email: order.customer_email,
          name: order.customer_name || "Cliente",
        },
      ],
      subject: `Pedido ${order.order_number} Confirmado - ERXIDI`,
      htmlContent: htmlBody,
    };

    if (pdf_base64) {
      brevoPayload.attachment = [
        {
          name: pdf_filename || `${order.order_number}.pdf`,
          content: pdf_base64,
        },
      ];
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(brevoPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ sent: false, error: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ sent: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
