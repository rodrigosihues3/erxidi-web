import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Plus,
  Search,
  Power,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
  Archive,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { useAdminProducts } from "../hooks/useAdminProducts";
import { setProductActive } from "../services/adminProducts.service";
import { listCategories } from "../services/adminCategories.service";

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value || 0));
}

function calculateProductStock(product) {
  return (product.product_variants || [])
    .filter((v) => v.is_active !== false)
    .reduce((sum, v) => sum + Number(v.stock || 0), 0);
}

export default function ProductsListView() {
  const navigate = useNavigate();

  // Consulta global de productos y categorías maestras
  const { data = [], loading, error, refetch, reload: reloadProducts, } = useAdminProducts({});
  const [categories, setCategories] = useState([]);

  // Estados de filtros y vista
  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockPreset, setStockPreset] = useState("all");
  const [manualMaxStock, setManualMaxStock] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'
  const [showWarnings, setShowWarnings] = useState(true);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let active = true;
    listCategories()
      .then((cats) => {
        if (active) setCategories(cats || []);
      })
      .catch((err) => console.error("Error al cargar categorías:", err));
    return () => {
      active = false;
    };
  }, []);

  // Desactivar / Activar prenda
  async function toggle(product) {
    const action = product.is_active ? "desactivar" : "activar";
    if (!window.confirm(`¿Deseas ${action} la prenda "${product.name}"?`)) return;
    try {
      await setProductActive(product.id, !product.is_active);

      // Ejecuta la función de recarga disponible en el hook
      if (typeof refetch === "function") {
        await refetch();
      } else if (typeof reloadProducts === "function") {
        await reloadProducts();
      } else {
        // Fallback si el hook no expone recarga: recarga la vista
        window.location.reload();
      }
    } catch (err) {
      window.alert(err.message || "No se pudo actualizar el estado del producto.");
    }
  }

  // Identificar prendas activas con inventario bajo (< 20 unidades)
  const lowStockWarnings = useMemo(() => {
    return data
      .filter((p) => p.is_active)
      .map((p) => ({ product: p, stock: calculateProductStock(p) }))
      .filter((item) => item.stock < 20)
      .sort((a, b) => a.stock - b.stock);
  }, [data]);

  // Conteos reactivos por público objetivo
  const genderCounts = useMemo(() => {
    return {
      all: data.length,
      hombre: data.filter((p) => (p.target_gender || "").toLowerCase() === "hombre").length,
      mujer: data.filter((p) => (p.target_gender || "").toLowerCase() === "mujer").length,
      nino: data.filter((p) => (p.target_gender || "").toLowerCase() === "nino").length,
      nina: data.filter((p) => (p.target_gender || "").toLowerCase() === "nina").length,
    };
  }, [data]);

  // Mapeo jerárquico de categorías (Padre -> Hijos)
  const categoryOptions = useMemo(() => {
    const roots = categories.filter((c) => c.parent_id == null);
    const options = [];
    roots.forEach((root) => {
      options.push({ id: root.id, name: root.name, isChild: false });
      const children = categories.filter((c) => c.parent_id === root.id);
      children.forEach((child) => {
        options.push({ id: child.id, name: `— ${child.name}`, isChild: true });
      });
    });
    return options.length > 0 ? options : categories;
  }, [categories]);

  // Algoritmo de filtrado facetado
  const filteredProducts = useMemo(() => {
    return data.filter((product) => {
      const stock = calculateProductStock(product);

      // 1. Filtro por Público Objetivo
      if (selectedGender !== "all") {
        const prodGender = (product.target_gender || "").toLowerCase();
        if (prodGender !== selectedGender) return false;
      }

      // 2. Filtro por Búsqueda
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = product.name?.toLowerCase().includes(query);
        const matchesSlug = product.slug?.toLowerCase().includes(query);
        const matchesMaterial = product.materials?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesSlug && !matchesMaterial) return false;
      }

      // 3. Filtro por Prenda con Herencia Jerárquica
      if (selectedCategory) {
        const catId = Number(selectedCategory);
        const prodCatId = product.categories?.id || product.category_id;
        const prodCatParentId = product.categories?.parent_id;

        // Comprobar si la categoría seleccionada tiene subcategorías hijas
        const childCategoryIds = categories
          .filter((c) => c.parent_id === catId)
          .map((c) => c.id);

        if (childCategoryIds.length > 0) {
          // Categoría padre seleccionada: Coincide si el producto está en la categoría o en cualquiera de sus hijas
          const matchesParentOrChild =
            prodCatId === catId ||
            childCategoryIds.includes(prodCatId) ||
            prodCatParentId === catId;
          if (!matchesParentOrChild) return false;
        } else {
          // Subcategoría específica seleccionada
          if (prodCatId !== catId) return false;
        }
      }

      // 4. Filtro por Stock Máximo (stock <= límite)
      const effectiveMaxStock =
        manualMaxStock !== ""
          ? Number(manualMaxStock)
          : stockPreset !== "all"
            ? Number(stockPreset)
            : null;

      if (effectiveMaxStock !== null && !isNaN(effectiveMaxStock)) {
        if (stock > effectiveMaxStock) return false;
      }

      return true;
    });
  }, [data, selectedGender, search, selectedCategory, stockPreset, manualMaxStock, categories]);

  // Paginación sobre resultados filtrados
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const handleGenderChange = (gender) => {
    setSelectedGender(gender);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. Encabezado Depurado */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h1 className="text-2xl font-black text-brand-primary tracking-tight">
          Inventario de Productos
        </h1>
        <Button size="sm" onClick={() => navigate("/admin/productos/nuevo")}>
          <Plus className="h-4 w-4 mr-1.5" /> Agregar nuevo producto
        </Button>
      </div>

      {/* 2. Módulo de Alertas de Stock Crítico (< 20 prendas) */}
      {lowStockWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>
                Alertas de Stock Crítico ({lowStockWarnings.length}{" "}
                {lowStockWarnings.length === 1 ? "prenda requiere" : "prendas requieren"}{" "}
                atención)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowWarnings(!showWarnings)}
              className="text-xs text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1"
            >
              {showWarnings ? "Ocultar panel" : "Ver alertas"}
              {showWarnings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {showWarnings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {lowStockWarnings.map(({ product, stock }) => {
                // Color progresivo según nivel de criticidad
                const isOutOfStock = stock === 0;
                const isVeryLow = stock > 0 && stock <= 5;

                const cardBg = isOutOfStock
                  ? "bg-rose-50 border-rose-300 text-rose-900"
                  : isVeryLow
                    ? "bg-orange-50 border-orange-300 text-orange-900"
                    : "bg-amber-50 border-amber-300 text-amber-900";

                const badgeBg = isOutOfStock
                  ? "bg-rose-600 text-white"
                  : isVeryLow
                    ? "bg-orange-600 text-white"
                    : "bg-amber-600 text-white";

                return (
                  <div
                    key={product.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs shadow-sm ${cardBg}`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">{product.name}</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-black px-1.5 py-0.2 rounded ${badgeBg}`}>
                        {isOutOfStock ? "Agotado (0 un.)" : `${stock} un. restantes`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/productos/${product.id}/editar`)}
                        className="px-2 py-1 rounded bg-white/80 hover:bg-white text-slate-700 font-semibold text-[11px] border border-black/10 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(product)}
                        title="Desactivar y descontinuar para apagar esta alarma"
                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition-colors"
                      >
                        Descontinuar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Pestañas de Audiencia Alineadas a la Derecha */}
      <div className="flex justify-end border-b border-border pb-px overflow-x-auto">
        <div className="flex items-center gap-2">
          {[
            { id: "all", label: "Todos", count: genderCounts.all },
            { id: "hombre", label: "Hombres", count: genderCounts.hombre },
            { id: "mujer", label: "Mujeres", count: genderCounts.mujer },
            { id: "nino", label: "Niños", count: genderCounts.nino },
            { id: "nina", label: "Niñas", count: genderCounts.nina },
          ].map((tab) => {
            const isSelected = selectedGender === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleGenderChange(tab.id)}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${isSelected
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-secondary hover:text-brand-primary"
                  }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Barra de Controles: Búsqueda, Prenda, Stock Dinámico y Selector de Vista */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Buscador */}
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-brand-muted" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, slug o tela..."
              className="pl-9 h-10 text-xs"
            />
          </div>

          {/* Filtro de Categoría con Herencia */}
          <div className="lg:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-surface-subtle border border-border rounded-button text-brand-primary focus:outline-none"
            >
              <option value="">Todas las prendas</option>
              {categoryOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Stock Máximo */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <select
              value={stockPreset}
              onChange={(e) => {
                setStockPreset(e.target.value);
                setManualMaxStock("");
                setCurrentPage(1);
              }}
              className="w-1/2 h-10 px-2 text-xs bg-surface-subtle border border-border rounded-button text-brand-primary focus:outline-none"
            >
              <option value="all">Stock: Todo</option>
              <option value="10">Stock ≤ 10</option>
              <option value="20">Stock ≤ 20</option>
              <option value="50">Stock ≤ 50</option>
              <option value="100">Stock ≤ 100</option>
            </select>

            <Input
              type="number"
              min="0"
              placeholder="≤ Manual"
              value={manualMaxStock}
              onChange={(e) => {
                setManualMaxStock(e.target.value);
                setStockPreset("all");
                setCurrentPage(1);
              }}
              className="w-1/2 h-10 text-xs text-center"
            />
          </div>

          {/* Toggle de Modo de Vista */}
          <div className="lg:col-span-2 flex justify-end items-center gap-1">
            <div className="inline-flex rounded-button border border-border bg-surface-subtle p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === "cards" ? "bg-white text-brand-primary shadow-sm" : "text-brand-muted hover:text-brand-primary"
                  }`}
                title="Vista en tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === "table" ? "bg-white text-brand-primary shadow-sm" : "text-brand-muted hover:text-brand-primary"
                  }`}
                title="Vista en tabla"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Contenido Principal */}
      {error ? (
        <Card className="p-6 text-sm text-status-danger-text">{error.message}</Card>
      ) : loading ? (
        <Card className="p-8 text-center text-sm text-brand-secondary">
          Sincronizando inventario de prendas...
        </Card>
      ) : paginatedProducts.length === 0 ? (
        <Card className="p-12 text-center text-sm text-brand-secondary space-y-2">
          <Archive className="h-8 w-8 text-brand-muted mx-auto stroke-[1.5]" />
          <p className="font-semibold text-brand-primary">No se encontraron productos coincidentes.</p>
          <p className="text-xs text-brand-muted">Prueba modificando los filtros de categoría o el umbral de stock.</p>
        </Card>
      ) : viewMode === "cards" ? (
        /* VISTA EN TARJETAS CON FONDO CROMÁTICO DIFERENCIADO */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedProducts.map((product) => {
            const stock = calculateProductStock(product);
            const isInactive = !product.is_active;

            return (
              <div
                key={product.id}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${isInactive
                  ? "bg-slate-200/80 border-slate-300 text-slate-500 shadow-none"
                  : "bg-white border-border text-brand-primary shadow-sm hover:border-border-strong"
                  }`}
              >
                <div>
                  {/* Fotografía principal */}
                  <div
                    className={`relative w-full h-40 rounded-lg overflow-hidden mb-3 border ${isInactive ? "border-slate-300 bg-slate-300" : "border-border bg-surface-subtle"
                      }`}
                  >
                    {product.main_image_url ? (
                      <img
                        src={product.main_image_url}
                        alt={product.name}
                        className={`w-full h-full object-cover ${isInactive ? "grayscale opacity-50" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-brand-muted">
                        Sin foto
                      </div>
                    )}
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/90 text-slate-800 shadow-sm">
                      {product.target_gender || "unisex"}
                    </span>
                  </div>

                  {/* Metadatos */}
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-muted font-semibold mb-1">
                    <span>{product.brands?.name || "ERXIDI"}</span>
                    <span>•</span>
                    <span className="font-bold text-brand-secondary">{product.categories?.name || "Sin prenda"}</span>
                  </div>

                  <h3 className={`text-xs font-bold leading-snug line-clamp-2 ${isInactive ? "text-slate-600 line-through" : "text-brand-primary"}`}>
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-brand-muted mt-1 truncate">
                    {product.materials?.name || "Sin material"}
                  </p>
                </div>

                {/* Pie de Card: Precio, Stock y Acciones */}
                <div className="mt-4 pt-3 border-t border-black/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-sm text-brand-primary">
                      {money(product.price)}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${stock === 0
                        ? "text-rose-700 bg-rose-100 px-2 py-0.5 rounded"
                        : stock < 20
                          ? "text-orange-700 bg-orange-100 px-2 py-0.5 rounded"
                          : "text-brand-secondary"
                        }`}
                    >
                      Stock: <strong>{stock}</strong> un.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/productos/${product.id}/editar`)}
                      className="flex-1 text-xs h-8"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(product)}
                      className={`h-8 px-2.5 text-xs ${product.is_active ? "text-rose-600 hover:bg-rose-50" : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      title={product.is_active ? "Desactivar prenda" : "Activar prenda"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA EN TABLA DE ALTA DENSIDAD */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs text-left">
              <thead className="bg-surface-subtle border-b border-border text-brand-secondary uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Prenda</th>
                  <th className="p-3">Audiencia</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 font-mono">Precio</th>
                  <th className="p-3 text-center">Stock Físico</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map((product) => {
                  const stock = calculateProductStock(product);
                  const isInactive = !product.is_active;

                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${isInactive ? "bg-slate-100/70 text-slate-400" : "hover:bg-surface-subtle"}`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded overflow-hidden bg-surface-subtle flex-shrink-0 border border-border">
                            {product.main_image_url && (
                              <img
                                src={product.main_image_url}
                                alt={product.name}
                                className={`w-full h-full object-cover ${isInactive ? "grayscale opacity-50" : ""}`}
                              />
                            )}
                          </div>
                          <div>
                            <p className={`font-bold ${isInactive ? "line-through text-slate-500" : "text-brand-primary"}`}>
                              {product.name}
                            </p>
                            <p className="font-mono text-[10px] text-brand-muted">{product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 uppercase text-[10px] font-semibold text-brand-secondary">
                        {product.target_gender}
                      </td>
                      <td className="p-3 text-brand-secondary">{product.categories?.name || "—"}</td>
                      <td className="p-3 text-brand-muted">{product.materials?.name || "—"}</td>
                      <td className="p-3 font-mono font-bold text-brand-primary">{money(product.price)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-mono font-bold ${stock === 0 ? "text-rose-600" : stock < 20 ? "text-orange-600" : "text-brand-primary"
                            }`}
                        >
                          {stock}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/productos/${product.id}/editar`)}
                            className="h-7 text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggle(product)}
                            className={`h-7 px-2 text-xs ${product.is_active ? "text-rose-600 hover:bg-rose-50" : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. Barra de Paginación */}
      {filteredProducts.length > 0 && (
        <Card className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-secondary">
          <span>
            Mostrando{" "}
            <strong className="text-brand-primary font-bold">
              {Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)}
            </strong>{" "}
            -{" "}
            <strong className="text-brand-primary font-bold">
              {Math.min(currentPage * pageSize, filteredProducts.length)}
            </strong>{" "}
            de{" "}
            <strong className="text-brand-primary font-bold">
              {filteredProducts.length}
            </strong>{" "}
            prendas
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-border text-xs font-semibold disabled:opacity-40 hover:bg-surface-subtle"
            >
              Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${page === currentPage
                  ? "bg-brand-primary text-white"
                  : "border border-border text-brand-primary hover:bg-surface-subtle"
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-border text-xs font-semibold disabled:opacity-40 hover:bg-surface-subtle"
            >
              Siguiente
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}