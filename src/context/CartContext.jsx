import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, ShoppingBag, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const CartContext = createContext(null);
const STORAGE_KEY = "erxidi_cart_v1";

const mapCartItemRow = (row) => {
  const variant = row.product_variants;
  const product = variant?.products;

  // Validación estricta: variant.stock > 0 && variant.is_active !== false
  if (
    !variant ||
    variant.is_active === false ||
    product?.is_active === false ||
    (Number(variant.stock) || 0) <= 0
  ) {
    return null;
  }

  const maxStock = Math.max(0, Number(variant.stock) || 0);
  const qty = Math.max(1, Math.min(Number(row.quantity) || 1, maxStock));

  return {
    id: row.id,
    variantId: Number(row.variant_id),
    productId: product?.id,
    name: product?.name || "Prenda",
    price: Number(product?.price || 0),
    size: variant.size,
    color: variant.color,
    quantity: qty,
    imageUrl: product?.main_image_url || "",
    stock: maxStock,
    sku: variant.sku || "",
  };
};

export function CartProvider({ children }) {
  const { user } = useAuth();

  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const openCartDrawer = () => setIsCartOpen(true);
  const closeCartDrawer = () => setIsCartOpen(false);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const previousUserRef = useRef(user?.id || null);
  const isMergingRef = useRef(false);

  // Consulta cart_items consolidada con product_variants y products desde Supabase
  const fetchSupabaseCart = useCallback(async (userId) => {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          variant_id,
          quantity,
          product_variants:variant_id (
            id,
            size,
            color,
            stock,
            is_active,
            sku,
            products:product_id (
              id,
              name,
              price,
              main_image_url,
              is_active
            )
          )
        `)
        .eq("user_id", userId);

      if (error) {
        console.error("Error al obtener cart_items de Supabase:", error);
        return [];
      }

      if (!Array.isArray(data)) return [];

      return data.map(mapCartItemRow).filter(Boolean);
    } catch (err) {
      console.error("Error al consultar carrito en Supabase:", err);
      return [];
    }
  }, []);

  // 2.1 Carga Inicial y Fusión de Sesión (Merge on Login)
  useEffect(() => {
    let isMounted = true;

    async function syncCartOnUserChange() {
      if (user?.id) {
        if (isMergingRef.current) return;
        isMergingRef.current = true;

        try {
          // 1. Obtener ítems locales previos (invitado) para fusionar
          let localGuestItems = [];
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              localGuestItems = JSON.parse(stored);
            }
          } catch {
            localGuestItems = [];
          }

          if (Array.isArray(localGuestItems) && localGuestItems.length > 0) {
            // Consultar ítems existentes en la BD para este usuario para sumar cantidades
            const { data: existingRows } = await supabase
              .from("cart_items")
              .select("variant_id, quantity")
              .eq("user_id", user.id);

            const existingMap = new Map(
              (existingRows || []).map((r) => [
                Number(r.variant_id),
                Number(r.quantity),
              ])
            );

            const upsertPayload = localGuestItems.map((item) => {
              const varId = Number(item.variantId);
              const currentDbQty = existingMap.get(varId) || 0;
              const mergedQty = Math.max(
                1,
                currentDbQty + (Number(item.quantity) || 1)
              );
              return {
                user_id: user.id,
                variant_id: varId,
                quantity: mergedQty,
                updated_at: new Date().toISOString(),
              };
            });

            if (upsertPayload.length > 0) {
              await supabase
                .from("cart_items")
                .upsert(upsertPayload, { onConflict: "user_id,variant_id" });
            }

            // Limpiar el residuo transitorio en localStorage
            localStorage.removeItem(STORAGE_KEY);
          }

          // 2. Consultar la tabla cart_items consolidada con product_variants y products
          const consolidated = await fetchSupabaseCart(user.id);
          if (isMounted) {
            setItems(consolidated);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(consolidated));
            } catch {
              // ignore
            }
          }
        } finally {
          isMergingRef.current = false;
        }
      } else if (previousUserRef.current && !user?.id) {
        // Cierre de sesión: limpiar memoria y localStorage
        setItems([]);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      previousUserRef.current = user?.id || null;
    }

    syncCartOnUserChange();

    return () => {
      isMounted = false;
    };
  }, [user?.id, fetchSupabaseCart]);

  // Sincronización continua de localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

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
    const maxStock = Math.max(0, Number(item?.stock) || 0);
    const cleanQty = Math.max(1, Number(quantity) || 1);

    if (!item || maxStock <= 0) {
      return { success: false, reason: "out_of_stock" };
    }

    const targetVariantId = Number(item.variantId);
    const existingItem = items.find(
      (i) => Number(i.variantId) === targetVariantId
    );
    const currentQty = existingItem ? Number(existingItem.quantity) || 0 : 0;
    const requestedTotal = currentQty + cleanQty;
    const isLimited = requestedTotal > maxStock;
    const effectiveAdded = Math.max(
      0,
      Math.min(cleanQty, maxStock - currentQty)
    );
    const finalQuantity = Math.min(requestedTotal, maxStock);

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => Number(i.variantId) === targetVariantId
      );

      if (existingIndex > -1) {
        const prevExisting = prevItems[existingIndex];
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...prevExisting,
          price: Number(item.price ?? prevExisting.price),
          stock: maxStock,
          quantity: finalQuantity,
        };
        return updated;
      }

      return [
        ...prevItems,
        {
          ...item,
          variantId: targetVariantId,
          price: Number(item.price) || 0,
          stock: maxStock,
          quantity: finalQuantity,
        },
      ];
    });

    if (effectiveAdded > 0) {
      showAddToast(item, effectiveAdded, isLimited);
    }

    if (user?.id) {
      supabase
        .from("cart_items")
        .upsert(
          {
            user_id: user.id,
            variant_id: targetVariantId,
            quantity: finalQuantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,variant_id" }
        )
        .then(({ error }) => {
          if (error) {
            console.error("Error al persistir addItem en Supabase:", error);
          }
        })
        .catch((err) => {
          console.error("Error en upsert de addItem:", err);
        });
    }

    return isLimited ? { success: true, limited: true } : { success: true };
  };

  const updateQuantity = (variantId, newQuantity) => {
    const targetVariantId = Number(variantId);
    const parsedQty = Number(newQuantity) || 0;

    if (parsedQty <= 0) {
      removeItem(targetVariantId);
      return;
    }

    const currentItem = items.find(
      (i) => Number(i.variantId) === targetVariantId
    );
    const maxStock = Math.max(1, Number(currentItem?.stock) || 1);
    const effectiveQty = Math.min(parsedQty, maxStock);

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (Number(item.variantId) === targetVariantId) {
          return {
            ...item,
            quantity: effectiveQty,
          };
        }
        return item;
      })
    );

    if (user?.id) {
      supabase
        .from("cart_items")
        .update({
          quantity: effectiveQty,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("variant_id", targetVariantId)
        .then(({ error }) => {
          if (error) {
            console.error("Error actualizando cart_items en Supabase:", error);
          }
        })
        .catch((err) => {
          console.error("Error en updateQuantity:", err);
        });
    }
  };

  const removeItem = (variantId) => {
    const targetVariantId = Number(variantId);
    setItems((prevItems) =>
      prevItems.filter((item) => Number(item.variantId) !== targetVariantId)
    );

    if (user?.id) {
      supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id)
        .eq("variant_id", targetVariantId)
        .then(({ error }) => {
          if (error) {
            console.error("Error eliminando fila de cart_items en Supabase:", error);
          }
        })
        .catch((err) => {
          console.error("Error en removeItem:", err);
        });
    }
  };

  const clearCart = async () => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    if (user?.id) {
      try {
        const { error } = await supabase
          .from("cart_items")
          .delete()
          .eq("user_id", user.id);
        if (error) {
          console.error("Error al vaciar cart_items en Supabase:", error);
        }
      } catch (err) {
        console.error("Error en clearCart:", err);
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
    updateQuantity,
    removeItem,
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
