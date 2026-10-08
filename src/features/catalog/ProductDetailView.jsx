import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ShoppingCart,
  Ruler,
  ShieldAlert,
  Minus,
  Plus,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { mockProducts } from './data/mockCatalog';
import VariantSelector from './components/VariantSelector';
import SizeMatcherModal from './components/SizeMatcherModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { getUserMeasurements } from './utils/sizeCalculator';
import {
  fetchProductSizeGuides,
  inferSizeForProduct,
} from './services/sizeMatcherService';

export default function ProductDetailView({
  product = mockProducts[0],
  onAddToCart,
  onBack,
}) {
  const currentProduct = product || mockProducts[0];
  const { items: cartItems } = useCart();
  const { profile } = useAuth();

  // Helper to determine initial active variant with stock
  const initialVariant = useMemo(() => {
    const variants = currentProduct?.product_variants || [];
    return (
      variants.find((v) => v.is_active !== false && (v.stock || 0) > 0) ||
      variants[0] ||
      null
    );
  }, [currentProduct]);

  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [selectedImage, setSelectedImage] = useState(
    currentProduct?.main_image_url || ''
  );
  const [quantity, setQuantity] = useState(1);
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [suggestedNotice, setSuggestedNotice] = useState(null);

  // Consulta de guías de tallas en Supabase
  const [sizeGuides, setSizeGuides] = useState(currentProduct?.size_guides || []);

  useEffect(() => {
    let isMounted = true;
    async function fetchSizeGuides() {
      if (!currentProduct?.id) return;
      try {
        const guides = await fetchProductSizeGuides(currentProduct.id);
        if (isMounted) {
          if (guides && guides.length > 0) {
            setSizeGuides(guides);
          } else if (currentProduct?.size_guides && currentProduct.size_guides.length > 0) {
            setSizeGuides(currentProduct.size_guides);
          }
        }
      } catch (err) {
        if (isMounted && currentProduct?.size_guides) {
          setSizeGuides(currentProduct.size_guides);
        }
      }
    }

    fetchSizeGuides();
    return () => {
      isMounted = false;
    };
  }, [currentProduct?.id]);

  // Medidas del usuario (perfil o localStorage)
  const [userMeasureState, setUserMeasureState] = useState(() =>
    getUserMeasurements(profile)
  );

  useEffect(() => {
    setUserMeasureState(getUserMeasurements(profile));
  }, [profile]);

  const hasUserMeasurements = userMeasureState.hasMeasurements;

  // Talla recomendada calculada (Prioridad 1: size_guides, Prioridad 2: fallback estándar)
  const recommendedSize = useMemo(() => {
    if (!hasUserMeasurements) return null;
    return inferSizeForProduct({
      userMeasurements: userMeasureState.measurements,
      sizeGuides,
    });
  }, [hasUserMeasurements, userMeasureState.measurements, sizeGuides]);

  // Verificación de disponibilidad de stock de la talla recomendada para el color actual
  const isRecommendedInStock = useMemo(() => {
    if (!recommendedSize || !currentProduct?.product_variants) return false;
    const currentColor = selectedVariant?.color;
    return currentProduct.product_variants.some(
      (v) =>
        v.color === currentColor &&
        v.sizes?.name === recommendedSize &&
        v.is_active !== false &&
        (v.stock || 0) > 0
    );
  }, [recommendedSize, currentProduct?.product_variants, selectedVariant?.color]);

  // Deduce garment family from category slug for specific sizing
  const derivedFamily = useMemo(() => {
    const slug = currentProduct?.categories?.slug;
    if (['boxers', 'calzones', 'calzoncillos-slips'].includes(slug)) {
      return 'bottoms';
    }
    if (slug === 'brasiers') {
      return 'tops';
    }
    if (slug === 'medias') {
      return 'socks';
    }
    return null;
  }, [currentProduct]);

  // Sync state if product changes
  useEffect(() => {
    setSelectedVariant(initialVariant);
    setSelectedImage(currentProduct?.main_image_url || '');
    setQuantity(1);
    setSuggestedNotice(null);
  }, [currentProduct, initialVariant]);

  // Gallery image list
  const galleryImages = useMemo(() => {
    const list = [];
    if (currentProduct?.main_image_url) {
      list.push(currentProduct.main_image_url);
    }
    if (Array.isArray(currentProduct?.gallery_urls)) {
      currentProduct.gallery_urls.forEach((url) => {
        if (!list.includes(url)) {
          list.push(url);
        }
      });
    }
    return list;
  }, [currentProduct]);

  // Quantity already in cart for the selected variant
  const inCartQuantity = useMemo(() => {
    if (!selectedVariant) return 0;
    const item = (cartItems || []).find((i) => i.variantId === selectedVariant.id);
    return item ? item.quantity : 0;
  }, [cartItems, selectedVariant]);

  // Real available stock deduction
  const totalStock = selectedVariant?.stock || 0;
  const remainingStock = Math.max(0, totalStock - inCartQuantity);
  const isReachedLimit = remainingStock === 0;
  const isOutOfStock =
    !selectedVariant ||
    selectedVariant.is_active === false ||
    totalStock === 0;

  // Format currency
  const formattedPrice = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(currentProduct?.price || 0);

  // Handle Size Matcher recommendation
  const handleSizeSelected = (sizeName) => {
    // Actualizar estado de medidas del usuario
    setUserMeasureState(getUserMeasurements(profile));

    const variants = currentProduct?.product_variants || [];
    const currentColor = selectedVariant?.color;

    // Find variant with current color and recommended size
    const matchingVariant = variants.find(
      (v) =>
        v.color === currentColor &&
        v.sizes?.name === sizeName &&
        v.stock > 0 &&
        v.is_active !== false
    );

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
      setQuantity(1);
    }

    setIsSizeMatcherOpen(false);
  };

  const handleIncrement = () => {
    if (quantity < remainingStock && !isReachedLimit) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1 && remainingStock > 0) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleVariantChange = (newVariant) => {
    setSelectedVariant(newVariant);
    setQuantity(1);
    setSuggestedNotice(null);
  };

  const handleAddToCartClick = () => {
    if (!isOutOfStock && !isReachedLimit && selectedVariant && remainingStock > 0) {
      const qtyToAdd = Math.min(quantity, remainingStock);
      onAddToCart?.(selectedVariant, qtyToAdd);
    }
  };

  return (
    <div className="min-h-screen bg-surface-app py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Back Navigation */}
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

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left Column: Gallery */}
          <div className="space-y-4">
            {/* Main Showcase Image */}
            <div className="aspect-[4/5] bg-surface-card border border-border rounded-card overflow-hidden shadow-subtle relative flex items-center justify-center">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={currentProduct?.name || 'Prenda'}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="text-xs text-brand-muted font-mono">
                  Sin imagen disponible
                </div>
              )}

              {/* Status Badge */}
              {isOutOfStock ? (
                <div className="absolute top-4 left-4">
                  <Badge variant="danger">Agotado</Badge>
                </div>
              ) : isReachedLimit ? (
                <div className="absolute top-4 left-4">
                  <Badge variant="warning">Tope en carrito</Badge>
                </div>
              ) : null}
            </div>

            {/* Thumbnail Carousel / List */}
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {galleryImages.map((imgUrl, index) => {
                  const isSelected = selectedImage === imgUrl;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedImage(imgUrl)}
                      className={`relative w-20 h-24 rounded-card overflow-hidden border transition-all flex-shrink-0 focus:outline-none ${
                        isSelected
                          ? 'border-brand-primary ring-2 ring-brand-primary ring-offset-1'
                          : 'border-border hover:border-border-strong opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Miniatura ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Metadata & Purchase Box */}
          <div className="space-y-6">
            {/* Badges & Category Header */}
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
                  <>
                    {totalStock === 0 ? (
                      <Badge variant="danger">Agotado</Badge>
                    ) : remainingStock === 0 ? (
                      <Badge variant="warning">Tope en carrito alcanzado</Badge>
                    ) : remainingStock <= 3 ? (
                      <Badge variant="warning">
                        ¡Solo quedan {remainingStock} disponibles!
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        En stock
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-primary">
                {currentProduct?.name}
              </h1>

              <div className="flex items-baseline gap-4 pt-1">
                <span className="text-2xl font-bold text-brand-primary">
                  {formattedPrice}
                </span>
                {selectedVariant?.sku && (
                  <span className="text-xs font-mono text-brand-muted">
                    SKU: {selectedVariant.sku}
                  </span>
                )}
              </div>
            </div>

            {/* Product Description */}
            {currentProduct?.description && (
              <p className="text-sm text-brand-secondary leading-relaxed border-t border-border pt-4">
                {currentProduct.description}
              </p>
            )}

            {/* Variant Selector (Colors and Sizes) */}
            <div className="border-t border-border pt-4 space-y-4">
              <VariantSelector
                variants={currentProduct?.product_variants || []}
                selectedVariant={selectedVariant}
                onVariantChange={handleVariantChange}
              />

              {/* Size Matcher Trigger */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-brand-secondary">
                  {hasUserMeasurements
                    ? 'Talla personalizada según tus medidas'
                    : '¿No estás seguro de tu talla?'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSizeMatcherOpen(true)}
                  className="inline-flex items-center text-xs font-semibold text-accent hover:text-accent-hover transition-colors focus:outline-none"
                >
                  {hasUserMeasurements
                    ? '🔄 Modificar mis medidas / Recalcular'
                    : '📏 ¿No estás seguro de tu talla? Calculador de Talla'}
                </button>
              </div>

              {/* Banner informativo condicional según ciclo de vida */}
              {hasUserMeasurements && recommendedSize && (
                isRecommendedInStock ? (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border text-xs flex items-center gap-2 text-brand-primary animate-in fade-in duration-150">
                    <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>Según tus medidas, te sugerimos la talla {recommendedSize}.</span>
                  </div>
                ) : (
                  <div className="border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs p-2.5 rounded-card flex items-center gap-2 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    <span>Tu talla sugerida ({recommendedSize}) no se encuentra disponible actualmente en este color.</span>
                  </div>
                )
              )}
            </div>

            {/* Quantity Selector and Add to Cart */}
            <div className="border-t border-border pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-brand-secondary block">
                    Cantidad
                  </label>
                  <div className="flex items-center border border-border rounded-button bg-surface-card overflow-hidden">
                    <button
                      type="button"
                      disabled={quantity <= 1 || isReachedLimit || isOutOfStock}
                      onClick={handleDecrement}
                      className="w-9 h-9 flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-sm font-bold text-brand-primary">
                      {remainingStock === 0 ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      disabled={quantity >= remainingStock || isReachedLimit || isOutOfStock}
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
                    disabled={isReachedLimit || isOutOfStock}
                    onClick={handleAddToCartClick}
                    className="w-full"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {isOutOfStock
                      ? 'Sin stock'
                      : isReachedLimit
                      ? 'Límite en carrito alcanzado'
                      : 'Agregar al carrito'}
                  </Button>
                </div>
              </div>

              {/* Hygiene Policy Mandatory Warning */}
              <div className="flex items-start gap-2.5 p-3 rounded-card bg-surface-subtle border border-border text-brand-secondary">
                <ShieldAlert className="w-4 h-4 text-brand-muted flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  <strong className="text-brand-primary">Política de higiene:</strong> Por
                  motivos de protección sanitaria, la ropa interior no cuenta con cambios ni
                  devoluciones una vez abierto el empaque.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Size Matcher Modal */}
        <SizeMatcherModal
          isOpen={isSizeMatcherOpen}
          onClose={() => setIsSizeMatcherOpen(false)}
          onSizeSelected={handleSizeSelected}
          garmentFamily={derivedFamily}
          category={currentProduct?.categories?.slug || currentProduct?.category}
          productType={derivedFamily}
        />
      </div>
    </div>
  );
}
