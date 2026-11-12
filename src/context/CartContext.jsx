import { createContext, useContext, useEffect, useState, useRef } from "react";
import { CheckCircle2, ShoppingBag, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const CartContext = createContext(null);
const STORAGE_KEY = "erxidi_cart";

export function CartProvider({ children }) {
  const { user } = useAuth();

  const [items, setItems] = useState(() => {
    try {
      const local =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem("erxidi_cart_v1");
      const parsed = local ? JSON.parse(local) : [];

      // Garantizar deduplicación estricta por variantId en la hidratación
      const deduplicatedMap = new Map();
      parsed.forEach((raw) => {
        const vId = Number(raw.variantId || raw.variant_id);
        if (!vId) return;
        const rawStock = raw.availableStock ?? raw.stock;
        const numStock = rawStock !== undefined ? Number(rawStock) : 10;
        const qty = Number(raw.quantity) || 1;

        if (deduplicatedMap.has(vId)) {
          const prev = deduplicatedMap.get(vId);
          prev.quantity += qty;
        } else {
          deduplicatedMap.set(vId, {
            ...raw,
            variantId: vId,
            productId: raw.productId || raw.product_id || null,
            availableStock: numStock,
            stock: numStock,
            isOutOfStock: raw.isOutOfStock ?? (numStock <= 0),
            isShortStock: numStock < qty,
            quantity: qty,
          });
        }
      });

      return Array.from(deduplicatedMap.values());
    } catch {
      return [];
    }
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const openCartDrawer = () => setIsCartOpen(true);
  const closeCartDrawer = () => setIsCartOpen(false);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // 1. Suscripción Supabase Realtime a cambios de inventario y productos
  useEffect(() => {
    const channel = supabase
      .channel("public:product_variants_cart")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "product_variants",
        },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;

          setItems((prevItems) => {
            let hasChanges = false;
            const next = prevItems.map((item) => {
              if (Number(item.variantId) === Number(updated.id)) {
                hasChanges = true;
                const newStock = Number(updated.stock);
                const isInactive = updated.is_active === false;
                const effectiveStock = isInactive ? 0 : newStock;
                return {
                  ...item,
                  stock: effectiveStock,
                  availableStock: effectiveStock,
                  isOutOfStock: isInactive || effectiveStock <= 0,
                  isShortStock: !isInactive && effectiveStock < Number(item.quantity),
                };
              }
              return item;
            });
            return hasChanges ? next : prevItems;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
        },
        (payload) => {
          const updatedProduct = payload.new;
          if (!updatedProduct) return;

          setItems((prevItems) => {
            let hasChanges = false;
            const next = prevItems.map((item) => {
              const itemProductId = Number(item.productId || item.product_id);
              if (itemProductId === Number(updatedProduct.id)) {
                hasChanges = true;
                const newPrice = Number(updatedProduct.price);
                const isInactive = updatedProduct.is_active === false;
                return {
                  ...item,
                  price: !isNaN(newPrice) ? newPrice : item.price,
                  ...(isInactive
                    ? {
                        stock: 0,
                        availableStock: 0,
                        isOutOfStock: true,
                        isShortStock: true,
                      }
                    : {}),
                };
              }
              return item;
            });
            return hasChanges ? next : prevItems;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Efecto de sincronización/fusión inicial con Supabase
  useEffect(() => {
    let isMounted = true;

    async function syncCart() {
      if (!user) {
        if (isMounted) setIsInitialized(true);
        return;
      }

      try {
        // Consultar cart_items del usuario
        const { data: cloudItems, error } = await supabase
          .from("cart_items")
          .select("id, variant_id, quantity, product_variants(*, sizes(id, name, display_order), products(*, product_color_images(*)))")
          .eq("user_id", user.id);

        if (error) throw error;

        if (isMounted) {
          // Fusión inteligente: Si hay ítems locales y Supabase está vacío, subir los locales a Supabase
          const currentLocal = items;
          if ((!cloudItems || cloudItems.length === 0) && currentLocal.length > 0) {
            // Subir a Supabase
            const payload = currentLocal.map((it) => ({
              user_id: user.id,
              variant_id: Number(it.variantId),
              quantity: Number(it.quantity) || 1,
              updated_at: new Date().toISOString(),
            }));
            await supabase
              .from("cart_items")
              .upsert(payload, { onConflict: "user_id,variant_id" });
          } else if (cloudItems && cloudItems.length > 0) {
            // Consolidar por variantId para evitar duplicados provenientes de la nube
            const cloudMap = new Map();
            cloudItems.forEach((ci) => {
              const vId = Number(ci.variant_id);
              if (!vId) return;
              const stockVal = Number(ci.product_variants?.stock ?? 10);
              const qtyVal = Number(ci.quantity) || 1;

              // Obtener el color de la variante en minúsculas
              const vColor = ci.product_variants?.color?.toLowerCase();

              // Filtrar las imágenes del producto que pertenezcan a ese color exacto
              const colorImages = Array.isArray(ci.product_variants?.products?.product_color_images)
                ? ci.product_variants.products.product_color_images.filter(
                    (img) => img.color?.toLowerCase() === vColor && Boolean(img.image_url)
                  )
                : [];

              // Prioridad: foto de portada del color -> cualquier foto de ese color -> variant.image_url -> null
              const resolvedImageUrl =
                colorImages.find((img) => img.is_cover)?.image_url ||
                colorImages[0]?.image_url ||
                ci.product_variants?.image_url ||
                null;

              // Resolver el nombre de la talla desde la relación sizes
              const resolvedSize =
                ci.product_variants?.sizes?.name ||
                ci.product_variants?.size ||
                "M";

              if (cloudMap.has(vId)) {
                cloudMap.get(vId).quantity += qtyVal;
              } else {
                cloudMap.set(vId, {
                  id: ci.id,
                  variantId: vId,
                  productId:
                    ci.product_variants?.product_id ||
                    ci.product_variants?.products?.id ||
                    null,
                  name: ci.product_variants?.products?.name || "Prenda",
                  price: Number(ci.product_variants?.products?.price || 0),
                  size: resolvedSize,
                  color: ci.product_variants?.color || "—",
                  quantity: qtyVal,
                  imageUrl: resolvedImageUrl,
                  stock: stockVal,
                  availableStock: stockVal,
                  isOutOfStock: stockVal <= 0,
                  isShortStock: stockVal < qtyVal,
                });
              }
            });
            setItems(Array.from(cloudMap.values()));
          }
          setIsInitialized(true);
        }
      } catch (err) {
        console.warn("Fallo al sincronizar carrito en la nube, manteniendo local:", err);
        if (isMounted) setIsInitialized(true);
      }
    }

    syncCart();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // 3. Persistencia en localStorage (SOLO se ejecuta tras inicializar)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Error al persistir carrito local:", err);
    }
  }, [items, isInitialized]);

  // 4. Debounce para persistir cambios en Supabase para usuarios logueados
  useEffect(() => {
    if (!isInitialized || !user) return;

    const timer = setTimeout(async () => {
      try {
        // Limpiar y sincronizar estado actual en cart_items
        await supabase.from("cart_items").delete().eq("user_id", user.id);
        if (items.length > 0) {
          const uniquePayload = new Map();
          items.forEach((it) => {
            const vId = Number(it.variantId);
            const q = Number(it.quantity) || 1;
            uniquePayload.set(vId, (uniquePayload.get(vId) || 0) + q);
          });

          const payload = Array.from(uniquePayload.entries()).map(([vId, q]) => ({
            user_id: user.id,
            variant_id: vId,
            quantity: q,
            updated_at: new Date().toISOString(),
          }));
          await supabase.from("cart_items").insert(payload);
        }
      } catch (err) {
        console.warn("Error al persistir cart_items con debounce:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [items, user, isInitialized]);

  const showAddToast = (item, addedQty, isLimited) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({
      name: item.name,
      size: item.size,
      color: item.color,
      imageUrl: item.imageUrl,
      addedQty,
      isLimited,
      timestamp: Date.now(),
    });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3600);
  };

  const addItem = (item, quantity = 1) => {
    if (!item) {
      return { success: false, reason: "invalid_item" };
    }

    const rawStock = item.availableStock ?? item.stock;
    const maxStock = rawStock !== undefined ? Math.max(0, Number(rawStock) || 0) : undefined;
    const requestedQty = Number(quantity !== 1 ? quantity : item.quantity || 1);
    const cleanQty = Math.max(1, requestedQty || 1);

    const targetVariantId = Number(item.variantId);
    const targetProductId =
      item.productId ||
      item.product_id ||
      item.product?.id ||
      null;

    let toastAddedQty = cleanQty;
    let toastIsLimited = false;

    setItems((prevItems) => {
      // 1. Unicidad por variantId
      const existingIndex = prevItems.findIndex(
        (it) => Number(it.variantId) === targetVariantId
      );

      // 2. Regla de Acumulación
      if (existingIndex > -1) {
        const prevExisting = prevItems[existingIndex];
        const existingQty = Number(prevExisting.quantity) || 0;
        const currentStock =
          maxStock !== undefined
            ? maxStock
            : Number(prevExisting.availableStock ?? prevExisting.stock ?? 999);

        const requestedTotal = existingQty + cleanQty;
        const finalQuantity = currentStock > 0
          ? Math.min(requestedTotal, currentStock)
          : requestedTotal;

        toastAddedQty = Math.max(0, finalQuantity - existingQty);
        toastIsLimited = requestedTotal > currentStock && currentStock > 0;

        const effectiveStock = maxStock !== undefined
          ? maxStock
          : prevExisting.availableStock || prevExisting.stock || 10;

        const updated = [...prevItems];
        updated[existingIndex] = {
          ...prevExisting,
          productId: targetProductId || prevExisting.productId,
          price: Number(item.price ?? prevExisting.price),
          stock: effectiveStock,
          availableStock: effectiveStock,
          isOutOfStock: effectiveStock <= 0,
          isShortStock: effectiveStock < finalQuantity,
          quantity: finalQuantity,
        };
        return updated;
      }

      // Si no existe (existingIndex === -1), agregar el nuevo objeto
      const effectiveStock = maxStock !== undefined ? maxStock : 999;
      const finalQuantity = effectiveStock > 0
        ? Math.min(cleanQty, effectiveStock)
        : cleanQty;

      toastAddedQty = finalQuantity;
      toastIsLimited = cleanQty > effectiveStock && effectiveStock > 0;

      const initialStock = maxStock !== undefined ? maxStock : 10;
      return [
        ...prevItems,
        {
          ...item,
          variantId: targetVariantId,
          productId: targetProductId,
          price: Number(item.price) || 0,
          stock: initialStock,
          availableStock: initialStock,
          isOutOfStock: initialStock <= 0,
          isShortStock: initialStock < finalQuantity,
          quantity: finalQuantity,
        },
      ];
    });

    if (toastAddedQty > 0) {
      showAddToast(item, toastAddedQty, toastIsLimited);
    }

    return toastIsLimited ? { success: true, limited: true } : { success: true };
  };

  const updateQuantity = (variantId, newQuantity) => {
    const targetVariantId = Number(variantId);
    const parsedQty = Number(newQuantity) || 0;

    if (parsedQty <= 0) {
      removeItem(targetVariantId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (Number(item.variantId) === targetVariantId) {
          const maxStock = Math.max(
            1,
            Number(item.availableStock ?? item.stock) || 10
          );
          const finalQty = Math.min(parsedQty, maxStock);
          return {
            ...item,
            quantity: finalQty,
            isShortStock: (item.availableStock ?? item.stock) < finalQty,
          };
        }
        return item;
      })
    );
  };

  const removeItem = (variantId) => {
    const targetVariantId = Number(variantId);
    setItems((prevItems) =>
      prevItems.filter((item) => Number(item.variantId) !== targetVariantId)
    );
  };

  const clearCart = async () => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("erxidi_cart_v1");
    } catch {
      // ignore
    }

    if (user?.id) {
      try {
        await supabase.from("cart_items").delete().eq("user_id", user.id);
      } catch (err) {
        console.warn("Error al vaciar cart_items:", err);
      }
    }
  };

  const totalUnits = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0
  );
  const subtotal = Number(
    items
      .reduce(
        (acc, item) =>
          acc + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
      )
      .toFixed(2)
  );

  const value = {
    items,
    totalUnits,
    subtotal,
    addItem,
    addToCart: addItem, // Alias para compatibilidad con QuickAddModal
    updateQuantity,
    removeItem,
    removeFromCart: removeItem,
    clearCart,
    isCartOpen,
    setIsCartOpen,
    openCartDrawer,
    closeCartDrawer,
  };

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* Notificación Flotante de Producto Agregado */}
      {toast && (
        <div
          key={toast.timestamp}
          className="fixed top-20 right-4 z-50 w-80 sm:w-96 bg-white border-2 border-brand-primary rounded-card shadow-2xl p-3.5 animate-in fade-in slide-in-from-top-4 duration-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-14 rounded bg-surface-subtle border border-border overflow-hidden shrink-0">
              {toast.imageUrl ? (
                <img
                  src={toast.imageUrl}
                  alt={toast.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-brand-muted" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>¡Agregado a tu bolsa!</span>
              </div>
              <p className="text-xs font-bold text-brand-primary truncate mt-0.5">
                {toast.name}
              </p>
              <p className="text-[11px] text-brand-secondary mt-0.5">
                Talla: <strong>{toast.size}</strong>
                {toast.color ? " • Color: " + toast.color : ""} • Cant: +
                {toast.addedQty}
              </p>
              <p className="text-[11px] font-mono font-semibold text-brand-primary mt-1">
                Total en carrito: {totalUnits}{" "}
                {totalUnits === 1 ? "unidad" : "unidades"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-brand-muted hover:text-brand-primary p-1"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe ser utilizado dentro de un CartProvider");
  }
  return context;
}
