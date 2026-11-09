import React, { useState, useMemo, useEffect } from "react";
import { X, ShoppingBag, Loader2, Minus, Plus } from "lucide-react";
import Button from "../../../components/ui/Button";
import { useCart } from "../../../context/CartContext";

export default function QuickAddModal({ product, initialColor, isOpen, onClose }) {
  const cart = useCart();
  const addFunction = cart.addToCart || cart.addItem;
  const openDrawerFunction = cart.openCartDrawer || cart.setIsCartOpen;

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Variantes activas
  const activeVariants = useMemo(() => {
    return (product?.product_variants || []).filter((v) => v.is_active !== false);
  }, [product]);

  // Colores únicos deduplicados
  const availableColors = useMemo(() => {
    const map = new Map();
    activeVariants.forEach((v) => {
      if (!map.has(v.color?.toLowerCase())) {
        map.set(v.color?.toLowerCase(), { color: v.color, color_hex: v.color_hex });
      }
    });
    return Array.from(map.values());
  }, [activeVariants]);

  // Sincronización del color inicial al abrir el modal
  useEffect(() => {
    if (isOpen && availableColors.length > 0) {
      const matchInitial = initialColor
        ? availableColors.find((c) => c.color?.toLowerCase() === initialColor?.toLowerCase())
        : null;

      setSelectedColor(matchInitial ? matchInitial.color : availableColors[0].color);
      setSelectedVariantId(null);
      setQuantity(1);
    }
  }, [isOpen, product, initialColor, availableColors]);

  // Tallas ordenadas para el color seleccionado
  const sizesForColor = useMemo(() => {
    if (!selectedColor) return [];
    return activeVariants
      .filter((v) => v.color?.toLowerCase() === selectedColor.toLowerCase())
      .sort((a, b) => {
        const orderA = a.sizes?.display_order ?? 99;
        const orderB = b.sizes?.display_order ?? 99;
        return orderA - orderB;
      });
  }, [activeVariants, selectedColor]);

  // Variante seleccionada y stock
  const selectedVariant = useMemo(() => {
    return activeVariants.find((v) => v.id === selectedVariantId);
  }, [activeVariants, selectedVariantId]);

  const maxAvailableStock = Number(selectedVariant?.stock || 0);
  const isOutOfStock = selectedVariant ? maxAvailableStock <= 0 : false;

  // Ajustar cantidad si excede el nuevo stock seleccionado
  useEffect(() => {
    if (selectedVariant && quantity > maxAvailableStock && maxAvailableStock > 0) {
      setQuantity(maxAvailableStock);
    }
  }, [selectedVariant, maxAvailableStock, quantity]);

  // Imagen del color actual
  const displayImage = useMemo(() => {
    if (!selectedColor || !product?.product_color_images) {
      return product?.main_image_url;
    }
    const match = product.product_color_images.find(
      (img) => img.color?.toLowerCase() === selectedColor.toLowerCase()
    );
    return match?.image_url || product.main_image_url;
  }, [product, selectedColor]);

  // Cierre por ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const handleAddToCart = async () => {
    if (!selectedVariant || isOutOfStock || isAdding || typeof addFunction !== "function") return;
    setIsAdding(true);
    try {
      addFunction(
        {
          variantId: selectedVariant.id,
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          size: selectedVariant.sizes?.name || selectedVariant.size || "M",
          color: selectedVariant.color,
          imageUrl: displayImage,
          stock: maxAvailableStock,
          availableStock: maxAvailableStock,
          quantity: quantity,
        },
        quantity
      );
      onClose();
      if (typeof openDrawerFunction === "function") {
        openDrawerFunction(true);
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-surface-card border border-border rounded-card shadow-dropdown p-5 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between pb-3 border-b border-border">
          <div className="flex gap-3 min-w-0">
            <div className="w-14 aspect-square rounded border border-border bg-surface-subtle overflow-hidden shrink-0 flex items-center justify-center p-1">
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] uppercase font-bold text-brand-muted tracking-wider truncate">
                {product.brands?.name || product.categories?.name || "ERXIDI"}
              </span>
              <h3 className="text-sm font-bold text-brand-primary truncate">
                {product.name}
              </h3>
              <span className="font-mono font-extrabold text-brand-primary text-base mt-0.5 block">
                S/ {Number(product.price).toFixed(2)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Color */}
        {availableColors.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-brand-secondary">Color:</span>
              <span className="font-bold text-brand-primary capitalize">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableColors.map((c) => {
                const isSelected = selectedColor?.toLowerCase() === c.color?.toLowerCase();
                return (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.color);
                      setSelectedVariantId(null);
                      setQuantity(1);
                    }}
                    className={`h-7 px-2.5 rounded-button border text-xs flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? "border-brand-primary bg-surface-subtle text-brand-primary ring-1 ring-brand-primary font-bold shadow-xs"
                        : "border-border bg-surface-card text-brand-secondary hover:border-brand-primary font-medium"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: c.color_hex || "#000000" }}
                    />
                    <span className="capitalize">{c.color}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selector de Tallas */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-brand-secondary">Selecciona Talla:</span>
            {selectedVariant && (
              <span className="text-[11px]">
                {isOutOfStock ? (
                  <span className="text-rose-600 font-bold">Sin stock</span>
                ) : (
                  <span className="text-emerald-700 font-semibold font-mono">
                    {maxAvailableStock} disponibles
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {sizesForColor.map((variant) => {
              const sizeName = variant.sizes?.name || variant.size || "M";
              const noStock = Number(variant.stock) <= 0;
              const isSelected = selectedVariantId === variant.id;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={noStock}
                  onClick={() => {
                    setSelectedVariantId(variant.id);
                    setQuantity(1);
                  }}
                  className={`h-10 rounded-button border text-xs font-mono font-bold transition-all relative ${
                    noStock
                      ? "opacity-35 border-border bg-surface-subtle text-brand-muted cursor-not-allowed line-through"
                      : isSelected
                      ? "border-brand-primary bg-brand-primary text-white shadow-xs"
                      : "border-border bg-surface-card text-brand-primary hover:border-brand-primary"
                  }`}
                  title={noStock ? `${sizeName} - Sin stock` : `${sizeName} - Disponible`}
                >
                  {sizeName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de Cantidad */}
        {selectedVariantId && !isOutOfStock && (
          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-xs font-semibold text-brand-secondary">Cantidad:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded border border-border bg-surface-card flex items-center justify-center text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Disminuir cantidad"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center font-mono font-bold text-xs text-brand-primary">
                {quantity}
              </span>
              <button
                type="button"
                disabled={quantity >= maxAvailableStock}
                onClick={() => setQuantity((q) => Math.min(maxAvailableStock, q + 1))}
                className="w-7 h-7 rounded border border-border bg-surface-card flex items-center justify-center text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Aumentar cantidad"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Botón de Confirmación */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!selectedVariantId || isOutOfStock || isAdding}
            onClick={handleAddToCart}
            className="w-full justify-center text-xs h-10"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : !selectedVariantId ? (
              "Selecciona una talla"
            ) : isOutOfStock ? (
              "Agotado temporalmente"
            ) : (
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                Agregar a mi bolsa {quantity > 1 ? `(${quantity})` : ""}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
