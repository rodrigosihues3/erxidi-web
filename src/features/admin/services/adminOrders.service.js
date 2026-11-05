import { supabase } from "../../../services/supabase";

export const ORDER_STATUS = {
  RECEIVED: "received",
  PREPARING: "en_preparacion",
  POOL: "por_asignar_repartidor",
  READY_FOR_DELIVERY: "por_asignar_repartidor",
  ASSIGNED: "asignado",
  DISPATCHED: "en_camino",
  NEARBY: "cerca",
  ARRIVED: "en_destino",
  DELIVERED: "entregado",
  INCIDENT: "incidencia_transporte",
  CANCELLED: "cancelado",
};

export const ORDER_STATUS_LABELS = {
  recibido: "Recibido",
  received: "Recibido",
  pending: "Pendiente",
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparing: "En preparación",
  en_preparacion: "En preparación",
  por_asignar_repartidor: "Por asignar repartidor",
  asignado: "Asignado",
  dispatched: "En camino",
  en_camino: "En camino",
  nearby: "Cerca",
  cerca: "Cerca",
  en_destino: "En destino",
  arrived: "En destino",
  incidencia_transporte: "Incidencia en reparto",
  delivered: "Entregado",
  entregado: "Entregado",
  cancelled: "Cancelado",
  cancelado: "Cancelado",
};

const ORDER_SELECT = `
  id, order_number, customer_id, customer_name, customer_email, customer_phone,
  delivery_address, scheduled_time_slot, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_gateway_tx_id, status, payment_status,
  invoice_type, invoice_data, created_at, updated_at, assigned_delivery_id,
  incident_reason, incident_comment,
  profiles:customer_id (
    id, dni, first_name, paternal_surname, maternal_surname, email, phone
  ),
  delivery_profile:assigned_delivery_id (
    id, first_name, paternal_surname, phone, delivery_type
  ),
  order_items (
    id, quantity, unit_price, subtotal,
    product_variants:variant_id (
      id, color, sku,
      sizes:size_id ( name ),
      products:product_id ( name )
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

  if (status !== "all") query = query.eq("status", status);
  if (invoiceType !== "all") query = query.eq("invoice_type", invoiceType);
  if (paymentMethod !== "all") query = query.eq("payment_method", paymentMethod);
  if (deliveryType !== "all") query = query.eq("delivery_type", deliveryType);

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

  return { ...order, items: items ?? [] };
}

export async function updateOrderStatus(orderId, status) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, order_number, status, updated_at")
    .single();

  if (error) throw error;
  return data;
}

const STATUS_ALIASES = {
  preparing: "en_preparacion",
  dispatched: "en_camino",
  nearby: "cerca",
  delivered: "entregado",
  cancelled: "cancelado",
};

export const normalizeOrderStatus = (status) =>
  STATUS_ALIASES[status] ?? status;

const EARLY_STATUSES = ["received", "pending", "pendiente_pago", "pagado"];
const isPickupOrder = (order) =>
  ["pickup", "recojo"].includes(order?.delivery_type);

// Siguientes estados que la dueña puede aplicar desde el panel
export function getNextStatuses(order) {
  const status = normalizeOrderStatus(order?.status);
  const {
    PREPARING,
    POOL,
    ASSIGNED,
    DISPATCHED,
    NEARBY,
    DELIVERED,
    INCIDENT,
    CANCELLED,
  } = ORDER_STATUS;

  if (EARLY_STATUSES.includes(status)) return [PREPARING, CANCELLED];
  if (status === PREPARING) {
    if (isPickupOrder(order)) return [DELIVERED, CANCELLED];
    // Con repartidor asignado a mano, él lo inicia desde su panel
    return order?.assigned_delivery_id ? [CANCELLED] : [POOL, CANCELLED];
  }
  if ([POOL, ASSIGNED, DISPATCHED, NEARBY].includes(status)) return [CANCELLED];
  if (status === INCIDENT) return [POOL, CANCELLED];
  return [];
}

// Cambia el estado validando la transición. La condición .eq("status", ...)
// evita pisar un cambio que el repartidor hizo mientras la dueña editaba.
export async function changeOrderStatus(order, nextStatus) {
  if (!getNextStatuses(order).includes(nextStatus)) {
    throw new Error("Ese cambio de estado no está permitido desde el estado actual.");
  }

  const patch = { status: nextStatus, updated_at: new Date().toISOString() };
  // Al volver a la bolsa el pedido queda sin repartidor
  if (nextStatus === ORDER_STATUS.POOL) patch.assigned_delivery_id = null;

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", order.id)
    .eq("status", order.status)
    .select("id, order_number, status, assigned_delivery_id, updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "El pedido cambió mientras lo editabas. Actualiza la vista e inténtalo de nuevo.",
    );
  }
  return data;
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
    .select("id, first_name, paternal_surname, phone, delivery_type")
    .eq("role", "delivery");

  if (error) throw error;
  return data || [];
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

/**
 * Asigna (o quita) un repartidor a mano. Con repartidor, el pedido queda como
 * "asignado" y aparece en su pestaña "Mis Asignados"; al quitarlo de un pedido
 * asignado o en ruta, vuelve a la bolsa.
 */
export async function assignOrderDelivery(orderId, deliveryId, currentStatus) {
  const { PREPARING, POOL, ASSIGNED, INCIDENT, DISPATCHED, NEARBY } = ORDER_STATUS;
  const status = normalizeOrderStatus(currentStatus);
  let nextStatus = currentStatus;

  if (deliveryId) {
    if ([...EARLY_STATUSES, PREPARING, POOL, INCIDENT].includes(status)) {
      nextStatus = ASSIGNED;
    }
  } else if ([ASSIGNED, DISPATCHED, NEARBY].includes(status)) {
    nextStatus = POOL;
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      assigned_delivery_id: deliveryId || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "El pedido cambió mientras lo editabas. Actualiza la vista e inténtalo de nuevo.",
    );
  }
  return data;
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