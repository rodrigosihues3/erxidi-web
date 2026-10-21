import React, { useMemo, useState, useEffect } from "react";
import { X, Filter, RotateCcw, Check, ChevronDown, ChevronRight } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";

export default function FilterSidebar({
  categories = [],
  materials = [],
  brands = [],
  selectedFilters = {
    categoryIds: [],
    brandIds: [],
    materialIds: [],
    inStockOnly: false,
  },
  onFilterChange,
  onResetFilters,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Clasificar categorías raíz (parent_id == null) y subcategorías dependientes
  const { rootCategories, subcategoriesByParent } = useMemo(() => {
    const roots = [];
    const childrenMap = {};

    categories.forEach((cat) => {
      if (cat.parent_id == null) {
        roots.push(cat);
      } else {
        if (!childrenMap[cat.parent_id]) {
          childrenMap[cat.parent_id] = [];
        }
        childrenMap[cat.parent_id].push(cat);
      }
    });

    return { rootCategories: roots, subcategoriesByParent: childrenMap };
  }, [categories]);

  // Contador de filtros activos en la barra lateral
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedFilters?.categoryIds?.length) {
      count += selectedFilters.categoryIds.length;
    }
    if (selectedFilters?.brandIds?.length) {
      count += selectedFilters.brandIds.length;
    }
    if (selectedFilters?.materialIds?.length) {
      count += selectedFilters.materialIds.length;
    }
    if (selectedFilters?.inStockOnly) {
      count += 1;
    }
    return count;
  }, [selectedFilters]);

  // Cierre por tecla ESC en vista móvil
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCloseMobile?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Bloqueo de scroll cuando el drawer móvil está abierto
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const toggleAccordion = (catId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleToggleCategory = (id) => {
    const current = selectedFilters?.categoryIds || [];
    const next = current.includes(id)
      ? current.filter((catId) => catId !== id)
      : [...current, id];
    onFilterChange?.({ ...selectedFilters, categoryIds: next });
  };

  const handleToggleBrand = (id) => {
    const current = selectedFilters?.brandIds || [];
    const next = current.includes(id)
      ? current.filter((bId) => bId !== id)
      : [...current, id];
    onFilterChange?.({ ...selectedFilters, brandIds: next });
  };

  const handleToggleMaterial = (id) => {
    const current = selectedFilters?.materialIds || [];
    const next = current.includes(id)
      ? current.filter((matId) => matId !== id)
      : [...current, id];
    onFilterChange?.({ ...selectedFilters, materialIds: next });
  };

  const handleToggleInStock = () => {
    onFilterChange?.({
      ...selectedFilters,
      inStockOnly: !selectedFilters?.inStockOnly,
    });
  };

  const renderFilterSections = () => (
    <div className="space-y-6">
      {/* 1. Categorías de Prendas y Subcategorías */}
      {rootCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
            Prendas
          </h3>
          <div className="space-y-1.5">
            {rootCategories.map((root) => {
              const children = subcategoriesByParent[root.id] || [];
              const hasChildren = children.length > 0;
              const isChecked = selectedFilters?.categoryIds?.includes(root.id);
              const isExpanded = Boolean(expandedCategories[root.id]);

              return (
                <div key={root.id} className="space-y-1">
                  <div className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-button hover:bg-surface-subtle transition-colors group">
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isChecked
                          ? "bg-brand-primary border-brand-primary text-white"
                          : "border-border bg-surface-card group-hover:border-border-strong"
                          }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        onChange={() => handleToggleCategory(root.id)}
                      />
                      <span
                        className={`text-sm ${isChecked
                          ? "font-semibold text-brand-primary"
                          : "text-brand-secondary group-hover:text-brand-primary"
                          }`}
                      >
                        {root.name}
                      </span>
                    </label>

                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => toggleAccordion(root.id)}
                        className="p-1 text-brand-secondary hover:text-brand-primary transition-transform"
                        title={isExpanded ? "Ocultar subtipos" : "Ver subtipos"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {hasChildren && isExpanded && (
                    <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-border ml-2 bg-surface-subtle/40 rounded-r">
                      {children.map((sub) => {
                        const isSubChecked = selectedFilters?.categoryIds?.includes(sub.id);
                        return (
                          <label
                            key={sub.id}
                            className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-surface-subtle transition-colors select-none"
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${isSubChecked
                                ? "bg-brand-primary border-brand-primary text-white"
                                : "border-border bg-surface-card"
                                }`}
                            >
                              {isSubChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={isSubChecked}
                              onChange={() => handleToggleCategory(sub.id)}
                            />
                            <span
                              className={`text-xs ${isSubChecked
                                ? "font-semibold text-brand-primary"
                                : "text-brand-secondary"
                                }`}
                            >
                              {sub.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Marcas */}
      {brands.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
            Marcas
          </h3>
          <div className="space-y-1.5">
            {brands.map((b) => {
              const isChecked = selectedFilters?.brandIds?.includes(b.id);
              return (
                <label
                  key={b.id}
                  className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-button cursor-pointer hover:bg-surface-subtle transition-colors group select-none"
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isChecked
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "border-border bg-surface-card group-hover:border-border-strong"
                      }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => handleToggleBrand(b.id)}
                  />
                  <span
                    className={`text-sm ${isChecked
                      ? "font-semibold text-brand-primary"
                      : "text-brand-secondary group-hover:text-brand-primary"
                      }`}
                  >
                    {b.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Materiales */}
      {materials.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
            Materiales
          </h3>
          <div className="space-y-1.5">
            {materials.map((mat) => {
              const isChecked = selectedFilters?.materialIds?.includes(mat.id);
              return (
                <label
                  key={mat.id}
                  className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-button cursor-pointer hover:bg-surface-subtle transition-colors group select-none"
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isChecked
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "border-border bg-surface-card group-hover:border-border-strong"
                      }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => handleToggleMaterial(mat.id)}
                  />
                  <span
                    className={`text-sm ${isChecked
                      ? "font-semibold text-brand-primary"
                      : "text-brand-secondary group-hover:text-brand-primary"
                      }`}
                  >
                    {mat.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Disponibilidad en Stock */}
      <div className="pt-4 border-t border-border">
        <label className="flex items-center justify-between py-1 cursor-pointer select-none group">
          <div className="space-y-0.5 pr-2">
            <span className="text-sm font-semibold text-brand-primary block">
              Solo en stock
            </span>
            <span className="text-xs text-brand-secondary block">
              Ocultar productos agotados
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(selectedFilters?.inStockOnly)}
            onClick={handleToggleInStock}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedFilters?.inStockOnly ? "bg-brand-primary" : "bg-border"
              }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${selectedFilters?.inStockOnly ? "translate-x-4" : "translate-x-0"
                }`}
            />
          </button>
        </label>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="bg-surface-card border border-border rounded-card p-5 space-y-5 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-primary" />
              <h2 className="text-sm font-bold text-brand-primary">Filtros</h2>
              {activeFiltersCount > 0 && (
                <Badge variant="neutral" className="font-mono text-[11px] px-1.5 py-0">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={activeFiltersCount === 0}
              onClick={onResetFilters}
              className="text-xs px-2 h-7"
              title="Restablecer filtros"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Limpiar
            </Button>
          </div>

          {renderFilterSections()}
        </div>
      </aside>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Panel de filtros"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-xs bg-surface-card border-r border-border shadow-dropdown flex flex-col h-full animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                <h2 className="text-base font-bold text-brand-primary">Filtros</h2>
                {activeFiltersCount > 0 && (
                  <Badge variant="neutral" className="font-mono text-xs px-2 py-0.5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors"
                aria-label="Cerrar filtros"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">{renderFilterSections()}</div>

            <div className="p-4 border-t border-border flex items-center gap-2 bg-surface-subtle">
              <Button
                variant="outline"
                size="md"
                disabled={activeFiltersCount === 0}
                onClick={onResetFilters}
                className="flex-1 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Limpiar ({activeFiltersCount})
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={onCloseMobile}
                className="flex-1 text-xs"
              >
                Ver resultados
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}