import { createContext, useContext, useEffect, useState, useRef } from "react";
import { CheckCircle2, ShoppingBag, X } from "lucide-react";

const CartContext = createContext(null);
const STORAGE_KEY = "erxidi_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => Number(i.variantId) === targetVariantId
      );

      if (existingIndex > -1) {
        const prevExisting = prevItems[existingIndex];
        const updatedQuantity = Math.min(
          (Number(prevExisting.quantity) || 0) + cleanQty,
          maxStock
        );
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...prevExisting,
          price: Number(item.price ?? prevExisting.price),
          stock: maxStock,
          quantity: updatedQuantity,
        };
        return updated;
      }

      const initialQuantity = Math.min(cleanQty, maxStock);
      return [
        ...prevItems,
        {
          ...item,
          variantId: targetVariantId,
          price: Number(item.price) || 0,
          stock: maxStock,
          quantity: initialQuantity,
        },
      ];
    });

    if (effectiveAdded > 0) {
      showAddToast(item, effectiveAdded, isLimited);
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

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (Number(item.variantId) === targetVariantId) {
          const maxStock = Math.max(1, Number(item.stock) || 1);
          return {
            ...item,
            quantity: Math.min(parsedQty, maxStock),
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

  const clearCart = () => {
    setItems([]);
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