import Badge from "../../../components/ui/Badge";
import { ORDER_STATUS_LABELS } from "../services/adminOrders.service";

export default function OrderStatusBadge({ status }) {
  const variant = ["entregado", "delivered", "pagado"].includes(status)
    ? "success"
    : ["cancelado", "cancelled"].includes(status)
      ? "danger"
      : ["pendiente_pago", "pending"].includes(status)
        ? "warning"
        : "neutral";

  return <Badge variant={variant}>{ORDER_STATUS_LABELS[status] || status || "Sin estado"}</Badge>;
}
