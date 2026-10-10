import { supabase } from "../../../services/supabase";

export const ORDER_STATUS = {
  RECEIVED: "received",
  PREPARING: "en_preparacion",
  DISPATCHED: "en_camino",
  DELIVERED: "entregado",
  CANCELLED: "cancelado",
};

export const ORDER_STATUS_LABELS = {
  received: "Recibido",
  pending: "Pendiente",
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparing: "En preparación",
  en_preparacion: "En preparación",
  dispatched: "En camino",
  en_camino: "En camino",
  nearby: "Cerca",
  cerca: "Cerca",
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
  profiles:customer_id (
    id, dni, first_name, paternal_surname, maternal_surname, email, phone
  )
`;

export async function listOrders({
  page = 1,
  pageSize = 10,
  status = "all",
  invoiceType = "all",
  paymentMethod = "all",
  search = "",
} = {}) {
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (invoiceType !== "all") query = query.eq("invoice_type", invoiceType);
  if (paymentMethod !== "all") query = query.eq("payment_method", paymentMethod);

  const term = search.trim();
  if (term) {
    const safe = term.replace(/[%_,]/g, " ");
    query = query.or(
      `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_phone.ilike.%${safe}%`,
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

/**
 * Obtiene la lista de usuarios con rol de repartidor
 */
export async function getDeliveryStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, paternal_surname, phone")
    .eq("role", "delivery");

  if (error) throw error;
  return data || [];
}

/**
 * Actualizar datos del repartidor en tabla profiles
 */
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
 * Asigna un repartidor a una orden y actualiza su estado si está en 'received'
 */
export async function assignOrderDelivery(orderId, deliveryId, currentStatus) {
  const nextStatus = currentStatus === "received" ? "en_preparacion" : currentStatus;
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      assigned_delivery_id: deliveryId || null,
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;
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

/**
 * Consulta de pedidos para la Cola de Despacho Inmediato:
 * Filtra únicamente pedidos operativos en estado 'received' o 'en_preparacion'.
 */
export async function getImmediateDispatchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, status, total_amount, delivery_type,
      payment_status, created_at, customer_name, customer_email,
      customer_phone, delivery_address, scheduled_time_slot
    `)
    .in("status", ["received", "en_preparacion"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Calcula el total de ventas sumando total_amount sobre todos los pedidos
 * donde status !== 'cancelado' y status !== 'cancelled' y payment_status !== 'failed'
 */
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

/**
 * Consulta de ventas totales acumuladas en Supabase filtradas por fecha_inicio
 */
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
