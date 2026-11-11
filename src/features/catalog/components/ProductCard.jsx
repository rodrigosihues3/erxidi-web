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

  // Color asociado a la portada global del producto (main_image_url)
  const defaultGlobalColor = useMemo(() => {
    if (!product?.main_image_url || !Array.isArray(product?.product_color_images)) {
      return null;
    }
    const match = product.product_color_images.find(
      (img) => img.image_url === product.main_image_url
    );
    return match?.color || null;
  }, [product]);

  // Color efectivo a considerar (seleccionado por el usuario o portada global)
  const effectiveActiveColor = activeColor || defaultGlobalColor;

  // Lista ordenada de imágenes del color activo o portada global inicial
  const activeColorImages = useMemo(() => {
    // 1. Si el usuario seleccionó un color explícitamente:
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
      return [];
    }

    // 2. Estado inicial por defecto: Prioridad a main_image_url (Portada de Catálogo)
    if (product?.main_image_url) {
      const list = [product.main_image_url];
      if (defaultGlobalColor && Array.isArray(product?.product_color_images)) {
        const siblingImages = product.product_color_images
          .filter(
            (img) =>
              img.color?.toLowerCase() === defaultGlobalColor.toLowerCase() &&
              img.image_url &&
              img.image_url !== product.main_image_url
          )
          .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
          .map((img) => img.image_url);

        siblingImages.forEach((url) => {
          if (!list.includes(url)) list.push(url);
        });
      }
      return list;
    }

    // 3. Fallback: buscar cover o imágenes del primer color registrado
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

    return [];
  }, [activeColor, defaultGlobalColor, product]);

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
      onSelect(product, effectiveActiveColor);
    } else {
      const query = effectiveActiveColor ? `?color=${encodeURIComponent(effectiveActiveColor)}` : "";
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
              {effectiveActiveColor && (
                <span className="text-[10px] text-brand-muted capitalize">
                  Color {effectiveActiveColor}
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

        {/* Detalles: Marca, Título y Precio Destacado Debajo (Estilo Ripley) */}
        <div className="p-3 sm:p-3.5 space-y-1.5">
          <span className="block text-[10px] uppercase font-bold text-brand-muted tracking-wider truncate">
            {product.brands?.name || product.categories?.name || "ERXIDI"}
          </span>

          <h3
            className="text-xs sm:text-sm font-semibold text-brand-primary truncate hover:underline"
            title={product.name}
          >
            {product.name}
          </h3>

          <div className="pt-0.5">
            <span className="font-mono font-extrabold text-base sm:text-lg text-brand-primary">
              S/ {Number(product.price).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Fila Inferior (Footer): Swatches a la izquierda y Botón Elegir Talla a la derecha */}
      <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5 pt-2 flex items-center justify-between gap-2 border-t border-border/50">
        {/* Swatches de Color con área táctil protegida y hover responsivo */}
        <div className="flex items-center gap-1.5 min-h-[32px]">
          {colorSwatches.slice(0, 4).map((c) => {
            const isSelected = effectiveActiveColor?.toLowerCase() === c.color?.toLowerCase();
            return (
              <button
                key={c.color}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveColor(c.color);
                  setCurrentImageIndex(0);
                }}
                title={c.color}
                className="p-1 -m-1 focus:outline-none group/swatch"
                aria-label={`Color ${c.color}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full border border-black/20 transition-all duration-200 group-hover/swatch:scale-125 ${
                    isSelected
                      ? "scale-110 ring-2 ring-brand-primary ring-offset-1"
                      : "opacity-80 group-hover/swatch:opacity-100"
                  }`}
                  style={{ backgroundColor: c.color_hex || "#000000" }}
                />
              </button>
            );
          })}
          {colorSwatches.length > 4 && (
            <span className="text-[10px] text-brand-muted font-mono font-medium ml-0.5">
              +{colorSwatches.length - 4}
            </span>
          )}
        </div>

        {/* Botón Elegir Talla */}
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!hasGlobalStock}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(product, effectiveActiveColor);
          }}
          className="text-xs px-2.5 sm:px-3 h-8 gap-1 shrink-0"
          title={hasGlobalStock ? "Elegir talla" : "Producto agotado"}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Elegir talla</span>
        </Button>
      </div>
    </div>
  );
}
