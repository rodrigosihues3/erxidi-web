import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  VISIBLE_DB_STATUSES,
  PICKUP_TYPES,
  CASH_METHODS,
  normalizeStatus,
} from "./deliveryStatus";

// Misma forma que repartidor.json: pedido -> customer, shipping_address, items
// Los nombres después de "!" son las llaves foráneas reales de la tabla orders.
const ORDERS_SELECT = `
  id, order_number, status, delivery_type, delivery_cost, subtotal,
  total_amount, payment_method, payment_status, created_at, updated_at,
  customer_name, customer_phone, delivery_address, scheduled_time_slot,
  items:order_items(
    id, quantity, unit_price, subtotal,
    variant:product_variants(
      id, sku, color,
      sizes(name),
      products(name)
    )
  )
`;

function prepare(row) {
  return {
    ...row,
    status: normalizeStatus(row.status),
    total_items: (row.items ?? []).reduce((n, i) => n + i.quantity, 0),
    items: (row.items ?? []).map((it) => ({
      ...it,
      variant: {
        ...it.variant,
        product: it.variant?.products || { name: "Prenda" },
        size: it.variant?.sizes || null,
      },
    })),
  };
}

// useMock = true usa repartidor.json (pruebas sin base de datos)
export function useDeliveryOrders({ useMock = false } = {}) {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setError(null);

    if (useMock) {
      setOrders(
        mockData.pedidos.map((p) =>
          prepare({
            ...p,
            status: p.status === "por_entregar" ? "en_preparacion" : p.status,
          }),
        ),
      );
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("assigned_delivery_id", user.id)
      .in("status", VISIBLE_DB_STATUSES)
      .not("delivery_type", "in", `(${PICKUP_TYPES.join(",")})`)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setOrders([]);
    } else {
      setOrders((data ?? []).map(prepare));
    }
    setLoading(false);
  }, [user, useMock]);

  useEffect(() => {
    load();
  }, [load]);

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

  return {
    repartidorName: useMock ? mockData.first_name : profile?.first_name,
    orders,
    loading,
    error,
    actionError,
    updatingId,
    reload: load,
    changeStatus,
  };
}
