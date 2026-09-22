import { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  /**
   * Añade una variante al carrito.
   * payload: { variantId, productId, name, size, color, colorHex, price, stock, imageUrl }
   */
  const addItem = (item, quantity = 1) => {
    if (item.stock <= 0) {
      throw new Error("La variante seleccionada se encuentra agotada.");
    }

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => i.variantId === item.variantId,
      );

      if (existingIndex > -1) {
        const existingItem = prevItems[existingIndex];
        const updatedQuantity = existingItem.quantity + quantity;

        // Impedir que la cantidad total exceda el inventario físico disponible
        if (updatedQuantity > item.stock) {
          throw new Error(
            `Solo quedan ${item.stock} unidades disponibles de esta talla.`,
          );
        }

        const updated = [...prevItems];
        updated[existingIndex] = { ...existingItem, quantity: updatedQuantity };
        return updated;
      }

      // Si no existía, validar que la cantidad inicial no exceda el stock
      const initialQuantity = Math.min(quantity, item.stock);
      return [...prevItems, { ...item, quantity: initialQuantity }];
    });
  };

  const updateQuantity = (variantId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(variantId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.variantId === variantId) {
          if (newQuantity > item.stock) {
            return { ...item, quantity: item.stock };
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    );
  };

  const removeItem = (variantId) => {
    setItems((prevItems) =>
      prevItems.filter((item) => item.variantId !== variantId),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // Cálculos financieros derivados
  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = Number(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2),
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe ser utilizado dentro de un CartProvider");
  }
  return context;
}
