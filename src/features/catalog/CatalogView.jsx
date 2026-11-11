import { useState, useMemo, useEffect, useRef } from "react";
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
  Sparkles,
  User,
  Users,
  Smile,
  Heart,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import FilterSidebar from "./components/FilterSidebar";
import { useCatalog } from "./hooks/useCatalog";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

const AUDIENCE_CIRCLES = [
  {
    id: "all",
    label: "Todos",
    icon: Sparkles,
    imageUrl:
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    id: "hombre",
    label: "Hombres",
    icon: User,
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&crop=faces&w=200&h=200&q=80",
  },
  {
    id: "mujer",
    label: "Mujeres",
    icon: Users,
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&crop=faces&w=200&h=200&q=80",
  },
  {
    id: "nino",
    label: "Niños",
    icon: Smile,
    imageUrl:
      "https://images.unsplash.com/photo-1499081589563-7c400fcd94e8?auto=format&fit=crop&crop=faces&w=200&h=200&q=80",
  },
  {
    id: "nina",
    label: "Niñas",
    icon: Heart,
    imageUrl:
      "https://images.unsplash.com/photo-1636485426024-aa436369585d?auto=format&fit=crop&crop=faces&w=200&h=200&q=80",
  },
];

function AudienceCircleItem({ tab, isSelected, onClick }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const IconComponent = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 group focus:outline-none select-none shrink-0"
    >
      <div
        className={`relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 ease-out ${
          isSelected
            ? "ring-2 ring-brand-primary ring-offset-2 ring-offset-surface-app shadow-md scale-105"
            : "border border-border hover:border-brand-primary hover:scale-102"
        }`}
      >
        {/* Capa de Icono Vectorial Inicial (0ms / Fallback) */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            isLoaded && !hasError ? "opacity-0 pointer-events-none" : "opacity-100"
          } ${
            isSelected
              ? "bg-brand-primary text-white"
              : "bg-surface-card text-brand-secondary group-hover:text-brand-primary"
          }`}
        >
          <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" />
        </div>

        {/* Capa Fotográfica Editorial con Fade-In Suave */}
        {!hasError && tab.imageUrl && (
          <img
            src={tab.imageUrl}
            alt={tab.label}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover object-center transition-all duration-500 ease-out group-hover:scale-110 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
          />
        )}
      </div>

      <span
        className={`text-xs sm:text-sm transition-colors duration-200 ${
          isSelected
            ? "font-bold text-brand-primary"
            : "font-medium text-brand-secondary group-hover:text-brand-primary"
        }`}
      >
        {tab.label}
      </span>
    </button>
  );
}

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
    onSaleOnly: false,
  });

  // Ordenamiento y paginación
  const [sortBy, setSortBy] = useState("featured");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de filtros móvil
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Reiniciar a página 1 al alterar cualquier filtro u orden
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

      // 6. Solo en promoción
      if (selectedFilters.onSaleOnly && !product.is_on_sale) {
        return false;
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
      onSaleOnly: false,
    });
  };

  const totalActiveFiltersCount =
    (selectedGender !== "all" ? 1 : 0) +
    selectedFilters.categoryIds.length +
    selectedFilters.brandIds.length +
    selectedFilters.materialIds.length +
    (selectedFilters.inStockOnly ? 1 : 0) +
    (selectedFilters.onSaleOnly ? 1 : 0);

  return (
    <div ref={catalogTopRef} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Selector Circular Superior de Público (Estilo iOS y Centrado con Carga Progresiva) */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 w-full py-4 border-b border-border overflow-x-auto scrollbar-none">
        {AUDIENCE_CIRCLES.map((tab) => (
          <AudienceCircleItem
            key={tab.id}
            tab={tab}
            isSelected={selectedGender === tab.id}
            onClick={() => setSelectedGender(tab.id)}
          />
        ))}
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
        <section className="flex-1 min-w-0 w-full space-y-5">
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
            <div className="w-full flex-1 min-w-full py-20 px-4 text-center border border-dashed border-border rounded-card bg-surface-card flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-muted">
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
              <Button onClick={handleResetFilters} size="sm" variant="outline">
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
                    onSelect={(p, color) => {
                      const query = color ? `?color=${encodeURIComponent(color)}` : "";
                      navigate(`/producto/${p.slug}${query}`);
                    }}
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
        </section>
      </div>
    </div>
  );
}
