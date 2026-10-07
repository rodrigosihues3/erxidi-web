import { useNavigate } from "react-router-dom";
import React, { useState, useMemo } from "react";
import {
  Filter,
  Ruler,
  PackageOpen,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import FilterSidebar from "./components/FilterSidebar";
import SizeMatcherModal from "./components/SizeMatcherModal";
import { useCatalog } from "./hooks/useCatalog";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

export default function CatalogView() {
  const {
    products,
    categories,
    materials,
    loading,
    error,
    refetch,
  } = useCatalog();

  const [selectedFilters, setSelectedFilters] = useState({
    categoryIds: [],
    materialIds: [],
    inStockOnly: false,
  });

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [matchedSize, setMatchedSize] = useState(null);
  const navigate = useNavigate();

  // Faceted filtering logic
  const filteredProducts = useMemo(() => {
    return (products || []).filter((product) => {
      // 1. Filter by category
      if (
        selectedFilters.categoryIds.length > 0 &&
        !selectedFilters.categoryIds.includes(product.categories?.id)
      ) {
        return false;
      }

      // 2. Filter by material
      if (
        selectedFilters.materialIds.length > 0 &&
        !selectedFilters.materialIds.includes(product.materials?.id)
      ) {
        return false;
      }

      // 3. Filter by stock availability
      if (selectedFilters.inStockOnly) {
        const activeVariants = (product.product_variants || []).filter(
          (variant) => variant.is_active !== false,
        );
        const hasAvailableStock = activeVariants.some(
          (variant) => (variant.stock || 0) > 0,
        );

        if (!hasAvailableStock) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedFilters]);

  const handleResetFilters = () => {
    setSelectedFilters({
      categoryIds: [],
      materialIds: [],
      inStockOnly: false,
    });
  };

  const activeFiltersCount =
    selectedFilters.categoryIds.length +
    selectedFilters.materialIds.length +
    (selectedFilters.inStockOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-surface-app py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-brand-primary">
                Catálogo
              </h1>
              <Badge variant="neutral" className="font-mono text-xs">
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "prenda" : "prendas"}
              </Badge>
            </div>
            <p className="text-xs text-brand-secondary mt-1">
              Prendas íntimas masculinas elaboradas con los más finos tejidos y
              precisión anatómica.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Mobile Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <Filter className="w-4 h-4 mr-1.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-brand-primary text-white rounded-full text-[10px] font-mono">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Size Matcher Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSizeMatcherOpen(true)}
            >
              <Ruler className="w-4 h-4 mr-1.5 text-accent" />
              Calculador de Talla
            </Button>

            {matchedSize && (
              <Badge variant="success" className="text-xs py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Talla sugerida: {matchedSize}
              </Badge>
            )}
          </div>
        </header>

        {/* Main Catalog Layout */}
        <div className="flex gap-8 items-start">
          {/* Faceted Filter Sidebar */}
          <FilterSidebar
            categories={categories}
            materials={materials}
            selectedFilters={selectedFilters}
            onFilterChange={setSelectedFilters}
            onResetFilters={handleResetFilters}
            isMobileOpen={isMobileFiltersOpen}
            onCloseMobile={() => setIsMobileFiltersOpen(false)}
          />

          {/* Catalog Grid Area */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-surface-card border border-border rounded-card space-y-3 min-h-[360px]">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs font-semibold text-brand-secondary">
                  Cargando catálogo...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-card border border-rose-500/30 rounded-card space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-brand-primary">
                    No se pudo cargar el catálogo
                  </h3>
                  <p className="text-xs text-brand-secondary max-w-sm">
                    {error}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reintentar
                </Button>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(p) => {
                      // Handled purely via callback
                      navigate(`/producto/${p.slug}`);
                    }}
                    onQuickAdd={(p) => {
                      // Handled purely via callback
                      navigate(`/producto/${p.slug}`);
                    }}
                  />
                ))}
              </div>
            ) : (
              /* Sober Empty State */
              <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-card border border-border rounded-card space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-secondary">
                  <PackageOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-brand-primary">
                    No se encontraron prendas
                  </h3>
                  <p className="text-xs text-brand-secondary max-w-sm">
                    No hay productos que coincidan con los filtros
                    seleccionados. Intenta ajustando las categorías, materiales
                    o disponibilidad.
                  </p>
                </div>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Limpiar todos los filtros
                  </Button>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Interactive Size Matcher Modal */}
        <SizeMatcherModal
          isOpen={isSizeMatcherOpen}
          onClose={() => setIsSizeMatcherOpen(false)}
          onSizeSelected={(sizeName) => setMatchedSize(sizeName)}
        />
      </div>
    </div>
  );
}
