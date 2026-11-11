import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ChevronLeft, ChevronRight, Package } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";

export default function ProductCard({ product, onSelect }) {
  const navigate = useNavigate();
  const [activeColor, setActiveColor] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  // Lista ordenada de imágenes del color activo o fallback inicial
  const activeColorImages = useMemo(() => {
    if (activeColor) {
      if (Array.isArray(product?.product_color_images)) {
        const filtered = product.product_color_images.filter(
          (img) =>
            img.color?.toLowerCase() === activeColor.toLowerCase() &&
            Boolean(img.image_url)
        );

        if (filtered.length > 0) {
          const sorted = [...filtered].sort((a, b) => {
            const coverDiff = (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0);
            if (coverDiff !== 0) return coverDiff;
            return (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
          });
          return Array.from(new Set(sorted.map((item) => item.image_url)));
        }
      }
      // Color sin imágenes asociadas en BD
      return [];
    }

    // Estado inicial: buscar cover o imágenes del primer color registrado
    if (Array.isArray(product?.product_color_images) && product.product_color_images.length > 0) {
      const coverItem = product.product_color_images.find((img) => img.is_cover && img.image_url);
      const initialColor = coverItem?.color || product.product_color_images[0]?.color;

      if (initialColor) {
        const forInitial = product.product_color_images
          .filter(
            (img) =>
              img.color?.toLowerCase() === initialColor.toLowerCase() &&
              Boolean(img.image_url)
          )
          .sort((a, b) => {
            const coverDiff = (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0);
            if (coverDiff !== 0) return coverDiff;
            return (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
          });

        if (forInitial.length > 0) {
          return Array.from(new Set(forInitial.map((item) => item.image_url)));
        }
      }
    }

    // Fallback: imagen principal global del producto
    if (product?.main_image_url) {
      return [product.main_image_url];
    }

    return [];
  }, [activeColor, product]);

  const currentImageUrl = activeColorImages[currentImageIndex] || activeColorImages[0] || null;

  const hasGlobalStock = useMemo(() => {
    return (product?.product_variants || []).some(
      (v) => v.is_active !== false && Number(v.stock) > 0
    );
  }, [product]);

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) =>
      prev === 0 ? activeColorImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) =>
      prev === activeColorImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(product, activeColor);
    } else {
      const query = activeColor ? `?color=${encodeURIComponent(activeColor)}` : "";
      navigate(`/producto/${product.slug}${query}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group bg-surface-card border border-border rounded-card overflow-hidden hover:border-brand-primary transition-all flex flex-col justify-between cursor-pointer select-none"
    >
      <div>
        {/* Contenedor de Imagen a Ancho Completo con Carrusel */}
        <div className="relative aspect-square w-full bg-surface-subtle overflow-hidden">
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={product.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-brand-muted bg-surface-subtle">
              <div className="w-10 h-10 rounded-full bg-surface-card border border-border flex items-center justify-center mb-1.5 shadow-xs">
                <Package className="w-5 h-5 text-brand-muted" />
              </div>
              <span className="text-[11px] font-semibold text-brand-secondary">
                Sin imagen disponible
              </span>
              {activeColor && (
                <span className="text-[10px] text-brand-muted capitalize">
                  Color {activeColor}
                </span>
              )}
            </div>
          )}

          {/* Flechas de Navegación Lateral (Estilo Saga Falabella / Ripley) */}
          {activeColorImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/70 hover:bg-white text-brand-primary shadow-xs opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-xs hover:scale-105 z-10"
                aria-label="Imagen anterior"
                title="Imagen anterior"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/70 hover:bg-white text-brand-primary shadow-xs opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-xs hover:scale-105 z-10"
                aria-label="Siguiente imagen"
                title="Siguiente imagen"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Indicador de Posición */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded-full pointer-events-none z-10">
                {activeColorImages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 rounded-full transition-all ${
                      idx === currentImageIndex ? "w-2.5 bg-white" : "w-1 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {!hasGlobalStock && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-2 z-20">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveColor(c.color);
                    setCurrentImageIndex(0);
                  }}
                  title={c.color}
                  className={`w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-110 transition-transform duration-200 ${
                    activeColor?.toLowerCase() === c.color?.toLowerCase()
                      ? "scale-125 ring-1 ring-brand-primary"
                      : ""
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

      {/* Pie: Precio Destacado y Botón Elegir Talla */}
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
            onSelect?.(product, activeColor);
          }}
          className="text-xs px-2.5 sm:px-3.5 h-8 gap-1 shrink-0"
          title={hasGlobalStock ? "Elegir talla" : "Producto agotado"}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Elegir talla</span>
        </Button>
      </div>
    </div>
  );
}
