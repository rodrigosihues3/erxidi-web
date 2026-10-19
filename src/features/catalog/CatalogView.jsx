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
  Users,
  Sparkles,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import FilterSidebar from "./components/FilterSidebar";
import SizeMatcherModal from "./components/SizeMatcherModal";
import { useCatalog } from "./hooks/useCatalog";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

// Opciones de público objetivo para la barra circular superior
const AUDIENCE_PILLS = [
  { id: "all", label: "Todos", icon: Sparkles },
  { id: "hombre", label: "Hombres", icon: Users },
  { id: "mujer", label: "Mujeres", icon: Users },
  { id: "nino", label: "Niños", icon: Users },
  { id: "nina", label: "Niñas", icon: Users },
];

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

  // Dimensión de público objetivo seleccionada (por defecto 'all')
  const [selectedGender, setSelectedGender] = useState("all");

  // Filtros de barra lateral
  const [selectedFilters, setSelectedFilters] = useState({
    categoryIds: [],
    brandIds: [],
    materialIds: [],
    inStockOnly: false,
  });

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [matchedSize, setMatchedSize] = useState(null);
  const navigate = useNavigate();

  // Filtrado facetado desacoplado
  const filteredProducts = useMemo(() => {
    return (products || []).filter((product) => {
      // 1. Filtrado por Público Objetivo (Barra Superior Circular)
      if (selectedGender !== "all") {
        const prodGender = (product.target_gender || "").toLowerCase();
        // Coincidencia exacta o prendas catalogadas como unisex
        if (prodGender !== selectedGender) {
          return false;
        }
      }

      // 2. Filtrado por Prenda / Subcategoría
      if (selectedFilters.categoryIds.length > 0) {
        const prodCatId = product.categories?.id || product.category_id;
        const prodCatParentId = product.categories?.parent_id;

        // Coincide si el producto tiene asignada la categoría directamente o si su categoría padre está seleccionada
        const matchesCategory =
          selectedFilters.categoryIds.includes(prodCatId) ||
          (prodCatParentId && selectedFilters.categoryIds.includes(prodCatParentId));

        if (!matchesCategory) {
          return false;
        }
      }

      // 3. Filtrado por Marca
      if (selectedFilters.brandIds.length > 0) {
        const prodBrandId = product.brands?.id || product.brand_id;
        if (!selectedFilters.brandIds.includes(prodBrandId)) {
          return false;
        }
      }

      // 4. Filtrado por Material
      if (selectedFilters.materialIds.length > 0) {
        const prodMaterialId = product.materials?.id || product.material_id;
        if (!selectedFilters.materialIds.includes(prodMaterialId)) {
          return false;
        }
      }

      // 5. Filtrado por Disponibilidad de Stock
      if (selectedFilters.inStockOnly) {
        const activeVariants = (product.product_variants || []).filter(
          (variant) => variant.is_active !== false
        );
        const hasAvailableStock = activeVariants.some(
          (variant) => (variant.stock || 0) > 0
        );

        if (!hasAvailableStock) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedGender, selectedFilters]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. Encabezado de Catálogo */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-primary tracking-tight">
            Catálogo Oficial
          </h1>
          <p className="text-xs sm:text-sm text-brand-secondary mt-1">
            Prendas de alta rotación confeccionadas con hilatura nacional y acabados reforzados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsSizeMatcherOpen(true)}
            className="text-xs gap-1.5"
          >
            <Ruler className="w-4 h-4 text-accent" />
            <span>Calcular mi talla</span>
            {matchedSize && (
              <Badge variant="success" className="ml-1 text-[10px]">
                {matchedSize}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => setIsMobileFiltersOpen(true)}
            className="lg:hidden text-xs gap-1.5"
          >
            <Filter className="w-4 h-4 text-brand-primary" />
            <span>Filtros</span>
            {totalActiveFiltersCount > 0 && (
              <Badge variant="neutral" className="ml-1 font-mono text-[10px]">
                {totalActiveFiltersCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Selector Circular Superior de Público Objetivo (Estilo Retail) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Filtrar por Público
        </span>

        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-none">
          {AUDIENCE_PILLS.map((pill) => {
            const isSelected = selectedGender === pill.id;
            const Icon = pill.icon;

            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedGender(pill.id)}
                className="flex flex-col items-center gap-2 group flex-shrink-0 focus:outline-none select-none"
              >
                {/* Círculo con indicador perimetral activo */}
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 ${isSelected
                    ? "bg-brand-primary text-white shadow-md ring-4 ring-brand-primary/20 scale-105"
                    : "bg-surface-subtle text-brand-secondary border border-border group-hover:border-brand-primary group-hover:text-brand-primary group-hover:bg-surface-card"
                    }`}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.8]" />
                </div>

                {/* Etiqueta del botón */}
                <span
                  className={`text-xs tracking-tight transition-colors ${isSelected
                    ? "font-bold text-brand-primary"
                    : "font-medium text-brand-secondary group-hover:text-brand-primary"
                    }`}
                >
                  {pill.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Estructura Principal: Sidebar + Grilla de Productos */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-start gap-8">
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

        <main className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between text-xs text-brand-secondary bg-surface-subtle px-4 py-2.5 rounded-card border border-border">
            <span>
              Mostrando{" "}
              <strong className="text-brand-primary font-bold">
                {filteredProducts.length}
              </strong>{" "}
              {filteredProducts.length === 1 ? "prenda" : "prendas"}
            </span>

            {totalActiveFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-accent hover:text-accent-hover font-semibold flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Limpiar todos los filtros
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3 text-brand-muted">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando catálogo oficial...</p>
            </div>
          ) : error ? (
            <div className="py-16 p-6 bg-rose-50 border border-rose-200 rounded-card text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs text-rose-800 font-semibold">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar conexión
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center space-y-4 border border-dashed border-border rounded-card bg-surface-card p-8">
              <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center mx-auto text-brand-muted">
                <PackageOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-brand-primary">
                  No se encontraron prendas coincidentes
                </h3>
                <p className="text-xs text-brand-secondary max-w-sm mx-auto">
                  Prueba seleccionando otro público o modificando los filtros de marcas y prendas.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Restablecer todos los filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={(p) => navigate(`/producto/${p.slug}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal para calcular talla recomendada */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
        onSizeCalculated={(size) => {
          setMatchedSize(size);
          setIsSizeMatcherOpen(false);
        }}
      />
    </div>
  );
}