import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Filter,
  PackageOpen,
  RotateCcw,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import FilterSidebar from "./components/FilterSidebar";
import QuickAddModal from "./components/QuickAddModal";
import { useCatalog } from "./hooks/useCatalog";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

const AUDIENCE_TABS = [
  { id: "all", label: "Todos" },
  { id: "hombre", label: "Hombres" },
  { id: "mujer", label: "Mujeres" },
  { id: "nino", label: "Niños" },
  { id: "nina", label: "Niñas" },
];

const SORT_OPTIONS = [
  { id: "featured", label: "Destacados" },
  { id: "price_asc", label: "Precio: menor a mayor" },
  { id: "price_desc", label: "Precio: mayor a menor" },
  { id: "newest", label: "Novedades" },
  { id: "name_asc", label: "Nombre: A - Z" },
];

const ITEMS_PER_PAGE = 12;

export default function CatalogView() {
  const {
    products,
    categories,
    materials,
    brands,
    loading,
    error,
    refetch,
  } = useCatalog();

  const navigate = useNavigate();
  const catalogTopRef = useRef(null);

  // Estados de filtrado
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedFilters, setSelectedFilters] = useState({
    categoryIds: [],
    brandIds: [],
    materialIds: [],
    inStockOnly: false,
  });

  // Ordenamiento y paginación
  const [sortBy, setSortBy] = useState("featured");
  const [currentPage, setCurrentPage] = useState(1);

  // Modales
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [quickAddConfig, setQuickAddConfig] = useState(null); // { product, initialColor }

  // Reiniciar a página 1 al alterar cualquier filtro u orden
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGender, selectedFilters, sortBy]);

  // Filtrado facetado
  const filteredProducts = useMemo(() => {
    return (products || []).filter((product) => {
      // 1. Público objetivo
      if (selectedGender !== "all") {
        const prodGender = (product.target_gender || "").toLowerCase();
        if (prodGender !== selectedGender && prodGender !== "unisex") {
          return false;
        }
      }

      // 2. Prenda / Categoría
      if (selectedFilters.categoryIds.length > 0) {
        const prodCatId = product.categories?.id || product.category_id;
        const prodCatParentId = product.categories?.parent_id;
        const matchesCategory =
          selectedFilters.categoryIds.includes(prodCatId) ||
          (prodCatParentId && selectedFilters.categoryIds.includes(prodCatParentId));

        if (!matchesCategory) return false;
      }

      // 3. Marca
      if (selectedFilters.brandIds.length > 0) {
        const prodBrandId = product.brands?.id || product.brand_id;
        if (!selectedFilters.brandIds.includes(prodBrandId)) return false;
      }

      // 4. Material
      if (selectedFilters.materialIds.length > 0) {
        const prodMaterialId = product.materials?.id || product.material_id;
        if (!selectedFilters.materialIds.includes(prodMaterialId)) return false;
      }

      // 5. Solo en stock
      if (selectedFilters.inStockOnly) {
        const hasStock = (product.product_variants || []).some(
          (v) => v.is_active !== false && Number(v.stock) > 0
        );
        if (!hasStock) return false;
      }

      return true;
    });
  }, [products, selectedGender, selectedFilters]);

  // Ordenamiento en memoria
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case "price_asc":
        return list.sort((a, b) => Number(a.price) - Number(b.price));
      case "price_desc":
        return list.sort((a, b) => Number(b.price) - Number(a.price));
      case "newest":
        return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case "name_asc":
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "featured":
      default:
        return list.sort((a, b) => {
          if (a.is_featured === b.is_featured) {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          return a.is_featured ? -1 : 1;
        });
    }
  }, [filteredProducts, sortBy]);

  // Paginación
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedProducts, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (catalogTopRef.current) {
        catalogTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedGender("all");
    setSelectedFilters({
      categoryIds: [],
      brandIds: [],
      materialIds: [],
      inStockOnly: false,
    });
  };

  const totalActiveFiltersCount =
    (selectedGender !== "all" ? 1 : 0) +
    selectedFilters.categoryIds.length +
    selectedFilters.brandIds.length +
    selectedFilters.materialIds.length +
    (selectedFilters.inStockOnly ? 1 : 0);

  return (
    <div ref={catalogTopRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Selector Superior de Público (Pestañas Planas Sobrias) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
        {AUDIENCE_TABS.map((tab) => {
          const isSelected = selectedGender === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedGender(tab.id)}
              className={`px-4 py-2 rounded-button text-xs font-bold transition-all shrink-0 select-none ${
                isSelected
                  ? "bg-brand-primary text-white shadow-xs"
                  : "bg-surface-subtle text-brand-secondary hover:text-brand-primary hover:bg-surface-card border border-border"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Estructura Principal: Sidebar + Grilla */}
      <div className="flex items-start gap-8 w-full">
        <FilterSidebar
          categories={categories}
          materials={materials}
          brands={brands}
          selectedFilters={selectedFilters}
          onFilterChange={setSelectedFilters}
          onResetFilters={handleResetFilters}
          isMobileOpen={isMobileFiltersOpen}
          onCloseMobile={() => setIsMobileFiltersOpen(false)}
        />

        {/* Contenedor Principal Garantizado a Ancho Completo */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Barra de Control de Resultados */}
          <div className="flex items-center justify-between gap-3 bg-surface-subtle border border-border px-4 py-2.5 rounded-card text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-brand-primary">
                {filteredProducts.length}{" "}
                <span className="font-normal text-brand-secondary">
                  {filteredProducts.length === 1 ? "producto" : "productos"}
                </span>
              </span>

              {totalActiveFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline ml-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Botón Filtros Móvil */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="lg:hidden h-8 text-xs gap-1.5 px-2.5"
              >
                <Filter className="w-3.5 h-3.5 text-brand-primary" />
                <span>Filtros</span>
                {totalActiveFiltersCount > 0 && (
                  <Badge className="ml-0.5 font-mono text-[10px] px-1 py-0" variant="neutral">
                    {totalActiveFiltersCount}
                  </Badge>
                )}
              </Button>

              {/* Selector de Orden */}
              <div className="flex items-center gap-1.5 bg-surface-card border border-border rounded-button px-2.5 h-8">
                <ArrowUpDown className="w-3 h-3 text-brand-muted shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-brand-primary focus:outline-none cursor-pointer pr-1"
                  aria-label="Ordenar productos"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Estados de Carga, Error y Resultados */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3 text-brand-muted">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando catálogo...</p>
            </div>
          ) : error ? (
            <div className="w-full py-16 p-6 bg-rose-50 border border-rose-200 rounded-card text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs text-rose-800 font-semibold">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar conexión
              </Button>
            </div>
          ) : sortedProducts.length === 0 ? (
            /* Estado Vacío a Ancho Completo */
            <div className="w-full py-20 text-center space-y-4 border border-dashed border-border rounded-card bg-surface-card p-8">
              <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center mx-auto text-brand-muted">
                <PackageOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-brand-primary">
                  No se encontraron prendas coincidentes
                </h3>
                <p className="text-xs text-brand-secondary max-w-sm mx-auto">
                  Prueba seleccionando otro público o restableciendo los filtros laterales.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Restablecer todos los filtros
              </Button>
            </div>
          ) : (
            <>
              {/* Grilla Responsiva: 2 Columnas Móvil / 3 Columnas Desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(p) => navigate(`/producto/${p.slug}`)}
                    onQuickAdd={(p, color) => setQuickAddConfig({ product: p, initialColor: color })}
                  />
                ))}
              </div>

              {/* 3. Paginación Inferior */}
              {totalPages > 1 && (
                <div className="pt-8 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-brand-secondary font-mono">
                    Página {currentPage} de {totalPages}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="h-8 px-2.5 text-xs"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4 mr-0.5" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                        // Limitar botones mostrados en paginaciones largas
                        if (
                          totalPages > 6 &&
                          page !== 1 &&
                          page !== totalPages &&
                          Math.abs(page - currentPage) > 1
                        ) {
                          if (Math.abs(page - currentPage) === 2) {
                            return (
                              <span key={page} className="px-1 text-xs text-brand-muted select-none">
                                ...
                              </span>
                            );
                          }
                          return null;
                        }

                        const isCurrent = currentPage === page;
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => handlePageChange(page)}
                            className={`w-8 h-8 rounded-button text-xs font-mono font-bold transition-colors select-none ${
                              isCurrent
                                ? "bg-brand-primary text-white shadow-xs"
                                : "bg-surface-card border border-border text-brand-secondary hover:border-brand-primary hover:text-brand-primary"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="h-8 px-2.5 text-xs"
                      aria-label="Página siguiente"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4 ml-0.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Quick-Add Modal */}
      <QuickAddModal
        product={quickAddConfig?.product}
        initialColor={quickAddConfig?.initialColor}
        isOpen={Boolean(quickAddConfig)}
        onClose={() => setQuickAddConfig(null)}
      />
    </div>
  );
}
