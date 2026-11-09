import React, { useState, useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";

export default function ProductCard({ product, onSelect, onQuickAdd }) {
  const [activeColor, setActiveColor] = useState(null);

  // Muestras de color únicas
  const colorSwatches = useMemo(() => {
    const map = new Map();
    (product?.product_variants || []).forEach((v) => {
      if (v.is_active !== false && !map.has(v.color)) {
        map.set(v.color, { color: v.color, color_hex: v.color_hex });
      }
    });
    return Array.from(map.values());
  }, [product]);

  // Imagen activa según color en hover o principal
  const currentImageUrl = useMemo(() => {
    if (activeColor && product?.product_color_images) {
      const match = product.product_color_images.find(
        (img) => img.color?.toLowerCase() === activeColor.toLowerCase()
      );
      if (match?.image_url) return match.image_url;
    }
    return product?.main_image_url;
  }, [activeColor, product]);

  const hasGlobalStock = useMemo(() => {
    return (product?.product_variants || []).some(
      (v) => v.is_active !== false && Number(v.stock) > 0
    );
  }, [product]);

  return (
    <div
      onClick={() => onSelect?.(product)}
      className="group bg-surface-card border border-border rounded-card overflow-hidden hover:border-brand-primary transition-all flex flex-col justify-between cursor-pointer select-none"
    >
      <div>
        {/* Contenedor Cuadrado 1:1 para evitar franjas verticales excesivas */}
        <div className="relative aspect-square bg-surface-subtle overflow-hidden flex items-center justify-center p-2">
          <img
            src={currentImageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />

          {!hasGlobalStock && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-2">
              <Badge className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" variant="danger">
                Agotado
              </Badge>
            </div>
          )}
        </div>

        {/* Detalles */}
        <div className="p-3 sm:p-3.5 space-y-2">
          {/* Swatches de Color */}
          {colorSwatches.length > 0 && (
            <div className="flex items-center gap-1.5 h-4">
              {colorSwatches.slice(0, 4).map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onMouseEnter={() => setActiveColor(c.color)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveColor(c.color);
                  }}
                  title={c.color}
                  className={`w-3.5 h-3.5 rounded-full border border-black/20 transition-transform ${activeColor?.toLowerCase() === c.color?.toLowerCase()
                    ? "scale-125 ring-1 ring-brand-primary"
                    : "hover:scale-110"
                    }`}
                  style={{ backgroundColor: c.color_hex || "#000000" }}
                />
              ))}
              {colorSwatches.length > 4 && (
                <span className="text-[10px] text-brand-muted font-mono font-medium">
                  +{colorSwatches.length - 4}
                </span>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            <span className="block text-[10px] uppercase font-bold text-brand-muted tracking-wider truncate">
              {product.brands?.name || product.categories?.name || "ERXIDI"}
            </span>
            <h3
              className="text-xs sm:text-sm font-semibold text-brand-primary truncate hover:underline"
              title={product.name}
            >
              {product.name}
            </h3>
          </div>
        </div>
      </div>

      {/* Pie: Precio Destacado y Botón Agregar */}
      <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5 pt-1.5 flex items-center justify-between gap-2 border-t border-border/50">
        <span className="font-mono font-extrabold text-sm sm:text-lg text-brand-primary">
          S/ {Number(product.price).toFixed(2)}
        </span>

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!hasGlobalStock}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd?.(product, activeColor);
          }}
          className="text-xs px-2.5 sm:px-3.5 h-8 gap-1 shrink-0"
          title={hasGlobalStock ? "Agregar prenda" : "Producto agotado"}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>
    </div>
  );
}
