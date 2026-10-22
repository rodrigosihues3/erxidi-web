import {
  Truck,
  Package,
  CheckCircle2,
  MapPin,
  AlertTriangle,
} from "lucide-react";

// Estados nuevos de la Fase 0
export const POOL_STATUS = "por_asignar_repartidor"; // en la bolsa, sin repartidor
export const INCIDENT_STATUS = "incidencia_transporte"; // no se pudo entregar

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
  [POOL_STATUS]: POOL_STATUS,
  [INCIDENT_STATUS]: INCIDENT_STATUS,
};

// Estados que el repartidor ve en "Mis asignados". La bolsa y las incidencias
// quedan fuera: un pedido en incidencia ya no cuenta para su cupo.
export const VISIBLE_DB_STATUSES = Object.keys(STATUS_ALIASES).filter(
  (s) => s !== POOL_STATUS && s !== INCIDENT_STATUS,
);

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
  [POOL_STATUS]: { label: "En bolsa", variant: "neutral", icon: Package },
  [INCIDENT_STATUS]: {
    label: "Incidencia",
    variant: "neutral",
    icon: AlertTriangle,
  },
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