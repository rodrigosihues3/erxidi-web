import { supabase } from "../supabase";

/**
 * Servicio transaccional para registrar pedidos y sus ítems en Supabase.
 * @param {Object} orderPayload - Datos consolidados del checkout.
 * @returns {Promise<{ success: boolean, order?: Object, error?: string }>}
 */
export async function createOrder(orderPayload) {
  const orderNumber = `ERX-${Date.now().toString().slice(-6)}`;

  const orderData = {
    order_number: orderNumber,
    customer_id: orderPayload.userId || null,
    customer_name: orderPayload.customerName,
    customer_email: orderPayload.customerEmail,
    customer_phone: orderPayload.customerPhone,
    delivery_type: orderPayload.deliveryType || "scheduled",
    delivery_address: orderPayload.deliveryAddress,
    shipping_address_id:
      orderPayload.shipping_address_id ||
      orderPayload.shippingAddressId ||
      null,
    delivery_cost: Number(orderPayload.deliveryCost || 0),
    scheduled_time_slot: orderPayload.scheduledTimeSlot || null,
    subtotal: Number(orderPayload.subtotal || 0),
    total_amount: Number(orderPayload.totalAmount || 0),
    payment_method:
      orderPayload.payment_method || orderPayload.paymentMethod || "yape_plin",
    payment_status:
      orderPayload.payment_status ||
      orderPayload.paymentStatus ||
      "pending_verification",
    payment_gateway_tx_id:
      orderPayload.payment_gateway_tx_id ||
      orderPayload.paymentGatewayTxId ||
      null,
    invoice_type:
      orderPayload.invoice_type || orderPayload.invoiceType || "none",
    invoice_data: orderPayload.invoice_data || orderPayload.invoiceData || {},
    status: "received",
  };

  try {
    // 1. Inserción de orden principal
    const { data: createdOrder, error: orderError } = await supabase
      .from("orders")
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      console.error(
        "Error estricto al insertar en tabla orders de Supabase:",
        orderError,
      );
      return {
        success: false,
        error: orderError.message,
      };
    }

    // 2. Inserción de ítems de la orden
    if (orderPayload.items && orderPayload.items.length > 0) {
      const orderItemsData = orderPayload.items.map((item) => ({
        order_id: createdOrder.id,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsData);

      if (itemsError) {
        console.error("Error estricto al insertar en order_items:", itemsError);
      }
    }

    return {
      success: true,
      order: {
        ...createdOrder,
        items: orderPayload.items || [],
      },
    };
  } catch (err) {
    console.error("Excepción crítica en createOrder:", err);
    return {
      success: false,
      error: err.message || "Error de conexión con la base de datos",
    };
  }
}
