import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const brevoPayload = {
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
      body: JSON.stringify(brevoPayload),
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
  } catch (err: any) {
    return new Response(JSON.stringify({ sent: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
