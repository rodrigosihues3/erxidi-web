import { supabase } from "../supabase";

/**
 * Reserva temporal de inventario previa al paso de pago (TTL 10 min).
 */
export async function reserveStock(cartItems, userId = null) {
  const payload = cartItems.map((item) => ({
    variant_id: Number(item.variantId),
    quantity: Number(item.quantity) || 1,
  }));

  const { data, error } = await supabase.rpc("reserve_checkout_stock", {
    p_items: payload,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || "Error al verificar la disponibilidad de inventario.");
  }

  return data;
}

/**
 * Verificación integral de pre-vuelo (Horarios, Tienda abierta, Flota disponible y Reserva).
 */
export async function verifyPreflight({ reservationToken, deliveryType, totalItems }) {
  const { data, error } = await supabase.rpc("verify_checkout_preflight", {
    p_reservation_token: reservationToken,
    p_delivery_type: deliveryType,
    p_total_items: totalItems,
  });

  if (error) {
    throw new Error(error.message || "Error al validar las condiciones del pedido.");
  }

  return data;
}

/**
 * Servicio transaccional para registrar pedidos y confirmar la reserva de stock.
 */
export async function createOrder(orderPayload) {
  const items = Array.isArray(orderPayload.items) ? orderPayload.items : [];

  if (items.length === 0) {
    return {
      success: false,
      error: "No se puede registrar una orden sin prendas en el carrito.",
    };
  }

  const orderNumber = "ERX-" + Date.now().toString().slice(-6);

  try {
    const variantIds = items.map((item) => Number(item.variantId));
    const { data: dbVariants, error: variantsCheckError } = await supabase
      .from("product_variants")
      .select("id, stock, is_active, sku, products:product_id (name, price, is_active)")
      .in("id", variantIds);

    if (variantsCheckError) {
      throw new Error("No se pudo verificar el inventario: " + variantsCheckError.message);
    }

    const variantMap = new Map((dbVariants || []).map((v) => [Number(v.id), v]));

    let verifiedSubtotal = 0;
    const verifiedItemsPayload = [];

    for (const item of items) {
      const dbVariant = variantMap.get(Number(item.variantId));
      const requestedQty = Math.max(1, Number(item.quantity) || 1);

      if (!dbVariant || dbVariant.is_active === false || dbVariant.products?.is_active === false) {
        return {
          success: false,
          error: 'La prenda "' + (item.name || "seleccionada") + '" ya no se encuentra disponible.',
        };
      }

      const unitPrice = Number(dbVariant.products?.price ?? item.price);
      const itemSubtotal = Number((unitPrice * requestedQty).toFixed(2));
      verifiedSubtotal += itemSubtotal;

      verifiedItemsPayload.push({
        variant_id: Number(item.variantId),
        quantity: requestedQty,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      });
    }

    const deliveryCost = Number(orderPayload.deliveryCost || 0);
    const finalSubtotal = Number(verifiedSubtotal.toFixed(2));
    const finalTotalAmount = Number((finalSubtotal + deliveryCost).toFixed(2));

    const orderData = {
      order_number: orderNumber,
      customer_id: orderPayload.userId || null,
      customer_name: orderPayload.customerName,
      customer_email: orderPayload.customerEmail,
      customer_phone: orderPayload.customerPhone,
      delivery_type: orderPayload.deliveryType || "scheduled",
      delivery_address: orderPayload.deliveryAddress,
      delivery_latitude:
        orderPayload.delivery_latitude ??
        orderPayload.deliveryLatitude ??
        null,
      delivery_longitude:
        orderPayload.delivery_longitude ??
        orderPayload.deliveryLongitude ??
        null,
      shipping_address_id:
        orderPayload.shipping_address_id ||
        orderPayload.shippingAddressId ||
        null,
      delivery_cost: deliveryCost,
      scheduled_time_slot: orderPayload.scheduledTimeSlot || null,
      subtotal: finalSubtotal,
      total_amount: finalTotalAmount,
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

    // 1. Inserción de la orden principal
    const { data: createdOrder, error: orderError } = await supabase
      .from("orders")
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      return { success: false, error: orderError.message };
    }

    // 2. Inserción de ítems congelados (Snapshot Pattern)
    const orderItemsData = verifiedItemsPayload.map((row) => ({
      ...row,
      order_id: createdOrder.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
      return {
        success: false,
        error: "Error al registrar el detalle del pedido: " + itemsError.message,
      };
    }

    // 3. Confirmar la reserva de stock y descontar inventario físico
    if (orderPayload.reservationToken) {
      await supabase
        .from("stock_reservations")
        .update({ status: "confirmed" })
        .eq("reservation_token", orderPayload.reservationToken);
    }

    for (const row of verifiedItemsPayload) {
      const { error: rpcError } = await supabase.rpc("decrement_variant_stock", {
        p_variant_id: row.variant_id,
        p_quantity: row.quantity,
      });

      if (rpcError) {
        const currentVariant = variantMap.get(row.variant_id);
        const nextStock = Math.max(0, Number(currentVariant.stock) - row.quantity);
        await supabase
          .from("product_variants")
          .update({
            stock: nextStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.variant_id);
      }
    }

    return {
      success: true,
      order: {
        ...createdOrder,
        items: items,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error de conexión con la base de datos.",
    };
  }
}