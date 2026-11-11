import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Minus,
  Plus,
  CheckCircle,
  AlertCircle,
  Package,
  Ruler,
  ChevronDown,
} from "lucide-react";
import { mockProducts } from "./data/mockCatalog";
import VariantSelector from "./components/VariantSelector";
import SizeMatcherModal from "./components/SizeMatcherModal";
import SizeCalculatorAccordion from "./components/SizeCalculatorAccordion";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { getUserMeasurements } from "./utils/sizeCalculator";
import {
  fetchProductSizeGuides,
  inferSizeForProduct,
} from "./services/sizeMatcherService";

export default function ProductDetailView({
  product = mockProducts[0],
  onAddToCart,
  onBack,
}) {
  const currentProduct = product || mockProducts[0];
  const { items: cartItems, addItem } = useCart();
  const { profile } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialColorParam = searchParams.get("color");

  const activeVariants = useMemo(
    () =>
      (currentProduct?.product_variants || []).filter(
        (v) => v.is_active !== false
      ),
    [currentProduct]
  );

  const availableColors = useMemo(() => {
    const map = new Map();
    activeVariants.forEach((v) => {
      if (v.color && !map.has(v.color.toLowerCase())) {
        map.set(v.color.toLowerCase(), {
          color: v.color,
          color_hex: v.color_hex || "#111827",
        });
      }
    });
    return Array.from(map.values());
  }, [activeVariants]);

  const initialVariant = useMemo(() => {
    if (initialColorParam) {
      const matchWithStock = activeVariants.find(
        (v) =>
          v.color?.toLowerCase() === initialColorParam.toLowerCase() &&
          (Number(v.stock) || 0) > 0
      );
      if (matchWithStock) return matchWithStock;
      const matchAny = activeVariants.find(
        (v) => v.color?.toLowerCase() === initialColorParam.toLowerCase()
      );
      if (matchAny) return matchAny;
    }
    return (
      activeVariants.find((v) => (Number(v.stock) || 0) > 0) ||
      activeVariants[0] ||
      null
    );
  }, [activeVariants, initialColorParam]);

  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [selectedImage, setSelectedImage] = useState(() => {
    const activeColorName = initialVariant?.color?.toLowerCase();
    if (activeColorName && Array.isArray(currentProduct?.product_color_images)) {
      const cover = currentProduct.product_color_images.find(
        (ci) => ci.color?.toLowerCase() === activeColorName && ci.is_cover
      );
      if (cover?.image_url) return cover.image_url;
      const any = currentProduct.product_color_images.find(
        (ci) =>
          ci.color?.toLowerCase() === activeColorName && Boolean(ci.image_url)
      );
      if (any?.image_url) return any.image_url;
    }
    return null;
  });
  const [quantity, setQuantity] = useState(1);
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [autoSuggestedSize, setAutoSuggestedSize] = useState(null);
  const [selectionSource, setSelectionSource] = useState("manual"); // "manual" | "recommended"

  const [sizeGuides, setSizeGuides] = useState(
    currentProduct?.size_guides || []
  );

  useEffect(() => {
    let isMounted = true;
    async function fetchSizeGuides() {
      if (!currentProduct?.id) return;
      try {
        const guides = await fetchProductSizeGuides(currentProduct.id);
        if (isMounted) {
          if (guides && guides.length > 0) {
            setSizeGuides(guides);
          } else if (
            currentProduct?.size_guides &&
            currentProduct.size_guides.length > 0
          ) {
            setSizeGuides(currentProduct.size_guides);
          }
        }
      } catch {
        if (isMounted && currentProduct?.size_guides) {
          setSizeGuides(currentProduct.size_guides);
        }
      }
    }

    fetchSizeGuides();
    return () => {
      isMounted = false;
    };
  }, [currentProduct]);

  const [userMeasureState, setUserMeasureState] = useState(() =>
    getUserMeasurements(profile)
  );

  useEffect(() => {
    setUserMeasureState(getUserMeasurements(profile));
  }, [profile]);

  const hasUserMeasurements = userMeasureState.hasMeasurements;

  const recommendedSize = useMemo(() => {
    if (!hasUserMeasurements) return null;
    return inferSizeForProduct({
      userMeasurements: userMeasureState.measurements,
      sizeGuides,
    });
  }, [hasUserMeasurements, userMeasureState.measurements, sizeGuides]);

  const effectiveSizeRecommendation = autoSuggestedSize || recommendedSize;

  const isRecommendedInStock = useMemo(() => {
    if (!effectiveSizeRecommendation || activeVariants.length === 0) return false;
    const currentColor = selectedVariant?.color;
    return activeVariants.some(
      (v) =>
        v.color?.toLowerCase() === currentColor?.toLowerCase() &&
        v.sizes?.name === effectiveSizeRecommendation &&
        (Number(v.stock) || 0) > 0
    );
  }, [effectiveSizeRecommendation, activeVariants, selectedVariant?.color]);

  const derivedFamily = useMemo(() => {
    const slug = currentProduct?.categories?.slug;
    if (["boxers", "calzones", "calzoncillos-slips"].includes(slug)) {
      return "bottoms";
    }
    if (slug === "brasiers") {
      return "tops";
    }
    if (slug === "medias") {
      return "socks";
    }
    return null;
  }, [currentProduct]);

  useEffect(() => {
    if (availableColors && availableColors.length > 0) {
      const matchedColor = initialColorParam
        ? availableColors.find(
            (c) => c.color?.toLowerCase() === initialColorParam.toLowerCase()
          )
        : null;

      const targetColor = matchedColor ? matchedColor.color : availableColors[0].color;

      if (
        selectedVariant &&
        selectedVariant.color?.toLowerCase() === targetColor.toLowerCase()
      ) {
        if (!initialColorParam && selectedVariant.color) {
          setSearchParams({ color: selectedVariant.color }, { replace: true });
        }
        return;
      }

      const targetVariant =
        activeVariants.find(
          (v) =>
            v.color?.toLowerCase() === targetColor.toLowerCase() &&
            Number(v.stock) > 0
        ) ||
        activeVariants.find(
          (v) => v.color?.toLowerCase() === targetColor.toLowerCase()
        ) ||
        initialVariant;

      if (targetVariant) {
        setSelectedVariant(targetVariant);
      }

      let colorImg = null;
      if (Array.isArray(currentProduct?.product_color_images)) {
        colorImg =
          currentProduct.product_color_images.find(
            (ci) =>
              ci.color?.toLowerCase() === targetColor.toLowerCase() &&
              ci.is_cover
          )?.image_url ||
          currentProduct.product_color_images.find(
            (ci) =>
              ci.color?.toLowerCase() === targetColor.toLowerCase() &&
              Boolean(ci.image_url)
          )?.image_url ||
          null;
      }
      setSelectedImage(colorImg);
      setQuantity(1);

      if (!initialColorParam && targetColor) {
        setSearchParams({ color: targetColor }, { replace: true });
      }
    }
  }, [availableColors, initialColorParam, activeVariants, currentProduct, initialVariant, selectedVariant, setSearchParams]);

  const galleryImages = useMemo(() => {
    const activeColorName = selectedVariant?.color?.toLowerCase();
    const colorImages = Array.isArray(currentProduct?.product_color_images)
      ? currentProduct.product_color_images.filter(
          (ci) =>
            ci.color?.toLowerCase() === activeColorName &&
            Boolean(ci.image_url)
        )
      : [];

    if (colorImages.length > 0) {
      // Ordenar: portada primero, seguida de las demás por display_order ascendente
      const sorted = [...colorImages].sort((a, b) => {
        const coverDiff = (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0);
        if (coverDiff !== 0) return coverDiff;
        return (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
      });
      return Array.from(new Set(sorted.map((ci) => ci.image_url)));
    }

    return [];
  }, [currentProduct, selectedVariant?.color]);

  // Cantidad ya presente en el carrito para esta variante
  const inCartQuantity = useMemo(() => {
    if (!selectedVariant) return 0;
    const targetId = Number(selectedVariant.id);
    const item = (cartItems || []).find(
      (i) =>
        Number(i.variantId) === targetId ||
        Number(i.variant_id) === targetId ||
        Number(i.id) === targetId
    );
    return item ? Number(item.quantity) || 0 : 0;
  }, [cartItems, selectedVariant]);

  // Stock físico total registrado en BD
  const totalStock = Number(selectedVariant?.stock ?? 0);

  // Stock disponible restando lo que ya está apartado en el carrito
  const stockAfterCart = Math.max(0, totalStock - inCartQuantity);

  // Regla de Negocio 3: Cálculo reactivo (stockAfterCart - quantity)
  const availableLeft = Math.max(0, stockAfterCart - quantity);

  const isOutOfStock =
    !selectedVariant || selectedVariant.is_active === false || totalStock <= 0;

  const isCartLimitReached = !isOutOfStock && stockAfterCart === 0;
  const isSelectionLimitReached =
    !isOutOfStock && !isCartLimitReached && quantity >= stockAfterCart;

  useEffect(() => {
    if (stockAfterCart > 0 && quantity > stockAfterCart) {
      setQuantity(stockAfterCart);
    } else if (stockAfterCart === 0 && quantity !== 1) {
      setQuantity(1);
    }
  }, [stockAfterCart, quantity]);

  // Regla de Negocio 4: Progresión dinámica y ocultamiento de stock exacto (> 10 -> "En stock")
  const stockStatus = useMemo(() => {
    if (isOutOfStock) {
      return {
        label: "Sin stock",
        badgeVariant: "danger",
      };
    }

    if (isCartLimitReached) {
      return {
        label: "Tope en carrito alcanzado",
        badgeVariant: "danger",
      };
    }

    if (isSelectionLimitReached) {
      return {
        label: "Agotado",
        badgeVariant: "danger",
      };
    }

    if (availableLeft <= 5) {
      const label =
        availableLeft === 1
          ? "¡Última unidad disponible!"
          : "¡Últimos " + availableLeft + " disponibles!";
      return {
        label,
        badgeVariant: "warning",
      };
    }

    if (availableLeft <= 10) {
      return {
        label: "Quedan pocos productos",
        badgeVariant: "warning",
      };
    }

    return {
      label: "En stock",
      badgeVariant: "success",
    };
  }, [
    isOutOfStock,
    isCartLimitReached,
    isSelectionLimitReached,
    availableLeft,
  ]);

  const formattedPrice = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(currentProduct?.price || 0);

  const handleSizeSelected = (sizeName) => {
    setUserMeasureState(getUserMeasurements(profile));

    const currentColor = selectedVariant?.color;

    const matchingVariant = activeVariants.find(
      (v) =>
        v.color === currentColor &&
        v.sizes?.name === sizeName &&
        Number(v.stock) > 0
    );

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
      setQuantity(1);
    }

    setIsSizeMatcherOpen(false);
  };

  const handleAutoSelectSuggestedSize = (suggestedSize) => {
    if (!suggestedSize) return;
    setAutoSuggestedSize(suggestedSize);

    const currentColor = selectedVariant?.color;
    const matchedVariant = activeVariants.find(
      (v) =>
        v.color?.toLowerCase() === currentColor?.toLowerCase() &&
        v.sizes?.name === suggestedSize &&
        Number(v.stock) > 0
    );

    if (matchedVariant) {
      setSelectionSource("recommended");
      handleVariantChange(matchedVariant);
    }
  };

  const handleIncrement = () => {
    if (quantity < stockAfterCart && !isCartLimitReached && !isOutOfStock) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1 && stockAfterCart > 0) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleVariantChange = (newVariant) => {
    setSelectedVariant(newVariant);
    setQuantity(1);

    const activeColorName = newVariant?.color?.toLowerCase();
    const resolvedImage =
      currentProduct?.product_color_images?.find(
        (ci) => ci.color?.toLowerCase() === activeColorName && ci.is_cover
      )?.image_url ||
      currentProduct?.product_color_images?.find(
        (ci) =>
          ci.color?.toLowerCase() === activeColorName && Boolean(ci.image_url)
      )?.image_url ||
      null;

    setSelectedImage(resolvedImage);

    if (newVariant?.color) {
      setSearchParams({ color: newVariant.color }, { replace: true });
    }
  };

  const handleAddToCartClick = () => {
    if (
      !isOutOfStock &&
      !isCartLimitReached &&
      selectedVariant &&
      stockAfterCart > 0
    ) {
      const qtyToAdd = Math.min(quantity, stockAfterCart);

      // Resolver la imagen exacta del color seleccionado
      const activeColorName = selectedVariant?.color?.toLowerCase();
      const resolvedImageUrl =
        selectedImage ||
        currentProduct?.product_color_images?.find(
          (ci) =>
            ci.color?.toLowerCase() === activeColorName && ci.is_cover
        )?.image_url ||
        currentProduct?.product_color_images?.find(
          (ci) =>
            ci.color?.toLowerCase() === activeColorName && Boolean(ci.image_url)
        )?.image_url ||
        null;

      addItem(
        {
          variantId: selectedVariant.id,
          productId: currentProduct.id,
          name: currentProduct.name,
          size: selectedVariant.sizes?.name || "M",
          color: selectedVariant.color || "",
          colorHex: selectedVariant.color_hex || "#111827",
          price: currentProduct.price,
          stock: selectedVariant.stock,
          imageUrl: resolvedImageUrl,
        },
        qtyToAdd
      );
    }
  };

  return (
    <div className="min-h-screen bg-surface-app py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {onBack && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="-ml-2 text-brand-secondary hover:text-brand-primary"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Volver al catálogo
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Galería de Producto */}
          <div className="space-y-4">
            <div className="aspect-[4/5] bg-surface-subtle border border-border rounded-card overflow-hidden shadow-subtle relative flex flex-col items-center justify-center p-6 text-center select-none">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={currentProduct?.name || "Prenda"}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="space-y-2 text-brand-muted flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-surface-card border border-border flex items-center justify-center">
                    <Package className="w-6 h-6 text-brand-muted" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-brand-secondary">
                      Sin imágenes disponibles
                    </p>
                    <p className="text-[11px] text-brand-muted">
                      Variante en color {selectedVariant?.color || "seleccionado"}
                    </p>
                  </div>
                </div>
              )}

              {isOutOfStock && (
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant="danger">Agotado</Badge>
                </div>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {galleryImages.map((imgUrl, index) => {
                  const isSelected = selectedImage === imgUrl;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedImage(imgUrl)}
                      className={
                        "relative w-20 h-24 rounded-card overflow-hidden border transition-all flex-shrink-0 focus:outline-none " +
                        (isSelected
                          ? "border-brand-primary ring-2 ring-brand-primary ring-offset-1"
                          : "border-border hover:border-border-strong opacity-75 hover:opacity-100")
                      }
                    >
                      <img
                        src={imgUrl}
                        alt={"Miniatura " + (index + 1)}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Información y Compra */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {currentProduct?.categories?.name && (
                  <Badge variant="neutral">
                    {currentProduct.categories.name}
                  </Badge>
                )}
                {currentProduct?.materials?.name && (
                  <Badge variant="neutral">
                    {currentProduct.materials.name}
                  </Badge>
                )}

                {selectedVariant && (
                  <Badge variant={stockStatus.badgeVariant}>
                    {stockStatus.label}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-primary">
                {currentProduct?.name}
              </h1>

              <div className="flex items-baseline gap-4 pt-1">
                <span className="text-2xl font-bold text-brand-primary">
                  {formattedPrice}
                </span>
              </div>
            </div>

            {currentProduct?.description && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-border pt-4">
                {currentProduct.description.split("\n").map((line, idx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  if (trimmed.startsWith("•") || trimmed.startsWith("*")) {
                    const itemText = trimmed
                      .replace(/^[•*]\s*/, "")
                      .replace(/\*\*/g, "");
                    return (
                      <div key={idx} className="flex items-start gap-2 pl-1">
                        <span className="text-accent font-black text-sm leading-none">
                          •
                        </span>
                        <span className="flex-1">{itemText}</span>
                      </div>
                    );
                  }

                  return <p key={idx}>{trimmed.replace(/\*\*/g, "")}</p>;
                })}
              </div>
            )}

            {/* Selector de Variantes */}
            <div className="border-t border-border pt-4 space-y-4">
              <VariantSelector
                variants={activeVariants}
                selectedVariant={selectedVariant}
                onVariantChange={(newVariant) => {
                  setSelectionSource("manual");
                  handleVariantChange(newVariant);
                }}
                selectionSource={selectionSource}
              />

              {/* Banner Informativo de Talla */}
              {effectiveSizeRecommendation && (
                <div className="mt-2 text-xs">
                  {isRecommendedInStock ? (
                    <div className="p-2.5 rounded-card bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Según tus medidas, seleccionamos la talla{" "}
                        <strong>{effectiveSizeRecommendation}</strong>.
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-card bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Talla sugerida{" "}
                        <strong>{effectiveSizeRecommendation}</strong> no
                        disponible en este color.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Disparador del Acordeón con Apertura Gradual */}
              <div className="pt-3">
                <div className="w-full flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-brand-secondary">
                    ¿No estás seguro de tu talla?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAccordionOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors focus:outline-none"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Calcular mi talla</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isAccordionOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Transición CSS Grid para apertura fluida estilo iOS */}
                <div
                  className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isAccordionOpen
                      ? "grid-rows-[1fr] opacity-100 mt-3"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <SizeCalculatorAccordion
                      garmentFamily={derivedFamily}
                      isOpen={isAccordionOpen}
                      onSizeCalculated={handleAutoSelectSuggestedSize}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Selector de Cantidad y Botón de Compra */}
            <div className="border-t border-border pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-brand-secondary block">
                    Cantidad
                  </label>
                  <div className="flex items-center border border-border rounded-button bg-surface-card overflow-hidden">
                    <button
                      type="button"
                      disabled={
                        quantity <= 1 || isCartLimitReached || isOutOfStock
                      }
                      onClick={handleDecrement}
                      className="w-9 h-9 flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-sm font-bold text-brand-primary">
                      {stockAfterCart === 0 ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      disabled={
                        quantity >= stockAfterCart ||
                        isCartLimitReached ||
                        isOutOfStock
                      }
                      onClick={handleIncrement}
                      className="w-9 h-9 flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 pt-5">
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={isCartLimitReached || isOutOfStock}
                    onClick={handleAddToCartClick}
                    className="w-full"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {isOutOfStock
                      ? "Sin stock"
                      : isCartLimitReached
                        ? "Límite en carrito alcanzado"
                        : "Agregar al carrito"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SizeMatcherModal
          isOpen={isSizeMatcherOpen}
          onClose={() => setIsSizeMatcherOpen(false)}
          onSizeSelected={handleSizeSelected}
          garmentFamily={derivedFamily}
          category={
            currentProduct?.categories?.slug || currentProduct?.category
          }
          productType={derivedFamily}
        />
      </div>
    </div>
  );
}