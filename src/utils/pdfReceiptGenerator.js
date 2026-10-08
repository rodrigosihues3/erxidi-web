import { jsPDF } from "jspdf";

const formatMoney = (amount) => `S/ ${Number(amount || 0).toFixed(2)}`;

export function generateReceiptPDF(order) {
  if (!order) {
    throw new Error("No hay datos del pedido para generar el comprobante.");
  }

  const doc = new jsPDF("portrait", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 44;
  const right = pageWidth - 44;
  const contentWidth = right - left;

  const items = order.items || order.order_items || [];
  const invoiceData = order.invoice_data || {};
  const isInvoice = (order.invoice_type || "").toLowerCase() === "factura";
  const documentNumber = invoiceData.doc_number || order.order_number;
  const issuedAt =
    invoiceData.issued_at || order.created_at || new Date().toISOString();
  const dateLabel = new Date(issuedAt).toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let y = 46;

  const addPageIfNeeded = (height) => {
    if (y + height > pageHeight - 60) {
      doc.addPage();
      y = 44;
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------
  // 1. CABECERA: Emisor (Izquierda) y Recuadro Fiscal (Derecha)
  // ---------------------------------------------------------
  // Datos del Emisor
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ERXIDI", left, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("CONFECCIONES TEXTILES", left, y + 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("ERXIDI S.A.C.", left, y + 37);
  doc.text("RUC: 20608945123", left, y + 49);
  doc.text("Lima Metropolitana, Perú", left, y + 61);
  doc.text("soporte@erxidi.com  |  +51 987 654 321", left, y + 73);

  // Recuadro Fiscal Normativo (Estilo SUNAT)
  const boxWidth = 200;
  const boxHeight = 78;
  const boxX = right - boxWidth;
  const boxY = y - 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("R.U.C. 20608945123", boxX + boxWidth / 2, boxY + 20, {
    align: "center",
  });

  doc.setFillColor(226, 232, 240);
  doc.rect(boxX, boxY + 28, boxWidth, 24, "F");

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    isInvoice ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA",
    boxX + boxWidth / 2,
    boxY + 44,
    { align: "center" },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9); // Tono ámbar/acento
  doc.text(
    String(documentNumber || "ORD-000000"),
    boxX + boxWidth / 2,
    boxY + 68,
    { align: "center" },
  );

  y = boxY + boxHeight + 20;

  // ---------------------------------------------------------
  // 2. DATOS DEL COMPROBANTE Y CLIENTE
  // ---------------------------------------------------------
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(left, y, right, y);
  y += 14;

  doc.setFillColor(248, 250, 252);
  doc.rect(left, y, contentWidth, 54, "F");
  doc.roundedRect(left, y, contentWidth, 54, 2, 2, "S");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("FECHA DE EMISIÓN:", left + 8, y + 15);
  doc.text("CLIENTE / RAZÓN SOCIAL:", left + 8, y + 29);
  doc.text("DOC. IDENTIDAD (DNI/RUC):", left + 8, y + 43);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(dateLabel, left + 130, y + 15);
  doc.text(
    String(invoiceData.legal_name || order.customer_name || "Cliente ERXIDI"),
    left + 130,
    y + 29,
  );
  doc.text(
    String(invoiceData.tax_id || order.customer_dni || "No especificado"),
    left + 130,
    y + 43,
  );

  // Columna derecha del bloque cliente
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("FORMA DE PAGO:", left + 320, y + 15);
  doc.text("DIRECCIÓN:", left + 320, y + 29);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(
    String(order.payment_method || "Contado").toUpperCase(),
    left + 395,
    y + 15,
  );

  const addressText = doc.splitTextToSize(
    String(order.delivery_address || "Entrega en punto ERXIDI"),
    right - (left + 395) - 4,
  );
  doc.text(addressText, left + 395, y + 29);

  y += 68;

  // ---------------------------------------------------------
  // 3. TABLA DE ÍTEMS
  // ---------------------------------------------------------
  const drawItemsHeader = () => {
    doc.setFillColor(30, 41, 59); // Fondo pizarra oscuro formal
    doc.rect(left, y - 11, contentWidth, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("CANT.", left + 8, y + 2);
    doc.text("DESCRIPCIÓN DE LA PRENDA", left + 46, y + 2);
    doc.text("P. UNIT.", right - 95, y + 2, { align: "right" });
    doc.text("SUBTOTAL", right - 8, y + 2, { align: "right" });
    y += 18;
  };

  addPageIfNeeded(30);
  drawItemsHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  items.forEach((item, idx) => {
    const variant = item.product_variants || item.variant || {};
    const product = variant.products || item.product || {};
    const size = item.size || variant.sizes?.name || item.sizes?.name;
    const color = item.color || variant.color;

    const baseName =
      item.product_name || item.name || product.name || "Prenda ERXIDI";
    const specs = [
      size ? `Talla: ${size}` : null,
      color ? `Color: ${color}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const fullDescription = specs ? `${baseName} (${specs})` : baseName;
    const descLines = doc.splitTextToSize(fullDescription, 290);
    const rowHeight = Math.max(18, descLines.length * 11 + 6);

    if (addPageIfNeeded(rowHeight)) {
      drawItemsHeader();
    }

    // Fondo alternado para filas
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(left, y - 9, contentWidth, rowHeight, "F");
    }

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price ?? item.unit_price ?? 0);
    const itemSubtotal = Number(item.subtotal ?? unitPrice * quantity);

    doc.setFont("helvetica", "bold");
    doc.text(String(quantity), left + 8, y + 2);
    doc.setFont("helvetica", "normal");
    doc.text(descLines, left + 46, y + 2);
    doc.text(formatMoney(unitPrice), right - 95, y + 2, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(itemSubtotal), right - 8, y + 2, { align: "right" });

    y += rowHeight;
    doc.setDrawColor(241, 245, 249);
    doc.line(left, y - 7, right, y - 7);
  });

  // ---------------------------------------------------------
  // 4. TOTALES Y LIQUIDACIÓN TRIBUTARIA
  // ---------------------------------------------------------
  const deliveryCost = Number(order.delivery_cost || 0);
  const calculatedItemsSubtotal = items.reduce(
    (acc, it) =>
      acc +
      Number(
        it.subtotal ??
          Number(it.price ?? it.unit_price ?? 0) * Number(it.quantity || 1),
      ),
    0,
  );
  const total = Number(
    order.total_amount ?? calculatedItemsSubtotal + deliveryCost,
  );
  const subtotal = Math.max(0, total - deliveryCost);
  const taxableAmount = Number((subtotal / 1.18).toFixed(2));
  const taxAmount = Number((subtotal - taxableAmount).toFixed(2));

  y += 12;
  addPageIfNeeded(95);

  const totalsBoxX = right - 220;
  const totalsBoxWidth = 220;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Op. Gravadas:", totalsBoxX, y);
  doc.text(formatMoney(taxableAmount), right - 8, y, { align: "right" });
  y += 14;

  doc.text("I.G.V. (18%):", totalsBoxX, y);
  doc.text(formatMoney(taxAmount), right - 8, y, { align: "right" });
  y += 14;

  doc.text("Flete / Despacho:", totalsBoxX, y);
  doc.text(formatMoney(deliveryCost), right - 8, y, { align: "right" });
  y += 15;

  // Barra de importe total
  doc.setFillColor(30, 41, 59);
  doc.rect(totalsBoxX - 6, y - 10, totalsBoxWidth + 6, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("IMPORTE TOTAL:", totalsBoxX, y + 4);
  doc.text(formatMoney(total), right - 8, y + 4, { align: "right" });

  // ---------------------------------------------------------
  // 5. PIE DE PÁGINA Y NOTA LEGAL
  // ---------------------------------------------------------
  y += 34;
  addPageIfNeeded(32);
  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, right, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);

  const legalNotice =
    "Representación impresa de Comprobante de Pago Electrónico. Consulta la validez de tu comprobante en la sede electrónica de SUNAT. Por motivos de salubridad e higiene, las prendas íntimas y calcetería no admiten cambios ni devoluciones una vez vulnerado el empaque primario.";
  const legalLines = doc.splitTextToSize(legalNotice, contentWidth);
  doc.text(legalLines, left, y);

  doc.save(`${documentNumber || order.order_number}.pdf`);
}

export const generateInvoicePDF = generateReceiptPDF;
