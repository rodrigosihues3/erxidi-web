import React from "react";
import { ShoppingCart } from "lucide-react";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

export default function ProductCard({ product, onSelect, onQuickAdd }) {
  if (!product) return null;

  const {
    name,
    price,
    main_image_url,
    materials,
    product_variants = [],
  } = product;

  // Compute total stock by summing up all variants' stock
  const totalStock = product_variants.reduce(
    (acc, variant) => acc + (variant.is_active ? variant.stock || 0 : 0),
    0,
  );
  const isOutOfStock = totalStock === 0;

  // Garantizar renderizado estricto en Soles (S/)
  const formattedPrice = `S/ ${Number(price || 0).toFixed(2)}`;

  return (
    <div className="group flex flex-col bg-surface-card border border-border rounded-card overflow-hidden hover:shadow-subtle transition-shadow duration-300 h-full">
      {/* Image Container */}
      <div
        className="relative aspect-[4/5] bg-surface-subtle overflow-hidden cursor-pointer"
        onClick={() => onSelect?.(product)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(product);
          }
        }}
      >
        {main_image_url ? (
          <img
            src={main_image_url}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-brand-secondary bg-surface-subtle">
            Sin imagen
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
          {isOutOfStock && <Badge variant="danger">Agotado</Badge>}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex flex-col flex-grow">
        <div className="mb-2 flex items-center flex-wrap gap-2">
          {materials?.name && <Badge variant="neutral">{materials.name}</Badge>}

          {!isOutOfStock && totalStock > 0 && totalStock <= 3 && (
            <Badge variant="warning">Quedan {totalStock}</Badge>
          )}
        </div>

        {product.categories?.name && (
          <span className="text-[11px] font-mono uppercase tracking-wider text-brand-secondary mb-1 block">
            {product.categories.name}
          </span>
        )}
        
        <h3
          className="text-sm md:text-base font-bold text-brand-primary line-clamp-2 cursor-pointer hover:underline mb-2"
          onClick={() => onSelect?.(product)}
        >
          {name}
        </h3>

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-border">
          <span className="text-lg font-bold text-brand-primary">
            {formattedPrice}
          </span>

          <Button
            variant={isOutOfStock ? "outline" : "primary"}
            size="sm"
            disabled={isOutOfStock}
            onClick={() => !isOutOfStock && onQuickAdd?.(product)}
            aria-label={
              isOutOfStock ? "Producto agotado" : "Agregar al carrito"
            }
          >
            {isOutOfStock ? (
              "Agotado"
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Agregar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
