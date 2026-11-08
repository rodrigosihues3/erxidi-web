import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  TrendingUp,
  PackageCheck,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  Crown,
  Repeat2,
  Package,
  Plus,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";

import { getDashboardAnalytics } from "../services/adminOrders.service";
import { getCriticalStock } from "../services/adminInventory.service";

const PAID_STATUSES = ["paid", "pagado"];
const CANCELLED_STATUSES = ["cancelado", "cancelled"];

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "7days", label: "Últimos 7 días" },
  { value: "month", label: "Este mes" },
  { value: "30days", label: "Últimos 30 días" },
  { value: "3months", label: "Últimos 3 meses" },
  { value: "6months", label: "Últimos 6 meses" },
  { value: "year", label: "Año actual" },
  { value: "all", label: "Todo el historial" },
];

const KPI_EXPLANATIONS = {
  sales: {
    title: "Total de Ventas",
    formula: "Σ (total_amount) de pedidos pagados no cancelados",
    description:
      "Representa el importe neto total facturado y confirmado por el negocio en el período seleccionado. Excluye explícitamente cancelaciones y transacciones fallidas.",
  },
  averageTicket: {
    title: "Venta Promedio",
    formula: "Total de Ventas / Pedidos Pagados",
    description:
      "Indicador financiero del valor medio facturado por cada orden de compra pagada. Evalúa la profundidad de gasto por pedido.",
  },
  units: {
    title: "Prendas Vendidas",
    formula: "Σ (quantity) en order_items de pedidos pagados",
    description:
      "Volumen físico consolidado de prendas comercializadas y pagadas durante el horizonte de tiempo evaluado.",
  },
  effectiveness: {
    title: "Tasa de Efectividad",
    formula: "(Pedidos Efectivos / Total de Pedidos Ingresados) * 100",
    description:
      "Porcentaje de pedidos que concluyen exitosamente en venta frente al total de órdenes generadas (descontando cancelaciones e incidencias).",
  },
};

const AVATAR_PASTEL_PALETTE = [
  "bg-amber-100 text-amber-900 border-amber-200",
  "bg-sky-100 text-sky-900 border-sky-200",
  "bg-emerald-100 text-emerald-900 border-emerald-200",
  "bg-rose-100 text-rose-900 border-rose-200",
  "bg-indigo-100 text-indigo-900 border-indigo-200",
  "bg-teal-100 text-teal-900 border-teal-200",
  "bg-orange-100 text-orange-900 border-orange-200",
  "bg-slate-200 text-slate-800 border-slate-300",
];

const CATEGORY_COLORS = [
  "#0F172A",
  "#D97706",
  "#334155",
  "#475569",
  "#64748B",
  "#B45309",
  "#0284C7",
];

function ProductBarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const product = payload[0]?.payload;
  if (!product) return null;

  return (
    <div className="z-50 w-64 rounded-card border border-border bg-surface-card p-3 shadow-dropdown">
      <div className="flex items-start gap-3">
        <div className="h-16 w-12 shrink-0 aspect-[4/5] rounded-button border border-border bg-slate-50 overflow-hidden flex items-center justify-center">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <Package className="h-5 w-5 text-brand-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-brand-primary leading-tight line-clamp-2">
            {product.name}
          </p>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-brand-secondary">
              <span>Unidades vendidas:</span>
              <span className="font-mono font-bold text-brand-primary">
                {numberFormat(product.units)} un.
              </span>
            </div>
            <div className="flex items-center justify-between text-brand-secondary">
              <span>Ingresos generados:</span>
              <span className="font-mono font-bold text-accent">
                {money(product.revenue)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-accent font-semibold text-center border-t border-border pt-1.5">
        Haz clic para ver métricas y detalles
      </p>
    </div>
  );
}

function CategoryPieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="z-50 rounded-card border border-border bg-surface-card p-2.5 shadow-dropdown text-xs min-w-44">
      <p className="font-bold text-brand-primary">{item.name}</p>
      <div className="mt-1.5 space-y-1 text-[11px] text-brand-secondary">
        <div className="flex items-center justify-between gap-3">
          <span>Ingresos:</span>
          <span className="font-mono font-bold text-brand-primary">
            {money(item.revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Unidades:</span>
          <span className="font-mono font-bold text-brand-primary">
            {numberFormat(item.units)} un.
          </span>
        </div>
      </div>
    </div>
  );
}

function PieGenericTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="z-50 rounded-card border border-border bg-surface-card p-2.5 shadow-dropdown text-xs min-w-44">
      <p className="font-bold text-brand-primary">{item.name}</p>
      <div className="mt-1.5 space-y-1 text-[11px] text-brand-secondary">
        <div className="flex items-center justify-between gap-3">
          <span>Pedidos:</span>
          <span className="font-mono font-bold text-brand-primary">
            {numberFormat(item.value)} ped. ({item.percentage}%)
          </span>
        </div>
        {item.amount !== undefined && (
          <div className="flex items-center justify-between gap-3">
            <span>Monto facturado:</span>
            <span className="font-mono font-bold text-accent">
              {money(item.amount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomYAxisTick({ x, y, payload, onProductClick, productsMap }) {
  const name = String(payload?.value || "");
  const truncated = name.length > 18 ? name.slice(0, 16) + "…" : name;
  const product = productsMap?.get(name);

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => product && onProductClick && onProductClick(product)}
      className="cursor-pointer group"
    >
      <text
        x={-8}
        y={4}
        textAnchor="end"
        className="text-[11px] font-semibold fill-slate-700 group-hover:fill-accent group-hover:underline cursor-pointer select-none transition-colors"
        title={`${name} (Clic para ver detalles)`}
      >
        {truncated}
      </text>
    </g>
  );
}

function getDeterministicAvatarStyle(seedString) {
  const str = String(seedString || "cliente").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PASTEL_PALETTE.length;
  return AVATAR_PASTEL_PALETTE[index];
}

function getCustomerInitials(name) {
  const clean = String(name || "Cliente").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function numberFormat(value) {
  return new Intl.NumberFormat("es-PE").format(Number(value || 0));
}

function getCustomerName(order) {
  const profile = order.profiles;
  if (profile) {
    const name = [
      profile.first_name,
      profile.paternal_surname,
      profile.maternal_surname,
    ]
      .filter(Boolean)
      .join(" ");

    if (name.trim()) return name;
  }

  return order.customer_name || order.customer_email || "Cliente invitado";
}

function getPeriodDates(range) {
  if (range === "all") {
    return {
      startDate: null,
      endDate: null,
    };
  }

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "today") {
    // start es hoy a las 00:00:00 local
  } else if (range === "week") {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
  } else if (range === "7days") {
    start.setDate(start.getDate() - 6);
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "30days") {
    start.setDate(start.getDate() - 29);
  } else if (range === "3months") {
    start.setMonth(start.getMonth() - 3);
  } else if (range === "6months") {
    start.setMonth(start.getMonth() - 6);
  } else if (range === "year") {
    start.setMonth(0, 1);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function isPaidOrder(order) {
  return (
    PAID_STATUSES.includes(String(order.payment_status || "").toLowerCase()) &&
    !CANCELLED_STATUSES.includes(String(order.status || "").toLowerCase())
  );
}

export default function DashboardView() {
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState("30days");
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [criticalStockOpen, setCriticalStockOpen] = useState(false);
  const [activeHelpModal, setActiveHelpModal] = useState(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [trendAnalysisModalOpen, setTrendAnalysisModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [orders, setOrders] = useState([]);
  const [criticalVariants, setCriticalVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const dates = getPeriodDates(timeRange);

        const [analytics, criticalStockData] = await Promise.all([
          getDashboardAnalytics(dates),
          getCriticalStock(),
        ]);

        if (active) {
          setOrders(analytics);
          setCriticalVariants(criticalStockData);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "No se pudieron cargar las métricas del negocio.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [timeRange, refreshKey]);

  const paidOrders = useMemo(() => orders.filter(isPaidOrder), [orders]);

  // Agrupación de productos con variantes en stock crítico (< 5)
  const criticalProducts = useMemo(() => {
    const map = new Map();
    criticalVariants.forEach((variant) => {
      const productId = variant.product_id;
      const current = map.get(productId) || {
        id: productId,
        name: variant.productName,
        image: variant.productImage,
        stock: 0,
        variants: [],
      };
      current.stock += variant.stock;
      current.variants.push({
        id: variant.id,
        stock: variant.stock,
        sku: variant.sku || "-",
        size: variant.sizeName,
        color: variant.colorName,
        color_hex: variant.colorHex,
      });
      map.set(productId, current);
    });
    return [...map.values()].sort((a, b) => a.stock - b.stock);
  }, [criticalVariants]);

  // Contador exacto de combinaciones Talla/Color en 0
  const outOfStockVariantsCount = useMemo(
    () => criticalVariants.filter((v) => Number(v.stock) === 0).length,
    [criticalVariants],
  );

  // Mapa completo de clientes en el período para métricas y rankings
  const allCustomersList = useMemo(() => {
    const map = new Map();

    paidOrders.forEach((order) => {
      const customerId =
        order.customer_id ||
        order.customer_email ||
        order.customer_name ||
        order.id;

      const current = map.get(customerId) || {
        id: customerId,
        name: getCustomerName(order),
        email: order.customer_email || order.profiles?.email || "",
        orders: 0,
        spent: 0,
        units: 0,
        lastPurchase: order.created_at,
      };

      current.orders += 1;
      current.spent += Number(order.total_amount || 0);

      (order.order_items || []).forEach((item) => {
        current.units += Number(item.quantity || 0);
      });

      if (new Date(order.created_at) > new Date(current.lastPurchase)) {
        current.lastPurchase = order.created_at;
      }

      map.set(customerId, current);
    });

    return [...map.values()];
  }, [paidOrders]);

  const metrics = useMemo(() => {
    const sales = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );

    const units = paidOrders.reduce((sum, order) => {
      const items = order.order_items || [];
      return (
        sum +
        items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0)
      );
    }, 0);

    const customers = allCustomersList.length;
    const recurringCustomers = allCustomersList.filter(
      (c) => c.orders >= 2,
    ).length;

    const averageTicket =
      paidOrders.length > 0 ? sales / paidOrders.length : 0;

    const totalOrdersCount = orders.length;
    const effectiveness =
      totalOrdersCount > 0 ? (paidOrders.length / totalOrdersCount) * 100 : 0;

    return {
      sales,
      orders: paidOrders.length,
      totalOrdersCount,
      units,
      customers,
      recurringCustomers,
      averageTicket,
      effectiveness,
    };
  }, [paidOrders, orders, allCustomersList]);

  const salesTrend = useMemo(() => {
    const grouped = new Map();

    paidOrders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = date.toLocaleDateString("sv-SE");

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          sales: 0,
          orders: 0,
        });
      }

      const current = grouped.get(key);
      current.sales += Number(order.total_amount || 0);
      current.orders += 1;
    });

    return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [paidOrders]);

  // Diagnóstico heurístico instantáneo de la serie histórica
  const trendDiagnosis = useMemo(() => {
    if (salesTrend.length === 0) return null;

    let peakDay = salesTrend[0];
    salesTrend.forEach((day) => {
      if (day.sales > peakDay.sales) {
        peakDay = day;
      }
    });

    const midpoint = Math.floor(salesTrend.length / 2);
    const firstHalf = salesTrend.slice(0, midpoint || 1);
    const secondHalf = salesTrend.slice(midpoint || 1);

    const firstHalfSales = firstHalf.reduce((sum, d) => sum + d.sales, 0);
    const secondHalfSales = secondHalf.reduce((sum, d) => sum + d.sales, 0);

    let growthPercent = 0;
    if (firstHalfSales > 0) {
      growthPercent =
        ((secondHalfSales - firstHalfSales) / firstHalfSales) * 100;
    }

    const dayTotals = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayNames = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    paidOrders.forEach((o) => {
      const day = new Date(o.created_at).getDay();
      dayTotals[day] += Number(o.total_amount || 0);
    });

    let bestDayIdx = 0;
    Object.keys(dayTotals).forEach((d) => {
      if (dayTotals[d] > dayTotals[bestDayIdx]) {
        bestDayIdx = Number(d);
      }
    });

    return {
      peakDate: peakDay.date,
      peakSales: peakDay.sales,
      peakOrders: peakDay.orders,
      growthPercent: growthPercent.toFixed(1),
      isGrowing: growthPercent >= 0,
      bestDayOfWeek: dayNames[bestDayIdx],
      firstHalfSales,
      secondHalfSales,
    };
  }, [salesTrend, paidOrders]);

  const topProducts = useMemo(() => {
    const map = new Map();

    paidOrders.forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const product = item.product_variants?.products;
        if (!product) return;

        const existing = map.get(product.id) || {
          id: product.id,
          name: product.name,
          image: product.main_image_url,
          categoryName: product.categories?.name || "Catálogo ERXIDI",
          units: 0,
          revenue: 0,
          ordersSet: new Set(),
          variantsMap: new Map(),
        };

        existing.units += Number(item.quantity || 0);
        existing.revenue += Number(item.subtotal || 0);
        existing.ordersSet.add(order.id);

        const v = item.product_variants;
        if (v) {
          const key = v.id || `${v.color}-${v.sku}`;
          const vData = existing.variantsMap.get(key) || {
            color: v.color || "Color único",
            color_hex: v.color_hex || "#334155",
            sku: v.sku || "-",
            units: 0,
            revenue: 0,
          };
          vData.units += Number(item.quantity || 0);
          vData.revenue += Number(item.subtotal || 0);
          existing.variantsMap.set(key, vData);
        }

        map.set(product.id, existing);
      });
    });

    return [...map.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        ordersCount: p.ordersSet ? p.ordersSet.size : 0,
        variantsBreakdown: p.variantsMap
          ? [...p.variantsMap.values()].sort((a, b) => b.units - a.units)
          : [],
      }));
  }, [paidOrders]);

  const topProductsByName = useMemo(() => {
    const map = new Map();
    topProducts.forEach((p) => map.set(p.name, p));
    return map;
  }, [topProducts]);

  const categorySales = useMemo(() => {
    const map = new Map();

    paidOrders.forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const category = item.product_variants?.products?.categories;
        const categoryName = category?.name || "Sin categoría";

        const current = map.get(categoryName) || {
          name: categoryName,
          revenue: 0,
          units: 0,
        };

        current.revenue += Number(item.subtotal || 0);
        current.units += Number(item.quantity || 0);

        map.set(categoryName, current);
      });
    });

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [paidOrders]);

  // Distribución por métodos de pago
  const paymentMethodStats = useMemo(() => {
    const map = {
      culqi: {
        name: "Culqi / Pagos Online",
        value: 0,
        amount: 0,
        color: "#D97706",
      },
      transferencia: {
        name: "Transferencia / Yape",
        value: 0,
        amount: 0,
        color: "#0F172A",
      },
      contraentrega: {
        name: "Pago Contraentrega",
        value: 0,
        amount: 0,
        color: "#0284C7",
      },
      otros: {
        name: "Otros Canales",
        value: 0,
        amount: 0,
        color: "#64748B",
      },
    };

    orders.forEach((order) => {
      const raw = String(order.payment_method || "").toLowerCase().trim();
      let group = "otros";

      if (
        raw.includes("culqi") ||
        raw.includes("tarjeta") ||
        raw.includes("card") ||
        raw.includes("online")
      ) {
        group = "culqi";
      } else if (
        raw.includes("transf") ||
        raw.includes("yape") ||
        raw.includes("plin") ||
        raw.includes("banco")
      ) {
        group = "transferencia";
      } else if (
        raw.includes("contra") ||
        raw.includes("entrega") ||
        raw.includes("cod") ||
        raw.includes("efectivo")
      ) {
        group = "contraentrega";
      } else if (!raw) {
        group = isPaidOrder(order) ? "transferencia" : "otros";
      }

      map[group].value += 1;
      map[group].amount += Number(order.total_amount || 0);
    });

    const total = orders.length || 1;
    return Object.values(map)
      .filter((m) => m.value > 0)
      .map((m) => ({
        ...m,
        percentage: Number(((m.value / total) * 100).toFixed(1)),
      }));
  }, [orders]);

  // Proporción de efectividad de pedidos (Aceptados/Efectivos vs Cancelados vs Incidencias)
  const orderEffectivenessStats = useMemo(() => {
    let effective = 0;
    let cancelled = 0;
    let incidents = 0;
    let inProgress = 0;

    orders.forEach((order) => {
      const st = String(order.status || "").toLowerCase().trim();
      const paySt = String(order.payment_status || "").toLowerCase().trim();
      const hasIncident =
        st === "con_incidencia" || Boolean(order.incident_reason);

      if (hasIncident) {
        incidents += 1;
      } else if (
        CANCELLED_STATUSES.includes(st) ||
        CANCELLED_STATUSES.includes(paySt)
      ) {
        cancelled += 1;
      } else if (
        isPaidOrder(order) ||
        st === "completado" ||
        st === "entregado" ||
        st === "aceptado" ||
        st === "en_camino" ||
        st === "listo_para_recojo"
      ) {
        effective += 1;
      } else {
        inProgress += 1;
      }
    });

    const total = orders.length || 1;
    const list = [
      {
        name: "Efectivos / Aceptados",
        value: effective,
        color: "#10B981",
        percentage: Number(((effective / total) * 100).toFixed(1)),
      },
      {
        name: "Cancelados",
        value: cancelled,
        color: "#EF4444",
        percentage: Number(((cancelled / total) * 100).toFixed(1)),
      },
      {
        name: "Con Incidencia",
        value: incidents,
        color: "#F59E0B",
        percentage: Number(((incidents / total) * 100).toFixed(1)),
      },
    ];

    if (inProgress > 0) {
      list.push({
        name: "En Proceso",
        value: inProgress,
        color: "#64748B",
        percentage: Number(((inProgress / total) * 100).toFixed(1)),
      });
    }

    return list.filter((item) => item.value > 0);
  }, [orders]);

  const customerRankings = useMemo(() => {
    return {
      frequent: [...allCustomersList]
        .sort((a, b) => b.orders - a.orders || b.spent - a.spent)
        .slice(0, 5),

      highestSpending: [...allCustomersList]
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5),

      volume: [...allCustomersList]
        .sort((a, b) => b.units - a.units || b.spent - a.spent)
        .slice(0, 5),
    };
  }, [allCustomersList]);

  const periodLabel =
    PERIOD_OPTIONS.find((opt) => opt.value === timeRange)?.label || timeRange;

  const reportRows = [
    ["REPORTE COMERCIAL ERXIDI"],
    ["Periodo aplicado", periodLabel],
    ["Generado el", new Date().toLocaleString("es-PE")],
    [],
    ["RESUMEN DEL DASHBOARD"],
    ["Total de Ventas (PEN)", Number(metrics.sales.toFixed(2))],
    ["Venta Promedio (PEN)", Number(metrics.averageTicket.toFixed(2))],
    ["Prendas Vendidas", metrics.units],
    ["Tasa de Efectividad (%)", Number(metrics.effectiveness.toFixed(1))],
    ["Pedidos Efectivos", metrics.orders],
    ["Total Pedidos Ingresados", metrics.totalOrdersCount],
    ["Clientes Compradores Únicos", metrics.customers],
    ["Clientes Recurrentes", metrics.recurringCustomers],
    ["Variantes sin Stock (0 un.)", outOfStockVariantsCount],
    [],
    ["MÉTODOS DE PAGO"],
    ["Canal de Cobro", "Pedidos", "Participación (%)", "Monto Facturado (PEN)"],
    ...paymentMethodStats.map((item) => [
      item.name,
      item.value,
      item.percentage,
      Number(item.amount.toFixed(2)),
    ]),
    [],
    ["ESTADO Y EFECTIVIDAD DE PEDIDOS"],
    ["Estado", "Pedidos", "Porcentaje (%)"],
    ...orderEffectivenessStats.map((item) => [
      item.name,
      item.value,
      item.percentage,
    ]),
    [],
    ["EVOLUCIÓN DE VENTAS"],
    ["Fecha", "Ventas (PEN)", "Pedidos"],
    ...salesTrend.map((item) => [
      item.date,
      Number(item.sales.toFixed(2)),
      item.orders,
    ]),
    [],
    ["TOP 5 PRENDAS MÁS VENDIDAS"],
    ["Producto", "Unidades", "Ingresos (PEN)"],
    ...topProducts.map((product) => [
      product.name,
      product.units,
      Number(product.revenue.toFixed(2)),
    ]),
    [],
    ["VENTAS POR CATEGORÍA"],
    ["Categoría", "Unidades", "Ingresos (PEN)"],
    ...categorySales.map((category) => [
      category.name,
      category.units,
      Number(category.revenue.toFixed(2)),
    ]),
    [],
    ["STOCK CRÍTICO ACTUAL (Variantes con stock < 5)"],
    [
      "Producto",
      "Variantes (talla/color/SKU/stock)",
      "Stock crítico acumulado",
      "Estado",
    ],
    ...criticalProducts.map((p) => [
      p.name,
      p.variants
        .map((v) => `${v.size}/${v.color}/${v.sku}: ${v.stock}`)
        .join(" | "),
      Number(p.stock || 0),
      Number(p.stock || 0) === 0 ? "Agotado" : "Stock bajo",
    ]),
    [],
    ["CLIENTES MÁS FRECUENTES"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.frequent.map((customer) => [
      customer.name,
      customer.email,
      customer.orders,
      Number(customer.spent.toFixed(2)),
      customer.units,
    ]),
    [],
    ["CLIENTES CON MAYOR GASTO ACUMULADO"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.highestSpending.map((customer) => [
      customer.name,
      customer.email,
      customer.orders,
      Number(customer.spent.toFixed(2)),
      customer.units,
    ]),
    [],
    ["CLIENTES POR MAYOR VOLUMEN DE PRENDAS"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.volume.map((customer) => [
      customer.name,
      customer.email,
      customer.orders,
      Number(customer.spent.toFixed(2)),
      customer.units,
    ]),
  ];

  function handleExportExcel() {
    const worksheet = XLSX.utils.aoa_to_sheet(reportRows);
    worksheet["!cols"] = [
      { wch: 36 },
      { wch: 32 },
      { wch: 22 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
    ];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    const sectionNames = new Set([
      "REPORTE COMERCIAL ERXIDI",
      "RESUMEN DEL DASHBOARD",
      "MÉTODOS DE PAGO",
      "ESTADO Y EFECTIVIDAD DE PEDIDOS",
      "EVOLUCIÓN DE VENTAS",
      "TOP 5 PRENDAS MÁS VENDIDAS",
      "VENTAS POR CATEGORÍA",
      "STOCK CRÍTICO ACTUAL (Variantes con stock < 5)",
      "CLIENTES MÁS FRECUENTES",
      "CLIENTES CON MAYOR GASTO ACUMULADO",
      "CLIENTES POR MAYOR VOLUMEN DE PRENDAS",
    ]);

    for (let row = range.s.r; row <= range.e.r; row++) {
      const firstCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
      const firstValue = firstCell?.v;
      const isSection = sectionNames.has(String(firstValue || ""));
      const isHeader =
        !isSection &&
        firstValue &&
        row > 0 &&
        (String(firstValue).includes("Fecha") ||
          String(firstValue).includes("Producto") ||
          String(firstValue).includes("Cliente") ||
          String(firstValue).includes("Categoría") ||
          String(firstValue).includes("Canal") ||
          String(firstValue).includes("Estado"));

      for (let col = range.s.c; col <= range.e.c; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[address]) continue;
        worksheet[address].s = {
          font: {
            name: "Aptos",
            sz: 10,
            bold: isSection || isHeader,
            color: { rgb: isSection || isHeader ? "FFFFFF" : "0F172A" },
          },
          fill: {
            patternType: "solid",
            fgColor: {
              rgb: isSection
                ? "0F172A"
                : isHeader
                  ? "D97706"
                  : row % 2 === 0
                    ? "F4F4F5"
                    : "FFFFFF",
            },
          },
          alignment: { vertical: "center", wrapText: true },
          border: {
            bottom: { style: "thin", color: { rgb: "E4E4E7" } },
          },
        };
      }
      if (isSection || isHeader) worksheet["!rows"] = worksheet["!rows"] || [];
      if (isSection || isHeader) {
        worksheet["!rows"][row] = { hpt: isSection ? 22 : 20 };
      }
    }

    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    worksheet["!freeze"] = {
      xSplit: 0,
      ySplit: 3,
      topLeftCell: "A4",
      activePane: "bottomLeft",
      state: "frozen",
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard ERXIDI");
    XLSX.writeFile(
      `ERXIDI-Dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    setReportMenuOpen(false);
  }

  function handleExportPDF() {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("ERXIDI - REPORTE COMERCIAL", 14, 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Periodo: ${periodLabel}`, 14, 22);
    pdf.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 27);

    autoTable(pdf, {
      startY: 32,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Ventas", money(metrics.sales)],
        ["Venta Promedio", money(metrics.averageTicket)],
        ["Prendas Vendidas", `${numberFormat(metrics.units)} un.`],
        ["Tasa de Efectividad", `${metrics.effectiveness.toFixed(1)}%`],
        ["Pedidos Efectivos", numberFormat(metrics.orders)],
        ["Total Pedidos Ingresados", numberFormat(metrics.totalOrdersCount)],
        ["Clientes Compradores", numberFormat(metrics.customers)],
        ["Clientes Recurrentes", numberFormat(metrics.recurringCustomers)],
        ["Variantes sin Stock", numberFormat(outOfStockVariantsCount)],
      ],
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 },
    });

    let y = (pdf.lastAutoTable?.finalY || 70) + 8;
    const addTable = (title, headers, rows) => {
      if (y > 175) {
        pdf.addPage();
        y = 16;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(title, 14, y);
      autoTable(pdf, {
        startY: y + 3,
        head: [headers],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      y = (pdf.lastAutoTable?.finalY || y + 20) + 8;
    };

    addTable(
      "Métodos de pago",
      ["Canal de Cobro", "Pedidos", "Participación (%)", "Monto"],
      paymentMethodStats.map((item) => [
        item.name,
        String(item.value),
        `${item.percentage}%`,
        money(item.amount),
      ]),
    );

    addTable(
      "Efectividad y estado de pedidos",
      ["Estado", "Pedidos", "Porcentaje (%)"],
      orderEffectivenessStats.map((item) => [
        item.name,
        String(item.value),
        `${item.percentage}%`,
      ]),
    );

    addTable(
      "Evolución de ventas",
      ["Fecha", "Ventas (PEN)", "Pedidos"],
      salesTrend.map((item) => [
        item.date,
        money(item.sales),
        String(item.orders),
      ]),
    );

    addTable(
      "Top 5 prendas más vendidas",
      ["Producto", "Unidades", "Ingresos"],
      topProducts.map((item) => [
        item.name,
        String(item.units),
        money(item.revenue),
      ]),
    );

    addTable(
      "Ventas por categoría",
      ["Categoría", "Unidades", "Ingresos"],
      categorySales.map((item) => [
        item.name,
        String(item.units),
        money(item.revenue),
      ]),
    );

    addTable(
      "Stock crítico actual (variantes con stock < 5)",
      [
        "Producto",
        "Variantes (talla/color/SKU/stock)",
        "Stock crítico",
        "Nivel",
      ],
      criticalProducts.map((p) => [
        p.name,
        p.variants
          .map((v) => `${v.size}/${v.color}/${v.sku}: ${v.stock}`)
          .join(" | "),
        String(p.stock ?? 0),
        Number(p.stock || 0) === 0 ? "Agotado" : "Stock bajo",
      ]),
    );

    addTable(
      "Clientes más frecuentes",
      ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.frequent.map((item) => [
        item.name,
        item.email,
        String(item.orders),
        money(item.spent),
        String(item.units),
      ]),
    );

    addTable(
      "Clientes con mayor gasto acumulado",
      ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.highestSpending.map((item) => [
        item.name,
        item.email,
        String(item.orders),
        money(item.spent),
        String(item.units),
      ]),
    );

    addTable(
      "Clientes por mayor volumen de prendas",
      ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.volume.map((item) => [
        item.name,
        item.email,
        String(item.orders),
        money(item.spent),
        String(item.units),
      ]),
    );

    pdf.save(
      `ERXIDI-Dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    setReportMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-5">
        <p className="text-sm text-status-danger-text">{error}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => setRefreshKey((current) => current + 1)}
        >
          Reintentar
        </Button>
      </Card>
    );
  }

  const helpInfo = activeHelpModal ? KPI_EXPLANATIONS[activeHelpModal] : null;

  return (
    <div className="space-y-6">
      {/* 1. Barra de navegación superior fija (Sticky Navbar) */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-6 px-4 sm:px-6 lg:px-8 py-3 bg-surface-card/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-brand-primary tracking-tight">
              Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value)}
              className="h-9 px-3 rounded-button border border-border bg-surface-card text-xs font-semibold text-brand-primary focus:outline-none focus:border-border-strong cursor-pointer shadow-xs"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <button
                type="button"
                onClick={() => setReportMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-bold text-xs h-9 px-3.5 rounded-button shadow-xs transition-colors"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                <span>Generar reporte</span>
                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </button>

              {reportMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 min-w-44 rounded-card border border-border bg-surface-card p-1.5 shadow-dropdown">
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="flex w-full items-center gap-2.5 rounded-button px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-surface-subtle transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-status-danger-text" />
                    <span>Exportar a PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex w-full items-center gap-2.5 rounded-button px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-surface-subtle transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-status-success-text" />
                    <span>Exportar a Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Fila Única y Compacta de 4 KPIs Estratégicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <SoberKpiCard
          title="Total de Ventas"
          value={money(metrics.sales)}
          helper="Facturación neta confirmada"
          icon={DollarSign}
          isMono
          iconBg="bg-emerald-50"
          iconBorder="border-emerald-200"
          iconColor="text-emerald-700"
          topAccent="bg-emerald-600"
          onHelpClick={() => setActiveHelpModal("sales")}
        />

        <SoberKpiCard
          title="Venta Promedio"
          value={money(metrics.averageTicket)}
          helper="Ventas / Pedidos pagados"
          icon={TrendingUp}
          isMono
          iconBg="bg-sky-50"
          iconBorder="border-sky-200"
          iconColor="text-sky-700"
          topAccent="bg-sky-600"
          onHelpClick={() => setActiveHelpModal("averageTicket")}
        />

        <SoberKpiCard
          title="Prendas Vendidas"
          value={`${numberFormat(metrics.units)} un.`}
          helper="Volumen físico comercializado"
          icon={PackageCheck}
          isMono
          iconBg="bg-amber-50"
          iconBorder="border-amber-200"
          iconColor="text-amber-700"
          topAccent="bg-amber-600"
          onHelpClick={() => setActiveHelpModal("units")}
        />

        <SoberKpiCard
          title="Tasa de Efectividad"
          value={`${metrics.effectiveness.toFixed(1)}%`}
          helper={`${numberFormat(metrics.orders)} de ${numberFormat(metrics.totalOrdersCount)} pedidos concluidos`}
          icon={CheckCircle2}
          isMono
          iconBg="bg-indigo-50"
          iconBorder="border-indigo-200"
          iconColor="text-indigo-700"
          topAccent="bg-indigo-600"
          onHelpClick={() => setActiveHelpModal("effectiveness")}
        />
      </div>

      {/* 3. Gráfico Principal: Evolución de Ventas con Diagnóstico de Tendencia */}
      <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />
        <CardHeader className="border-b border-border bg-surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-brand-primary text-base">
              Evolución de ventas
            </CardTitle>
            <CardDescription>
              Ingresos diarios (S/) y volumen de pedidos en el período (
              {periodLabel}).
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTrendAnalysisModalOpen(true)}
            className="self-start sm:self-auto text-xs h-8 px-2.5 bg-surface-card hover:bg-surface-subtle border-border"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />
            <span>Diagnóstico de tendencia</span>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {salesTrend.length === 0 ? (
            <p className="text-xs text-brand-secondary py-10 text-center">
              No existen ventas pagadas registradas en este período.
            </p>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E4E4E7"
                  />

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    tickMargin={10}
                    stroke="#CBD5E1"
                  />

                  <YAxis
                    yAxisId="sales"
                    tickFormatter={(value) => `S/ ${value}`}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    stroke="#CBD5E1"
                  />

                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    stroke="#CBD5E1"
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E4E4E7",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#0F172A",
                    }}
                    formatter={(value, name) =>
                      name === "Ventas" ? money(value) : numberFormat(value)
                    }
                  />

                  <Legend wrapperStyle={{ fontSize: "12px" }} />

                  <Line
                    yAxisId="sales"
                    type="monotone"
                    dataKey="sales"
                    name="Ventas"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#D97706" }}
                    activeDot={{ r: 5 }}
                  />

                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    name="Pedidos"
                    stroke="#0F172A"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#0F172A" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Cuadrícula 2x2 de Gráficos Analíticos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* A. Prendas más vendidas (BarChart horizontal con Hover Preview y Clic) */}
        <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />
          <CardHeader className="border-b border-border bg-surface-card">
            <CardTitle className="text-brand-primary text-base">
              Prendas más vendidas
            </CardTitle>
            <CardDescription>
              Ranking por unidades vendidas. Haz clic en la barra o en el nombre
              para abrir el detalle completo con métricas.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {topProducts.length === 0 ? (
              <p className="text-xs text-brand-secondary py-12 text-center">
                No hay productos vendidos en este período.
              </p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    onClick={(state) => {
                      if (
                        state &&
                        state.activePayload &&
                        state.activePayload.length
                      ) {
                        setSelectedProductDetail(state.activePayload[0].payload);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#E4E4E7"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#475569" }}
                      stroke="#CBD5E1"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={
                        <CustomYAxisTick
                          onProductClick={setSelectedProductDetail}
                          productsMap={topProductsByName}
                        />
                      }
                      stroke="#CBD5E1"
                    />
                    <Tooltip
                      content={<ProductBarTooltip />}
                      cursor={{ fill: "#F4F4F5", opacity: 0.6 }}
                    />
                    <Bar
                      dataKey="units"
                      name="Unidades"
                      fill="#D97706"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={(data) => {
                        if (data) setSelectedProductDetail(data);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* B. Ventas por categoría (Dona / PieChart) */}
        <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />
          <CardHeader className="border-b border-border bg-surface-card">
            <CardTitle className="text-brand-primary text-base">
              Ventas por categoría
            </CardTitle>
            <CardDescription>
              Distribución de ingresos por línea de producto en el período.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {categorySales.length === 0 ? (
              <p className="text-xs text-brand-secondary py-12 text-center">
                No hay categorías con ventas en este período.
              </p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySales}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {categorySales.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CategoryPieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* C. Métodos de Pago (Dona / PieChart) */}
        <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />
          <CardHeader className="border-b border-border bg-surface-card">
            <CardTitle className="text-brand-primary text-base">
              Métodos de pago
            </CardTitle>
            <CardDescription>
              Participación transaccional por canal de cobro en el período.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {paymentMethodStats.length === 0 ? (
              <p className="text-xs text-brand-secondary py-12 text-center">
                No hay registros de transacciones en este período.
              </p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {paymentMethodStats.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieGenericTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* D. Efectividad de Pedidos (Dona / PieChart) */}
        <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />
          <CardHeader className="border-b border-border bg-surface-card">
            <CardTitle className="text-brand-primary text-base">
              Efectividad de pedidos
            </CardTitle>
            <CardDescription>
              Proporción de pedidos completados vs. cancelados o con incidencia.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {orderEffectivenessStats.length === 0 ? (
              <p className="text-xs text-brand-secondary py-12 text-center">
                No hay pedidos evaluados en este período.
              </p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderEffectivenessStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {orderEffectivenessStats.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieGenericTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Análisis de Clientes (3 Columnas con Avatar Determinista) */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-brand-primary">
            Análisis de clientes
          </h2>
          <p className="text-xs text-brand-secondary">
            Segmentación de compradores por frecuencia, importe facturado y
            volumen de prendas.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <CustomerRankingCard
            title="Más frecuentes"
            subtitle="Por cantidad de pedidos pagados"
            icon={Repeat2}
            data={customerRankings.frequent}
            metric={(customer) => `${customer.orders} ped.`}
          />

          <CustomerRankingCard
            title="Mayor gasto acumulado"
            subtitle="Por importe total facturado"
            icon={Crown}
            data={customerRankings.highestSpending}
            metric={(customer) => money(customer.spent)}
          />

          <CustomerRankingCard
            title="Mayor volumen de prendas"
            subtitle="Por unidades físicas adquiridas"
            icon={Package}
            data={customerRankings.volume}
            metric={(customer) => `${customer.units} un.`}
          />
        </div>
      </div>

      {/* 6. Bloque de Stock Crítico (Al Pie de Página, Colapsado por Defecto) */}
      {criticalProducts.length > 0 && (
        <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-900" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-surface-card border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-amber-50 border border-amber-200 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-brand-primary">
                    Alerta de Stock Crítico
                  </h2>
                  <Badge variant="warning" className="font-mono text-[10px]">
                    {criticalVariants.length} variantes &lt; 5 un.
                  </Badge>
                </div>
                <p className="text-xs text-brand-secondary">
                  Productos activos con combinaciones Talla/Color agotadas o
                  próximas a agotarse.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCriticalStockOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold text-brand-secondary hover:text-brand-primary px-3 py-1.5 rounded-button border border-border bg-surface-card hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <span>{criticalStockOpen ? "Ocultar detalle" : "Ver detalle"}</span>
              {criticalStockOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {criticalStockOpen && (
            <CardContent className="p-0 bg-surface-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-card text-brand-secondary uppercase text-[11px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-5 font-semibold">Producto</th>
                      <th className="py-3 px-5 font-semibold">
                        Variantes afectadas (Talla / Color / Stock)
                      </th>
                      <th className="py-3 px-5 text-right font-semibold">
                        Estado
                      </th>
                      <th className="py-3 px-5 text-right font-semibold">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-card">
                    {criticalProducts.map((product) => {
                      const hasZero = product.variants.some(
                        (v) => Number(v.stock) === 0,
                      );
                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-surface-subtle/50 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-10 shrink-0 aspect-[4/5] rounded-button border border-border bg-slate-50 overflow-hidden flex items-center justify-center">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <Package className="h-4 w-4 text-brand-muted" />
                                )}
                              </div>
                              <span className="font-bold text-brand-primary text-xs">
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex max-w-[460px] flex-wrap gap-1.5">
                              {product.variants.map((variant) => (
                                <span
                                  key={variant.id}
                                  title={`SKU: ${variant.sku}`}
                                  className="inline-flex items-center gap-1.5 rounded-button border border-border bg-surface-card px-2 py-0.5 text-[11px] text-brand-secondary shadow-xs"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full border border-border-strong"
                                    style={{
                                      backgroundColor: variant.color_hex,
                                    }}
                                  />
                                  <span>
                                    {variant.size} · {variant.color}
                                  </span>
                                  <b
                                    className={`font-mono ${
                                      variant.stock === 0
                                        ? "text-status-danger-text"
                                        : "text-brand-primary"
                                    }`}
                                  >
                                    ({variant.stock})
                                  </b>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <Badge variant={hasZero ? "danger" : "warning"}>
                              {hasZero ? "Con agotados" : "Stock bajo"}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(`/admin/productos/${product.id}/editar`)
                              }
                              className="text-xs h-7 px-2.5 bg-surface-card hover:bg-surface-subtle"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              <span>Reponer stock</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Modal Explicativo de KPIs para Sustentación */}
      {helpInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setActiveHelpModal(null)}
        >
          <div
            className="w-full max-w-md rounded-card border border-border bg-surface-card p-5 shadow-dropdown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                  Definición de Indicador
                </p>
                <h3 className="text-base font-black text-brand-primary mt-0.5">
                  {helpInfo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveHelpModal(null)}
                className="rounded-button p-1 text-brand-muted hover:bg-surface-subtle hover:text-brand-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-brand-secondary">
                {helpInfo.description}
              </p>

              <div className="rounded-button border border-border bg-surface-subtle p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                  Fórmula / Regla de Negocio
                </p>
                <p className="mt-1 font-mono text-xs font-bold text-brand-primary">
                  {helpInfo.formula}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveHelpModal(null)}
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Prenda con Métricas Destacadas */}
      {selectedProductDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedProductDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-card border border-border bg-surface-card p-5 shadow-dropdown animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                  Detalle Comercial de la Prenda
                </p>
                <h3 className="text-base font-black text-brand-primary mt-0.5 leading-snug">
                  {selectedProductDetail.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductDetail(null)}
                className="rounded-button p-1 text-brand-muted hover:bg-surface-subtle hover:text-brand-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-28 w-24 shrink-0 aspect-[4/5] rounded-button border border-border bg-slate-50 overflow-hidden flex items-center justify-center">
                  {selectedProductDetail.image ? (
                    <img
                      src={selectedProductDetail.image}
                      alt={selectedProductDetail.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-brand-muted" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <Badge variant="neutral" className="text-[10px]">
                    {selectedProductDetail.categoryName || "Catálogo ERXIDI"}
                  </Badge>

                  <p className="text-xs text-brand-secondary leading-relaxed">
                    Rendimiento en el período seleccionado ({periodLabel}).
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/admin/productos/${selectedProductDetail.id}/editar`,
                      )
                    }
                    className="text-xs h-7 px-2.5 mt-1"
                  >
                    <span>Editar producto y stock</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Prendas vendidas
                  </p>
                  <p className="mt-1 text-xl font-black font-mono text-brand-primary">
                    {numberFormat(selectedProductDetail.units)} un.
                  </p>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    Unidades físicas facturadas
                  </p>
                </div>

                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Ingreso acumulado
                  </p>
                  <p className="mt-1 text-xl font-black font-mono text-accent">
                    {money(selectedProductDetail.revenue)}
                  </p>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    Recaudación bruta efectiva
                  </p>
                </div>

                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Ticket promedio / prenda
                  </p>
                  <p className="mt-1 text-base font-bold font-mono text-brand-primary">
                    {money(
                      selectedProductDetail.revenue /
                        (selectedProductDetail.units || 1),
                    )}
                  </p>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    Precio medio por unidad
                  </p>
                </div>

                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Presencia en pedidos
                  </p>
                  <p className="mt-1 text-base font-bold font-mono text-brand-primary">
                    {numberFormat(selectedProductDetail.ordersCount)} ped.
                  </p>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    Órdenes con esta prenda
                  </p>
                </div>
              </div>

              {selectedProductDetail.variantsBreakdown?.length > 0 && (
                <div className="rounded-card border border-border bg-surface-card p-3">
                  <p className="text-[11px] font-bold text-brand-primary mb-2">
                    Desglose por variantes en el período:
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border">
                    {selectedProductDetail.variantsBreakdown.map((vb, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs pt-1.5 first:pt-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full border border-border-strong"
                            style={{ backgroundColor: vb.color_hex }}
                          />
                          <span className="text-brand-primary font-medium">
                            {vb.color}
                          </span>
                          <span className="text-[10px] font-mono text-brand-muted">
                            ({vb.sku})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-primary text-[11px]">
                            {vb.units} un.
                          </span>
                          <span className="font-mono text-brand-secondary text-[11px]">
                            {money(vb.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProductDetail(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Diagnóstico de Tendencia y Comportamiento Histórico */}
      {trendAnalysisModalOpen && trendDiagnosis && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setTrendAnalysisModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-card border border-border bg-surface-card p-5 shadow-dropdown animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-button bg-amber-50 border border-amber-200 text-amber-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Inteligencia Operativa
                  </p>
                  <h3 className="text-base font-black text-brand-primary mt-0.5">
                    Diagnóstico de Tendencia Histórica
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrendAnalysisModalOpen(false)}
                className="rounded-button p-1 text-brand-muted hover:bg-surface-subtle hover:text-brand-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Día Récord de Facturación
                  </p>
                  <p className="mt-1 font-mono text-base font-black text-brand-primary">
                    {trendDiagnosis.peakDate}
                  </p>
                  <p className="text-[11px] text-accent font-mono font-bold mt-0.5">
                    {money(trendDiagnosis.peakSales)} (
                    {trendDiagnosis.peakOrders} ped.)
                  </p>
                </div>

                <div className="rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                    Ritmo de Ventas (2da mitad)
                  </p>
                  <p
                    className={`mt-1 font-mono text-base font-black ${
                      trendDiagnosis.isGrowing
                        ? "text-status-success-text"
                        : "text-status-danger-text"
                    }`}
                  >
                    {trendDiagnosis.isGrowing ? "+" : ""}
                    {trendDiagnosis.growthPercent}%
                  </p>
                  <p className="text-[11px] text-brand-muted mt-0.5">
                    vs. primera mitad del periodo
                  </p>
                </div>
              </div>

              <div className="rounded-card border border-border bg-surface-subtle p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                  Día con Mayor Afluencia Comercial
                </p>
                <p className="text-xs font-bold text-brand-primary">
                  Los días {trendDiagnosis.bestDayOfWeek} concentran el mayor
                  volumen transaccional.
                </p>
                <p className="text-[11px] text-brand-secondary">
                  Se sugiere programar lanzamientos y ofertas especiales en
                  víspera de {trendDiagnosis.bestDayOfWeek}.
                </p>
              </div>

              <div className="rounded-card border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Recomendación Táctica ERXIDI
                </p>
                <p className="mt-1 text-xs text-amber-950 leading-relaxed">
                  {trendDiagnosis.isGrowing
                    ? "La demanda muestra aceleración en la última etapa del periodo. Asegurar reposición de stock en las variantes principales para prevenir quiebres de inventario."
                    : "Se observa una desaceleración en el volumen reciente. Se sugiere reactivar clientes compradores con campañas por correo o promociones en canales directos."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-border pt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setTrendAnalysisModalOpen(false)}
              >
                Cerrar diagnóstico
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SoberKpiCard({
  title,
  value,
  helper,
  icon: Icon,
  isMono = false,
  topAccent = "bg-slate-900",
  iconBg = "bg-slate-100",
  iconBorder = "border-slate-200",
  iconColor = "text-slate-800",
  onHelpClick,
}) {
  return (
    <div className="relative overflow-hidden bg-surface-card border border-border rounded-card p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
      <div className={`absolute top-0 inset-x-0 h-[3px] ${topAccent}`} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-button border ${iconBg} ${iconBorder} ${iconColor}`}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-secondary truncate">
            {title}
          </p>
        </div>

        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            title={`Ver definición de ${title}`}
            className="text-brand-muted hover:text-brand-primary transition-colors p-0.5 rounded-button"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2.5">
        <p
          className={`text-2xl font-black text-brand-primary tracking-tight ${
            isMono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
        {helper && (
          <p className="mt-1 text-[11px] text-brand-muted">{helper}</p>
        )}
      </div>
    </div>
  );
}

function CustomerRankingCard({ title, subtitle, icon: Icon, data, metric }) {
  return (
    <Card className="relative overflow-hidden border border-border bg-surface-card rounded-card shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-slate-800" />
      <CardHeader className="border-b border-border py-3.5 px-4 bg-surface-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-slate-100 border border-slate-200 text-slate-800">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-brand-primary">
              {title}
            </CardTitle>
            <CardDescription className="text-[11px] text-brand-secondary">
              {subtitle}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 bg-surface-card">
        {data.length === 0 ? (
          <p className="text-xs text-brand-secondary py-4 text-center">
            No hay clientes registrados en este período.
          </p>
        ) : (
          <div className="space-y-2.5">
            {data.map((customer) => {
              const avatarSeed =
                customer.email || customer.name || customer.id;
              const avatarColors = getDeterministicAvatarStyle(avatarSeed);
              const initials = getCustomerInitials(customer.name);

              return (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-3 rounded-button border border-border bg-surface-card px-3 py-2 shadow-xs hover:bg-surface-subtle/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tracking-tight ${avatarColors}`}
                      title={customer.name}
                    >
                      {initials}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-primary truncate">
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-brand-secondary truncate">
                        {customer.email || "Cliente registrado"}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-button bg-surface-subtle border border-border px-2 py-1 text-xs font-mono font-bold text-brand-primary whitespace-nowrap">
                    {metric(customer)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
