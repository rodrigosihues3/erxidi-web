import { supabase } from "../../../services/supabase";

export const ORDER_STATUS = {
  RECEIVED: "received",
  PREPARING: "en_preparacion",
  READY_FOR_DELIVERY: "por_asignar_repartidor",
  ASSIGNED: "asignado",
  DISPATCHED: "en_camino",
  NEARBY: "cerca",
  ARRIVED: "en_destino",
  DELIVERED: "entregado",
  CANCELLED: "cancelado",
  INCIDENT: "incidencia_transporte",
};

export const DELIVERY_STEPS = [
  { key: "recibido", label: "Recibido", sublabel: "Validación inicial / Voucher", stepNumber: 1 },
  { key: "en_preparacion", label: "En Preparación", sublabel: "Armado de paquete", stepNumber: 2 },
  { key: "por_asignar", label: "Por Asignar", sublabel: "En bolsa común", stepNumber: 3 },
  { key: "asignado", label: "Asignado", sublabel: "Repartidor con paquete", stepNumber: 4 },
  { key: "en_camino", label: "En Ruta", sublabel: "En tránsito al destino", stepNumber: 5 },
  { key: "cerca", label: "Cerca", sublabel: "A pocas cuadras", stepNumber: 6 },
  { key: "en_ubicacion", label: "En Ubicación", sublabel: "Repartidor en puerta", stepNumber: 7 },
  { key: "entregado", label: "Entregado", sublabel: "Recepción conforme", stepNumber: 8 },
];

export const PICKUP_STEPS = [
  { key: "recibido", label: "Recibido", sublabel: "Validación inicial / Voucher", stepNumber: 1 },
  { key: "en_preparacion", label: "En Preparación", sublabel: "Empaque en almacén", stepNumber: 2 },
  { key: "listo_recojo", label: "Listo para Recojo", sublabel: "Esperando al cliente en tienda", stepNumber: 3 },
  { key: "entregado", label: "Entregado", sublabel: "Entrega física completada", stepNumber: 4 },
];

export const ORDER_LIFECYCLE_STEPS = DELIVERY_STEPS;

const STEP_KEY_TO_DB_STATUS = {
  recibido: "recibido",
  en_preparacion: "en_preparacion",
  por_asignar: "por_asignar_repartidor",
  listo_recojo: "por_asignar_repartidor",
  asignado: "asignado",
  en_camino: "en_camino",
  cerca: "cerca",
  en_ubicacion: "en_destino",
  entregado: "entregado",
};

export function mapStepKeyToDbStatus(stepKeyOrStatus) {
  return STEP_KEY_TO_DB_STATUS[stepKeyOrStatus] || stepKeyOrStatus;
}

export function normalizeStatusToStepKey(status, isPickup = false) {
  const s = (status || "").toLowerCase();
  if (["recibido", "received", "pendiente_pago", "pending", "pagado"].includes(s)) {
    return "recibido";
  }
  if (["en_preparacion", "preparing"].includes(s)) {
    return "en_preparacion";
  }
  if (isPickup) {
    if (["listo_recojo", "por_asignar", "por_asignar_repartidor", "en_destino", "arrived"].includes(s)) {
      return "listo_recojo";
    }
  } else {
    if (["por_asignar", "por_asignar_repartidor"].includes(s)) {
      return "por_asignar";
    }
    if (s === "asignado") {
      return "asignado";
    }
    if (["en_camino", "dispatched"].includes(s)) {
      return "en_camino";
    }
    if (["cerca", "nearby"].includes(s)) {
      return "cerca";
    }
    if (["en_ubicacion", "en_destino", "arrived"].includes(s)) {
      return "en_ubicacion";
    }
  }
  if (["entregado", "delivered"].includes(s)) {
    return "entregado";
  }
  if (["cancelado", "cancelled"].includes(s)) {
    return "cancelado";
  }
  if (s === "incidencia_transporte") {
    return "incidencia_transporte";
  }
  return "recibido";
}

export const ORDER_STATUS_LABELS = {
  recibido: "Recibido",
  received: "Recibido",
  pending: "Pendiente",
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparing: "En preparación",
  en_preparacion: "En preparación",
  por_asignar: "Por Asignar",
  por_asignar_repartidor: "Por Asignar",
  listo_recojo: "Listo para Recojo",
  asignado: "Asignado",
  dispatched: "En Ruta",
  en_camino: "En Ruta",
  nearby: "Cerca",
  cerca: "Cerca",
  en_ubicacion: "En Ubicación",
  en_destino: "En Ubicación",
  arrived: "En Ubicación",
  incidencia_transporte: "Incidencia en reparto",
  delivered: "Entregado",
  entregado: "Entregado",
  cancelled: "Cancelado",
  cancelado: "Cancelado",
};

const ORDER_SELECT = `
  id, order_number, customer_id, shipping_address_id, customer_name, customer_email, customer_phone,
  delivery_address, scheduled_time_slot, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_gateway_tx_id, status, payment_status,
  invoice_type, invoice_data, created_at, updated_at, assigned_delivery_id,
  incident_reason, incident_comment,
  profiles:customer_id (
    id, dni, first_name, paternal_surname, maternal_surname, email, phone
  ),
  addresses:shipping_address_id (
    id, alias, receiver_name, receiver_phone, department, province, street_address, reference,
    delivery_zones:zone_id ( id, district_name, delivery_cost, estimated_delivery_time )
  ),
  delivery_profile:assigned_delivery_id (
    id, first_name, paternal_surname, phone, delivery_type
  ),
  order_items (
    id, quantity, unit_price, subtotal,
    product_variants:variant_id (
      id, color, sku,
      sizes:size_id ( name ),
      products:product_id ( name, main_image_url )
    )
  )
`;

export async function listOrders({
  page = 1,
  pageSize = 10,
  status = "all",
  invoiceType = "all",
  paymentMethod = "all",
  deliveryType = "all",
  search = "",
} = {}) {
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all" && status !== "todos") {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }
  if (invoiceType !== "all" && invoiceType !== "todos") {
    query = query.eq("invoice_type", invoiceType);
  }
  if (paymentMethod !== "all" && paymentMethod !== "todos") {
    if (Array.isArray(paymentMethod)) {
      query = query.in("payment_method", paymentMethod);
    } else {
      query = query.eq("payment_method", paymentMethod);
    }
  }
  if (deliveryType !== "all" && deliveryType !== "todos") {
    if (Array.isArray(deliveryType)) {
      query = query.in("delivery_type", deliveryType);
    } else {
      query = query.eq("delivery_type", deliveryType);
    }
  }

  const term = search.trim();
  if (term) {
    const safe = term.replace(/[%_,]/g, " ");
    query = query.or(
      `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_phone.ilike.%${safe}%,payment_gateway_tx_id.ilike.%${safe}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getOrderDetail(orderId) {
  const [{ data: order, error: orderError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).single(),
      supabase
        .from("order_items")
        .select(`
          id, order_id, variant_id, quantity, unit_price, subtotal,
          product_variants:variant_id (
            id, color, color_hex, stock, sku, size_id,
            sizes:size_id (id, name, display_order),
            products:product_id (id, name, slug, price, main_image_url)
          )
        `)
        .eq("order_id", orderId)
        .order("id", { ascending: true }),
    ]);

  if (orderError) throw orderError;
  if (itemsError) throw itemsError;

  const isPool =
    order.status === "por_asignar_repartidor" && !order.assigned_delivery_id;

  return { ...order, in_pool: isPool, items: items ?? [] };
}

export async function updateOrderStatus(orderId, status) {
  const dbStatus = mapStepKeyToDbStatus(status);
  const payload = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  };

  if (
    ["recibido", "received", "en_preparacion", "por_asignar_repartidor"].includes(
      dbStatus,
    )
  ) {
    payload.assigned_delivery_id = null;
  }

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .select("id, order_number, status, assigned_delivery_id, updated_at")
    .single();

  if (error) throw error;
  return {
    ...data,
    in_pool:
      data.status === "por_asignar_repartidor" && !data.assigned_delivery_id,
  };
}

export async function toggleOrderPool(orderId, currentlyInPool) {
  const nextStatus = currentlyInPool
    ? "en_preparacion"
    : "por_asignar_repartidor";

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      assigned_delivery_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_number, status, assigned_delivery_id, updated_at")
    .single();

  if (error) throw error;
  return {
    ...data,
    in_pool:
      data.status === "por_asignar_repartidor" && !data.assigned_delivery_id,
  };
}

export async function reportOrderIncident(
  orderId,
  { reason, comment, returnToPool = false },
) {
  const payload = {
    incident_reason: reason || "Incidencia operativa",
    incident_comment: comment || null,
    updated_at: new Date().toISOString(),
  };

  if (returnToPool) {
    payload.status = "por_asignar_repartidor";
    payload.assigned_delivery_id = null;
  } else {
    payload.status = "incidencia_transporte";
  }

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .select(
      "id, order_number, status, assigned_delivery_id, incident_reason, incident_comment, updated_at",
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    in_pool:
      data.status === "por_asignar_repartidor" && !data.assigned_delivery_id,
  };
}

export async function cancelOrderWithStockRestore(
  orderId,
  { reason, comment, items = [], previousStatus },
) {
  const alreadyCancelled = ["cancelado", "cancelled"].includes(
    (previousStatus || "").toLowerCase(),
  );

  if (!alreadyCancelled && items.length > 0) {
    for (const item of items) {
      const variantId = item.variant_id || item.product_variants?.id;
      const qty = Number(item.quantity || 0);
      if (!variantId || qty <= 0) continue;

      const { data: variantRow } = await supabase
        .from("product_variants")
        .select("id, stock")
        .eq("id", variantId)
        .single();

      if (variantRow) {
        await supabase
          .from("product_variants")
          .update({
            stock: Number(variantRow.stock || 0) + qty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", variantId);
      }
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "cancelado",
      assigned_delivery_id: null,
      incident_reason: reason || "Pedido cancelado",
      incident_comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(
      "id, order_number, status, assigned_delivery_id, incident_reason, incident_comment, updated_at",
    )
    .single();

  if (error) throw error;
  return { ...data, in_pool: false };
}

/**
 * Aprueba un pago manual verificado (Yape, Plin o Transferencia)
 * y traslada la orden automáticamente a 'en_preparacion'.
 */
export async function verifyOrderPayment(orderId) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "en_preparacion",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_number, status, payment_status, updated_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Rechaza un voucher no válido o pago fraudulento.
 */
export async function rejectOrderPayment(orderId, reasonComment) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      status: "cancelado",
      incident_comment: reasonComment || "Voucher o transferencia no verificada por administración",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_number, status, payment_status, updated_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marca el empaque como listo y traslada la orden a la bolsa de repartidores ('por_asignar_repartidor').
 */
export async function markOrderReadyForDelivery(orderId) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "por_asignar_repartidor",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_number, status, updated_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Resuelve una incidencia de transporte (reencolar a la bolsa o devolver a preparación).
 */
export async function resolveOrderIncident(orderId, targetStatus = "por_asignar_repartidor") {
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: targetStatus,
      assigned_delivery_id: null,
      incident_reason: null,
      incident_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_number, status, assigned_delivery_id, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getDeliveryStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, dni, first_name, paternal_surname, phone, delivery_type, operational_status, is_on_duty, is_active",
    )
    .eq("role", "delivery");

  if (error) throw error;
  return (data || []).filter((c) => c.is_active !== false);
}

export function subscribeCouriersRealtime(onCourierUpdate) {
  const channel = supabase
    .channel("couriers_realtime_status")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "delivery_users" },
      (payload) => {
        if (payload?.new) {
          onCourierUpdate(payload.new);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (payload) => {
        if (payload?.new) {
          onCourierUpdate(payload.new);
        }
      },
    )
    .on("broadcast", { event: "courier_status_change" }, (payload) => {
      if (payload?.payload) {
        onCourierUpdate(payload.payload);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateDeliveryStaff(id, payload) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: payload.first_name,
      paternal_surname: payload.paternal_surname,
      maternal_surname: payload.maternal_surname,
      phone: payload.phone,
      dni: payload.dni,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

const IN_ROUTE_STATUSES = [
  "asignado",
  "en_camino",
  "cerca",
  "en_destino",
  "dispatched",
  "nearby",
  "arrived",
];

export async function assignOrderDelivery(orderId, deliveryId, currentStatus) {
  let nextStatus = mapStepKeyToDbStatus(currentStatus);
  if (!deliveryId) {
    if (IN_ROUTE_STATUSES.includes(nextStatus)) {
      nextStatus = "por_asignar_repartidor";
    }
  } else if (
    ["recibido", "received", "en_preparacion", "por_asignar_repartidor"].includes(
      nextStatus,
    )
  ) {
    nextStatus = "asignado";
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      assigned_delivery_id: deliveryId || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    in_pool:
      data.status === "por_asignar_repartidor" && !data.assigned_delivery_id,
  };
}

export async function getDashboardOrders(filterRange = "30days") {
  let query = supabase
    .from("orders")
    .select(`
      id, order_number, status, total_amount, delivery_type,
      payment_status, created_at, customer_name, customer_email
    `)
    .order("created_at", { ascending: false });

  let since = null;
  if (filterRange === "today" || filterRange === "1") {
    since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  } else if (filterRange === "7days" || filterRange === "7") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (filterRange === "30days" || filterRange === "30") {
    since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (filterRange === "all") {
    since = null;
  } else if (filterRange instanceof Date) {
    since = filterRange.toISOString();
  } else if (typeof filterRange === "string" && (filterRange.includes("T") || filterRange.includes("-"))) {
    since = new Date(filterRange).toISOString();
  }

  if (since) {
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getImmediateDispatchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, status, total_amount, delivery_type,
      payment_status, created_at, customer_name, customer_email,
      customer_phone, delivery_address, scheduled_time_slot
    `)
    .in("status", ["received", "en_preparacion", "por_asignar_repartidor"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function calculateDashboardSales(orders = []) {
  return orders
    .filter(
      (order) =>
        order.status !== "cancelado" &&
        order.status !== "cancelled" &&
        order.payment_status !== "failed",
    )
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}

export async function getDashboardTotalSales(sinceDate) {
  let query = supabase
    .from("orders")
    .select("total_amount, payment_status, status")
    .in("payment_status", ["paid", "pagado"])
    .not("status", "in", '("cancelado","cancelled")');

  if (sinceDate) {
    const iso = sinceDate instanceof Date ? sinceDate.toISOString() : sinceDate;
    query = query.gte("created_at", iso);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
}

export async function getOrderItemsForDashboard(orderIds) {
  if (!orderIds.length) return [];

  const { data, error } = await supabase
    .from("order_items")
    .select(`
      id, order_id, quantity, subtotal,
      product_variants:variant_id (
        id, product_id,
        products:product_id (id, name, main_image_url)
      )
    `)
    .in("order_id", orderIds);

  if (error) throw error;
  return data ?? [];
}

export {
  sendOrderNotificationEmail,
  AUTO_NOTIFICATION_STATUSES,
} from "./orderNotification.service";
