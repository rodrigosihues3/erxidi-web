import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  ShoppingCart,
  PackageCheck,
  Users,
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Crown,
  Repeat2,
  Package,
  Plus,
  AlertTriangle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { supabase } from "../../../services/supabase";

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
import KpiCard from "../components/KpiCard";

import {
  getDashboardAnalytics,
} from "../services/adminOrders.service";

const COLORS = [
  "#D97706",
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#EC4899",
  "#8B5CF6",
  "#64748B",
];

const PAID_STATUSES = ["paid", "pagado"];

const CANCELLED_STATUSES = ["cancelado", "cancelled"];

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function numberFormat(value) {
  return new Intl.NumberFormat("es-PE").format(Number(value || 0));
}

function formatCompactTime(dateString) {
  if (!dateString) return "--:--";

  return new Date(dateString).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "7days") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30days") {
    start.setDate(start.getDate() - 29);
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "all") {
    return { startDate: null, endDate: null };
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

function downloadCSV(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "").replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function DashboardView() {
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState("30days");
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [orders, setOrders] = useState([]);
  const [criticalStock, setCriticalStock] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const dates = getPeriodDates(timeRange);

        const [analytics, stockResult] = await Promise.all([
          getDashboardAnalytics(dates),
          supabase
            .from("product_variants")
            .select(`id, stock, sku, color, color_hex, is_active, sizes:size_id(name), products:product_id(id, name, is_active, main_image_url)`)
            .eq("is_active", true),
        ]);

        if (stockResult.error) throw stockResult.error;
        // Agrupar por producto y sumar el stock de todas sus variantes activas.
        // Así evitamos marcar como crítico un producto que tiene stock suficiente
        // repartido entre tallas o colores.
        const productStockMap = new Map();
        (stockResult.data || []).forEach((variant) => {
          const product = variant.products;
          if (!product || product.is_active === false) return;

          const productId = product.id;
          const current = productStockMap.get(productId) || {
            id: productId,
            name: product.name || "Producto",
            image: product.main_image_url || null,
            stock: 0,
            variants: [],
          };
          const qty = Number(variant.stock || 0);
          current.stock += qty;
          current.variants.push({
            id: variant.id,
            stock: qty,
            sku: variant.sku || "-",
            size: variant.sizes?.name || "-",
            color: variant.color || "-",
            color_hex: variant.color_hex || "#ddd",
          });
          productStockMap.set(productId, current);
        });

        // Umbral predeterminado para el total del producto (no para cada variante).
        const LOW_STOCK_THRESHOLD = 5;
        const stockList = [...productStockMap.values()]
          .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
          .sort((a, b) => a.stock - b.stock);

        if (active) {
          setOrders(analytics);
          setCriticalStock(stockList);
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

  const paidOrders = useMemo(
    () => orders.filter(isPaidOrder),
    [orders],
  );

  const metrics = useMemo(() => {
    const sales = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );

    const units = paidOrders.reduce((sum, order) => {
      const items = order.order_items || [];

      return (
        sum +
        items.reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        )
      );
    }, 0);

    const uniqueCustomers = new Set(
      paidOrders
        .map((order) => order.customer_id)
        .filter(Boolean),
    );

    const customers = uniqueCustomers.size;

    const averageTicket =
      paidOrders.length > 0 ? sales / paidOrders.length : 0;

    return {
      sales,
      orders: paidOrders.length,
      units,
      customers,
      averageTicket,
    };
  }, [paidOrders]);

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

    return [...grouped.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [paidOrders]);

  const topProducts = useMemo(() => {
    const map = new Map();

    paidOrders.forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const product =
          item.product_variants?.products;

        if (!product) return;

        const existing = map.get(product.id) || {
          id: product.id,
          name: product.name,
          image: product.main_image_url,
          units: 0,
          revenue: 0,
        };

        existing.units += Number(item.quantity || 0);
        existing.revenue += Number(item.subtotal || 0);

        map.set(product.id, existing);
      });
    });

    return [...map.values()]
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [paidOrders]);

  const categorySales = useMemo(() => {
    const map = new Map();

    paidOrders.forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const category =
          item.product_variants?.products?.categories;

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

  const customerRankings = useMemo(() => {
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

      if (
        new Date(order.created_at) >
        new Date(current.lastPurchase)
      ) {
        current.lastPurchase = order.created_at;
      }

      map.set(customerId, current);
    });

    const customers = [...map.values()];

    return {
      frequent: [...customers]
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5),

      highestSpending: [...customers]
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5),

      volume: [...customers]
        .sort((a, b) => b.units - a.units)
        .slice(0, 5),
    };
  }, [paidOrders]);

  const periodLabel = {
    today: "Hoy",
    "7days": "Últimos 7 días",
    "30days": "Últimos 30 días",
    month: "Este mes",
    all: "Todo el historial",
  }[timeRange] || timeRange;

  const reportRows = [
    ["REPORTE COMERCIAL ERXIDI"],
    ["Periodo aplicado", periodLabel],
    ["Generado el", new Date().toLocaleString("es-PE")],
    [],
    ["RESUMEN DEL DASHBOARD"],
    ["Ventas efectivas (PEN)", Number(metrics.sales.toFixed(2))],
    ["Pedidos pagados", metrics.orders],
    ["Ticket promedio (PEN)", Number(metrics.averageTicket.toFixed(2))],
    ["Unidades vendidas", metrics.units],
    ["Clientes compradores", metrics.customers],
    ["Productos agotados (stock total 0)", criticalStock.filter((v) => Number(v.stock) === 0).length],
    ["Productos con stock bajo (stock total 1-5)", criticalStock.filter((v) => Number(v.stock) > 0 && Number(v.stock) <= 5).length],
    [],
    ["STOCK CRÍTICO ACTUAL (no depende del filtro de fechas)"],
    ["Producto", "Variantes (talla/color/SKU/stock)", "Stock total", "Nivel"],
    ...criticalStock.map((v) => [v.name, v.variants.map((variant) => `${variant.size}/${variant.color}/${variant.sku}: ${variant.stock}`).join(" | "), Number(v.stock || 0), Number(v.stock || 0) === 0 ? "Agotado" : "Stock bajo"]),
    [],
    ["EVOLUCIÓN DE VENTAS"],
    ["Fecha", "Ventas (PEN)", "Pedidos"],
    ...salesTrend.map((item) => [item.date, Number(item.sales.toFixed(2)), item.orders]),
    [],
    ["TOP PRODUCTOS"],
    ["Producto", "Unidades", "Ingresos (PEN)"],
    ...topProducts.map((product) => [product.name, product.units, Number(product.revenue.toFixed(2))]),
    [],
    ["VENTAS POR CATEGORÍA"],
    ["Categoría", "Unidades", "Ingresos (PEN)"],
    ...categorySales.map((category) => [category.name, category.units, Number(category.revenue.toFixed(2))]),
    [],
    ["CLIENTES MÁS FRECUENTES"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.frequent.map((customer) => [customer.name, customer.email, customer.orders, Number(customer.spent.toFixed(2)), customer.units]),
    [],
    ["CLIENTES QUE MÁS GASTAN"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.highestSpending.map((customer) => [customer.name, customer.email, customer.orders, Number(customer.spent.toFixed(2)), customer.units]),
    [],
    ["CLIENTES POR VOLUMEN"],
    ["Cliente", "Correo", "Pedidos", "Gasto (PEN)", "Unidades"],
    ...customerRankings.volume.map((customer) => [customer.name, customer.email, customer.orders, Number(customer.spent.toFixed(2)), customer.units]),
  ];

  function handleExportExcel() {
    const worksheet = XLSX.utils.aoa_to_sheet(reportRows);
    worksheet["!cols"] = [
      { wch: 36 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
    ];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    const sectionNames = new Set([
      "REPORTE COMERCIAL ERXIDI", "RESUMEN DEL DASHBOARD", "STOCK CRÍTICO ACTUAL (no depende del filtro de fechas)",
      "EVOLUCIÓN DE VENTAS", "TOP PRODUCTOS", "VENTAS POR CATEGORÍA",
      "CLIENTES MÁS FRECUENTES", "CLIENTES QUE MÁS GASTAN", "CLIENTES POR VOLUMEN",
    ]);
    for (let row = range.s.r; row <= range.e.r; row++) {
      const firstCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
      const firstValue = firstCell?.v;
      const isSection = sectionNames.has(String(firstValue || ""));
      const isHeader = !isSection && firstValue && row > 0 &&
        (String(firstValue).includes("Fecha") || String(firstValue).includes("Producto") ||
         String(firstValue).includes("Cliente") || String(firstValue).includes("Categoría"));
      for (let col = range.s.c; col <= range.e.c; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[address]) continue;
        worksheet[address].s = {
          font: { name: "Aptos", sz: 10, bold: isSection || isHeader, color: { rgb: isSection || isHeader ? "FFFFFF" : "263238" } },
          fill: { patternType: "solid", fgColor: { rgb: isSection ? "172B4D" : isHeader ? "D97706" : row % 2 === 0 ? "F3F6FA" : "FFFFFF" } },
          alignment: { vertical: "center", wrapText: true },
          border: { bottom: { style: "thin", color: { rgb: "D8DEE8" } } },
        };
      }
      if (isSection || isHeader) worksheet["!rows"] = worksheet["!rows"] || [];
      if (isSection || isHeader) worksheet["!rows"][row] = { hpt: isSection ? 22 : 20 };
    }
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 3, topLeftCell: "A4", activePane: "bottomLeft", state: "frozen" };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard ERXIDI");
    XLSX.writeFile(workbook, `ERXIDI-Dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setReportMenuOpen(false);
  }

  function handleExportPDF() {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("ERXIDI - REPORTE COMERCIAL", 14, 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Periodo: ${periodLabel}`, 14, 23);
    pdf.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 29);

    autoTable(pdf, {
      startY: 35,
      head: [["Indicador", "Valor"]],
      body: [
        ["Ventas efectivas", money(metrics.sales)],
        ["Pedidos pagados", numberFormat(metrics.orders)],
        ["Ticket promedio", money(metrics.averageTicket)],
        ["Unidades vendidas", numberFormat(metrics.units)],
        ["Clientes compradores", numberFormat(metrics.customers)],
      ],
      theme: "grid",
      headStyles: { fillColor: [36, 47, 67] },
      styles: { fontSize: 9 },
    });

    let y = (pdf.lastAutoTable?.finalY || 70) + 8;
    const addTable = (title, headers, rows) => {
      if (y > 175) {
        pdf.addPage();
        y = 16;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(title, 14, y);
      autoTable(pdf, {
        startY: y + 3,
        head: [headers],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [36, 47, 67] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      y = (pdf.lastAutoTable?.finalY || y + 20) + 8;
    };

    addTable("Stock crítico actual (stock agregado por producto; independiente del período)", ["Producto", "Variantes (talla/color/SKU/stock)", "Stock total", "Nivel"],
      criticalStock.map((v) => [v.name, v.variants.map((variant) => `${variant.size}/${variant.color}/${variant.sku}: ${variant.stock}`).join(" | "), String(v.stock ?? 0), Number(v.stock || 0) === 0 ? "Agotado" : "Stock bajo"]));

    addTable("Evolución de ventas", ["Fecha", "Ventas (PEN)", "Pedidos"],
      salesTrend.map((item) => [item.date, money(item.sales), String(item.orders)]));
    addTable("Productos más vendidos", ["Producto", "Unidades", "Ingresos"],
      topProducts.map((item) => [item.name, String(item.units), money(item.revenue)]));
    addTable("Ventas por categoría", ["Categoría", "Unidades", "Ingresos"],
      categorySales.map((item) => [item.name, String(item.units), money(item.revenue)]));
    addTable("Clientes más frecuentes", ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.frequent.map((item) => [item.name, item.email, String(item.orders), money(item.spent), String(item.units)]));
    addTable("Clientes que más gastan", ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.highestSpending.map((item) => [item.name, item.email, String(item.orders), money(item.spent), String(item.units)]));
    addTable("Clientes por volumen", ["Cliente", "Correo", "Pedidos", "Gasto", "Unidades"],
      customerRankings.volume.map((item) => [item.name, item.email, String(item.orders), money(item.spent), String(item.units)]));

    pdf.save(`ERXIDI-Dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.pdf`);
    setReportMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
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

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-secondary">
            ERXIDI · Análisis comercial
          </p>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">
            Dashboard
          </h1>

          <p className="text-sm text-brand-secondary mt-1">
            Evolución, resultados y comportamiento de clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-white text-sm font-semibold"
          >
            <option value="today">Hoy</option>
            <option value="7days">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="month">Este mes</option>
            <option value="all">Todo el historial</option>
          </select>

          <div className="relative">
            <Button onClick={() => setReportMenuOpen((open) => !open)} className="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !shadow-lg !shadow-violet-200" variant="primary">
              <Download className="h-4 w-4 mr-2" />
              Generar reporte
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>

            {reportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 z-30 min-w-48 rounded-xl border border-border bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-red-600" />
                  Exportar a PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Exportar a Excel
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ModernKpiCard
          title="Ventas efectivas"
          value={money(metrics.sales)}
          helper="Pedidos pagados, sin cancelaciones"
          icon={DollarSign}
        />

        <ModernKpiCard
          title="Pedidos pagados"
          value={numberFormat(metrics.orders)}
          helper="Órdenes contabilizadas como venta"
          icon={ShoppingCart}
        />

        <ModernKpiCard
          title="Ticket promedio"
          value={money(metrics.averageTicket)}
          helper="Gasto promedio por pedido"
          icon={TrendingUp}
        />

        <ModernKpiCard
          title="Clientes compradores"
          value={numberFormat(metrics.customers)}
          helper="Clientes únicos registrados"
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <ModernKpiCard
          title="Unidades vendidas"
          value={numberFormat(metrics.units)}
          helper="Prendas incluidas en pedidos pagados"
          icon={PackageCheck}
        />

        <ModernKpiCard
          title="Variantes agotadas"
          value={numberFormat(criticalStock.filter((product) => Number(product.stock) === 0).length)}
          helper="Productos con stock total cero"
          icon={Package}
        />

        <ModernKpiCard
          title="Clientes recurrentes"
          value={numberFormat(
            customerRankings.frequent.filter((customer) => customer.orders > 1).length,
          )}
          helper="Clientes con más de una compra en el ranking"
          icon={Repeat2}
        />
      </div>

      {/* Stock crítico actual: independiente del filtro comercial */}
      <Card className="overflow-hidden border-0 shadow-lg shadow-rose-100/70">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-slate-900">Stock crítico</CardTitle>
              <CardDescription>Variantes agotadas o próximas a agotarse. Usa “Reponer stock” para gestionar la variante.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {criticalStock.length === 0 ? (
            <p className="p-6 text-sm text-brand-secondary text-center">No hay variantes con stock crítico.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/80 text-slate-500 uppercase text-[11px] tracking-wider">
                  <tr><th className="p-3">Producto</th><th className="p-3">Variantes / tallas</th><th className="p-3 text-right">Stock total</th><th className="p-3">Estado</th><th className="p-3 text-right">Acción</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {criticalStock.map((product) => {
                    const qty = Number(product.stock || 0);
                    return <tr key={product.id} className="transition-colors hover:bg-violet-50/60">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {product.image ? <img src={product.image} alt={product.name} className="h-11 w-11 rounded-xl border border-slate-100 object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Package className="h-5 w-5" /></div>}
                          <span className="font-bold text-slate-800">{product.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex max-w-[420px] flex-wrap gap-1.5">
                          {product.variants.map((variant) => <span key={variant.id} title={`${variant.sku} · ${variant.stock} unidades`} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600"><span className="h-2 w-2 rounded-full border" style={{ backgroundColor: variant.color_hex }} />{variant.size} {variant.color} <b className="text-slate-800">({variant.stock})</b></span>)}
                        </div>
                      </td>
                      <td className={`p-3 text-right text-base font-black ${qty === 0 ? "text-red-600" : "text-amber-600"}`}>{qty} un.</td>
                      <td className="p-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${qty === 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{qty === 0 ? "Agotado" : "Stock bajo"}</span></td>
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => navigate(`/admin/productos?productId=${encodeURIComponent(product.id)}&action=stock`)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 hover:shadow-md whitespace-nowrap">
                          <Plus className="h-3.5 w-3.5" /> Reponer stock
                        </button>
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolución de ventas */}
      <Card className="border-0 shadow-lg shadow-slate-200/60">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-slate-900">Evolución de ventas</CardTitle>
          <CardDescription>
            Ingresos y pedidos pagados por fecha.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {salesTrend.length === 0 ? (
            <p className="text-sm text-brand-secondary py-10 text-center">
              No existen ventas pagadas en este período.
            </p>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickMargin={10}
                  />

                  <YAxis
                    yAxisId="sales"
                    tickFormatter={(value) => `S/ ${value}`}
                    tick={{ fontSize: 11 }}
                  />

                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                  />

                  <Tooltip
                    formatter={(value, name) =>
                      name === "Ventas" ? money(value) : numberFormat(value)
                    }
                  />

                  <Legend />

                  <Line
                    yAxisId="sales"
                    type="monotone"
                    dataKey="sales"
                    name="Ventas"
                    stroke="#D97706"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />

                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    name="Pedidos"
                    stroke="#6366F1"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Productos y categorías */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg shadow-slate-200/60">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-slate-900">Productos más vendidos</CardTitle>
            <CardDescription>
              Ranking por unidades vendidas.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-brand-secondary">
                No hay productos vendidos en este período.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />

                    <XAxis type="number" />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip
                      formatter={(value) => numberFormat(value)}
                    />

                    <Bar
                      dataKey="units"
                      name="Unidades"
                      fill="#D97706"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-slate-200/60">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-slate-900">Ventas por categoría</CardTitle>
            <CardDescription>
              Distribución de ingresos por categoría de producto.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {categorySales.length === 0 ? (
              <p className="text-sm text-brand-secondary">
                No hay categorías con ventas en este período.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySales}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      label={({ name }) => name}
                    >
                      {categorySales.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(value) => money(value)}
                    />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clientes: sección al final */}
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-brand-secondary">
            Inteligencia comercial
          </p>

          <h2 className="text-xl font-black text-brand-primary mt-1">
            Análisis de clientes
          </h2>

          <p className="text-sm text-brand-secondary mt-1">
            Identifica a los clientes más fieles, los de mayor valor y los que
            compran más prendas.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <CustomerRanking
            title="Clientes más frecuentes"
            subtitle="Por cantidad de pedidos"
            icon={Repeat2}
            data={customerRankings.frequent}
            metric={(customer) => `${customer.orders} pedidos`}
          />

          <CustomerRanking
            title="Clientes que más gastan"
            subtitle="Por importe acumulado"
            icon={Crown}
            data={customerRankings.highestSpending}
            metric={(customer) => money(customer.spent)}
          />

          <CustomerRanking
            title="Clientes por volumen"
            subtitle="Por cantidad de prendas"
            icon={Package}
            data={customerRankings.volume}
            metric={(customer) => `${customer.units} unidades`}
          />
        </div>
      </div>


    </div>
  );
}

function ModernKpiCard({ title, value, helper, icon: Icon }) {
  const palette = {
    "Ventas efectivas": { icon: "bg-emerald-100 text-emerald-700", accent: "from-emerald-500 to-teal-500", glow: "shadow-emerald-100" },
    "Pedidos pagados": { icon: "bg-violet-100 text-violet-700", accent: "from-violet-500 to-indigo-500", glow: "shadow-violet-100" },
    "Ticket promedio": { icon: "bg-sky-100 text-sky-700", accent: "from-sky-500 to-blue-500", glow: "shadow-sky-100" },
    "Clientes compradores": { icon: "bg-rose-100 text-rose-700", accent: "from-rose-500 to-pink-500", glow: "shadow-rose-100" },
    "Unidades vendidas": { icon: "bg-amber-100 text-amber-700", accent: "from-amber-500 to-orange-500", glow: "shadow-amber-100" },
    "Variantes agotadas": { icon: "bg-red-100 text-red-700", accent: "from-red-500 to-rose-500", glow: "shadow-red-100" },
    "Clientes recurrentes": { icon: "bg-cyan-100 text-cyan-700", accent: "from-cyan-500 to-teal-500", glow: "shadow-cyan-100" },
  };
  const colors = palette[title] || palette["Pedidos pagados"];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white bg-white p-5 shadow-lg ${colors.glow} transition duration-200 hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${colors.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colors.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CustomerRanking({ title, subtitle, icon: Icon, data, metric }) {
  return (
    <Card className="overflow-hidden border-0 bg-white shadow-lg shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-sky-50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm">
            <Icon className="h-5 w-5 text-violet-700" />
          </div>

          <div>
            <CardTitle className="text-sm font-extrabold text-slate-800">{title}</CardTitle>
            <CardDescription className="text-xs text-slate-500">{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-brand-secondary">
            No hay clientes para este período.
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((customer, index) => (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3 py-2.5 transition hover:border-violet-100 hover:from-violet-50/50 hover:to-white"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-amber-100 text-amber-700" : index === 1 ? "bg-slate-200 text-slate-700" : index === 2 ? "bg-orange-100 text-orange-700" : "bg-violet-100 text-violet-700"}`}>
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {customer.name}
                    </p>

                    <p className="text-[10px] text-brand-secondary truncate">
                      {customer.email || "Cliente registrado"}
                    </p>
                  </div>
                </div>

                <span className="rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-extrabold text-violet-700 whitespace-nowrap">
                  {metric(customer)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}