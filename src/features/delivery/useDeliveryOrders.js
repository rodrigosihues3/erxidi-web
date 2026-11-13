import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { sendOrderNotificationEmail } from "../admin/services/orderNotification.service";
import {
  VISIBLE_DB_STATUSES,
  PICKUP_TYPES,
  CASH_METHODS,
  normalizeStatus,
} from "./deliveryStatus";

export const MAX_ITEMS_PER_TRIP = 30;

// Pedidos actualmente tomados por el repartidor (cuentan para la capacidad)
const BAG_STATUSES = ["asignado", "en_camino", "cerca"];

const POOL_ELIGIBLE_STATUSES = [
  "por_asignar_repartidor",
  "en_preparacion",
  "preparando",
];

// Misma forma que repartidor.json: pedido -> customer, shipping_address, items
// Los nombres después de "!" son las llaves foráneas reales de la tabla orders.
const ORDERS_SELECT = `
  id, order_number, status, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_status, created_at, updated_at,
  customer_name, customer_email, customer_phone, delivery_address, scheduled_time_slot,
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
  customer_name, customer_email, customer_phone, delivery_address, scheduled_time_slot,
  delivery_latitude, delivery_longitude,
  order_items ( id, quantity, variant_id, product_variants ( products ( name ) ) )
`;

function isPoolEligible(order, driverDeliveryType) {
  if (!order) return false;
  if (order.assigned_delivery_id) return false;
  if (order.delivery_type === "pickup" || PICKUP_TYPES.includes(order.delivery_type)) {
    return false;
  }
  if (driverDeliveryType === "express" && order.delivery_type !== "express") {
    return false;
  }
  if (driverDeliveryType === "scheduled" && order.delivery_type !== "scheduled") {
    return false;
  }
  return POOL_ELIGIBLE_STATUSES.includes(order.status);
}

function prepare(row) {
  const rawItems = row.items ?? row.order_items ?? [];
  return {
    ...row,
    customer_name: row.customer_name || "",
    customer_email: row.customer_email || "",
    customer_phone: row.customer_phone || "",
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
export function useDeliveryOrders({ useMock = false, userProfile = null } = {}) {
  const { user, profile: authProfile } = useAuth();
  const profile = userProfile || authProfile;
  const driverDeliveryType = profile?.delivery_type || user?.delivery_type;

  const [orders, setOrders] = useState([]);
  const [poolOrders, setPoolOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [operationalStatus, setOperationalStatus] = useState(
    profile?.operational_status || "available",
  );

  useEffect(() => {
    if (profile?.operational_status) {
      setOperationalStatus(profile.operational_status);
    }
  }, [profile?.operational_status]);

  const load = useCallback(async () => {
    setError(null);

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let poolQuery = supabase
      .from("orders")
      .select(POOL_ORDERS_SELECT)
      .in("status", POOL_ELIGIBLE_STATUSES)
      .is("assigned_delivery_id", null)
      .not("delivery_type", "in", `(${PICKUP_TYPES.join(",")})`)
      .order("created_at", { ascending: false });

    if (driverDeliveryType === "express") {
      poolQuery = poolQuery.eq("delivery_type", "express");
    } else if (driverDeliveryType === "scheduled") {
      poolQuery = poolQuery.eq("delivery_type", "scheduled");
    }

    const [assignedRes, poolRes] = await Promise.all([
      supabase
        .from("orders")
        .select(ORDERS_SELECT)
        .eq("assigned_delivery_id", user.id)
        .in("status", VISIBLE_DB_STATUSES)
        .not("delivery_type", "in", `(${PICKUP_TYPES.join(",")})`)
        .order("created_at", { ascending: false }),
      poolQuery,
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
  }, [user, driverDeliveryType, useMock]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: mutación in-memory de bolsa (poolOrders) y pedidos propios (orders)
  useEffect(() => {
    if (useMock || !user?.id) return undefined;

    const merge = (list, row) =>
      list.map((o) =>
        o.id === row.id
          ? { ...o, ...row, status: normalizeStatus(row.status) }
          : o,
      );

    const channel = supabase
      .channel("delivery-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const { eventType, new: newOrder, old: oldOrder } = payload;

          if (eventType === "INSERT") {
            if (newOrder.assigned_delivery_id === user.id) {
              setOrders((prev) => [
                prepare(newOrder),
                ...prev.filter((o) => o.id !== newOrder.id),
              ]);
            } else if (isPoolEligible(newOrder, driverDeliveryType)) {
              setPoolOrders((prev) => [
                prepare(newOrder),
                ...prev.filter((o) => o.id !== newOrder.id),
              ]);
            }
          }

          if (eventType === "UPDATE") {
            if (newOrder.assigned_delivery_id === user.id) {
              setOrders((prev) =>
                prev.some((o) => o.id === newOrder.id)
                  ? merge(prev, newOrder)
                  : [prepare(newOrder), ...prev],
              );
              setPoolOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
            } else if (newOrder.assigned_delivery_id) {
              setPoolOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
              setOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
            } else {
              const eligible = isPoolEligible(newOrder, driverDeliveryType);
              if (eligible) {
                setPoolOrders((prev) =>
                  prev.some((o) => o.id === newOrder.id)
                    ? merge(prev, newOrder)
                    : [prepare(newOrder), ...prev],
                );
              } else {
                setPoolOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
              }
              setOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
            }
          }

          if (eventType === "DELETE") {
            setPoolOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
            setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, driverDeliveryType, useMock]);

  // Suma total de quantity de los pedidos activos asignados en ruta (en_camino y cerca)
  const currentTripItemsCount = orders
    .filter((o) => BAG_STATUSES.includes(o.status))
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

    if (["en_camino", "cerca", "en_destino", "entregado"].includes(newStatus)) {
      if (order) {
        sendOrderNotificationEmail({
          order: { ...order, status: newStatus },
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email || order.client_email,
          customerName: order.customer_name,
          targetStatus: newStatus,
          status: newStatus,
          driverInfo: profile,
        }).catch((err) => console.error(`Error al notificar ${newStatus}:`, err));
      }
    }

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

    try {
      let claimedRow = null;
      if (!useMock) {
        const { data, error } = await supabase
          .from("orders")
          .update({
            assigned_delivery_id: user.id,
            status: "asignado",
            updated_at: new Date().toISOString()
          })
          .eq("id", orderId)
          .is("assigned_delivery_id", null)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("El pedido ya no está disponible en la bolsa.");
        }
        claimedRow = data[0];
      }

      // Actualiza inmediatamente el estado local pasando el pedido a orders y removiéndolo de poolOrders
      const updatedOrder = prepare({
        ...(poolOrder || {}),
        ...(claimedRow || {}),
        id: orderId,
        assigned_delivery_id: user.id,
        status: "asignado",
      });

      setOrders((prev) => [
        updatedOrder,
        ...prev.filter((o) => o.id !== orderId),
      ]);
      setPoolOrders((prev) => prev.filter((o) => o.id !== orderId));
      return true;
    } catch (err) {
      setActionError(err.message);
      throw err;
    } finally {
      setUpdatingId(null);
    }
  }

  // Reporta una incidencia en ruta y retira el pedido de entregas activas
  async function reportIncident(
    orderId,
    { reason, comment, returnToPool = false },
  ) {
    setActionError(null);
    setUpdatingId(orderId);

    const patch = returnToPool
      ? {
          status: "por_asignar_repartidor",
          assigned_delivery_id: null,
          incident_reason: "reasignacion_entre_repartidores",
          incident_comment: comment,
        }
      : {
          status: "incidencia_transporte",
          incident_reason: reason,
          incident_comment: comment,
        };

    if (!useMock) {
      const { error: incidentError } = await supabase
        .from("orders")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("assigned_delivery_id", user.id);

      if (incidentError) {
        setActionError(incidentError.message);
        setUpdatingId(null);
        return false;
      }
    }

    // Con incidencia el pedido sigue en `orders` (métricas); al devolver a bolsa sale
    setOrders((prev) =>
      returnToPool
        ? prev.filter((o) => o.id !== orderId)
        : prev.map((o) =>
            o.id === orderId
              ? { ...o, status: "incidencia_transporte", incident_reason: reason }
              : o,
          ),
    );
    setUpdatingId(null);

    if (!returnToPool) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        sendOrderNotificationEmail({
          order: { ...order, status: "incidencia_transporte", incident_reason: reason },
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email || order.client_email,
          customerName: order.customer_name,
          targetStatus: "incidencia_transporte",
          status: "incidencia_transporte",
          incidentReason: reason,
          driverInfo: profile,
        }).catch((err) => console.error("Error al notificar incidencia_transporte:", err));
      }
    }

    return true;
  }

  // Devuelve un pedido tomado a la bolsa
  async function returnToPool(orderId) {
    setActionError(null);
    setUpdatingId(orderId);
    if (!useMock) {
      const { error: e } = await supabase
        .from("orders")
        .update({
          status: "por_asignar_repartidor",
          assigned_delivery_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("assigned_delivery_id", user.id);
      if (e) {
        setActionError(e.message);
        setUpdatingId(null);
        return false;
      }
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setUpdatingId(null);
    return true;
  }

  // Inicia ruta: pedidos asignados pasan a en_camino y el semáforo a on_route
  async function startRoute(orderIds) {
    setActionError(null);

    const normalizedIds = Array.isArray(orderIds)
      ? orderIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : typeof orderIds === "string" && orderIds.trim().length > 0
        ? [orderIds.trim()]
        : [];

    const ids =
      normalizedIds.length > 0
        ? normalizedIds
        : orders.filter((o) => o.status === "asignado").map((o) => o.id);

    if (ids.length === 0) return false;
    if (!useMock) {
      const { error: e } = await supabase
        .from("orders")
        .update({ status: "en_camino", updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("assigned_delivery_id", user.id);
      if (e) {
        setActionError(e.message);
        return false;
      }
    }
    setOrders((prev) =>
      prev.map((o) => (ids.includes(o.id) ? { ...o, status: "en_camino" } : o)),
    );
    await changeOperationalStatus("on_route");

    ids.forEach((id) => {
      const targetOrder = orders.find((o) => o.id === id);
      if (targetOrder) {
        sendOrderNotificationEmail({
          order: { ...targetOrder, status: "en_camino" },
          orderId: targetOrder.id,
          orderNumber: targetOrder.order_number,
          customerEmail: targetOrder.customer_email || targetOrder.client_email,
          customerName: targetOrder.customer_name,
          targetStatus: "en_camino",
          status: "en_camino",
          driverInfo: profile,
        }).catch((err) => console.error("Error al notificar en_camino:", err));
      }
    });

    return true;
  }

  // Semáforo operativo persistido en profiles.operational_status y profiles.is_on_duty
  async function changeOperationalStatus(next) {
    const previous = operationalStatus;
    setOperationalStatus(next);
    if (useMock || !user?.id) return true;
    const { error: e } = await supabase
      .from("profiles")
      .update({
        operational_status: next,
        is_on_duty: next !== "paused" && next !== "offline",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (e) {
      setOperationalStatus(previous);
      setActionError(e.message);
      return false;
    }
    return true;
  }

  // Conciliación de pago contra entrega -> digital (Yape / Plin)
  async function switchOrderPaymentToQr(orderId) {
    setActionError(null);
    if (useMock) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, payment_method: "yape_plin", payment_status: "paid" }
            : o,
        ),
      );
      return true;
    }

    const { error: e } = await supabase
      .from("orders")
      .update({
        payment_method: "yape_plin",
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("assigned_delivery_id", user.id);

    if (e) {
      setActionError(e.message);
      return false;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, payment_method: "yape_plin", payment_status: "paid" }
          : o,
      ),
    );
    return true;
  }

  return {
    repartidorName: profile?.first_name,
    profile,
    operationalStatus,
    changeOperationalStatus,
    returnToPool,
    startRoute,
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
    takeOrder: claimOrder,
    reportIncident,
    switchOrderPaymentToQr,
  };
}
