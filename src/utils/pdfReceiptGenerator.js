import { jsPDF } from "jspdf";

const formatMoney = (amount) =>
  `S/ ${Number(amount || 0).toFixed(2)}`;

export function generateReceiptPDF(order) {
  if (!order) {
    throw new Error("No hay datos del pedido para generar el comprobante.");
  }

  const doc = new jsPDF("portrait", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageWidth - 48;
  const items = order.items || order.order_items || [];
  const invoiceData = order.invoice_data || {};
  const isInvoice = order.invoice_type === "factura";
  const documentNumber = invoiceData.doc_number || order.order_number;
  const issuedAt = invoiceData.issued_at || order.created_at || new Date().toISOString();
  const dateLabel = new Date(issuedAt).toLocaleString("es-PE");
  let y = 52;

  const addPageIfNeeded = (height) => {
    if (y + height > pageHeight - 62) {
      doc.addPage();
      y = 48;
      return true;
    }
    return false;
  };

  const drawItemsHeader = () => {
    doc.setFillColor(244, 244, 245);
    doc.rect(left, y - 13, right - left, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Cant.", left + 6, y + 2);
    doc.text("Descripción", left + 48, y + 2);
    doc.text("P. unitario", right - 112, y + 2, { align: "right" });
    doc.text("Subtotal", right - 6, y + 2, { align: "right" });
    y += 23;
  };

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("ERXIDI S.A.C.", left, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("RUC: 20608945123", left, y);
  doc.text("Dirección: Lima Metropolitana, Perú", left, y + 14);
  doc.text("Teléfono: +51 987 654 321", left, y + 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    isInvoice ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA",
    right,
    y,
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Serie y número: ${documentNumber || "No disponible"}`, right, y + 16, {
    align: "right",
  });
  doc.text(`Emisión: ${dateLabel}`, right, y + 30, { align: "right" });
  y += 55;
  doc.setDrawColor(203, 213, 225);
  doc.line(left, y, right, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Datos del cliente", left, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clientLines = [
    `Cliente / razón social: ${invoiceData.legal_name || order.customer_name || "Cliente ERXIDI"}`,
    `DNI / RUC: ${invoiceData.tax_id || order.customer_dni || "No indicado"}`,
    `Dirección de entrega: ${order.delivery_address || "Recojo en punto ERXIDI"}`,
  ];
  for (const line of clientLines) {
    const wrapped = doc.splitTextToSize(line, right - left);
    addPageIfNeeded(wrapped.length * 12);
    doc.text(wrapped, left, y);
    y += wrapped.length * 12;
  }

  y += 17;
  addPageIfNeeded(35);
  drawItemsHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const item of items) {
    const variant = item.product_variants || item.variant || {};
    const product = variant.products || item.product || {};
    const size = item.size || variant.sizes?.name || item.sizes?.name;
    const color = item.color || variant.color;
    const description = [
      item.name || product.name || "Prenda ERXIDI",
      size ? `Talla ${size}` : null,
      color ? `Color ${color}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const descriptionLines = doc.splitTextToSize(description, 230);
    const rowHeight = Math.max(18, descriptionLines.length * 11 + 6);

    if (addPageIfNeeded(rowHeight)) {
      drawItemsHeader();
    }

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price ?? item.unit_price ?? 0);
    const itemSubtotal = Number(item.subtotal ?? unitPrice * quantity);
    doc.text(String(quantity), left + 6, y + 2);
    doc.text(descriptionLines, left + 48, y + 2);
    doc.text(formatMoney(unitPrice), right - 112, y + 2, { align: "right" });
    doc.text(formatMoney(itemSubtotal), right - 6, y + 2, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(228, 228, 231);
    doc.line(left, y - 2, right, y - 2);
  }

  const subtotal = Number(order.subtotal || 0);
  const taxableAmount = Number((subtotal / 1.18).toFixed(2));
  const taxAmount = Number((subtotal - taxableAmount).toFixed(2));
  const deliveryCost = Number(order.delivery_cost || 0);
  const total = Number(order.total_amount ?? subtotal + deliveryCost);

  y += 16;
  addPageIfNeeded(102);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal de prendas: ${formatMoney(subtotal)}`, right, y, {
    align: "right",
  });
  y += 15;
  doc.text(`Operaciones gravadas: ${formatMoney(taxableAmount)}`, right, y, {
    align: "right",
  });
  y += 15;
  doc.text(`IGV (18%): ${formatMoney(taxAmount)}`, right, y, { align: "right" });
  y += 15;
  doc.text(`Costo de despacho: ${formatMoney(deliveryCost)}`, right, y, {
    align: "right",
  });
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: ${formatMoney(total)}`, right, y, { align: "right" });

  y += 32;
  addPageIfNeeded(34);
  doc.setDrawColor(203, 213, 225);
  doc.line(left, y, right, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const legalText =
    "Representación impresa de la Boleta/Factura Electrónica. Por motivos de higiene, la ropa interior no cuenta con cambios ni devoluciones.";
  const legalLines = doc.splitTextToSize(legalText, right - left);
  doc.text(legalLines, left, y);

  doc.save(`${documentNumber || order.order_number}.pdf`);
}
