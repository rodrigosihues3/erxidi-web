import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  VISIBLE_DB_STATUSES,
  PICKUP_TYPES,
  CASH_METHODS,
  normalizeStatus,
} from "./deliveryStatus";

export const MAX_ITEMS_PER_TRIP = 30;

// Misma forma que repartidor.json: pedido -> customer, shipping_address, items
// Los nombres después de "!" son las llaves foráneas reales de la tabla orders.
const ORDERS_SELECT = `
  id, order_number, status, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_status, created_at, updated_at,
  customer_name, customer_phone, delivery_address, scheduled_time_slot,
  delivery_latitude, delivery_longitude, incident_reason, incident_comment,
  items:order_items(
    id, quantity, unit_price, subtotal, variant_id,
    variant:product_variants(
      id, sku, color,
      sizes(name),
      products(name)
    )
  )
`;

const POOL_ORDERS_SELECT = `
  id, order_number, status, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_status, created_at, updated_at,
  customer_name, customer_phone, delivery_address, scheduled_time_slot,
  delivery_latitude, delivery_longitude,
  order_items ( id, quantity, variant_id, product_variants ( products ( name ) ) )
`;

function prepare(row) {
  const rawItems = row.items ?? row.order_items ?? [];
  return {
    ...row,
    status: normalizeStatus(row.status),
    total_items: rawItems.reduce((n, i) => n + (Number(i.quantity) || 0), 0),
    order_items: rawItems,
    items: rawItems.map((it) => {
      const v = it.variant ?? it.product_variants;
      return {
        ...it,
        variant: {
          ...v,
          product: v?.products || { name: "Prenda" },
          size: v?.sizes || null,
        },
      };
    }),
  };
}

// useMock = true usa repartidor.json (pruebas sin base de datos)
export function useDeliveryOrders({ useMock = false } = {}) {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [poolOrders, setPoolOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setError(null);

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [assignedRes, poolRes] = await Promise.all([
      supabase
        .from("orders")
        .select(ORDERS_SELECT)
        .eq("assigned_delivery_id", user.id)
        .in("status", VISIBLE_DB_STATUSES)
        .not("delivery_type", "in", `(${PICKUP_TYPES.join(",")})`)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(POOL_ORDERS_SELECT)
        .eq("status", "por_asignar_repartidor")
        .is("assigned_delivery_id", null)
        .not("delivery_type", "in", `(${PICKUP_TYPES.join(",")})`)
        .order("created_at", { ascending: false }),
    ]);

    const queryError = assignedRes.error || poolRes.error;
    if (queryError) {
      setError(queryError.message);
      setOrders([]);
      setPoolOrders([]);
    } else {
      setOrders((assignedRes.data ?? []).map(prepare));
      setPoolOrders((poolRes.data ?? []).map(prepare));
    }
    setLoading(false);
  }, [user, useMock]);

  useEffect(() => {
    load();
  }, [load]);

  // Suma total de quantity de los pedidos activos asignados en ruta (en_camino y cerca)
  const currentTripItemsCount = orders
    .filter((o) => o.status === "en_camino" || o.status === "cerca")
    .reduce(
      (sum, o) =>
        sum +
        (o.order_items ?? o.items ?? []).reduce(
          (acc, item) => acc + (Number(item.quantity) || 0),
          0,
        ),
      0,
    );

  // Cambia el estado de un pedido (iniciar ruta, estoy cerca, entregado)
  async function changeStatus(orderId, newStatus) {
    setActionError(null);
    setUpdatingId(orderId);
    const order = orders.find((o) => o.id === orderId);
    let paymentMarked = false;

    if (!useMock) {
      const { data, error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("assigned_delivery_id", user.id)
        .select("id");

      // Si una política RLS bloquea el cambio, no hay error pero tampoco filas
      if (updateError || !data?.length) {
        setActionError(
          updateError?.message ?? "No se pudo actualizar el pedido.",
        );
        setUpdatingId(null);
        return false;
      }

      // Contraentrega/efectivo: al entregar, el pago queda como cobrado.
      // Es un segundo paso aparte para que un fallo aquí no tumbe la entrega.
      if (
        newStatus === "entregado" &&
        order &&
        CASH_METHODS.includes(order.payment_method) &&
        order.payment_status !== "paid"
      ) {
        const { error: payError } = await supabase
          .from("orders")
          .update({ payment_status: "paid" })
          .eq("id", orderId)
          .eq("assigned_delivery_id", user.id);

        if (payError) {
          setActionError(
            `Pedido entregado, pero no se pudo marcar el pago como cobrado: ${payError.message}`,
          );
        } else {
          paymentMarked = true;
        }
      }
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              ...(paymentMarked ? { payment_status: "paid" } : {}),
            }
          : o,
      ),
    );
    setUpdatingId(null);
    return true;
  }

  // Toma un pedido disponible de la bolsa respetando el límite de 30 prendas por viaje
  async function claimOrder(orderId) {
    setActionError(null);
    const poolOrder =
      poolOrders.find((o) => o.id === orderId) ??
      orders.find((o) => o.id === orderId);

    const orderItemsCount = (
      poolOrder?.order_items ??
      poolOrder?.items ??
      []
    ).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

    if (currentTripItemsCount + orderItemsCount > MAX_ITEMS_PER_TRIP) {
      const capacityError = `Capacidad de mochila excedida: Máximo 30 prendas por viaje (actual: ${currentTripItemsCount}, pedido: ${orderItemsCount})`;
      setActionError(capacityError);
      throw new Error(capacityError);
    }

    setUpdatingId(orderId);

    if (!useMock) {
      const { data, error: claimError } = await supabase
        .from("orders")
        .update({
          assigned_delivery_id: user.id,
          status: "en_camino",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .is("assigned_delivery_id", null)
        .select("id");

      if (claimError) {
        setActionError(claimError.message);
        setUpdatingId(null);
        return false;
      }

      if (!data?.length) {
        setActionError(
          "Otro repartidor ya tomó este pedido. Actualizando bolsa de pedidos...",
        );
        setUpdatingId(null);
        await load();
        return false;
      }
    }

    await load();
    setUpdatingId(null);
    return true;
  }

  // Reporta una incidencia en ruta y retira el pedido de entregas activas
  async function reportIncident(orderId, { reason, comment }) {
    setActionError(null);
    setUpdatingId(orderId);

    if (!useMock) {
      const { error: incidentError } = await supabase
        .from("orders")
        .update({
          status: "incidencia_transporte",
          incident_reason: reason,
          incident_comment: comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (incidentError) {
        setActionError(incidentError.message);
        setUpdatingId(null);
        return false;
      }
    }

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setUpdatingId(null);
    return true;
  }

  return {
    repartidorName: profile?.first_name,
    orders,
    poolOrders,
    currentTripItemsCount,
    MAX_ITEMS_PER_TRIP,
    loading,
    error,
    actionError,
    updatingId,
    reload: load,
    changeStatus,
    claimOrder,
    reportIncident,
  };
}
