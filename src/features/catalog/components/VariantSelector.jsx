import React, { useMemo } from "react";

export default function VariantSelector({
  variants = [],
  selectedVariant = null,
  onVariantChange,
}) {
  // Filtrar estrictamente variantes activas (excluye bajas lógicas del Backoffice)
  const activeVariants = useMemo(
    () => (variants || []).filter((v) => v.is_active !== false),
    [variants]
  );

  // Extraer colores únicos preservando el primer hexadecimal registrado
  const uniqueColors = useMemo(() => {
    const map = new Map();
    activeVariants.forEach((v) => {
      if (v.color && !map.has(v.color)) {
        map.set(v.color, {
          color: v.color,
          color_hex: v.color_hex || "#111827",
        });
      }
    });
    return Array.from(map.values());
  }, [activeVariants]);

  // Extraer tallas únicas ordenadas por display_order
  const uniqueSizes = useMemo(() => {
    const map = new Map();
    activeVariants.forEach((v) => {
      if (v.sizes && !map.has(v.sizes.name)) {
        map.set(v.sizes.name, v.sizes);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
  }, [activeVariants]);

  const currentVariant = selectedVariant || activeVariants[0] || null;
  const activeColor = currentVariant?.color || "";
  const activeSizeName = currentVariant?.sizes?.name || "";

  const handleColorSelect = (color) => {
    if (color === activeColor) return;

    // 1. Intentar mantener la misma talla en el nuevo color si tiene stock
    const sameSizeVariant = activeVariants.find(
      (v) =>
        v.color === color &&
        v.sizes?.name === activeSizeName &&
        Number(v.stock) > 0
    );
    if (sameSizeVariant) {
      onVariantChange?.(sameSizeVariant);
      return;
    }

    // 2. Seleccionar la primera talla con stock disponible en el nuevo color
    const anyInStockVariant = activeVariants.find(
      (v) => v.color === color && Number(v.stock) > 0
    );
    if (anyInStockVariant) {
      onVariantChange?.(anyInStockVariant);
      return;
    }

    // 3. Fallback a la primera variante activa de ese color (mostrará Sin stock)
    const firstColorVariant = activeVariants.find((v) => v.color === color);
    if (firstColorVariant) {
      onVariantChange?.(firstColorVariant);
    }
  };

  const handleSizeSelect = (sizeName) => {
    const matchingVariant = activeVariants.find(
      (v) => v.color === activeColor && v.sizes?.name === sizeName
    );

    if (matchingVariant && Number(matchingVariant.stock) > 0) {
      onVariantChange?.(matchingVariant);
    }
  };

  if (activeVariants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Sección de Colores */}
      {uniqueColors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-brand-secondary">
              Color:{" "}
              <span className="font-bold text-brand-primary">{activeColor}</span>
            </span>
          </div>

          <div
            className="flex items-center gap-2.5 flex-wrap"
            role="radiogroup"
            aria-label="Seleccionar color"
          >
            {uniqueColors.map((c) => {
              const isSelected = c.color === activeColor;

              return (
                <button
                  key={c.color}
                  type="button"
                  title={c.color}
                  aria-label={"Color " + c.color}
                  aria-checked={isSelected}
                  role="radio"
                  onClick={() => handleColorSelect(c.color)}
                  className={
                    "group relative w-7 h-7 rounded-full border transition-all duration-150 focus:outline-none " +
                    (isSelected
                      ? "ring-2 ring-brand-primary ring-offset-2 border-transparent scale-105"
                      : "border-border hover:border-border-strong hover:scale-105")
                  }
                  style={{ backgroundColor: c.color_hex }}
                >
                  <span className="absolute inset-0 rounded-full border border-black/10 pointer-events-none" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección de Tallas */}
      {uniqueSizes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-brand-secondary">
              Talla:{" "}
              <span className="font-bold text-brand-primary">
                {activeSizeName}
              </span>
            </span>
          </div>

          <div
            className="flex items-center gap-2 flex-wrap"
            role="radiogroup"
            aria-label="Seleccionar talla"
          >
            {uniqueSizes.map((size) => {
              const variantForSize = activeVariants.find(
                (v) => v.color === activeColor && v.sizes?.name === size.name
              );

              const isOutOfStock =
                !variantForSize || Number(variantForSize.stock) <= 0;

              const isSelected = activeSizeName === size.name && !isOutOfStock;

              return (
                <button
                  key={size.name}
                  type="button"
                  disabled={isOutOfStock}
                  title={
                    isOutOfStock
                      ? "Talla " + size.name + " agotada"
                      : "Talla " + size.name
                  }
                  aria-label={
                    "Talla " + size.name + (isOutOfStock ? " agotada" : "")
                  }
                  aria-checked={isSelected}
                  role="radio"
                  onClick={() => handleSizeSelect(size.name)}
                  className={
                    "min-w-[40px] h-9 px-3 rounded-button font-mono text-xs font-semibold uppercase transition-colors duration-150 flex items-center justify-center border focus:outline-none " +
                    (isOutOfStock
                      ? "border-dashed border-border text-brand-muted opacity-40 cursor-not-allowed bg-surface-subtle"
                      : isSelected
                        ? "border-brand-primary ring-1 ring-brand-primary bg-surface-subtle text-brand-primary font-bold shadow-subtle"
                        : "border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary")
                  }
                >
                  {size.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}