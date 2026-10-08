import { Truck, Package, CheckCircle2, MapPin } from "lucide-react";

// La BD acepta cada estado en inglés y en español (orders_status_check).
// Aquí se unifican a un solo nombre para no repetir lógica en la pantalla.
export const STATUS_ALIASES = {
  preparing: "en_preparacion",
  en_preparacion: "en_preparacion",
  dispatched: "en_camino",
  en_camino: "en_camino",
  nearby: "cerca",
  cerca: "cerca",
  delivered: "entregado",
  entregado: "entregado",
};

// Estados de BD que el repartidor puede ver (el resto aún no está listo o fue cancelado)
export const VISIBLE_DB_STATUSES = Object.keys(STATUS_ALIASES);

// Recojo en tienda: no lo reparte nadie
export const PICKUP_TYPES = ["recojo", "pickup"];

// Medios de pago en los que el repartidor cobra en mano
export const CASH_METHODS = ["contraentrega", "efectivo"];

export const normalizeStatus = (s) => STATUS_ALIASES[s] ?? s;

// Apariencia de cada estado
export const STATUS_CONFIG = {
  en_preparacion: { label: "Por entregar", variant: "neutral", icon: Package },
  en_camino: { label: "En camino", variant: "warning", icon: Truck },
  cerca: { label: "Cerca", variant: "warning", icon: MapPin },
  entregado: { label: "Entregado", variant: "success", icon: CheckCircle2 },
};

// Botones disponibles según el estado actual. `to` es el valor que se guarda en BD.
export const NEXT_ACTIONS = {
  en_preparacion: [{ to: "en_camino", label: "Iniciar ruta" }],
  en_camino: [
    { to: "cerca", label: "Estoy cerca", variant: "outline" },
    { to: "entregado", label: "Confirmar entrega" },
  ],
  cerca: [{ to: "entregado", label: "Confirmar entrega" }],
};
