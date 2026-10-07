import React, { useMemo, useEffect } from 'react';
import { X, Filter, RotateCcw, Check } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

export default function FilterSidebar({
  categories = [],
  materials = [],
  selectedFilters = {
    categoryIds: [],
    materialIds: [],
    inStockOnly: false,
    minPrice: null,
    maxPrice: null,
  },
  onFilterChange,
  onResetFilters,
  isMobileOpen = false,
  onCloseMobile,
}) {
  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedFilters?.categoryIds?.length) {
      count += selectedFilters.categoryIds.length;
    }
    if (selectedFilters?.materialIds?.length) {
      count += selectedFilters.materialIds.length;
    }
    if (selectedFilters?.inStockOnly) {
      count += 1;
    }
    if (selectedFilters?.minPrice !== null && selectedFilters?.minPrice !== undefined) {
      count += 1;
    }
    if (selectedFilters?.maxPrice !== null && selectedFilters?.maxPrice !== undefined) {
      count += 1;
    }
    return count;
  }, [selectedFilters]);

  // Handle ESC key for mobile drawer
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const handleToggleCategory = (id) => {
    const current = selectedFilters?.categoryIds || [];
    const next = current.includes(id)
      ? current.filter((catId) => catId !== id)
      : [...current, id];
    onFilterChange?.({
      ...selectedFilters,
      categoryIds: next,
    });
  };

  const handleToggleMaterial = (id) => {
    const current = selectedFilters?.materialIds || [];
    const next = current.includes(id)
      ? current.filter((matId) => matId !== id)
      : [...current, id];
    onFilterChange?.({
      ...selectedFilters,
      materialIds: next,
    });
  };

  const handleToggleInStock = () => {
    onFilterChange?.({
      ...selectedFilters,
      inStockOnly: !selectedFilters?.inStockOnly,
    });
  };

  // Reusable filter controls content
  const renderFilterSections = () => (
    <div className="space-y-6">
      {/* Categories Block */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
            Categorías
          </h3>
          <div className="space-y-1.5">
            {categories.map((cat) => {
              const isChecked = selectedFilters?.categoryIds?.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-button cursor-pointer hover:bg-surface-subtle transition-colors group select-none"
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'border-border bg-surface-card group-hover:border-border-strong'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => handleToggleCategory(cat.id)}
                  />
                  <span
                    className={`text-sm ${
                      isChecked
                        ? 'font-semibold text-brand-primary'
                        : 'text-brand-secondary group-hover:text-brand-primary'
                    }`}
                  >
                    {cat.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials Block */}
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
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'border-border bg-surface-card group-hover:border-border-strong'
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
                    className={`text-sm ${
                      isChecked
                        ? 'font-semibold text-brand-primary'
                        : 'text-brand-secondary group-hover:text-brand-primary'
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

      {/* Stock Availability Toggle */}
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
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              selectedFilters?.inStockOnly ? 'bg-brand-primary' : 'bg-border'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                selectedFilters?.inStockOnly ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Continuous Sidebar Panel */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="bg-surface-card border border-border rounded-card p-5 space-y-5 sticky top-20">
          {/* Header */}
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

          {/* Filters List */}
          {renderFilterSections()}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Panel de filtros"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-w-xs bg-surface-card border-r border-border shadow-dropdown flex flex-col h-full animate-in slide-in-from-left duration-200">
            {/* Mobile Header */}
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

            {/* Mobile Filter Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderFilterSections()}
            </div>

            {/* Mobile Footer Actions */}
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
