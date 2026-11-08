import { supabase } from "../../../services/supabase";
import {
  Check,
  PackageCheck,
  Package,
  UserCheck,
  Truck,
  Navigation,
  MapPin,
  CheckCircle2,
  Store,
} from "lucide-react";

export const DELIVERY_TRACKING_STEPS = [
  {
    id: "recibido",
    title: "Pedido Registrado",
    detail: "Hemos recibido tu compra.",
    icon: Check,
  },
  {
    id: "en_preparacion",
    title: "En Preparación",
    detail: "Seleccionando y empaquetando tus prendas en taller.",
    icon: PackageCheck,
  },
  {
    id: "por_asignar_repartidor",
    title: "Preparado para Despacho",
    detail: "Listo en taller esperando asignación de motorizado.",
    icon: Package,
  },
  {
    id: "asignado",
    title: "Repartidor Asignado",
    detail: "Repartidor designado para la entrega de tu pedido.",
    icon: UserCheck,
  },
  {
    id: "en_camino",
    title: "En Camino",
    detail: "El pedido ha salido del taller hacia tu dirección.",
    icon: Truck,
  },
  {
    id: "cerca",
    title: "Repartidor Cerca",
    detail: "El repartidor se encuentra a pocas cuadras de tu ubicación.",
    icon: Navigation,
  },
  {
    id: "en_ubicacion",
    title: "En Ubicación",
    detail: "El repartidor ha llegado a tu puerta de entrega.",
    icon: MapPin,
  },
  {
    id: "entregado",
    title: "Entregado",
    detail: "Paquete recibido y entrega finalizada con conformidad.",
    icon: CheckCircle2,
  },
];

export const PICKUP_TRACKING_STEPS = [
  {
    id: "recibido",
    title: "Pedido Confirmado",
    detail: "Tu orden de recojo ha sido registrada con éxito.",
    icon: Check,
  },
  {
    id: "en_preparacion",
    title: "En Preparación",
    detail: "Nuestro personal está preparando tu paquete en almacén.",
    icon: PackageCheck,
  },
  {
    id: "listo_recojo",
    title: "Listo para Recojo en Tienda",
    detail: "Tu paquete te espera en nuestra tienda física para su retiro.",
    icon: Store,
  },
  {
    id: "entregado",
    title: "Entregado / Retirado",
    detail: "Paquete retirado presencialmente de manera conforme.",
    icon: CheckCircle2,
  },
];

export function isPickupDeliveryType(order) {
  if (!order) return false;
  const dType = (typeof order === "object" ? order.delivery_type : order) || "";
  const sType = (typeof order === "object" ? order.shipping_type : "") || "";
  return (
    ["pickup", "recojo", "recojo_tienda"].includes(dType.toLowerCase()) ||
    ["pickup", "recojo", "recojo_tienda"].includes(sType.toLowerCase())
  );
}

export function getTrackingStepIndex(status, isPickup = false) {
  const s = String(status || "").toLowerCase();

  if (["cancelado", "cancelled"].includes(s)) {
    return -1;
  }

  if (isPickup) {
    if (["recibido", "received", "pendiente_pago", "pending", "pagado"].includes(s)) {
      return 0;
    }
    if (["en_preparacion", "preparing"].includes(s)) {
      return 1;
    }
    if (
      [
        "listo_recojo",
        "por_asignar",
        "por_asignar_repartidor",
        "asignado",
        "en_camino",
        "dispatched",
        "cerca",
        "nearby",
        "en_ubicacion",
        "en_destino",
        "arrived",
      ].includes(s)
    ) {
      return 2;
    }
    if (["entregado", "delivered"].includes(s)) {
      return 3;
    }
    return 0;
  }

  // Flujo Delivery (8 fases deterministas: 0 al 7)
  if (["recibido", "received", "pendiente_pago", "pending"].includes(s)) {
    return 0; // Se mantiene en Fase 1 hasta que pase a preparación
  }
  if (["en_preparacion", "preparing", "pagado"].includes(s)) {
    return 1;
  }
  if (["por_asignar", "por_asignar_repartidor"].includes(s)) {
    return 2;
  }
  if (["asignado"].includes(s)) {
    return 3;
  }
  if (["en_camino", "en_ruta", "dispatched"].includes(s)) {
    return 4;
  }
  if (["cerca", "nearby"].includes(s)) {
    return 5;
  }
  if (["en_ubicacion", "en_destino", "arrived"].includes(s)) {
    return 6;
  }
  if (["entregado", "delivered"].includes(s)) {
    return 7;
  }

  return 0;
}

export function getStatusBadgeConfig(status, isPickup = false) {
  const s = String(status || "").toLowerCase();

  switch (s) {
    case "entregado":
    case "delivered":
      return {
        label: isPickup ? "Retirado en Tienda" : "Pedido Entregado",
        variant: "success",
      };
    case "en_ubicacion":
    case "en_destino":
    case "arrived":
      return {
        label: isPickup ? "Disponible para Recojo" : "En Ubicación",
        variant: "warning",
      };
    case "cerca":
    case "nearby":
      return {
        label: isPickup ? "Disponible para Recojo" : "Repartidor Cerca",
        variant: "warning",
      };
    case "en_camino":
    case "dispatched":
      return {
        label: isPickup ? "En camino al punto de recojo" : "En Camino",
        variant: "warning",
      };
    case "asignado":
      return {
        label: isPickup ? "Preparado en Almacén" : "Repartidor Asignado",
        variant: "warning",
      };
    case "listo_recojo":
      return {
        label: "Listo para Recojo en Tienda",
        variant: "warning",
      };
    case "por_asignar":
    case "por_asignar_repartidor":
      return {
        label: isPickup ? "Empaque Finalizado" : "Preparado para Despacho",
        variant: "neutral",
      };
    case "en_preparacion":
    case "preparing":
      return {
        label: "En Preparación",
        variant: "neutral",
      };
    case "pendiente_pago":
    case "pending":
      return {
        label: "Validación de Pago",
        variant: "warning",
      };
    case "incidencia_transporte":
      return {
        label: "Incidencia en Ruta",
        variant: "danger",
      };
    case "cancelado":
    case "cancelled":
      return {
        label: "Pedido Cancelado",
        variant: "danger",
      };
    default:
      return {
        label: isPickup ? "Pedido Confirmado" : "Pedido Registrado",
        variant: "neutral",
      };
  }
}

export function normalizeOrderData(rawOrder) {
  if (!rawOrder) return null;

  const deliveryProfile = rawOrder.delivery_profile || null;
  const deliveryUser = deliveryProfile
    ? {
        id: deliveryProfile.id,
        full_name: `${deliveryProfile.first_name || ""} ${deliveryProfile.paternal_surname || ""}`.trim() || "Repartidor Asignado",
        phone: deliveryProfile.phone || "",
        delivery_role:
          deliveryProfile.delivery_type === "express"
            ? "Repartidor Express (Mismo Día)"
            : "Repartidor Programado",
      }
    : null;

  const normalizedItems = (rawOrder.order_items || []).map((item) => {
    const variant = item.product_variants || {};
    const product = variant.products || item.products || {};
    const size = variant.sizes || {};

    const unitPrice = Number(item.unit_price || 0);
    const quantity = Number(item.quantity || 1);
    const totalPrice = Number(item.subtotal || unitPrice * quantity);

    const resolvedImageUrl =
      item.image_url ||
      variant.products?.main_image_url ||
      product.main_image_url ||
      variant.image_url ||
      "";

    return {
      id: item.id,
      order_id: item.order_id,
      variant_id: item.variant_id,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      subtotal: totalPrice,
      product_name:
        product.name || item.product_name || "Prenda ERXIDI",
      variant_color: variant.color || item.variant_color || "—",
      variant_size: size.name || item.variant_size || "U",
      sku: variant.sku || item.sku || "",
      image_url: resolvedImageUrl,
      product_variants: variant,
      products: product,
    };
  });

  return {
    ...rawOrder,
    delivery_user: deliveryUser,
    delivery_profile: deliveryProfile,
    order_items: normalizedItems,
    items: normalizedItems,
  };
}

export async function fetchOrderForTracking(orderNumber) {
  if (!orderNumber) {
    return { data: null, error: new Error("Código de pedido no proporcionado.") };
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_id,
      shipping_address_id,
      assigned_delivery_id,
      delivery_type,
      delivery_cost,
      subtotal,
      total_amount,
      payment_method,
      payment_gateway_tx_id,
      status,
      created_at,
      updated_at,
      invoice_type,
      invoice_data,
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      scheduled_time_slot,
      payment_status,
      delivery_latitude,
      delivery_longitude,
      incident_reason,
      incident_comment,
      profiles:customer_id (
        id,
        dni,
        first_name,
        paternal_surname,
        maternal_surname,
        email,
        phone
      ),
      addresses:shipping_address_id (
        id,
        alias,
        receiver_name,
        receiver_phone,
        department,
        province,
        street_address,
        reference,
        delivery_zones:zone_id (
          id,
          district_name,
          delivery_cost,
          estimated_delivery_time
        )
      ),
      delivery_profile:assigned_delivery_id (
        id,
        first_name,
        paternal_surname,
        phone,
        delivery_type,
        role
      ),
      order_items (
        id,
        order_id,
        variant_id,
        quantity,
        unit_price,
        subtotal,
        product_variants:variant_id (
          id,
          color,
          sku,
          stock,
          is_active,
          sizes:size_id (
            id,
            name
          ),
          products:product_id (
            id,
            name,
            slug,
            main_image_url
          )
        )
      )
    `)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: normalizeOrderData(data), error: null };
}

export async function fetchDeliveryProfileById(deliveryId) {
  if (!deliveryId) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, paternal_surname, phone, delivery_type, role")
      .eq("id", deliveryId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      first_name: data.first_name,
      paternal_surname: data.paternal_surname,
      full_name: `${data.first_name || ""} ${data.paternal_surname || ""}`.trim() || "Repartidor Asignado",
      phone: data.phone || "",
      delivery_role:
        data.delivery_type === "express"
          ? "Repartidor Express (Mismo Día)"
          : "Repartidor Programado",
    };
  } catch (err) {
    console.error("Error al obtener perfil de repartidor:", err);
    return null;
  }
}

export function subscribeToOrderRealtime(orderNumber, onUpdate) {
  if (!orderNumber) return () => {};

  const channel = supabase
    .channel(`tracking_${orderNumber}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `order_number=eq.${orderNumber}`,
      },
      (payload) => {
        if (payload?.new && typeof onUpdate === "function") {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
