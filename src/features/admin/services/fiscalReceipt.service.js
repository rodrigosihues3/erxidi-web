import { generateReceiptBlob as buildPdfBlob } from "../../../utils/pdfReceiptGenerator";

export function normalizeOrderForFiscalReceipt(order) {
  if (!order) {
    throw new Error("No se encontraron datos del pedido para el comprobante.");
  }

  const profile = order.profiles || {};
  const address = order.addresses || {};
  const rawFiscal = order.invoice_data || {};

  const fullProfileName = [
    profile.first_name,
    profile.paternal_surname,
    profile.maternal_surname,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const customerName =
    order.customer_name || fullProfileName || "Cliente ERXIDI";

  const customerDni =
    order.customer_dni ||
    rawFiscal.dni ||
    profile.dni ||
    rawFiscal.tax_id ||
    "";

  const legalName =
    rawFiscal.legal_name ||
    rawFiscal.razonSocial ||
    rawFiscal.businessName ||
    rawFiscal.razon_social ||
    customerName;

  const taxId =
    rawFiscal.tax_id ||
    rawFiscal.ruc ||
    rawFiscal.dni ||
    customerDni ||
    "";

  const fiscalAddress =
    rawFiscal.fiscal_address ||
    rawFiscal.address ||
    rawFiscal.direccionFiscal ||
    "";

  const streetWithDistrict = [
    address.street_address,
    address.delivery_zones?.district_name,
  ]
    .filter(Boolean)
    .join(" - ");

  const deliveryAddress =
    order.delivery_address || streetWithDistrict || "";

  const invoiceType =
    order.invoice_type || rawFiscal.type || "boleta";

  return {
    ...order,
    invoice_type: invoiceType,
    customer_name: customerName,
    customer_dni: customerDni,
    delivery_address: deliveryAddress,
    items: order.items || order.order_items || [],
    invoice_data: {
      ...rawFiscal,
      type: invoiceType,
      legal_name: legalName,
      tax_id: taxId,
      fiscal_address: fiscalAddress,
    },
  };
}

export async function generateReceiptBlob(order) {
  const normalizedOrder = normalizeOrderForFiscalReceipt(order);
  const rawBlob = buildPdfBlob(normalizedOrder);
  if (rawBlob instanceof Blob && rawBlob.type === "application/pdf") {
    return rawBlob;
  }
  return new Blob([rawBlob], { type: "application/pdf" });
}

export async function handleDownloadFiscalReceipt(order) {
  try {
    const docBlob = await generateReceiptBlob(order);
    const blobUrl = URL.createObjectURL(docBlob);
    const link = document.createElement("a");
    link.href = blobUrl;

    const rawCode = String(
      order?.order_number || order?.id?.slice(0, 6) || "00000",
    ).replace(/^#/, "");
    const normalizedCode = rawCode.toUpperCase().startsWith("ERX-")
      ? rawCode
      : `ERX-${rawCode}`;

    link.download = `comprobante-${normalizedCode}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Error al generar comprobante PDF:", err);
    throw new Error("No se pudo sintetizar el comprobante fiscal.");
  }
}
